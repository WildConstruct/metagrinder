import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BudgetCaps, BudgetLedger, RunManifest, StageRecord } from '../schemas/run-manifest';
import { BudgetLedgerSchema, RunManifestSchema } from '../schemas/run-manifest';
import type { StageState } from '../schemas/vocabulary';
import { schemaFor } from '../schemas/registry';
import { sha256Hex } from './ids';
import { campaignBudgetPath, readSharedBudget, withBudgetFileLock, withBudgetFileLocks, writeBudgetJsonAtomic } from './shared-budget';

/**
 * RunStore: the only way artifacts enter or leave a run folder.
 * - Every write validates against the family schema first (AC-1.4c) and is
 *   recorded in the manifest with a content hash.
 * - Every read re-validates, so a hand-edited or corrupted file fails loudly.
 * - The manifest persists on every mutation; RunStore.open() resumes from it
 *   (AC-1.4b).
 */

const MANIFEST_FILE = 'run-manifest.json';

function resolveContainedPath(root: string, candidate: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(resolvedRoot, candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay within ${resolvedRoot}: ${candidate}`);
  }
  return resolvedCandidate;
}

export class ArtifactValidationError extends Error {
  constructor(family: string, public readonly issues: string) {
    super(`artifact failed ${family} schema validation: ${issues}`);
    this.name = 'ArtifactValidationError';
  }
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly stage: string,
    public readonly ledgerIds: string[],
    message: string
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export interface BudgetReservation {
  reservationId: string;
  stage: string;
  kind: 'llm' | 'judge';
  ledgerIds: string[];
  reservedOutputTokens: number;
}

export class RunStore {
  private budgetLockHeld = false;
  private constructor(
    public readonly runDir: string,
    private manifest: RunManifest
  ) {}

  static create(options: {
    baseDir: string;
    runId: string;
    inputId: string;
    parserVersion: string;
    now?: () => string;
  }): RunStore {
    const now = options.now ?? (() => new Date().toISOString());
    const runDir = resolveContainedPath(options.baseDir, options.runId, 'run path');
    fs.mkdirSync(runDir, { recursive: true });
    if (fs.existsSync(path.join(runDir, MANIFEST_FILE))) {
      throw new Error(`run folder already has a manifest: ${runDir} — use RunStore.open()`);
    }
    const manifest = RunManifestSchema.parse({
      artifact: 'run-manifest',
      runId: options.runId,
      inputId: options.inputId,
      createdAt: now(),
      updatedAt: now(),
      parserVersion: options.parserVersion,
      budgets: [{
        ledgerId: `run:${options.runId}`,
        scope: 'run',
        scopeId: options.runId,
        caps: {},
        usage: { llmCalls: 0, judgeCalls: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0 }
      }]
    });
    const store = new RunStore(runDir, manifest);
    withBudgetFileLock(path.join(runDir, MANIFEST_FILE), () => {
      if (fs.existsSync(path.join(runDir, MANIFEST_FILE))) {
        throw new Error(`run folder already has a manifest: ${runDir} — use RunStore.open()`);
      }
      store.budgetLockHeld = true;
      try {
        store.persistManifest();
      } finally {
        store.budgetLockHeld = false;
      }
    });
    return store;
  }

  static open(runDir: string): RunStore {
    const raw = fs.readFileSync(path.join(runDir, MANIFEST_FILE), 'utf8');
    const manifest = RunManifestSchema.parse(JSON.parse(raw));
    return new RunStore(runDir, manifest);
  }

  getManifest(): RunManifest {
    this.refreshManifest();
    return RunManifestSchema.parse(JSON.parse(JSON.stringify(this.manifest)));
  }

  /** Validate-then-write. Invalid artifacts never touch disk. */
  writeArtifact(family: string, fileName: string, data: unknown, now?: () => string): string {
    const schema = schemaFor(family);
    if (!schema) {
      throw new Error(`unknown artifact family: ${family}`);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new ArtifactValidationError(family, parsed.error.message);
    }
    const serialized = `${JSON.stringify(parsed.data, null, 2)}\n`;
    return this.withManifestLock(() => {
      const filePath = resolveContainedPath(this.runDir, fileName, 'artifact path');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, serialized, 'utf8');

      const timestamp = (now ?? (() => new Date().toISOString()))();
      const artifactId = `${family}:${fileName}`;
      this.manifest.artifacts = [
        ...this.manifest.artifacts.filter((a) => a.artifactId !== artifactId),
        {
          artifactId,
          family,
          path: fileName,
          contentSha256: sha256Hex(serialized),
          writtenAt: timestamp
        }
      ];
      this.touch(timestamp);
      return filePath;
    });
  }

  /** Read-and-revalidate. Tampered files fail loudly. */
  readArtifact<T = unknown>(family: string, fileName: string): T {
    const schema = schemaFor(family);
    if (!schema) {
      throw new Error(`unknown artifact family: ${family}`);
    }
    return this.withManifestLock(() => {
      const filePath = resolveContainedPath(this.runDir, fileName, 'artifact path');
      const raw = fs.readFileSync(filePath, 'utf8');
      const artifactId = `${family}:${fileName}`;
      const record = this.manifest.artifacts.find((artifact) => artifact.artifactId === artifactId);
      if (!record) {
        throw new Error(`artifact is not recorded in the run manifest: ${artifactId}`);
      }
      const parsed = schema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new ArtifactValidationError(family, parsed.error.message);
      }
      const actualHash = sha256Hex(raw);
      if (actualHash !== record.contentSha256) {
        throw new Error(`artifact content hash mismatch: ${artifactId}`);
      }
      return parsed.data as T;
    });
  }

  private stageRecord(stage: string): StageRecord {
    let record = this.manifest.stages.find((s) => s.stage === stage);
    if (!record) {
      record = { stage, state: 'pending', inputArtifacts: [], outputArtifacts: [] };
      this.manifest.stages.push(record);
    }
    return record;
  }

  setStageState(
    stage: string,
    state: StageState,
    detail?: { gate?: string; error?: string; outputArtifacts?: string[]; inputSignature?: string; replaceOutputArtifacts?: boolean },
    now?: () => string
  ): void {
    this.withManifestLock(() => {
      const timestamp = (now ?? (() => new Date().toISOString()))();
      const record = this.stageRecord(stage);
      record.state = state;
      if (state !== 'blocked_on_gate') delete record.gate;
      if (state !== 'blocked_on_gate' && state !== 'failed') delete record.error;
      if (state === 'running') {
        record.startedAt = timestamp;
        delete record.endedAt;
      } else if (state === 'pending') {
        delete record.startedAt;
        delete record.endedAt;
      }
      if (state === 'complete' || state === 'failed') record.endedAt = timestamp;
      if (detail?.gate !== undefined) record.gate = detail.gate;
      if (detail?.error !== undefined) record.error = detail.error;
      if (detail?.inputSignature !== undefined) record.inputSignature = detail.inputSignature;
      if (detail?.outputArtifacts) {
        record.outputArtifacts = [...new Set(detail.replaceOutputArtifacts
          ? detail.outputArtifacts : [...record.outputArtifacts, ...detail.outputArtifacts])];
      }
      this.touch(timestamp);
    });
  }

  getStageState(stage: string): StageState {
    this.refreshManifest();
    return this.manifest.stages.find((s) => s.stage === stage)?.state ?? 'pending';
  }

  /** Stages that can run now: pending, or failed (retry). Blocked stages need their gate. */
  nextRunnableStages(stageOrder: string[]): string[] {
    return stageOrder.filter((stage) => {
      const state = this.getStageState(stage);
      return state === 'pending' || state === 'failed';
    });
  }

  recordModel(stage: string, providerId: string, modelId: string, modelVersion?: string): void {
    this.withManifestLock(() => {
      this.manifest.models = [
        ...this.manifest.models.filter((m) => m.stage !== stage),
        modelVersion !== undefined
          ? { stage, providerId, modelId, modelVersion }
          : { stage, providerId, modelId }
      ];
      this.touch(new Date().toISOString());
    });
  }

  getBudgetLedgers(): BudgetLedger[] {
    return this.withBudgetLedgers(() => this.manifest.budgets.map((ledger) =>
      BudgetLedgerSchema.parse(JSON.parse(JSON.stringify(ledger)))));
  }

  configureBudget(args: {
    ledgerId: string;
    scope: BudgetLedger['scope'];
    scopeId: string;
    caps: BudgetCaps;
    /** Campaign members must share this root; its ledger path persists in the run manifest. */
    sharedBaseDir?: string;
    /** Explicitly clear/replace caps; omission always preserves persisted policy. */
    replaceCaps?: boolean;
    now?: () => string;
  }): void {
    const suggestedSharedPath = args.scope === 'campaign'
      ? campaignBudgetPath(args.sharedBaseDir ?? path.dirname(this.runDir), args.scopeId)
      : undefined;
    this.withBudgetLedgers((previousLedgers) => {
      const previous = previousLedgers.find((ledger) => ledger.ledgerId === args.ledgerId);
      let ledger = this.manifest.budgets.find((candidate) => candidate.ledgerId === args.ledgerId);
      if (ledger && (ledger.scope !== args.scope || ledger.scopeId !== args.scopeId)) {
        throw new Error(`budget ledger identity cannot change: ${args.ledgerId}`);
      }
      if (args.scope === 'campaign') {
        const sharedPath = ledger?.sharedLedgerPath ?? suggestedSharedPath!;
        if (args.sharedBaseDir !== undefined && sharedPath !== suggestedSharedPath) {
          throw new Error(`campaign budget location cannot change: ${args.ledgerId}`);
        }
        if (!ledger?.sharedLedgerPath && ledger
          && Object.values(ledger.usage).some((usage) => usage > 0)) {
          throw new Error(`campaign budget migration required for existing usage: ${args.ledgerId}`);
        }
        ledger = fs.existsSync(sharedPath) ? readSharedBudget(sharedPath) : BudgetLedgerSchema.parse({
          ledgerId: args.ledgerId, scope: args.scope, scopeId: args.scopeId, sharedLedgerPath: sharedPath
        });
        if (ledger.ledgerId !== args.ledgerId || ledger.scope !== args.scope || ledger.scopeId !== args.scopeId) {
          throw new Error(`shared campaign budget identity mismatch: ${args.ledgerId}`);
        }
        ledger.sharedLedgerPath = sharedPath;
      } else {
        ledger ??= BudgetLedgerSchema.parse({ ledgerId: args.ledgerId, scope: args.scope, scopeId: args.scopeId });
      }
      const provided = Object.fromEntries(Object.entries(args.caps).filter(([, value]) => value !== undefined));
      ledger.caps = args.replaceCaps ? { ...provided } : { ...ledger.caps, ...provided };
      ledger = BudgetLedgerSchema.parse(ledger);
      this.manifest.budgets = [...this.manifest.budgets.filter((entry) => entry.ledgerId !== args.ledgerId), ledger];
      const increased = (['maxLlmCalls', 'maxJudgeCalls', 'maxEstimatedTokens'] as const).some((key) => {
        const before = previous?.caps[key];
        const after = ledger!.caps[key];
        return before !== undefined && (after === undefined || after > before);
      });
      if (increased) {
        for (const record of this.manifest.stages) {
          if (record.state === 'blocked_on_gate' && record.gate === 'budget-cap') {
            record.state = 'pending';
            delete record.gate;
            delete record.error;
          }
        }
      }
      this.persistSharedBudgets();
      this.touch((args.now ?? (() => new Date().toISOString()))());
    }, suggestedSharedPath ? [suggestedSharedPath] : []);
  }

  reserveBudget(args: {
    stage: string;
    kind: 'llm' | 'judge';
    estimatedInputTokens: number;
    reservedOutputTokens: number;
    ledgerIds?: string[];
    now?: () => string;
  }): BudgetReservation {
    if (!Number.isFinite(args.estimatedInputTokens) || args.estimatedInputTokens < 0
      || !Number.isFinite(args.reservedOutputTokens) || args.reservedOutputTokens < 0) {
      throw new Error('budget token estimates must be finite nonnegative numbers');
    }
    return this.withBudgetLedgers(() => {
      const inputTokens = Math.ceil(args.estimatedInputTokens);
      const outputTokens = Math.ceil(args.reservedOutputTokens);
      // Configured run/campaign limits are mandatory; explicit selections may
      // add checks but cannot opt out of a persisted cap.
      const ledgerIds = [...new Set([
        ...this.manifest.budgets.map((ledger) => ledger.ledgerId),
        ...(args.ledgerIds ?? [])
      ])];
      if (ledgerIds.length === 0) throw new Error('live provider requires at least one persistent budget ledger');
      const ledgers = ledgerIds.map((ledgerId) => {
        const ledger = this.manifest.budgets.find((candidate) => candidate.ledgerId === ledgerId);
        if (!ledger) throw new Error(`budget ledger not found: ${ledgerId}`);
        return ledger;
      });
      const failures: string[] = [];
      for (const ledger of ledgers) {
        const projectedLlmCalls = ledger.usage.llmCalls + (args.kind === 'llm' ? 1 : 0);
        const projectedJudgeCalls = ledger.usage.judgeCalls + (args.kind === 'judge' ? 1 : 0);
        const projectedTokens = ledger.usage.estimatedInputTokens + ledger.usage.estimatedOutputTokens
          + inputTokens + outputTokens;
        if (ledger.caps.maxLlmCalls !== undefined && projectedLlmCalls > ledger.caps.maxLlmCalls) {
          failures.push(`${ledger.ledgerId} maxLlmCalls`);
        }
        if (ledger.caps.maxJudgeCalls !== undefined && projectedJudgeCalls > ledger.caps.maxJudgeCalls) {
          failures.push(`${ledger.ledgerId} maxJudgeCalls`);
        }
        if (ledger.caps.maxEstimatedTokens !== undefined && projectedTokens > ledger.caps.maxEstimatedTokens) {
          failures.push(`${ledger.ledgerId} maxEstimatedTokens`);
        }
      }
      if (failures.length > 0) {
        const message = `budget cap exceeded before ${args.stage}: ${failures.join(', ')}`;
        this.setStageState(args.stage, 'blocked_on_gate', { gate: 'budget-cap', error: message }, args.now);
        throw new BudgetExceededError(args.stage, ledgerIds, message);
      }
      const reservationId = randomUUID();
      const timestamp = (args.now ?? (() => new Date().toISOString()))();
      for (const ledger of ledgers) {
        if (args.kind === 'llm') ledger.usage.llmCalls++;
        else ledger.usage.judgeCalls++;
        ledger.usage.estimatedInputTokens += inputTokens;
        ledger.usage.estimatedOutputTokens += outputTokens;
        ledger.reservations.push({
          reservationId, stage: args.stage, kind: args.kind, reservedOutputTokens: outputTokens,
          state: 'reserved', createdAt: timestamp
        });
      }
      // Shared spend is durable first; a crash before the run snapshot is conservative.
      this.persistSharedBudgets();
      this.touch(timestamp);
      return { reservationId, stage: args.stage, kind: args.kind, ledgerIds, reservedOutputTokens: outputTokens };
    });
  }

  settleBudget(
    reservation: BudgetReservation,
    actualOutputTokens: number,
    now?: () => string
  ): void {
    if (!Number.isFinite(actualOutputTokens) || actualOutputTokens < 0) {
      throw new Error('actual output tokens must be finite and nonnegative');
    }
    this.withBudgetLedgers(() => {
      const actual = Math.ceil(actualOutputTokens);
      const timestamp = (now ?? (() => new Date().toISOString()))();
      const failures: string[] = [];
      for (const ledgerId of reservation.ledgerIds) {
        const ledger = this.manifest.budgets.find((candidate) => candidate.ledgerId === ledgerId);
        if (!ledger) throw new Error(`budget ledger not found while settling: ${ledgerId}`);
        const pending = ledger.reservations.find((entry) => entry.reservationId === reservation.reservationId);
        if (!pending) throw new Error(`budget reservation not found: ${reservation.reservationId}`);
        if (pending.state === 'reserved') {
          ledger.usage.estimatedOutputTokens += actual - pending.reservedOutputTokens;
          pending.state = 'settled';
          pending.settledAt = timestamp;
        }
        const total = ledger.usage.estimatedInputTokens + ledger.usage.estimatedOutputTokens;
        if (ledger.caps.maxEstimatedTokens !== undefined && total > ledger.caps.maxEstimatedTokens) {
          failures.push(`${ledger.ledgerId} maxEstimatedTokens`);
        }
      }
      this.persistSharedBudgets();
      this.touch(timestamp);
      if (failures.length > 0) {
        const message = `budget cap exceeded after ${reservation.stage}: ${failures.join(', ')}`;
        this.setStageState(reservation.stage, 'blocked_on_gate', { gate: 'budget-cap', error: message }, now);
        throw new BudgetExceededError(reservation.stage, reservation.ledgerIds, message);
      }
    });
  }

  private refreshManifest(): void {
    if (!this.budgetLockHeld && fs.existsSync(path.join(this.runDir, MANIFEST_FILE))) {
      this.manifest = RunManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(this.runDir, MANIFEST_FILE), 'utf8')));
    }
  }

  private withManifestLock<T>(operation: () => T): T {
    if (this.budgetLockHeld) return operation();
    return withBudgetFileLock(path.join(this.runDir, MANIFEST_FILE), () => {
      // Refresh before applying a specific mutation, never after it.
      this.refreshManifest();
      this.budgetLockHeld = true;
      try {
        return operation();
      } finally {
        this.budgetLockHeld = false;
      }
    });
  }

  private withBudgetLedgers<T>(operation: (previousLedgers: BudgetLedger[]) => T, extraPaths: string[] = []): T {
    return withBudgetFileLock(path.join(this.runDir, MANIFEST_FILE), () => {
      this.refreshManifest();
      const previous = this.manifest.budgets.map((ledger) => BudgetLedgerSchema.parse(JSON.parse(JSON.stringify(ledger))));
      const sharedPaths = this.manifest.budgets.flatMap((ledger) => ledger.sharedLedgerPath ? [ledger.sharedLedgerPath] : []);
      return withBudgetFileLocks([...sharedPaths, ...extraPaths], () => {
        this.budgetLockHeld = true;
        try {
          this.manifest.budgets = this.manifest.budgets.map((ledger) => {
            if (!ledger.sharedLedgerPath) return ledger;
            const shared = readSharedBudget(ledger.sharedLedgerPath);
            if (shared.ledgerId !== ledger.ledgerId || shared.scope !== 'campaign' || shared.scopeId !== ledger.scopeId
              || shared.sharedLedgerPath !== ledger.sharedLedgerPath) {
              throw new Error(`shared campaign budget identity mismatch: ${ledger.ledgerId}`);
            }
            return shared;
          });
          return operation(previous);
        } finally {
          this.budgetLockHeld = false;
        }
      });
    });
  }

  private persistSharedBudgets(): void {
    for (const ledger of this.manifest.budgets) {
      if (ledger.sharedLedgerPath) writeBudgetJsonAtomic(ledger.sharedLedgerPath, BudgetLedgerSchema.parse(ledger));
    }
  }

  private touch(timestamp: string): void {
    this.manifest.updatedAt = timestamp;
    this.persistManifest();
  }

  private persistManifest(): void {
    const manifestPath = path.join(this.runDir, MANIFEST_FILE);
    if (!this.budgetLockHeld) throw new Error('manifest persistence requires its mutation lock');
    writeBudgetJsonAtomic(manifestPath, RunManifestSchema.parse(this.manifest));
  }
}

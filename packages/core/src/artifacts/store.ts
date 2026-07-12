import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RunManifest, StageRecord } from '../schemas/run-manifest';
import { RunManifestSchema } from '../schemas/run-manifest';
import type { StageState } from '../schemas/vocabulary';
import { schemaFor } from '../schemas/registry';
import { sha256Hex } from './ids';

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

export class RunStore {
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
      parserVersion: options.parserVersion
    });
    const store = new RunStore(runDir, manifest);
    store.persistManifest();
    return store;
  }

  static open(runDir: string): RunStore {
    const raw = fs.readFileSync(path.join(runDir, MANIFEST_FILE), 'utf8');
    const manifest = RunManifestSchema.parse(JSON.parse(raw));
    return new RunStore(runDir, manifest);
  }

  getManifest(): RunManifest {
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
  }

  /** Read-and-revalidate. Tampered files fail loudly. */
  readArtifact<T = unknown>(family: string, fileName: string): T {
    const schema = schemaFor(family);
    if (!schema) {
      throw new Error(`unknown artifact family: ${family}`);
    }
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
    detail?: { gate?: string; error?: string; outputArtifacts?: string[] },
    now?: () => string
  ): void {
    const timestamp = (now ?? (() => new Date().toISOString()))();
    const record = this.stageRecord(stage);
    record.state = state;
    if (state === 'running' && !record.startedAt) record.startedAt = timestamp;
    if (state === 'complete' || state === 'failed') record.endedAt = timestamp;
    if (detail?.gate !== undefined) record.gate = detail.gate;
    if (detail?.error !== undefined) record.error = detail.error;
    if (detail?.outputArtifacts) {
      record.outputArtifacts = [...new Set([...record.outputArtifacts, ...detail.outputArtifacts])];
    }
    this.touch(timestamp);
  }

  getStageState(stage: string): StageState {
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
    this.manifest.models = [
      ...this.manifest.models.filter((m) => m.stage !== stage),
      modelVersion !== undefined
        ? { stage, providerId, modelId, modelVersion }
        : { stage, providerId, modelId }
    ];
    this.touch(new Date().toISOString());
  }

  private touch(timestamp: string): void {
    this.manifest.updatedAt = timestamp;
    this.persistManifest();
  }

  private persistManifest(): void {
    const validated = RunManifestSchema.parse(this.manifest);
    fs.writeFileSync(
      path.join(this.runDir, MANIFEST_FILE),
      `${JSON.stringify(validated, null, 2)}\n`,
      'utf8'
    );
  }
}

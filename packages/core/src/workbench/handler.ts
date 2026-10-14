import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  IntakeApprovalSchema,
  OperatorNotesSchema,
  OperatorRevisionDecisionsSchema,
  SceneGrammarSchema,
  type OperatorWritableKind
} from '../schemas';
import { computeEraShiftView } from './era-plot';
import { decideParseReuse } from './parse-reuse';
import {
  OPERATOR_STATE_DIR,
  operatorStateRelativePath,
  resolveOperatorWritePath,
  WriteBoundaryError
} from './write-boundary';

/**
 * Pure-ish request handling for the thin workbench (S4.2).
 * Network layer lives in server.ts; this module is unit-tested.
 */

export interface WorkbenchConfig {
  runsRoot: string;
}

export type HandlerResult =
  | { status: number; json: unknown }
  | { status: number; text: string; contentType: string }
  | { status: number; buffer: Buffer; contentType: string };

function runDir(config: WorkbenchConfig, runId: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId) || runId === '.' || runId === '..') {
    throw new WriteBoundaryError('invalid runId');
  }
  const dir = path.resolve(config.runsRoot, runId);
  const root = path.resolve(config.runsRoot);
  const rel = path.relative(root, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new WriteBoundaryError('invalid runId');
  }
  return dir;
}

function readJsonIfExists(filePath: string): unknown | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function knownInputId(dir: string, runId: string): string | undefined {
  const manifest = readJsonIfExists(path.join(dir, 'run-manifest.json'));
  if (!isRecord(manifest)) return undefined;
  if (manifest.runId !== undefined && manifest.runId !== runId) throw new Error('run manifest identity does not match selected run');
  return typeof manifest.inputId === 'string' ? manifest.inputId : undefined;
}

function assertStateIdentity(value: unknown, runId: string, inputId: string | undefined): void {
  if (!isRecord(value)) return;
  if (value.runId !== undefined && value.runId !== runId) throw new Error('operator-state runId does not match selected run');
  if (inputId !== undefined && value.inputId !== undefined && value.inputId !== inputId) {
    throw new Error('operator-state inputId does not match run manifest');
  }
}

/** Incoming entries are patches; absent fields and unrelated decisions survive. */
function mergeRecords(existing: unknown, incoming: unknown, key: string): unknown {
  if (incoming === undefined) return existing ?? [];
  if (!Array.isArray(incoming)) return incoming;
  if (incoming.some((item) => !isRecord(item) || typeof item[key] !== 'string')) return incoming;
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of Array.isArray(existing) ? existing : []) {
    if (isRecord(item) && typeof item[key] === 'string') byId.set(item[key], item);
  }
  for (const item of incoming as Array<Record<string, unknown>>) {
    const id = item[key] as string;
    byId.set(id, { ...byId.get(id), ...item });
  }
  return [...byId.values()];
}

function atomicWrite(abs: string, content: string): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const temp = `${abs}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temp, 'wx');
    try {
      fs.writeFileSync(fd, content, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, abs);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}

export function handleHealth(): HandlerResult {
  return {
    status: 200,
    json: {
      ok: true,
      workbench: 'thin-v1',
      writeBoundary: OPERATOR_STATE_DIR,
      parseReuseDefault: true
    }
  };
}

export function handleListRuns(config: WorkbenchConfig): HandlerResult {
  if (!fs.existsSync(config.runsRoot)) {
    return { status: 200, json: { runs: [] } };
  }
  const runs = fs.readdirSync(config.runsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const manifestPath = path.join(config.runsRoot, d.name, 'run-manifest.json');
      let updatedAt: string | undefined;
      if (fs.existsSync(manifestPath)) {
        try {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { updatedAt?: string };
          updatedAt = m.updatedAt;
        } catch { /* ignore */ }
      }
      return { runId: d.name, ...(updatedAt !== undefined ? { updatedAt } : {}) };
    });
  return { status: 200, json: { runs } };
}

export function handleGetManifest(config: WorkbenchConfig, runId: string): HandlerResult {
  const dir = runDir(config, runId);
  const manifestPath = path.join(dir, 'run-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { status: 404, json: { error: 'run-manifest.json not found' } };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { status: 200, json: manifest };
}

export function handleGetEra(config: WorkbenchConfig, runId: string, sampleCount = 120): HandlerResult {
  const dir = runDir(config, runId);
  const basePath = path.join(dir, 'scene-grammar.json');
  const acceptedPath = path.join(dir, 'accepted-scene-grammar.json');
  if (!fs.existsSync(basePath)) {
    return { status: 404, json: { error: 'scene-grammar.json (base) not found' } };
  }
  if (!fs.existsSync(acceptedPath)) {
    return {
      status: 200,
      json: {
        available: false,
        reason: 'accepted-scene-grammar.json not present — no generative shift yet',
        svg: null,
        shift: null
      }
    };
  }
  const baseGrammar = SceneGrammarSchema.parse(JSON.parse(fs.readFileSync(basePath, 'utf8')));
  const acceptedGrammar = SceneGrammarSchema.parse(JSON.parse(fs.readFileSync(acceptedPath, 'utf8')));
  const view = computeEraShiftView({
    baseGrammar,
    acceptedGrammar,
    seed: 42,
    sampleCount
  });
  return {
    status: 200,
    json: {
      available: true,
      base: view.base,
      accepted: view.accepted,
      shift: view.shift,
      svg: view.svg,
      explanations: view.shift.explanations
    }
  };
}

export function handleParseReuse(body: {
  hasExistingParse?: boolean;
  forceRerun?: boolean;
  parseStale?: boolean;
}): HandlerResult {
  const decision = decideParseReuse({
    hasExistingParse: body.hasExistingParse === true,
    ...(body.forceRerun !== undefined ? { forceRerun: body.forceRerun } : {}),
    ...(body.parseStale !== undefined ? { parseStale: body.parseStale } : {})
  });
  return { status: 200, json: decision };
}

export function handleWriteOperatorState(args: {
  config: WorkbenchConfig;
  runId: string;
  kind: OperatorWritableKind;
  body: unknown;
  now: string;
}): HandlerResult {
  const dir = runDir(args.config, args.runId);
  if (!fs.existsSync(dir)) {
    return { status: 404, json: { error: `run folder not found: ${args.runId}` } };
  }

  let rel: string;
  let abs: string;
  try {
    rel = operatorStateRelativePath(args.kind);
    abs = resolveOperatorWritePath(dir, rel);
  } catch (err) {
    const message = err instanceof WriteBoundaryError ? err.message : String(err);
    return { status: 403, json: { error: message, writeBoundary: true } };
  }

  let payload: unknown;
  let content: string;
  try {
    const inputId = knownInputId(dir, args.runId);
    assertStateIdentity(args.body, args.runId, inputId);
    const body = isRecord(args.body) ? args.body : {};
    if (args.kind === 'source-intake-approval') {
      const existing = readJsonIfExists(abs);
      assertStateIdentity(existing, args.runId, inputId);
      const current = existing === undefined ? undefined : IntakeApprovalSchema.parse(existing);
      payload = IntakeApprovalSchema.parse({
        ...current,
        ...body,
        approvals: mergeRecords(current?.approvals, body.approvals, 'candidateId')
      });
    } else if (args.kind === 'operator-revision-decisions') {
      const existing = readJsonIfExists(abs);
      assertStateIdentity(existing, args.runId, inputId);
      const current = existing === undefined ? undefined : OperatorRevisionDecisionsSchema.parse(existing);
      payload = OperatorRevisionDecisionsSchema.parse({
        ...current,
        ...body,
        artifact: 'operator-revision-decisions',
        runId: args.runId,
        inputId: body.inputId ?? current?.inputId ?? inputId,
        updatedAt: args.now,
        decisions: mergeRecords(current?.decisions, body.decisions, 'revisionId')
      });
    } else if (args.kind === 'operator-notes') {
      const existing = readJsonIfExists(abs);
      assertStateIdentity(existing, args.runId, inputId);
      const current = existing === undefined ? undefined : OperatorNotesSchema.parse(existing);
      payload = OperatorNotesSchema.parse({
        ...current,
        ...body,
        artifact: 'operator-notes',
        runId: args.runId,
        updatedAt: args.now
      });
    } else if (args.kind === 'review-selection') {
      const tsv = typeof args.body === 'string' ? args.body : body.tsv;
      if (typeof tsv !== 'string') {
        return { status: 400, json: { error: 'review-selection requires { tsv: string }' } };
      }
      payload = { tsv };
    }
    content = args.kind === 'review-selection'
      ? ((payload as { tsv: string }).tsv.endsWith('\n') ? (payload as { tsv: string }).tsv : `${(payload as { tsv: string }).tsv}\n`)
      : `${JSON.stringify(payload, null, 2)}\n`;
  } catch (err) {
    return {
      status: 400,
      json: { error: err instanceof Error ? err.message : String(err), validation: true }
    };
  }

  try {
    atomicWrite(abs, content);
  } catch (err) {
    return { status: 500, json: { error: err instanceof Error ? err.message : String(err), writeFailed: true } };
  }
  return { status: 200, json: { ok: true, path: rel, kind: args.kind, data: payload } };
}

/** Attempt to write a forbidden generated path — always fails (for tests + defense). */
export function handleForbiddenWrite(args: {
  config: WorkbenchConfig;
  runId: string;
  relativePath: string;
  body: unknown;
}): HandlerResult {
  const dir = runDir(args.config, args.runId);
  try {
    resolveOperatorWritePath(dir, args.relativePath);
    // If somehow allowed, still refuse generic write API for non-kinds
    return { status: 403, json: { error: 'generic artifact write is disabled', writeBoundary: true } };
  } catch (err) {
    const message = err instanceof WriteBoundaryError ? err.message : String(err);
    return { status: 403, json: { error: message, writeBoundary: true } };
  }
}

export function handleReadOperatorState(args: {
  config: WorkbenchConfig;
  runId: string;
  kind: OperatorWritableKind;
}): HandlerResult {
  const dir = runDir(args.config, args.runId);
  const rel = operatorStateRelativePath(args.kind);
  const abs = resolveOperatorWritePath(dir, rel);
  if (!fs.existsSync(abs)) return { status: 404, json: { error: 'not found', path: rel } };
  if (args.kind === 'review-selection') {
    return {
      status: 200,
      text: fs.readFileSync(abs, 'utf8'),
      contentType: 'text/tab-separated-values; charset=utf-8'
    };
  }
  try {
    const data = readJsonIfExists(abs);
    assertStateIdentity(data, args.runId, knownInputId(dir, args.runId));
    const parsed = args.kind === 'source-intake-approval' ? IntakeApprovalSchema.parse(data)
      : args.kind === 'operator-revision-decisions' ? OperatorRevisionDecisionsSchema.parse(data)
        : OperatorNotesSchema.parse(data);
    return { status: 200, json: parsed };
  } catch (err) {
    return { status: 400, json: { error: err instanceof Error ? err.message : String(err), validation: true } };
  }
}

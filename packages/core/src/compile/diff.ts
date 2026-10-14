import { PsgCompileDiffSchema, PsgFileSchema, type PsgCompileDiff, type PsgFile } from '../schemas/psg';

export interface CompiledPsgRecord {
  path: string;
  contentSha256: string;
  document: PsgFile;
}

export type CompiledPsgGraph = CompiledPsgRecord;

export interface DiffCompiledPsgArgs {
  runId: string;
  inputId: string;
  createdAt: string;
  compilerVersion: string;
  sourceGrammars: PsgCompileDiff['sourceGrammars'];
  baseGraphs: Record<string, CompiledPsgRecord>;
  acceptedGraphs: Record<string, CompiledPsgRecord>;
}

/** Object insertion order is not content; meaningful array order is retained. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function equal(before: unknown, after: unknown): boolean {
  return JSON.stringify(canonical(before)) === JSON.stringify(canonical(after));
}

function graphHeader(graph: PsgFile): Record<string, unknown> {
  const { createdAt: _createdAt, metagrinder: _binding, ...nativeMetadata } = graph.metadata;
  return { version: graph.version, name: graph.name, description: graph.description, metadata: nativeMetadata };
}

function sortedRecords<T extends { id: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function wholeGraph(graph: PsgFile): unknown {
  return canonical({ ...graphHeader(graph), nodes: sortedRecords(graph.nodes),
    edges: sortedRecords(graph.edges), regions: sortedRecords(graph.regions) });
}

type Change = PsgCompileDiff['changes'][number];

function addChange(changes: Change[], graphKey: string, section: Change['section'],
  before: unknown, after: unknown, recordId?: string
): void {
  changes.push({ graphKey, section, ...(recordId !== undefined ? { recordId } : {}),
    changeType: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed',
    ...(before !== undefined ? { before: canonical(before) } : {}),
    ...(after !== undefined ? { after: canonical(after) } : {}) });
}

/** Schemas reject duplicate IDs and unresolved graph links before ID mapping. */
function compareRecords<T extends { id: string }>(changes: Change[], graphKey: string,
  section: 'node' | 'edge' | 'region', before: T[], after: T[]
): void {
  const beforeById = new Map(before.map((record) => [record.id, record]));
  const afterById = new Map(after.map((record) => [record.id, record]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
  for (const id of ids) {
    const left = beforeById.get(id);
    const right = afterById.get(id);
    if (!equal(left, right)) addChange(changes, graphKey, section, left, right, id);
  }
}

/**
 * Compares emitted native PSG content, not source-grammar intent or quality.
 * Paths/hashes are supplied artifact bindings; the consuming RunStore caller
 * verifies those bytes. This function never reads or writes files.
 */
export function diffCompiledPsgs(args: DiffCompiledPsgArgs): PsgCompileDiff {
  const baseKeys = Object.keys(args.baseGraphs).sort();
  const acceptedKeys = Object.keys(args.acceptedGraphs).sort();
  // Validate every graph before any collection is converted to an ID map.
  const base = new Map(baseKeys.map((key) => [key, PsgFileSchema.parse(args.baseGraphs[key]!.document)]));
  const accepted = new Map(acceptedKeys.map((key) => [key, PsgFileSchema.parse(args.acceptedGraphs[key]!.document)]));
  const changes: Change[] = [];
  for (const key of [...new Set([...baseKeys, ...acceptedKeys])].sort()) {
    const left = base.get(key);
    const right = accepted.get(key);
    if (left === undefined || right === undefined) {
      addChange(changes, key, 'graph', left === undefined ? undefined : wholeGraph(left),
        right === undefined ? undefined : wholeGraph(right));
      continue;
    }
    const beforeHeader = graphHeader(left);
    const afterHeader = graphHeader(right);
    if (!equal(beforeHeader, afterHeader)) addChange(changes, key, 'graph', beforeHeader, afterHeader);
    compareRecords(changes, key, 'node', left.nodes, right.nodes);
    compareRecords(changes, key, 'edge', left.edges, right.edges);
    compareRecords(changes, key, 'region', left.regions, right.regions);
  }
  const references = (keys: string[], graphs: Record<string, CompiledPsgRecord>) => keys.map((graphKey) => ({
    graphKey, path: graphs[graphKey]!.path, contentSha256: graphs[graphKey]!.contentSha256
  }));
  return PsgCompileDiffSchema.parse({ artifact: 'psg-compile-diff', runId: args.runId, inputId: args.inputId,
    createdAt: args.createdAt, compilerVersion: args.compilerVersion, comparisonScope: 'compiled-structure-only',
    sourceGrammars: args.sourceGrammars, baseGraphs: references(baseKeys, args.baseGraphs),
    acceptedGraphs: references(acceptedKeys, args.acceptedGraphs), changes, materialDifference: changes.length > 0,
    notes: [
      'This structural comparison covers emitted native PSG content only; it does not establish semantic entailment, factual accuracy, constraint safety, or approval.',
      'Source-grammar and graph references preserve supplied content hashes; validation of persisted bytes belongs to the RunStore caller.',
      'Compiler truncation and option caps can hide source-grammar revisions; no emitted structural difference does not mean no grammar change.'
    ] });
}

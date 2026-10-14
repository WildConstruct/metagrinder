import * as path from 'node:path';
import { runResumableStage, stageInputSignature } from '../artifacts/resume';
import type { RunStore } from '../artifacts/store';
import type { RunManifest, SceneGrammar } from '../schemas';
import { PsgArtifactSchema, type PsgArtifact, type PsgCompileDiff,
  type PsgCompilerBinding, type PsgSourceGrammarReference } from '../schemas/psg';
import { buildBranchSceneGrammarPsgs } from './scene-grammar-psg';
import { diffCompiledPsgs, type CompiledPsgGraph } from './diff';

export const PSG_COMPILER_VERSION = 'scene-grammar-psg-1';
const LIMITATIONS = [
  'Structural compilation only; not semantic approval or proof of generation constraint safety.',
  'The legacy compiler truncates text and caps choice options; content-plan sampling remains canonical.',
  'Current output files are listed by the compile stage; other retained PSG files are prior checkpoints.'
];
const BASE_FILE = 'scene-grammar.json';
const ACCEPTED_FILE = 'accepted-scene-grammar.json';
const DIFF_FILE = 'psg-compile-diff.json';

interface GrammarInput<Family extends PsgSourceGrammarReference['family'] = PsgSourceGrammarReference['family']> {
  grammar: SceneGrammar;
  reference: PsgSourceGrammarReference & { family: Family };
}
interface CompileSnapshot {
  runId: string;
  inputId: string;
  base: GrammarInput<'scene-grammar'>;
  accepted?: GrammarInput<'accepted-scene-grammar'>;
}
interface Output {
  graphKey: string;
  path: string;
  document: PsgArtifact;
  binding: PsgCompilerBinding;
}

function sourceReference<Family extends PsgSourceGrammarReference['family']>(manifest: RunManifest, family: Family,
  file: string): (PsgSourceGrammarReference & { family: Family }) | undefined {
  const records = manifest.artifacts.filter((entry) => entry.family === family && entry.path === file);
  if (records.length > 1) throw new Error(`ambiguous compile source: ${file}`);
  const record = records[0];
  return record === undefined ? undefined : { family, path: file, contentSha256: record.contentSha256 };
}

function currentSources(manifest: RunManifest) {
  return { runId: manifest.runId, inputId: manifest.inputId,
    base: sourceReference(manifest, 'scene-grammar', BASE_FILE),
    accepted: sourceReference(manifest, 'accepted-scene-grammar', ACCEPTED_FILE) };
}

function assertSourcesCurrent(store: RunStore, snapshot: CompileSnapshot): void {
  const expected = { runId: snapshot.runId, inputId: snapshot.inputId,
    base: snapshot.base.reference, accepted: snapshot.accepted?.reference };
  if (stageInputSignature(currentSources(store.getManifest())) !== stageInputSignature(expected)) {
    throw new Error('compile source snapshot changed during compilation');
  }
}

function captureSnapshot(store: RunStore): CompileSnapshot {
  const manifest = store.getManifest();
  const sources = currentSources(manifest);
  if (!sources.base) throw new Error(`compile requires recorded ${BASE_FILE}`);
  const read = <Family extends PsgSourceGrammarReference['family']>(reference: PsgSourceGrammarReference & { family: Family },
    target: 'base' | 'accepted'): GrammarInput<Family> => {
    const grammar = store.readArtifact<SceneGrammar>(reference.family, reference.path);
    if (grammar.runId !== manifest.runId || grammar.inputId !== manifest.inputId) {
      throw new Error(`compile source identity mismatch: ${reference.path}`);
    }
    if (grammar.grammarTarget !== target) throw new Error(`compile source target mismatch: ${reference.path}`);
    return { grammar, reference };
  };
  const snapshot: CompileSnapshot = { runId: manifest.runId, inputId: manifest.inputId,
    base: read(sources.base, 'base'),
    ...(sources.accepted ? { accepted: read(sources.accepted, 'accepted') } : {}) };
  assertSourcesCurrent(store, snapshot);
  return snapshot;
}

function expectedOutputs(snapshot: CompileSnapshot, input: GrammarInput, timestamp: string): Output[] {
  const binding: PsgCompilerBinding = { runId: snapshot.runId, inputId: snapshot.inputId,
    grammarTarget: input.grammar.grammarTarget, compilerVersion: PSG_COMPILER_VERSION,
    sourceGrammar: input.reference, reviewFlags: [...input.grammar.reviewFlags], limitations: [...LIMITATIONS] };
  return Object.entries(buildBranchSceneGrammarPsgs(input.grammar, () => timestamp))
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([graphKey, native]) => ({ graphKey, path: path.posix.join('psg', input.grammar.grammarTarget, graphKey), binding,
      document: PsgArtifactSchema.parse({ ...native, metadata: { ...native.metadata, metagrinder: binding } }) }));
}

function readGraphs(store: RunStore, outputs: Output[]): Record<string, CompiledPsgGraph> {
  const before = store.getManifest();
  const result = Object.fromEntries(outputs.map((output) => {
    const record = before.artifacts.find((entry) => entry.family === 'psg' && entry.path === output.path);
    if (!record) throw new Error(`missing compiled graph: ${output.path}`);
    const document = store.readArtifact<PsgArtifact>('psg', output.path);
    if (stageInputSignature(document.metadata.metagrinder) !== stageInputSignature(output.binding)) {
      throw new Error(`compiled PSG binding identity mismatch: ${output.path}`);
    }
    const content = (graph: PsgArtifact) => {
      const { createdAt: _createdAt, ...metadata } = graph.metadata;
      return { ...graph, metadata };
    };
    if (stageInputSignature(content(document)) !== stageInputSignature(content(output.document))) {
      throw new Error(`compiled PSG content mismatch: ${output.path}`);
    }
    return [output.graphKey, { path: output.path, contentSha256: record.contentSha256, document }];
  }));
  const after = store.getManifest();
  for (const output of outputs) {
    const old = before.artifacts.find((entry) => entry.family === 'psg' && entry.path === output.path);
    const current = after.artifacts.find((entry) => entry.family === 'psg' && entry.path === output.path);
    if (old?.contentSha256 !== current?.contentSha256) throw new Error('compiled PSG snapshot changed while reading outputs');
  }
  return result;
}

export interface CompileRunResult {
  comparisonStatus: 'base-only' | 'compared';
  outputPaths: string[];
  diff?: PsgCompileDiff;
}

/** Compile existing verified grammar artifacts. Never creates approvals or accepted grammar. */
export async function compileRunPsgs(args: {
  store: RunStore;
  now?: () => string;
  forceRerun?: boolean;
}): Promise<CompileRunResult> {
  const now = args.now ?? (() => new Date().toISOString());
  const snapshot = captureSnapshot(args.store);
  const timestamp = now();
  const baseOutputs = expectedOutputs(snapshot, snapshot.base, timestamp);
  const acceptedOutputs = snapshot.accepted ? expectedOutputs(snapshot, snapshot.accepted, timestamp) : [];
  const outputs = [...baseOutputs, ...acceptedOutputs];
  const outputPaths = [...outputs.map((output) => output.path), ...(snapshot.accepted ? [DIFF_FILE] : [])];
  const outputSnapshot = () => {
    const manifest = args.store.getManifest();
    return outputPaths.map((file) => {
      const family = file === DIFF_FILE ? 'psg-compile-diff' : 'psg';
      const record = manifest.artifacts.find((entry) => entry.family === family && entry.path === file);
      if (!record) throw new Error(`missing compiled output: ${file}`);
      return { family, path: file, contentSha256: record.contentSha256 };
    });
  };
  const load = (): CompileRunResult => {
    assertSourcesCurrent(args.store, snapshot);
    const beforeOutputs = stageInputSignature(outputSnapshot());
    const baseGraphs = readGraphs(args.store, baseOutputs);
    const acceptedGraphs = readGraphs(args.store, acceptedOutputs);
    let diff: PsgCompileDiff | undefined;
    if (snapshot.accepted) {
      diff = args.store.readArtifact<PsgCompileDiff>('psg-compile-diff', DIFF_FILE);
      const expected = diffCompiledPsgs({ runId: snapshot.runId, inputId: snapshot.inputId,
        createdAt: diff.createdAt, compilerVersion: PSG_COMPILER_VERSION,
        sourceGrammars: { base: snapshot.base.reference, accepted: snapshot.accepted.reference }, baseGraphs, acceptedGraphs });
      if (stageInputSignature(diff) !== stageInputSignature(expected)) {
        throw new Error('compiled PSG diff binding or content mismatch');
      }
    }
    assertSourcesCurrent(args.store, snapshot);
    if (beforeOutputs !== stageInputSignature(outputSnapshot())) {
      throw new Error('compiled output snapshot changed while reading graphs and diff');
    }
    return { comparisonStatus: snapshot.accepted ? 'compared' : 'base-only', outputPaths, ...(diff ? { diff } : {}) };
  };
  try {
    const result = await runResumableStage({ store: args.store, stage: 'compile', replaceOutputArtifacts: true,
      inputs: { compilerVersion: PSG_COMPILER_VERSION, runId: snapshot.runId, inputId: snapshot.inputId,
        base: snapshot.base.reference, accepted: snapshot.accepted?.reference },
      outputs: [...outputs.map((output) => ({ family: 'psg', path: output.path })),
        ...(snapshot.accepted ? [{ family: 'psg-compile-diff', path: DIFF_FILE }] : [])], now,
      ...(args.forceRerun !== undefined ? { forceRerun: args.forceRerun } : {}),
      load, operation: () => {
        assertSourcesCurrent(args.store, snapshot);
        for (const output of outputs) args.store.writeArtifact('psg', output.path, output.document, now);
        if (snapshot.accepted) {
          const diff = diffCompiledPsgs({ runId: snapshot.runId, inputId: snapshot.inputId, createdAt: timestamp,
            compilerVersion: PSG_COMPILER_VERSION, sourceGrammars: {
              base: snapshot.base.reference, accepted: snapshot.accepted.reference },
            baseGraphs: readGraphs(args.store, baseOutputs), acceptedGraphs: readGraphs(args.store, acceptedOutputs) });
          args.store.writeArtifact('psg-compile-diff', DIFF_FILE, diff, now);
        }
        return load();
      } });
    assertSourcesCurrent(args.store, snapshot);
    return result;
  } catch (error) {
    args.store.setStageState('compile', 'failed', { error: error instanceof Error ? error.message : String(error) }, now);
    throw error;
  }
}

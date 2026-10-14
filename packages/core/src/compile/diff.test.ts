import { sha256Hex } from '../artifacts/ids';
import type { PsgFile } from './psg';
import { historicalCrowdGrammar } from './__fixtures__/historical-crowd-grammar';
import { buildBranchSceneGrammarPsgs } from './scene-grammar-psg';
import { diffCompiledPsgs, type CompiledPsgRecord, type DiffCompiledPsgArgs } from './diff';

const NOW = '2026-10-14T12:00:00.000Z';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function graph(): PsgFile {
  return {
    version: '1.0.0', name: 'Scene', description: 'Native PSG structure',
    metadata: { type: 'ASSET_FRAGMENT', source: 'metagrinder', tags: ['test'], createdAt: NOW },
    nodes: [
      { id: 'context', type: 'TextBlock', x: 0, y: 0, name: 'Context', value: 'public square' },
      { id: 'choice', type: 'WeightedChoice', x: 0, y: 100, name: 'Choice',
        options: [{ text: 'person', weight: 1 }, { text: 'worker', weight: 2 }] },
      { id: 'output', type: 'Output', x: 200, y: 0, name: 'Output', template: '{prompt}' }
    ],
    edges: [{ id: 'context-choice', source: 'context', target: 'choice' },
      { id: 'choice-output', source: 'choice', target: 'output' }],
    regions: [{ id: 'main', name: 'Main', color: '#fff', nodes: ['context', 'choice', 'output'] },
      { id: 'aux', name: 'Auxiliary', color: '#000', nodes: ['choice'] }]
  };
}

function record(document: PsgFile, filePath: string): CompiledPsgRecord {
  return { path: filePath, contentSha256: sha256Hex(`${JSON.stringify(document, null, 2)}\n`), document };
}

function args(base: PsgFile = graph(), accepted: PsgFile = clone(base)): DiffCompiledPsgArgs {
  return {
    runId: 'run_diff', inputId: 'input_diff', createdAt: NOW, compilerVersion: 'compiler-1',
    sourceGrammars: {
      base: { family: 'scene-grammar', path: 'scene-grammar.json', contentSha256: 'a'.repeat(64) },
      accepted: { family: 'accepted-scene-grammar', path: 'accepted-scene-grammar.json', contentSha256: 'b'.repeat(64) }
    },
    baseGraphs: { scene: record(base, 'psg/base/scene.psg') },
    acceptedGraphs: { scene: record(accepted, 'psg/accepted/scene.psg') }
  };
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]));
  }
  return value;
}

describe('S2.2c compiled PSG structural diff', () => {
  test('binds source and graph hashes while explicitly limiting the claim to compiled structure', () => {
    const input = args();
    const report = diffCompiledPsgs(input);
    expect(report).toMatchObject({ artifact: 'psg-compile-diff', runId: input.runId, inputId: input.inputId,
      createdAt: NOW, compilerVersion: 'compiler-1', comparisonScope: 'compiled-structure-only',
      sourceGrammars: input.sourceGrammars, materialDifference: false, changes: [] });
    expect(report.baseGraphs).toEqual([{ graphKey: 'scene', path: input.baseGraphs.scene!.path,
      contentSha256: input.baseGraphs.scene!.contentSha256 }]);
    expect(report.acceptedGraphs).toEqual([{ graphKey: 'scene', path: input.acceptedGraphs.scene!.path,
      contentSha256: input.acceptedGraphs.scene!.contentSha256 }]);
    expect(report.notes.join(' ')).toMatch(/structur/i);
    expect(report.notes.join(' ')).toMatch(/not.*semantic|not.*entailment/i);
  });

  test('timestamps and Metagrinder target/source bindings alone are not structural changes', () => {
    const base = graph();
    const accepted = clone(base);
    base.metadata.metagrinder = { runId: 'run_diff', inputId: 'input_diff', grammarTarget: 'base',
      compilerVersion: 'compiler-1', sourceGrammar: args().sourceGrammars.base, reviewFlags: [], limitations: [] };
    accepted.metadata.createdAt = '2026-10-15T12:00:00.000Z';
    accepted.metadata.metagrinder = { runId: 'run_diff', inputId: 'input_diff', grammarTarget: 'accepted',
      compilerVersion: 'compiler-1', sourceGrammar: args().sourceGrammars.accepted,
      reviewFlags: ['review remains required'], limitations: ['not generation safety proof'] };
    expect(diffCompiledPsgs(args(base, accepted))).toMatchObject({ changes: [], materialDifference: false });
  });

  test('object property order and node/edge/region array order are nonmaterial', () => {
    const base = graph();
    const accepted = reverseObjectKeys(clone(base)) as PsgFile;
    accepted.nodes.reverse();
    accepted.edges.reverse();
    accepted.regions.reverse();
    expect(diffCompiledPsgs(args(base, accepted))).toMatchObject({ changes: [], materialDifference: false });
  });

  test('native graph name, description, and metadata changes are reported', () => {
    const base = graph();
    const accepted = clone(base);
    accepted.name = 'Renamed scene';
    accepted.description = 'Updated graph description';
    accepted.metadata.tags = ['updated'];
    const report = diffCompiledPsgs(args(base, accepted));
    expect(report.materialDifference).toBe(true);
    expect(report.changes).toEqual([expect.objectContaining({ graphKey: 'scene', section: 'graph', changeType: 'changed',
      before: expect.objectContaining({ name: 'Scene' }), after: expect.objectContaining({ name: 'Renamed scene' }) })]);
  });

  test('changed emitted text and weights are represented with the actual node payloads', () => {
    const base = graph();
    const accepted = clone(base);
    accepted.nodes[1]!.options![0] = { text: 'visitor', weight: 7 };
    const report = diffCompiledPsgs(args(base, accepted));
    expect(report.changes).toEqual([expect.objectContaining({ graphKey: 'scene', section: 'node', recordId: 'choice',
      changeType: 'changed', before: base.nodes[1], after: accepted.nodes[1] })]);
    expect(report.materialDifference).toBe(true);
  });

  test.each(['options', 'region-members'] as const)('meaningful %s ordering is retained', (seam) => {
    const base = graph();
    const accepted = clone(base);
    if (seam === 'options') accepted.nodes[1]!.options!.reverse();
    else accepted.regions[0]!.nodes.reverse();
    const report = diffCompiledPsgs(args(base, accepted));
    expect(report.changes).toEqual([expect.objectContaining({ graphKey: 'scene',
      section: seam === 'options' ? 'node' : 'region', recordId: seam === 'options' ? 'choice' : 'main', changeType: 'changed' })]);
  });

  test('graph additions and removals use the sorted union of logical graph keys', () => {
    const input = args();
    input.baseGraphs = { z_removed: record(graph(), 'psg/base/z.psg'), scene: input.baseGraphs.scene! };
    input.acceptedGraphs = { scene: input.acceptedGraphs.scene!, a_added: record(graph(), 'psg/accepted/a.psg') };
    const report = diffCompiledPsgs(input);
    expect(report.changes).toEqual([
      expect.objectContaining({ graphKey: 'a_added', section: 'graph', changeType: 'added', after: expect.any(Object) }),
      expect.objectContaining({ graphKey: 'z_removed', section: 'graph', changeType: 'removed', before: expect.any(Object) })
    ]);
    expect(report.baseGraphs.map((item) => item.graphKey)).toEqual(['scene', 'z_removed']);
    expect(report.acceptedGraphs.map((item) => item.graphKey)).toEqual(['a_added', 'scene']);
  });

  test.each(['node', 'edge', 'region'] as const)('%s additions and removals are not lost by ID matching', (section) => {
    const base = graph();
    const accepted = clone(base);
    if (section === 'node') {
      base.nodes.push({ id: 'removed', type: 'TextBlock', x: 0, y: 0, name: 'Removed', value: 'old' });
      accepted.nodes.push({ id: 'added', type: 'TextBlock', x: 0, y: 0, name: 'Added', value: 'new' });
    } else if (section === 'edge') {
      base.edges.push({ id: 'removed', source: 'context', target: 'output' });
      accepted.edges.push({ id: 'added', source: 'context', target: 'output' });
    } else {
      base.regions.push({ id: 'removed', name: 'Removed', color: '#000', nodes: ['context'] });
      accepted.regions.push({ id: 'added', name: 'Added', color: '#fff', nodes: ['context'] });
    }
    expect(diffCompiledPsgs(args(base, accepted)).changes).toEqual([
      expect.objectContaining({ section, recordId: 'added', changeType: 'added' }),
      expect.objectContaining({ section, recordId: 'removed', changeType: 'removed' })
    ]);
  });

  test('changed edge and region payloads are compared, not just node options', () => {
    const base = graph();
    const accepted = clone(base);
    accepted.edges[0]!.sourceHandle = 'alternate';
    accepted.regions[0]!.description = 'Changed region';
    expect(diffCompiledPsgs(args(base, accepted)).changes).toEqual([
      expect.objectContaining({ section: 'edge', recordId: 'context-choice', changeType: 'changed' }),
      expect.objectContaining({ section: 'region', recordId: 'main', changeType: 'changed' })
    ]);
  });

  test.each(['nodes', 'edges', 'regions'] as const)('duplicate %s IDs reject before mapping', (collection) => {
    const base = graph();
    (base[collection] as unknown[]).push(clone(base[collection][0]));
    expect(() => diffCompiledPsgs(args(base))).toThrow(/duplicate/);
  });

  test.each(['edge', 'region'] as const)('dangling %s references reject before mapping', (section) => {
    const base = graph();
    if (section === 'edge') base.edges[0]!.source = 'missing-node';
    else base.regions[0]!.nodes.push('missing-node');
    expect(() => diffCompiledPsgs(args(base))).toThrow(/does not resolve|region membership/);
  });

  test('six-option cap reports no emitted difference when only omitted archetypes change', () => {
    const baseGrammar = historicalCrowdGrammar(NOW);
    baseGrammar.locationZones = [];
    baseGrammar.environmentalModifiers = [];
    baseGrammar.negativeConstraints = [];
    baseGrammar.visualReferences = [];
    const acceptedGrammar = clone(baseGrammar);
    acceptedGrammar.grammarTarget = 'accepted';
    for (const archetype of acceptedGrammar.archetypes.slice(6)) {
      archetype.label = 'Changed omitted archetype';
      archetype.promptText = 'Changed omitted prompt text';
      archetype.weightRange = { label: 'Changed omitted weight', min: 1, max: 2, unit: 'percent', confidence: 'medium' };
    }
    const input = args();
    const records = (documents: Record<string, PsgFile>, target: string): Record<string, CompiledPsgRecord> =>
      Object.fromEntries(Object.entries(documents).map(([key, document]) => [key, record(document, `psg/${target}/${key}`)]));
    input.baseGraphs = records(buildBranchSceneGrammarPsgs(baseGrammar, () => NOW), 'base');
    input.acceptedGraphs = records(buildBranchSceneGrammarPsgs(acceptedGrammar, () => NOW), 'accepted');
    expect(diffCompiledPsgs(input)).toMatchObject({ changes: [], materialDifference: false });
  });

  test('does not mutate either native graph input', () => {
    const input = args();
    const before = JSON.stringify(input);
    diffCompiledPsgs(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

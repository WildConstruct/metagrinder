import type { PsgFile } from '../compile/psg';
import { PsgFileSchema } from '../compile/psg';
import { PsgArtifactSchema, PsgCompileDiffSchema, PsgFileSchema as CanonicalPsgFileSchema } from './psg';
import { schemaFor } from './registry';

const NOW = '2026-10-14T12:00:00.000Z';
const HASH = 'a'.repeat(64);

function graph(): PsgFile {
  return {
    version: '1.0.0', name: 'Compiler contract', description: 'Deterministic graph.',
    metadata: { type: 'ASSET_FRAGMENT', source: 'metagrinder', tags: ['metagrinder'], createdAt: NOW, nativeExtra: { preserved: true } },
    nodes: [
      { id: 'text', type: 'TextBlock', x: 0, y: 0, name: 'Context', value: 'A red coat.' },
      { id: 'choice', type: 'WeightedChoice', x: 1, y: 0, name: 'Choice', options: [{ text: 'wool', weight: 1 }] },
      { id: 'output', type: 'Output', x: 2, y: 0, name: 'Output', template: '{prompt}' }
    ],
    edges: [{ id: 'edge-text-choice', source: 'text', target: 'choice' }, { id: 'edge-choice-output', source: 'choice', target: 'output' }],
    regions: [{ id: 'region', name: 'Graph', color: '#fff', nodes: ['text', 'choice', 'output'] }]
  };
}

function boundGraph() {
  const native = graph();
  return {
    ...native,
    metadata: {
      ...native.metadata,
      metagrinder: {
        runId: 'run', inputId: 'input', grammarTarget: 'base', compilerVersion: 'psg-1',
        sourceGrammar: { family: 'scene-grammar', path: 'scene-grammar.json', contentSha256: HASH },
        reviewFlags: [], limitations: ['Compiled structure does not establish semantic quality.']
      }
    }
  };
}

function diff() {
  return {
    artifact: 'psg-compile-diff', runId: 'run', inputId: 'input', createdAt: NOW,
    compilerVersion: 'psg-1', comparisonScope: 'compiled-structure-only',
    sourceGrammars: {
      base: { family: 'scene-grammar', path: 'scene-grammar.json', contentSha256: HASH },
      accepted: { family: 'accepted-scene-grammar', path: 'accepted-scene-grammar.json', contentSha256: HASH }
    },
    baseGraphs: [{ graphKey: 'global', path: 'base.psg', contentSha256: HASH }],
    acceptedGraphs: [{ graphKey: 'global', path: 'accepted.psg', contentSha256: HASH }],
    changes: [], materialDifference: false, notes: []
  };
}

describe('canonical native PSG contracts [S2.2c]', () => {
  test('compiler compatibility exports and stored families share the canonical schema authority', () => {
    expect(PsgFileSchema).toBe(CanonicalPsgFileSchema);
    expect(schemaFor('psg')).toBe(PsgArtifactSchema);
    expect(schemaFor('psg-compile-diff')).toBe(PsgCompileDiffSchema);
  });

  test('base native document remains flat and preserves native metadata extensions', () => {
    const parsed = PsgFileSchema.parse(graph());
    expect(Object.keys(parsed)).toEqual(['version', 'name', 'description', 'metadata', 'nodes', 'edges', 'regions']);
    expect(parsed.metadata.nativeExtra).toEqual({ preserved: true });
    expect(parsed).not.toHaveProperty('artifact');
  });

  test.each([
    ['empty node ID', (g: PsgFile) => { g.nodes[0]!.id = ''; }],
    ['blank edge ID', (g: PsgFile) => { g.edges[0]!.id = ' '; }],
    ['duplicate node ID', (g: PsgFile) => { g.nodes[1]!.id = g.nodes[0]!.id; }],
    ['duplicate edge ID', (g: PsgFile) => { g.edges[1]!.id = g.edges[0]!.id; }],
    ['duplicate region ID', (g: PsgFile) => { g.regions.push({ ...g.regions[0]! }); }],
    ['dangling edge source', (g: PsgFile) => { g.edges[0]!.source = 'missing'; }],
    ['dangling edge target', (g: PsgFile) => { g.edges[0]!.target = 'missing'; }],
    ['dangling region membership', (g: PsgFile) => { g.regions[0]!.nodes.push('missing'); }],
    ['duplicate region membership', (g: PsgFile) => { g.regions[0]!.nodes.push('text'); }],
    ['negative option weight', (g: PsgFile) => { g.nodes[1]!.options![0]!.weight = -1; }],
    ['infinite option weight', (g: PsgFile) => { g.nodes[1]!.options![0]!.weight = Infinity; }],
    ['missing text payload', (g: PsgFile) => { delete g.nodes[0]!.value; }],
    ['missing choice payload', (g: PsgFile) => { delete g.nodes[1]!.options; }],
    ['empty choice payload', (g: PsgFile) => { g.nodes[1]!.options = []; }],
    ['missing output payload', (g: PsgFile) => { delete g.nodes[2]!.template; }],
    ['wrong node payload', (g: PsgFile) => { g.nodes[0]!.options = [{ text: 'unexpected', weight: 1 }]; }]
  ])('rejects %s before storage', (_label, mutate) => {
    const native = graph();
    (mutate as (g: PsgFile) => void)(native);
    expect(() => PsgFileSchema.parse(native)).toThrow();
  });

  test('stored PSG family requires binding without adding an envelope root', () => {
    const schema = schemaFor('psg');
    expect(schema).toBeDefined();
    const parsed = schema!.parse(boundGraph());
    expect(parsed.metadata.metagrinder.sourceGrammar.contentSha256).toBe(HASH);
    expect(parsed).not.toHaveProperty('artifact');
    expect(() => schema!.parse(graph())).toThrow();
  });

  test('stored target and source family must agree and hashes are strict', () => {
    const schema = schemaFor('psg');
    expect(schema).toBeDefined();
    const native = boundGraph();
    native.metadata.metagrinder.grammarTarget = 'accepted';
    expect(() => schema!.parse(native)).toThrow();
    native.metadata.metagrinder.sourceGrammar.family = 'accepted-scene-grammar';
    expect(() => schema!.parse(native)).not.toThrow();
    native.metadata.metagrinder.sourceGrammar.contentSha256 = 'not-a-hash';
    expect(() => schema!.parse(native)).toThrow();
  });

  test('stored native discriminator is strict without narrowing the base interchange schema', () => {
    const native = boundGraph();
    native.metadata.type = 'DIFFERENT_ASSET';
    expect(() => PsgFileSchema.parse(native)).not.toThrow();
    expect(() => schemaFor('psg')!.parse(native)).toThrow();
    native.metadata.type = 'ASSET_FRAGMENT';
    native.metadata.source = 'different-producer';
    expect(() => schemaFor('psg')!.parse(native)).toThrow();
  });

  test('compile diff requires exact source family bindings and consistent material flag', () => {
    const schema = schemaFor('psg-compile-diff');
    expect(schema).toBeDefined();
    expect(() => schema!.parse(diff())).not.toThrow();
    const inconsistent = { ...diff(), materialDifference: true };
    expect(() => schema!.parse(inconsistent)).toThrow();
    const changed = {
      ...diff(), changes: [{ graphKey: 'global', section: 'node', recordId: 'text', changeType: 'changed', before: { value: 'red' }, after: { value: 'blue' } }],
      materialDifference: true
    };
    expect(() => schema!.parse(changed)).not.toThrow();
    changed.sourceGrammars.base.family = 'accepted-scene-grammar';
    expect(() => schema!.parse(changed)).toThrow();
  });
});

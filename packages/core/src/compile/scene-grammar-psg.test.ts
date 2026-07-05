import * as fs from 'node:fs';
import * as path from 'node:path';
import { PsgFileSchema } from './psg';
import { buildBranchSceneGrammarPsgs, buildSceneGrammarPsg } from './scene-grammar-psg';
import { historicalCrowdGrammar } from './__fixtures__/historical-crowd-grammar';

const FIXED_NOW = () => '2026-05-02T12:00:00.000Z';
const GOLDEN = path.resolve(__dirname, '__golden__/scene-grammar.psg.json');
const BRANCH_GOLDEN = path.resolve(__dirname, '__golden__/branch-graphs.json');

describe('base scene-grammar PSG compiler (S2.2)', () => {
  test('[AC-2.2a] byte-identical to legacy golden for historical-crowd (base target)', () => {
    const psg = buildSceneGrammarPsg(historicalCrowdGrammar(), FIXED_NOW);
    const serialized = `${JSON.stringify(psg, null, 2)}\n`;
    const golden = fs.readFileSync(GOLDEN, 'utf8').replace(/\r\n/g, '\n');
    expect(serialized).toBe(golden);
  });

  test('[AC-2.2b] golden output has the expected linear shape', () => {
    const psg = buildSceneGrammarPsg(historicalCrowdGrammar(), FIXED_NOW);
    expect(() => PsgFileSchema.parse(psg)).not.toThrow();
    expect(psg.nodes.map((n) => n.id)).toEqual([
      'scene-context', 'archetype-choice', 'location-choice', 'environment-choice', 'prompt-output'
    ]);
    expect(psg.nodes.map((n) => n.type)).toEqual([
      'TextBlock', 'WeightedChoice', 'WeightedChoice', 'WeightedChoice', 'Output'
    ]);
    // 8 archetypes capped to 6 options; midpoint weights
    const archetype = psg.nodes.find((n) => n.id === 'archetype-choice')!;
    expect(archetype.options).toHaveLength(6);
    expect(archetype.options!.map((o) => o.weight)).toEqual([55, 25, 12.5, 7.5, 6.5, 4]);
    // linear edges chain every node
    expect(psg.edges).toHaveLength(4);
    expect(psg.edges[0]!.id).toBe('edge-scene-context-archetype-choice');
  });

  test('output is deterministic across runs with a fixed clock', () => {
    const a = buildSceneGrammarPsg(historicalCrowdGrammar(), FIXED_NOW);
    const b = buildSceneGrammarPsg(historicalCrowdGrammar(), FIXED_NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('branch scene-grammar PSG compiler (S2.2)', () => {
  const branches = () => buildBranchSceneGrammarPsgs(historicalCrowdGrammar(), FIXED_NOW);
  const golden = (): Record<string, unknown> => JSON.parse(fs.readFileSync(BRANCH_GOLDEN, 'utf8'));

  test('[AC-2.2b] emits the seven branch graphs with stable keys', () => {
    expect(Object.keys(branches()).sort()).toEqual([
      'scene-global-baseline.psg',
      'scene-grandstand-branch.psg',
      'scene-infield-branch.psg',
      'scene-negative-constraints.psg',
      'scene-pit-branch.psg',
      'scene-rail-branch.psg',
      'scene-specimen-reference-router.psg'
    ]);
  });

  // 6 of 7 byte-match legacy; the specimen router consumed legacy extractor noise,
  // so the fixture carries clean authored references and it is checked structurally.
  test.each([
    'scene-global-baseline.psg',
    'scene-grandstand-branch.psg',
    'scene-rail-branch.psg',
    'scene-pit-branch.psg',
    'scene-infield-branch.psg',
    'scene-negative-constraints.psg'
  ])('[AC-2.2b] %s is byte-identical to legacy', (key) => {
    const got = branches()[key]!;
    expect(JSON.stringify(got, null, 2)).toBe(JSON.stringify(golden()[key], null, 2));
  });

  test('pit branch keeps only worker/official/pit archetypes (weight filter)', () => {
    const pit = branches()['scene-pit-branch.psg']!;
    expect(pit.nodes[1]!.options).toHaveLength(1);
  });

  test('specimen router compiles structurally from clean references', () => {
    const router = branches()['scene-specimen-reference-router.psg']!;
    expect(() => PsgFileSchema.parse(router)).not.toThrow();
    expect(router.nodes[1]!.options).toHaveLength(2);
    expect(router.metadata.tags).toContain('specimen-reference-router');
  });
});

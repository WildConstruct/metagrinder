import * as fs from 'node:fs';
import * as path from 'node:path';
import { PsgFileSchema } from './psg';
import { buildSceneGrammarPsg } from './scene-grammar-psg';
import { historicalCrowdGrammar } from './__fixtures__/historical-crowd-grammar';

const FIXED_NOW = () => '2026-05-02T12:00:00.000Z';
const GOLDEN = path.resolve(__dirname, '__golden__/scene-grammar.psg.json');

describe('base scene-grammar PSG compiler (S2.2)', () => {
  test('[AC-2.2a] byte-identical to legacy golden for historical-crowd (base target)', () => {
    const psg = buildSceneGrammarPsg(historicalCrowdGrammar(), FIXED_NOW);
    const serialized = `${JSON.stringify(psg, null, 2)}\n`;
    const golden = fs.readFileSync(GOLDEN, 'utf8');
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

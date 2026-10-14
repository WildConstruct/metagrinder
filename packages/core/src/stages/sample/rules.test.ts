import { SceneGrammarSchema, type SceneGrammar } from '../../schemas';
import { historicalCrowdGrammar } from '../../compile/__fixtures__/historical-crowd-grammar';
import { sampleContentPlans } from './index';
import { appliedRuleIds, violatedRuleIds, type Selection } from './rules';

const NOW = '2026-10-13T12:00:00.000Z';

function grammar(): SceneGrammar {
  const base = historicalCrowdGrammar(NOW);
  return SceneGrammarSchema.parse({ ...base,
    archetypes: [{ ...base.archetypes[0]!, archetypeId: 'actor', label: 'Artisan', role: 'artisan',
      promptText: 'adult artisan in a plain linen coat' }],
    locationZones: [{ ...base.locationZones[0]!, zoneId: 'workshop', label: 'Workshop', promptText: 'inside a stone workshop' }],
    environmentalModifiers: [{ modifierId: 'mist', label: 'Mist', promptText: 'thin mist near a stone bench', provenance: base.archetypes[0]!.provenance }],
    compatibilityRules: [], negativeConstraints: []
  });
}

const selection: Selection = { archetypeId: 'actor', zoneId: 'workshop', role: 'artisan', modifiers: [] };

function requireMist(g: SceneGrammar, action: 'requires' | 'force'): SceneGrammar {
  return SceneGrammarSchema.parse({ ...g, compatibilityRules: [{
    ruleId: 'require_mist', label: 'Require a supported modifier',
    condition: { field: 'archetype', operator: 'equals', value: 'actor' },
    effects: [{ action, target: 'mist' }], confidence: 'medium', provenance: g.archetypes[0]!.provenance
  }] });
}

describe('S-R3 hard generation rules', () => {
  test.each(['requires', 'force'] as const)('%s effects reject a missing target and accept its presence', (action) => {
    const g = requireMist(grammar(), action);
    expect(violatedRuleIds(g, selection)).toEqual(['require_mist']);
    expect(violatedRuleIds(g, { ...selection, modifiers: ['mist'] })).toEqual([]);
  });

  test.each(['requires', 'force'] as const)('public sampling never emits a plan without a %s target', (action) => {
    const g = requireMist(grammar(), action);
    for (let seed = 0; seed < 12; seed++) {
      const sampled = sampleContentPlans({ grammar: g, seed, count: 8, now: NOW });
      expect(sampled.plans.length).toBeGreaterThan(0);
      for (const plan of sampled.plans) {
        expect(plan.slots.some((slot) => slot.grammarRefs.includes('environmentalModifiers.mist'))).toBe(true);
        expect(plan.rulesApplied).toContain('require_mist');
      }
    }
  });

  test('unsupported soft effects reject the grammar even when their condition is inactive', () => {
    const g = requireMist(grammar(), 'requires');
    g.compatibilityRules[0]!.condition.value = 'a different archetype';
    g.compatibilityRules[0]!.effects[0]!.action = 'increase';
    expect(() => violatedRuleIds(g, selection)).toThrow(/unsupported.*increase/i);
    expect(() => sampleContentPlans({ grammar: g, seed: 1, count: 0, now: NOW })).toThrow(/unsupported.*increase/i);
  });

  test('unknown condition fields are rejected instead of silently ignored', () => {
    const g = requireMist(grammar(), 'requires');
    g.compatibilityRules[0]!.condition.field = 'unmodeled_attribute';
    expect(() => sampleContentPlans({ grammar: g, seed: 1, count: 1, now: NOW })).toThrow(/unsupported.*unmodeled_attribute/i);
  });

  test('includes conditions inspect their named field rather than any selected modifier', () => {
    const g = requireMist(grammar(), 'requires');
    g.compatibilityRules[0]!.condition = { field: 'zone', operator: 'includes', value: 'mist' };
    g.compatibilityRules[0]!.effects = [{ action: 'exclude', target: 'mist' }];
    expect(violatedRuleIds(g, { ...selection, modifiers: ['mist'] })).toEqual([]);
  });

  test('applied rule IDs reflect active conditions only', () => {
    const g = requireMist(grammar(), 'requires');
    g.compatibilityRules.push({ ...g.compatibilityRules[0]!, ruleId: 'inactive',
      condition: { field: 'zone', operator: 'equals', value: 'another-zone' } });
    expect(appliedRuleIds(g, { ...selection, modifiers: ['mist'] })).toEqual(['require_mist']);
  });

  test('structured negative exclusions prevent literal forbidden content in emitted plans', () => {
    const g = grammar();
    g.negativeConstraints = [{ constraintId: 'exclude_coat', label: 'Exclude a supplied phrase',
      text: 'Avoid a plain linen coat.', constraintType: 'negative', appliesTo: ['actor'],
      enforcement: { avoid: ['linen coat'], exclude: [], allow: [], force: [] }, enforcedByRuleIds: [],
      confidence: 'medium', provenance: g.archetypes[0]!.provenance }];
    expect(violatedRuleIds(g, selection)).toEqual(['exclude_coat']);
    expect(sampleContentPlans({ grammar: g, seed: 1, count: 4, now: NOW }).plans).toHaveLength(0);
  });

  test('negative force targets remain required positive content', () => {
    const g = grammar();
    g.negativeConstraints = [{ constraintId: 'require_bench', label: 'Require a supplied phrase',
      text: 'A stone bench must remain present.', constraintType: 'compatibility', appliesTo: [],
      enforcement: { avoid: [], exclude: [], allow: [], force: ['stone bench'] }, enforcedByRuleIds: [],
      confidence: 'medium', provenance: g.archetypes[0]!.provenance }];
    expect(violatedRuleIds(g, selection)).toEqual(['require_bench']);
    expect(violatedRuleIds(g, { ...selection, modifiers: ['mist'] })).toEqual([]);
  });

  test('public sampling carries negative text, explicit exclusions, and their provenance', () => {
    const g = grammar();
    g.negativeConstraints = [{ constraintId: 'exclude_emblems', label: 'No emblems',
      text: 'Avoid commercial emblems.', constraintType: 'negative', appliesTo: ['actor'],
      enforcement: { avoid: ['commercial emblems'], exclude: [], allow: [], force: [] }, enforcedByRuleIds: [],
      confidence: 'medium', provenance: g.archetypes[0]!.provenance }];
    const plan = sampleContentPlans({ grammar: g, seed: 1, count: 1, now: NOW }).plans[0]!;
    expect(plan.negativeSlots.some((slot) => slot.value === 'Avoid commercial emblems.')).toBe(true);
    expect(plan.negativeSlots.some((slot) => slot.slotKind === 'negative' && slot.value === 'commercial emblems')).toBe(true);
    for (const slot of plan.negativeSlots) {
      expect(slot.grammarRefs).toEqual(['negativeConstraints.exclude_emblems']);
      expect(slot.evidenceRefs).toEqual(g.negativeConstraints[0]!.provenance.sourceChunkIds);
    }
  });
});

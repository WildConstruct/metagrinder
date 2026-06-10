import { SceneGrammarSchema, type SceneGrammar } from '../../schemas';
import { historicalCrowdGrammar } from '../../compile/__fixtures__/historical-crowd-grammar';
import { sampleContentPlans, violatedRuleIds } from './index';
import type { Selection } from './rules';

const NOW = '2026-06-10T12:00:00.000Z';

/** Adds a hard rule: a female spectator is incompatible with the rail zone. */
function withRailRule(base: SceneGrammar): SceneGrammar {
  const next = JSON.parse(JSON.stringify(base)) as SceneGrammar;
  next.compatibilityRules = [{
    ruleId: 'rail_excludes_female',
    label: 'No lone women at the rail without support',
    condition: { field: 'zone', operator: 'equals', value: 'rail' },
    effects: [{ action: 'incompatible-with', target: 'female_middle_class_spectator' }],
    confidence: 'medium',
    provenance: {
      sourceInputIds: [], sourceChunkIds: [], spans: [],
      attributionMode: 'inferred', evidenceBasis: 'inferred', confidence: 'medium', verification: 'unverified'
    }
  }];
  return SceneGrammarSchema.parse(next);
}

/** Reconstruct a Selection from an emitted plan's grammarRefs. */
function selectionFromPlan(plan: { slots: Array<{ slotKind: string; grammarRefs: string[] }> }): Selection {
  const ref = (kind: string) => plan.slots.find((s) => s.slotKind === kind)?.grammarRefs[0]?.split('.')[1];
  const modifiers = plan.slots
    .filter((s) => s.slotKind === 'modifier')
    .map((s) => s.grammarRefs[0]!.split('.')[1]!);
  const archetypeId = ref('subject')!;
  const zoneId = ref('zone');
  return { archetypeId, ...(zoneId ? { zoneId } : {}), modifiers };
}

describe('content-plan sampling (S2.4)', () => {
  const grammar = historicalCrowdGrammar();

  test('[AC-2.4a] same grammar + seed + count yields identical plans', () => {
    const a = sampleContentPlans({ grammar, seed: 1234, count: 10, now: NOW });
    const b = sampleContentPlans({ grammar, seed: 1234, count: 10, now: NOW });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.plans).toHaveLength(10);
  });

  test('different seeds produce different plan sets', () => {
    const a = sampleContentPlans({ grammar, seed: 1, count: 10, now: NOW });
    const b = sampleContentPlans({ grammar, seed: 2, count: 10, now: NOW });
    expect(JSON.stringify(a.plans)).not.toBe(JSON.stringify(b.plans));
  });

  test('plans carry a subject slot with provenance refs and inherit grammar target', () => {
    const out = sampleContentPlans({ grammar, seed: 7, count: 3, now: NOW });
    for (const plan of out.plans) {
      const subject = plan.slots.find((s) => s.slotKind === 'subject')!;
      expect(subject.value.length).toBeGreaterThan(0);
      expect(subject.grammarRefs[0]).toMatch(/^archetypes\./);
      expect(plan.grammarTarget).toBe('base');
    }
  });

  test('[AC-2.4b] property: no emitted plan violates a hard compatibility rule', () => {
    const g = withRailRule(grammar);
    let railFemalePairs = 0;
    for (let seed = 0; seed < 40; seed++) {
      const out = sampleContentPlans({ grammar: g, seed, count: 20, now: NOW });
      for (const plan of out.plans) {
        const sel = selectionFromPlan(plan);
        expect(violatedRuleIds(g, sel)).toEqual([]);
        if (sel.zoneId === 'rail' && sel.archetypeId === 'female_middle_class_spectator') railFemalePairs++;
      }
    }
    expect(railFemalePairs).toBe(0);
    // sanity: the rule id is recorded as applied
    expect(sampleContentPlans({ grammar: g, seed: 1, count: 1, now: NOW }).plans[0]!.rulesApplied)
      .toContain('rail_excludes_female');
  });

  test('emits nothing rather than a violating plan when a rule is unsatisfiable', () => {
    // a rule that excludes every archetype from the only allowed selection is unsatisfiable
    const next = JSON.parse(JSON.stringify(grammar)) as SceneGrammar;
    next.locationZones = next.locationZones.filter((z) => z.zoneId === 'rail');
    next.archetypes = next.archetypes.filter((a) => a.archetypeId === 'female_middle_class_spectator');
    next.compatibilityRules = [{
      ruleId: 'block_all', label: 'block', condition: { field: 'zone', operator: 'equals', value: 'rail' },
      effects: [{ action: 'incompatible-with', target: 'female_middle_class_spectator' }],
      confidence: 'low',
      provenance: { sourceInputIds: [], sourceChunkIds: [], spans: [], attributionMode: 'inferred', evidenceBasis: 'inferred', confidence: 'low', verification: 'unverified' }
    }];
    const g = SceneGrammarSchema.parse(next);
    const out = sampleContentPlans({ grammar: g, seed: 5, count: 5, now: NOW });
    expect(out.plans).toHaveLength(0);
  });
});

import {
  ContentPlansSchema,
  type ContentPlan,
  type ContentPlans,
  type PlanSlot,
  type SceneArchetype,
  type SceneGrammar
} from '../../schemas';
import { choiceWeightFromRange } from '../../compile/psg';
import { mulberry32, weightedPick } from './rng';
import { type Selection, applicableNegativeConstraints, appliedRuleIds,
  assertSupportedGenerationRules, violatedRuleIds } from './rules';

/**
 * Content-plan sampling (S2.4). Seed-deterministic: a (grammar, seed, count)
 * triple yields identical plans (AC-2.4a). Hard compatibility rules are
 * enforced at sampling time by resample — an emitted plan never violates one
 * (AC-2.4b). Plans are canonical and structured; prose realization is S3.4.
 */

const MAX_RESAMPLE_ATTEMPTS = 24;

function selectionOf(archetype: SceneArchetype, zoneId: string | undefined, modifiers: string[]): Selection {
  return {
    archetypeId: archetype.archetypeId,
    ...(zoneId !== undefined ? { zoneId } : {}),
    ...(archetype.role !== undefined ? { role: archetype.role } : {}),
    ...(archetype.classBand !== undefined ? { classBand: archetype.classBand } : {}),
    ...(archetype.genderPresentation !== undefined ? { genderPresentation: archetype.genderPresentation } : {}),
    modifiers
  };
}

function slotsFor(planId: string, archetype: SceneArchetype, grammar: SceneGrammar, sel: Selection): PlanSlot[] {
  const slots: PlanSlot[] = [{
    slotId: `${planId}_subject`,
    slotKind: 'subject',
    value: archetype.promptText,
    weight: choiceWeightFromRange(archetype.weightRange),
    grammarRefs: [`archetypes.${archetype.archetypeId}`],
    utdgRefs: [],
    evidenceRefs: archetype.provenance.sourceChunkIds
  }];
  if (sel.zoneId) {
    const zone = grammar.locationZones.find((z) => z.zoneId === sel.zoneId)!;
    slots.push({
      slotId: `${planId}_zone`,
      slotKind: 'zone',
      value: zone.promptText,
      grammarRefs: [`locationZones.${zone.zoneId}`],
      utdgRefs: [],
      evidenceRefs: zone.provenance.sourceChunkIds
    });
  }
  for (const modId of sel.modifiers) {
    const mod = grammar.environmentalModifiers.find((m) => m.modifierId === modId)!;
    slots.push({
      slotId: `${planId}_modifier_${modId}`,
      slotKind: 'modifier',
      value: mod.promptText,
      grammarRefs: [`environmentalModifiers.${mod.modifierId}`],
      utdgRefs: [],
      evidenceRefs: mod.provenance.sourceChunkIds
    });
  }
  return slots;
}

function samplePlan(grammar: SceneGrammar, seed: number, index: number): ContentPlan | undefined {
  const rng = mulberry32((seed ^ (index * 0x9e3779b1)) >>> 0);
  const archetypes = grammar.archetypes;
  const archetypeWeights = archetypes.map((a) => choiceWeightFromRange(a.weightRange));
  const zones = grammar.locationZones;
  const modifiers = grammar.environmentalModifiers;
  const planId = `plan_${seed}_${String(index).padStart(3, '0')}`;

  for (let attempt = 0; attempt < MAX_RESAMPLE_ATTEMPTS; attempt++) {
    const archetype = weightedPick(archetypes, archetypeWeights, rng);
    const zone = zones.length > 0 ? weightedPick(zones, zones.map(() => 1), rng) : undefined;
    const chosenMods: string[] = [];
    for (const m of modifiers) {
      if (rng() < 0.4) chosenMods.push(m.modifierId);
    }
    const sel = selectionOf(archetype, zone?.zoneId, chosenMods);
    if (violatedRuleIds(grammar, sel).length === 0) {
      return {
        planId,
        seed,
        grammarTarget: grammar.grammarTarget,
        slots: slotsFor(planId, archetype, grammar, sel),
        negativeSlots: applicableNegativeConstraints(grammar, sel).flatMap((constraint, constraintIndex) => {
          const enforcement = constraint.enforcement;
          const structured = enforcement !== undefined && [
            ...enforcement.avoid, ...enforcement.exclude, ...enforcement.force, ...enforcement.allow
          ].length > 0;
          const refs = { grammarRefs: [`negativeConstraints.${constraint.constraintId}`],
            utdgRefs: [], evidenceRefs: constraint.provenance.sourceChunkIds };
          return [{
            slotId: `${planId}_constraint_${constraintIndex}`,
            slotKind: structured ? 'constraint-note' : 'constraint-review',
            value: constraint.text, ...refs
          }, ...[...new Set([...(enforcement?.avoid ?? []), ...(enforcement?.exclude ?? [])])].map((target, targetIndex) => ({
            slotId: `${planId}_negative_${constraintIndex}_${targetIndex}`,
            slotKind: 'negative', value: target, ...refs
          }))];
        }),
        rulesApplied: appliedRuleIds(grammar, sel)
      };
    }
  }
  return undefined; // unsatisfiable within the attempt budget; emit nothing rather than a violating plan
}

export function sampleContentPlans(args: {
  grammar: SceneGrammar;
  seed: number;
  count: number;
  runId?: string;
  inputId?: string;
  now: string;
}): ContentPlans {
  assertSupportedGenerationRules(args.grammar);
  const plans: ContentPlan[] = [];
  for (let i = 0; i < args.count && args.grammar.archetypes.length > 0; i++) {
    const plan = samplePlan(args.grammar, args.seed, i);
    if (plan) plans.push(plan);
  }
  return ContentPlansSchema.parse({
    artifact: 'content-plans',
    runId: args.runId ?? args.grammar.runId,
    inputId: args.inputId ?? args.grammar.inputId,
    createdAt: args.now,
    grammarTarget: args.grammar.grammarTarget,
    plans,
    realized: []
  });
}

export { violatedRuleIds } from './rules';

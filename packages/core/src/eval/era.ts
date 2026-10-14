import type { ContentPlan, SceneGrammar } from '../schemas';
import {
  ExpressiveRangeReportSchema,
  GenerativeShiftReportSchema,
  type ExpressiveRangeReport,
  type GenerativeShiftReport
} from '../schemas/eval';
import { sampleContentPlans } from '../stages/sample';
import { violatedRuleIds, type Selection } from '../stages/sample/rules';

function refId(plan: ContentPlan, prefix: string): string | undefined {
  const ref = plan.slots.flatMap((slot) => slot.grammarRefs).find((value) => value.startsWith(`${prefix}.`));
  return ref?.slice(prefix.length + 1);
}

function refIds(plan: ContentPlan, prefix: string): string[] {
  return plan.slots.flatMap((slot) => slot.grammarRefs)
    .filter((value) => value.startsWith(`${prefix}.`))
    .map((value) => value.slice(prefix.length + 1));
}

export function selectionFor(grammar: SceneGrammar, plan: ContentPlan): Selection | undefined {
  const archetypeId = refId(plan, 'archetypes');
  if (!archetypeId) return undefined;
  const archetype = grammar.archetypes.find((candidate) => candidate.archetypeId === archetypeId);
  if (!archetype) return undefined;
  const zoneId = refId(plan, 'locationZones');
  return {
    archetypeId,
    ...(zoneId !== undefined ? { zoneId } : {}),
    ...(archetype.role !== undefined ? { role: archetype.role } : {}),
    ...(archetype.classBand !== undefined ? { classBand: archetype.classBand } : {}),
    ...(archetype.genderPresentation !== undefined ? { genderPresentation: archetype.genderPresentation } : {}),
    modifiers: refIds(plan, 'environmentalModifiers')
  };
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function shares(counts: Record<string, number>, denominator: number): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, denominator > 0 ? count / denominator : 0]));
}

const tokenize = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function analyzeExpressiveRange(
  grammar: SceneGrammar,
  options: { seed: number; sampleCount: number }
): ExpressiveRangeReport {
  const sampled = sampleContentPlans({
    grammar,
    seed: options.seed,
    count: options.sampleCount,
    now: grammar.createdAt
  });
  const archetypeCounts: Record<string, number> = {};
  const modifierCounts: Record<string, number> = {};
  const allTokens: string[] = [];
  let plansWithEvidence = 0;
  let violations = 0;

  for (const plan of sampled.plans) {
    const archetypeId = refId(plan, 'archetypes');
    if (archetypeId) increment(archetypeCounts, archetypeId);
    for (const modifierId of refIds(plan, 'environmentalModifiers')) increment(modifierCounts, modifierId);
    allTokens.push(...plan.slots.flatMap((slot) => tokenize(slot.value)));
    if (plan.slots.some((slot) => slot.evidenceRefs.length > 0)) plansWithEvidence++;
    const selection = selectionFor(grammar, plan);
    if (selection && violatedRuleIds(grammar, selection).length > 0) violations++;
  }

  const emitted = sampled.plans.length;
  return ExpressiveRangeReportSchema.parse({
    grammarTarget: grammar.grammarTarget,
    seed: options.seed,
    sampleCountRequested: options.sampleCount,
    sampleCountEmitted: emitted,
    emissionRate: options.sampleCount > 0 ? emitted / options.sampleCount : 0,
    constraintViolationRate: emitted > 0 ? violations / emitted : 0,
    lexicalDiversity: allTokens.length > 0 ? new Set(allTokens).size / allTokens.length : 0,
    evidenceCoverage: emitted > 0 ? plansWithEvidence / emitted : 0,
    archetypeMix: shares(archetypeCounts, emitted),
    modifierMix: shares(modifierCounts, emitted)
  });
}

function deltaRecord(base: Record<string, number>, accepted: Record<string, number>): Record<string, number> {
  const keys = new Set([...Object.keys(base), ...Object.keys(accepted)]);
  return Object.fromEntries([...keys].sort().map((key) => [key, (accepted[key] ?? 0) - (base[key] ?? 0)]));
}

export function compareExpressiveRanges(
  base: ExpressiveRangeReport,
  accepted: ExpressiveRangeReport
): GenerativeShiftReport {
  const archetypeShareDelta = deltaRecord(base.archetypeMix, accepted.archetypeMix);
  const modifierShareDelta = deltaRecord(base.modifierMix, accepted.modifierMix);
  const totalVariationDistance = Object.values(archetypeShareDelta)
    .reduce((sum, delta) => sum + Math.abs(delta), 0) / 2;
  const explanations = Object.entries(archetypeShareDelta)
    .filter(([, delta]) => Math.abs(delta) >= 0.005)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .map(([id, delta]) => `${id} share ${delta >= 0 ? 'increased' : 'decreased'} by ${(Math.abs(delta) * 100).toFixed(1)} percentage points`);

  const lexicalDiversityDelta = accepted.lexicalDiversity - base.lexicalDiversity;
  const evidenceCoverageDelta = accepted.evidenceCoverage - base.evidenceCoverage;
  const emissionRateDelta = accepted.emissionRate - base.emissionRate;
  if (explanations.length === 0 && Math.abs(emissionRateDelta) >= 0.005) {
    explanations.push(`emission rate ${emissionRateDelta >= 0 ? 'increased' : 'decreased'} by ${(Math.abs(emissionRateDelta) * 100).toFixed(1)} percentage points`);
  }

  return GenerativeShiftReportSchema.parse({
    totalVariationDistance,
    archetypeShareDelta,
    modifierShareDelta,
    lexicalDiversityDelta,
    evidenceCoverageDelta,
    emissionRateDelta,
    explanations
  });
}

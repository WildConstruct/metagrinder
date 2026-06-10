import { z } from 'zod';
import { ProvenanceSchema, WeightedRangeSchema, artifactEnvelope } from './provenance';
import {
  AnalysisModeSchema,
  ConfidenceLevelSchema,
  ResearchKindSchema,
  RightsProfileSchema
} from './vocabulary';

/**
 * scene-grammar: the structured scene model (base or accepted).
 * Ported from the legacy artifact with two changes: every record carries full
 * Provenance (not bare chunk-id arrays), and archetype identity fields are open
 * strings — no fixture-derived definitions exist in code.
 */

export const SceneArchetypeSchema = z.object({
  archetypeId: z.string(),
  label: z.string(),
  summary: z.string(),
  role: z.string(),
  genderPresentation: z.string().optional(),
  classBand: z.string().optional(),
  raceEthnicityContext: z.string().optional(),
  weightRange: WeightedRangeSchema.optional(),
  dominantAttributes: z.array(z.string()).default([]),
  optionalAttributes: z.array(z.string()).default([]),
  wardrobeRefs: z.array(z.string()).default([]),
  behaviorRefs: z.array(z.string()).default([]),
  locationZoneRefs: z.array(z.string()).default([]),
  promptText: z.string(),
  confidence: ConfidenceLevelSchema,
  provenance: ProvenanceSchema
});
export type SceneArchetype = z.infer<typeof SceneArchetypeSchema>;

export const LocationZoneSchema = z.object({
  zoneId: z.string(),
  label: z.string(),
  promptText: z.string(),
  archetypeBiases: z.array(WeightedRangeSchema).default([]),
  provenance: ProvenanceSchema
});
export type LocationZone = z.infer<typeof LocationZoneSchema>;

export const RuleEffectSchema = z.object({
  action: z.enum([
    'force', 'allow', 'avoid', 'increase', 'decrease', 'exclude',
    'requires', 'incompatible-with', 'bias-toward', 'bias-away-from'
  ]),
  target: z.string()
});
export type RuleEffect = z.infer<typeof RuleEffectSchema>;

export const CompatibilityRuleSchema = z.object({
  ruleId: z.string(),
  label: z.string(),
  condition: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not-equals', 'includes', 'exists']),
    value: z.string()
  }),
  effects: z.array(RuleEffectSchema).min(1),
  confidence: ConfidenceLevelSchema,
  provenance: ProvenanceSchema
});
export type CompatibilityRule = z.infer<typeof CompatibilityRuleSchema>;

export const NegativeConstraintSchema = z.object({
  constraintId: z.string(),
  label: z.string(),
  text: z.string(),
  constraintType: z.enum([
    'negative',
    'ethical-historical',
    'ethical-historical-representation',
    'modern-artifact-risk',
    'compatibility'
  ]),
  appliesTo: z.array(z.string()).default([]),
  enforcement: z.object({
    avoid: z.array(z.string()).default([]),
    allow: z.array(z.string()).default([]),
    force: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([])
  }).optional(),
  enforcedByRuleIds: z.array(z.string()).default([]),
  confidence: ConfidenceLevelSchema,
  provenance: ProvenanceSchema
});
export type NegativeConstraint = z.infer<typeof NegativeConstraintSchema>;

export const ItemSystemSchema = z.object({
  systemId: z.string(),
  label: z.string(),
  kind: z.enum(['wardrobe', 'grooming-and-hair', 'props-and-accessories']),
  items: z.array(z.string()).default([]),
  avoidItems: z.array(z.string()).default([]),
  provenance: ProvenanceSchema
});
export type ItemSystem = z.infer<typeof ItemSystemSchema>;

export const BehaviorStateSchema = z.object({
  behaviorId: z.string(),
  label: z.string(),
  promptText: z.string(),
  provenance: ProvenanceSchema
});

export const EnvironmentalModifierSchema = z.object({
  modifierId: z.string(),
  label: z.string(),
  promptText: z.string(),
  provenance: ProvenanceSchema
});

export const VisualReferenceSchema = z.object({
  referenceId: z.string(),
  kind: z.literal('image-reference'),
  path: z.string().optional(),
  caption: z.string(),
  supports: z.array(z.string()).default([]),
  linkedArchetypeIds: z.array(z.string()).default([]),
  rightsProfile: RightsProfileSchema.default('reference-only'),
  provenance: ProvenanceSchema
});

export const DemographicDistributionSchema = z.object({
  distributionId: z.string(),
  label: z.string(),
  entries: z.array(WeightedRangeSchema).default([]),
  appliesToRefs: z.array(z.string()).default([]),
  provenance: ProvenanceSchema
});
export type DemographicDistribution = z.infer<typeof DemographicDistributionSchema>;

export const SceneGrammarSchema = artifactEnvelope('scene-grammar').extend({
  analysisMode: AnalysisModeSchema,
  /** 'base' = derived from inputs; 'accepted' = base + accepted, citation-gated deltas. */
  grammarTarget: z.enum(['base', 'accepted']),
  sceneContext: z.object({
    contextId: z.string(),
    title: z.string(),
    researchKind: ResearchKindSchema,
    summary: z.string(),
    provenance: ProvenanceSchema
  }),
  archetypes: z.array(SceneArchetypeSchema).default([]),
  demographicDistributions: z.array(DemographicDistributionSchema).default([]),
  itemSystems: z.array(ItemSystemSchema).default([]),
  locationZones: z.array(LocationZoneSchema).default([]),
  behaviorStates: z.array(BehaviorStateSchema).default([]),
  environmentalModifiers: z.array(EnvironmentalModifierSchema).default([]),
  visualReferences: z.array(VisualReferenceSchema).default([]),
  compatibilityRules: z.array(CompatibilityRuleSchema).default([]),
  negativeConstraints: z.array(NegativeConstraintSchema).default([]),
  uncertainties: z.array(z.string()).default([]),
  reviewFlags: z.array(z.string()).default([])
});
export type SceneGrammar = z.infer<typeof SceneGrammarSchema>;

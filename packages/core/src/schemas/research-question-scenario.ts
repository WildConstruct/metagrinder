import { z } from 'zod';
import {
  ResearchTaskSchema,
  SituationCardSchema,
  SkeletonSlotSchema,
  SlotCoverageEntrySchema,
  TraitChannelSchema,
  TraitRecordSchema
} from './community-job';

/**
 * research-question-scenario: frozen unit for the question-eval battery (S-QE.1).
 * See docs/research/metagrinder-question-eval-battery.md
 */

export const AntiQuestionKindSchema = z.enum([
  'cliche_substitution',
  'decade_drift',
  'cross_regional_conflation',
  'brand_dependence',
  'living_person_id',
  'political_flattening',
  'unfillable_source',
  'narrative_not_visual',
  'named_venue_or_ip'
]);
export type AntiQuestionKind = z.infer<typeof AntiQuestionKindSchema>;

export const GoldGapSchema = z.object({
  slot: SkeletonSlotSchema,
  channels: z.array(TraitChannelSchema).default([]),
  priority: z.number().min(0).max(1).default(0.8),
  /** Must appear in top-k proposed tasks for full recall credit. */
  mustHitInTopK: z.boolean().default(true),
  notes: z.string().optional()
});
export type GoldGap = z.infer<typeof GoldGapSchema>;

export const AntiQuestionSchema = z.object({
  id: z.string().min(1),
  kind: AntiQuestionKindSchema,
  description: z.string().min(1),
  /** Optional lexical cues for the deterministic anti matcher. */
  matchHints: z.array(z.string()).default([])
});
export type AntiQuestion = z.infer<typeof AntiQuestionSchema>;

export const ResearchQuestionScenarioSchema = z.object({
  artifact: z.literal('research-question-scenario'),
  schemaVersion: z.string().default('0.1.0'),
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  split: z.enum(['dev', 'holdout']),
  situation: SituationCardSchema,
  coverageSeed: z.array(SlotCoverageEntrySchema).default([]),
  hardConstraints: z.array(z.string()).default([]),
  productionRequirements: z.array(z.string()).default([]),
  goldGaps: z.array(GoldGapSchema).min(1),
  antiQuestions: z.array(AntiQuestionSchema).default([]),
  expectedUnlocks: z.array(z.string()).default([]),
  characteristicFailure: z.string().min(1),
  traits: z.array(TraitRecordSchema).default([]),
  researchTasksSeed: z.array(ResearchTaskSchema).default([]),
  /** Top-k for scoring; default 5. */
  k: z.number().int().positive().default(5),
  notes: z.string().optional()
});
export type ResearchQuestionScenario = z.infer<typeof ResearchQuestionScenarioSchema>;

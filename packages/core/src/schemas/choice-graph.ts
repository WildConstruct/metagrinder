import { z } from 'zod';
import { ProvenanceSchema, WeightedRangeSchema, artifactEnvelope } from './provenance';
import { AnalysisModeSchema } from './vocabulary';

/**
 * semantic-choice-graph: the inspectable boundary between brief/grammar analysis
 * and PSG export. Choice axes are reviewed here before any prompt graph exists.
 */

export const ChoiceConditionSchema = z.object({
  axisId: z.string(),
  operator: z.enum(['equals', 'not-equals', 'includes', 'exists']),
  value: z.string()
});
export type ChoiceCondition = z.infer<typeof ChoiceConditionSchema>;

export const ChoiceSchema = z.object({
  choiceId: z.string(),
  label: z.string(),
  promptText: z.string(),
  weight: WeightedRangeSchema.optional(),
  conditions: z.array(ChoiceConditionSchema).default([]),
  grammarRefs: z.array(z.string()).default([]),
  provenance: ProvenanceSchema.optional()
});
export type Choice = z.infer<typeof ChoiceSchema>;

export const ChoiceAxisSchema = z.object({
  axisId: z.string(),
  label: z.string(),
  /** Linearization order for compile; conditional subgraphs may override. */
  sequence: z.number().int().nonnegative(),
  required: z.boolean().default(true),
  choices: z.array(ChoiceSchema).min(1)
});
export type ChoiceAxis = z.infer<typeof ChoiceAxisSchema>;

export const ChoiceGraphSchema = artifactEnvelope('semantic-choice-graph').extend({
  analysisMode: AnalysisModeSchema,
  grammarTarget: z.enum(['base', 'accepted']),
  axes: z.array(ChoiceAxisSchema).default([]),
  edges: z.array(z.object({
    fromAxisId: z.string(),
    toAxisId: z.string(),
    kind: z.enum(['sequence', 'condition'])
  })).default([]),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
    refs: z.array(z.string()).default([])
  })).default([])
});
export type ChoiceGraph = z.infer<typeof ChoiceGraphSchema>;

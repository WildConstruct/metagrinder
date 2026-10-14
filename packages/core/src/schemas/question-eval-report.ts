import { z } from 'zod';
import { artifactEnvelope } from './provenance';

/**
 * question-eval-report: scored output of the research-question battery (S-QE.1).
 */

export const QuestionScenarioScoresSchema = z.object({
  recallAtK: z.number().min(0).max(1),
  precisionAtK: z.number().min(0).max(1),
  antiRate: z.number().min(0).max(1),
  fillabilityFailRate: z.number().min(0).max(1),
  rightsFailRate: z.number().min(0).max(1),
  scopePenalty: z.number().min(0).max(1),
  composite: z.number().min(0).max(1)
});
export type QuestionScenarioScores = z.infer<typeof QuestionScenarioScoresSchema>;

export const QuestionScenarioResultSchema = z.object({
  scenarioId: z.string(),
  title: z.string(),
  scores: QuestionScenarioScoresSchema,
  topTaskIds: z.array(z.string()).default([]),
  goldHits: z.array(z.string()).default([]),
  antiHits: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});
export type QuestionScenarioResult = z.infer<typeof QuestionScenarioResultSchema>;

export const QuestionEvalReportSchema = artifactEnvelope('question-eval-report').extend({
  askerId: z.string(),
  split: z.enum(['dev', 'holdout', 'dev+holdout']),
  k: z.number().int().positive(),
  scenarioCount: z.number().int().nonnegative(),
  aggregate: QuestionScenarioScoresSchema,
  perScenario: z.array(QuestionScenarioResultSchema).default([]),
  baselineComparison: z.object({
    baselineId: z.string(),
    baselineComposite: z.number(),
    delta: z.number(),
    passed: z.boolean()
  }).optional()
});
export type QuestionEvalReport = z.infer<typeof QuestionEvalReportSchema>;

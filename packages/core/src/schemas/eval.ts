import { z } from 'zod';
import { artifactEnvelope } from './provenance';

export const EvalBreakdownSchema = z.object({
  mode: z.number(),
  focus: z.number(),
  rationale: z.number(),
  warnings: z.number()
});

export const EvalBriefResultSchema = z.object({
  id: z.string(),
  expectedMode: z.string(),
  actualMode: z.string().nullable(),
  recommendedFocus: z.array(z.string()),
  warningCount: z.number().int().nonnegative(),
  breakdown: EvalBreakdownSchema,
  score: z.number(),
  maxScore: z.number(),
  problems: z.array(z.string())
});
export type EvalBriefResult = z.infer<typeof EvalBriefResultSchema>;

export const CorpusEvalReportSchema = z.object({
  corpusVersion: z.string(),
  sourceKind: z.enum(['legacy-bootstrap', 'replayed-extraction', 'holdout-extraction']),
  totalScore: z.number(),
  totalMax: z.number(),
  results: z.array(EvalBriefResultSchema)
});
export type CorpusEvalReport = z.infer<typeof CorpusEvalReportSchema>;

export const ExpressiveRangeReportSchema = z.object({
  grammarTarget: z.enum(['base', 'accepted']),
  seed: z.number().int(),
  sampleCountRequested: z.number().int().nonnegative(),
  sampleCountEmitted: z.number().int().nonnegative(),
  emissionRate: z.number().min(0).max(1),
  constraintViolationRate: z.number().min(0).max(1),
  lexicalDiversity: z.number().min(0).max(1),
  evidenceCoverage: z.number().min(0).max(1),
  archetypeMix: z.record(z.number().min(0).max(1)),
  modifierMix: z.record(z.number().min(0).max(1))
});
export type ExpressiveRangeReport = z.infer<typeof ExpressiveRangeReportSchema>;

export const GenerativeShiftReportSchema = z.object({
  totalVariationDistance: z.number().min(0).max(1),
  archetypeShareDelta: z.record(z.number()),
  modifierShareDelta: z.record(z.number()),
  lexicalDiversityDelta: z.number(),
  evidenceCoverageDelta: z.number(),
  emissionRateDelta: z.number(),
  explanations: z.array(z.string())
});
export type GenerativeShiftReport = z.infer<typeof GenerativeShiftReportSchema>;

export const EvalReportSchema = artifactEnvelope('eval-report').extend({
  corpus: CorpusEvalReportSchema,
  era: z.object({
    base: ExpressiveRangeReportSchema,
    accepted: ExpressiveRangeReportSchema.optional(),
    shift: GenerativeShiftReportSchema.optional()
  })
});
export type EvalReport = z.infer<typeof EvalReportSchema>;

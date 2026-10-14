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
  /** This ratio records carried reference presence, not evidence validity or entailment. */
  evidenceCoverageBasis: z.literal('reference-presence-only').default('reference-presence-only'),
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

export const JudgeCriterionSchema = z.object({
  criterionId: z.string(),
  label: z.string(),
  description: z.string()
});
export type JudgeCriterion = z.infer<typeof JudgeCriterionSchema>;

export const JudgeStressCaseSchema = z.object({
  caseId: z.string(),
  candidate: z.string().min(1),
  reference: z.string().min(1),
  expectedPreferred: z.enum(['candidate', 'reference', 'tie'])
});
export type JudgeStressCase = z.infer<typeof JudgeStressCaseSchema>;

export const HumanCalibrationRatingSchema = z.object({
  caseId: z.string(),
  preferred: z.enum(['candidate', 'reference', 'tie']),
  candidateScore: z.number().min(0).max(4),
  referenceScore: z.number().min(0).max(4)
});
export type HumanCalibrationRating = z.infer<typeof HumanCalibrationRatingSchema>;

export const PairwiseJudgeResponseSchema = z.object({
  winner: z.enum(['left', 'right', 'tie']),
  criteria: z.array(z.object({
    criterionId: z.string(),
    leftScore: z.number().min(0).max(4),
    rightScore: z.number().min(0).max(4),
    rationale: z.string().min(1)
  })).min(1)
});
export type PairwiseJudgeResponse = z.infer<typeof PairwiseJudgeResponseSchema>;

export const JudgeMetaGateReportSchema = z.object({
  passed: z.boolean(),
  seed: z.number().int(),
  stressAccuracy: z.number().min(0).max(1),
  positionConsistency: z.number().min(0).max(1),
  thresholds: z.object({
    minStressAccuracy: z.number().min(0).max(1),
    minPositionConsistency: z.number().min(0).max(1),
    minCalibrationAgreement: z.number().min(0).max(1),
    maxCalibrationMae: z.number().nonnegative(),
    minCalibrationRatings: z.number().int().positive()
  }),
  stressResults: z.array(z.object({
    caseId: z.string(),
    initialCandidateSide: z.enum(['left', 'right']),
    initialPreferred: z.enum(['candidate', 'reference', 'tie']),
    mirroredPreferred: z.enum(['candidate', 'reference', 'tie']),
    expectedPreferred: z.enum(['candidate', 'reference', 'tie']),
    correct: z.boolean(),
    positionConsistent: z.boolean(),
    analyticComplete: z.boolean(),
    candidateScore: z.number().min(0).max(4),
    referenceScore: z.number().min(0).max(4)
  })),
  calibration: z.object({
    status: z.enum(['missing', 'pass', 'fail']),
    ratingCount: z.number().int().nonnegative(),
    preferenceAgreement: z.number().min(0).max(1).nullable(),
    meanAbsoluteError: z.number().nonnegative().nullable()
  }),
  failures: z.array(z.string())
});
export type JudgeMetaGateReport = z.infer<typeof JudgeMetaGateReportSchema>;

export const PipelineDiagnosticSchema = z.object({
  briefId: z.string(),
  runId: z.string(),
  inputId: z.string(),
  artifactHashes: z.record(z.string().regex(/^[a-f0-9]{64}$/)),
  planCount: z.number().int().nonnegative(),
  realizedCount: z.number().int().nonnegative(),
  failedRealizations: z.number().int().nonnegative(),
  pendingRealizations: z.number().int().nonnegative(),
  constraintViolations: z.number().int().nonnegative(),
  issues: z.array(z.string())
});
export type PipelineDiagnostic = z.infer<typeof PipelineDiagnosticSchema>;

export const EvalReportSchema = artifactEnvelope('eval-report').extend({
  evaluationScope: z.object({
    scoredSignals: z.literal('extraction-metadata'),
    factualAccuracy: z.literal('not-evaluated'),
    downstreamSemantics: z.literal('not-evaluated'),
    downstreamDiagnostics: z.enum(['not-evaluated', 'deterministic-boundaries']).default('not-evaluated'),
    eraInput: z.object({ scope: z.literal('single-grammar'), runId: z.string(), inputId: z.string() }).optional()
  }).default({ scoredSignals: 'extraction-metadata', factualAccuracy: 'not-evaluated', downstreamSemantics: 'not-evaluated' }),
  pipelineDiagnostics: z.array(PipelineDiagnosticSchema).default([]),
  baseline: z.object({ minimumScore: z.number().nonnegative(), passed: z.boolean() }).optional(),
  corpus: CorpusEvalReportSchema,
  era: z.object({
    base: ExpressiveRangeReportSchema,
    accepted: ExpressiveRangeReportSchema.optional(),
    shift: GenerativeShiftReportSchema.optional()
  }),
  judgeGate: JudgeMetaGateReportSchema.optional()
});
export type EvalReport = z.infer<typeof EvalReportSchema>;

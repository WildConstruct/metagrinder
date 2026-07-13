import type { LlmProvider } from '../providers';
import {
  HumanCalibrationRatingSchema,
  JudgeCriterionSchema,
  JudgeMetaGateReportSchema,
  JudgeStressCaseSchema,
  PairwiseJudgeResponseSchema,
  type HumanCalibrationRating,
  type JudgeCriterion,
  type JudgeMetaGateReport,
  type JudgeStressCase,
  type PairwiseJudgeResponse
} from '../schemas';

export interface PairwiseJudgeRequest {
  caseId: string;
  left: string;
  right: string;
  criteria: JudgeCriterion[];
}

export type PairwiseJudge = (request: PairwiseJudgeRequest) => Promise<PairwiseJudgeResponse>;

type NamedPreference = JudgeStressCase['expectedPreferred'];

function candidateStartsLeft(caseId: string, seed: number): boolean {
  let hash = seed >>> 0;
  for (const char of caseId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash & 1) === 0;
}

function namedPreference(winner: PairwiseJudgeResponse['winner'], candidateOnLeft: boolean): NamedPreference {
  if (winner === 'tie') return 'tie';
  const winnerIsLeft = winner === 'left';
  return winnerIsLeft === candidateOnLeft ? 'candidate' : 'reference';
}

function analyticScores(
  response: PairwiseJudgeResponse,
  criteria: JudgeCriterion[],
  candidateOnLeft: boolean
): { complete: boolean; candidateScore: number; referenceScore: number } {
  const expectedIds = new Set(criteria.map((criterion) => criterion.criterionId));
  const returnedIds = response.criteria.map((criterion) => criterion.criterionId);
  const complete = returnedIds.length === expectedIds.size
    && new Set(returnedIds).size === returnedIds.length
    && returnedIds.every((id) => expectedIds.has(id));
  const denominator = response.criteria.length || 1;
  const left = response.criteria.reduce((sum, criterion) => sum + criterion.leftScore, 0) / denominator;
  const right = response.criteria.reduce((sum, criterion) => sum + criterion.rightScore, 0) / denominator;
  return candidateOnLeft
    ? { complete, candidateScore: left, referenceScore: right }
    : { complete, candidateScore: right, referenceScore: left };
}

export async function runJudgeMetaGate(args: {
  judge: PairwiseJudge;
  cases: JudgeStressCase[];
  criteria: JudgeCriterion[];
  humanRatings: HumanCalibrationRating[];
  seed: number;
  minStressAccuracy?: number;
  minPositionConsistency?: number;
  minCalibrationAgreement?: number;
  maxCalibrationMae?: number;
  minCalibrationRatings?: number;
}): Promise<JudgeMetaGateReport> {
  const cases = args.cases.map((entry) => JudgeStressCaseSchema.parse(entry));
  const criteria = args.criteria.map((entry) => JudgeCriterionSchema.parse(entry));
  const humanRatings = args.humanRatings.map((entry) => HumanCalibrationRatingSchema.parse(entry));
  if (cases.length === 0) throw new Error('judge stress battery requires at least one case');
  if (criteria.length === 0) throw new Error('judge stress battery requires at least one analytic criterion');

  const stressResults: JudgeMetaGateReport['stressResults'] = [];
  for (const testCase of cases) {
    const initialCandidateOnLeft = candidateStartsLeft(testCase.caseId, args.seed);
    const initial = PairwiseJudgeResponseSchema.parse(await args.judge({
      caseId: `${testCase.caseId}:initial`,
      left: initialCandidateOnLeft ? testCase.candidate : testCase.reference,
      right: initialCandidateOnLeft ? testCase.reference : testCase.candidate,
      criteria
    }));
    const mirrored = PairwiseJudgeResponseSchema.parse(await args.judge({
      caseId: `${testCase.caseId}:mirrored`,
      left: initialCandidateOnLeft ? testCase.reference : testCase.candidate,
      right: initialCandidateOnLeft ? testCase.candidate : testCase.reference,
      criteria
    }));
    const initialPreferred = namedPreference(initial.winner, initialCandidateOnLeft);
    const mirroredPreferred = namedPreference(mirrored.winner, !initialCandidateOnLeft);
    const initialScores = analyticScores(initial, criteria, initialCandidateOnLeft);
    const mirroredScores = analyticScores(mirrored, criteria, !initialCandidateOnLeft);
    const analyticComplete = initialScores.complete && mirroredScores.complete;
    stressResults.push({
      caseId: testCase.caseId,
      initialCandidateSide: initialCandidateOnLeft ? 'left' : 'right',
      initialPreferred,
      mirroredPreferred,
      expectedPreferred: testCase.expectedPreferred,
      correct: analyticComplete
        && initialPreferred === testCase.expectedPreferred
        && mirroredPreferred === testCase.expectedPreferred,
      positionConsistent: initialPreferred === mirroredPreferred,
      analyticComplete,
      candidateScore: (initialScores.candidateScore + mirroredScores.candidateScore) / 2,
      referenceScore: (initialScores.referenceScore + mirroredScores.referenceScore) / 2
    });
  }

  const stressAccuracy = stressResults.filter((result) => result.correct).length / stressResults.length;
  const positionConsistency = stressResults.filter((result) => result.positionConsistent).length / stressResults.length;
  const thresholds = {
    minStressAccuracy: args.minStressAccuracy ?? 1,
    minPositionConsistency: args.minPositionConsistency ?? 1,
    minCalibrationAgreement: args.minCalibrationAgreement ?? 0.8,
    maxCalibrationMae: args.maxCalibrationMae ?? 1,
    minCalibrationRatings: args.minCalibrationRatings ?? Math.min(2, cases.length)
  };

  const resultById = new Map(stressResults.map((result) => [result.caseId, result]));
  const comparable = humanRatings.flatMap((rating) => {
    const result = resultById.get(rating.caseId);
    return result ? [{ rating, result }] : [];
  });
  const calibration = comparable.length === 0
    ? { status: 'missing' as const, ratingCount: 0, preferenceAgreement: null, meanAbsoluteError: null }
    : (() => {
      const preferenceAgreement = comparable.filter(({ rating, result }) =>
        result.positionConsistent && result.initialPreferred === rating.preferred
      ).length / comparable.length;
      const meanAbsoluteError = comparable.reduce((sum, { rating, result }) =>
        sum + Math.abs(result.candidateScore - rating.candidateScore)
          + Math.abs(result.referenceScore - rating.referenceScore), 0
      ) / (comparable.length * 2);
      const passed = comparable.length >= thresholds.minCalibrationRatings
        && preferenceAgreement >= thresholds.minCalibrationAgreement
        && meanAbsoluteError <= thresholds.maxCalibrationMae;
      return {
        status: passed ? 'pass' as const : 'fail' as const,
        ratingCount: comparable.length,
        preferenceAgreement,
        meanAbsoluteError
      };
    })();

  const failures: string[] = [];
  if (stressAccuracy < thresholds.minStressAccuracy) failures.push('known-good/bad stress accuracy below threshold');
  if (positionConsistency < thresholds.minPositionConsistency) failures.push('pairwise position consistency below threshold');
  if (stressResults.some((result) => !result.analyticComplete)) failures.push('analytic criterion coverage incomplete');
  if (calibration.status === 'missing') failures.push('human calibration ratings missing');
  if (calibration.status === 'fail') failures.push('judge-human calibration below threshold');

  return JudgeMetaGateReportSchema.parse({
    passed: failures.length === 0,
    seed: args.seed,
    stressAccuracy,
    positionConsistency,
    thresholds,
    stressResults,
    calibration,
    failures
  });
}

export function assertJudgeMetricsAllowed<T>(report: JudgeMetaGateReport, compute: () => T): T {
  const parsed = JudgeMetaGateReportSchema.parse(report);
  if (!parsed.passed) {
    throw new Error(`judge meta-gate is not open: ${parsed.failures.join('; ')}`);
  }
  return compute();
}

export function createLlmPairwiseJudge(provider: LlmProvider): PairwiseJudge {
  return async (request) => {
    const prompt = [
      'Compare LEFT OUTPUT and RIGHT OUTPUT criterion-by-criterion.',
      'Score each criterion from 0 to 4 and select left, right, or tie.',
      `CRITERIA: ${JSON.stringify(request.criteria)}`,
      `LEFT OUTPUT:\n${request.left}`,
      `RIGHT OUTPUT:\n${request.right}`
    ].join('\n\n');
    const result = await provider.complete({
      stage: 'judge',
      prompt,
      schema: PairwiseJudgeResponseSchema,
      schemaName: 'pairwise-judge-response'
    });
    return result.data;
  };
}

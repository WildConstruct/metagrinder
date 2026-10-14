import type { LlmProvider } from '../providers';
import type {
  HumanCalibrationRating,
  JudgeCriterion,
  JudgeStressCase,
  PairwiseJudgeResponse
} from '../schemas';
import {
  assertJudgeMetricsAllowed,
  createLlmPairwiseJudge,
  runJudgeMetaGate,
  type PairwiseJudge
} from './judge';
import { DEFAULT_JUDGE_CRITERIA, DEFAULT_JUDGE_STRESS_CASES } from './judge-battery';
import { runJudgeGate } from './run-judge-gate';

const CRITERIA: JudgeCriterion[] = [
  { criterionId: 'grounding', label: 'Grounding', description: 'Claims are supported by the supplied source.' },
  { criterionId: 'specificity', label: 'Specificity', description: 'The answer is concrete and useful.' }
];

const CASES: JudgeStressCase[] = [
  {
    caseId: 'known_good_candidate',
    candidate: 'SUPPORTED candidate answer',
    reference: 'unsupported reference answer',
    expectedPreferred: 'candidate'
  },
  {
    caseId: 'known_bad_candidate',
    candidate: 'unsupported candidate answer',
    reference: 'SUPPORTED reference answer',
    expectedPreferred: 'reference'
  }
];

const HUMAN: HumanCalibrationRating[] = [
  { caseId: 'known_good_candidate', preferred: 'candidate', candidateScore: 4, referenceScore: 0 },
  { caseId: 'known_bad_candidate', preferred: 'reference', candidateScore: 0, referenceScore: 4 }
];

const semanticJudge: PairwiseJudge = async (request) => {
  const leftSupported = request.left.includes('SUPPORTED');
  const rightSupported = request.right.includes('SUPPORTED');
  const winner = leftSupported === rightSupported ? 'tie' : leftSupported ? 'left' : 'right';
  return {
    winner,
    criteria: request.criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      leftScore: leftSupported ? 4 : 0,
      rightScore: rightSupported ? 4 : 0,
      rationale: `${criterion.label} assessed analytically`
    }))
  };
};

describe('S3.6 judge meta-gate', () => {
  test('committed stress battery covers both preferred sides with analytic criteria', () => {
    expect(DEFAULT_JUDGE_STRESS_CASES).toHaveLength(2);
    expect(new Set(DEFAULT_JUDGE_STRESS_CASES.map((entry) => entry.expectedPreferred)))
      .toEqual(new Set(['candidate', 'reference']));
    expect(DEFAULT_JUDGE_CRITERIA.length).toBeGreaterThanOrEqual(3);
  });

  test('operator runner refuses to start without the human calibration path', async () => {
    await expect(runJudgeGate(['record', 'codex-cli', 'unused'], {}))
      .rejects.toThrow(/METAGRINDER_JUDGE_CALIBRATION is required/);
  });

  test('[AC-3.6a] known-good/bad mirrored stress and human calibration open the gate', async () => {
    const report = await runJudgeMetaGate({
      judge: semanticJudge,
      cases: CASES,
      criteria: CRITERIA,
      humanRatings: HUMAN,
      seed: 17
    });
    expect(report.passed).toBe(true);
    expect(report.stressAccuracy).toBe(1);
    expect(report.positionConsistency).toBe(1);
    expect(report.calibration.status).toBe('pass');
    expect(report.calibration.preferenceAgreement).toBe(1);
    expect(assertJudgeMetricsAllowed(report, () => 0.87)).toBe(0.87);
  });

  test('[AC-3.6a] a position-biased judge fails and judge metrics are refused', async () => {
    const alwaysLeft: PairwiseJudge = async (request) => ({
      winner: 'left',
      criteria: request.criteria.map((criterion) => ({
        criterionId: criterion.criterionId,
        leftScore: 4,
        rightScore: 0,
        rationale: 'left is always preferred'
      }))
    });
    const report = await runJudgeMetaGate({
      judge: alwaysLeft,
      cases: CASES,
      criteria: CRITERIA,
      humanRatings: HUMAN,
      seed: 17
    });
    expect(report.passed).toBe(false);
    expect(report.positionConsistency).toBe(0);
    expect(() => assertJudgeMetricsAllowed(report, () => 1)).toThrow(/judge meta-gate is not open/);
  });

  test('missing human calibration keeps the gate blocked without fabricating ratings', async () => {
    const report = await runJudgeMetaGate({
      judge: semanticJudge,
      cases: CASES,
      criteria: CRITERIA,
      humanRatings: [],
      seed: 17
    });
    expect(report.passed).toBe(false);
    expect(report.calibration.status).toBe('missing');
  });

  test('repeating a single matched rating cannot satisfy the minimum unique calibration count', async () => {
    const report = await runJudgeMetaGate({
      judge: semanticJudge, cases: CASES, criteria: CRITERIA,
      humanRatings: [HUMAN[0]!, { ...HUMAN[0]! }], seed: 17
    });
    expect(report.thresholds.minCalibrationRatings).toBe(2);
    expect(report.calibration.ratingCount).toBe(1);
    expect(report.passed).toBe(false);
    expect(report.failures).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate.*known_good_candidate/i)]));
    expect(() => assertJudgeMetricsAllowed(report, () => 1)).toThrow(/judge meta-gate is not open/);
  });

  test('property: identical duplicate ratings cannot reweight calibration metrics or open the gate', async () => {
    const otherwisePassing = await runJudgeMetaGate({
      judge: semanticJudge, cases: CASES, criteria: CRITERIA,
      humanRatings: [...HUMAN, { ...HUMAN[0]! }], seed: 17
    });
    expect(otherwisePassing.calibration.ratingCount).toBe(2);
    expect(otherwisePassing.calibration.preferenceAgreement).toBe(1);
    expect(otherwisePassing.calibration.meanAbsoluteError).toBe(0);
    expect(otherwisePassing.passed).toBe(false);
    const unique = [HUMAN[0]!, { ...HUMAN[1]!, preferred: 'tie' as const, candidateScore: 2, referenceScore: 2 }];
    const baseline = await runJudgeMetaGate({ judge: semanticJudge, cases: CASES, criteria: CRITERIA, humanRatings: unique, seed: 17 });
    expect(baseline.calibration.preferenceAgreement).toBe(0.5);
    expect(baseline.calibration.meanAbsoluteError).toBe(1);
    for (const rating of unique) {
      for (const copies of [1, 3, 10]) {
        const report = await runJudgeMetaGate({
          judge: semanticJudge, cases: CASES, criteria: CRITERIA,
          humanRatings: [...unique, ...Array.from({ length: copies }, () => ({ ...rating }))], seed: 17
        });
        expect(report.calibration.ratingCount).toBe(2);
        expect(report.calibration.preferenceAgreement).toBe(baseline.calibration.preferenceAgreement);
        expect(report.calibration.meanAbsoluteError).toBe(baseline.calibration.meanAbsoluteError);
        expect(report.passed).toBe(false);
      }
    }
  });

  test('conflicting ratings exclude the ambiguous case regardless of input order', async () => {
    const conflict = { ...HUMAN[0]!, preferred: 'reference' as const, candidateScore: 0, referenceScore: 4 };
    const ratings = [HUMAN[0]!, conflict, HUMAN[1]!];
    for (const humanRatings of [ratings, [...ratings].reverse()]) {
      const report = await runJudgeMetaGate({ judge: semanticJudge, cases: CASES, criteria: CRITERIA, humanRatings, seed: 17 });
      expect(report.calibration.ratingCount).toBe(1);
      expect(report.calibration.preferenceAgreement).toBe(1);
      expect(report.calibration.meanAbsoluteError).toBe(0);
      expect(report.passed).toBe(false);
      expect(report.failures).toEqual(expect.arrayContaining([expect.stringMatching(/conflicting.*known_good_candidate/i)]));
    }
  });

  test('unknown cases are excluded from calibration and cannot be silently accepted', async () => {
    const unknown = { caseId: 'unknown_case', preferred: 'tie' as const, candidateScore: 4, referenceScore: 4 };
    for (const humanRatings of [[unknown], [...HUMAN, unknown]]) {
      const report = await runJudgeMetaGate({ judge: semanticJudge, cases: CASES, criteria: CRITERIA, humanRatings, seed: 17 });
      expect(report.calibration.ratingCount).toBe(humanRatings.length === 1 ? 0 : 2);
      expect(report.passed).toBe(false);
      expect(report.failures).toEqual(expect.arrayContaining([expect.stringMatching(/unknown.*unknown_case/i)]));
      if (humanRatings.length > 1) {
        expect(report.calibration.preferenceAgreement).toBe(1);
        expect(report.calibration.meanAbsoluteError).toBe(0);
      }
    }
  });

  test('valid unique ratings preserve the explicit minimum and existing rubric thresholds', async () => {
    const report = await runJudgeMetaGate({
      judge: semanticJudge, cases: CASES, criteria: CRITERIA,
      humanRatings: HUMAN, seed: 17, minCalibrationRatings: 3
    });
    expect(report.calibration.ratingCount).toBe(2);
    expect(report.thresholds).toMatchObject({ minCalibrationRatings: 3, minCalibrationAgreement: 0.8, maxCalibrationMae: 1 });
    expect(report.passed).toBe(false);
  });

  test('duplicate stress-case ids are rejected before any judge invocation', async () => {
    const judge = jest.fn(semanticJudge);
    await expect(runJudgeMetaGate({
      judge, cases: [CASES[0]!, { ...CASES[1]!, caseId: CASES[0]!.caseId }],
      criteria: CRITERIA, humanRatings: HUMAN, seed: 17
    })).rejects.toThrow(/duplicate.*stress.*case/i);
    expect(judge).not.toHaveBeenCalled();
  });

  test('LLM adapter requests an analytic pairwise response through the schema-bound provider', async () => {
    let observedPrompt = '';
    const provider: LlmProvider = {
      id: 'fake', model: 'judge-model',
      async complete<T>(request): Promise<{
        data: T; raw: string; cacheKey: string; provider: string; model: string; replayed: boolean;
      }> {
        observedPrompt = request.prompt;
        const response: PairwiseJudgeResponse = {
          winner: 'left',
          criteria: CRITERIA.map((criterion) => ({
            criterionId: criterion.criterionId,
            leftScore: 4,
            rightScore: 1,
            rationale: 'criterion-by-criterion comparison'
          }))
        };
        return {
          data: request.schema.parse(response), raw: JSON.stringify(response), cacheKey: 'k',
          provider: 'fake', model: 'judge-model', replayed: true
        };
      }
    };
    const judge = createLlmPairwiseJudge(provider);
    const response = await judge({
      caseId: 'adapter', left: 'left output', right: 'right output', criteria: CRITERIA
    });
    expect(response.winner).toBe('left');
    expect(observedPrompt).toContain('LEFT OUTPUT');
    expect(observedPrompt).toContain('criterion-by-criterion');
  });
});

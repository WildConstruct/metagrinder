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

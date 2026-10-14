import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ResearchQuestionScenarioSchema } from '../../schemas/research-question-scenario';
import { askDeterministic, DETERMINISTIC_ASKER_ID } from './askers/deterministic';
import { DEV_SCENARIOS_DIR, loadDevScenarios, loadHoldoutScenarios } from './load';
import { runQuestionBattery } from './run-question-battery';
import { scoreQuestionProposals } from './scorer';

const NOW = '2026-07-16T01:00:00.000Z';

describe('research-question scenarios (dev)', () => {
  test('loads 15 schema-valid dev scenarios', () => {
    const scenarios = loadDevScenarios(DEV_SCENARIOS_DIR);
    expect(scenarios.length).toBe(15);
    for (const s of scenarios) {
      expect(s.split).toBe('dev');
      expect(s.goldGaps.length).toBeGreaterThan(0);
      expect(s.characteristicFailure.length).toBeGreaterThan(0);
      ResearchQuestionScenarioSchema.parse(s);
    }
  });
});

describe('question scorer', () => {
  const scenario = loadDevScenarios().find((s) => s.scenarioId.includes('apollo'))!;

  test('perfect targeting scores high recall/precision', () => {
    const tasks = scenario.goldGaps.filter((g) => g.mustHitInTopK).map((g, i) => ({
      taskId: `t${i}`,
      title: `Research ${g.slot}`,
      rationale: `Fill ${g.slot} for production extras`,
      targetSlots: [g.slot],
      targetChannels: g.channels,
      targetTraitIds: [],
      suggestedSources: ['period photograph archive'],
      status: 'proposed' as const,
      score: 1 - i * 0.01
    }));
    const { scores } = scoreQuestionProposals({ scenario, tasks, k: 5 });
    expect(scores.recallAtK).toBe(1);
    expect(scores.precisionAtK).toBe(1);
    expect(scores.composite).toBeGreaterThan(0.7);
  });

  test('anti living-person task raises anti/rights rates', () => {
    const tasks = [
      {
        taskId: 'bad',
        title: 'Identify living private individuals by name in the control room',
        rationale: 'Named individual celebrity controller portraits',
        targetSlots: ['archetypes' as const],
        targetChannels: [],
        targetTraitIds: [],
        suggestedSources: [],
        status: 'proposed' as const,
        score: 1
      }
    ];
    const { scores, antiHits } = scoreQuestionProposals({ scenario, tasks, k: 5 });
    expect(scores.antiRate).toBeGreaterThan(0);
    expect(scores.rightsFailRate).toBeGreaterThan(0);
    expect(antiHits.length + scores.rightsFailRate).toBeGreaterThan(0);
  });

  test('spam tasks incur scope penalty', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => ({
      taskId: `spam_${i}`,
      title: `Task ${i}`,
      rationale: 'misc',
      targetSlots: [] as [],
      targetChannels: [],
      targetTraitIds: [],
      suggestedSources: [],
      status: 'proposed' as const,
      score: 0.5
    }));
    const { scores } = scoreQuestionProposals({ scenario, tasks, k: 5 });
    expect(scores.scopePenalty).toBeGreaterThan(0);
  });
});

describe('deterministic asker', () => {
  test('returns ranked tasks for Apollo-derived scenario', () => {
    const scenario = loadDevScenarios().find((s) => s.scenarioId.includes('apollo'))!;
    const tasks = askDeterministic({ scenario, now: NOW });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.title.length > 0)).toBe(true);
  });
});

describe('question battery', () => {
  test('holdout without env fails closed', () => {
    const prev = process.env.METAGRINDER_QUESTION_HOLDOUT_DIR;
    delete process.env.METAGRINDER_QUESTION_HOLDOUT_DIR;
    expect(() => loadHoldoutScenarios()).toThrow(/METAGRINDER_QUESTION_HOLDOUT_DIR/);
    if (prev !== undefined) process.env.METAGRINDER_QUESTION_HOLDOUT_DIR = prev;
  });

  test('runs deterministic battery on a subset of dev scenarios', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qe-battery-'));
    try {
      const scenarios = loadDevScenarios().slice(0, 3);
      const report = await runQuestionBattery({
        scenarios,
        askerId: DETERMINISTIC_ASKER_ID,
        ask: (s) => askDeterministic({ scenario: s, now: NOW }),
        split: 'dev',
        runId: 'run_qe_test',
        now: NOW,
        lockBaseline: false
      });
      expect(report.artifact).toBe('question-eval-report');
      expect(report.scenarioCount).toBe(3);
      expect(report.aggregate.composite).toBeGreaterThanOrEqual(0);
      expect(report.perScenario).toHaveLength(3);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

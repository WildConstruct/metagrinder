import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BudgetExceededError, RunStore } from '../../artifacts/store';
import { runQuestionCli } from './run-question-battery';
import * as loader from './load';
import type { ResearchQuestionScenario } from '../../schemas/research-question-scenario';

test('[S-R2a] question CLI applies run/campaign policy before any transport and preserves absent caps', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-question-budget-'));
  const runDir = path.join(root, 'questions');
  const scenario = {
    scenarioId: 'test-budget', title: 'Budget test', k: 1,
    situation: { who: 'crowd', what: 'event', where: 'hall', when: '1909', why: 'gathering', how: 'standing' },
    hardConstraints: [], productionRequirements: [], characteristicFailure: 'ungrounded detail',
    traits: [], coverageSeed: [], researchTasksSeed: [], goldGaps: [], antiQuestions: []
  } as unknown as ResearchQuestionScenario;
  const load = jest.spyOn(loader, 'loadDevScenarios').mockReturnValue([scenario]);
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network must not be reached'));
  try {
    const argv = ['llm', 'record', 'anthropic', 'dev', runDir];
    await expect(runQuestionCli(argv, {
      METAGRINDER_MAX_LLM_CALLS: '0', METAGRINDER_CAMPAIGN_ID: 'test-campaign',
      METAGRINDER_CAMPAIGN_MAX_LLM_CALLS: '0', METAGRINDER_CAMPAIGN_BUDGET_DIR: root
    })).rejects.toBeInstanceOf(BudgetExceededError);
    const store = RunStore.open(runDir);
    expect(store.getStageState('question-asker')).toBe('blocked_on_gate');
    expect(store.getBudgetLedgers().map((ledger) => ledger.scope).sort()).toEqual(['campaign', 'run']);
    await expect(runQuestionCli(argv, {})).rejects.toBeInstanceOf(BudgetExceededError);
    expect(store.getBudgetLedgers().every((ledger) => ledger.caps.maxLlmCalls === 0)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    load.mockRestore(); fetchSpy.mockRestore();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

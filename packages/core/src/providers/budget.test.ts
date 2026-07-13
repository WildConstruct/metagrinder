import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { BudgetExceededError, RunStore } from '../artifacts/store';
import { createCachingProvider, type Transport } from './index';

const NOW = () => '2026-07-12T12:00:00.000Z';
const OutputSchema = z.object({ answer: z.string() });
const request = (stage = 'extract') => ({
  stage,
  prompt: 'Return a short answer.',
  schema: OutputSchema,
  schemaName: 'budget-test-output'
});

function createStore(): RunStore {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-budget-'));
  return RunStore.create({ baseDir, runId: 'run_budget', inputId: 'i', parserVersion: '0.1.0', now: NOW });
}

describe('S3.7 provider budget ledger', () => {
  test('[AC-3.7a] live calls charge run and campaign, replay is free, cap raise resumes', async () => {
    const store = createStore();
    store.configureBudget({
      ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget',
      caps: { maxLlmCalls: 1, maxEstimatedTokens: 10_000 }
    });
    store.configureBudget({
      ledgerId: 'campaign:roadshow', scope: 'campaign', scopeId: 'roadshow',
      caps: { maxLlmCalls: 1, maxEstimatedTokens: 10_000 }
    });
    let liveCalls = 0;
    const transport: Transport = async () => {
      liveCalls++;
      return { rawText: '{"answer":"ok"}' };
    };
    const recorded = createCachingProvider({
      runDir: store.runDir, transport, providerId: 'fake', model: 'm', mode: 'record',
      budgetStore: store, outputTokenReserve: 32, now: NOW
    });
    await recorded.complete(request());
    expect(liveCalls).toBe(1);
    expect(store.getBudgetLedgers().map((ledger) => ledger.usage.llmCalls)).toEqual([1, 1]);
    expect(RunStore.open(store.runDir).getBudgetLedgers().map((ledger) => ledger.usage.llmCalls))
      .toEqual([1, 1]);

    const replay = createCachingProvider({
      runDir: store.runDir,
      transport: async () => { throw new Error('replay transport called'); },
      providerId: 'fake', model: 'm', mode: 'replay', budgetStore: store, now: NOW
    });
    await replay.complete(request());
    expect(store.getBudgetLedgers().map((ledger) => ledger.usage.llmCalls)).toEqual([1, 1]);

    await expect(recorded.complete(request())).rejects.toBeInstanceOf(BudgetExceededError);
    expect(liveCalls).toBe(1);
    expect(store.getStageState('extract')).toBe('blocked_on_gate');

    store.configureBudget({
      ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget',
      caps: { maxLlmCalls: 2, maxEstimatedTokens: 10_000 }
    });
    store.configureBudget({
      ledgerId: 'campaign:roadshow', scope: 'campaign', scopeId: 'roadshow',
      caps: { maxLlmCalls: 2, maxEstimatedTokens: 10_000 }
    });
    expect(store.getStageState('extract')).toBe('pending');
    await recorded.complete(request());
    expect(liveCalls).toBe(2);
    expect(store.getBudgetLedgers().map((ledger) => ledger.usage.llmCalls)).toEqual([2, 2]);
  });

  test('judge calls use their own cap and halt before transport', async () => {
    const store = createStore();
    store.configureBudget({
      ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget',
      caps: { maxJudgeCalls: 0, maxEstimatedTokens: 10_000 }
    });
    let calls = 0;
    const provider = createCachingProvider({
      runDir: store.runDir,
      transport: async () => { calls++; return { rawText: '{"answer":"ok"}' }; },
      providerId: 'fake', model: 'm', mode: 'record', budgetStore: store, now: NOW
    });
    await expect(provider.complete(request('judge'))).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(0);
    expect(store.getBudgetLedgers()[0]!.usage.judgeCalls).toBe(0);
  });
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { BudgetExceededError, RunStore } from '../artifacts/store';
import { buildProviderForRun, createCachingProvider, ReplayMissError, type Transport } from './index';

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

  test('omitted cap settings preserve persistent limits and a blocked budget gate', () => {
    const store = createStore();
    store.configureBudget({
      ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget', caps: { maxLlmCalls: 0 }
    });
    expect(() => store.reserveBudget({
      stage: 'extract', kind: 'llm', estimatedInputTokens: 1, reservedOutputTokens: 1
    })).toThrow(BudgetExceededError);
    store.configureBudget({ ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget', caps: {} });
    expect(RunStore.open(store.runDir).getBudgetLedgers()[0]!.caps.maxLlmCalls).toBe(0);
    expect(store.getStageState('extract')).toBe('blocked_on_gate');
  });

  test('omitting budgetStore cannot bypass the run folder persisted cap', async () => {
    const store = createStore();
    store.configureBudget({
      ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget', caps: { maxLlmCalls: 0 }
    });
    let calls = 0;
    const provider = createCachingProvider({
      runDir: store.runDir, providerId: 'fake', model: 'm', mode: 'record',
      transport: async () => { calls++; return { rawText: '{"answer":"ok"}' }; }
    });
    await expect(provider.complete(request())).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(0);
  });

  test('an explicit campaign-only ledger selection cannot omit the mandatory run cap', async () => {
    const store = createStore();
    store.configureBudget({ ledgerId: 'run:run_budget', scope: 'run', scopeId: 'run_budget', caps: { maxLlmCalls: 0 } });
    store.configureBudget({ ledgerId: 'campaign:selection', scope: 'campaign', scopeId: 'selection', caps: { maxLlmCalls: 10 } });
    let calls = 0;
    const provider = createCachingProvider({
      runDir: store.runDir, budgetStore: store, budgetLedgerIds: ['campaign:selection'],
      providerId: 'fake', model: 'm', mode: 'record',
      transport: async () => { calls++; return { rawText: '{"answer":"ok"}' }; }
    });
    await expect(provider.complete(request())).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(0);
    expect(store.getBudgetLedgers().every((ledger) => ledger.usage.llmCalls === 0)).toBe(true);
  });

  test('lazy live accounting preserves the logical runner manifest and replay creates no manifest', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-lazy-budget-'));
    const runDir = path.join(baseDir, 'logical');
    const provider = createCachingProvider({
      runDir, providerId: 'fake', model: 'm', mode: 'record',
      transport: async () => ({ rawText: '{"answer":"ok"}' })
    });
    expect(fs.existsSync(runDir)).toBe(false);
    const store = RunStore.create({ baseDir, runId: 'logical', inputId: 'actual-input', parserVersion: '0.1.0', now: NOW });
    await provider.complete(request());
    expect(RunStore.open(runDir).getManifest().inputId).toBe('actual-input');
    expect(store.getBudgetLedgers()[0]!.usage.llmCalls).toBe(1);

    const replayDir = path.join(baseDir, 'missing-replay');
    const replay = createCachingProvider({
      runDir: replayDir, providerId: 'fake', model: 'm', mode: 'replay',
      transport: async () => { throw new Error('replay transport called'); }
    });
    await expect(replay.complete(request())).rejects.toBeInstanceOf(ReplayMissError);
    expect(fs.existsSync(replayDir)).toBe(false);
  });

  test('shared campaign usage spans member runs and reservation settlement is idempotent', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-campaign-budget-'));
    const stores = ['a', 'b'].map((runId) => RunStore.create({ baseDir, runId, inputId: runId, parserVersion: '0.1.0', now: NOW }));
    for (const store of stores) {
      store.configureBudget({
        ledgerId: 'campaign:shared', scope: 'campaign', scopeId: 'shared',
        sharedBaseDir: baseDir, caps: { maxLlmCalls: 2 }
      });
      const reservation = store.reserveBudget({ stage: 'extract', kind: 'llm', estimatedInputTokens: 1, reservedOutputTokens: 8 });
      store.settleBudget(reservation, 2);
      store.settleBudget(reservation, 2);
    }
    for (const store of stores) {
      const shared = RunStore.open(store.runDir).getBudgetLedgers().find((ledger) => ledger.scope === 'campaign')!;
      expect(shared.usage.llmCalls).toBe(2);
      expect(shared.usage.estimatedOutputTokens).toBe(4);
      expect(shared.reservations).toHaveLength(2);
      expect(shared.reservations.every((reservation) => reservation.state === 'settled')).toBe(true);
    }
    expect(() => stores[0]!.reserveBudget({
      stage: 'grammar', kind: 'llm', estimatedInputTokens: 1, reservedOutputTokens: 1
    })).toThrow(BudgetExceededError);
  });

  test('stale store non-budget mutations cannot erase another instance durable reservation', () => {
    const store = createStore();
    const stale = RunStore.open(store.runDir);
    const reservation = store.reserveBudget({ stage: 'extract', kind: 'llm', estimatedInputTokens: 3, reservedOutputTokens: 8 });
    stale.setStageState('sample', 'complete');
    stale.recordModel('grammar', 'fake', 'm');
    stale.writeArtifact('content-plans', 'content-plans.json', {
      artifact: 'content-plans', runId: 'run_budget', inputId: 'i', createdAt: NOW(),
      grammarTarget: 'base', plans: [], realized: []
    });
    const ledger = RunStore.open(store.runDir).getBudgetLedgers()[0]!;
    expect(ledger.usage).toEqual({ llmCalls: 1, judgeCalls: 0, estimatedInputTokens: 3, estimatedOutputTokens: 8 });
    expect(ledger.reservations[0]?.reservationId).toBe(reservation.reservationId);
    store.settleBudget(reservation, 2);
    expect(RunStore.open(store.runDir).getBudgetLedgers()[0]!.usage.estimatedOutputTokens).toBe(2);
  });

  test('central factory applies live caps before transport and failures retain uncertain reservations', async () => {
    const store = createStore();
    let calls = 0;
    const provider = buildProviderForRun({
      store, kind: 'custom', mode: 'record', model: 'm',
      env: { METAGRINDER_MAX_LLM_CALLS: '0' },
      transport: async () => { calls++; return { rawText: '{"answer":"ok"}' }; }
    });
    await expect(provider.complete(request())).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(0);
    const failing = buildProviderForRun({
      store, kind: 'custom', mode: 'record', model: 'm', outputTokenReserve: 8,
      env: { METAGRINDER_MAX_LLM_CALLS: '1' }, transport: async () => { throw new Error('connection lost'); }
    });
    await expect(failing.complete(request())).rejects.toThrow('connection lost');
    const ledger = RunStore.open(store.runDir).getBudgetLedgers()[0]!;
    expect(ledger.usage.llmCalls).toBe(1);
    expect(ledger.usage.estimatedOutputTokens).toBe(8);
    expect(ledger.reservations[0]?.state).toBe('reserved');
  });

  test.each(['run', 'campaign'] as const)('concurrent processes cannot overspend a %s cap', async (scope) => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-concurrent-budget-'));
    const stores = (scope === 'campaign' ? ['a', 'b'] : ['a']).map((runId) =>
      RunStore.create({ baseDir, runId, inputId: runId, parserVersion: '0.1.0', now: NOW }));
    for (const store of stores) store.configureBudget({
      ledgerId: scope === 'campaign' ? 'campaign:concurrent' : 'run:a', scope,
      scopeId: scope === 'campaign' ? 'concurrent' : 'a',
      sharedBaseDir: baseDir, caps: { maxLlmCalls: 3 }
    });
    const script = [
      "const {RunStore,BudgetExceededError}=require('./src/artifacts/store.ts');",
      'const store=RunStore.open(process.argv[1]);',
      "try { const r=store.reserveBudget({stage:'extract',kind:'llm',estimatedInputTokens:1,reservedOutputTokens:8}); store.settleBudget(r,2); process.stdout.write('charged'); }",
      "catch(error) { if(error instanceof BudgetExceededError) process.stdout.write('blocked'); else { console.error(error); process.exitCode=1; } }"
    ].join('\n');
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--require', 'tsx/cjs', '-e', script, stores[index % stores.length]!.runDir], {
        cwd: path.resolve(__dirname, '../..'), stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += String(data); });
      child.stderr.on('data', (data) => { stderr += String(data); });
      child.on('error', reject);
      child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
    })));
    expect(results.filter((result) => result === 'charged')).toHaveLength(3);
    expect(results.filter((result) => result === 'blocked')).toHaveLength(5);
    const shared = RunStore.open(stores[0]!.runDir).getBudgetLedgers().find((ledger) => ledger.scope === scope)!;
    expect(shared.usage.llmCalls).toBe(3);
    expect(shared.reservations).toHaveLength(3);
    expect(shared.usage.estimatedOutputTokens).toBe(6);
  }, 15_000);
});

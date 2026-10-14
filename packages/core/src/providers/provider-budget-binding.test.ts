import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { RunStore } from '../artifacts/store';
import { createCachingProvider, type ProviderMode } from './caching-provider';

const temporaryDirs: string[] = [];
const now = () => '2026-10-13T12:00:00.000Z';

function ownedStore(): { baseDir: string; store: RunStore } {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-budget-binding-'));
  temporaryDirs.push(baseDir);
  return { baseDir, store: RunStore.create({ baseDir, runId: 'owned-run', inputId: 'input', parserVersion: '0.1.0', now }) };
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('provider run and budget-store binding', () => {
  test.each(['record', 'auto', 'replay'] as ProviderMode[])('a %s provider rejects a budget store from a different run before transport or writes', (mode) => {
    const { baseDir, store } = ownedStore();
    const otherRun = path.join(baseDir, 'another-run');
    const transport = jest.fn(async () => ({ rawText: '{"answer":"unused"}' }));
    expect(() => createCachingProvider({ runDir: otherRun, budgetStore: store,
      transport, providerId: 'fake', model: 'm', mode, now }))
      .toThrow(/budget store.*run directory.*match/i);
    expect(transport).not.toHaveBeenCalled();
    expect(fs.existsSync(otherRun)).toBe(false);
    expect(store.getBudgetLedgers()[0]!.usage.llmCalls).toBe(0);
  });

  test('two existing runs cannot share a supplied run budget by mistake', () => {
    const { baseDir, store } = ownedStore();
    const other = RunStore.create({ baseDir, runId: 'another-run', inputId: 'another-input', parserVersion: '0.1.0', now });
    expect(() => createCachingProvider({ runDir: other.runDir, budgetStore: store,
      transport: async () => ({ rawText: '{}' }), providerId: 'fake', model: 'm', mode: 'record', now }))
      .toThrow(/budget store.*run directory.*match/i);
    expect(store.getBudgetLedgers()[0]!.usage.llmCalls).toBe(0);
    expect(other.getBudgetLedgers()[0]!.usage.llmCalls).toBe(0);
    expect(fs.existsSync(path.join(other.runDir, 'llm-cache'))).toBe(false);
  });

  test('relative and normalized paths to the same run charge the supplied store', async () => {
    const { store } = ownedStore();
    const runDir = `${path.relative(process.cwd(), store.runDir)}${path.sep}.${path.sep}`;
    const provider = createCachingProvider({ runDir, budgetStore: store,
      transport: async () => ({ rawText: '{"answer":"ok"}' }),
      providerId: 'fake', model: 'm', mode: 'record', outputTokenReserve: 32, now });
    await provider.complete({ stage: 'extract', prompt: 'Answer.', schema: z.object({ answer: z.string() }), schemaName: 'answer' });
    expect(store.getBudgetLedgers()[0]!.usage.llmCalls).toBe(1);
    expect(fs.readdirSync(path.join(store.runDir, 'llm-cache'))).toHaveLength(1);
  });

  test('a filesystem alias resolving to the same run is accepted', () => {
    const { baseDir, store } = ownedStore();
    const alias = path.join(baseDir, 'run-alias');
    fs.symlinkSync(store.runDir, alias, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => createCachingProvider({ runDir: alias, budgetStore: store,
      transport: async () => ({ rawText: '{}' }), providerId: 'fake', model: 'm', mode: 'replay', now }))
      .not.toThrow();
  });

  (process.platform === 'win32' ? test : test.skip)('Windows casing differences identify the same physical run', () => {
    const { store } = ownedStore();
    expect(() => createCachingProvider({ runDir: store.runDir.toUpperCase(), budgetStore: store,
      transport: async () => ({ rawText: '{}' }), providerId: 'fake', model: 'm', mode: 'replay', now }))
      .not.toThrow();
  });
});

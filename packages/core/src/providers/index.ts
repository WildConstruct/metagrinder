export * from './types';
export { createCachingProvider, extractJson, type ProviderMode } from './caching-provider';
export { cacheKeyFor, readCacheEntry, writeCacheEntry, LlmCacheEntrySchema, type LlmCacheEntry } from './cache';
export { anthropicTransport } from './anthropic';
export { codexCliTransport } from './codex-cli';
export { budgetCapsFromEnv, configureProviderBudgets, type ProviderBudgetPolicy } from './budget-policy';

import { createCachingProvider, type ProviderMode } from './caching-provider';
import { anthropicTransport } from './anthropic';
import { codexCliTransport } from './codex-cli';
import type { LlmProvider, Transport } from './types';
import type { RunStore } from '../artifacts/store';
import { configureProviderBudgets, type ProviderBudgetPolicy } from './budget-policy';

/**
 * Builds a provider for a run folder. `kind` selects the transport; `mode`
 * selects record/replay/auto. A replay run needs no transport (pass 'replay'
 * with any kind — the transport is never invoked).
 */
export function buildProvider(opts: {
  runDir: string;
  kind: 'anthropic' | 'codex-cli' | 'custom';
  mode: ProviderMode;
  transport?: Transport;
  providerId?: string;
  model?: string;
  modelVersion?: string;
  budgetStore?: RunStore;
  budgetLedgerIds?: string[];
  outputTokenReserve?: number;
  now?: () => string;
}): LlmProvider {
  let transport: Transport;
  let model: string;
  let providerId: string;

  if (opts.kind === 'anthropic') {
    const t = anthropicTransport(opts.model !== undefined ? { model: opts.model } : undefined);
    transport = t.transport;
    model = t.model;
    providerId = 'anthropic';
  } else if (opts.kind === 'codex-cli') {
    const t = codexCliTransport(opts.model !== undefined ? { model: opts.model } : undefined);
    transport = t.transport;
    model = t.model;
    providerId = 'codex-cli';
  } else {
    if (!opts.transport) throw new Error("buildProvider: kind 'custom' requires a transport");
    transport = opts.transport;
    model = opts.model ?? 'custom';
    providerId = opts.providerId ?? 'custom';
  }
  // In replay mode the transport is never called, so a missing one is fine.
  if (opts.mode === 'replay') {
    transport = async () => { throw new Error('replay mode should not invoke a transport'); };
  }

  return createCachingProvider({
    runDir: opts.runDir,
    transport,
    providerId,
    model,
    ...(opts.modelVersion !== undefined ? { modelVersion: opts.modelVersion } : {}),
    mode: opts.mode,
    ...(opts.budgetStore !== undefined ? { budgetStore: opts.budgetStore } : {}),
    ...(opts.budgetLedgerIds !== undefined ? { budgetLedgerIds: opts.budgetLedgerIds } : {}),
    ...(opts.outputTokenReserve !== undefined ? { outputTokenReserve: opts.outputTokenReserve } : {}),
    ...(opts.now !== undefined ? { now: opts.now } : {})
  });
}

/** Entry-point factory: one configured durable policy for every live command. */
export function buildProviderForRun(opts: Omit<Parameters<typeof buildProvider>[0], 'runDir' | 'budgetStore'>
  & ProviderBudgetPolicy & { store: RunStore }): LlmProvider {
  configureProviderBudgets(opts.store, opts);
  return buildProvider({ ...opts, runDir: opts.store.runDir, budgetStore: opts.store });
}

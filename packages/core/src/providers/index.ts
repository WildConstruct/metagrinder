export * from './types';
export { createCachingProvider, extractJson, type ProviderMode } from './caching-provider';
export { cacheKeyFor, readCacheEntry, writeCacheEntry, LlmCacheEntrySchema, type LlmCacheEntry } from './cache';
export { anthropicTransport } from './anthropic';
export { codexCliTransport } from './codex-cli';

import { createCachingProvider, type ProviderMode } from './caching-provider';
import { anthropicTransport } from './anthropic';
import { codexCliTransport } from './codex-cli';
import type { LlmProvider, Transport } from './types';

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
    ...(opts.now !== undefined ? { now: opts.now } : {})
  });
}

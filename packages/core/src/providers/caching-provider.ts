import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type Transport,
  LlmValidationError,
  ReplayMissError
} from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { cacheKeyFor, readCacheEntry, writeCacheEntry } from './cache';
import type { BudgetReservation, RunStore } from '../artifacts/store';
import { openProviderBudgetStore } from './budget-policy';

export type ProviderMode = 'replay' | 'record' | 'auto';

function sameRunDirectory(providerRunDir: string, budgetRunDir: string): boolean {
  try {
    const providerPath = fs.realpathSync.native(path.resolve(providerRunDir));
    const budgetPath = fs.realpathSync.native(path.resolve(budgetRunDir));
    const providerStat = fs.statSync(providerPath, { bigint: true });
    const budgetStat = fs.statSync(budgetPath, { bigint: true });
    if (!providerStat.isDirectory() || !budgetStat.isDirectory()) return false;
    // Physical identity handles relative paths, Windows casing, junctions and
    // case-sensitive Windows directories without conflating distinct runs.
    if (providerStat.ino !== 0n && budgetStat.ino !== 0n) {
      return providerStat.dev === budgetStat.dev && providerStat.ino === budgetStat.ino;
    }
    return process.platform === 'win32'
      ? providerPath.toLowerCase() === budgetPath.toLowerCase()
      : providerPath === budgetPath;
  } catch {
    return false;
  }
}

/**
 * Wraps any Transport with record/replay caching and schema validation.
 *  - replay: response MUST come from cache (no network); miss -> ReplayMissError.
 *  - record: ignore cache, always call the transport, overwrite the cache.
 *  - auto:   use cache if present, else call the transport and write the cache.
 *
 * Every live response is written to the cache BEFORE parsing, so a failed parse
 * still leaves an inspectable artifact. Validation happens after caching.
 */
export function createCachingProvider(opts: {
  runDir: string;
  transport: Transport;
  providerId: string;
  model: string;
  modelVersion?: string;
  mode: ProviderMode;
  budgetStore?: RunStore;
  budgetLedgerIds?: string[];
  outputTokenReserve?: number;
  now?: () => string;
}): LlmProvider {
  if (opts.budgetStore && !sameRunDirectory(opts.runDir, opts.budgetStore.runDir)) {
    throw new Error('budget store run directory must match the provider run directory');
  }
  const now = opts.now ?? (() => new Date().toISOString());
  let budgetStore = opts.budgetStore;

  return {
    id: opts.providerId,
    model: opts.model,
    mode: opts.mode,
    ...(opts.modelVersion !== undefined ? { modelVersion: opts.modelVersion } : {}),

    async complete<T>(req: LlmRequest<T>): Promise<LlmResult<T>> {
      const outputSchema = zodToJsonSchema(req.schema, { name: req.schemaName, $refStrategy: 'none' });
      const transportPrompt = [
        req.prompt,
        '',
        'OUTPUT JSON SCHEMA (return one JSON object matching this schema exactly):',
        JSON.stringify(outputSchema)
      ].join('\n');
      const cacheKey = cacheKeyFor({
        provider: opts.providerId,
        model: opts.model,
        ...(opts.modelVersion !== undefined ? { modelVersion: opts.modelVersion } : {}),
        stage: req.stage,
        ...(req.system !== undefined ? { system: req.system } : {}),
        prompt: transportPrompt,
        schemaName: req.schemaName
      });
      const cached = opts.mode === 'record' ? undefined : readCacheEntry(opts.runDir, cacheKey);
      let rawText: string;
      let replayed: boolean;

      if (cached) {
        rawText = cached.rawText;
        replayed = true;
      } else {
        if (opts.mode === 'replay') throw new ReplayMissError(cacheKey, req.stage);
        // Logical runners may create their manifest after constructing a provider.
        // Open lazily on the first live miss so their input identity wins.
        budgetStore ??= openProviderBudgetStore(opts.runDir);
        let reservation: BudgetReservation | undefined;
        if (budgetStore) {
          const inputText = `${req.system ?? ''}\n${transportPrompt}`;
          reservation = budgetStore.reserveBudget({
            stage: req.stage,
            kind: req.stage === 'judge' ? 'judge' : 'llm',
            estimatedInputTokens: Math.ceil(inputText.length / 4),
            reservedOutputTokens: opts.outputTokenReserve ?? 4096,
            ...(opts.budgetLedgerIds !== undefined ? { ledgerIds: opts.budgetLedgerIds } : {}),
            now
          });
        }
        let out: Awaited<ReturnType<Transport>>;
        try {
          out = await opts.transport({ stage: req.stage, ...(req.system !== undefined ? { system: req.system } : {}), prompt: transportPrompt, schemaName: req.schemaName });
        } catch (error) {
          // Transport failures can arrive after upstream generation. Retain the
          // durable reservation rather than assuming that no output was charged.
          throw error;
        }
        rawText = out.rawText;
        replayed = false;
        writeCacheEntry(opts.runDir, {
          cacheKey,
          stage: req.stage,
          schemaName: req.schemaName,
          provider: opts.providerId,
          model: opts.model,
          ...(opts.modelVersion !== undefined ? { modelVersion: opts.modelVersion } : {}),
          ...(req.system !== undefined ? { system: req.system } : {}),
          prompt: transportPrompt,
          rawText,
          createdAt: now()
        });
        if (reservation && budgetStore) {
          budgetStore.settleBudget(reservation, Math.ceil(rawText.length / 4), now);
        }
      }

      const parsed = req.schema.safeParse(extractJson(rawText));
      if (!parsed.success) throw new LlmValidationError(req.stage, parsed.error.message, rawText);

      return {
        data: parsed.data,
        raw: rawText,
        cacheKey,
        provider: opts.providerId,
        model: opts.model,
        ...(opts.modelVersion !== undefined ? { modelVersion: opts.modelVersion } : {}),
        replayed
      };
    }
  };
}

/** Tolerates responses wrapped in prose or ```json fences. */
export function extractJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('no JSON object found in response');
  }
}

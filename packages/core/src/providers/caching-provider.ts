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

export type ProviderMode = 'replay' | 'record' | 'auto';

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
  now?: () => string;
}): LlmProvider {
  const now = opts.now ?? (() => new Date().toISOString());

  return {
    id: opts.providerId,
    model: opts.model,
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
        const out = await opts.transport({ stage: req.stage, ...(req.system !== undefined ? { system: req.system } : {}), prompt: transportPrompt, schemaName: req.schemaName });
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

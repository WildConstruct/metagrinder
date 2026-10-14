import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { sha256Hex } from '../artifacts/ids';

/**
 * LLM response cache: provider I/O persisted under <runDir>/llm-cache/. This is
 * replay-mode's source of truth and is deliberately NOT a package-manifest
 * artifact family (provider I/O is cache, not a collection — see COLLAPSE-MAP).
 */

export const LlmCacheEntrySchema = z.object({
  cacheKey: z.string(),
  stage: z.string(),
  schemaName: z.string(),
  provider: z.string(),
  model: z.string(),
  modelVersion: z.string().optional(),
  system: z.string().optional(),
  prompt: z.string(),
  rawText: z.string(),
  createdAt: z.string()
});
export type LlmCacheEntry = z.infer<typeof LlmCacheEntrySchema>;

const CACHE_DIR = 'llm-cache';

export function cacheKeyFor(args: {
  provider: string;
  model: string;
  modelVersion?: string;
  stage: string;
  system?: string;
  prompt: string;
  schemaName: string;
}): string {
  return sha256Hex(JSON.stringify([
    args.provider,
    args.model,
    args.modelVersion ?? '',
    args.stage,
    args.system ?? '',
    args.prompt,
    args.schemaName
  ])).slice(0, 32);
}

function cachePath(runDir: string, cacheKey: string): string {
  return path.join(runDir, CACHE_DIR, `${cacheKey}.json`);
}

export function readCacheEntry(runDir: string, cacheKey: string): LlmCacheEntry | undefined {
  const p = cachePath(runDir, cacheKey);
  if (!fs.existsSync(p)) return undefined;
  const entry = LlmCacheEntrySchema.parse(JSON.parse(fs.readFileSync(p, 'utf8')));
  const persistedKey = cacheKeyFor({
    provider: entry.provider,
    model: entry.model,
    ...(entry.modelVersion !== undefined ? { modelVersion: entry.modelVersion } : {}),
    stage: entry.stage,
    ...(entry.system !== undefined ? { system: entry.system } : {}),
    prompt: entry.prompt,
    schemaName: entry.schemaName
  });
  if (entry.cacheKey !== cacheKey || persistedKey !== cacheKey) {
    throw new Error(`llm cache identity mismatch for requested key ${cacheKey}`);
  }
  return entry;
}

export function writeCacheEntry(runDir: string, entry: LlmCacheEntry): void {
  const p = cachePath(runDir, entry.cacheKey);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(LlmCacheEntrySchema.parse(entry), null, 2)}\n`, 'utf8');
}

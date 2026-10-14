import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cacheKeyFor, readCacheEntry, writeCacheEntry, type LlmCacheEntry } from './cache';

const temporaryDirs: string[] = [];
const metadata = {
  provider: 'test-provider', model: 'test-model', modelVersion: 'v1',
  stage: 'extract', system: 'system', prompt: 'prompt with schema', schemaName: 'test-schema'
};

function recordedEntry(): { runDir: string; entry: LlmCacheEntry; filePath: string } {
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-cache-integrity-'));
  temporaryDirs.push(runDir);
  const entry = { ...metadata, cacheKey: cacheKeyFor(metadata), rawText: '{"value":"original"}', createdAt: '2026-10-13T12:00:00.000Z' };
  writeCacheEntry(runDir, entry);
  return { runDir, entry, filePath: path.join(runDir, 'llm-cache', `${entry.cacheKey}.json`) };
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('persisted cache identity', () => {
  test('an unchanged pinned cache identity can be replayed', () => {
    const { runDir, entry } = recordedEntry();
    expect(readCacheEntry(runDir, entry.cacheKey)).toEqual(entry);
  });

  test('a copied cache record cannot be attributed to the requested key', () => {
    const { runDir, entry, filePath } = recordedEntry();
    const copied = { ...entry, model: 'another-model' };
    copied.cacheKey = cacheKeyFor(copied);
    fs.writeFileSync(filePath, JSON.stringify(copied), 'utf8');
    expect(() => readCacheEntry(runDir, entry.cacheKey)).toThrow(/cache identity mismatch/i);
  });

  test.each(['provider', 'model', 'modelVersion', 'stage', 'system', 'prompt', 'schemaName'] as const)(
    'valid-shaped corruption of %s is rejected even with the requested key retained', (field) => {
      const { runDir, entry, filePath } = recordedEntry();
      fs.writeFileSync(filePath, JSON.stringify({ ...entry, [field]: 'changed-metadata' }), 'utf8');
      expect(() => readCacheEntry(runDir, entry.cacheKey)).toThrow(/cache identity mismatch/i);
    }
  );
});

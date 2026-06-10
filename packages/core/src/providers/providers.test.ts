import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { RunStore } from '../artifacts/store';
import {
  LlmValidationError,
  ReplayMissError,
  buildProvider,
  createCachingProvider,
  extractJson,
  readCacheEntry,
  type LlmRequest,
  type Transport
} from './index';

const NOW = () => '2026-06-10T12:00:00.000Z';
const Schema = z.object({ label: z.string(), weight: z.number() });
const req = (over: Partial<LlmRequest<z.infer<typeof Schema>>> = {}): LlmRequest<z.infer<typeof Schema>> => ({
  stage: 'extract', prompt: 'classify this', schema: Schema, schemaName: 'thing', ...over
});

function tmpRun(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-prov-'));
  return dir;
}

describe('caching provider (S3.1)', () => {
  test('[AC-3.1a] a recorded run replays to identical data without the transport', async () => {
    const runDir = tmpRun();
    let calls = 0;
    const transport: Transport = async () => { calls++; return { rawText: '{"label":"a","weight":3}' }; };

    const recorder = createCachingProvider({ runDir, transport, providerId: 'fake', model: 'm', mode: 'record', now: NOW });
    const live = await recorder.complete(req());
    expect(live.replayed).toBe(false);
    expect(calls).toBe(1);

    // replay: transport must never be called
    const failTransport: Transport = async () => { throw new Error('should not call transport in replay'); };
    const replayer = createCachingProvider({ runDir, transport: failTransport, providerId: 'fake', model: 'm', mode: 'replay', now: NOW });
    const replayed = await replayer.complete(req());
    expect(replayed.replayed).toBe(true);
    expect(replayed.data).toEqual(live.data);
    expect(calls).toBe(1); // unchanged
  });

  test('every live response is cached before parsing (inspectable on parse failure)', async () => {
    const runDir = tmpRun();
    const transport: Transport = async () => ({ rawText: '{"label":"a"}' }); // missing weight -> invalid
    const provider = createCachingProvider({ runDir, transport, providerId: 'fake', model: 'm', mode: 'auto', now: NOW });
    await expect(provider.complete(req())).rejects.toBeInstanceOf(LlmValidationError);
    // the raw response was still cached
    const files = fs.readdirSync(path.join(runDir, 'llm-cache'));
    expect(files).toHaveLength(1);
  });

  test('replay miss throws rather than calling the network', async () => {
    const runDir = tmpRun();
    const provider = buildProvider({ runDir, kind: 'anthropic', mode: 'replay', now: NOW });
    await expect(provider.complete(req())).rejects.toBeInstanceOf(ReplayMissError);
  });

  test('auto mode reuses cache on the second call', async () => {
    const runDir = tmpRun();
    let calls = 0;
    const transport: Transport = async () => { calls++; return { rawText: '{"label":"a","weight":1}' }; };
    const provider = createCachingProvider({ runDir, transport, providerId: 'fake', model: 'm', mode: 'auto', now: NOW });
    await provider.complete(req());
    await provider.complete(req());
    expect(calls).toBe(1);
  });

  test('cache key separates stages and prompts', async () => {
    const runDir = tmpRun();
    const transport: Transport = async ({ stage }) => ({ rawText: `{"label":"${stage}","weight":1}` });
    const provider = createCachingProvider({ runDir, transport, providerId: 'fake', model: 'm', mode: 'auto', now: NOW });
    const a = await provider.complete(req({ stage: 'extract' }));
    const b = await provider.complete(req({ stage: 'grammar' }));
    expect(a.cacheKey).not.toBe(b.cacheKey);
    expect(a.data.label).toBe('extract');
    expect(b.data.label).toBe('grammar');
  });

  test('[AC-3.1b] model is recorded per stage in the run manifest', async () => {
    const baseDir = tmpRun();
    const store = RunStore.create({ baseDir, runId: 'run_p', inputId: 'i', parserVersion: '0.1.0', now: NOW });
    const transport: Transport = async () => ({ rawText: '{"label":"a","weight":1}' });
    const provider = createCachingProvider({ runDir: store.runDir, transport, providerId: 'fake', model: 'gpt-5.2', modelVersion: '2026-05', mode: 'record', now: NOW });

    const result = await provider.complete(req({ stage: 'extract' }));
    store.recordModel('extract', result.provider, result.model, result.modelVersion);

    const models = RunStore.open(store.runDir).getManifest().models;
    expect(models).toEqual([{ stage: 'extract', providerId: 'fake', modelId: 'gpt-5.2', modelVersion: '2026-05' }]);
  });

  test('extractJson tolerates fences and surrounding prose', () => {
    expect(extractJson('```json\n{"label":"a","weight":2}\n```')).toEqual({ label: 'a', weight: 2 });
    expect(extractJson('Here you go: {"label":"a","weight":2} hope that helps')).toEqual({ label: 'a', weight: 2 });
  });

  test('replayed cache entry carries provider/model provenance', async () => {
    const runDir = tmpRun();
    const transport: Transport = async () => ({ rawText: '{"label":"a","weight":1}' });
    const provider = createCachingProvider({ runDir, transport, providerId: 'fake', model: 'm', modelVersion: 'v1', mode: 'record', now: NOW });
    const r = await provider.complete(req());
    const entry = readCacheEntry(runDir, r.cacheKey)!;
    expect(entry.provider).toBe('fake');
    expect(entry.model).toBe('m');
    expect(entry.modelVersion).toBe('v1');
  });
});

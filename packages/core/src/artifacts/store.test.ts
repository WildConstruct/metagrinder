import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { deriveChunkIds, deriveEvidenceId, deriveSourceInputId, normalizeForId } from './ids';
import { ArtifactValidationError, RunStore } from './store';

const NOW = () => '2026-06-10T12:00:00.000Z';

const RAW_TEXT = 'Spectators lined the rail.\n\nMost wore straw boaters.';

function tmpBase(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-store-'));
}

function validSourcePackage(runId: string) {
  const sourceInputId = deriveSourceInputId(RAW_TEXT);
  const texts = ['Spectators lined the rail.', 'Most wore straw boaters.'];
  const [c1, c2] = deriveChunkIds(sourceInputId, texts);
  return {
    artifact: 'source-package',
    runId,
    inputId: 'input_test',
    createdAt: NOW(),
    title: 'Rail spectators',
    sourceInputs: [{ sourceInputId, title: 'note', sequence: 0 }],
    chunks: [
      { chunkId: c1!, sourceInputId, text: texts[0]!, span: { start: 0, end: 26 }, sequence: 0 },
      { chunkId: c2!, sourceInputId, text: texts[1]!, span: { start: 28, end: 52 }, sequence: 1 }
    ]
  };
}

describe('content-derived ids', () => {
  test('[AC-1.4a] same input text yields identical ids across two derivations', () => {
    const a = deriveSourceInputId(RAW_TEXT);
    const b = deriveSourceInputId(RAW_TEXT);
    expect(a).toBe(b);

    const texts = ['Spectators lined the rail.', 'Most wore straw boaters.'];
    expect(deriveChunkIds(a, texts)).toEqual(deriveChunkIds(b, texts));
    expect(deriveEvidenceId('chunk_x', 'straw boaters')).toBe(
      deriveEvidenceId('chunk_x', 'straw  boaters ')
    );
  });

  test('[AC-1.4a] cosmetic whitespace changes do not change identity', () => {
    expect(deriveSourceInputId('a  b\n c')).toBe(deriveSourceInputId('a b c'));
    expect(normalizeForId('  a\t b ')).toBe('a b');
  });

  test('identical repeated chunk texts get distinct ids by occurrence', () => {
    const ids = deriveChunkIds('src_1', ['same text', 'same text']);
    expect(ids[0]).not.toBe(ids[1]);
    expect(deriveChunkIds('src_1', ['same text', 'same text'])).toEqual(ids);
  });

  test('different source inputs give different chunk ids for same text', () => {
    expect(deriveChunkIds('src_1', ['x'])[0]).not.toBe(deriveChunkIds('src_2', ['x'])[0]);
  });
});

describe('RunStore', () => {
  test('[AC-1.4c] invalid artifact never touches disk', () => {
    const store = RunStore.create({
      baseDir: tmpBase(), runId: 'run_1', inputId: 'input_test', parserVersion: '0.1.0', now: NOW
    });
    expect(() =>
      store.writeArtifact('source-package', 'source-package.json', { artifact: 'source-package' }, NOW)
    ).toThrow(ArtifactValidationError);
    expect(fs.existsSync(path.join(store.runDir, 'source-package.json'))).toBe(false);
    expect(store.getManifest().artifacts).toHaveLength(0);

    expect(() => store.writeArtifact('no-such-family', 'x.json', {}, NOW)).toThrow(/unknown artifact family/);
  });

  test('valid artifact round-trips with content hash recorded', () => {
    const store = RunStore.create({
      baseDir: tmpBase(), runId: 'run_2', inputId: 'input_test', parserVersion: '0.1.0', now: NOW
    });
    store.writeArtifact('source-package', 'source-package.json', validSourcePackage('run_2'), NOW);

    const manifest = store.getManifest();
    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.artifacts[0]!.contentSha256).toMatch(/^[0-9a-f]{64}$/);

    const readBack = store.readArtifact<{ chunks: unknown[] }>('source-package', 'source-package.json');
    expect(readBack.chunks).toHaveLength(2);
  });

  test('read re-validates: tampered file fails loudly', () => {
    const store = RunStore.create({
      baseDir: tmpBase(), runId: 'run_3', inputId: 'input_test', parserVersion: '0.1.0', now: NOW
    });
    const filePath = store.writeArtifact(
      'source-package', 'source-package.json', validSourcePackage('run_3'), NOW
    );
    const tampered = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    tampered.chunks = [];
    fs.writeFileSync(filePath, JSON.stringify(tampered), 'utf8');
    expect(() => store.readArtifact('source-package', 'source-package.json')).toThrow(ArtifactValidationError);
  });

  test('[AC-1.4b] stage states survive restart via open()', () => {
    const baseDir = tmpBase();
    const store = RunStore.create({
      baseDir, runId: 'run_4', inputId: 'input_test', parserVersion: '0.1.0', now: NOW
    });
    store.setStageState('ingest', 'complete', { outputArtifacts: ['source-package.json'] }, NOW);
    store.setStageState('extract', 'blocked_on_gate', { gate: 'source-intake-approval' }, NOW);

    const resumed = RunStore.open(path.join(baseDir, 'run_4'));
    expect(resumed.getStageState('ingest')).toBe('complete');
    expect(resumed.getStageState('extract')).toBe('blocked_on_gate');
    expect(resumed.getStageState('grammar')).toBe('pending');
    expect(resumed.nextRunnableStages(['ingest', 'extract', 'grammar'])).toEqual(['grammar']);

    const stages = resumed.getManifest().stages;
    expect(stages.find((s) => s.stage === 'extract')!.gate).toBe('source-intake-approval');
  });

  test('create refuses to clobber an existing run folder', () => {
    const baseDir = tmpBase();
    RunStore.create({ baseDir, runId: 'run_5', inputId: 'i', parserVersion: '0.1.0', now: NOW });
    expect(() =>
      RunStore.create({ baseDir, runId: 'run_5', inputId: 'i', parserVersion: '0.1.0', now: NOW })
    ).toThrow(/already has a manifest/);
  });

  test('model registry records provider per stage, replacing on change', () => {
    const store = RunStore.create({
      baseDir: tmpBase(), runId: 'run_6', inputId: 'i', parserVersion: '0.1.0', now: NOW
    });
    store.recordModel('extract', 'codex-cli', 'gpt-5.2');
    store.recordModel('extract', 'anthropic', 'claude-opus-4-8');
    const models = store.getManifest().models;
    expect(models).toHaveLength(1);
    expect(models[0]!.providerId).toBe('anthropic');
  });
});

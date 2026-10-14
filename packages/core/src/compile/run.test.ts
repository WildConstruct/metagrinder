import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import { stageInputSignature } from '../artifacts/resume';
import { SceneGrammarSchema, ResearchPackageManifestSchema, type SceneGrammar } from '../schemas';
import type { PsgArtifact } from '../schemas/psg';
import { sealPackageManifest } from '../stages/handoff';
import { historicalCrowdGrammar } from './__fixtures__/historical-crowd-grammar';
import { compileRunPsgs, PSG_COMPILER_VERSION } from './run';

const NOW = () => '2026-10-14T12:00:00.000Z';

describe('S2.2c compiled run persistence', () => {
  let root: string;
  let store: RunStore;
  let base: SceneGrammar;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-compile-run-'));
    store = RunStore.create({ baseDir: root, runId: 'run_compile', inputId: 'scene', parserVersion: '0.1.0', now: NOW });
    base = SceneGrammarSchema.parse({ ...historicalCrowdGrammar(NOW()), runId: 'run_compile', inputId: 'scene' });
    store.writeArtifact('scene-grammar', 'scene-grammar.json', base, NOW);
  });
  afterEach(() => {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('compile test cleanup escaped temp root');
    fs.rmSync(root, { recursive: true, force: true });
  });
  const accepted = () => {
    const grammar = SceneGrammarSchema.parse({ ...base, grammarTarget: 'accepted', reviewFlags: ['requires-human-review'] });
    grammar.archetypes[0]!.weightRange!.min = 1;
    grammar.archetypes[0]!.weightRange!.max = 2;
    store.writeArtifact('accepted-scene-grammar', 'accepted-scene-grammar.json', grammar, NOW);
    return grammar;
  };

  test('[AC-2.2c.1] base-only compile persists native graphs with current-source bindings, without inventing accepted output', async () => {
    const result = await compileRunPsgs({ store, now: NOW });
    expect(result.comparisonStatus).toBe('base-only');
    expect(result.outputPaths).toHaveLength(7);
    expect(result.diff).toBeUndefined();
    expect(store.getStageState('compile')).toBe('complete');
    const sourceHash = store.getManifest().artifacts.find((entry) => entry.path === 'scene-grammar.json')!.contentSha256;
    for (const file of result.outputPaths) {
      const graph = store.readArtifact<any>('psg', file);
      expect(graph.version).toBe('1.0.0');
      expect(graph.artifact).toBeUndefined();
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.metadata.metagrinder).toMatchObject({ runId: 'run_compile', inputId: 'scene', grammarTarget: 'base',
        compilerVersion: PSG_COMPILER_VERSION, sourceGrammar: { family: 'scene-grammar', path: 'scene-grammar.json', contentSha256: sourceHash } });
    }
    expect(store.getManifest().artifacts.some((entry) => entry.family === 'psg-compile-diff')).toBe(false);
  });

  test('[AC-2.2c.2] supplied accepted grammar produces a hash-bound structural diff and preserves review flags', async () => {
    accepted();
    const result = await compileRunPsgs({ store, now: NOW });
    expect(result.comparisonStatus).toBe('compared');
    expect(result.diff?.materialDifference).toBe(true);
    const report = store.readArtifact<any>('psg-compile-diff', 'psg-compile-diff.json');
    expect(report.comparisonScope).toBe('compiled-structure-only');
    expect(report.baseGraphs).toHaveLength(7);
    expect(report.acceptedGraphs).toHaveLength(7);
    for (const graph of report.acceptedGraphs) {
      const artifact = store.readArtifact<any>('psg', graph.path);
      expect(artifact.metadata.metagrinder.reviewFlags).toEqual(['requires-human-review']);
      expect(graph.contentSha256).toBe(store.getManifest().artifacts.find((entry) => entry.path === graph.path)!.contentSha256);
    }
  });

  test('[AC-2.2c.4] reopen/resume preserves bytes and timestamps; a source change rebuilds without provider calls', async () => {
    const first = await compileRunPsgs({ store, now: NOW });
    expect(first.outputPaths.length).toBeGreaterThan(0);
    const records = store.getManifest().artifacts.filter((entry) => entry.family === 'psg');
    const resumed = RunStore.open(store.runDir);
    await compileRunPsgs({ store: resumed, now: () => '2026-10-14T13:00:00.000Z' });
    expect(resumed.getManifest().artifacts.filter((entry) => entry.family === 'psg')).toEqual(records);
    base.archetypes[0]!.label = 'Changed emitted label';
    resumed.writeArtifact('scene-grammar', 'scene-grammar.json', base, NOW);
    await compileRunPsgs({ store: resumed, now: () => '2026-10-14T14:00:00.000Z' });
    expect(resumed.getManifest().artifacts.filter((entry) => entry.family === 'psg')).not.toEqual(records);
    expect(resumed.getBudgetLedgers()[0]!.usage.llmCalls).toBe(0);
  });

  test('[AC-2.2c.4] completed output tampering fails closed rather than being overwritten on resume', async () => {
    const result = await compileRunPsgs({ store, now: NOW });
    expect(result.outputPaths.length).toBeGreaterThan(0);
    const file = path.join(store.runDir, result.outputPaths[0]!);
    const graph = JSON.parse(fs.readFileSync(file, 'utf8'));
    graph.nodes[0].value = 'Tampered but schema-valid';
    fs.writeFileSync(file, JSON.stringify(graph));
    await expect(compileRunPsgs({ store, now: NOW })).rejects.toThrow(/hash mismatch/);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).nodes[0].value).toBe('Tampered but schema-valid');
  });

  test('[AC-2.2c.4] removed branches remain prior checkpoints but leave the new completed stage output set', async () => {
    const first = await compileRunPsgs({ store, now: NOW });
    const removedPath = 'psg/base/scene-grandstand-branch.psg';
    expect(first.outputPaths).toContain(removedPath);
    const prior = store.readArtifact<PsgArtifact>('psg', removedPath);
    base.locationZones = base.locationZones.filter((zone) => zone.zoneId !== 'grandstand');
    store.writeArtifact('scene-grammar', 'scene-grammar.json', base, NOW);
    const current = await compileRunPsgs({ store, now: NOW });
    expect(current.outputPaths).not.toContain(removedPath);
    const stage = store.getManifest().stages.find((entry) => entry.stage === 'compile')!;
    expect(stage.state).toBe('complete');
    expect([...stage.outputArtifacts].sort()).toEqual([...current.outputPaths].sort());
    expect(fs.existsSync(path.join(store.runDir, removedPath))).toBe(true);
    expect(store.readArtifact<PsgArtifact>('psg', removedPath)).toEqual(prior);
  });

  test('[AC-2.2c.4] resume rejects a base output replaced while loading accepted outputs', async () => {
    accepted();
    const first = await compileRunPsgs({ store, now: NOW });
    const basePath = first.outputPaths.find((file) => file.startsWith('psg/base/'))!;
    const acceptedCount = first.outputPaths.filter((file) => file.startsWith('psg/accepted/')).length;
    const originalRead = store.readArtifact.bind(store);
    let acceptedReads = 0;
    let replaced = false;
    const read = jest.spyOn(store, 'readArtifact').mockImplementation((family, file) => {
      const value = originalRead(family, file);
      // The first pass is generic resume validation. Replace the already-read
      // base PSG during the second pass's accepted-graph snapshot.
      if (family === 'psg' && file.startsWith('psg/accepted/') && ++acceptedReads === acceptedCount + 1) {
        const graph = originalRead('psg', basePath) as PsgArtifact;
        graph.nodes[0]!.value = `${graph.nodes[0]!.value ?? ''} replaced during output load`;
        store.writeArtifact('psg', basePath, graph, NOW);
        replaced = true;
      }
      return value;
    });
    try {
      await expect(compileRunPsgs({ store, now: NOW })).rejects.toThrow(/output.*snapshot|snapshot.*output/i);
      expect(replaced).toBe(true);
      expect(store.getStageState('compile')).toBe('failed');
    } finally {
      read.mockRestore();
    }
  });

  test('[AC-2.2c.4] manifest-valid foreign native metadata cannot be reused', async () => {
    const result = await compileRunPsgs({ store, now: NOW });
    expect(result.outputPaths.length).toBeGreaterThan(0);
    const graph = store.readArtifact<any>('psg', result.outputPaths[0]!);
    graph.metadata.metagrinder.runId = 'foreign-run';
    store.writeArtifact('psg', result.outputPaths[0]!, graph, NOW);
    await expect(compileRunPsgs({ store, now: NOW })).rejects.toThrow(/binding|identity/);
  });

  test('[AC-2.2c.4] manifest-valid graph content must still match the declared deterministic compiler inputs', async () => {
    const result = await compileRunPsgs({ store, now: NOW });
    const file = result.outputPaths[0]!;
    const graph = store.readArtifact<PsgArtifact>('psg', file);
    graph.nodes[0]!.value = 'A different generated scene';
    store.writeArtifact('psg', file, graph, NOW);
    await expect(compileRunPsgs({ store, now: NOW })).rejects.toThrow(/compiled.*content mismatch/);
  });

  test('[AC-2.2c.4] an older compiler signature rebuilds bindings and explicit rerun replaces deterministic bytes', async () => {
    const first = await compileRunPsgs({ store, now: NOW });
    const source = store.getManifest().artifacts.find((entry) => entry.path === 'scene-grammar.json')!;
    const oldSignature = stageInputSignature({ compilerVersion: 'previous-compiler', runId: 'run_compile', inputId: 'scene',
      base: { family: 'scene-grammar', path: 'scene-grammar.json', contentSha256: source.contentSha256 } });
    const graph = store.readArtifact<PsgArtifact>('psg', first.outputPaths[0]!);
    graph.metadata.metagrinder.compilerVersion = 'previous-compiler';
    store.writeArtifact('psg', first.outputPaths[0]!, graph, NOW);
    store.setStageState('compile', 'complete', { inputSignature: oldSignature });
    await compileRunPsgs({ store, now: () => '2026-10-14T13:00:00.000Z' });
    expect(store.readArtifact<PsgArtifact>('psg', first.outputPaths[0]!).metadata.metagrinder.compilerVersion)
      .toBe(PSG_COMPILER_VERSION);
    const beforeRerun = store.getManifest().artifacts.filter((entry) => entry.family === 'psg');
    await compileRunPsgs({ store, forceRerun: true, now: () => '2026-10-14T14:00:00.000Z' });
    expect(store.getManifest().artifacts.filter((entry) => entry.family === 'psg')).not.toEqual(beforeRerun);
    expect(store.getManifest().stages.find((entry) => entry.stage === 'compile')!.inputSignature).not.toBe(oldSignature);
    expect(store.getBudgetLedgers()[0]!.usage.llmCalls).toBe(0);
  });

  test.each(['wrong-run', 'wrong-input', 'wrong-target'] as const)('[AC-2.2c.3] rejects %s grammar before publishing outputs', async (kind) => {
    store.writeArtifact('scene-grammar', 'scene-grammar.json', { ...base,
      ...(kind === 'wrong-run' ? { runId: 'foreign-run' } : {}),
      ...(kind === 'wrong-input' ? { inputId: 'foreign-input' } : {}),
      ...(kind === 'wrong-target' ? { grammarTarget: 'accepted' } : {}) }, NOW);
    await expect(compileRunPsgs({ store, now: NOW })).rejects.toThrow(/identity|target/);
    expect(store.getManifest().artifacts.filter((entry) => entry.family === 'psg')).toEqual([]);
  });

  test('[AC-2.2c.3] a changed source snapshot cannot bind old grammar content to a new hash', async () => {
    const read = store.readArtifact.bind(store);
    let changed = false;
    jest.spyOn(store, 'readArtifact').mockImplementation((family, file) => {
      const value = read(family, file);
      if (!changed && family === 'scene-grammar') {
        changed = true;
        store.writeArtifact('scene-grammar', 'scene-grammar.json', { ...base, uncertainties: ['changed during read'] }, NOW);
      }
      return value;
    });
    await expect(compileRunPsgs({ store, now: NOW })).rejects.toThrow(/source.*changed|changed.*source/);
    expect(store.getManifest().artifacts.filter((entry) => entry.family === 'psg')).toEqual([]);
  });

  test('[AC-2.2c.5] package sealing consumes registered native PSG and diff bytes', async () => {
    accepted();
    const result = await compileRunPsgs({ store, now: NOW });
    expect(result.outputPaths.length).toBeGreaterThan(0);
    const manifest = ResearchPackageManifestSchema.parse({ artifact: 'research-package', packageId: 'compile-package',
      runId: 'run_compile', inputId: 'scene', createdAt: NOW(), title: 'Compiled scene', parserVersion: '0.1.0',
      collections: result.outputPaths.map((file, index) => ({ id: `compiled-${index}`,
        family: file.endsWith('.psg') ? 'psg' : 'psg-compile-diff', path: file })) });
    const sealed = sealPackageManifest(store, manifest);
    expect(sealed.collections.every((entry) => /^[a-f0-9]{64}$/.test(entry.contentSha256!))).toBe(true);
  });
});

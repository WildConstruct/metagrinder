import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RunStore } from './artifacts/store';
import { ingestText } from './stages/ingest';
import { compileRunPsgs } from './compile/run';
import { PsgFileSchema } from './compile/psg';
import { historicalCrowdGrammar } from './compile/__fixtures__/historical-crowd-grammar';
import { sampleContentPlans } from './stages/sample';

const NOW = () => '2026-06-10T12:00:00.000Z';

/**
 * Phase 2 exit gate: the deterministic spine runs end-to-end through the new
 * store — ingest -> (placeholder) grammar -> PSG compile -> content-plan
 * sampling — with the run manifest recording resumable stage state.
 */
describe('Phase 2 deterministic spine end-to-end', () => {
  test('ingest -> grammar -> compile -> sample through RunStore, resumable', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-phase2-'));
    const runId = 'run_phase2';
    const store = RunStore.create({ baseDir, runId, inputId: 'broadway', parserVersion: '0.1.0', now: NOW });

    // ingest
    store.setStageState('ingest', 'running', undefined, NOW);
    const broadway = fs.readFileSync(path.resolve(__dirname, 'eval/corpus/briefs/broadway.txt'), 'utf8');
    const sourcePackage = ingestText({ runId, inputId: 'broadway', title: 'broadway', createdAt: NOW(), sources: [{ rawText: broadway }] });
    store.writeArtifact('source-package', 'source-package.json', sourcePackage, NOW);
    store.setStageState('ingest', 'complete', { outputArtifacts: ['source-package.json'] }, NOW);

    // grammar (placeholder until S3.3 — coherent crowd grammar stands in)
    const grammar = { ...historicalCrowdGrammar(NOW()), runId, inputId: 'broadway' };
    store.writeArtifact('scene-grammar', 'scene-grammar.json', grammar, NOW);
    store.setStageState('grammar', 'complete', { outputArtifacts: ['scene-grammar.json'] }, NOW);

    // Native PSG compilation is now a stored, input-signed stage (S2.2c).
    const compiled = await compileRunPsgs({ store, now: NOW });
    const basePsg = store.readArtifact('psg', 'psg/base/scene-global-baseline.psg');
    expect(() => PsgFileSchema.parse(basePsg)).not.toThrow();
    expect(compiled.outputPaths).toHaveLength(7);

    // content-plan sampling
    const plans = sampleContentPlans({ grammar, seed: 42, count: 12, runId, inputId: 'broadway', now: NOW() });
    store.writeArtifact('content-plans', 'content-plans.json', plans, NOW);
    store.setStageState('sample', 'complete', { outputArtifacts: ['content-plans.json'] }, NOW);

    // resume from disk: manifest and artifacts survive
    const resumed = RunStore.open(path.join(baseDir, runId));
    for (const stage of ['ingest', 'grammar', 'compile', 'sample']) {
      expect(resumed.getStageState(stage)).toBe('complete');
    }
    expect(resumed.nextRunnableStages(['ingest', 'grammar', 'compile', 'sample'])).toEqual([]);

    const readPlans = resumed.readArtifact<typeof plans>('content-plans', 'content-plans.json');
    expect(readPlans.plans).toHaveLength(12);
    const readSource = resumed.readArtifact<typeof sourcePackage>('source-package', 'source-package.json');
    expect(readSource.chunks.length).toBeGreaterThan(0);

    const manifest = resumed.getManifest();
    expect(manifest.artifacts.map((a) => a.path).sort()).toEqual(
      ['content-plans.json', 'scene-grammar.json', 'source-package.json', ...compiled.outputPaths].sort());
    expect(manifest.artifacts.every((a) => /^[0-9a-f]{64}$/.test(a.contentSha256))).toBe(true);
  });
});

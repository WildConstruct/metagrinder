import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BudgetExceededError, RunStore } from '../artifacts/store';
import { createCachingProvider, type Transport } from '../providers';
import type { Corpus } from './corpus';
import { loadCorpus } from './corpus';
import { runCorpusPipeline } from './run-corpus';
import { evaluateRun } from './run';
import type { ContentPlans, SceneGrammar } from '../schemas';
import { runHoldout } from './run-holdout';
import { scoreExtractionRun } from './scorer';

const NOW = '2026-07-12T12:00:00.000Z';
const TEXT = 'Broadway theater audience wardrobe included wool coats and hats.';

function oneBriefCorpus(): Corpus {
  const loaded = loadCorpus();
  return {
    ...loaded,
    briefs: [{ ...loaded.briefs[0]!, text: TEXT, briefPath: 'in-memory:broadway' }]
  };
}

function responseFor(req: Parameters<Transport>[0]): string {
  const chunkId = req.prompt.match(/^\[([^\]]+)\]/m)?.[1];
  if (!chunkId) throw new Error(`prompt did not contain a chunk id for ${req.stage}`);
  const sourceInputId = req.stage === 'grammar'
    ? req.prompt.match(/sourceInputId: ([^\s)]+)/)?.[1]
    : 'input_broadway';
  if (!sourceInputId) throw new Error(`prompt did not contain the chunk's source input for ${req.stage}`);
  const provenance = {
    sourceInputIds: [sourceInputId],
    sourceChunkIds: [chunkId],
    spans: [],
    attributionMode: 'quoted',
    evidenceBasis: 'text_supported',
    confidence: 'high',
    verification: 'unverified'
  };
  if (req.stage === 'extract') {
    return JSON.stringify({
      detectedResearchKind: 'historical-scene-research',
      categories: [
        { category: 'wardrobe', rationale: 'Broadway theater audience wardrobe' },
        { category: 'people-and-crowd', rationale: 'Broadway audience crowd' }
      ],
      claims: [{ claimId: 'claim_1', text: TEXT, category: 'wardrobe', confidence: 'high', provenance }],
      concepts: [],
      evidence: [],
      uncertaintySpans: [],
      openQuestions: []
    });
  }
  if (req.stage === 'grammar') {
    return JSON.stringify({
      sceneContext: {
        contextId: 'context_1', title: 'Broadway audience', researchKind: 'historical-scene-research',
        summary: 'Theater audience wardrobe scene.', provenance
      },
      archetypes: [{
        archetypeId: 'audience_member', label: 'Audience member', summary: 'Theater audience member',
        role: 'spectator', weightRange: { label: 'Audience member', min: 80, max: 100 },
        promptText: 'Broadway theater audience member in wool coat and hat', confidence: 'high', provenance
      }]
    });
  }
  throw new Error(`unexpected stage: ${req.stage}`);
}

describe('S3.5 rebuilt corpus record/replay runner', () => {
  test('[S-R3d] downstream diagnostics inspect every run and recheck stored realization gates', async () => {
    const base = oneBriefCorpus();
    const first = base.briefs[0]!;
    const corpus = { ...base, briefs: [first, { ...first, id: 'second-brief',
      judgment: { ...first.judgment, id: 'second-brief' } }] };
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-pipeline-diagnostics-'));
    let mode: 'record' | 'replay' = 'record';
    const options = { corpus, baseDir, now: () => NOW, plansPerBrief: 3,
      providerForRun: (runDir: string, store: RunStore) => createCachingProvider({
        runDir, providerId: 'fake', model: 'm', mode, budgetStore: store,
        transport: async (request) => ({ rawText: responseFor(request) })
      }) };
    await runCorpusPipeline(options);
    mode = 'replay';
    await runCorpusPipeline(options);
    const store = RunStore.open(path.join(baseDir, corpus.briefs[0]!.id));
    const grammar = store.readArtifact<SceneGrammar>('scene-grammar', 'scene-grammar.json');
    const evaluation = { corpus, extractionRunDir: baseDir, baseGrammar: grammar,
      outputPath: path.join(baseDir, 'eval-report.json'), now: NOW, minimumScore: 8 };
    const report = evaluateRun(evaluation);
    expect(report.evaluationScope.downstreamSemantics).toBe('not-evaluated');
    expect(report.pipelineDiagnostics).toHaveLength(2);
    expect(Object.keys(report.pipelineDiagnostics[0]!.artifactHashes)).toHaveLength(5);
    expect(report.pipelineDiagnostics[0]).toMatchObject({
      planCount: 3, realizedCount: 3, failedRealizations: 0, pendingRealizations: 0, issues: []
    });
    const content = store.readArtifact<ContentPlans>('content-plans', 'content-plans.json');
    content.realized[0]!.text = 'An unsupported astronaut';
    // Schema/hash-valid data and a forged pass stamp do not bypass gate recomputation.
    store.writeArtifact('content-plans', 'content-plans.json', content);
    expect(() => evaluateRun(evaluation)).toThrow(/downstream diagnostic gates/);
    const failed = JSON.parse(fs.readFileSync(evaluation.outputPath, 'utf8'));
    expect(failed.pipelineDiagnostics[0].failedRealizations).toBe(1);
    expect(failed.pipelineDiagnostics[1].failedRealizations).toBe(0);
  });
  test('[S-R2b] a mid-run cap resumes grammar without paying for completed extraction', async () => {
    const corpus = oneBriefCorpus();
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-resume-cap-'));
    let calls = 0;
    const providerForRun = (runDir: string, store: RunStore) => createCachingProvider({
      runDir, transport: async (req) => { calls++; return { rawText: responseFor(req) }; },
      providerId: 'fake', model: 'm', mode: 'record', budgetStore: store, outputTokenReserve: 32
    });
    await expect(runCorpusPipeline({
      corpus, baseDir, providerForRun, now: () => NOW, runBudgetCaps: { maxLlmCalls: 1 }
    })).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(1);
    await runCorpusPipeline({
      corpus, baseDir, providerForRun, now: () => NOW, runBudgetCaps: { maxLlmCalls: 2 }
    });
    expect(calls).toBe(2);
  });

  test('[S-R2b] unchanged inputs resume for free while source/model changes invalidate semantic stages', async () => {
    const corpus = oneBriefCorpus();
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-resume-identity-'));
    let calls = 0;
    let model = 'model-a';
    const providerForRun = (runDir: string, store: RunStore) => createCachingProvider({
      runDir, transport: async (req) => { calls++; return { rawText: responseFor(req) }; },
      providerId: 'fake', model, mode: 'record', budgetStore: store
    });
    const options = { corpus, baseDir, providerForRun, now: () => NOW, plansPerBrief: 4 };
    await runCorpusPipeline(options);
    expect(calls).toBe(2);
    const resumed = await runCorpusPipeline(options);
    expect(calls).toBe(2);
    expect(resumed[0]!.realizedCount).toBe(4);
    const resized = await runCorpusPipeline({ ...options, plansPerBrief: 6 });
    expect(calls).toBe(2);
    expect(resized[0]!.realizedCount).toBe(6);
    model = 'model-b';
    await runCorpusPipeline(options);
    expect(calls).toBe(4);
    const changed = { ...corpus, briefs: [{ ...corpus.briefs[0]!, text: `${TEXT} The venue has wooden benches.` }] };
    await runCorpusPipeline({ ...options, corpus: changed });
    expect(calls).toBe(6);
  });

  test('[S-R2b] resuming a tampered completed artifact fails before any live call', async () => {
    const corpus = oneBriefCorpus();
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-resume-integrity-'));
    let calls = 0;
    const providerForRun = (runDir: string, store: RunStore) => createCachingProvider({
      runDir, transport: async (req) => { calls++; return { rawText: responseFor(req) }; },
      providerId: 'fake', model: 'm', mode: 'record', budgetStore: store
    });
    const options = { corpus, baseDir, providerForRun, now: () => NOW };
    await runCorpusPipeline(options);
    const file = path.join(baseDir, corpus.briefs[0]!.id, 'source-package.json');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...stored, title: 'tampered' }), 'utf8');
    await expect(runCorpusPipeline(options)).rejects.toThrow(/hash mismatch/i);
    expect(calls).toBe(2);
  });

  test('[S-R2b] explicit rerun spends again and explicit replay revalidates cache identity', async () => {
    const corpus = oneBriefCorpus();
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-explicit-resume-'));
    let calls = 0;
    let mode: 'record' | 'replay' = 'record';
    const providerForRun = (runDir: string, store: RunStore) => createCachingProvider({
      runDir, transport: async (req) => { calls++; return { rawText: responseFor(req) }; },
      providerId: 'fake', model: 'm', mode, budgetStore: store
    });
    const options = { corpus, baseDir, providerForRun, now: () => NOW };
    await runCorpusPipeline(options);
    await runCorpusPipeline({ ...options, forceRerun: true });
    expect(calls).toBe(4);
    const cacheDir = path.join(baseDir, corpus.briefs[0]!.id, 'llm-cache');
    const cacheFile = fs.readdirSync(cacheDir).map((file) => path.join(cacheDir, file)).find((file) =>
      JSON.parse(fs.readFileSync(file, 'utf8')).stage === 'extract')!;
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    fs.writeFileSync(cacheFile, JSON.stringify({ ...cached, model: 'other-model' }), 'utf8');
    mode = 'replay';
    await expect(runCorpusPipeline(options)).rejects.toThrow(/cache identity mismatch/);
    expect(calls).toBe(4);
  });

  test('holdout runner refuses to start without the operator-owned fence path', async () => {
    await expect(runHoldout(
      ['record', 'codex-cli', path.join(os.tmpdir(), 'unused-holdout-run')],
      {}
    )).rejects.toThrow(/METAGRINDER_HOLDOUT_DIR is required/);
  });

  test('record then replay executes the full stored pipeline and yields a scoreable replay artifact', async () => {
    const corpus = oneBriefCorpus();
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-corpus-run-'));
    let liveCalls = 0;
    const liveTransport: Transport = async (req) => {
      liveCalls++;
      return { rawText: responseFor(req) };
    };

    await runCorpusPipeline({
      corpus,
      baseDir,
      now: () => NOW,
      plansPerBrief: 4,
      providerForRun: (runDir) => createCachingProvider({
        runDir, transport: liveTransport, providerId: 'fake', model: 'model-a', modelVersion: 'v1', mode: 'record', now: () => NOW
      })
    });
    expect(liveCalls).toBe(2);

    const neverTransport: Transport = async () => { throw new Error('replay called transport'); };
    await runCorpusPipeline({
      corpus,
      baseDir,
      now: () => NOW,
      plansPerBrief: 4,
      providerForRun: (runDir) => createCachingProvider({
        runDir, transport: neverTransport, providerId: 'fake', model: 'model-a', modelVersion: 'v1', mode: 'replay', now: () => NOW
      })
    });

    const briefDir = path.join(baseDir, 'broadway');
    const extraction = JSON.parse(fs.readFileSync(path.join(briefDir, 'extraction.json'), 'utf8'));
    const plans = JSON.parse(fs.readFileSync(path.join(briefDir, 'content-plans.json'), 'utf8'));
    expect(extraction.analysisMode).toBe('replayed-llm-semantic');
    expect(plans.realized).toHaveLength(4);
    expect(fs.existsSync(path.join(briefDir, 'semantic-choice-graph.json'))).toBe(true);
    expect(scoreExtractionRun(corpus, baseDir).totalScore).toBe(9);
  });

  test('budget cap remains blocked through the pipeline wrapper and resumes after a raise', async () => {
    const corpus = oneBriefCorpus();
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-corpus-budget-'));
    let calls = 0;
    const providerForRun = (runDir: string, store: RunStore) => createCachingProvider({
      runDir,
      transport: async (req) => { calls++; return { rawText: responseFor(req) }; },
      providerId: 'fake', model: 'model-a', mode: 'record', budgetStore: store,
      outputTokenReserve: 32, now: () => NOW
    });
    await expect(runCorpusPipeline({
      corpus, baseDir, providerForRun, now: () => NOW,
      runBudgetCaps: { maxLlmCalls: 0, maxEstimatedTokens: 10_000 }
    })).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toBe(0);
    expect(RunStore.open(path.join(baseDir, 'broadway')).getStageState('extract')).toBe('blocked_on_gate');

    await runCorpusPipeline({
      corpus, baseDir, providerForRun, now: () => NOW,
      runBudgetCaps: { maxLlmCalls: 2, maxEstimatedTokens: 10_000 }
    });
    expect(calls).toBe(2);
  });
});

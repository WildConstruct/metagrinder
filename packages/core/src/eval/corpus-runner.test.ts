import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BudgetExceededError, RunStore } from '../artifacts/store';
import { createCachingProvider, type Transport } from '../providers';
import type { Corpus } from './corpus';
import { loadCorpus } from './corpus';
import { runCorpusPipeline } from './run-corpus';
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

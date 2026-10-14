import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BudgetExceededError, RunStore } from '../artifacts/store';
import { buildProviderForRun, createCachingProvider, type Transport } from '../providers';
import { CommunityJobSchema, SceneGrammarSchema } from '../schemas';
import { buildCommunityJobBriefText } from './brief';
import { DEFAULT_FIXTURES_DIR, resolveJobPath, runCommunityCli } from './cli';
import { splitSituationList } from './project-grammar';
import {
  COMMUNITY_JOB_FILE,
  COMMUNITY_REPORT_FILE,
  runCommunityJobL0
} from './runner';

const APOLLO = 'crowd_apollo_ksc_control_room';
const NOW = '2026-07-15T23:45:00.000Z';

function firstChunkIdFromPrompt(prompt: string): string {
  const m = prompt.match(/\[([^\]]+)\]/);
  if (!m?.[1]) throw new Error('no chunk id in prompt');
  return m[1];
}

describe('projectCommunityJobToGrammar', () => {
  test('splitSituationList is structural', () => {
    expect(splitSituationList('a, b and c; d')).toEqual(['a', 'b', 'c', 'd']);
  });

  test('projects Apollo job to deterministic base grammar', async () => {
    const job = CommunityJobSchema.parse(
      JSON.parse(fs.readFileSync(resolveJobPath(APOLLO), 'utf8'))
    );
    const brief = buildCommunityJobBriefText({ job });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-proj-'));
    try {
      const result = await runCommunityJobL0({
        job,
        baseDir: tmp,
        runId: 'run_proj',
        now: NOW,
        planCount: 4,
        seed: 11,
        writeReviewHtml: false
      });
      expect(result.grammar.analysisMode).toBe('deterministic');
      expect(result.grammarMode).toBe('deterministic');
      expect(result.grammar.grammarTarget).toBe('base');
      expect(result.grammar.archetypes.length).toBeGreaterThan(0);
      expect(result.grammar.locationZones.length).toBeGreaterThan(0);
      expect(result.grammar.negativeConstraints.length).toBeGreaterThan(0);
      expect(result.grammar.reviewFlags).toContain('not-production-trusted');
      expect(SceneGrammarSchema.parse(result.grammar).runId).toBe('run_proj');
      expect(brief).toContain(job.title);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('runCommunityJobL0', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-job-run-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('[AC-job-runner] evaluate → ingest → grammar → sample through RunStore; extract blocked; not production trusted', async () => {
    const job = JSON.parse(fs.readFileSync(resolveJobPath(APOLLO), 'utf8'));
    const result = await runCommunityJobL0({
      job,
      baseDir: tmp,
      runId: 'run_apollo_l0',
      cellId: 'cell_apollo',
      now: NOW,
      seed: 42,
      planCount: 8
    });

    expect(result.productionTrusted).toBe(false);
    expect(result.grammarMode).toBe('deterministic');
    expect(result.completedStages).toEqual(
      expect.arrayContaining(['evaluate', 'ingest', 'grammar', 'choices', 'sample', 'realize', 'review'])
    );
    expect(result.completedStages).not.toContain('extract');
    expect(result.contentPlans?.plans.length).toBeGreaterThan(0);
    expect(result.contentPlans?.realized.length).toBe(result.contentPlans?.plans.length);
    expect(result.reviewHtmlPath && fs.existsSync(result.reviewHtmlPath)).toBe(true);
    expect(result.report.nextAction.kind).toBe('research_task');
    expect(result.report.nextAction.taskId).toBeTruthy();

    const store = RunStore.open(result.runDir);
    expect(store.getStageState('evaluate')).toBe('complete');
    expect(store.getStageState('ingest')).toBe('complete');
    expect(store.getStageState('extract')).toBe('blocked_on_gate');
    expect(store.getStageState('grammar')).toBe('complete');
    expect(store.getStageState('sample')).toBe('complete');

    const storedJob = store.readArtifact('community-job', COMMUNITY_JOB_FILE);
    expect((storedJob as { jobId: string }).jobId).toBe(APOLLO);
    const storedReport = store.readArtifact('community-coverage-report', COMMUNITY_REPORT_FILE);
    expect((storedReport as { productionTrusted: boolean }).productionTrusted).toBe(false);

    const grammar = store.readArtifact<typeof result.grammar>('scene-grammar', 'scene-grammar.json');
    expect(grammar.analysisMode).toBe('deterministic');

    const html = fs.readFileSync(result.reviewHtmlPath!, 'utf8');
    expect(html).toContain('run_apollo_l0');
    expect(html).not.toMatch(/\bfetch\s*\(/);
  });

  test('extra notes are ingested as additional sources', async () => {
    const notesPath = path.join(tmp, 'notes.md');
    fs.writeFileSync(notesPath, 'Console headsets were often dual-cup with coiled cords.\n', 'utf8');
    const job = JSON.parse(fs.readFileSync(resolveJobPath(APOLLO), 'utf8'));
    const result = await runCommunityJobL0({
      job,
      baseDir: path.join(tmp, 'runs'),
      runId: 'run_notes',
      now: NOW,
      notesPaths: [notesPath],
      writeReviewHtml: false,
      planCount: 3
    });
    expect(result.sourcePackage.sourceInputs.length).toBeGreaterThanOrEqual(2);
    expect(result.sourcePackage.chunks.some((c) => c.text.includes('dual-cup'))).toBe(true);
  });

  test('[S-R2a] paid community entrypoint keeps cap failures blocked and charges its logical run', async () => {
    const job = JSON.parse(fs.readFileSync(resolveJobPath(APOLLO), 'utf8'));
    let calls = 0;
    let env: NodeJS.ProcessEnv = { METAGRINDER_MAX_LLM_CALLS: '0' };
    const options = {
      job, baseDir: tmp, runId: 'community_budget', now: NOW, writeReviewHtml: false,
      providerForRun: (store: RunStore) => buildProviderForRun({
        store, kind: 'custom', mode: 'record', env,
        transport: async () => { calls++; throw new Error('transport must not run'); }
      })
    };
    await expect(runCommunityJobL0(options)).rejects.toBeInstanceOf(BudgetExceededError);
    const store = RunStore.open(path.join(tmp, 'community_budget'));
    expect(store.getManifest().inputId).toBe(APOLLO);
    expect(store.getStageState('extract')).toBe('blocked_on_gate');
    env = {};
    await expect(runCommunityJobL0(options)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(store.getStageState('extract')).toBe('blocked_on_gate');
    expect(calls).toBe(0);
  });

  test('[S-R2b] copying a run to a new directory never resumes old-run envelopes', async () => {
    const job = JSON.parse(fs.readFileSync(resolveJobPath(APOLLO), 'utf8'));
    await runCommunityJobL0({ job, baseDir: tmp, runId: 'original', now: NOW, writeReviewHtml: false });
    fs.cpSync(path.join(tmp, 'original'), path.join(tmp, 'copied'), { recursive: true });
    await expect(runCommunityJobL0({
      job, baseDir: tmp, runId: 'copied', now: NOW, writeReviewHtml: false
    })).rejects.toThrow(/run identity mismatch/);
  });

  test('[AC-job-runner-llm] provider path runs extract + grammar; still not production trusted', async () => {
    const job = JSON.parse(fs.readFileSync(resolveJobPath(APOLLO), 'utf8'));
    let calls = 0;
    const transport: Transport = async ({ prompt, stage }) => {
      calls++;
      const chunkId = firstChunkIdFromPrompt(prompt);
      if (stage === 'extract') {
        return {
          rawText: JSON.stringify({
            categories: [{ category: 'wardrobe' }],
            claims: [{
              claimId: 'cl1',
              text: 'dual-cup headset',
              category: 'wardrobe',
              confidence: 'low',
              provenance: {
                sourceInputIds: [],
                sourceChunkIds: [chunkId],
                spans: [],
                attributionMode: 'inferred',
                evidenceBasis: 'inferred',
                confidence: 'low',
                verification: 'unverified',
                reasoningNote: 'fixture transport claim for L0 runner test'
              }
            }],
            concepts: [],
            evidence: [],
            uncertaintySpans: [],
            openQuestions: []
          })
        };
      }
      // grammar
      const sourceInputId = prompt.match(/sourceInputId: ([^\s)]+)/)?.[1];
      if (!sourceInputId) throw new Error('grammar prompt must expose the cited chunk owner');
      return {
        rawText: JSON.stringify({
          sceneContext: {
            contextId: 'ctx_llm',
            title: 'LLM draft Apollo control',
            researchKind: 'historical-scene-research',
            summary: 'provider draft',
            provenance: {
              sourceInputIds: [sourceInputId],
              sourceChunkIds: [chunkId],
              spans: [],
              attributionMode: 'inferred',
              evidenceBasis: 'inferred',
              confidence: 'low',
              verification: 'unverified',
              reasoningNote: 'fixture transport grammar'
            }
          },
          archetypes: [{
            archetypeId: 'arch_llm_controller',
            label: 'Controller',
            summary: 'console operator',
            role: 'operator',
            promptText: 'Apollo-era controller at console with headset',
            weightRange: { label: 'Controller', min: 40, max: 60 },
            confidence: 'low',
            provenance: {
              sourceInputIds: [sourceInputId],
              sourceChunkIds: [chunkId],
              spans: [],
              attributionMode: 'inferred',
              evidenceBasis: 'inferred',
              confidence: 'low',
              verification: 'unverified',
              reasoningNote: 'fixture'
            }
          }],
          demographicDistributions: [],
          itemSystems: [],
          locationZones: [{
            zoneId: 'zone_console',
            label: 'Console row',
            promptText: 'console row',
            archetypeBiases: [],
            provenance: {
              sourceInputIds: [sourceInputId],
              sourceChunkIds: [chunkId],
              spans: [],
              attributionMode: 'inferred',
              evidenceBasis: 'inferred',
              confidence: 'low',
              verification: 'unverified',
              reasoningNote: 'fixture'
            }
          }],
          behaviorStates: [],
          environmentalModifiers: [],
          visualReferences: [],
          compatibilityRules: [],
          negativeConstraints: [],
          uncertainties: [],
          reviewFlags: []
        })
      };
    };

    const runDir = path.join(tmp, 'run_llm');
    fs.mkdirSync(runDir, { recursive: true });
    const provider = createCachingProvider({
      runDir,
      transport,
      providerId: 'fake',
      model: 'm-test',
      mode: 'record',
      now: () => NOW
    });

    const result = await runCommunityJobL0({
      job,
      baseDir: tmp,
      runId: 'run_llm',
      now: NOW,
      provider,
      planCount: 4,
      seed: 3,
      writeReviewHtml: false
    });

    expect(result.productionTrusted).toBe(false);
    expect(result.completedStages).toEqual(
      expect.arrayContaining(['evaluate', 'ingest', 'extract', 'grammar', 'choices', 'sample', 'realize'])
    );
    expect(result.grammarMode).toBe('llm-semantic');
    expect(result.grammar.analysisMode).toBe('llm-semantic');
    expect(result.extraction?.claims.length).toBeGreaterThan(0);
    expect(result.grammar.archetypes.some((a) => a.archetypeId === 'arch_llm_controller')).toBe(true);

    const store = RunStore.open(result.runDir);
    expect(store.getStageState('extract')).toBe('complete');
    expect(store.readArtifact('extraction', 'extraction.json')).toBeTruthy();
    await runCommunityJobL0({
      job, baseDir: tmp, runId: 'run_llm', now: NOW, provider,
      planCount: 4, seed: 3, writeReviewHtml: false
    });
    expect(calls).toBe(2);
  });
});

describe('cli run command', () => {
  let tmp: string;
  let stdout: string[];
  let outWrite: typeof process.stdout.write;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-cli-run-'));
    stdout = [];
    outWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = outWrite;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('run writes a RunStore package for a fixture jobId', async () => {
    const code = await runCommunityCli([
      'run',
      '--job',
      APOLLO,
      '--out',
      tmp,
      '--run-id',
      'run_cli_pipeline',
      '--plans',
      '4',
      '--seed',
      '7',
      '--no-review'
    ]);
    expect(code).toBe(0);
    const text = stdout.join('');
    expect(text).toMatch(/stages:/);
    expect(text).toMatch(/productionTrusted: false/);
    expect(text).toMatch(/grammar: deterministic/);
    expect(fs.existsSync(path.join(tmp, 'run_cli_pipeline', COMMUNITY_JOB_FILE))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'run_cli_pipeline', 'scene-grammar.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'run_cli_pipeline', 'content-plans.json'))).toBe(true);
    expect(fs.existsSync(DEFAULT_FIXTURES_DIR)).toBe(true);
  });
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import { runResumableStage, semanticRequestIdentity } from '../artifacts/resume';
import type { LlmProvider } from '../providers';
import { writeReviewHtmlForRun } from '../review/generate';
import type {
  CommunityCoverageReport,
  CommunityJob,
  ContentPlans,
  Extraction,
  SceneGrammar,
  SourcePackage
} from '../schemas';
import { ContentPlansSchema, ExtractionPayloadSchema, SceneGrammarPayloadSchema } from '../schemas';
import { deriveChoiceGraph } from '../stages/choices';
import { buildExtractPrompt, extract } from '../stages/extract';
import { buildGrammarPrompt, draftGrammar } from '../stages/grammar';
import { ingestText } from '../stages/ingest';
import { realizeTemplate } from '../stages/realize';
import { sampleContentPlans } from '../stages/sample';
import { buildCommunityJobBriefText } from './brief';
import { evaluateCommunityJobL0 } from './evaluate';
import { projectCommunityJobToGrammar } from './project-grammar';

export const COMMUNITY_JOB_FILE = 'community-job.json';
export const COMMUNITY_REPORT_FILE = 'community-coverage-report.json';
export const PARSER_VERSION = '0.1.0';

export interface CommunityJobRunResult {
  job: CommunityJob;
  report: CommunityCoverageReport;
  runDir: string;
  runId: string;
  sourcePackage: SourcePackage;
  grammar: SceneGrammar;
  extraction?: Extraction;
  contentPlans?: ContentPlans;
  reviewHtmlPath?: string;
  /** Stages that completed in this run. */
  completedStages: string[];
  /** Always false at L0. */
  productionTrusted: false;
  notes: string[];
  /** How grammar was produced. */
  grammarMode: 'deterministic' | 'llm-semantic' | 'replayed-llm-semantic';
}

function readNotes(paths: string[] | undefined, texts: string[] | undefined): string[] {
  const fromFiles = (paths ?? []).map((p) => fs.readFileSync(path.resolve(p), 'utf8'));
  return [...fromFiles, ...(texts ?? [])].map((t) => t.trim()).filter(Boolean);
}

/**
 * L0 community job runner through RunStore:
 * evaluate → ingest → extract (optional provider) → grammar (LLM or deterministic)
 * → choices → sample → template realize → optional review.html.
 *
 * Does not auto-approve intake, does not promote UTDG, productionTrusted always false.
 */
export async function runCommunityJobL0(args: {
  job: unknown;
  baseDir: string;
  runId?: string;
  cellId?: string;
  now?: string;
  seed?: number;
  planCount?: number;
  notesPaths?: string[];
  notesTexts?: string[];
  suggestMissingSlotTasks?: boolean;
  writeReviewHtml?: boolean;
  /**
   * When set, runs extract + draftGrammar via the provider (record/replay/auto).
   * When omitted, extract is blocked and grammar is deterministic job projection.
   */
  provider?: LlmProvider;
  /** Construct after the logical RunStore exists, so all spend joins its ledger. */
  providerForRun?: (store: RunStore) => LlmProvider;
  forceRerun?: boolean;
}): Promise<CommunityJobRunResult> {
  const createdAt = args.now ?? new Date().toISOString();
  const now = () => args.now ?? new Date().toISOString();
  const extraNotes = readNotes(args.notesPaths, args.notesTexts);

  const evaluated = evaluateCommunityJobL0({
    job: args.job,
    runId: args.runId ?? 'pending',
    now: createdAt,
    ...(args.cellId !== undefined ? { cellId: args.cellId } : {}),
    ...(args.suggestMissingSlotTasks !== undefined
      ? { suggestMissingSlotTasks: args.suggestMissingSlotTasks }
      : {})
  });
  const job = evaluated.job;
  const runId = args.runId ?? `run_${job.jobId}_${createdAt.replace(/[:.]/g, '-')}`;
  const inputId = job.jobId;
  const baseDir = path.resolve(args.baseDir);
  fs.mkdirSync(baseDir, { recursive: true });

  const runDir = path.join(baseDir, runId);
  const store = fs.existsSync(path.join(runDir, 'run-manifest.json'))
    ? RunStore.open(runDir)
    : RunStore.create({
      baseDir,
      runId,
      inputId,
      parserVersion: PARSER_VERSION,
      now
    });
  const manifest = store.getManifest();
  if (manifest.runId !== runId || manifest.inputId !== inputId) throw new Error('community run identity mismatch');
  const provider = args.providerForRun?.(store) ?? args.provider;
  const withLlm = provider !== undefined;
  const resume = <T>(stage: string, inputs: unknown, family: string, file: string,
    operation: () => Promise<T> | T, load: () => T, semantic = false) => runResumableStage({
    store, stage, inputs, outputs: [{ family, path: file }], operation, load, now,
    ...(args.forceRerun !== undefined ? { forceRerun: args.forceRerun } : {}),
    replay: semantic && provider?.mode === 'replay'
  });

  const completedStages: string[] = [];
  const notes: string[] = [
    withLlm
      ? 'L0 runner: LLM extract + grammar enabled; still not production-trusted.'
      : 'L0 runner: deterministic grammar draft only; LLM extract blocked without provider.',
    'productionTrusted remains false; no intake approval or UTDG promotion.'
  ];

  // Re-evaluate with final runId so report envelope matches the store.
  const { report: freshReport } = evaluateCommunityJobL0({
    job,
    runId,
    now: createdAt,
    ...(args.cellId !== undefined ? { cellId: args.cellId } : {}),
    ...(args.suggestMissingSlotTasks !== undefined
      ? { suggestMissingSlotTasks: args.suggestMissingSlotTasks }
      : {})
  });

  const report = await runResumableStage<CommunityCoverageReport>({
    store, stage: 'evaluate', now,
    inputs: { version: 'community-evaluate-1', job, cellId: args.cellId,
      suggestMissingSlotTasks: args.suggestMissingSlotTasks ?? true },
    outputs: [
      { family: 'community-job', path: COMMUNITY_JOB_FILE },
      { family: 'community-coverage-report', path: COMMUNITY_REPORT_FILE }
    ],
    ...(args.forceRerun !== undefined ? { forceRerun: args.forceRerun } : {}),
    operation: () => {
      store.writeArtifact('community-job', COMMUNITY_JOB_FILE, job, now);
      store.writeArtifact('community-coverage-report', COMMUNITY_REPORT_FILE, freshReport, now);
      return freshReport;
    },
    load: () => store.readArtifact('community-coverage-report', COMMUNITY_REPORT_FILE)
  });
  completedStages.push('evaluate');

  const briefText = buildCommunityJobBriefText({ job, extraNotes });
  const sourcePackage = await resume<SourcePackage>('ingest', {
    version: 'ingest-1', inputId, title: job.title, briefText, extraNotes
  }, 'source-package', 'source-package.json', () => {
    const artifact = ingestText({
      runId,
      inputId,
      title: job.title,
      createdAt,
      sources: [
        { title: `${job.jobId}-job-brief`, rawText: briefText },
        ...extraNotes.map((text, i) => ({
          title: `extra-notes-${i + 1}`,
          rawText: text
        }))
      ]
    });
    store.writeArtifact('source-package', 'source-package.json', artifact, now);
    return artifact;
  }, () => store.readArtifact('source-package', 'source-package.json'));
  completedStages.push('ingest');

  let extraction: Extraction | undefined;
  let grammar: SceneGrammar;
  let grammarMode: CommunityJobRunResult['grammarMode'] = 'deterministic';

  if (provider) {
    extraction = await resume<Extraction>('extract', { version: 'extract-verifier-1', sourcePackage,
      request: semanticRequestIdentity(provider, { stage: 'extract', prompt: buildExtractPrompt(sourcePackage),
        schema: ExtractionPayloadSchema, schemaName: 'extraction' })
    }, 'extraction', 'extraction.json', async () => {
      store.recordModel('extract', provider.id, provider.model, provider.modelVersion);
      const result = await extract({
        provider,
        sourcePackage,
        runId,
        inputId,
        createdAt
      });
      store.writeArtifact('extraction', 'extraction.json', result.extraction, now);
      notes.push(
        `extract: ${result.replayed ? 'replayed' : 'live'} verified=${result.report.verified} downgraded=${result.report.downgraded}`
      );
      return result.extraction;
    }, () => store.readArtifact('extraction', 'extraction.json'), true);
    completedStages.push('extract');

    grammar = await resume<SceneGrammar>('grammar', { version: 'grammar-verifier-2', sourcePackage,
      request: semanticRequestIdentity(provider, { stage: 'grammar', prompt: buildGrammarPrompt(sourcePackage),
        schema: SceneGrammarPayloadSchema, schemaName: 'scene-grammar' })
    }, 'scene-grammar', 'scene-grammar.json', async () => {
      store.recordModel('grammar', provider.id, provider.model, provider.modelVersion);
      const result = await draftGrammar({
        provider,
        sourcePackage,
        runId,
        inputId,
        createdAt
      });
      store.writeArtifact('scene-grammar', 'scene-grammar.json', result.grammar, now);
      grammarMode = result.replayed ? 'replayed-llm-semantic' : 'llm-semantic';
      notes.push(`grammar: ${grammarMode} (provider)`);
      return result.grammar;
    }, () => store.readArtifact('scene-grammar', 'scene-grammar.json'), true);
    grammarMode = grammar.analysisMode === 'replayed-llm-semantic' ? 'replayed-llm-semantic' : 'llm-semantic';
    completedStages.push('grammar');
  } else {
    store.setStageState('extract', 'blocked_on_gate', {
      gate: 'llm-provider',
      error: 'L0 default runner skips extract; pass provider / --with-llm for extract+grammar.'
    }, now);
    notes.push('extract: blocked_on_gate (llm-provider)');

    grammar = await resume<SceneGrammar>('grammar', {
      version: 'community-project-1', job, sourcePackage, mode: 'deterministic'
    }, 'scene-grammar', 'scene-grammar.json', () => {
      const draft = projectCommunityJobToGrammar({
        job,
        sourcePackage,
        runId,
        inputId,
        createdAt
      });
      store.writeArtifact('scene-grammar', 'scene-grammar.json', draft, now);
      notes.push('grammar: deterministic (job projection)');
      return draft;
    }, () => store.readArtifact('scene-grammar', 'scene-grammar.json'));
    completedStages.push('grammar');
  }

  await resume('choices', { version: 'choices-1', grammar }, 'semantic-choice-graph', 'semantic-choice-graph.json', () => {
    const choices = deriveChoiceGraph({
      grammar,
      runId,
      inputId,
      createdAt
    });
    store.writeArtifact('semantic-choice-graph', 'semantic-choice-graph.json', choices, now);
    return choices;
  }, () => store.readArtifact('semantic-choice-graph', 'semantic-choice-graph.json'));
  completedStages.push('choices');

  let contentPlans: ContentPlans | undefined;
  if (job.goals.contentPlans || job.goals.sceneGrammar) {
    contentPlans = await resume<ContentPlans>('sample', {
      version: 'community-sample-realize-1', grammar, seed: args.seed ?? 73,
      count: args.planCount ?? 12, profile: 'caption-prose'
    }, 'content-plans', 'content-plans.json', () => {
      const plans = sampleContentPlans({
        grammar,
        seed: args.seed ?? 73,
        count: args.planCount ?? 12,
        runId,
        inputId,
        now: createdAt
      });
      const realized = plans.plans.map((plan) => realizeTemplate(plan, 'caption-prose'));
      const withRealized = ContentPlansSchema.parse({
        ...plans,
        realized
      });
      store.writeArtifact('content-plans', 'content-plans.json', withRealized, now);
      return withRealized;
    }, () => store.readArtifact('content-plans', 'content-plans.json'));
    completedStages.push('sample', 'realize');
    store.setStageState('realize', 'complete', { outputArtifacts: ['content-plans.json'] }, now);
  }

  let reviewHtmlPath: string | undefined;
  const wantReview = args.writeReviewHtml !== false && job.goals.reviewHtml && contentPlans !== undefined;
  if (wantReview && contentPlans !== undefined) {
    reviewHtmlPath = writeReviewHtmlForRun({
      store,
      contentPlans,
      now: createdAt,
      notes: [
        `Community job: ${job.jobId}`,
        `grammarMode: ${grammarMode}`,
        `nextAction: ${report.nextAction.kind} — ${report.nextAction.detail}`,
        'L0: not production-trusted'
      ]
    });
    completedStages.push('review');
  }

  return {
    job,
    report,
    runDir: store.runDir,
    runId,
    sourcePackage,
    grammar,
    ...(extraction !== undefined ? { extraction } : {}),
    ...(contentPlans !== undefined ? { contentPlans } : {}),
    ...(reviewHtmlPath !== undefined ? { reviewHtmlPath } : {}),
    completedStages,
    productionTrusted: false,
    notes,
    grammarMode
  };
}

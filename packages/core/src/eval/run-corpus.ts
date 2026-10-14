import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import { runResumableStage, semanticRequestIdentity } from '../artifacts/resume';
import { budgetCapsFromEnv, buildProviderForRun, type LlmProvider, type ProviderMode } from '../providers';
import { ContentPlansSchema, ExtractionPayloadSchema, SceneGrammarPayloadSchema, SceneGrammarSchema,
  type BudgetCaps, type ContentPlans, type Extraction, type SceneGrammar, type SourcePackage } from '../schemas';
import { deriveChoiceGraph } from '../stages/choices';
import { buildExtractPrompt, extract } from '../stages/extract';
import { buildGrammarPrompt, draftGrammar } from '../stages/grammar';
import { ingestText } from '../stages/ingest';
import { realizeTemplate } from '../stages/realize';
import { sampleContentPlans } from '../stages/sample';
import type { Corpus, CorpusBrief } from './corpus';
import { loadCorpus } from './corpus';
import { evaluateRun } from './run';

export interface CorpusRunResult {
  briefId: string;
  runDir: string;
  realizedCount: number;
}

function openOrCreateStore(baseDir: string, brief: CorpusBrief, now: () => string): RunStore {
  const runDir = path.join(baseDir, brief.id);
  return fs.existsSync(path.join(runDir, 'run-manifest.json'))
    ? RunStore.open(runDir)
    : RunStore.create({
      baseDir,
      runId: brief.id,
      inputId: brief.id,
      parserVersion: '0.1.0',
      now
    });
}

async function runBrief(args: {
  brief: CorpusBrief;
  baseDir: string;
  providerForRun: (runDir: string, store: RunStore) => LlmProvider;
  now: () => string;
  plansPerBrief: number;
  seed: number;
  runBudgetCaps?: BudgetCaps;
  campaignBudget?: { campaignId: string; caps: BudgetCaps; baseDir?: string };
  forceRerun?: boolean;
}): Promise<CorpusRunResult> {
  const store = openOrCreateStore(args.baseDir, args.brief, args.now);
  const manifest = store.getManifest();
  if (manifest.runId !== args.brief.id || manifest.inputId !== args.brief.id) {
    throw new Error('corpus run identity mismatch');
  }
  if (args.runBudgetCaps !== undefined) {
    store.configureBudget({
      ledgerId: `run:${args.brief.id}`,
      scope: 'run',
      scopeId: args.brief.id,
      caps: args.runBudgetCaps,
      now: args.now
    });
  }
  if (args.campaignBudget !== undefined) {
    store.configureBudget({
      ledgerId: `campaign:${args.campaignBudget.campaignId}`,
      scope: 'campaign',
      scopeId: args.campaignBudget.campaignId,
      caps: args.campaignBudget.caps,
      sharedBaseDir: args.campaignBudget.baseDir ?? args.baseDir,
      now: args.now
    });
  }
  const provider = args.providerForRun(store.runDir, store);
  const createdAt = args.now();
  const resume = <T>(stage: string, inputs: unknown, family: string, file: string,
    operation: () => Promise<T> | T, load: () => T, semantic = false) => runResumableStage({
    store, stage, inputs, outputs: [{ family, path: file }], operation, load, now: args.now,
    ...(args.forceRerun !== undefined ? { forceRerun: args.forceRerun } : {}),
    replay: semantic && provider.mode === 'replay'
  });

  const sourcePackage = await resume<SourcePackage>('ingest', {
    version: 'ingest-1', inputId: args.brief.id, text: args.brief.text
  }, 'source-package', 'source-package.json', () => {
    const artifact = ingestText({
      runId: args.brief.id,
      inputId: args.brief.id,
      title: args.brief.id,
      createdAt,
      sources: [{ title: args.brief.id, rawText: args.brief.text }]
    });
    store.writeArtifact('source-package', 'source-package.json', artifact, args.now);
    return artifact;
  }, () => store.readArtifact('source-package', 'source-package.json'));

  await resume<Extraction>('extract', { version: 'extract-verifier-1', sourcePackage,
    request: semanticRequestIdentity(provider, { stage: 'extract', prompt: buildExtractPrompt(sourcePackage),
      schema: ExtractionPayloadSchema, schemaName: 'extraction' })
  }, 'extraction', 'extraction.json', async () => {
    store.recordModel('extract', provider.id, provider.model, provider.modelVersion);
    const result = await extract({
      provider,
      sourcePackage,
      runId: args.brief.id,
      inputId: args.brief.id,
      createdAt
    });
    store.writeArtifact('extraction', 'extraction.json', result.extraction, args.now);
    return result.extraction;
  }, () => store.readArtifact('extraction', 'extraction.json'), true);

  const grammar = await resume<SceneGrammar>('grammar', { version: 'grammar-verifier-2', sourcePackage,
    request: semanticRequestIdentity(provider, { stage: 'grammar', prompt: buildGrammarPrompt(sourcePackage),
      schema: SceneGrammarPayloadSchema, schemaName: 'scene-grammar' })
  }, 'scene-grammar', 'scene-grammar.json', async () => {
    store.recordModel('grammar', provider.id, provider.model, provider.modelVersion);
    const result = await draftGrammar({
      provider,
      sourcePackage,
      runId: args.brief.id,
      inputId: args.brief.id,
      createdAt
    });
    store.writeArtifact('scene-grammar', 'scene-grammar.json', result.grammar, args.now);
    return result.grammar;
  }, () => store.readArtifact('scene-grammar', 'scene-grammar.json'), true);

  await resume('choices', { version: 'choices-1', grammar }, 'semantic-choice-graph', 'semantic-choice-graph.json', () => {
    const choices = deriveChoiceGraph({
      grammar,
      runId: args.brief.id,
      inputId: args.brief.id,
      createdAt
    });
    store.writeArtifact('semantic-choice-graph', 'semantic-choice-graph.json', choices, args.now);
    return choices;
  }, () => store.readArtifact('semantic-choice-graph', 'semantic-choice-graph.json'));

  const plans = await resume<ContentPlans>('sample', {
    version: 'sample-2', grammar, seed: args.seed, count: args.plansPerBrief
  }, 'content-plans', 'sampled-content-plans.json', () => {
    const artifact = sampleContentPlans({
      grammar,
      seed: args.seed,
      count: args.plansPerBrief,
      runId: args.brief.id,
      inputId: args.brief.id,
      now: createdAt
    });
    store.writeArtifact('content-plans', 'sampled-content-plans.json', artifact, args.now);
    return artifact;
  }, () => store.readArtifact('content-plans', 'sampled-content-plans.json'));

  const { realized: _previousRealized, ...planInputs } = plans;
  const realized = await resume<ContentPlans>('realize', {
    version: 'template-2', profile: 'caption-prose', plans: planInputs
  }, 'content-plans', 'content-plans.json', () => {
    const artifact = ContentPlansSchema.parse({
      ...plans,
      realized: plans.plans.map((plan) => realizeTemplate(plan, 'caption-prose'))
    });
    store.writeArtifact('content-plans', 'content-plans.json', artifact, args.now);
    return artifact;
  }, () => store.readArtifact('content-plans', 'content-plans.json'));

  return { briefId: args.brief.id, runDir: store.runDir, realizedCount: realized.realized.length };
}

export async function runCorpusPipeline(args: {
  corpus: Corpus;
  baseDir: string;
  providerForRun: (runDir: string, store: RunStore) => LlmProvider;
  now?: () => string;
  plansPerBrief?: number;
  seed?: number;
  runBudgetCaps?: BudgetCaps;
  campaignBudget?: { campaignId: string; caps: BudgetCaps; baseDir?: string };
  forceRerun?: boolean;
}): Promise<CorpusRunResult[]> {
  const now = args.now ?? (() => new Date().toISOString());
  const plansPerBrief = args.plansPerBrief ?? 32;
  const seed = args.seed ?? 73;
  fs.mkdirSync(args.baseDir, { recursive: true });
  const results: CorpusRunResult[] = [];
  for (const brief of args.corpus.briefs) {
    results.push(await runBrief({
      brief,
      baseDir: args.baseDir,
      providerForRun: args.providerForRun,
      now,
      plansPerBrief,
      seed,
      ...(args.runBudgetCaps !== undefined ? { runBudgetCaps: args.runBudgetCaps } : {}),
      ...(args.campaignBudget !== undefined ? { campaignBudget: args.campaignBudget } : {}),
      ...(args.forceRerun !== undefined ? { forceRerun: args.forceRerun } : {})
    }));
  }
  return results;
}

type ProviderKind = 'anthropic' | 'codex-cli';

export { budgetCapsFromEnv } from '../providers/budget-policy';

async function main(argv: string[]): Promise<void> {
  const normalized = argv[0] === '--' ? argv.slice(1) : argv;
  const [modeRaw, providerRaw, baseDirRaw] = normalized;
  if (!modeRaw || !providerRaw || !baseDirRaw
    || !['record', 'replay', 'auto'].includes(modeRaw)
    || !['anthropic', 'codex-cli'].includes(providerRaw)) {
    throw new Error('Usage: tsx src/eval/run-corpus.ts <record|replay|auto> <anthropic|codex-cli> <run-dir> [--rerun]');
  }
  const mode = modeRaw as ProviderMode;
  const providerKind = providerRaw as ProviderKind;
  const baseDir = path.resolve(baseDirRaw);
  const corpus = loadCorpus();
  const runBudgetCaps = budgetCapsFromEnv(process.env);
  const campaignId = process.env.METAGRINDER_CAMPAIGN_ID;
  const campaignBudget = campaignId
    ? { campaignId, caps: budgetCapsFromEnv(process.env, 'METAGRINDER_CAMPAIGN'),
      baseDir: path.resolve(process.env.METAGRINDER_CAMPAIGN_BUDGET_DIR ?? baseDir) }
    : undefined;
  const results = await runCorpusPipeline({
    corpus,
    baseDir,
    runBudgetCaps,
    ...(campaignBudget !== undefined ? { campaignBudget } : {}),
    forceRerun: normalized.includes('--rerun'),
    providerForRun: (_runDir, store) => buildProviderForRun({
      store, kind: providerKind, mode
    })
  });

  if (mode === 'replay') {
    const eraBrief = results[0];
    if (!eraBrief) throw new Error('corpus contains no briefs');
    const grammar = SceneGrammarSchema.parse(JSON.parse(
      fs.readFileSync(path.join(eraBrief.runDir, 'scene-grammar.json'), 'utf8')
    ));
    const report = evaluateRun({
      corpus,
      extractionRunDir: baseDir,
      baseGrammar: grammar,
      outputPath: path.join(baseDir, 'eval-report.json'),
      now: new Date().toISOString(),
      minimumScore: 106
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ mode, baseDir, results }, null, 2)}\n`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

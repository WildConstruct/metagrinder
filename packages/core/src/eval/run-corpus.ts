import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import { buildProvider, type LlmProvider, type ProviderMode } from '../providers';
import { ContentPlansSchema, SceneGrammarSchema } from '../schemas';
import { deriveChoiceGraph } from '../stages/choices';
import { extract } from '../stages/extract';
import { draftGrammar } from '../stages/grammar';
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

async function stage<T>(
  store: RunStore,
  stageName: string,
  now: () => string,
  operation: () => Promise<T> | T,
  outputArtifacts: string[] = []
): Promise<T> {
  store.setStageState(stageName, 'running', undefined, now);
  try {
    const result = await operation();
    store.setStageState(stageName, 'complete', { outputArtifacts }, now);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.setStageState(stageName, 'failed', { error: message }, now);
    throw error;
  }
}

async function runBrief(args: {
  brief: CorpusBrief;
  baseDir: string;
  providerForRun: (runDir: string) => LlmProvider;
  now: () => string;
  plansPerBrief: number;
  seed: number;
}): Promise<CorpusRunResult> {
  const store = openOrCreateStore(args.baseDir, args.brief, args.now);
  const provider = args.providerForRun(store.runDir);
  const createdAt = args.now();

  const sourcePackage = await stage(store, 'ingest', args.now, () => {
    const artifact = ingestText({
      runId: args.brief.id,
      inputId: args.brief.id,
      title: args.brief.id,
      createdAt,
      sources: [{ title: args.brief.id, rawText: args.brief.text }]
    });
    store.writeArtifact('source-package', 'source-package.json', artifact, args.now);
    return artifact;
  }, ['source-package.json']);

  store.recordModel('extract', provider.id, provider.model, provider.modelVersion);
  await stage(store, 'extract', args.now, async () => {
    const result = await extract({
      provider,
      sourcePackage,
      runId: args.brief.id,
      inputId: args.brief.id,
      createdAt
    });
    store.writeArtifact('extraction', 'extraction.json', result.extraction, args.now);
    return result.extraction;
  }, ['extraction.json']);

  store.recordModel('grammar', provider.id, provider.model, provider.modelVersion);
  const grammar = await stage(store, 'grammar', args.now, async () => {
    const result = await draftGrammar({
      provider,
      sourcePackage,
      runId: args.brief.id,
      inputId: args.brief.id,
      createdAt
    });
    store.writeArtifact('scene-grammar', 'scene-grammar.json', result.grammar, args.now);
    return result.grammar;
  }, ['scene-grammar.json']);

  await stage(store, 'choices', args.now, () => {
    const choices = deriveChoiceGraph({
      grammar,
      runId: args.brief.id,
      inputId: args.brief.id,
      createdAt
    });
    store.writeArtifact('semantic-choice-graph', 'semantic-choice-graph.json', choices, args.now);
  }, ['semantic-choice-graph.json']);

  const plans = await stage(store, 'sample', args.now, () => {
    const artifact = sampleContentPlans({
      grammar,
      seed: args.seed,
      count: args.plansPerBrief,
      runId: args.brief.id,
      inputId: args.brief.id,
      now: createdAt
    });
    store.writeArtifact('content-plans', 'content-plans.json', artifact, args.now);
    return artifact;
  }, ['content-plans.json']);

  const realized = await stage(store, 'realize', args.now, () => {
    const artifact = ContentPlansSchema.parse({
      ...plans,
      realized: plans.plans.map((plan) => realizeTemplate(plan, 'caption-prose'))
    });
    store.writeArtifact('content-plans', 'content-plans.json', artifact, args.now);
    return artifact;
  }, ['content-plans.json']);

  return { briefId: args.brief.id, runDir: store.runDir, realizedCount: realized.realized.length };
}

export async function runCorpusPipeline(args: {
  corpus: Corpus;
  baseDir: string;
  providerForRun: (runDir: string) => LlmProvider;
  now?: () => string;
  plansPerBrief?: number;
  seed?: number;
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
      seed
    }));
  }
  return results;
}

type ProviderKind = 'anthropic' | 'codex-cli';

async function main(argv: string[]): Promise<void> {
  const [modeRaw, providerRaw, baseDirRaw] = argv;
  if (!modeRaw || !providerRaw || !baseDirRaw
    || !['record', 'replay'].includes(modeRaw)
    || !['anthropic', 'codex-cli'].includes(providerRaw)) {
    throw new Error('Usage: tsx src/eval/run-corpus.ts <record|replay> <anthropic|codex-cli> <run-dir>');
  }
  const mode = modeRaw as ProviderMode;
  const providerKind = providerRaw as ProviderKind;
  const baseDir = path.resolve(baseDirRaw);
  const corpus = loadCorpus();
  const results = await runCorpusPipeline({
    corpus,
    baseDir,
    providerForRun: (runDir) => buildProvider({ runDir, kind: providerKind, mode })
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
      now: new Date().toISOString()
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

import * as fs from 'node:fs';
import * as path from 'node:path';
import { EvalReportSchema, SceneGrammarSchema, type ContentPlans, type EvalReport,
  type Extraction, type SceneGrammar, type SourcePackage } from '../schemas';
import type { PipelineDiagnostic } from '../schemas/eval';
import { faithfulnessGate } from '../stages/realize/gate';
import { ingestText } from '../stages/ingest';
import { violatedRuleIds } from '../stages/sample/rules';
import type { Corpus } from './corpus';
import { loadCorpus } from './corpus';
import { analyzeExpressiveRange, compareExpressiveRanges, selectionFor } from './era';
import { observationFromExtraction, openEvaluationRun, scoreCorpus, scoreLegacyRun } from './scorer';

function grammarReferenceCounts(grammar: SceneGrammar): Map<string, number> {
  const references = [
    `sceneContext.${grammar.sceneContext.contextId}`,
    ...grammar.archetypes.map((record) => `archetypes.${record.archetypeId}`),
    ...grammar.demographicDistributions.map((record) => `demographicDistributions.${record.distributionId}`),
    ...grammar.itemSystems.map((record) => `itemSystems.${record.systemId}`),
    ...grammar.locationZones.map((record) => `locationZones.${record.zoneId}`),
    ...grammar.behaviorStates.map((record) => `behaviorStates.${record.behaviorId}`),
    ...grammar.environmentalModifiers.map((record) => `environmentalModifiers.${record.modifierId}`),
    ...grammar.visualReferences.map((record) => `visualReferences.${record.referenceId}`),
    ...grammar.compatibilityRules.map((record) => `compatibilityRules.${record.ruleId}`),
    ...grammar.negativeConstraints.map((record) => `negativeConstraints.${record.constraintId}`)
  ];
  const counts = new Map<string, number>();
  for (const reference of references) counts.set(reference, (counts.get(reference) ?? 0) + 1);
  return counts;
}

/** Structural/lexical diagnostics are separate from the unchanged metadata rubric. */
function diagnosePipeline(corpus: Corpus, baseDir: string,
  sourceKind: 'replayed-extraction' | 'holdout-extraction'
): Array<{ diagnostic: PipelineDiagnostic; extraction: Extraction }> {
  return corpus.briefs.map((brief) => {
    const store = openEvaluationRun(baseDir, brief.id);
    const before = store.getManifest();
    const artifactHashes: Record<string, string> = {};
    const read = <T>(family: string, file: string): T => {
      const value = store.readArtifact<Record<string, unknown>>(family, file);
      if (value.runId !== before.runId || value.inputId !== before.inputId) {
        throw new Error(`evaluation artifact identity mismatch: ${brief.id}/${file}`);
      }
      const record = before.artifacts.find((entry) => entry.family === family && entry.path === file);
      if (!record) throw new Error(`evaluation artifact missing from manifest: ${file}`);
      artifactHashes[file] = record.contentSha256;
      return value as T;
    };
    const source = read<SourcePackage>('source-package', 'source-package.json');
    const extraction = read<Extraction>('extraction', 'extraction.json');
    if (sourceKind === 'replayed-extraction' && extraction.analysisMode !== 'replayed-llm-semantic') {
      throw new Error(`committed corpus extraction is not replay-stamped: ${brief.id}`);
    }
    const grammar = read<SceneGrammar>('scene-grammar', 'scene-grammar.json');
    read('semantic-choice-graph', 'semantic-choice-graph.json');
    const content = read<ContentPlans>('content-plans', 'content-plans.json');
    const after = store.getManifest();
    const snapshot = (manifest: typeof before) => JSON.stringify({
      artifacts: manifest.artifacts, stages: manifest.stages, models: manifest.models
    });
    if (snapshot(before) !== snapshot(after)) throw new Error(`run changed during evaluation: ${brief.id}`);

    const issues: string[] = [];
    const expectedSource = ingestText({ runId: brief.id, inputId: brief.id, title: brief.id,
      createdAt: source.createdAt, sources: [{ title: brief.id, rawText: brief.text }] });
    if (JSON.stringify(source.chunks) !== JSON.stringify(expectedSource.chunks)) {
      issues.push('source chunks do not match the current corpus brief');
    }
    const planById = new Map(content.plans.map((plan) => [plan.planId, plan]));
    if (planById.size !== content.plans.length) issues.push('duplicate content-plan IDs');
    if (content.plans.length === 0) issues.push('no content plans emitted');
    if (content.grammarTarget !== grammar.grammarTarget) issues.push('content plans target a different grammar');
    const referenceCounts = grammarReferenceCounts(grammar);
    let constraintViolations = 0;
    for (const plan of content.plans) {
      for (const reference of new Set([...plan.slots, ...plan.negativeSlots].flatMap((slot) => slot.grammarRefs))) {
        const count = referenceCounts.get(reference) ?? 0;
        if (count !== 1) issues.push(`plan ${plan.planId} has ${count === 0 ? 'unresolved' : 'ambiguous'} grammar reference ${reference}`);
      }
      const selection = selectionFor(grammar, plan);
      if (!selection) issues.push(`plan ${plan.planId} has no resolvable archetype`);
      else if (violatedRuleIds(grammar, selection).length > 0) constraintViolations++;
      if (plan.grammarTarget !== grammar.grammarTarget) issues.push(`plan ${plan.planId} targets a different grammar`);
      if (!content.realized.some((prompt) => prompt.planId === plan.planId)) {
        issues.push(`plan ${plan.planId} has no realization`);
      }
    }
    let failedRealizations = 0;
    let pendingRealizations = 0;
    const promptIds = new Set<string>();
    for (const prompt of content.realized) {
      if (promptIds.has(prompt.promptId)) issues.push(`duplicate prompt ID ${prompt.promptId}`);
      promptIds.add(prompt.promptId);
      const plan = planById.get(prompt.planId);
      if (!plan) { issues.push(`realization ${prompt.promptId} has no content plan`); continue; }
      const gate = faithfulnessGate(plan, prompt.text, prompt.negativeText, prompt.constraintNotes);
      const statuses = [gate.slotCoverage, gate.unsupportedContent,
        prompt.faithfulness.slotCoverage, prompt.faithfulness.unsupportedContent];
      if (statuses.includes('fail')) failedRealizations++;
      else if (statuses.some((status) => status !== 'pass')) pendingRealizations++;
    }
    const diagnostic: PipelineDiagnostic = { briefId: brief.id, runId: before.runId, inputId: before.inputId, artifactHashes,
      planCount: content.plans.length, realizedCount: content.realized.length,
      failedRealizations, pendingRealizations, constraintViolations, issues };
    return { diagnostic, extraction };
  });
}

export function evaluateRun(args: {
  corpus: Corpus;
  legacyRunDir?: string;
  extractionRunDir?: string;
  sourceKind?: 'replayed-extraction' | 'holdout-extraction';
  baseGrammar: SceneGrammar;
  acceptedGrammar?: SceneGrammar;
  outputPath: string;
  now: string;
  seed?: number;
  sampleCount?: number;
  minimumScore?: number;
}): EvalReport {
  if ((args.legacyRunDir === undefined) === (args.extractionRunDir === undefined)) {
    throw new Error('provide exactly one of legacyRunDir or extractionRunDir');
  }
  if (args.minimumScore !== undefined && (!Number.isFinite(args.minimumScore) || args.minimumScore < 0)) {
    throw new Error('minimumScore must be a finite nonnegative number');
  }
  const sourceKind = args.sourceKind ?? 'replayed-extraction';
  const captured = args.extractionRunDir === undefined ? []
    : diagnosePipeline(args.corpus, args.extractionRunDir, sourceKind);
  const extractions = new Map(captured.map(({ diagnostic, extraction }) => [diagnostic.briefId, extraction]));
  const corpusReport = args.legacyRunDir !== undefined
    ? scoreLegacyRun(args.corpus, args.legacyRunDir)
    : scoreCorpus(args.corpus, sourceKind, (brief) => observationFromExtraction(extractions.get(brief.id)!));
  const pipelineDiagnostics = captured.map(({ diagnostic }) => diagnostic);
  const seed = args.seed ?? 73;
  const sampleCount = args.sampleCount ?? 1000;
  const base = analyzeExpressiveRange(args.baseGrammar, { seed, sampleCount });
  const accepted = args.acceptedGrammar === undefined
    ? undefined
    : analyzeExpressiveRange(args.acceptedGrammar, { seed, sampleCount });
  const shift = accepted === undefined ? undefined : compareExpressiveRanges(base, accepted);
  const report = EvalReportSchema.parse({
    artifact: 'eval-report',
    runId: path.basename(args.legacyRunDir ?? args.extractionRunDir!),
    inputId: args.sourceKind === 'holdout-extraction' ? 'operator-holdout-corpus' : 'committed-corpus',
    createdAt: args.now,
    corpus: corpusReport,
    evaluationScope: {
      scoredSignals: 'extraction-metadata', factualAccuracy: 'not-evaluated', downstreamSemantics: 'not-evaluated',
      downstreamDiagnostics: args.extractionRunDir === undefined ? 'not-evaluated' : 'deterministic-boundaries',
      eraInput: { scope: 'single-grammar', runId: args.baseGrammar.runId, inputId: args.baseGrammar.inputId }
    },
    pipelineDiagnostics,
    ...(args.minimumScore !== undefined ? { baseline: {
      minimumScore: args.minimumScore, passed: corpusReport.totalScore >= args.minimumScore
    } } : {}),
    era: {
      base,
      ...(accepted !== undefined ? { accepted } : {}),
      ...(shift !== undefined ? { shift } : {})
    }
  });
  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (report.baseline?.passed === false) {
    throw new Error(`corpus score ${corpusReport.totalScore} below required baseline ${args.minimumScore}; report: ${args.outputPath}`);
  }
  if (pipelineDiagnostics.some((result) => result.issues.length > 0 || result.constraintViolations > 0
    || result.failedRealizations > 0 || result.pendingRealizations > 0)) {
    throw new Error(`downstream diagnostic gates require repair or review; report: ${args.outputPath}`);
  }
  return report;
}

function readGrammar(filePath: string): SceneGrammar {
  return SceneGrammarSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function main(argv: string[]): void {
  const [format, runDir, baseGrammarPath, outputPath, acceptedGrammarPath] = argv[0] === '--' ? argv.slice(1) : argv;
  if (!format || !runDir || !baseGrammarPath || !outputPath || !['legacy', 'replay'].includes(format)) {
    throw new Error('Usage: tsx src/eval/run.ts <legacy|replay> <run-dir> <base-grammar.json> <output.json> [accepted-grammar.json]');
  }
  const report = evaluateRun({
    corpus: loadCorpus(),
    ...(format === 'legacy' ? { legacyRunDir: path.resolve(runDir) } : { extractionRunDir: path.resolve(runDir) }),
    baseGrammar: readGrammar(path.resolve(baseGrammarPath)),
    ...(acceptedGrammarPath !== undefined ? { acceptedGrammar: readGrammar(path.resolve(acceptedGrammarPath)) } : {}),
    outputPath: path.resolve(outputPath),
    now: new Date().toISOString(),
    minimumScore: 106
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main(process.argv.slice(2));

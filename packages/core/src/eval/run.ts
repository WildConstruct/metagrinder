import * as fs from 'node:fs';
import * as path from 'node:path';
import { EvalReportSchema, SceneGrammarSchema, type EvalReport, type SceneGrammar } from '../schemas';
import type { Corpus } from './corpus';
import { loadCorpus } from './corpus';
import { analyzeExpressiveRange, compareExpressiveRanges } from './era';
import { scoreExtractionRun, scoreLegacyRun } from './scorer';

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
}): EvalReport {
  if ((args.legacyRunDir === undefined) === (args.extractionRunDir === undefined)) {
    throw new Error('provide exactly one of legacyRunDir or extractionRunDir');
  }
  const corpusReport = args.legacyRunDir !== undefined
    ? scoreLegacyRun(args.corpus, args.legacyRunDir)
    : scoreExtractionRun(args.corpus, args.extractionRunDir!, args.sourceKind);
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
    inputId: 'committed-corpus',
    createdAt: args.now,
    corpus: corpusReport,
    era: {
      base,
      ...(accepted !== undefined ? { accepted } : {}),
      ...(shift !== undefined ? { shift } : {})
    }
  });
  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function readGrammar(filePath: string): SceneGrammar {
  return SceneGrammarSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function main(argv: string[]): void {
  const [format, runDir, baseGrammarPath, outputPath, acceptedGrammarPath] = argv;
  if (!format || !runDir || !baseGrammarPath || !outputPath || !['legacy', 'replay'].includes(format)) {
    throw new Error('Usage: tsx src/eval/run.ts <legacy|replay> <run-dir> <base-grammar.json> <output.json> [accepted-grammar.json]');
  }
  const report = evaluateRun({
    corpus: loadCorpus(),
    ...(format === 'legacy' ? { legacyRunDir: path.resolve(runDir) } : { extractionRunDir: path.resolve(runDir) }),
    baseGrammar: readGrammar(path.resolve(baseGrammarPath)),
    ...(acceptedGrammarPath !== undefined ? { acceptedGrammar: readGrammar(path.resolve(acceptedGrammarPath)) } : {}),
    outputPath: path.resolve(outputPath),
    now: new Date().toISOString()
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main(process.argv.slice(2));

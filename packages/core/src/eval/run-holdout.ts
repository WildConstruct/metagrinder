import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildProvider, type ProviderMode } from '../providers';
import { SceneGrammarSchema } from '../schemas';
import { loadCorpus } from './corpus';
import { evaluateRun } from './run';
import { runCorpusPipeline } from './run-corpus';

type ProviderKind = 'anthropic' | 'codex-cli';

export async function runHoldout(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const holdoutDirRaw = env.METAGRINDER_HOLDOUT_DIR;
  const [modeRaw, providerRaw, runDirRaw] = argv;
  if (!holdoutDirRaw) {
    throw new Error('METAGRINDER_HOLDOUT_DIR is required; see src/eval/holdout/README.md');
  }
  if (!modeRaw || !providerRaw || !runDirRaw
    || !['record', 'replay'].includes(modeRaw)
    || !['anthropic', 'codex-cli'].includes(providerRaw)) {
    throw new Error('Usage: tsx src/eval/run-holdout.ts <record|replay> <anthropic|codex-cli> <run-dir>');
  }

  const mode = modeRaw as ProviderMode;
  const providerKind = providerRaw as ProviderKind;
  const holdoutDir = path.resolve(holdoutDirRaw);
  const runDir = path.resolve(runDirRaw);
  const corpus = loadCorpus(holdoutDir);
  const results = await runCorpusPipeline({
    corpus,
    baseDir: runDir,
    providerForRun: (briefRunDir) => buildProvider({
      runDir: briefRunDir,
      kind: providerKind,
      mode
    })
  });
  const eraBrief = results[0];
  if (!eraBrief) throw new Error('holdout corpus contains no briefs');
  const grammar = SceneGrammarSchema.parse(JSON.parse(
    fs.readFileSync(path.join(eraBrief.runDir, 'scene-grammar.json'), 'utf8')
  ));
  const outputPath = path.join(runDir, 'holdout-eval-report.json');
  evaluateRun({
    corpus,
    extractionRunDir: runDir,
    sourceKind: 'holdout-extraction',
    baseGrammar: grammar,
    outputPath,
    now: new Date().toISOString()
  });
  return outputPath;
}

if (require.main === module) {
  runHoldout(process.argv.slice(2)).then(
    (outputPath) => process.stdout.write(`${outputPath}\n`),
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  );
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import { buildProviderForRun, type ProviderMode } from '../providers';
import { HumanCalibrationRatingSchema, type JudgeMetaGateReport } from '../schemas';
import { createLlmPairwiseJudge, runJudgeMetaGate } from './judge';
import { DEFAULT_JUDGE_CRITERIA, DEFAULT_JUDGE_STRESS_CASES } from './judge-battery';

type ProviderKind = 'anthropic' | 'codex-cli';

export async function runJudgeGate(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<{ outputPath: string; report: JudgeMetaGateReport }> {
  const calibrationPathRaw = env.METAGRINDER_JUDGE_CALIBRATION;
  const [modeRaw, providerRaw, runDirRaw] = argv[0] === '--' ? argv.slice(1) : argv;
  if (!calibrationPathRaw) {
    throw new Error('METAGRINDER_JUDGE_CALIBRATION is required; see src/eval/judge/README.md');
  }
  if (!modeRaw || !providerRaw || !runDirRaw
    || !['record', 'replay', 'auto'].includes(modeRaw)
    || !['anthropic', 'codex-cli'].includes(providerRaw)) {
    throw new Error('Usage: tsx src/eval/run-judge-gate.ts <record|replay|auto> <anthropic|codex-cli> <run-dir>');
  }

  const mode = modeRaw as ProviderMode;
  const providerKind = providerRaw as ProviderKind;
  const runDir = path.resolve(runDirRaw);
  const calibrationPath = path.resolve(calibrationPathRaw);
  const humanRatings = HumanCalibrationRatingSchema.array().parse(JSON.parse(
    fs.readFileSync(calibrationPath, 'utf8')
  ));
  fs.mkdirSync(runDir, { recursive: true });
  const manifestPath = path.join(runDir, 'run-manifest.json');
  const store = fs.existsSync(manifestPath)
    ? RunStore.open(runDir)
    : RunStore.create({
      baseDir: path.dirname(runDir),
      runId: path.basename(runDir),
      inputId: 'judge-calibration',
      parserVersion: '0.1.0'
    });
  const manifest = store.getManifest();
  if (manifest.runId !== path.basename(runDir) || manifest.inputId !== 'judge-calibration') {
    throw new Error('judge run identity mismatch');
  }
  const provider = buildProviderForRun({ store, kind: providerKind, mode, env });
  store.recordModel('judge', provider.id, provider.model, provider.modelVersion);
  const report = await runJudgeMetaGate({
    judge: createLlmPairwiseJudge(provider),
    cases: DEFAULT_JUDGE_STRESS_CASES,
    criteria: DEFAULT_JUDGE_CRITERIA,
    humanRatings,
    seed: 1701
  });
  const outputPath = path.join(runDir, 'judge-meta-gate.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { outputPath, report };
}

if (require.main === module) {
  runJudgeGate(process.argv.slice(2)).then(
    ({ outputPath, report }) => {
      process.stdout.write(`${outputPath}\n`);
      if (!report.passed) process.exitCode = 2;
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  );
}

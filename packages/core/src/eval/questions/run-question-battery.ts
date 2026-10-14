/**
 * CLI: pnpm eval:questions -- deterministic dev <run-dir>
 *      pnpm eval:questions -- llm record|replay anthropic|codex-cli dev <run-dir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunStore } from '../../artifacts/store';
import { buildProviderForRun, type LlmProvider, type ProviderMode } from '../../providers';
import { QuestionEvalReportSchema, type QuestionEvalReport } from '../../schemas/question-eval-report';
import type { ResearchTask } from '../../schemas/community-job';
import type { ResearchQuestionScenario } from '../../schemas/research-question-scenario';
import { askDeterministic, DETERMINISTIC_ASKER_ID } from './askers/deterministic';
import { askWithLlm, llmAskerId } from './askers/llm';
import {
  BASELINES_PATH,
  loadBaselines,
  loadDevScenarios,
  loadHoldoutScenarios,
  writeBaselines,
  type BaselineFile
} from './load';
import { aggregateScores, scoreQuestionProposals } from './scorer';

export async function runQuestionBattery(args: {
  scenarios: ResearchQuestionScenario[];
  askerId: string;
  ask: (s: ResearchQuestionScenario) => Promise<ResearchTask[]> | ResearchTask[];
  split: 'dev' | 'holdout' | 'dev+holdout';
  runId: string;
  now: string;
  k?: number;
  baselinesPath?: string;
  lockBaseline?: boolean;
}): Promise<QuestionEvalReport> {
  const k = args.k ?? 5;
  const perScenario = [];
  for (const scenario of args.scenarios) {
    const tasks = await args.ask(scenario);
    const scored = scoreQuestionProposals({ scenario, tasks, k: scenario.k ?? k });
    perScenario.push({
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      scores: scored.scores,
      topTaskIds: scored.topTaskIds,
      goldHits: scored.goldHits,
      antiHits: scored.antiHits,
      notes: scored.notes
    });
  }
  const aggregate = aggregateScores(perScenario.map((p) => p.scores));
  const baselines = loadBaselines(args.baselinesPath ?? BASELINES_PATH);

  let baselineComparison: QuestionEvalReport['baselineComparison'];
  const locked =
    args.split === 'dev' || args.split === 'dev+holdout'
      ? baselines?.dev?.deterministic
      : baselines?.holdout?.deterministic;

  if (locked && args.askerId.startsWith('deterministic')) {
    const delta = aggregate.composite - locked.composite;
    baselineComparison = {
      baselineId: `${args.split}.deterministic`,
      baselineComposite: locked.composite,
      delta,
      // allow tiny float noise; fail on true regression
      passed: aggregate.composite + 1e-9 >= locked.composite
    };
  }

  if (args.lockBaseline && args.askerId === DETERMINISTIC_ASKER_ID && args.split === 'dev') {
    const next: BaselineFile = {
      version: '0.1.0',
      notes: 'Dev baseline from deterministic L0 usefulness asker. Holdout requires human approval.',
      ...(baselines ?? {}),
      dev: {
        ...(baselines?.dev ?? {}),
        deterministic: {
          composite: aggregate.composite,
          recallAtK: aggregate.recallAtK,
          precisionAtK: aggregate.precisionAtK,
          antiRate: aggregate.antiRate,
          scenarioCount: args.scenarios.length,
          lockedAt: args.now
        }
      }
    };
    writeBaselines(next, args.baselinesPath ?? BASELINES_PATH);
  }

  return QuestionEvalReportSchema.parse({
    artifact: 'question-eval-report',
    runId: args.runId,
    inputId: `question-battery-${args.split}`,
    createdAt: args.now,
    askerId: args.askerId,
    split: args.split,
    k,
    scenarioCount: args.scenarios.length,
    aggregate,
    perScenario,
    ...(baselineComparison !== undefined ? { baselineComparison } : {})
  });
}

function writeReport(runDir: string, report: QuestionEvalReport): string {
  fs.mkdirSync(runDir, { recursive: true });
  const out = path.join(runDir, 'question-eval-report.json');
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return out;
}

export async function runQuestionCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const now = new Date().toISOString();
  const [mode, ...rest] = argv[0] === '--' ? argv.slice(1) : argv;

  if (!mode || mode === 'help' || mode === '--help') {
    process.stdout.write(
      [
        'Usage:',
        '  tsx src/eval/questions/run-question-battery.ts deterministic <dev|holdout|all> <run-dir> [--lock-baseline]',
        '  tsx src/eval/questions/run-question-battery.ts llm <record|replay|auto> <anthropic|codex-cli> <dev|holdout|all> <run-dir>',
        ''
      ].join('\n')
    );
    return mode ? 0 : 1;
  }

  if (mode === 'deterministic') {
    const split = rest[0] as 'dev' | 'holdout' | 'all';
    const runDir = rest[1] ? path.resolve(rest[1]) : '';
    const lockBaseline = rest.includes('--lock-baseline');
    if (!split || !runDir || !['dev', 'holdout', 'all'].includes(split)) {
      process.stderr.write('error: deterministic requires <dev|holdout|all> <run-dir>\n');
      return 1;
    }
    let scenarios: ResearchQuestionScenario[] = [];
    let reportSplit: 'dev' | 'holdout' | 'dev+holdout' = 'dev';
    if (split === 'dev') {
      scenarios = loadDevScenarios();
      reportSplit = 'dev';
    } else if (split === 'holdout') {
      scenarios = loadHoldoutScenarios();
      reportSplit = 'holdout';
    } else {
      scenarios = [...loadDevScenarios(), ...loadHoldoutScenarios()];
      reportSplit = 'dev+holdout';
    }

    const report = await runQuestionBattery({
      scenarios,
      askerId: DETERMINISTIC_ASKER_ID,
      ask: (s) => askDeterministic({ scenario: s, now }),
      split: reportSplit,
      runId: path.basename(runDir),
      now,
      lockBaseline: lockBaseline && split === 'dev'
    });
    const out = writeReport(runDir, report);
    process.stdout.write(
      `asker=${report.askerId} split=${report.split} n=${report.scenarioCount} composite=${report.aggregate.composite.toFixed(4)}\n`
    );
    process.stdout.write(
      `recall=${report.aggregate.recallAtK.toFixed(3)} precision=${report.aggregate.precisionAtK.toFixed(3)} anti=${report.aggregate.antiRate.toFixed(3)}\n`
    );
    if (report.baselineComparison) {
      process.stdout.write(
        `baseline delta=${report.baselineComparison.delta.toFixed(4)} passed=${report.baselineComparison.passed}\n`
      );
    }
    process.stdout.write(`wrote ${out}\n`);
    if (report.baselineComparison && !report.baselineComparison.passed) return 2;
    return 0;
  }

  if (mode === 'llm') {
    const providerMode = rest[0] as ProviderMode;
    const kind = rest[1] as 'anthropic' | 'codex-cli';
    const split = rest[2] as 'dev' | 'holdout' | 'all';
    const runDir = rest[3] ? path.resolve(rest[3]) : '';
    if (!providerMode || !kind || !split || !runDir
      || !['record', 'replay', 'auto'].includes(providerMode)
      || !['anthropic', 'codex-cli'].includes(kind)
      || !['dev', 'holdout', 'all'].includes(split)) {
      process.stderr.write('error: llm requires <record|replay|auto> <anthropic|codex-cli> <dev|holdout|all> <run-dir>\n');
      return 1;
    }
    fs.mkdirSync(runDir, { recursive: true });
    let scenarios: ResearchQuestionScenario[] = [];
    let reportSplit: 'dev' | 'holdout' | 'dev+holdout' = 'dev';
    if (split === 'dev') scenarios = loadDevScenarios();
    else if (split === 'holdout') {
      scenarios = loadHoldoutScenarios();
      reportSplit = 'holdout';
    } else {
      scenarios = [...loadDevScenarios(), ...loadHoldoutScenarios()];
      reportSplit = 'dev+holdout';
    }

    const manifestPath = path.join(runDir, 'run-manifest.json');
    const inputId = `question-battery-${reportSplit}`;
    const store = fs.existsSync(manifestPath) ? RunStore.open(runDir) : RunStore.create({
      baseDir: path.dirname(runDir), runId: path.basename(runDir), inputId, parserVersion: '0.1.0'
    });
    const manifest = store.getManifest();
    if (manifest.runId !== path.basename(runDir) || manifest.inputId !== inputId) {
      throw new Error('question battery identity mismatch');
    }
    const provider: LlmProvider = buildProviderForRun({ store, kind, mode: providerMode, env });
    store.recordModel('question-asker', provider.id, provider.model, provider.modelVersion);

    const report = await runQuestionBattery({
      scenarios,
      askerId: llmAskerId(provider.id, provider.model),
      ask: (s) => askWithLlm({ scenario: s, provider }),
      split: reportSplit,
      runId: path.basename(runDir),
      now
    });
    const out = writeReport(runDir, report);
    process.stdout.write(`asker=${report.askerId} composite=${report.aggregate.composite.toFixed(4)}\nwrote ${out}\n`);
    return 0;
  }

  process.stderr.write(`Unknown mode: ${mode}\n`);
  return 1;
}

if (require.main === module) {
  runQuestionCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    });
}

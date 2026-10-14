/**
 * CLI: pnpm run:community-job -- evaluate --job <path|fixtureId> --out <dir>
 *      pnpm run:community-job -- run --job <path|fixtureId> --out <baseDir>
 *      pnpm run:community-job -- list
 *
 * L0 only: validate job → coverage report → ranked research tasks → nextAction.
 * `run` also ingests, drafts deterministic grammar, samples plans, realizes templates.
 * Does not run LLM extract, approve intake, or promote UTDG.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommunityCoverageReport, CommunityJob } from '../schemas/community-job';
import { buildProviderForRun, type ProviderMode } from '../providers';
import { evaluateCommunityJobL0 } from './evaluate';
import { runCommunityJobL0, type CommunityJobRunResult } from './runner';

export const DEFAULT_FIXTURES_DIR = path.join(__dirname, '__fixtures__');
export const REPORT_FILE_NAME = 'community-coverage-report.json';

export function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) return undefined;
  return v;
}

export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

/** Collect all values for a repeated flag, e.g. --notes a.md --notes b.md */
export function argValues(argv: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) {
      const v = argv[i + 1];
      if (v !== undefined && !v.startsWith('--')) {
        out.push(v);
        i += 1;
      }
    }
  }
  return out;
}

export function listCommunityFixtures(fixturesDir: string = DEFAULT_FIXTURES_DIR): Array<{
  fileName: string;
  jobId: string;
  title: string;
  path: string;
}> {
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((fileName) => {
      const full = path.join(fixturesDir, fileName);
      let jobId = path.basename(fileName, '.json');
      let title = jobId;
      try {
        const raw = JSON.parse(fs.readFileSync(full, 'utf8')) as {
          jobId?: string;
          title?: string;
        };
        if (typeof raw.jobId === 'string' && raw.jobId.length > 0) jobId = raw.jobId;
        if (typeof raw.title === 'string' && raw.title.length > 0) title = raw.title;
      } catch {
        // list still works for unreadable/corrupt files; evaluate will fail later
      }
      return { fileName, jobId, title, path: full };
    });
}

/**
 * Resolve --job to an absolute path.
 * Accepts a filesystem path, a fixture basename, or a jobId matching a fixture.
 */
export function resolveJobPath(
  jobArg: string,
  fixturesDir: string = DEFAULT_FIXTURES_DIR
): string {
  const asPath = path.resolve(jobArg);
  if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) {
    return asPath;
  }

  const bare = jobArg.replace(/\.json$/i, '');
  const fixtures = listCommunityFixtures(fixturesDir);
  const byFile = fixtures.find(
    (f) => f.fileName === jobArg || f.fileName === `${bare}.json` || f.jobId === bare
  );
  if (byFile) return byFile.path;

  throw new Error(
    `Job not found: ${jobArg}\n` +
      `Tried path ${asPath} and fixtures under ${fixturesDir}.\n` +
      `Use "list" to see pilot job ids.`
  );
}

export function loadCommunityJobJson(jobPath: string): unknown {
  const text = fs.readFileSync(jobPath, 'utf8');
  return JSON.parse(text);
}

export function writeCoverageReport(args: {
  report: CommunityCoverageReport;
  outDir: string;
  fileName?: string;
}): string {
  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, args.fileName ?? REPORT_FILE_NAME);
  fs.writeFileSync(reportPath, `${JSON.stringify(args.report, null, 2)}\n`, 'utf8');
  return reportPath;
}

export function evaluateJobToDisk(args: {
  jobPath: string;
  outDir: string;
  runId?: string;
  cellId?: string;
  now?: string;
  suggestMissingSlotTasks?: boolean;
}): {
  job: CommunityJob;
  report: CommunityCoverageReport;
  reportPath: string;
} {
  const raw = loadCommunityJobJson(args.jobPath);
  const jobId =
    typeof raw === 'object' && raw !== null && 'jobId' in raw && typeof (raw as { jobId: unknown }).jobId === 'string'
      ? (raw as { jobId: string }).jobId
      : path.basename(args.jobPath, path.extname(args.jobPath));
  const now = args.now ?? new Date().toISOString();
  const runId = args.runId ?? `run_${jobId}_${now.replace(/[:.]/g, '-')}`;

  const { job, report } = evaluateCommunityJobL0({
    job: raw,
    runId,
    now,
    ...(args.cellId !== undefined ? { cellId: args.cellId } : {}),
    ...(args.suggestMissingSlotTasks !== undefined
      ? { suggestMissingSlotTasks: args.suggestMissingSlotTasks }
      : {})
  });

  const reportPath = writeCoverageReport({ report, outDir: args.outDir });
  return { job, report, reportPath };
}

function usage(): string {
  return [
    'Usage:',
    '  tsx src/community/cli.ts evaluate --job <path|fixtureId> --out <dir> [options]',
    '  tsx src/community/cli.ts run --job <path|fixtureId> --out <baseDir> [options]',
    '  tsx src/community/cli.ts list [--fixtures-dir <dir>]',
    '',
    'evaluate options:',
    '  --job <path|id>     Community job JSON path, fixture basename, or jobId',
    '  --out <dir>         Directory for community-coverage-report.json',
    '  --run-id <id>       Optional run id (default: run_<jobId>_<timestamp>)',
    '  --cell-id <id>      Optional cell id on the report',
    '  --fixtures-dir <d>  Fixture search dir (default: src/community/__fixtures__)',
    '  --no-suggest        Do not auto-append research tasks for weak slots',
    '',
    'run options (L0 pipeline into RunStore under <baseDir>/<runId>/):',
    '  --job / --out / --run-id / --cell-id / --fixtures-dir / --no-suggest  (same as evaluate)',
    '  --notes <path>      Extra research notes file (repeatable)',
    '  --seed <n>          Content-plan seed (default 73)',
    '  --plans <n>         Content-plan count (default 12)',
    '  --no-review         Skip review.html generation',
    '  --with-llm          Run extract + grammar via provider (still L0 / not trusted)',
    '  --provider <name>   anthropic | codex-cli (default anthropic when --with-llm)',
    '  --mode <mode>       record | replay | auto (default auto)',
    '  --model <id>        Optional provider model override',
    '  --rerun             Rebuild completed stages (record mode spends again)',
    'Paid runs reuse run_<jobId> by default; --run-id selects a separate run.',
    '',
    'Default: deterministic grammar; extract blocked without --with-llm.',
    'no approvals; productionTrusted always false.'
  ].join('\n');
}

function printSummary(job: CommunityJob, report: CommunityCoverageReport, reportPath: string): void {
  const weak = report.coverage.filter(
    (e) => e.priority >= 0.5 && (e.status === 'empty' || e.status === 'thin')
  );
  const top = report.rankedResearchTasks.slice(0, 5);
  const lines = [
    `job: ${job.jobId} — ${job.title}`,
    `stance: ${report.stance}  trust: ${report.trustLevel}  productionTrusted: ${report.productionTrusted}`,
    `coverage: ${report.coverage.length} slots, ${weak.length} weak (empty/thin, priority≥0.5)`,
    `nextAction: ${report.nextAction.kind}${report.nextAction.taskId ? ` (${report.nextAction.taskId})` : ''}`,
    `  ${report.nextAction.detail}`,
    `top research tasks (${report.rankedResearchTasks.length} ranked):`
  ];
  for (const t of top) {
    const score = t.score !== undefined ? t.score.toFixed(3) : '?';
    lines.push(`  [${score}] ${t.taskId}: ${t.title}`);
  }
  lines.push(`wrote: ${reportPath}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function printRunSummary(result: CommunityJobRunResult): void {
  const extractNote = result.completedStages.includes('extract')
    ? `complete (${result.extraction?.analysisMode ?? 'llm'})`
    : 'blocked (llm-provider)';
  const lines = [
    `job: ${result.job.jobId} — ${result.job.title}`,
    `runDir: ${result.runDir}`,
    `stages: ${result.completedStages.join(' → ')}`,
    `extract: ${extractNote}`,
    `grammar: ${result.grammarMode} / ${result.grammar.grammarTarget} (${result.grammar.archetypes.length} archetypes, ${result.grammar.locationZones.length} zones)`,
    `plans: ${result.contentPlans?.plans.length ?? 0}  realized: ${result.contentPlans?.realized.length ?? 0}`,
    `nextAction: ${result.report.nextAction.kind}${result.report.nextAction.taskId ? ` (${result.report.nextAction.taskId})` : ''}`,
    `productionTrusted: ${result.productionTrusted}`,
    ...(result.reviewHtmlPath ? [`review.html: ${result.reviewHtmlPath}`] : []),
    ...result.notes.map((n) => `note: ${n}`)
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

/** Drop a leading bare `--` so `pnpm run:community-job -- list` works. */
export function normalizeArgv(argv: string[]): string[] {
  if (argv[0] === '--') return argv.slice(1);
  return argv;
}

export async function runCommunityCli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = normalizeArgv(argv);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    process.stdout.write(`${usage()}\n`);
    return cmd ? 0 : 1;
  }

  if (cmd === 'list') {
    const fixturesDir = argValue(rest, '--fixtures-dir')
      ? path.resolve(argValue(rest, '--fixtures-dir')!)
      : DEFAULT_FIXTURES_DIR;
    const fixtures = listCommunityFixtures(fixturesDir);
    if (fixtures.length === 0) {
      process.stdout.write(`No fixtures in ${fixturesDir}\n`);
      return 0;
    }
    for (const f of fixtures) {
      process.stdout.write(`${f.jobId}\t${f.title}\t${f.path}\n`);
    }
    return 0;
  }

  if (cmd === 'evaluate') {
    const jobArg = argValue(rest, '--job');
    const outDir = argValue(rest, '--out');
    if (!jobArg || !outDir) {
      process.stderr.write(`${usage()}\n`);
      process.stderr.write('\nerror: evaluate requires --job and --out\n');
      return 1;
    }
    const fixturesDir = argValue(rest, '--fixtures-dir')
      ? path.resolve(argValue(rest, '--fixtures-dir')!)
      : DEFAULT_FIXTURES_DIR;
    const jobPath = resolveJobPath(jobArg, fixturesDir);
    const runId = argValue(rest, '--run-id');
    const cellId = argValue(rest, '--cell-id');
    const result = evaluateJobToDisk({
      jobPath,
      outDir: path.resolve(outDir),
      ...(runId !== undefined ? { runId } : {}),
      ...(cellId !== undefined ? { cellId } : {}),
      ...(hasFlag(rest, '--no-suggest') ? { suggestMissingSlotTasks: false as const } : {})
    });
    printSummary(result.job, result.report, result.reportPath);
    return 0;
  }

  if (cmd === 'run') {
    const jobArg = argValue(rest, '--job');
    const outDir = argValue(rest, '--out');
    if (!jobArg || !outDir) {
      process.stderr.write(`${usage()}\n`);
      process.stderr.write('\nerror: run requires --job and --out\n');
      return 1;
    }
    const fixturesDir = argValue(rest, '--fixtures-dir')
      ? path.resolve(argValue(rest, '--fixtures-dir')!)
      : DEFAULT_FIXTURES_DIR;
    const jobPath = resolveJobPath(jobArg, fixturesDir);
    const raw = loadCommunityJobJson(jobPath);
    const runId = argValue(rest, '--run-id');
    const cellId = argValue(rest, '--cell-id');
    const seedRaw = argValue(rest, '--seed');
    const plansRaw = argValue(rest, '--plans');
    const seed = seedRaw !== undefined ? Number(seedRaw) : undefined;
    const planCount = plansRaw !== undefined ? Number(plansRaw) : undefined;
    if (seed !== undefined && !Number.isFinite(seed)) {
      process.stderr.write('error: --seed must be a number\n');
      return 1;
    }
    if (planCount !== undefined && (!Number.isFinite(planCount) || planCount < 0)) {
      process.stderr.write('error: --plans must be a non-negative number\n');
      return 1;
    }

    const baseDir = path.resolve(outDir);
    const withLlm = hasFlag(rest, '--with-llm');
    const jobIdHint =
      typeof raw === 'object' && raw !== null && 'jobId' in raw && typeof (raw as { jobId: unknown }).jobId === 'string'
        ? (raw as { jobId: string }).jobId
        : 'job';
    // Pin runId when using LLM so provider cache lives in the same RunStore folder.
    const resolvedRunId = runId
      ?? (withLlm ? `run_${jobIdHint}` : undefined);

    let providerForRun: Parameters<typeof runCommunityJobL0>[0]['providerForRun'];
    if (withLlm) {
      const providerKind = (argValue(rest, '--provider') ?? 'anthropic') as 'anthropic' | 'codex-cli';
      if (providerKind !== 'anthropic' && providerKind !== 'codex-cli') {
        process.stderr.write('error: --provider must be anthropic or codex-cli\n');
        return 1;
      }
      const mode = (argValue(rest, '--mode') ?? 'auto') as ProviderMode;
      if (mode !== 'record' && mode !== 'replay' && mode !== 'auto') {
        process.stderr.write('error: --mode must be record | replay | auto\n');
        return 1;
      }
      const model = argValue(rest, '--model');
      providerForRun = (store) => buildProviderForRun({
        store,
        kind: providerKind,
        mode,
        ...(model !== undefined ? { model } : {})
      });
    }

    const result = await runCommunityJobL0({
      job: raw,
      baseDir,
      ...(resolvedRunId !== undefined ? { runId: resolvedRunId } : {}),
      ...(cellId !== undefined ? { cellId } : {}),
      ...(seed !== undefined ? { seed } : {}),
      ...(planCount !== undefined ? { planCount } : {}),
      notesPaths: argValues(rest, '--notes'),
      ...(hasFlag(rest, '--no-suggest') ? { suggestMissingSlotTasks: false as const } : {}),
      ...(hasFlag(rest, '--no-review') ? { writeReviewHtml: false as const } : {}),
      forceRerun: hasFlag(rest, '--rerun'),
      ...(providerForRun !== undefined ? { providerForRun } : {})
    });
    printRunSummary(result);
    return 0;
  }

  process.stderr.write(`Unknown command: ${cmd}\n${usage()}\n`);
  return 1;
}

function main(): void {
  runCommunityCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${msg}\n`);
      process.exitCode = 1;
    });
}

if (require.main === module) {
  main();
}

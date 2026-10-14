import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  DEFAULT_FIXTURES_DIR,
  REPORT_FILE_NAME,
  argValue,
  evaluateJobToDisk,
  hasFlag,
  listCommunityFixtures,
  normalizeArgv,
  resolveJobPath,
  runCommunityCli
} from './cli';
import { CommunityCoverageReportSchema } from '../schemas/community-job';

const APOLLO_ID = 'crowd_apollo_ksc_control_room';

describe('community job CLI helpers', () => {
  test('argValue and hasFlag parse argv', () => {
    const argv = ['evaluate', '--job', 'x.json', '--out', 'tmp', '--no-suggest'];
    expect(argValue(argv, '--job')).toBe('x.json');
    expect(argValue(argv, '--out')).toBe('tmp');
    expect(argValue(argv, '--run-id')).toBeUndefined();
    expect(hasFlag(argv, '--no-suggest')).toBe(true);
    expect(hasFlag(argv, '--cell-id')).toBe(false);
  });

  test('normalizeArgv drops leading bare -- from pnpm', () => {
    expect(normalizeArgv(['--', 'list'])).toEqual(['list']);
    expect(normalizeArgv(['list'])).toEqual(['list']);
  });

  test('listCommunityFixtures returns four pilot jobs', () => {
    const fixtures = listCommunityFixtures(DEFAULT_FIXTURES_DIR);
    expect(fixtures.length).toBe(4);
    const ids = fixtures.map((f) => f.jobId).sort();
    expect(ids).toEqual([
      'crowd_1965_ut_austin_football',
      'crowd_1970s_upper_midwest_fast_food',
      'crowd_1990s_christian_music_festival',
      'crowd_apollo_ksc_control_room'
    ].sort());
    for (const f of fixtures) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(fs.existsSync(f.path)).toBe(true);
    }
  });

  test('resolveJobPath accepts jobId, basename, and absolute path', () => {
    const byId = resolveJobPath(APOLLO_ID);
    expect(byId.endsWith(`${APOLLO_ID}.json`)).toBe(true);

    const byBase = resolveJobPath(`${APOLLO_ID}.json`);
    expect(byBase).toBe(byId);

    const byPath = resolveJobPath(byId);
    expect(byPath).toBe(path.resolve(byId));
  });

  test('resolveJobPath throws for unknown job', () => {
    expect(() => resolveJobPath('not_a_real_job_xyz')).toThrow(/Job not found/);
  });
});

describe('evaluateJobToDisk', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-community-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('writes validated community-coverage-report.json', () => {
    const jobPath = resolveJobPath(APOLLO_ID);
    const { report, reportPath, job } = evaluateJobToDisk({
      jobPath,
      outDir: tmp,
      runId: 'run_cli_test',
      now: '2026-07-15T23:30:00.000Z',
      cellId: 'cell_cli_test'
    });

    expect(reportPath).toBe(path.join(tmp, REPORT_FILE_NAME));
    expect(fs.existsSync(reportPath)).toBe(true);

    const onDisk = CommunityCoverageReportSchema.parse(
      JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    );
    expect(onDisk.artifact).toBe('community-coverage-report');
    expect(onDisk.jobId).toBe(job.jobId);
    expect(onDisk.runId).toBe('run_cli_test');
    expect(onDisk.cellId).toBe('cell_cli_test');
    expect(onDisk.productionTrusted).toBe(false);
    expect(onDisk.trustLevel).toBe('L0_researcher');
    expect(onDisk.rankedResearchTasks.length).toBeGreaterThan(0);
    expect(onDisk.nextAction.kind).toBe('research_task');
    expect(onDisk.nextAction.taskId).toBeTruthy();
    expect(report.productionTrusted).toBe(false);
  });

  test('--no-suggest path does not invent extra task ids beyond seed', () => {
    const jobPath = resolveJobPath(APOLLO_ID);
    const raw = JSON.parse(fs.readFileSync(jobPath, 'utf8')) as {
      researchTasks: Array<{ taskId: string }>;
    };
    const seedIds = new Set(raw.researchTasks.map((t) => t.taskId));

    const { report } = evaluateJobToDisk({
      jobPath,
      outDir: tmp,
      runId: 'run_no_suggest',
      now: '2026-07-15T23:31:00.000Z',
      suggestMissingSlotTasks: false
    });

    for (const t of report.rankedResearchTasks) {
      expect(seedIds.has(t.taskId)).toBe(true);
    }
  });
});

describe('runCommunityCli', () => {
  let tmp: string;
  let stdout: string[];
  let stderr: string[];
  let outWrite: typeof process.stdout.write;
  let errWrite: typeof process.stderr.write;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-community-cli-main-'));
    stdout = [];
    stderr = [];
    outWrite = process.stdout.write.bind(process.stdout);
    errWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('list prints job ids', async () => {
    const code = await runCommunityCli(['list']);
    expect(code).toBe(0);
    const text = stdout.join('');
    expect(text).toContain(APOLLO_ID);
    expect(text).toContain('crowd_1990s_christian_music_festival');
  });

  test('list works when pnpm injects leading --', async () => {
    const code = await runCommunityCli(['--', 'list']);
    expect(code).toBe(0);
    expect(stdout.join('')).toContain(APOLLO_ID);
  });

  test('evaluate writes report and prints nextAction', async () => {
    const code = await runCommunityCli([
      'evaluate',
      '--job',
      APOLLO_ID,
      '--out',
      tmp,
      '--run-id',
      'run_cli_main'
    ]);
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tmp, REPORT_FILE_NAME))).toBe(true);
    const text = stdout.join('');
    expect(text).toMatch(/nextAction:/);
    expect(text).toMatch(/wrote:/);
    expect(text).toMatch(/productionTrusted: false/);
  });

  test('evaluate without args exits 1', async () => {
    const code = await runCommunityCli(['evaluate']);
    expect(code).toBe(1);
    expect(stderr.join('')).toMatch(/requires --job and --out/);
  });

  test('unknown command exits 1', async () => {
    const code = await runCommunityCli(['explode']);
    expect(code).toBe(1);
    expect(stderr.join('')).toMatch(/Unknown command/);
  });
});

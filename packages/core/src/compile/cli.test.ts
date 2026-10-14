import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RunStore } from '../artifacts/store';
import { historicalCrowdGrammar } from './__fixtures__/historical-crowd-grammar';
import { parseCompileArguments, runCompileCli } from './cli';

const NOW = () => '2026-10-14T12:00:00.000Z';
const ROOT = path.resolve(__dirname, '../../../..');

test('[AC-2.2c.3] compile arguments use literal paths and only the explicit rerun flag', () => {
  const input = 'a directory with spaces';
  expect(parseCompileArguments(['--', input])).toEqual({ runDir: path.resolve(input), forceRerun: false });
  expect(parseCompileArguments([input, '--rerun']).forceRerun).toBe(true);
  for (const args of [[], ['--rerun'], [input, '--provider'], [input, '--rerun', '--rerun']]) {
    expect(() => parseCompileArguments(args)).toThrow(/Usage/);
  }
});

test('[AC-2.2c.3] CLI compiles an existing run with native outputs and no accepted grammar or paid usage', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-compile-cli-'));
  try {
    const store = RunStore.create({ baseDir: root, runId: 'compile_cli', inputId: 'scene', parserVersion: '0.1.0', now: NOW });
    store.writeArtifact('scene-grammar', 'scene-grammar.json', { ...historicalCrowdGrammar(NOW()),
      runId: 'compile_cli', inputId: 'scene' }, NOW);
    const result = await runCompileCli(['--', store.runDir], { now: NOW });
    expect(result.outputPaths).toHaveLength(7);
    const command = spawnSync(process.execPath, ['--require', 'tsx/cjs', 'src/compile/cli.ts', store.runDir], {
      cwd: path.join(ROOT, 'packages/core'), encoding: 'utf8', windowsHide: true
    });
    expect(command.status).toBe(0);
    const output = JSON.parse(command.stdout);
    expect(output).toMatchObject({ comparisonStatus: 'base-only', scope: 'compiled-structure-only', approval: 'not-conferred' });
    expect(output.materialDifference).toBeUndefined();
    expect(store.getBudgetLedgers()[0]!.usage.llmCalls).toBe(0);
  } finally {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('CLI cleanup escaped temp root');
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[AC-2.2c.5] root and core expose the consumed compile command', () => {
  const root = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const core = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/package.json'), 'utf8'));
  expect(root.scripts['compile:run']).toBe('pnpm --filter @promptscape/core compile:run');
  expect(core.scripts['compile:run']).toBe('tsx src/compile/cli.ts');
});

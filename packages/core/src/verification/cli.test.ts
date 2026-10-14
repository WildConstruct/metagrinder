import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildVerificationSteps,
  executeVerificationStep,
  REPOSITORY_ROOT,
  verifyReimplementation,
  type VerificationStep
} from './cli';

const PIN = fs.readFileSync(path.join(REPOSITORY_ROOT, '.nvmrc'), 'utf8').trim();

describe('canonical reimplementation verification', () => {
  test('requires the exact repository Node pin before invoking any check', async () => {
    const executor = jest.fn(async () => 0);
    const error = jest.fn();
    for (const nodeVersion of ['20.18.0', '20.19.1', '22.0.0']) {
      expect(await verifyReimplementation({ executor, nodeVersion, error, log: () => {} })).toBe(1);
    }
    expect(PIN).toBe('20.19.0');
    expect(executor).not.toHaveBeenCalled();
    expect(error.mock.calls[0]![0]).toContain('20.19.0');
  });

  test('runs complete source/legacy tests and read-only contracts in a fixed order from the repository root', async () => {
    const observed: VerificationStep[] = [];
    const executor = jest.fn(async (step: VerificationStep) => { observed.push(step); return 0; });
    expect(await verifyReimplementation({ executor, nodeVersion: PIN, log: () => {}, error: () => {}, env: {} })).toBe(0);
    expect(observed.map((step) => step.name)).toEqual([
      'strict source TypeScript', 'reimplementation Jest suite', 'legacy Jest suite',
      'generated JSON Schema freshness', 'Python contract smoke'
    ]);
    expect(observed.every((step) => step.cwd === REPOSITORY_ROOT)).toBe(true);
    expect(observed.slice(0, 4).every((step) => step.command === process.execPath)).toBe(true);
    expect(observed[0]!.args).toEqual([require.resolve('typescript/bin/tsc'), '--noEmit', '-p', 'packages/core/src/tsconfig.json']);
    expect(observed[1]!.args).toEqual([require.resolve('jest/bin/jest'), '--config', 'packages/core/jest.src.config.cjs', '--runInBand']);
    expect(observed[2]!.args).toEqual([require.resolve('jest/bin/jest'), '--config', 'packages/core/jest.metagrinder.config.cjs', '--runInBand']);
    expect(observed[3]!.args).toEqual(['--require', require.resolve('tsx/cjs'), path.join(REPOSITORY_ROOT, 'packages/core/src/schemas/emit-json-schema.ts'), '--check']);
    expect(observed[4]!.args).toEqual(['contracts/check_json_schema_consumable.py']);
    expect(observed.flatMap((step) => step.args).join(' ')).not.toMatch(/run-corpus|run-holdout|run-judge|--updateSnapshot/);
  });

  test('every failed check stops later checks and propagates a nonzero exit status', async () => {
    for (let failedStep = 0; failedStep < 5; failedStep++) {
      let index = 0;
      const executor = jest.fn(async () => index++ === failedStep ? 7 : 0);
      expect(await verifyReimplementation({ executor, nodeVersion: PIN, log: () => {}, error: () => {} })).toBe(7);
      expect(executor).toHaveBeenCalledTimes(failedStep + 1);
    }
  });

  test('executor errors fail closed without running later checks', async () => {
    const executor = jest.fn(async () => { throw new Error('check executable unavailable'); });
    const error = jest.fn();
    expect(await verifyReimplementation({ executor, nodeVersion: PIN, log: () => {}, error })).toBe(1);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(error.mock.calls.some(([message]) => String(message).includes('check executable unavailable'))).toBe(true);
  });

  test('Python selection supports native platform defaults and one literal command path', () => {
    expect(buildVerificationSteps({ platform: 'win32', env: {} })[4]!.command).toBe('python');
    expect(buildVerificationSteps({ platform: 'linux', env: {} })[4]!.command).toBe('python3');
    const command = 'C:\\Tools With Spaces\\Python\\python.exe';
    const step = buildVerificationSteps({ platform: 'win32', env: { METAGRINDER_VERIFY_PYTHON: command } })[4]!;
    expect(step.command).toBe(command);
    expect(step.args).toEqual(['contracts/check_json_schema_consumable.py']);
  });

  test('native execution never uses a shell and reports spawn failures as nonzero', () => {
    const native = require('node:child_process') as typeof childProcess;
    const spawn = jest.spyOn(native, 'spawnSync').mockReturnValue({ status: 0, signal: null, pid: 1, output: [], stdout: null, stderr: null });
    try {
      const step = buildVerificationSteps({ env: {} })[0]!;
      expect(executeVerificationStep(step)).toBe(0);
      expect(spawn).toHaveBeenCalledWith(step.command, step.args, expect.objectContaining({ cwd: REPOSITORY_ROOT, shell: false, stdio: 'inherit' }));
      spawn.mockReturnValue({ status: null, signal: 'SIGTERM', pid: 1, output: [], stdout: null, stderr: null });
      expect(executeVerificationStep(step)).not.toBe(0);
    } finally { spawn.mockRestore(); }
  });
});

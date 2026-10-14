import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

export const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');

export interface VerificationStep {
  name: string;
  command: string;
  args: string[];
  cwd: string;
}

export type StepExecutor = (step: VerificationStep) => number | Promise<number>;

/** Every JavaScript check inherits the verified Node binary, never a PATH shim. */
export function buildVerificationSteps(options: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
} = {}): VerificationStep[] {
  const env = options.env ?? process.env;
  const nodeStep = (name: string, args: string[]): VerificationStep => ({
    name, command: process.execPath, args, cwd: REPOSITORY_ROOT
  });
  return [
    nodeStep('strict source TypeScript', [require.resolve('typescript/bin/tsc'), '--noEmit', '-p', 'packages/core/src/tsconfig.json']),
    nodeStep('reimplementation Jest suite', [require.resolve('jest/bin/jest'), '--config', 'packages/core/jest.src.config.cjs', '--runInBand']),
    nodeStep('legacy Jest suite', [require.resolve('jest/bin/jest'), '--config', 'packages/core/jest.metagrinder.config.cjs', '--runInBand']),
    nodeStep('generated JSON Schema freshness', [
      '--require', require.resolve('tsx/cjs'),
      path.join(REPOSITORY_ROOT, 'packages/core/src/schemas/emit-json-schema.ts'), '--check'
    ]),
    {
      name: 'Python contract smoke',
      command: env.METAGRINDER_VERIFY_PYTHON?.trim()
        || ((options.platform ?? process.platform) === 'win32' ? 'python' : 'python3'),
      args: ['contracts/check_json_schema_consumable.py'],
      cwd: REPOSITORY_ROOT
    }
  ];
}

function failureStatus(status: number | null): number {
  return status !== null && Number.isInteger(status) && status > 0 && status <= 255 ? status : 1;
}

/** Literal executable + argument array: no shell interpretation or check-time edits. */
export function executeVerificationStep(step: VerificationStep): number {
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd, stdio: 'inherit', shell: false, windowsHide: true
  });
  if (result.error) throw result.error;
  return result.status === 0 ? 0 : failureStatus(result.status);
}

export async function verifyReimplementation(options: {
  executor?: StepExecutor;
  nodeVersion?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  log?: (message: string) => void;
  error?: (message: string) => void;
} = {}): Promise<number> {
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  const error = options.error ?? ((message: string) => process.stderr.write(`${message}\n`));
  try {
    const pinned = fs.readFileSync(path.join(REPOSITORY_ROOT, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
    const actual = (options.nodeVersion ?? process.versions.node).replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+$/.test(pinned)) throw new Error('.nvmrc must contain an exact Node version');
    if (actual !== pinned) {
      error(`Node ${pinned} is required by .nvmrc; found ${actual}.`);
      return 1;
    }
    const executor = options.executor ?? executeVerificationStep;
    const steps = buildVerificationSteps({
      ...(options.env !== undefined ? { env: options.env } : {}),
      ...(options.platform !== undefined ? { platform: options.platform } : {})
    });
    for (const step of steps) {
      log(`[verify] ${step.name}`);
      const status = await executor(step);
      if (status !== 0) {
        error(`Verification failed: ${step.name} (exit ${status}).`);
        return failureStatus(status);
      }
    }
    log('Reimplementation verification passed.');
    return 0;
  } catch (cause) {
    error(`Verification failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return 1;
  }
}

if (require.main === module) {
  verifyReimplementation().then((status) => { process.exitCode = status; });
}

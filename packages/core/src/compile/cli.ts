import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import { compileRunPsgs, type CompileRunResult } from './run';

export function parseCompileArguments(argv: string[]): { runDir: string; forceRerun: boolean } {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  if (!args[0] || args[0].startsWith('--') || args.length > 2
    || (args[1] !== undefined && args[1] !== '--rerun')) {
    throw new Error('Usage: pnpm compile:run -- <existing-run-dir> [--rerun]');
  }
  return { runDir: path.resolve(args[0]), forceRerun: args[1] === '--rerun' };
}

/** Offline, deterministic: only existing run artifacts are consumed. */
export async function runCompileCli(argv: string[], options: { now?: () => string } = {}): Promise<CompileRunResult> {
  const args = parseCompileArguments(argv);
  const store = RunStore.open(args.runDir);
  return compileRunPsgs({ store, forceRerun: args.forceRerun,
    ...(options.now !== undefined ? { now: options.now } : {}) });
}

if (require.main === module) {
  runCompileCli(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify({ comparisonStatus: result.comparisonStatus, outputPaths: result.outputPaths,
      ...(result.diff ? { materialDifference: result.diff.materialDifference } : {}),
      scope: 'compiled-structure-only', approval: 'not-conferred' }, null, 2)}\n`);
  }).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

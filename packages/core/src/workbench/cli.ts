/**
 * CLI: pnpm run:workbench-thin -- --runs <dir> --port 5175
 */
import * as path from 'node:path';
import { startWorkbenchServer } from './server';

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const runs = argValue(argv, '--runs')
  ?? process.env.METAGRINDER_RUNS_ROOT
  ?? path.resolve(process.cwd(), 'tmp/metagrinder-workbench-runs');
const port = Number(argValue(argv, '--port') ?? process.env.PORT ?? 5175);

startWorkbenchServer({
  runsRoot: path.resolve(runs),
  port: Number.isFinite(port) ? port : 5175
});

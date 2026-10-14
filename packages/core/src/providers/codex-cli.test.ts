import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { codexCliTransport } from './codex-cli';
import { buildProvider, ReplayMissError } from './index';

const temporaryDirs: string[] = [];
const fakeCli = [
  "let input = '';",
  "process.stdin.setEncoding('utf8');",
  "process.stdin.on('data', (chunk) => { input += chunk; });",
  "process.stdin.on('end', () => {",
  '  const args = process.argv.slice(2);',
  "  const pidFile = args.indexOf('--pid-file');",
  "  if (pidFile !== -1) require('node:fs').writeFileSync(args[pidFile + 1], JSON.stringify({ parent: process.pid }));",
  "  const childFile = args.indexOf('--spawn-child');",
  "  if (childFile !== -1) {",
  "    const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
  "    require('node:fs').writeFileSync(args[childFile + 1], JSON.stringify({ parent: process.pid, child: child.pid }));",
  '    setInterval(() => {}, 1000); return;',
  '  }',
  "  if (args.includes('--hang')) { setInterval(() => {}, 1000); return; }",
  "  if (args.includes('--fail')) { process.stderr.write('fake CLI failed'); process.exitCode = 7; return; }",
  '  process.stdout.write(JSON.stringify({ args, input, executable: process.execPath }));',
  '});'
].join('\n');

function temporaryDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-codex-cli-'));
  temporaryDirs.push(dir);
  return dir;
}

function writeFakeCli(entrypoint: string): void {
  fs.mkdirSync(path.dirname(entrypoint), { recursive: true });
  fs.writeFileSync(entrypoint, fakeCli, 'utf8');
}

const request = { stage: 'extract', system: 'System text', prompt: 'Prompt text', schemaName: 'fixture' };

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function stopped(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!isRunning(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return !isRunning(pid);
}

function cleanupOwnedPid(pid: number | undefined): void {
  if (pid !== undefined && isRunning(pid)) process.kill(pid, 'SIGKILL');
}

afterEach(() => {
  for (const dir of temporaryDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Codex CLI startup boundary', () => {
  test('explicit JS entrypoints run through the current Node executable with exact arguments and stdin', async () => {
    const entrypoint = path.join(temporaryDir(), 'a directory with spaces', 'fake-codex.cjs');
    writeFakeCli(entrypoint);
    const { transport } = codexCliTransport({ command: entrypoint, model: 'test-model',
      extraArgs: ['--cd', 'a path with spaces', '--config', 'key="value & literal"'], timeoutMs: 5000 });
    const result = await transport(request);
    expect(JSON.parse(result.rawText)).toEqual({
      args: ['exec', '--model', 'test-model', '--cd', 'a path with spaces', '--config', 'key="value & literal"'],
      input: 'System text\n\nPrompt text', executable: process.execPath
    });
  });

  test('npm Windows shims resolve the adjacent Codex package without executing the batch file', async () => {
    const dir = temporaryDir();
    const entrypoint = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    writeFakeCli(entrypoint);
    const shim = path.join(dir, 'codex.cmd');
    fs.writeFileSync(shim, '@echo off\r\nexit /b 99\r\n', 'utf8');
    const { transport } = codexCliTransport({ command: shim, model: 'test-model', timeoutMs: 5000 });
    const result = await transport(request);
    expect(JSON.parse(result.rawText).args).toEqual(['exec', '--model', 'test-model']);
  });

  test('workspace .bin Windows shims resolve their sibling Codex package', async () => {
    const dir = temporaryDir();
    const entrypoint = path.join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    writeFakeCli(entrypoint);
    const shim = path.join(dir, 'node_modules', '.bin', 'codex.cmd');
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.writeFileSync(shim, '@echo off\r\nexit /b 99\r\n', 'utf8');
    const { transport } = codexCliTransport({ command: shim, timeoutMs: 5000 });
    expect(JSON.parse((await transport(request)).rawText).executable).toBe(process.execPath);
  });

  test('a missing CLI is resolved only when a live transport invocation occurs', async () => {
    const missing = path.join(temporaryDir(), 'missing-codex.cmd');
    expect(() => codexCliTransport({ command: missing })).not.toThrow();
    await expect(codexCliTransport({ command: missing }).transport(request)).rejects.toThrow();
    const previous = process.env.METAGRINDER_CODEX_COMMAND;
    process.env.METAGRINDER_CODEX_COMMAND = missing;
    try {
      const provider = buildProvider({ runDir: temporaryDir(), kind: 'codex-cli', mode: 'replay' });
      await expect(provider.complete({ stage: 'extract', prompt: 'unused', schema: z.object({}), schemaName: 'empty' }))
        .rejects.toBeInstanceOf(ReplayMissError);
    } finally {
      if (previous === undefined) delete process.env.METAGRINDER_CODEX_COMMAND;
      else process.env.METAGRINDER_CODEX_COMMAND = previous;
    }
  });

  test('nonzero CLI exit reports stderr and releases the timeout', async () => {
    const entrypoint = path.join(temporaryDir(), 'fake-codex.cjs');
    writeFakeCli(entrypoint);
    const { transport } = codexCliTransport({ command: entrypoint, extraArgs: ['--fail'], timeoutMs: 5000 });
    await expect(transport(request)).rejects.toThrow(/codex exited 7: fake CLI failed/);
  });

  test('a hanging local CLI is killed on timeout', async () => {
    const entrypoint = path.join(temporaryDir(), 'fake-codex.cjs');
    writeFakeCli(entrypoint);
    const { transport } = codexCliTransport({ command: entrypoint, extraArgs: ['--hang'], timeoutMs: 250 });
    await expect(transport(request)).rejects.toThrow(/codex timed out after 250ms/);
  }, 10000);

  test('timeout stops both the CLI wrapper and its spawned descendant', async () => {
    const dir = temporaryDir();
    const entrypoint = path.join(dir, 'fake-codex.cjs');
    const pidFile = path.join(dir, 'owned-processes.json');
    writeFakeCli(entrypoint);
    const { transport } = codexCliTransport({ command: entrypoint, extraArgs: ['--spawn-child', pidFile], timeoutMs: 1000 });
    const spawnSpy = process.platform === 'win32' ? jest.spyOn(require('node:child_process'), 'spawn') : undefined;
    const killSpy = process.platform !== 'win32' ? jest.spyOn(process, 'kill') : undefined;
    let pids: { parent: number; child: number } | undefined;
    try {
      const completion = transport(request).catch((error: unknown) => error);
      for (let attempt = 0; attempt < 50 && !fs.existsSync(pidFile); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      pids = JSON.parse(fs.readFileSync(pidFile, 'utf8')) as { parent: number; child: number };
      expect(pids.parent).toEqual(expect.any(Number));
      expect(pids.child).toEqual(expect.any(Number));
      expect(isRunning(pids.parent)).toBe(true);
      expect(isRunning(pids.child)).toBe(true);
      expect(await completion).toEqual(expect.objectContaining({ message: 'codex timed out after 1000ms' }));
      if (spawnSpy) {
        const killerIndex = spawnSpy.mock.calls.findIndex(([command, args, options]) =>
          path.basename(String(command)).toLowerCase() === 'taskkill.exe'
          && JSON.stringify(args) === JSON.stringify(['/PID', String(pids!.parent), '/T', '/F'])
          && options?.shell === false && options.windowsHide === true);
        expect(killerIndex).toBeGreaterThanOrEqual(0);
        expect(spawnSpy.mock.results[killerIndex]!.value.exitCode).toBe(0);
      } else {
        expect(killSpy!.mock.calls.some(([pid, signal]) => pid === -pids!.parent && signal === 'SIGKILL')).toBe(true);
      }
      expect(await stopped(pids.parent)).toBe(true);
      expect(await stopped(pids.child)).toBe(true);
    } finally {
      spawnSpy?.mockRestore();
      killSpy?.mockRestore();
      if (pids === undefined && fs.existsSync(pidFile)) pids = JSON.parse(fs.readFileSync(pidFile, 'utf8')) as { parent: number; child: number };
      cleanupOwnedPid(pids?.child);
      cleanupOwnedPid(pids?.parent);
    }
  }, 10000);

  (process.platform === 'win32' ? test : test.skip)('unavailable Windows tree helper falls back to stopping the owned wrapper', async () => {
    const dir = temporaryDir();
    const entrypoint = path.join(dir, 'fake-codex.cjs');
    const pidFile = path.join(dir, 'owned-wrapper.json');
    writeFakeCli(entrypoint);
    const previous = process.env.SystemRoot;
    process.env.SystemRoot = path.join(dir, 'missing-windows');
    let parent: number | undefined;
    try {
      const { transport } = codexCliTransport({ command: entrypoint, extraArgs: ['--hang', '--pid-file', pidFile], timeoutMs: 500 });
      await expect(transport(request)).rejects.toThrow(/codex timed out after 500ms/);
      parent = (JSON.parse(fs.readFileSync(pidFile, 'utf8')) as { parent: number }).parent;
      expect(parent).toEqual(expect.any(Number));
      expect(await stopped(parent)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.SystemRoot;
      else process.env.SystemRoot = previous;
      if (parent === undefined && fs.existsSync(pidFile)) parent = (JSON.parse(fs.readFileSync(pidFile, 'utf8')) as { parent: number }).parent;
      cleanupOwnedPid(parent);
    }
  });
});

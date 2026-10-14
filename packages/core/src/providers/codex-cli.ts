import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Transport } from './types';

export interface CodexCliLaunch {
  command: string;
  prefixArgs: string[];
}

/** Resolve a CLI launcher without invoking a command shell. JS entrypoints and
 * Windows npm shims use the current Node executable; native binaries run directly. */
export function resolveCodexCliLaunch(command: string): CodexCliLaunch {
  const explicitPath = path.isAbsolute(command) || /[\\/]/.test(command);
  const names = process.platform === 'win32' && path.extname(command) === ''
    ? [`${command}.exe`, `${command}.cmd`, `${command}.bat`, command]
    : [command];
  const searchDirs = explicitPath ? [] : (process.env.PATH ?? process.env.Path ?? '').split(path.delimiter);
  const candidates = explicitPath
    ? [path.resolve(command)]
    : [...(fs.existsSync(command) ? [path.resolve(command)] : []),
      ...searchDirs.flatMap((dir) => names.map((name) => path.join(dir.replace(/^"|"$/g, ''), name)))];
  const located = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!located) throw new Error(`Codex CLI command not found: ${command}`);
  const resolved = fs.realpathSync(located);
  if (/\.(?:js|mjs|cjs)$/i.test(resolved)) {
    return { command: process.execPath, prefixArgs: [resolved] };
  }
  if (/\.(?:cmd|bat|ps1)$/i.test(resolved)) {
    const shimDir = path.dirname(resolved);
    const entrypoints = [
      path.join(shimDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
      path.join(shimDir, '..', '@openai', 'codex', 'bin', 'codex.js')
    ];
    const shimText = fs.readFileSync(resolved, 'utf8');
    for (const match of shimText.matchAll(/["']((?:%~dp0|%dp0%)[^"']+\.(?:js|mjs|cjs))["']/gi)) {
      const relative = match[1]!.replace(/^(?:%~dp0|%dp0%)[\\/]*/i, '');
      entrypoints.push(path.resolve(shimDir, relative));
    }
    const entrypoint = entrypoints.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!entrypoint) throw new Error(`Codex CLI shim has no resolvable JavaScript entrypoint: ${resolved}`);
    return { command: process.execPath, prefixArgs: [fs.realpathSync(entrypoint)] };
  }
  return { command: resolved, prefixArgs: [] };
}

async function terminateOwnedProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const directKill = (): void => {
    try { child.kill('SIGKILL'); } catch { /* The owned process may already have exited. */ }
  };

  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const taskkill = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
      let killer: ReturnType<typeof spawn>;
      try {
        killer = spawn(taskkill, ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore', shell: false, windowsHide: true
        });
      } catch {
        directKill();
        resolve();
        return;
      }
      let finished = false;
      const finish = (fallback: boolean): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (fallback) directKill();
        resolve();
      };
      const timer = setTimeout(() => {
        try { killer.kill('SIGKILL'); } catch { /* Cleanup helper already exited. */ }
        finish(true);
      }, 5000);
      killer.once('error', () => finish(true));
      killer.once('close', (code) => finish(code !== 0));
    });
  } else {
    // Live transports start a separate process group, so the negative PID is
    // confined to this invocation and its descendants.
    try { process.kill(-pid, 'SIGKILL'); } catch { directKill(); }
  }

  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const onClose = (): void => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { child.off('close', onClose); resolve(); }, 1000);
    child.once('close', onClose);
  });
}

/**
 * Codex CLI transport — preserves the legacy Workbench's "shell out to codex"
 * behavior. Resolves the executable only on a live transport call, so replay
 * does not need a CLI installation. Writes the prompt to stdin and reads stdout.
 *
 * Config via env: METAGRINDER_CODEX_COMMAND (default codex),
 * METAGRINDER_CODEX_MODEL (default gpt-5.2), METAGRINDER_CODEX_ARGS.
 */
export function codexCliTransport(opts?: {
  command?: string;
  model?: string;
  extraArgs?: string[];
  timeoutMs?: number;
}): { transport: Transport; model: string } {
  const command = opts?.command
    ?? process.env.METAGRINDER_CODEX_COMMAND
    ?? 'codex';
  const model = opts?.model ?? process.env.METAGRINDER_CODEX_MODEL ?? 'gpt-5.2';
  const extraArgs = opts?.extraArgs
    ?? (process.env.METAGRINDER_CODEX_ARGS ? process.env.METAGRINDER_CODEX_ARGS.split(' ').filter(Boolean) : []);
  const timeoutMs = opts?.timeoutMs ?? 180_000;

  const transport: Transport = ({ system, prompt }) =>
    new Promise((resolve, reject) => {
      const launch = resolveCodexCliLaunch(command);
      const args = [...launch.prefixArgs, 'exec', '--model', model, ...extraArgs];
      const child = spawn(launch.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true,
        detached: process.platform !== 'win32'
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdin.destroy();
        if (error) {
          void terminateOwnedProcessTree(child).then(() => reject(error), () => {
            try { child.kill('SIGKILL'); } catch { /* Cleanup attempt could race process exit. */ }
            reject(error);
          });
        } else resolve({ rawText: stdout });
      };
      const timer = setTimeout(() => finish(new Error(`codex timed out after ${timeoutMs}ms`)), timeoutMs);

      child.stdout.on('data', (d) => { stdout += String(d); });
      child.stderr.on('data', (d) => { stderr += String(d); });
      child.stdin.on('error', finish);
      child.stdout.on('error', finish);
      child.stderr.on('error', finish);
      child.on('error', finish);
      child.on('close', (code) => {
        if (code !== 0) finish(new Error(`codex exited ${code}: ${stderr.slice(0, 500)}`));
        else finish();
      });

      child.stdin.end(system ? `${system}\n\n${prompt}` : prompt);
    });

  return { transport, model };
}

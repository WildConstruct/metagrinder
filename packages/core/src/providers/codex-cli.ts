import { spawn } from 'node:child_process';
import type { Transport } from './types';

/**
 * Codex CLI transport — preserves the legacy Workbench's "shell out to codex"
 * behavior, minus the Windows entrypoint-resolution sprawl. Spawn is the
 * untested boundary. Writes the prompt to the child's stdin and reads stdout.
 *
 * Config via env: METAGRINDER_CODEX_COMMAND (default codex/codex.cmd),
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
    ?? (process.platform === 'win32' ? 'codex.cmd' : 'codex');
  const model = opts?.model ?? process.env.METAGRINDER_CODEX_MODEL ?? 'gpt-5.2';
  const extraArgs = opts?.extraArgs
    ?? (process.env.METAGRINDER_CODEX_ARGS ? process.env.METAGRINDER_CODEX_ARGS.split(' ').filter(Boolean) : []);
  const timeoutMs = opts?.timeoutMs ?? 180_000;

  const transport: Transport = ({ system, prompt }) =>
    new Promise((resolve, reject) => {
      const args = ['exec', '--model', model, ...extraArgs];
      const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`codex timed out after ${timeoutMs}ms`)); }, timeoutMs);

      child.stdout.on('data', (d) => { stdout += String(d); });
      child.stderr.on('data', (d) => { stderr += String(d); });
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`codex exited ${code}: ${stderr.slice(0, 500)}`));
        else resolve({ rawText: stdout });
      });

      child.stdin.write(system ? `${system}\n\n${prompt}` : prompt);
      child.stdin.end();
    });

  return { transport, model };
}

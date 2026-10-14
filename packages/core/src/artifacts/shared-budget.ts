import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BudgetLedgerSchema, type BudgetLedger } from '../schemas/run-manifest';
import { sha256Hex } from './ids';

const LOCK_TIMEOUT_MS = 10_000;
const RECOVERY_OPEN_EPERM_RETRIES = 4;
const ATOMIC_RENAME_CONTENTION_RETRIES = 4;
const waitWord = new Int32Array(new SharedArrayBuffer(4));

/** Locks cover only local JSON mutations, never transport/network work. */
export function withBudgetFileLock<T>(filePath: string, operation: () => T): T {
  const lockPath = `${path.resolve(filePath)}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const started = Date.now();
  let acquired = false;
  let recoveryOpenPermissionRetries = 0;
  while (!acquired) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      acquired = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // Only one process may reclaim a dead owner's file; otherwise a second
      // reclaimer could unlink a lock that has already been reacquired.
      const recoveryPath = `${lockPath}.reclaim`;
      let recoveryFd: number | undefined;
      let reclaimed = false;
      try {
        recoveryFd = fs.openSync(recoveryPath, 'wx');
        recoveryOpenPermissionRetries = 0;
        const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: unknown };
        if (typeof owner.pid === 'number' && Number.isInteger(owner.pid) && owner.pid > 0) {
          try {
            process.kill(owner.pid, 0);
          } catch (ownerError) {
            if ((ownerError as NodeJS.ErrnoException).code === 'ESRCH') {
              fs.unlinkSync(lockPath);
              reclaimed = true;
            }
          }
        }
      } catch (readError) {
        const code = (readError as NodeJS.ErrnoException).code;
        // Windows can briefly deny an exclusive open while another process's
        // recovery-lock handle is closing/deleting. Retry only that open seam;
        // persistent denial and read/unlink permission failures still escape.
        if (recoveryFd === undefined && process.platform === 'win32' && code === 'EPERM') {
          if (++recoveryOpenPermissionRetries > RECOVERY_OPEN_EPERM_RETRIES) throw readError;
        } else {
          recoveryOpenPermissionRetries = 0;
          if (code === 'ENOENT') continue;
          if (code !== 'EEXIST' && !(readError instanceof SyntaxError)) throw readError;
        }
      } finally {
        if (recoveryFd !== undefined) {
          fs.closeSync(recoveryFd);
          fs.unlinkSync(recoveryPath);
        }
      }
      if (reclaimed) continue;
      if (Date.now() - started >= LOCK_TIMEOUT_MS) throw new Error(`budget lock timed out: ${lockPath}`);
      Atomics.wait(waitWord, 0, 0, 15);
    }
  }
  try {
    return operation();
  } finally {
    fs.unlinkSync(lockPath);
  }
}

export function withBudgetFileLocks<T>(filePaths: string[], operation: () => T): T {
  const paths = [...new Set(filePaths.map((filePath) => path.resolve(filePath)))].sort();
  function next(index: number): T {
    const filePath = paths[index];
    return filePath === undefined ? operation() : withBudgetFileLock(filePath, () => next(index + 1));
  }
  return next(0);
}

/** fsync + same-directory rename avoids a half-written ledger after process interruption. */
export function writeBudgetJsonAtomic(filePath: string, data: unknown): void {
  const destination = path.resolve(filePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, 'wx');
    fs.writeFileSync(fd, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(temporary, destination);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // A short-lived Windows read handle can deny replacement. Keep the
        // complete fsynced temporary file and old destination untouched while
        // retrying; never unlink the durable destination as a fallback.
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')
          || attempt >= ATOMIC_RENAME_CONTENTION_RETRIES) throw error;
        Atomics.wait(waitWord, 0, 0, 15);
      }
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function campaignBudgetPath(baseDir: string, campaignId: string): string {
  return path.join(path.resolve(baseDir), '.campaign-budgets', `${sha256Hex(campaignId)}.json`);
}

export function readSharedBudget(filePath: string): BudgetLedger {
  return BudgetLedgerSchema.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

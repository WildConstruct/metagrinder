import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BudgetLedgerSchema, type BudgetLedger } from '../schemas/run-manifest';
import { sha256Hex } from './ids';

const LOCK_TIMEOUT_MS = 10_000;
const waitWord = new Int32Array(new SharedArrayBuffer(4));

/** Locks cover only local JSON mutations, never transport/network work. */
export function withBudgetFileLock<T>(filePath: string, operation: () => T): T {
  const lockPath = `${path.resolve(filePath)}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const started = Date.now();
  let acquired = false;
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
        if ((readError as NodeJS.ErrnoException).code === 'ENOENT') continue;
        if ((readError as NodeJS.ErrnoException).code !== 'EEXIST' && !(readError instanceof SyntaxError)) throw readError;
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
    fs.renameSync(temporary, destination);
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

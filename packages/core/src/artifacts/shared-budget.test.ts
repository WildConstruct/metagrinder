import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withBudgetFileLock, writeBudgetJsonAtomic } from './shared-budget';

function withPlatform<T>(platform: NodeJS.Platform, operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { ...descriptor, value: platform });
  try { return operation(); } finally { Object.defineProperty(process, 'platform', descriptor); }
}

function withWindowsPlatform<T>(operation: () => T): T {
  return withPlatform('win32', operation);
}

function removeTempDirectory(dir: string): void {
  const relative = path.relative(os.tmpdir(), dir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('budget test cleanup escaped its temporary root');
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('durable budget file mutation', () => {
  test.each(['EPERM', 'EACCES', 'EBUSY'])('Windows atomic-rename %s contention retries the same complete bytes without deleting the destination', (code) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-budget-rename-contention-'));
    const target = path.join(dir, 'ledger.json');
    const oldBytes = JSON.stringify({ reserved: 8 });
    const newBytes = `${JSON.stringify({ reserved: 9 }, null, 2)}\n`;
    fs.writeFileSync(target, oldBytes);
    const nativeFs = require('node:fs') as typeof fs;
    const originalRename = nativeFs.renameSync;
    let attempts = 0;
    const temporaryPaths = new Set<string>();
    const attemptedBytes: string[] = [];
    const rename = jest.spyOn(nativeFs, 'renameSync').mockImplementation((from, to) => {
      expect(String(to)).toBe(target);
      temporaryPaths.add(String(from));
      attemptedBytes.push(fs.readFileSync(from, 'utf8'));
      expect(fs.readFileSync(target, 'utf8')).toBe(oldBytes);
      if (++attempts <= 2) throw Object.assign(new Error('target read handle still open'), { code });
      originalRename(from, to);
    });
    const unlink = jest.spyOn(nativeFs, 'unlinkSync');
    try {
      withWindowsPlatform(() => writeBudgetJsonAtomic(target, { reserved: 9 }));
      expect(attempts).toBe(3);
      expect(temporaryPaths.size).toBe(1);
      expect(attemptedBytes).toEqual([newBytes, newBytes, newBytes]);
      expect(fs.readFileSync(target, 'utf8')).toBe(newBytes);
      expect(unlink.mock.calls.some(([file]) => String(file) === target)).toBe(false);
      expect(fs.readdirSync(dir)).toEqual(['ledger.json']);
    } finally {
      rename.mockRestore();
      unlink.mockRestore();
      removeTempDirectory(dir);
    }
  });

  test.each(['EPERM', 'EACCES', 'EBUSY'])('persistent Windows atomic-rename %s denial is bounded and preserves the original durable file', (code) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-budget-rename-permission-'));
    const target = path.join(dir, 'ledger.json');
    const oldBytes = JSON.stringify({ reserved: 8 });
    const newBytes = `${JSON.stringify({ reserved: 9 }, null, 2)}\n`;
    fs.writeFileSync(target, oldBytes);
    const nativeFs = require('node:fs') as typeof fs;
    const denied = Object.assign(new Error('atomic replacement permanently denied'), { code });
    let attempts = 0;
    const attemptedBytes: string[] = [];
    const rename = jest.spyOn(nativeFs, 'renameSync').mockImplementation((from, to) => {
      expect(String(to)).toBe(target);
      attemptedBytes.push(fs.readFileSync(from, 'utf8'));
      expect(fs.readFileSync(target, 'utf8')).toBe(oldBytes);
      if (++attempts > 12) throw Object.assign(new Error('unbounded rename retries'), { code: 'EIO' });
      throw denied;
    });
    const unlink = jest.spyOn(nativeFs, 'unlinkSync');
    const wait = jest.spyOn(Atomics, 'wait').mockReturnValue('timed-out');
    try {
      expect(() => withWindowsPlatform(() => writeBudgetJsonAtomic(target, { reserved: 9 }))).toThrow(denied);
      expect(attempts).toBeGreaterThan(1);
      expect(attempts).toBeLessThanOrEqual(8);
      expect(attemptedBytes.every((bytes) => bytes === newBytes)).toBe(true);
      expect(fs.readFileSync(target, 'utf8')).toBe(oldBytes);
      expect(unlink.mock.calls.some(([file]) => String(file) === target)).toBe(false);
      expect(fs.readdirSync(dir)).toEqual(['ledger.json']);
    } finally {
      rename.mockRestore();
      unlink.mockRestore();
      wait.mockRestore();
      removeTempDirectory(dir);
    }
  });

  test.each<{ platform: NodeJS.Platform; code: string }>([
    { platform: 'linux', code: 'EPERM' },
    { platform: 'win32', code: 'EIO' }
  ])('atomic-rename $code on $platform is not treated as Windows handle contention', ({ platform, code }) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-budget-rename-other-error-'));
    const target = path.join(dir, 'ledger.json');
    const oldBytes = JSON.stringify({ reserved: 8 });
    fs.writeFileSync(target, oldBytes);
    const denied = Object.assign(new Error('non-contention rename failure'), { code });
    const nativeFs = require('node:fs') as typeof fs;
    const rename = jest.spyOn(nativeFs, 'renameSync').mockImplementation(() => { throw denied; });
    try {
      expect(() => withPlatform(platform, () => writeBudgetJsonAtomic(target, { reserved: 9 }))).toThrow(denied);
      expect(rename).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync(target, 'utf8')).toBe(oldBytes);
      expect(fs.readdirSync(dir)).toEqual(['ledger.json']);
    } finally {
      rename.mockRestore();
      removeTempDirectory(dir);
    }
  });

  test('Windows recovery-lock exclusive-open contention is retried without losing durable data', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-budget-recovery-contention-'));
    const target = path.join(dir, 'ledger.json');
    const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    expect(child.status).toBe(0);
    writeBudgetJsonAtomic(target, { reserved: 8 });
    fs.writeFileSync(`${target}.lock`, JSON.stringify({ pid: child.pid }));
    const nativeFs = require('node:fs') as typeof fs;
    const originalOpen = nativeFs.openSync;
    let recoveryAttempts = 0;
    const open = jest.spyOn(nativeFs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
      if (String(args[0]) === `${target}.lock.reclaim` && args[1] === 'wx' && ++recoveryAttempts === 1) {
        throw Object.assign(new Error('recovery lock handle still closing'), { code: 'EPERM' });
      }
      return originalOpen(...args);
    });
    try {
      const result = withWindowsPlatform(() => withBudgetFileLock(target,
        () => JSON.parse(fs.readFileSync(target, 'utf8'))));
      expect(result).toEqual({ reserved: 8 });
      expect(recoveryAttempts).toBe(2);
      expect(fs.existsSync(`${target}.lock`)).toBe(false);
      expect(fs.existsSync(`${target}.lock.reclaim`)).toBe(false);
    } finally {
      open.mockRestore();
      removeTempDirectory(dir);
    }
  });

  test('persistent Windows recovery-open permission errors remain bounded and fail closed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-budget-recovery-permission-'));
    const target = path.join(dir, 'ledger.json');
    fs.writeFileSync(`${target}.lock`, JSON.stringify({ pid: process.pid }));
    const denied = Object.assign(new Error('recovery lock permanently denied'), { code: 'EPERM' });
    const nativeFs = require('node:fs') as typeof fs;
    const originalOpen = nativeFs.openSync;
    let recoveryAttempts = 0;
    const open = jest.spyOn(nativeFs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
      if (String(args[0]) === `${target}.lock.reclaim` && args[1] === 'wx') {
        recoveryAttempts++;
        throw denied;
      }
      return originalOpen(...args);
    });
    let clock = 0;
    const now = jest.spyOn(Date, 'now').mockImplementation(() => clock += 1000);
    const wait = jest.spyOn(Atomics, 'wait').mockReturnValue('timed-out');
    const operation = jest.fn();
    try {
      expect(() => withWindowsPlatform(() => withBudgetFileLock(target, operation))).toThrow(denied);
      expect(recoveryAttempts).toBeGreaterThan(1);
      expect(recoveryAttempts).toBeLessThanOrEqual(8);
      expect(operation).not.toHaveBeenCalled();
      expect(fs.existsSync(`${target}.lock`)).toBe(true);
    } finally {
      open.mockRestore();
      now.mockRestore();
      wait.mockRestore();
      removeTempDirectory(dir);
    }
  });

  test.each(['primary-open', 'owner-read'] as const)('Windows %s permission errors are not treated as recovery contention', (seam) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-budget-primary-permission-'));
    const target = path.join(dir, 'ledger.json');
    if (seam === 'owner-read') fs.writeFileSync(`${target}.lock`, JSON.stringify({ pid: process.pid }));
    const nativeFs = require('node:fs') as typeof fs;
    const originalOpen = nativeFs.openSync;
    const originalRead = nativeFs.readFileSync;
    const denied = Object.assign(new Error(`${seam} denied`), { code: 'EPERM' });
    const open = jest.spyOn(nativeFs, 'openSync').mockImplementation((...args: Parameters<typeof fs.openSync>) => {
      if (seam === 'primary-open' && String(args[0]) === `${target}.lock`) throw denied;
      return originalOpen(...args);
    });
    const read = jest.spyOn(nativeFs, 'readFileSync').mockImplementation((...args: Parameters<typeof fs.readFileSync>) => {
      if (seam === 'owner-read' && String(args[0]) === `${target}.lock`) throw denied;
      return originalRead(...args);
    });
    const operation = jest.fn();
    try {
      expect(() => withWindowsPlatform(() => withBudgetFileLock(target, operation))).toThrow(denied);
      expect(operation).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
      read.mockRestore();
      removeTempDirectory(dir);
    }
  });

  test('atomic writes leave valid JSON and throwing operations release their lock', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-budget-file-'));
    const target = path.join(dir, 'ledger.json');
    expect(() => withBudgetFileLock(target, () => {
      writeBudgetJsonAtomic(target, { calls: 1 });
      throw new Error('interrupted operation');
    })).toThrow('interrupted operation');
    expect(fs.existsSync(`${target}.lock`)).toBe(false);
    withBudgetFileLock(target, () => writeBudgetJsonAtomic(target, { calls: 2 }));
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ calls: 2 });
    expect(fs.readdirSync(dir)).toEqual(['ledger.json']);
  });

  test('a dead process owner is recovered without discarding durable ledger data', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-dead-budget-owner-'));
    const target = path.join(dir, 'ledger.json');
    const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    expect(child.status).toBe(0);
    writeBudgetJsonAtomic(target, { reserved: 8 });
    fs.writeFileSync(`${target}.lock`, JSON.stringify({ pid: child.pid }));
    const result = withBudgetFileLock(target, () => JSON.parse(fs.readFileSync(target, 'utf8')));
    expect(result).toEqual({ reserved: 8 });
    expect(fs.existsSync(`${target}.lock`)).toBe(false);
    expect(fs.existsSync(`${target}.lock.reclaim`)).toBe(false);
  });
});

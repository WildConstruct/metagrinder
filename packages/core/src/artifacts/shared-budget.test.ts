import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withBudgetFileLock, writeBudgetJsonAtomic } from './shared-budget';

describe('durable budget file mutation', () => {
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

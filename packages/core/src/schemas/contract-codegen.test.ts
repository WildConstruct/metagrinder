import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const CORE_ROOT = path.resolve(__dirname, '../..');
const CANONICAL_DIR = path.resolve(CORE_ROOT, '../../contracts/json-schema');

function runCodegen(args: string[]) {
  const bootstrap = [
    "const fs=require('node:fs'); const path=require('node:path');",
    `const canonical=${JSON.stringify(CANONICAL_DIR)};`,
    "const normalized=p=>process.platform==='win32'?path.resolve(String(p)).toLowerCase():path.resolve(String(p));",
    'const isCanonical=p=>normalized(p)===normalized(canonical)||normalized(p).startsWith(normalized(canonical)+path.sep);',
    'const mkdir=fs.mkdirSync, write=fs.writeFileSync;',
    "fs.mkdirSync=(p,...args)=>{if(isCanonical(p))throw new Error('canonical write attempted');return mkdir(p,...args);};",
    "fs.writeFileSync=(p,...args)=>{if(isCanonical(p))throw new Error('canonical write attempted');return write(p,...args);};",
    "try { const generator=require('./src/schemas/emit-json-schema.ts');",
    "if(typeof generator.codegenMain!=='function')throw new Error('codegen CLI is not independently callable');",
    'process.exitCode=generator.codegenMain(process.argv.slice(1));',
    '} catch(error) { console.error(error); process.exitCode=1; }'
  ].join('\n');
  return spawnSync(process.execPath, ['--require', 'tsx/cjs', '-e', bootstrap, '--', ...args], {
    cwd: CORE_ROOT, encoding: 'utf8'
  });
}

function generatedDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-contract-codegen-'));
  const result = runCodegen(['--output-dir', dir]);
  if (result.status !== 0) throw new Error(result.stderr);
  return dir;
}

describe('source-derived contract parity', () => {
  test('write mode honors output-dir and check mode performs no writes', () => {
    const dir = generatedDirectory();
    const before = fs.readdirSync(dir).map((name) => ({
      name, text: fs.readFileSync(path.join(dir, name), 'utf8'), mtime: fs.statSync(path.join(dir, name)).mtimeMs
    }));
    const result = runCodegen(['--check', '--output-dir', dir]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(before.length).toBeGreaterThan(3);
    for (const file of before) {
      expect(fs.readFileSync(path.join(dir, file.name), 'utf8')).toBe(file.text);
      expect(fs.statSync(path.join(dir, file.name)).mtimeMs).toBe(file.mtime);
    }
  });

  test.each(['missing', 'changed', 'orphan'] as const)('check rejects %s generated schemas', (kind) => {
    const dir = generatedDirectory();
    let expected: string;
    if (kind === 'missing') {
      fs.unlinkSync(path.join(dir, 'source-package.schema.json'));
      expected = 'missing source-package.schema.json';
    } else if (kind === 'changed') {
      const target = path.join(dir, 'extraction.schema.json');
      fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace('"extraction"', '"changed-extraction"'));
      expected = 'changed extraction.schema.json';
    } else {
      fs.writeFileSync(path.join(dir, 'retired.schema.json'), '{}');
      expected = 'orphan retired.schema.json';
    }
    const before = fs.readdirSync(dir);
    const result = runCodegen(['--check', '--output-dir', dir]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(expected);
    expect(fs.readdirSync(dir)).toEqual(before);
  });

  test('parity permits CRLF/LF differences but rejects every other textual drift', () => {
    const dir = generatedDirectory();
    for (const name of fs.readdirSync(dir)) {
      const target = path.join(dir, name);
      fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\n/g, '\r\n'));
    }
    expect(runCodegen(['--check', '--output-dir', dir]).status).toBe(0);
    const indexPath = path.join(dir, 'INDEX.md');
    fs.appendFileSync(indexPath, 'Unexpected metadata\r\n');
    const result = runCodegen(['--check', '--output-dir', dir]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('changed INDEX.md');
  });
});

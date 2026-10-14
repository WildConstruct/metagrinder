import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

test('[S-R3e] root and core expose one rebuilt verification command', () => {
  const root = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const core = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/package.json'), 'utf8'));
  expect(root.scripts['verify:reimplementation']).toBe('pnpm --filter @promptscape/core verify:reimplementation');
  expect(core.scripts['verify:reimplementation']).toBe('tsx src/verification/cli.ts');
});

test('[S-R3e] CI covers both supported hosts with the canonical command and exact Node pin', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/metagrinder-ci.yml'), 'utf8');
  expect(workflow).toContain('ubuntu-latest');
  expect(workflow).toContain('windows-latest');
  expect(workflow).toContain('node-version-file: .nvmrc');
  expect(workflow).toContain('pnpm verify:reimplementation');
  expect(workflow).not.toMatch(/run:\s*pnpm test:metagrinder\s*(?:\r?\n|$)/);
  expect(workflow).toContain('npm_config_store_dir:');
});

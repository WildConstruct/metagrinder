const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const depsRoot = process.env.METAGRINDER_AUDIT_DEPS || 'C:\\tmp\\metagrinder-audit-deps';
const jestBin = path.join(depsRoot, 'node_modules', 'jest', 'bin', 'jest.js');

if (!fs.existsSync(jestBin)) {
  throw new Error(
    `Missing audit Jest dependency at ${jestBin}. Install the local workaround dependencies first; see docs/research/metagrinder-local-dev-notes.md.`
  );
}

const env = {
  ...process.env,
  NODE_PATH: path.join(depsRoot, 'node_modules'),
  PATH: `${path.join(depsRoot, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH || ''}`
};

const result = spawnSync(
  process.execPath,
  [
    jestBin,
    '--config',
    'packages/core/jest.metagrinder.config.cjs',
    'packages/core/tests/metagrinder.test.ts',
    '--runInBand'
  ],
  {
    cwd: path.resolve(__dirname, '..', '..', '..'),
    env,
    stdio: 'inherit'
  }
);

process.exit(result.status || 0);

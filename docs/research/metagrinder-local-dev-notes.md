# Metagrinder Local Development Notes

## Windows synced-folder dependency install issue

On this workstation, the repository is inside a synced Windows folder:

`H:\Other computers\My Computer\Documents\Cascade Projects\metagrinder`

`corepack pnpm install --frozen-lockfile` fails while relinking packages under
`node_modules/.pnpm/@types+jest@30.0.0/node_modules`:

```txt
ERR_PNPM_ENOENT ENOENT: no such file or directory, rename ...\expect -> ...\.ignored_expect
```

This appears to be a synced-folder filesystem rename/link issue, not a lockfile
or package.json dependency issue. The lockfile resolves cleanly, but package
materialization fails inside the workspace path. After this failure,
`corepack pnpm --filter @promptscape/core test:metagrinder` cannot find `jest`,
and `corepack pnpm --filter @promptscape/core validate:metagrinder` cannot find
`zod`.

Current workaround for local audit runs:

```powershell
New-Item -ItemType Directory -Force C:\tmp\metagrinder-audit-deps
npm install --prefix C:\tmp\metagrinder-audit-deps zod@3.25.76 jest@30.2.0 ts-jest@29.4.6 typescript@5.9.3 @types/jest@30.0.0 --ignore-scripts
$env:NODE_PATH='C:\tmp\metagrinder-audit-deps\node_modules'
$env:PATH='C:\tmp\metagrinder-audit-deps\node_modules\.bin;' + $env:PATH
node C:\tmp\metagrinder-audit-deps\node_modules\jest\bin\jest.js --config packages/core/jest.metagrinder.config.cjs packages/core/tests/metagrinder.test.ts --runInBand
```

The repository also includes a wrapper for this local workaround:

```powershell
$env:METAGRINDER_AUDIT_DEPS='C:\tmp\metagrinder-audit-deps'
node packages/core/scripts/run-metagrinder-audit-tests.js
```

This wrapper is not the normal CI path. It exists only to keep local audit work
moving when a synced Windows folder prevents pnpm from materializing
`node_modules`. The normal path remains `pnpm install` followed by the package
test scripts.

For a durable fix, move the workspace to a non-synced local path such as
`C:\tmp\metagrinder-workspace`, or configure pnpm to use a package import mode
that works reliably on the backing filesystem.

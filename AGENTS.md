# Repository Guidelines

## Reimplementation In Progress

This repo is being rebuilt per `docs/research/metagrinder-reimplementation-analysis.md`. If your task is implementation work, **read `docs/research/metagrinder-reimplementation-loop.md` first and follow its protocol** (story order, iteration gates, hard rules, progress log). Key rules that override older habits in this file: legacy `packages/core/services/*` and `types/metagrinder.runtime.js` are read-only reference; new code lives in `packages/core/src/`; semantic stages are never tested by fixture equality; never read the held-out eval folder; stop at human gates with a single run card instead of building more validators.

## Project Structure & Module Organization

This fork is a trimmed pnpm workspace focused on `packages/core`. The rebuilt implementation lives in `packages/core/src/`, with schemas in `src/schemas/`, stages in `src/stages/`, and adjacent `*.test.ts` files. JSON Schema contracts are generated from those schemas into `contracts/json-schema/`; never hand-mirror them. Legacy `types`, `services`, `utils`, `fileFormats`, `runtime/nodes/epic1`, and tests under `packages/core/tests` remain regression/reference surfaces. Long-form specs and fork notes live in `docs/` and `docs/research/`.

## Build, Test, and Development Commands

Use Node `20.19.0` (exact `.nvmrc` pin), pnpm `8.15.4`, and Python 3.9 or newer. CI uses the same verification command on Linux and Windows with Python 3.12.

- `pnpm install` installs workspace dependencies.
- `pnpm verify:reimplementation` is the canonical gate: strict rebuilt typecheck, rebuilt and legacy Jest suites, nonmutating generated-contract parity, and Python contract consumption. The verifier rejects a mismatched Node version before running checks.
- `pnpm test:src` and `pnpm typecheck:src` run targeted rebuilt checks.
- `pnpm --filter @promptscape/core codegen:json-schema` regenerates contracts after schema edits; verification does not rewrite them.
- `pnpm test:metagrinder` runs the legacy Jest suite (`packages/core/jest.metagrinder.config.cjs`), not the full rebuilt gate. The `validate:metagrinder` and rainy-alley commands are legacy fixture/prototype checks.

Do not run bare `pnpm exec jest` from the root — `packages/core/jest.config.cjs` is a stale jsdom/babel config from the parent repo and fails on TypeScript. If `pnpm` is missing, see README.md for corepack and external-store guidance. Non-Windows hosts must override the Windows `.npmrc` store path with an external `npm_config_store_dir`; CI already does so. `METAGRINDER_VERIFY_PYTHON` can select a literal Python executable path.

## Coding Style & Naming Conventions

The rebuilt code uses strict TypeScript (`packages/core/src/tsconfig.json`) in the CommonJS core package. Follow the existing style: 2-space indentation, semicolons, single quotes, and named exports for shared helpers. Use `PascalCase` for types/classes, `camelCase` for functions and variables, and `*.test.ts` for tests. Keep fixtures descriptive and lowercase.

## Testing Guidelines

Jest is the active test runner. Add rebuilt tests beside the code in `packages/core/src/`; use `pnpm --filter @promptscape/core exec jest --config jest.src.config.cjs --runInBand src/<test-path>` for a targeted test. Prefer names that describe behavior or map to acceptance criteria, such as `[AC-B2] Round-trip preserves data`. Deterministic boundaries use unit/property tests; semantic stages use rubric-scored replay evidence, never fixture-output equality. The locked bootstrap scores (106 heuristic, 114 semantic capture) measure extraction metadata, not factual accuracy or downstream semantic quality. Lexical faithfulness and per-brief diagnostics are boundary checks, not entailment proof. Real-provider, held-out, judge-calibration, and phase-exit gates remain open until their required operator evidence/sign-off exists.

## Commit & Pull Request Guidelines

Recent history mostly follows conventional prefixes: `feat:`, `fix:`, `test:`, and `chore:`. Keep commit subjects short, imperative, and scoped to one change, for example `fix: normalize PSG wrapper children`. PRs should include a concise summary, affected paths, validation performed, and linked issues or research docs. Include fixture diffs or screenshots only when the change alters serialized outputs or documented behavior.

## Security & Configuration Tips

Do not commit `.env*`, coverage output, generated builds, or ad hoc runtime data; they are already ignored in `.gitignore`. Preserve unrelated dirty work. Update the rolling progress log and story table under `docs/research/` as the loop requires. Never read held-out briefs or edit eval judgments in the same change as the stage they score; corpus/judgment changes require their own `eval-corpus:` commit. Existing human run cards are the gate actions, not invitations to build more readiness machinery.

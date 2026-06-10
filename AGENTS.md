# Repository Guidelines

## Reimplementation In Progress

This repo is being rebuilt per `docs/research/metagrinder-reimplementation-analysis.md`. If your task is implementation work, **read `docs/research/metagrinder-reimplementation-loop.md` first and follow its protocol** (story order, iteration gates, hard rules, progress log). Key rules that override older habits in this file: legacy `packages/core/services/*` and `types/metagrinder.runtime.js` are read-only reference; new code lives in `packages/core/src/`; semantic stages are never tested by fixture equality; never read the held-out eval folder; stop at human gates with a single run card instead of building more validators.

## Project Structure & Module Organization

This fork is a trimmed pnpm workspace focused on `packages/core`. Core TypeScript sources live in `packages/core/types`, `services`, `utils`, `fileFormats`, and `runtime/nodes/epic1`. Tests live beside the package in `packages/core/tests` and `packages/core/runtime/nodes/epic1/__tests__`. JSON fixtures used by schema and parser tests are stored under `packages/core/tests/fixtures`. Long-form specs and fork notes live in `docs/` and `docs/research/`.

## Build, Test, and Development Commands

Use Node `20.19.0` (`.nvmrc`) and pnpm `8.15.4`.

- `pnpm install` installs workspace dependencies.
- `pnpm validate:metagrinder` validates Metagrinder fixtures through `@promptscape/core`.
- `pnpm validate:rainy-alley-prototype` checks the rainy alley prototype data.
- `pnpm validate:rainy-alley-shot-differences` validates shot-difference fixtures.
- `pnpm run:rainy-alley-prototype` runs the prototype script locally.
- `pnpm test:metagrinder` runs the canonical Jest suite (`packages/core/jest.metagrinder.config.cjs`, ts-jest, node env). Do not run bare `pnpm exec jest` from the root — `packages/core/jest.config.cjs` is a stale jsdom/babel config from the parent repo and fails on TypeScript. If `pnpm` is missing, see the Environment notes in README.md (corepack + external store-dir).

## Coding Style & Naming Conventions

The repo uses strict TypeScript with CommonJS in `packages/core`. Follow the existing style: 2-space indentation, semicolons, single quotes, and named exports for shared helpers. Use `PascalCase` for types/classes (`PromptParser.ts`), `camelCase` for functions and variables, and `*.test.ts` for tests. Keep fixtures descriptive and lowercase, for example `packages/core/tests/fixtures/metagrinder/prompt-graph.json`.

## Testing Guidelines

Jest is the active test runner. Add unit tests in `packages/core/tests` for package APIs and in `packages/core/runtime/nodes/epic1/__tests__` for runtime-node behavior. Prefer test names that describe behavior or map to acceptance criteria, such as `[AC-B2] Round-trip preserves data`. Run targeted tests with `pnpm exec jest packages/core/tests/psgCodec.test.ts`.

## Commit & Pull Request Guidelines

Recent history mostly follows conventional prefixes: `feat:`, `fix:`, `test:`, and `chore:`. Keep commit subjects short, imperative, and scoped to one change, for example `fix: normalize PSG wrapper children`. PRs should include a concise summary, affected paths, validation performed, and linked issues or research docs. Include fixture diffs or screenshots only when the change alters serialized outputs or documented behavior.

## Security & Configuration Tips

Do not commit `.env*`, coverage output, generated builds, or ad hoc runtime data; they are already ignored in `.gitignore`. Treat files under `docs/research/` and `packages/core/tests/fixtures/` as reference artifacts, and avoid editing them without updating the validating tests in the same change.

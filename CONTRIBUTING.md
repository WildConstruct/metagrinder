# Contributing

## Working Model

Metagrinder is developed in a lightweight epic and story workflow. Keep changes scoped, traceable, and test-backed.

- use GitHub issues for `epic`, `story`, and `bug` tracking
- keep one focused branch per story or operational task
- prefer small PRs that update docs and tests with the code

## Local Workflow

Install dependencies and run the focused suite before opening a PR:

```bash
pnpm install
pnpm test:metagrinder
```

Run the MVP pipeline against a fixture when changing parser behavior:

```bash
pnpm run:metagrinder-mvp packages/core/tests/fixtures/metagrinder/research-input-broadway.txt
```

## Branch And Commit Conventions

- branch names: `feat/...`, `fix/...`, `docs/...`, `chore/...`
- commit messages: imperative, concise, and scoped to one change
- examples:
  - `Add mutation review artifact`
  - `Fix mutation package review gaps`
  - `Tighten GitHub contribution templates`

## Pull Requests

Every PR should include:

- linked issue or story
- short summary of behavior changes
- test coverage notes
- risks or follow-up items if scope is intentionally partial

If parser behavior changes, include the fixture or scenario used to verify it.

## Operational Guardrails

- do not commit generated output under `packages/core/tests/output/`
- preserve provenance and schema alignment when adding artifacts
- update docs when epic/story scope changes
- keep the focused Metagrinder test suite green before merge

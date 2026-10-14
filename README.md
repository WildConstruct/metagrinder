# Metagrinder

Metagrinder is a research distillation pipeline that turns source material into inspectable PSG-oriented artifacts. It is a separate project from Prompt Spaghetti: it depends on PSG as a data structure and interchange format, but it is not the Prompt Spaghetti app.

## What It Is

- a staged research pipeline with deterministic ingestion, governance, compilation, sampling, and artifact verification around model-assisted semantic stages
- a bounded artifact pipeline for source packages, extraction, scene grammars, choice graphs, content plans, realized prompts, and review
- a staging ground for UTDG-facing research packaging and prompt mutation work

## What It Is Not

- not the old Prompt Spaghetti frontend or API product
- not a general-purpose graph editor
- not a canonical UTDG submission service yet
- not an LLM-only black box parser

## Current Implementation and Evidence

The rebuilt implementation in [packages/core/src](packages/core/src) is the authoritative development surface. Its operating guide is [packages/core/src/README.md](packages/core/src/README.md); story order, acceptance criteria, and human gates are governed by [the reimplementation loop](docs/research/metagrinder-reimplementation-loop.md).

Model outputs are persisted artifacts: replay makes runs reproducible without claiming that live semantic generation is deterministic. The locked bootstrap scores (106 for the heuristic capture, 114 for the semantic capture) evaluate extraction metadata, not factual accuracy or downstream semantic quality. Per-brief pipeline diagnostics and lexical faithfulness checks test deterministic boundaries; they do not establish semantic entailment. Real-provider corpus evaluation, held-out evaluation, judge calibration, and phase-exit approvals remain operator-owned gates.

## Legacy MVP Reference

The pre-reimplementation MVP covers the following legacy behaviors. These are reference capabilities, not evidence that the rebuilt semantic pipeline has passed its open gates:

- single-document and bounded multi-document intake
- deterministic concept extraction with provenance
- cross-document corroboration and contradiction reporting
- prompt-synthesis PSG generation
- prompt-mutation generation and review
- schema-backed package validation

Legacy implementation entrypoints (read-only reference):

- [packages/core/scripts/run-metagrinder-mvp.js](packages/core/scripts/run-metagrinder-mvp.js)
- [packages/core/scripts/lib/metagrinder-mvp.js](packages/core/scripts/lib/metagrinder-mvp.js)
- [packages/core/types/metagrinder.ts](packages/core/types/metagrinder.ts)
- [docs/research/metagrinder-epic-1-agent-framework.md](docs/research/metagrinder-epic-1-agent-framework.md)
- [docs/research/metagrinder-epic-2-multi-document-intake.md](docs/research/metagrinder-epic-2-multi-document-intake.md)

The reimplementation effort is governed by [docs/research/metagrinder-reimplementation-analysis.md](docs/research/metagrinder-reimplementation-analysis.md) and executed per [docs/research/metagrinder-reimplementation-loop.md](docs/research/metagrinder-reimplementation-loop.md); new code lives in [packages/core/src](packages/core/src).

## Quick Start

Use Node `20.19.0` (the exact `.nvmrc` pin), pnpm `8.15.4` (the `packageManager` pin), and Python 3.9 or newer for contract consumption.

```bash
pnpm install
pnpm verify:reimplementation
```

The canonical verification command runs strict rebuilt TypeScript, rebuilt and legacy Jest suites, nonmutating source-to-JSON-Schema parity checks, and the Python contract-consumption check. It fails before checks on a mismatched Node version. CI runs this same command on Linux and Windows with pinned Node/pnpm and Python 3.12; this configuration is not a claim that a remote CI run has already passed.

For targeted rebuilt checks, use `pnpm test:src` or `pnpm typecheck:src`. `pnpm test:metagrinder` runs legacy regressions only. Contract changes originate in `packages/core/src/schemas/`; regenerate with `pnpm --filter @promptscape/core codegen:json-schema`, then verify. Set `METAGRINDER_VERIFY_PYTHON` to a literal executable path if the verifier's default (`python` on Windows, `python3` elsewhere) is unavailable.

Compile existing rebuilt run artifacts offline with `pnpm compile:run -- <existing-run-dir> [--rerun]`. It persists native PSG files and, when an accepted grammar is already recorded, a base/accepted structural diff. Compilation does not create accepted grammar, approve content, or prove generation constraint safety. See the rebuilt operating guide for bindings, reuse, and output-set rules.

### Environment notes

The earlier Windows dependency failure was caused by the pnpm store living inside the synced project folder. Keep the store outside that tree:

- `.npmrc` sets `store-dir=C:\pnpm-store` (outside the synced tree) and a shortened virtual-store path.
- pnpm is provided by corepack pinned to `packageManager` in `package.json`. If `pnpm` is not on PATH: `corepack enable --install-directory "%APPDATA%\npm"` (create that folder first if needed).
- On non-Windows hosts, override the Windows-specific `.npmrc` store with `npm_config_store_dir` pointing to an external directory (for example, `export npm_config_store_dir="$HOME/.local/share/metagrinder-pnpm-store"` before install and verification). CI uses its runner temporary directory.
- Use `pnpm verify:reimplementation` for the complete gate. Do not run bare `pnpm exec jest` from the repo root — `packages/core/jest.config.cjs` is a stale jsdom/babel config inherited from the parent repo and does not transform TypeScript.
- The `C:\tmp\metagrinder-audit-deps` workaround is obsolete.

### Legacy MVP commands

These commands exercise the old MVP, not the rebuilt corpus pipeline:

```bash
pnpm run:metagrinder-mvp packages/core/tests/fixtures/metagrinder/research-input-broadway.txt
```

For a legacy multi-document run:

```bash
node packages/core/scripts/run-metagrinder-mvp.js \
  packages/core/tests/fixtures/metagrinder/research-input-broadway.txt \
  packages/core/tests/fixtures/metagrinder/research-input-costume-notes.txt \
  --output-dir /tmp/metagrinder-mvp-multi
```

## Legacy Demo Path

For the legacy Broadway or greenhouse fixtures, inspect:

1. `review.json` for unresolved ambiguity and recommended actions
2. `prompt-synthesis.psg` for prompt family output
3. `research-package.json` for final package wiring

## Repository Workflow

- use epic and story issues to define bounded work
- keep changes small and test-backed
- use [CONTRIBUTING.md](CONTRIBUTING.md) for branch, commit, and PR expectations

## Next Planned Area

Continue with the smallest unblocked story in the reimplementation loop. Passing automated checks does not clear the operator-owned provider, held-out, calibration, or phase-exit gates.

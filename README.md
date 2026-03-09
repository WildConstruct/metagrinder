# Metagrinder

Metagrinder is a research distillation pipeline that turns source material into inspectable PSG-oriented artifacts. It is a separate project from Prompt Spaghetti: it depends on PSG as a data structure and interchange format, but it is not the Prompt Spaghetti app.

## What It Is

- a deterministic parser pipeline for research intake, extraction, classification, synthesis, scoring, and review
- a bounded package generator that emits `ingest.json`, `extract.json`, `classify.json`, `synthesize.json`, `score.json`, `review.json`, PSG collections, and `research-package.json`
- a staging ground for UTDG-facing research packaging and prompt mutation work

## What It Is Not

- not the old Prompt Spaghetti frontend or API product
- not a general-purpose graph editor
- not a canonical UTDG submission service yet
- not an LLM-only black box parser

## Current MVP Scope

The current MVP covers:

- single-document and bounded multi-document intake
- deterministic concept extraction with provenance
- cross-document corroboration and contradiction reporting
- prompt-synthesis PSG generation
- prompt-mutation generation and review
- schema-backed package validation

Primary implementation entrypoints:

- [packages/core/scripts/run-metagrinder-mvp.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/scripts/run-metagrinder-mvp.js)
- [packages/core/scripts/lib/metagrinder-mvp.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/scripts/lib/metagrinder-mvp.js)
- [packages/core/types/metagrinder.ts](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/types/metagrinder.ts)
- [docs/research/metagrinder-epic-1-agent-framework.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/docs/research/metagrinder-epic-1-agent-framework.md)
- [docs/research/metagrinder-epic-2-multi-document-intake.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/docs/research/metagrinder-epic-2-multi-document-intake.md)

## Quick Start

```bash
pnpm install
pnpm test:metagrinder
pnpm run:metagrinder-mvp packages/core/tests/fixtures/metagrinder/research-input-broadway.txt
```

For a multi-document run:

```bash
node packages/core/scripts/run-metagrinder-mvp.js \
  packages/core/tests/fixtures/metagrinder/research-input-broadway.txt \
  packages/core/tests/fixtures/metagrinder/research-input-costume-notes.txt \
  --output-dir /tmp/metagrinder-mvp-multi
```

## Canonical Demo Path

Use the Broadway or greenhouse fixtures, then inspect:

1. `review.json` for unresolved ambiguity and recommended actions
2. `prompt-synthesis.psg` for prompt family output
3. `research-package.json` for final package wiring

## Repository Workflow

- use epic and story issues to define bounded work
- keep changes small and test-backed
- use [CONTRIBUTING.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/CONTRIBUTING.md) for branch, commit, and PR expectations

## Next Planned Area

The next work should focus on operational hardening and the next bounded product epic, not widening the parser in an ad hoc way.

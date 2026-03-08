# Metagrinder Epic 1 Operator Note

_Last updated: 2026-03-07_

## Purpose

This note explains how to run the current Metagrinder MVP without reading the full research stack.

## Command

Run from the repository root:

```bash
pnpm run:metagrinder-mvp packages/core/tests/fixtures/metagrinder/research-input-broadway.txt
```

Or run the package script directly with an explicit output folder:

```bash
node packages/core/scripts/run-metagrinder-mvp.js \
  packages/core/tests/fixtures/metagrinder/research-input-broadway.txt \
  --output-dir /tmp/metagrinder-mvp-run
```

For a multi-document dossier:

```bash
node packages/core/scripts/run-metagrinder-mvp.js \
  packages/core/tests/fixtures/metagrinder/research-input-broadway.txt \
  packages/core/tests/fixtures/metagrinder/research-input-costume-notes.txt \
  --output-dir /tmp/metagrinder-mvp-multi
```

## What It Produces

The MVP writes:

- `ingest.json`
- `extract.json`
- `classify.json`
- `synthesize.json`
- `score.json`
- `review.json`
- `source-map.psg`
- `concept-clusters.psg`
- `prompt-synthesis.psg`
- `research-package.json`

## What To Inspect

Check:

1. whether `extract.json` preserves uncertainty rather than flattening weak claims
2. whether `classify.json` keeps unresolved material in the `unresolved` bucket
3. whether `prompt-synthesis.psg` contains usable prompt families for atmosphere, wardrobe, crowd behavior, and lighting
4. whether `review.json` gives a sensible next-action list
5. whether `research-package.json` references the generated collections correctly

## Known Limits

This MVP does not yet include:

- prompt mutation
- UTDG submission packaging
- curator review workflow
- browser UI
- external data lookup

It is a deterministic research-to-PSG package proof, not a full authoring product.

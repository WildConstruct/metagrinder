# Metagrinder Rebuild Root

This tree is the reimplementation target defined in `docs/research/metagrinder-reimplementation-analysis.md`, built under the protocol in `docs/research/metagrinder-reimplementation-loop.md`. Read the loop document before working here.

Ground rules (loop rules A3–A4, abbreviated):

- **Legacy code is read-only reference.** Never `require`/`import` from `../services/*`, `../types/metagrinder.runtime.js`, or `../scripts/lib/*`. Port semantics by reading them.
- `src/schemas/` is the only schema source. Types are `z.infer<>`; no parallel type files.
- No keyword tables or fixture-vocabulary constants in semantic stages. Degraded fallbacks must label their output `analysisMode: 'degraded-keyword'`.
- Semantic stages are never tested by fixture equality — replay evals + rubric scores only.
- Strict TypeScript (`src/tsconfig.json`), executed via `tsx`. Typecheck: `pnpm exec tsc --noEmit -p packages/core/src/tsconfig.json`.

Layout (populated as stories complete):

```text
schemas/     Zod schemas, one file per collapsed artifact family + shared vocabulary
artifacts/   run-folder store, run manifest, content-hash IDs, stage state machine
stages/      ingest | extract | grammar | choices | retrieve | govern
compile/     PSG compiler, sampler, plausibility evaluator, compile diff
realize/     content plan -> prose; per-model profiles; faithfulness gate
providers/   LlmProvider: anthropic | openai | codex-cli | replay
eval/        corpus, rubric scorer, ERA/shift tooling, judge meta-gate, holdout runner
review/      generated review.html + thin workbench server
```

Promoted evaluator command (S3.5 core):

```text
pnpm eval:src -- <legacy|replay> <run-dir> <base-grammar.json> <output.json> [accepted-grammar.json]
```

`legacy` reproduces the committed Epic 4 bootstrap baseline. `replay` accepts only
rebuild extraction artifacts stamped `analysisMode: 'replayed-llm-semantic'`.
The report contains corpus rubric scores, expressive-range metrics, and an
explained base-to-accepted generative shift when both grammars are supplied.

The rebuilt corpus pipeline is available as `pnpm eval:corpus -- record ...`
followed by `pnpm eval:corpus -- replay ...`. The operator-only held-out command
and fence policy live in `src/eval/holdout/README.md`; agents must not execute it.

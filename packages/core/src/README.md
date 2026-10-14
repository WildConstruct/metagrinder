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
stages/      ingest | extract | grammar | choices | sample | realize | retrieve | govern
compile/     PSG compiler, plausibility evaluator, compile diff
providers/   anthropic | codex-cli | custom transports, with record/replay/auto cache modes
eval/        corpus, rubric scorer, ERA/shift tooling, judge meta-gate, holdout runner
review/      generated self-contained review.html (S4.1 covering-array contact sheet)
workbench/   localhost operator-state editor, keyed atomic saves and parse reuse
verification/ canonical type/test/contract iteration gate
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

Judge-scored metrics are guarded by `pnpm eval:judge -- ...`; the external human
calibration format and pass conditions are documented in `src/eval/judge/README.md`.

Live provider commands persist budget usage in each run manifest. Optional caps
use `METAGRINDER_MAX_LLM_CALLS`, `METAGRINDER_MAX_JUDGE_CALLS`, and
`METAGRINDER_MAX_ESTIMATED_TOKENS`. Set `METAGRINDER_CAMPAIGN_ID` plus the
corresponding `METAGRINDER_CAMPAIGN_MAX_*` variables to charge a campaign ledger
alongside each run ledger. Replay cache hits do not consume budget.

## Verification and evaluation limits (S-R3)

From the repository root, run `pnpm verify:reimplementation` under Node 20.19.0 and pnpm 8.15.4. It runs strict source TypeScript, rebuilt and legacy Jest suites, nonmutating generated-contract parity, and stdlib Python contract consumption. The same command is configured in Linux/Windows CI; a local pass is not a remote CI result. Python defaults to `python` on Windows and `python3` elsewhere; `METAGRINDER_VERIFY_PYTHON` can name a literal executable. Regenerate contracts intentionally with `pnpm --filter @promptscape/core codegen:json-schema`; verification never repairs stale contracts for you.

The locked 106/114 bootstrap scores measure extraction metadata (mode, focus labels, rationale/confidence/warnings), not factual accuracy or downstream semantic quality. Rebuilt evaluation consumes one manifest/hash-verified snapshot per brief for scores and diagnostics, rejects changed snapshots, and reports plan references, rules, and lexical realization gates for every brief. Duplicate focus labels cannot earn extra points. A supplied ERA grammar is explicitly single-grammar evidence, and evidence coverage means reference presence only. Choice-graph semantics are not scored.

Sampling enforces supported hard exclusions and requires/force effects; unsupported bias syntax fails closed. Applicable negative targets travel separately from positive prompt text, with instructions preserved as `constraintNotes`. Unstructured constraints remain pending for human review. Literal faithfulness checks reject dropped attributes and added content but conservatively reject paraphrases too; passing is not entailment. Old completed sample/realization stages invalidate through version signatures and can reuse provider responses in `auto` mode.

Calibration requires unique matched human ratings; duplicate, conflicting, or unknown case ratings keep the judge gate closed. Existing provider recording, held-out evaluation, calibration, and phase-exit run cards remain open. A hand-authored mini-cell projection and label diff do not prove source-to-cell regeneration (AC-5.2b).

## Audit repair operations (S-R2)

- Corpus and community runners resume completed stages only after input/request signatures and schema/content hashes match. Use `auto` to reuse response caches when upgrading old runs that have no stage signatures. Explicit `replay` still reads and validates caches; `--rerun` rebuilds stages (`record --rerun` incurs new spend).
- All live commands use durable run budgets. `METAGRINDER_MAX_LLM_CALLS`, `METAGRINDER_MAX_JUDGE_CALLS`, and `METAGRINDER_MAX_ESTIMATED_TOKENS` update supplied limits; absent variables preserve prior limits. Token totals are estimates, not billing receipts.
- `METAGRINDER_CAMPAIGN_ID` enables the shared ledger; use one `METAGRINDER_CAMPAIGN_BUDGET_DIR` across command roots and the corresponding `METAGRINDER_CAMPAIGN_MAX_*` caps. Ledger location is pinned. Pre-shared campaign snapshots with nonzero usage fail closed pending explicit migration. Failed transports keep conservative reservations.
- Paid community jobs default to stable `run_<jobId>` folders. Use `--run-id` for an intentionally separate run. Workbench state stays in `operator-state/*`, merges by record ID, and is served only on `127.0.0.1` with localhost host/origin checks.

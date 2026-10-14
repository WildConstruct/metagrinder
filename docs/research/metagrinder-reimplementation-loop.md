# Metagrinder Reimplementation Loop

_Created: 2026-06-10. Control document for executing the plan in `metagrinder-reimplementation-analysis.md`. This is the document an implementing agent or human reads at the start of every session._

Status legend: `todo | in_progress | blocked_on_human | done`. Update the story tables in place; do not create per-build note files (see Loop Rule 6).

---

## A. The Loop Protocol

### A1. The unit of work is a story

One iteration = one story from Part B, taken in dependency order, smallest unblocked story first. A story is done when its acceptance criteria (AC) pass and the iteration gates pass. Do not start a second story in the same iteration unless the first was trivially small and both fit one reviewable commit.

### A2. The reward function (what "passing" means, per class)

This is the core correction to how the previous system was built. Authority differs by stage class:

| Stage class | Authoritative signal | Explicitly NOT a signal |
|---|---|---|
| Deterministic (chunking, gates, compilers, state machine, verifiers) | Unit tests + golden fixtures + property tests | — |
| Semantic (extract, grammar draft, choices, realization) | Replay-mode evals on the committed corpus, scored by rubric; periodic live runs on **held-out briefs executed by the human operator** | Exact-match against fixture outputs. Equality assertions on LLM output are forbidden for semantic stages. |
| Human-gate machinery (approval, citation review, revision state) | Property tests on the governance invariants ("What Must Never Happen" list) | Example-based tests alone |

### A3. Iteration gates (every iteration, no exceptions)

1. `tsc --noEmit` clean.
2. All unit + property tests green.
3. Replay evals: score must be **>= the recorded baseline** in `B-status` notes. A drop = stop, investigate, revert if needed. Never recover a score by editing judgments (see A4.3).
4. No new hand-mirrored schema files; `src/schemas/` is the only schema source.
5. No new keyword tables, canned-label functions, or fixture-vocabulary constants in semantic stages. If a fallback heuristic is genuinely needed, it must set `analysisMode: 'degraded-keyword'` on its output artifact.
6. Conventional commit per story (`feat:`/`fix:`/`test:`/`chore:`), subject naming the story ID, e.g. `feat: [S1.4] run-folder store with content-hash ids`.

### A4. Hard rules (violating any of these is a failed iteration regardless of green checks)

1. **Never read the held-out brief folder.** Held-out briefs live outside agent reach (see S0.3). An implementing agent that has seen a held-out brief contaminates it; the human swaps it out and notes the burn in the eval log.
2. **Never edit eval judgments in the same change as the stage they score.** Corpus/judgment changes ship in their own commit, flagged `eval-corpus:` in the subject, with a one-line justification.
3. **Stop at human gates.** When a story output requires operator action (approval file, citation review, real-provider config, held-out run), write exactly one run card — a short markdown block in the PROGRESS log saying what to run and what artifact it produces — set the story `blocked_on_human`, and move to the next unblocked story or end the session. Do not build a second validator, readiness packet, preflight blocker, or attestation helper for an already-carded gate.
4. **Gate-elaboration halt.** If your last two iterations changed only validators, reports, docs, or checkpoint notes — not schemas, stages, tests-of-new-behavior, or a consumed artifact — halt and end the session with a note saying so. (This rule exists because of the mini-UTDG 111-build trail and the provider-proof apparatus.)
5. **No speculative scaffolding.** Build machinery only for the story in hand. The eleven-artifact provider-proof zoo is the cautionary example: one `retrieval-log` with a `mode` field until a real provider run exists.
6. **One rolling progress log.** Append per-story completion entries (3–6 lines: story, what changed, gate results, eval scores, surprises) to `docs/research/metagrinder-reimplementation-progress.md`. Never one file per build.
7. **Legacy code is read-only reference until Phase 6.** Port semantics out of `services/*` by reading them; never import from them in `src/`. Fixing legacy bugs is out of scope unless a story says otherwise.

### A5. Session shape

1. Read this doc's story tables; pick the top unblocked story.
2. Write or update the test/eval that defines done *first* (red), then implement (green).
3. Run iteration gates. Append the PROGRESS entry. Update the story table status.
4. Repeat until a natural stop: human gate hit, phase exit gate reached, or gate-elaboration rule triggers.
5. End-of-session: if a phase exit gate is newly satisfied, say so explicitly in the PROGRESS entry; the human confirms phase transitions.

### A6. Human cadence

- The human reviews per-story commits at whatever rhythm suits, but **phase exits require explicit human sign-off** recorded in PROGRESS.
- The human runs held-out evals (S0.3 defines the mechanics) at least once per phase from Phase 3 on, and after any change to extraction prompts.
- The human owns: held-out corpus contents, real provider configs, all operator-state files, and approval of any deletion story.

---

## B. Story Breakdown

Dependencies are implicit in ordering unless noted. AC IDs are stable; reference them in test names (repo convention: `[AC-1.4b] manifest records stage state`).

### Phase 0 — Environment and hygiene

Exit gate: `pnpm install && pnpm exec jest` green from a clean clone on this machine, no `C:\tmp` dependency; eval fence exists; rebuild root decided.

| ID | Story | Status |
|---|---|---|
| S0.1 | **Fix the package manager.** Root cause: pnpm store inside the synced folder. Fix: `.npmrc` with `store-dir=C:\pnpm-store` + corepack shims in `%APPDATA%\npm` + canonical `pnpm test:metagrinder` entry point (root `jest.config.cjs` is a stale jsdom config from the parent repo — flagged for S0.2/S6 cleanup). AC-0.1a ✔ install in 4.4s. AC-0.1b ✔ 134/134 tests, no `C:\tmp` deps. AC-0.1c ✔ README Environment notes + AGENTS.md command fixed. | done |
| S0.2 | **Repo hygiene.** `node_modules (1)/` and `.pnpm-store/` deleted (operator go-ahead 2026-06-10); gitignore updated; stale `/mnt/c` links fixed. Stale `packages/core/jest.config.cjs` left for S6.1 (it documents the legacy parent-repo shape). AC-0.2a ✔. | done |
| S0.3 | **Eval fence — BLOCKED ON HUMAN.** `src/eval/run-holdout.ts` reads operator-owned `METAGRINDER_HOLDOUT_DIR`, executes the same rebuilt corpus pipeline, and writes `holdout-eval-report.json`; `src/eval/holdout/README.md` contains policy only and references rule A4.1; zero held-out brief text is in repo. AC-0.3a ✔ runner/policy fence. AC-0.3b ✔ no agent read. Remaining: human authors 6–10 external briefs + judgments and executes the run card. | blocked_on_human |
| S0.4 | **Rebuild root.** `packages/core/src/` created with full skeleton, strict `src/tsconfig.json` (NodeNext, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes), `src/README.md` with ground rules, `tsx` + `@types/node` added to core devDeps. AC-0.4a ✔ `hello.ts` zod round-trip runs via `pnpm --filter @promptscape/core exec tsx src/hello.ts`; `tsc --noEmit -p src/tsconfig.json` clean. | done |

### Phase 1 — Schema core

Exit gate: all collapsed artifact schemas exist in `src/schemas/` with inferred types and JSON Schema codegen; run-folder store round-trips a manifest with content-hash IDs and stage states.

| ID | Story | Status |
|---|---|---|
| S1.1 | **Schema package.** 16 schema files in `src/schemas/` covering all 18 collapsed families; types via `z.infer` only. AC-1.1a ✔ no duplicate type/schema pairs. AC-1.1b ✔ `COLLAPSE-MAP.md` maps all legacy collection types (+ out-of-scope camera/render lane list + v0.2 watchlist). Gates: tsc strict clean, 15/15 schema tests, legacy 134/134. Notable: extraction `category` is an open string (legacy fixture enum removed); UTDG candidates enforce staged-only + `utdg:*` id convention in-schema. | done |
| S1.2 | **Vocabulary unification.** `vocabulary.ts` is the single enum source: evidence basis, attribution modes + verification states, review status/tier, rights, gates, stage states, analysis modes, source families, co-occurrence basis, UTDG entity types. AC-1.2a ✔. | done |
| S1.3 | **JSON Schema codegen.** `codegen:json-schema` emits 15 draft-07 contracts to `contracts/json-schema/` + INDEX.md. AC-1.3a ✔ adapted to reality: Image_Prep validators are stdlib-only (no jsonschema dep), so `contracts/check_json_schema_consumable.py` proves stdlib-`json` consumption of 3 contracts + span shape, green. Known limit documented: zod `.refine()` cross-field rules don't survive translation (TS-side only). | done |
| S1.4 | **Run-folder store + manifest.** `src/artifacts/ids.ts` (sha256 content-derived IDs: normalize → NFC + whitespace collapse; occurrence-indexed for repeated texts; span-independent so unchanged chunks keep IDs when surroundings shift) + `src/artifacts/store.ts` (RunStore: validate-then-write, read-revalidates, manifest persisted per mutation, stage state machine, `nextRunnableStages`, per-stage model registry with replace-on-change) + `src/schemas/registry.ts` (the one family→schema map, shared with codegen). AC-1.4a ✔ AC-1.4b ✔ resume via `RunStore.open` AC-1.4c ✔ invalid writes throw before disk. 10 tests. | done |
| S1.5 | **Fixture port.** All 12 epic4 briefs copied to `src/eval/corpus/briefs/<id>.*`; `judgments.json` ported byte-identical (sha256-asserted by test); `src/eval/corpus.ts` loader joins briefs↔judgments by id (legacy `path` field untouched), rejects orphans/empties, types the scoring rubric. AC-1.5a ✔. Discovery: `warning_tolerance` is a level (`low|medium`), not a count — loader schema reflects reality. | done |

### Phase 2 — Deterministic spine

Exit gate: ingest → (legacy-quality placeholder grammar) → PSG compile runs end-to-end on the Broadway fixture through the new store; governance property tests green; content plans sample deterministically. — REACHED 2026-06-10 (pipeline.phase2.test.ts), awaiting human sign-off. Carry-forward into Phase 3: compile-diff (S2.2 leftover), and registering 'psg' as a stored artifact family so compiled PSGs persist through RunStore.

| ID | Story | Status |
|---|---|---|
| S2.1 | **Ingest + span index.** `src/stages/ingest/`: pure `chunk.ts` (paragraph split with exact byte spans into newline-normalized canonical text, structural-only heading/section detection, title derivation — NO chunkKind/taxonomy keyword heuristics; those move to extract) + `index.ts` (`ingestText` / `ingestPhotoObservations`, both → validated SourcePackage, content-hash IDs, input-mode-agnostic SourceChunk shape). AC-2.1a ✔ span invariant (incl. CRLF) AC-2.1b ✔ both modes, real corpus brief. 12 tests. | done |
| S2.2 | **PSG compiler port — DONE.** `src/compile/psg.ts` (builders in exact golden key order; compactText/choiceWeightFromRange verbatim) + `scene-grammar-psg.ts` (base linear + `buildBranchSceneGrammarPsgs`: 7 branches incl. branchWeight) + `__fixtures__/historical-crowd-grammar.ts` (first new-schema grammar; S2.4/S3.3 reuse). AC-2.2a ✔ base byte-identical. AC-2.2b ✔ 6/7 branches byte-identical vs legacy capture; specimen-router checked structurally (legacy fed it extractor noise — fixture uses clean refs). 12 compile tests. **Re-scoped (honest):** legacy sampler is SUPERSEDED by S2.4 content-plan sampling (plan-then-realize makes that the canonical sampler — no verbatim port). compile-diff → lands with S2.3 (needs accepted grammar). semantic-choice-graph PSG path → belongs with the choice-graph stage (S3.x), not the deterministic scene-grammar compile. | done |
| S2.3 | **Governance state machine — DONE.** `src/stages/govern/`: `index.ts` (promoteApprovedCandidates, citationStatusForRevision, applyAcceptedRevisions, computeIntegrityFlags) + `target.ts` (pure targetRef resolver/setter) + `schemas/operator-state.ts` (IntakeApproval). Did NOT port the legacy "+2" weight hack — applicator sets the revision's proposedValue and derives material-vs-confirmation by comparison. AC-2.3a ✔ property tests: only approved+non-mismatched candidates promote; only accepted decisions apply; rejected/needs_review/mixed citations never mutate without override; override records 'override'+warning; low-quality source blocks silent high confidence. AC-2.3b ✔ retraction cascades flags to evidence/claims/deltas, never rewrites. AC-2.3c ✔ supersession. 17 govern tests. compile-diff (the S2.2 leftover) still pending — small, lands next. | done |
| S2.4 | **Content-plan sampling — DONE.** `src/stages/sample/`: `rng.ts` (mulberry32 seeded PRNG + weightedPick — no Math.random) + `rules.ts` (hard compatibility-rule checker: exclude/incompatible-with/avoid effects vs selection) + `index.ts` (sampleContentPlans: weighted archetype/zone/modifier selection, resample on violation up to 24 attempts, emit nothing rather than a violating plan). AC-2.4a ✔ same grammar+seed+count → identical plans. AC-2.4b ✔ property test over 40 seeds × 20 plans: zero rule violations; unsatisfiable rule emits nothing. Plus end-to-end Phase 2 smoke (`pipeline.phase2.test.ts`): ingest→grammar→compile→sample through RunStore, resumable. 6 tests. | done |

### Phase 3 — Semantic stages, providers, harness

Exit gate: full pipeline (LLM extraction → grammar → choices → plans → realization) runs on the committed corpus in replay mode in CI; scores ≥ recorded heuristic baseline; held-out run executed by human with scores ≥ baseline; judge meta-gate green.

| ID | Story | Status |
|---|---|---|
| S3.1 | **LlmProvider + replay — DONE.** `src/providers/`: `types.ts` (LlmProvider/Transport, schema-bound LlmRequest, typed errors) + `cache.ts` (response cache under `<runDir>/llm-cache/`, NOT a manifest family) + `caching-provider.ts` (record/replay/auto wrapper: caches live response BEFORE parsing, validates against the request schema after, tolerant JSON extraction) + `anthropic.ts` + `codex-cli.ts` (real transports; network/spawn is the untested boundary, injectable `fetch`/transport is the tested seam) + `buildProvider` factory. AC-3.1a ✔ record→replay identical, transport never called in replay. AC-3.1b ✔ provider/model/version recorded per stage in the manifest. 8 tests with a fake transport. Baseline-staleness on model change = Phase 3.5 hook (recordModel replaces per stage). | done |
| S3.2 | **Extract stage + verifiers — DONE (AC-3.2a); AC-3.2b → S3.5.** `src/stages/extract/`: `verify.ts` (per-mode AIS checks: chunk-id existence → reject/drop; `quoted` → exact substring of cited chunk via S2.1 spans → else downgrade + demote to paraphrased; `paraphrased` → lexical-overlap grounding ≥0.6, a documented proxy for NLI with a model-entailment upgrade seam; `inferred` → never source-verified, requires reasoningNote, capped low) + `index.ts` (extract: provider call w/ ExtractionPayloadSchema → verify; stage owns envelope + analysisMode incl. replay stamping) + `ExtractionPayloadSchema` (model returns content only). AC-3.2a ✔ corrupted-replay tests: fabricated quote downgraded, nonexistent chunk dropped, inferred capped. 12 tests. AC-3.2b (eval ≥ baseline) needs the evaluator + recorded extraction → verified at S3.5. | done |
| S3.3 | **Grammar draft + choice graph stages — DONE.** `src/stages/grammar/`: `verify.ts` (provenance-gated: archetype/zone/rule/constraint citing a nonexistent chunk is dropped; arithmetic — weight-range order, archetype weight-mass sanity band 40–200%) + `index.ts` (draftGrammar: provider w/ SceneGrammarPayloadSchema → verify → stage owns envelope/analysisMode/grammarTarget='base'). `src/stages/choices/`: deterministic projection grammar → archetype/zone/environment axes (provenance + grammarRefs carried). AC-3.3a ✔ source-cleanliness test: grammar/choices source contains ZERO fixture vocabulary (the anti-regression). AC-3.3b ✔ historical-crowd AND medieval-market inputs (ingested → real chunk ids) draft valid grammars with all archetype provenance verified. 13 tests. | done |
| S3.4 | **Realization stage — DONE.** `src/stages/realize/`: `gate.ts` (faithfulnessGate: slot-coverage — every plan slot must surface; unsupported-content — prose not dominated by content absent from the plan; lexical proxy for NLI with a model-entailment upgrade seam) + `index.ts` (realizeTemplate for 3 profiles caption-prose/keyword-stack/tag-stream + realizeWithProvider — LLM caption run through the SAME gate so an unfaithful model caption is flagged, not trusted). Refs inherited from plan slots onto the RealizedPrompt (schema gained utdgRefs/evidenceRefs). AC-3.4a ✔ gate fails on dropped slot AND on injected unsupported content. AC-3.4b ✔ utdgRefs/evidenceRefs inherited. 11 tests. | done |
| S3.4a | **Audit correctness hardening — DONE.** Repair deterministic boundaries discovered before evaluator promotion. AC-3.4a.1 ✔ replay cache identity includes provider/model/version and never misattributes a response across models. AC-3.4a.2 ✔ confidence downgrades update both record and provenance confidence, including evidence-only records. AC-3.4a.3 ✔ RunStore rejects paths outside the run folder and detects valid-schema content whose hash no longer matches the manifest. 4 regression tests. | done |
| S3.5 | **Eval harness promotion — BLOCKED ON HUMAN.** Rubric scorer promoted with separate legacy-bootstrap and rebuilt-extraction adapters; committed 106/114 baselines locked in CI; `eval-report` schema/codegen added; deterministic ERA + explained base/accepted shift implemented. `run-corpus.ts` executes ingest → extract → grammar → choices → plans → realization through RunStore in record/replay modes; generated output JSON Schema is included in every model prompt and cache identity; replay makes zero transport calls and emits a scored report. AC-3.5a ✔ AC-3.5b ✔. Remaining: operator-owned provider configuration must record the committed corpus, then replay must score ≥106; held-out action remains S0.3. | blocked_on_human |
| S3.6 | **Judge meta-gate — BLOCKED ON HUMAN.** `src/eval/judge.ts` runs known-good/bad cases in mirrored left/right positions, requires complete analytic criterion scores, measures preference agreement + score MAE against operator ratings, and exposes `assertJudgeMetricsAllowed` as the hard metric guard. Schema-bound LLM adapter, committed battery, `eval:judge` command, and external calibration policy are present. AC-3.6a ✔ biased/missing-calibration judges cannot report metrics. Remaining: operator records the small calibration set and runs the judge gate; `passed: true` is required. | blocked_on_human |
| S3.7 | **Budget ledger — DONE.** Run manifests carry persistent run/campaign ledgers with LLM-call, judge-call, and estimated-token usage/caps. Only live cache misses reserve spend; replay is free. Calls reserve output tokens before transport, settle actual output afterward, and cache the response before a post-call token overage halts. Cap failures set the stage `blocked_on_gate` with `budget-cap`; raising caps restores it to `pending`. Corpus, holdout, and judge commands use the same ledger. AC-3.7a ✔. 2 tests. | done |

### Phase 4 — Review surfaces

Exit gate: an operator can review a full run and write every operator-state file without touching raw JSON; review queue is impact-ordered.

| ID | Story | Status |
|---|---|---|
| S4.1 | **Generated `review.html`.** Self-contained per-run viewer (ExtraExtra pattern): artifacts, provenance chains, gate states; review samples drawn by covering array over choice axes. AC-4.1a: opens from the filesystem with no server. | todo |
| S4.2 | **Workbench thin rebuild.** Normal toolchain; write boundary = operator-state files only; reuse-by-default for costed parses. Grammar-revision screen shows base-vs-accepted ERA plots (the generative shift), not just delta JSON. AC-4.2a: write-boundary property test — server cannot write any generated artifact path. | todo |
| S4.3 | **Queue economics + reviewer provenance.** Review queues ordered by gap priority × predicted shift × uncertainty; every gate file records reviewer id/role, date, rationale. AC-4.3a: queue order is deterministic and explained per item. | todo |

### Phase 5 — Ecosystem bridges and the first campaign

Exit gate: 1909 Speedway mini-cell regenerated from source anchors through the new pipeline; first research campaign run to a coverage target with receipts and gap-closure accounting; one real retrieval query proven candidate-only.

| ID | Story | Status |
|---|---|---|
| S5.1 | **Photo-observation bridge.** Land the historical-photo intake (re-targeted uncommitted work) against new schemas. AC-5.1a: the Indy 500 observation fixtures flow to claims with `observed` evidence basis. | todo |
| S5.2 | **UTDG export.** Staged `utdg-candidates.json` in application-profile shapes; PSG carries `utdgRefs[]`. AC-5.2a: Hypothesis B test — every prompt phrase traces to refs; a UTDG label change produces an explained prompt delta. AC-5.2b: regenerate the 1909 mini-cell record families from its source anchors; diff report against `utdg-mini-cell-v0.json`. | todo |
| S5.3 | **Reconciliation step.** Pre-staging dedup: `same-as | variantOf | distinct` proposals (embedding-assisted, LLM-proposed, human-confirmed). AC-5.3a: re-running a campaign over overlapping sources does not double cell records. | todo |
| S5.4 | **Campaign schema + gap registry.** Persistent cross-run gap registry; `research-campaign` artifact with typed source-family hypotheses, negative-result memory (checked-when + shelf life), gap-closure lineage. AC-5.4a: schema + validator + one fixture campaign. | todo |
| S5.5 | **Source discovery (bounded).** Archive search adapters (Internet Archive / Chronicling America / LOC APIs), candidate-only, metadata-only, rights ladder applied, hypothesis-match verification. AC-5.5a: discovery output cannot enter the registry without the intake-approval gate (property test). | todo |
| S5.6 | **Handoff receipts.** Import-receipt artifact (package ID, hash, status, date) written by consumers into the producing run; lineage query traverses receipts. AC-5.6a: an unreceipted handoff shows as `unconfirmed` in lineage output. | todo |
| S5.7 | **Generation-QA routing.** Typed QA-failure signals (realization / grammar / signature defect) routed to profile backlog, gap registry, or revision proposal. AC-5.7a: a synthetic QA failure of each type lands in the right queue; none creates evidence. | todo |
| S5.8 | **Real retrieval proof.** One real provider, one query, candidate-only, cache-replay through approval + citation review. *Blocked on human: real provider config.* | todo |
| S5.9 | **Roadshow campaign.** Run the 1909 cell campaign (clothier/catalog + LOC photography + Chronicling America hypotheses) to a coverage target; campaign report = gap-closure accounting. *Multiple human gates by design.* | todo |

### Phase 6 — Legacy deletion

Exit gate: `packages/core` contains only `src/`, tests, fixtures-as-corpus, and docs; closing checkpoint written.

| ID | Story | Status |
|---|---|---|
| S6.1 | **Delete legacy services, runtime mirror, test monolith, provider-proof artifacts.** *Deletion story — human sign-off required; preceded by a final grep proving nothing imports them.* | todo |
| S6.2 | **Docs pass.** README rewritten around the new pipeline (including the honest determinism statement: runs are reproducible because model outputs are artifacts); closing checkpoint note. | todo |

---

## Audit repair plan — S-R1

Scope: the first audit repair slice, authorized 2026-10-13. This is one trust-boundary repair story; existing phase exits and operator run cards remain in effect.

| ID | Acceptance criterion | Files | Status |
|---|---|---|---|
| S-R1a | Every cited claim and review must resolve, and all citations must be approved before a material revision applies without an explicit override. Retraction flags include direct evidence dependencies and appear on returned accepted grammar. | `stages/govern/` | done |
| S-R1b | Contributor terms never widen automatically. Export recomputes permission eligibility from current contributing sources; missing lifecycle is visibly unverified and retracted/restricted sources block permission. Reconciled lineage invalidates prior permission checks. | `stages/utdg/{rights,project}.ts`, `schemas/utdg.ts` | done |
| S-R1c | Every grammar family receives attribution checks and validates input/chunk ownership. Real chunk IDs alone never certify unsupported grammar content; inference and lexical proxies retain uncertainty and synchronized confidence. | `stages/grammar/` | done |
| S-R1d | Label/external-ID matches require human reconciliation bound to current proposal content. Automatic idempotency requires identical stable identity and content; Unicode labels are preserved. | `stages/reconcile/` | done |
| S-R1e | Handoff hashes cover nested manifest values and collection content hashes. Sealing and lineage checks validate current RunStore bytes; stale or incomplete packages cannot confirm a handoff. | `stages/handoff/`, `schemas/package-manifest.ts` | done |

Implementation order: add failing invariant tests, repair the five boundaries, regenerate affected JSON Schema contracts, then run strict TypeScript, the complete rebuilt and legacy suites, bootstrap baseline regressions, contract consumption, and diff checks. No extraction prompt or eval judgment changes are part of this story. Real-provider and held-out evidence remain the existing operator gates.

Compatibility: grammar requests now include each chunk's owning input ID, so older grammar response caches do not match the repaired request. A permission-eligible UTDG export requires current `sourceLifecycle` data and, where IDs differ, `sourceIdsByInputId`; eligibility is a permission check, not human content approval. Reconciliation proposal IDs are content hashes, so previous ordinal decisions must be reviewed against fresh proposals. Handoffs use `sealPackageManifest(store, manifest)` before hashing; `queryRunHandoffLineage` now receives that manifest and verifies current collection bytes.

## Audit repair plan — S-R2

Scope: the second audit repair slice, authorized 2026-10-13. One repair story covers budgets, resumability, transport, and workbench persistence; existing operator/phase gates remain unchanged.

| ID | Acceptance criterion | Files | Status |
|---|---|---|---|
| S-R2a | Every live command charges a persistent run ledger and one shared campaign ledger when configured. Absent cap variables preserve existing caps. Reservations settle once, concurrent updates cannot overspend, replay is free, and cap failures remain blocked. | `artifacts/{store,shared-budget}.ts`, `providers/{budget-policy,caching-provider,index}.ts`, live entry points | done |
| S-R2b | Completed stages resume from schema/hash-verified outputs only when input/configuration/request signatures match. Raising a cap resumes the interrupted stage without paying for completed stages. Changed source/model/sample settings invalidate appropriate outputs; explicit replay revalidates cache and explicit rerun is available. | `artifacts/resume.ts`, corpus/community runners, `schemas/run-manifest.ts` | done |
| S-R2c | Windows native and JavaScript Codex entry points start without shell interpolation; timeout/startup errors clean up. Replay rejects cache entries whose persisted identity disagrees with the requested key. | `providers/{codex-cli,cache}.ts` | done |
| S-R2d | Operator-state round trips survive reload and run switching; saves merge by record identity and cannot delete unrelated approvals/decisions. TSV reads bypass JSON parsing. Writes are atomic, stay within operator-state, and localhost write requests respect host/origin boundaries. | `workbench/` | done |

Order: establish failing regression/invariant tests, repair independent boundaries, integrate all live entry points, regenerate contracts, then verify on Node 20.19.0 with rebuilt/legacy suites, strict TypeScript, bootstrap baseline locks, source-derived contract checks, scoped diff integrity, and an isolated staged checkpoint. No paid provider evaluation, held-out reads, or eval judgment edits are authorized by this repair.

Compatibility: old stages without signatures rebuild through `auto` cache reuse, not assumed-complete artifacts. Corpus sampling now persists `sampled-content-plans.json` separately from realized `content-plans.json`. Community paid CLI runs reuse `run_<jobId>` unless `--run-id` is given; `--rerun` rebuilds completed stages, and `record --rerun` spends again. Set `METAGRINDER_CAMPAIGN_BUDGET_DIR` consistently across command roots; shared ledger location is pinned. Existing campaign snapshots with nonzero pre-shared usage require explicit migration rather than an invented aggregate. Missing cap variables never clear limits; transport errors retain conservative reservations. Workbench writes require localhost/same-origin access.

## C. Bootstrap Sequence (first session, in order)

1. S0.1 (pnpm) — everything else is hostage to it. If it resists more than one session, escalate to the human with findings rather than architecting around it again.
2. S0.4 (rebuild root) — cheap, unblocks Phase 1 regardless of S0.2/S0.3.
3. S0.2 (hygiene) — present the deletion list to the human, then execute.
4. S1.1 → S1.2 → S1.4 — the schema core and store are the spine; S1.3/S1.5 can interleave.
5. Hand the human their two standing tasks early: author held-out briefs (S0.3) and decide the real-provider question (S5.8) — both have long lead times and zero agent dependency.

## D. Standing human tasks

- Author/curate held-out briefs and judgments (S0.3); refresh any brief an agent has seen.
- Phase-exit sign-offs; deletion-story confirmations (S0.2, S6.1).
- Held-out eval runs from Phase 3 on; judge calibration ratings (S3.6).
- Real provider config (S5.8); campaign source approvals and citation reviews (S5.9).

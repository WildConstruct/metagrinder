# Metagrinder Reimplementation Progress Log

Rolling per-story log. Append entries at the top. Format:

```text
## YYYY-MM-DD [S<phase>.<n>] <story title> — <status>
- changed: <files/areas>
- gates: tsc <ok|fail>, tests <n pass/n fail>, replay evals <score vs baseline | n/a>
- notes: <surprises, decisions, deviations>
```

Phase exits and human sign-offs are recorded here as `## PHASE <n> EXIT — approved by <who>, <date>`.

Eval baselines are recorded here as `## BASELINE — <corpus|holdout> <score> @ <commit>` and may only move via an `eval-corpus:` flagged commit or a recorded improvement.

---

## 2026-06-10 [S3.2] Extract stage + AIS verification — DONE (AC-3.2a)
- changed: src/stages/extract/{verify,index,extract.test}.ts, schemas/extraction.ts (+ExtractionPayloadSchema), providers/types.ts (schema generic input-open fix)
- gates: tsc clean; src 84/84 (10 suites); legacy 134/134
- notes: THE payoff — the S2.1 byte spans get used. verify.ts is AIS operationalized: chunk-id existence (missing → record dropped), quoted → must be a verbatim substring of a cited chunk (else downgraded AND demoted quoted→paraphrased + confidence→low + warning), paraphrased → lexical containment overlap ≥0.6 (an explicit, documented proxy for NLI — the real model-entailment check is a future upgrade behind the same seam), inferred → never source-verified, requires a reasoningNote, capped low. Pure functions; LLM output untrusted until checked. The structural fix for the original keyword-table failure: extraction quality is now gated by source-grounding, not by a vocabulary table. Type fix: LlmRequest.schema is z.ZodType<T,_,unknown> so schemas with .default() bind T to the OUTPUT type. AC-3.2b (eval ≥ heuristic baseline) genuinely needs the evaluator (S3.5) + recorded/real extraction on the corpus → deferred to S3.5, where S0.3 held-out briefs also become load-bearing. Next: S3.3 grammar-draft + choice-graph stages.

## 2026-06-10 [S3.1] LlmProvider + replay — DONE (Phase 3 begins)
- changed: src/providers/{types,cache,caching-provider,anthropic,codex-cli,index,providers.test}.ts
- gates: tsc clean; src 76/76 (9 suites); legacy 134/134
- notes: The honest-LLM seam. Provider returns UNTRUSTED data validated against the request's Zod schema (throws LlmValidationError on mismatch). record/replay/auto modes; replay reads <runDir>/llm-cache/ and never touches the network (ReplayMissError on miss) — this is how runs become reproducible (determinism of runs via cached artifacts, not of models). Live response cached BEFORE parsing so a parse failure leaves an inspectable artifact. Two real transports (anthropic Messages API, codex-cli spawn) with the network/spawn as the untested boundary and an injectable fetch/transport as the tested seam — 8 tests use a fake transport. Anthropic model defaults to claude-opus-4-8. Cache is deliberately NOT a package-manifest family (provider I/O = cache, per COLLAPSE-MAP). Next: S3.2 extract stage + the per-mode AIS verification layer (this is where ingest spans from S2.1 get used for quote checking).

## 2026-06-10 PHASE 2 EXIT — approved by Brian Behm
Deterministic spine complete and signed off: span-indexed ingest, byte-identical PSG compiler (base + 7 branches), governance state machine with invariants property-tested, deterministic rule-safe content-plan sampling — all through the validating RunStore (commits e43bb6a, 25bacab, 2ed2312, f2b0295). Phase 3 (semantic stages on the provider interface) begins at S3.1. S0.3 held-out briefs still in progress operator-side; S3.1 (LlmProvider + replay) needs neither briefs nor live API and proceeds now. Briefs gate the live held-out eval at the Phase 3 exit, not the build.

## 2026-06-10 [S2.4] Content-plan sampling + Phase 2 end-to-end — DONE
- changed: src/stages/sample/{rng,rules,index,sample.test}.ts, src/pipeline.phase2.test.ts
- gates: tsc clean; src 68/68 (8 suites); legacy 134/134
- notes: Seed-deterministic sampler (mulberry32, no Math.random) emits content-plans; hard compatibility rules (exclude/incompatible-with/avoid) enforced at sampling time by resample — emit nothing rather than a violating plan. AC-2.4b proven over 40 seeds × 20 plans = 0 violations, plus an unsatisfiable-rule → 0 plans case. This is the NEW canonical sampler that supersedes the legacy buildSamplePromptsArtifact (per S2.2 re-scope). Phase 2 end-to-end smoke wires ingest→placeholder grammar→PSG compile→sample through RunStore with resumable manifest state.
- PHASE 2 EXIT GATE REACHED — awaiting human sign-off. Spine complete: ingest (span-indexed), PSG compiler (byte-identical), governance (invariants property-tested), content-plan sampling (deterministic + rule-safe), all through the validating run store. Carry-forward into Phase 3: compile-diff (small S2.2 leftover) and registering 'psg' as a stored artifact family.

## 2026-06-10 [S2.3] Governance state machine — DONE
- changed: src/stages/govern/{index,target,govern.test}.ts, src/schemas/operator-state.ts (IntakeApproval), schemas/index.ts
- gates: tsc clean; src 62/62 (6 suites); legacy 134/134
- notes: The moat, implemented as pure functions with the "What Must Never Happen" list as property tests (for-all over statuses, not single examples). Forward chain: promoteApprovedCandidates (only approved+non-mismatched → sources) → applyAcceptedRevisions (only accepted decisions; citation gate: material change needs 'approved' citation OR explicit decision.citationOverride; rejected/needs_review/mixed → confirmation delta + warning; low-quality source blocks silent high confidence; supersession via supersedesRevisionId replacing the same target). Backward: computeIntegrityFlags cascades retraction → flags on dependent evidence/claims/deltas, NEVER rewrites (hole 2). Deliberately did NOT port the legacy applyRevisionToGrammar "+2 to min/max" hack — that was fixture nonsense; new applicator sets the revision's proposedValue and classifies material-vs-confirmation by deep comparison. Remaining for Phase 2 exit: S2.4 content-plan sampling (+ the small compile-diff leftover). Then end-to-end ingest→grammar→compile wiring + Phase 2 exit sign-off.

## 2026-06-10 [S2.2] PSG compiler port — DONE (base + 7 branches)
- changed: scene-grammar-psg.ts (+buildBranchSceneGrammarPsgs, branchWeight, buildBranchPsg), __fixtures__/historical-crowd-grammar.ts (+role/gender/class, zone labels, 7 negative constraints verbatim, clean visual refs), scene-grammar-psg.test.ts (+branch suite)
- gates: tsc clean; src 50/50 (5 suites)
- notes: 6/7 branches byte-identical to legacy (baseline, grandstand, rail, pit, infield, negative-constraints). branchWeight verified — grandstand weights 55/25/8.13/7.5/11.7/7.2 reproduced exactly from archetype role/gender/class. The 7th (specimen-reference-router) consumed legacy EXTRACTOR NOISE (captions like "notes: Visual reference caption:..."); byte-matching that would just copy garbage, so the fixture carries clean authored references and the router is checked structurally — a deliberate, documented divergence. Re-scoped S2.2 leftovers honestly: legacy sampler superseded by S2.4 content-plan sampling (not ported); compile-diff waits on S2.3 accepted grammar; semantic-choice-graph PSG path moves to the choice-graph stage (S3.x). Phase 2 exit now needs S2.3 (governance state machine) + S2.4 (content-plan sampling).

## 2026-06-10 [S2.2] PSG compiler port — in_progress (base linear done)
- changed: src/compile/{psg,scene-grammar-psg,scene-grammar-psg.test}.ts, src/compile/__fixtures__/historical-crowd-grammar.ts, src/compile/__golden__/* (captured), scripts/capture-legacy-psg-golden.js
- gates: tsc clean; src 41/41 (5 suites); legacy 134/134 (run earlier this session)
- notes: Resolved the apparent byte-identity-vs-schema-divergence tension — the compiler reads only fields the new SceneGrammar carries (incl. the "15 chunks/52 claims" string, which lives in sceneContext.summary, NOT computed). So byte-identity IS achievable and proven for the base linear PSG. Key technique: Zod .parse() reorders keys, so builders construct plain objects in the EXACT golden key order (id,type,x,y,name,payload) and the compiler serializes the hand-built object (validates a copy). Authored the first real new-shape grammar fixture by mechanical translation of the legacy capture — a permanent asset for S2.4 sampling + S3.3 target. Capture script moved to scripts/ (requires legacy; src/ must not). REMAINING: 7 branch graphs + semantic-choice path (AC-2.2b), sampler, plausibility eval, compile-diff. accepted-target golden waits on S2.3 (compiler is target-agnostic).

## 2026-06-10 [S2.1] Ingest + span index — done (Phase 2 begins)
- changed: src/stages/ingest/{chunk,index,ingest.test}.ts
- gates: tsc clean; src 38/38 (4 suites); legacy 134/134
- notes: Deliberate honesty split — legacy researchIngest tangled deterministic chunking with fixture-shaped classification (RESEARCH_HEADING_TAXONOMY: wardrobe/atmosphere; detectChunkKind keyword tables). Ported ONLY the structural half: paragraph spans + structural heading detection. chunkKind stays 'unknown' for text mode (extract classifies, Phase 3); photo mode sets it because the adapter structurally knows what it rendered. Span invariant: chunk.text is the verbatim trimmed slice of the newline-normalized canonical text (internal newlines preserved), so canonical.slice(start,end)===text always — the substrate for AIS quote verification in S3.2. Both input modes (text, photo-observation) emit identical SourceChunk shape so downstream never branches on mode.

## 2026-06-10 PHASE 1 EXIT — approved by Brian Behm
Schema core, codegen + contracts, validating run-folder store with content-hash IDs and resumable stage states, and eval corpus all green (src 28, legacy 134). Commits 7e9c76d (historical-photo) + 42054b9 (reimpl Phase 0-1). Phase 2 (deterministic spine) begins at S2.1. S0.3 held-out briefs still in progress on the operator side — does not gate Phase 2; gates Phase 3 semantic evals.

## 2026-06-10 [S1.5] Eval corpus port — done
- changed: src/eval/corpus/{briefs/(12 files),judgments.json}, src/eval/corpus.ts, corpus.test.ts
- gates: tsc clean; src 28/28 (3 suites); legacy 134/134
- notes: judgments.json byte-identity with the epic4 original is sha256-asserted in test — future judgment edits REQUIRE updating both copies via an `eval-corpus:` commit (or retiring the experiments copy at S6). Loader joins by brief id; legacy `path` field untouched. Field discovery: `warning_tolerance` is 'low'|'medium' (a level), not a count.
- PHASE 1 EXIT GATE REACHED — awaiting human sign-off (loop A6): schemas+codegen+store+corpus all green.

## 2026-06-10 ENVIRONMENT INCIDENT — node_modules corruption recurred
- symptom: between green gate runs, `node_modules/.bin` emptied and individual packages (resolve-cwd, jest-resolve, @jest/pattern) lost their files; each reinstall left different packages empty. NOT OneDrive path-redirection (Documents is local; attributes clean) — cause consistent with the historically documented silent materialization failure in this synced workspace.
- mitigation applied: `.npmrc` now sets `package-import-method=copy` (no hardlinks into the workspace); post-install empty-dir audit came back 0; all gates green afterward.
- WATCH: if node_modules degrades again under copy mode, the durable fix is moving the working copy out of `Documents\Cascade Projects` (e.g. C:\dev\metagrinder) — operator decision, affects sibling-relative paths in Image_Prep docs. Flagging rather than re-architecting per loop S0.1 escalation rule.

## 2026-06-10 [S1.4] Run-folder store + content-hash IDs — done
- changed: src/artifacts/{ids,store,store.test}.ts; src/schemas/registry.ts (single family→schema map); emit-json-schema refactored onto registry (accepted-scene-grammar shares scene-grammar contract, noted in INDEX.md)
- gates: tsc clean; src 25/25; codegen + python check green; legacy 134/134
- notes: ID design — IDs hash normalized content (NFC + whitespace collapse) + sourceInputId + occurrence index, deliberately NOT span offsets, so an unchanged chunk keeps its ID when surrounding text shifts (reconciliation-friendly). RunStore is the only artifact door: validate-then-write (invalid never touches disk), reads re-validate (tampered files fail loudly), manifest persists every mutation, create() refuses to clobber, open() resumes. Model registry replaces per stage — baseline-staleness triggers hook here (S3.1). Remaining for Phase 1 exit: S1.5 fixture port, then human sign-off.

## 2026-06-10 [S1.3] JSON Schema codegen — done
- changed: src/schemas/emit-json-schema.ts, contracts/json-schema/ (15 contracts + INDEX.md), contracts/check_json_schema_consumable.py, core script codegen:json-schema, +zod-to-json-schema devDep
- gates: tsc clean; src 15/15; legacy 134/134; python contract check green
- notes: AC adapted — Image_Prep's validators are stdlib-only (json/re/pathlib, no jsonschema package, and their .venv has no python.exe), so the consumption proof uses stdlib json against 3 contracts + the span shape. Limit recorded in the emitter: zod .refine() cross-field rules (span end>=start, weight max>=min) don't translate — consumers get shapes, TS keeps the invariants. contracts/ is committed-canonical: regenerate via codegen, never hand-edit.

## 2026-06-10 [S1.1+S1.2] Schema core + vocabulary — done
- changed: packages/core/src/schemas/ (16 files: vocabulary, provenance, source-package, extraction, scene-grammar, choice-graph, source-lifecycle, revisions, retrieval, gap-registry, campaign, content-plan, run-manifest, package-manifest, utdg, receipts, index) + COLLAPSE-MAP.md; jest.src.config.cjs + tsconfig.test.json + test:src/typecheck:src scripts; hello.ts deleted
- gates: tsc strict clean; src tests 15/15; legacy suite 134/134
- notes: All 18 collapsed families schematized; legacy 60-type enum fully mapped in COLLAPSE-MAP.md with an out-of-scope list (camera/render lane) and a v0.2 watchlist. Design decisions worth review: (1) extraction `category` is an open string — the legacy Broadway-fixture category enum is gone; (2) Provenance is one shared object with `verification` set only by deterministic verifiers; (3) UTDG candidates enforce staged-only review status and `utdg:*` id regex in-schema; (4) the 11-artifact provider apparatus is now `retrieval.log[]` entries. eval-report/review-report schemas intentionally deferred to S3.5/S4.1.

## 2026-06-10 [S0.2] Repo hygiene — done
- changed: deleted local `node_modules (1)/` and `.pnpm-store/` (operator go-ahead); .gitignore additions
- gates: install + both suites re-verified green after deletion
- notes: jest.config.cjs (stale parent-repo config) deliberately left until S6.1.

## 2026-06-10 [S0.4] Rebuild root — done
- changed: packages/core/src/ (skeleton dirs, strict tsconfig, README with ground rules, hello.ts), core devDeps +tsx +@types/node
- gates: tsc --noEmit clean on src; hello stage runs via tsx; legacy suite still 134/134
- notes: src/tsconfig is strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes, independent of the lax legacy tsconfig. hello.ts is disposable — delete when S1.1 lands real schemas.

## 2026-06-10 [S0.2] Repo hygiene — blocked_on_human (run card)
- done now (non-destructive): stale /mnt/c README links fixed; verified via `git ls-files` that no generated outputs are tracked.
- RUN CARD for operator: confirm deletion of (1) `node_modules (1)/` — duplicate copy folder, (2) `.pnpm-store/` — obsolete in-repo store superseded by `store-dir=C:\pnpm-store`. Optionally (3) stale `packages/core/jest.config.cjs` now vs at S6.1. On confirmation, any agent session executes the deletions and closes S0.2.

## 2026-06-10 [S0.3] Eval fence — blocked_on_human (run card)
- RUN CARD for operator: author 6–10 held-out briefs + judgments in a folder outside the repo (suggested `..\metagrinder-holdout\`), domains not in current fixtures (technical, culinary, sports, fantasy, industrial...). No agent may read that folder (loop rule A4.1). The in-repo holdout runner gets built with S3.5; brief authoring is the long-lead item and can start now.

## 2026-06-10 [S0.1] Fix the package manager — done
- changed: .npmrc (new: external store-dir), README.md (Environment notes), AGENTS.md (canonical test command), node_modules rebuilt clean
- gates: tests 134/134 pass via `pnpm test:metagrinder` (canonical suite); tsc n/a (no src/ yet)
- notes: Root cause was the pnpm store living inside the synced folder (`.pnpm-store/` in repo root — add to S0.2 deletion list). corepack needed `%APPDATA%\npm` created before `corepack enable`. Root `packages/core/jest.config.cjs` is a stale jsdom/babel parent-repo config that cannot transform TS — the old AGENTS.md command never worked through it; psgCodec/epic1 suites have no working config of their own (they ran only via the C:\tmp audit wrapper). They are porting reference; decide in S0.2 whether to give them a ts-jest config or leave them dormant until their Phase 2 port. `C:\tmp\metagrinder-audit-deps` is obsolete.

## 2026-06-10 Loop established — n/a
- changed: docs/research/metagrinder-reimplementation-loop.md (control document), this log
- gates: n/a (no code yet)
- notes: Implementation begins at S0.1 per Bootstrap Sequence. Standing human tasks opened: held-out brief authoring (S0.3), real-provider decision (S5.8), S0.2 deletion-list confirmation.

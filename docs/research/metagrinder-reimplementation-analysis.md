# Metagrinder Reimplementation Analysis

_Created: 2026-06-09_

This document is a deep review of the current Metagrinder implementation, an analysis of how it should have been built, and a concrete plan for redeveloping it. It draws on this repo, plus the sibling repos `Image_Prep_Research` (the image/evidence experiment workspace), `ExtraExtra` (the ComfyUI/LTX generation harness), `prompt_spaghetti` (the PSG editor this repo forked from), `EraCrowd` (the downstream crowd-asset application), and `WildConstructBrain-main` (the Obsidian vault holding UTDG research, the application profile lineage, and the mini-UTDG roadshow build trail).

Companions: `metagrinder-academic-grounding-notes.md` maps the design choices in Part 4 to the supporting academic literature; `metagrinder-reimplementation-loop.md` is the executable control document (loop protocol, story breakdown, acceptance criteria) for carrying out Part 5, with progress tracked in `metagrinder-reimplementation-progress.md`.

---

## Part 1: What Metagrinder Is Supposed To Be

### The ecosystem

Metagrinder is one organ in a larger body. The cleanest statement of the system is in `Image_Prep_Research/AGENTS.md`:

```text
1. Image_Prep_Research gathers source families and builds experiment packets.
2. A packet records source refs, observations, prompt surfaces, generated references,
   sidecars, validation, and rights boundaries.
3. Metagrinder ingests the packet into source maps, claims/evidence, concept clusters,
   research gaps, sample prompts, photo observations, color hypotheses, and staged
   UTDG candidates.
4. UTDG receives only staged candidates unless human/curator review promotes them.
5. EraCrowd consumes approved packets as Reference Packs, LookBundles, and Generation Recipes.
6. ExtraExtra (or another harness) produces images, masks, sprite atlases, and QA artifacts.
```

Metagrinder's job, per its own PRD (`docs/research/deep-research-parser-prd.md`): take messy research material (text dossiers, briefs, photo observation packets) and emit **provenance-preserving, uncertainty-aware, review-gated packages** — PSG prompt graphs for Prompt Spaghetti, and staged candidate records for UTDG. The PRD's framing is explicitly correct and worth repeating:

- "Research package generator, not a prompt parser upgrade."
- "Staged transforms, not one-shot completions."
- "Provenance and uncertainty are first-class product concepts."
- Success is "research became reusable PSG assets," not "the model produced impressive-looking node soup."

### The pipeline as designed

The current pipeline (per the scene-grammar checkpoint doc) is:

```text
ingest -> extract/classify -> scene grammar -> semantic choice graph
-> gaps/query plan -> retrieval policy -> candidates -> source approval
-> evidence/claims -> citation review -> grammar revisions -> revision state
-> accepted deltas -> accepted grammar -> Prompt Spaghetti PSG compile
```

With a governance model whose invariants are genuinely well designed: live retrieval is candidate-only; candidates never create claims or revisions directly; claims require approval plus citation review; accepted grammar mutates only through accepted, citation-gated deltas; PSG compile targets are explicit (`base` vs `accepted`).

---

## Part 2: What Was Actually Built

### Inventory

- ~37,500 lines of JS/TS in `packages/core` (63 `.js`, 26 `.ts` files).
- **45 single-file "services"** under `packages/core/services/research*/`, each a CommonJS module of artifact-builder functions.
- A 2,767-line TypeScript type file (`types/metagrinder.ts`) and a **2,643-line hand-maintained Zod mirror** (`types/metagrinder.runtime.js`).
- A single 6,546-line test file (`tests/metagrinder.test.ts`, 281KB) with one top-level `describe`.
- A 53KB hand-rolled Node `http` server (`scripts/serve-metagrinder-workbench.js`) plus a 64KB vanilla-JS frontend (`workbench/app.js`), using only Node built-ins.
- ~60 artifact/collection types in one enum (`MetagrinderCollectionTypeSchema`), most emitted as separate JSON files per run.
- 18 git commits total, several of which are enormous "checkpoint" commits produced by agent loops (commit `8485396` is literally titled "Extend Metagrinder scene grammar RALPH loops").

### How the pieces actually work

**The "deterministic parser" is a fixture-replay machine.** The extraction and scene-grammar services do not parse; they pattern-match against vocabulary copied out of the test fixtures. Evidence:

- `services/researchExtract/index.js` hardcodes `CATEGORY_KEYWORDS` containing the Broadway fixture's vocabulary (`theatergoers`, `marquee`, `overcoats`), and `deriveConceptLabel()` returns **canned strings** — if a sentence contains "overcoat" the concept label is literally `'dark wool overcoats'`; "marquee" yields `'bright marquee glow'`.
- `services/researchSceneGrammar/index.js` hardcodes `ARCHETYPE_DEFINITIONS` for the historical-crowd fixture: `middle_class_spectator`, `heat_adjusted_spectator` (keyed on "shirtsleeves", "suspenders"), `affluent_spectator` (keyed on "linen suit", "panama"), with pre-written prompt text and fallback weights.
- `parseWeightRangeFromText()` special-cases the exact phrasings in the fixtures ("half to three-fifths" → 50–60%).

The checkpoint docs claim the medieval-market fixture and perturbed-wording tests "guard against fixture-shaped parsing." They guard against *one* exact phrasing; they do not change the fact that the category system, the archetype ontology, and the concept labels are compiled into the source code from two or three example documents. On any genuinely new domain the output degrades to the fallback branches.

**The project's own evaluation proved this.** `experiments/epic4-autoresearch/` is the most honest artifact in the repo: a judged eval corpus (12 briefs with expected judgments) and a comparison run. Results in `runs/semantic-baseline/comparison-report.json`:

- Heuristic baseline: **106/120**. Semantic baseline: **114/120**.
- On the one truly out-of-distribution brief (`spaghettiwestern`), the heuristic scored **4/10** (wrong mode, no expected focus labels, overconfident) versus the semantic lane's **10/10**.

The fixtures the heuristic aces are the fixtures it was tuned on. The eval was built, it delivered its verdict, and then development continued extending the heuristic core anyway.

**The actual semantic capability is bolted onto the edge.** Real understanding enters the system only through the Workbench, which `spawn()`s the OpenAI Codex CLI (`codex exec`, default model `gpt-5.2`) to do "semantic parse" and "PSG sweetening," complete with Windows shim-resolution hacks to find `codex.js` under `%APPDATA%\npm`. There is no provider abstraction, no API client, no schema-constrained tool-use call — the LLM is an external subprocess writing JSON files, while the 45 in-repo services simulate semantics with keyword tables. The architecture is inverted: the deterministic husk is in the center and the intelligence is taped to the outside.

**The type system is duplicated by hand.** Because the services are plain CommonJS, the TS types in `metagrinder.ts` can't be consumed at runtime, so a parallel Zod file is maintained by hand. Commit `8485396` adds 486 lines to `metagrinder.ts` and 491 lines to `metagrinder.runtime.js` in the same change — every schema change is made twice, with nothing but discipline preventing drift. This is the single most mechanical source of waste in the codebase.

**Tests validate the simulacrum.** 6,546 lines of Jest in one file, largely asserting that the hardcoded heuristics reproduce expected outputs on the same fixtures the heuristics were derived from. This is circular: the tests can't fail on generalization because they never present anything novel. Meanwhile the genuinely valuable properties — the governance invariants ("candidates never become claims without approval") — are tested, but they're buried in the same monolith.

**Speculative scaffolding outweighs working features.** The retrieval/provider layer comprises ~15 services and ~11 artifact types (preflight reports, request shapes, response logs, pilot reports, real-endpoint proof reports, error reports...) for a live-retrieval feature that **has never run against a real endpoint** ("Real provider reliability: Blocked... no ignored local real endpoint config is present"). Elaborate guard rails were built around a road that was never constructed. The guards are good design *ideas*, but implementing them all before one real retrieval ever happened is effort allocation exactly backwards.

**The environment shaped the architecture.** pnpm dependency materialization is broken in this synced Windows workspace, so: the Workbench uses zero dependencies (hand-rolled HTTP server, hand-rolled routing, vanilla JS UI), the audit wrapper loads deps from `C:\tmp\metagrinder-audit-deps`, README links point at a stale WSL path from a different machine (`/mnt/c/Users/Owner/CascadeProjects/...`), and the repo root contains a `node_modules (1)` junk folder and committed test outputs. A broken package manager dictated a no-framework architecture for the product's main UI surface.

**The development process produced exactly what it rewarded.** The repo was built largely through autonomous agent loops (RALPH loops) whose success signal was "tests pass, checkpoint doc written." An agent loop rewarded on green tests over fixed fixtures will *converge on hardcoding the fixtures* — that is the optimal policy for that reward. The keyword tables aren't a mystery or a failure of skill; they're the predictable output of the process. Any redevelopment plan that doesn't change the reward function (judged evals on held-out inputs, not fixture equality) will reproduce the same pathology.

### What is genuinely good and must be kept

This isn't a salvage-nothing situation. The following are strong and should survive reimplementation, mostly as-is conceptually:

1. **The governance/state model.** The candidate → approval → evidence → claim → citation review → revision → accepted-delta → accepted-grammar lifecycle, with its "What Must Never Happen" invariants, is a thoughtful, correct design for evidence-gated knowledge mutation. Almost nobody builds this; it's the moat.
2. **Provenance discipline.** Every artifact carries `sourceInputIds` / `sourceChunkIds` / excerpts / confidence / `attributionMode`. The `observed vs inferred vs generated` separation matches the (more evolved) vocabulary in Image_Prep_Research.
3. **Base vs accepted compile targets** and the diff report between them.
4. **The PSG compiler boundary.** Emitting flat Prompt Spaghetti fragment documents (nodes/edges/regions) rather than inventing another dialect was the right call, and the semantic-choice-graph as an inspectable boundary before PSG export is a good seam.
5. **The epic4 eval harness.** Corpus + expected judgments + scorer + comparison reports. This is the kernel of the correct testing strategy for the whole system.
6. **The docs.** The PRD, system map, and checkpoint discipline are unusually good. The handoff documents work — this analysis was possible because of them.
7. **The artifact-package concept.** `research-package.json` as a manifest over inspectable JSON artifacts in a run folder is simple, debuggable, and survives tooling failure.

---

## Part 3: What the Sibling Repos Teach

The most important finding outside this repo: **`Image_Prep_Research` already evolved the working method, and it looks nothing like Metagrinder's core.**

The appearance-first garment graph roadmap (2026-06-09) and its phase packets (`garment_visual_signature_phase1`, `garment_appearance_qa_phase2`, `garment_router_v0_phase3`, `material_appearance_library_phase4` — all four hit their stop conditions in days, not months) demonstrate the pattern:

1. **The unit of work is a record bundle, not an output.** Source crop + aligned product text (or explicit text-missing reason) + generated reference + sidecar + confidence fields + rights state + route id. Metagrinder's equivalent insight (claims link evidence link chunks) is right but drowned in artifact sprawl.
2. **Schema + validator + small script + fixtures per packet.** Each phase is a JSON Schema, a Python mapper/validator, and real records run through them, with a report and an explicit change list for the next schema version. Contracts evolve through *mechanical mapping of real data*, with judgment calls captured as versioned change lists (the v0.2 watchlist pattern).
3. **Hard gates vs scored dimensions.** Rights, model license, text/logo leakage, and body/identity leakage are pass/fail prerequisites that short-circuit; quality dimensions are scored only after gates pass. A black frame never receives a material-appearance score. Metagrinder's confidence model averages everything together.
4. **Two-sided QA.** Observation QA (does the structured record faithfully represent the source?) is separated from Generation QA (did the output honor the record?). This isolates whether the contract was wrong or the generator drifted. Metagrinder has no equivalent split — which is precisely how keyword extraction passed for two months: nothing ever asked "does extract.json faithfully represent a *novel* source?"
5. **Derived fields are computed, never stored.** `generativeUsabilityDerived` = gates pass AND min(sourceSupport, generatedFaithfulness); `exportEligibility` is computed at export time because cached eligibility goes stale.
6. **Review tiers with honest names.** `machine_validated` → `contact_sheet_batch_reviewed` → `approved_as_guidance`, with "fixture validation, dry runs, and generated checklists are not human review" as a standing rule.
7. **Evidence basis enums everywhere**: `observed | text_supported | external_research | proxy_analysis | inferred | generated` — strictly richer than Metagrinder's vocabulary and field-tested against real catalog scans.

`ExtraExtra` shows the downstream consumer pattern Metagrinder should emulate for review surfaces: generate an artifact pack, emit a **portable HTML viewer** (contact sheet with selection, issue tags, copyable rerender rows), review in batch, feed a TSV back into the next run, archive replaced canonical assets. No server, no framework, no database — and it's *shippable*, because the viewer is generated from the data rather than being an application that must be kept running.

`EraCrowd` confirms the handoff target: Reference Packs, Wardrobe Research Notes, LookBundles, Generation Recipes — reviewed packets in, production assets out.

The uncommitted work in this repo (`services/researchHistoricalPhoto/`, `run-historical-photo-observations.js`, the `historical-photo-observations.json` fixture) is the bridge forming between Image_Prep_Research's photo harness and Metagrinder's package format. That bridge is the right next integration — but it's being bolted onto the wrong core.

### What WildConstructBrain teaches about UTDG

`WildConstructBrain-main` holds the UTDG's full intellectual lineage (from the 2025 "Universal Tactile DB" inquiry through the Claude technical spec v1.3 fragments) and, more importantly, the **mini-UTDG roadshow lane** (2026-06-06), which made the implementation decisions Metagrinder's UTDG export must align with:

1. **JSON-first, no graph database.** Hypothesis A of the implementation research lane: plain versioned JSON with IDs, provenance, rights fields, and PSG references proves UTDG value before any Neo4j/RDF work. The unit of work is a **demo cell** (one era-region-scene), not the universal graph. The first cell exists: `utdg-mini-cell-v0.json` — `cell_1909_indianapolis_speedway`, status `provisional`, with record families, source anchors, and roadshow panel answers.
2. **The record-family vocabulary is settled.** `SourceRecord`, `EvidenceAssertion`, `Concept`, `Archetype`, `CompatibilityRule`, `DemographicMix`, `PromptSurface`, `RightsProfile` — matching this repo's `utdg-application-profile-v1.md`, which grounds them in external standards (SKOS for concepts, PROV-O for lineage, Getty AAT/Wikidata as external ID slots, selective Linked Art patterns). The profile's design rules hold: identifier-first, provenance-first, rights per record, canonical UTDG reference-oriented, PSG execution-oriented.
3. **The PSG bridge contract is settled.** PSG carries `utdgRefs[]`, `evidenceRefs[]`, `rightsProfile`, `confidence`, `lineage.packageId` — and must *not* duplicate canonical semantics. Hypothesis B's pass condition is the right acceptance test: each prompt phrase maps to UTDG refs, and changing a UTDG label or rule produces an explainable prompt delta.
4. **`evidence_seeded` won the method probe.** Of the five synthetic-data methods compared (schema-seeded, evidence-seeded expansion, constraint-first combinatorial, retrieval-augmented extraction, visual-asset backprojection), evidence-seeded is the current seed method (confirmed in Image_Prep_Research's AGENTS.md), with constraint-first demoted to a boundary stress test. This maps directly onto Metagrinder's stages: extraction produces the sourced claims; expansion proposes adjacent archetypes/rules **with gap markers instead of fabricated support**; gap markers become research tasks, never accepted records. That last rule is the correct generalized fix for the fixture-hardcoding pathology.
5. **The roadshow framing defines what Metagrinder output is *for*:** `source evidence -> staged UTDG records -> derived PSG prompt graph -> EraCrowd card -> ExtraExtra motion atlas -> explanation panel`. The explanation panel — every prompt phrase traceable to archetype, evidence chain, rights badge — is the demo-facing form of Metagrinder's provenance discipline. The era-mismatch warning (EraCrowd is 1909, Prompt Spaghetti's demo is 1960s, ExtraExtra's cards are 1950) is a real coordination task the reimplemented pipeline should surface, not paper over.

**And the build trail is a second, independent confirmation of the process diagnosis.** The roadshow lane ran **111+ agent builds in a single day**, leaving 392 files in `utdg-roadshow-probes/` — of which 136 are PowerShell validators and 110 are reports, surrounding roughly one actual data packet. By build 111, the lane had produced a preflight blocker for the readiness packet for the attestation helper for the human dry-run observation — and the human dry-run had still never happened. Every build note ends with the same honest litany: "no real observation exists... no import... no canonical mutation is authorized." This is exactly Metagrinder's provider-proof apparatus at larger scale: an agent loop that cannot execute the human step will elaborate governance scaffolding around it indefinitely, because emitting another validator is always available and always "passes." The lesson for redevelopment is structural: **when a pipeline reaches a human gate, the loop must stop and surface a single, minimal run card — not keep building.** Gate-elaboration beyond one validator per gate should itself be treated as a failure mode.

---

## Part 4: How It Should Have Been Built

### The central inversion

The current system: **deterministic heuristics in the core simulating understanding, with an LLM taped to the edge.**

The correct system: **LLM proposes, schema validates, deterministic code verifies, gates govern, humans approve.**

Concretely, every stage belongs to exactly one of three classes:

| Class | Examples | Implementation |
|---|---|---|
| **Deterministic, testable with golden fixtures** | chunking, span indexing, quote verification, weight math, gate evaluation, delta application, PSG compilation, content-plan sampling, manifest assembly | Plain typed functions. Unit tests + property tests. |
| **Semantic, testable only by judged evals** | mode detection, claim/concept extraction, archetype discovery, scene-grammar drafting, choice-axis derivation, prompt synthesis drafting, prompt realization (plan → fluent prose) | Schema-constrained LLM calls behind a provider interface. Eval corpus with held-out briefs. Realization additionally gated by deterministic faithfulness checks. |
| **Human judgment** | source approval, citation review, revision acceptance, export approval | Review UI writing operator-state artifacts. Never automated, never simulated. |

The original sin was implementing class 2 as class 1. Keyword tables can't do semantics, so they memorized the fixtures. Every semantic stage must be an LLM call whose **output is untrusted until deterministically verified**: parsed against a Zod schema, every claimed chunk ID checked for existence, every weight range checked for arithmetic sanity, and every provenance claim verified *per attribution mode* (the AIS "attributable to identified sources" test, operationalized): `quoted` requires exact substring match against the source; `paraphrased` requires NLI-style entailment from the cited chunk; `inferred` requires a recorded reasoning note and lands at lower default confidence. Failed verification rejects or downgrades the record — it never silently passes. That validation layer — not the extraction itself — is where deterministic engineering belongs, and it's cheap, general, and honest.

### Target architecture

**One TypeScript package, schemas as the single source of truth.**

```text
metagrinder/
  src/
    schemas/        Zod schemas; types via z.infer. ONE file per artifact family.
    artifacts/      run-folder store: read/write/validate/hash, run manifest
    stages/         one module per pipeline stage, declared inputs/outputs
      ingest/         deterministic: normalize, chunk, span-index (text + photo-observation modes)
      extract/        LLM: claims, concepts, entities  -> verified against source spans
      grammar/        LLM draft -> deterministic verify: archetypes, zones, rules, constraints
      choices/        semantic choice graph derivation (LLM-assisted, schema-bound)
      retrieve/       gap analysis, query plan, candidate-only retrieval + cache
      govern/         THE state machine: approval, evidence, claims, citation review,
                      revisions, deltas, accepted grammar. Pure functions over artifacts.
    compile/        PSG compiler (port from current code; it is fine)
    realize/        content plan -> fluent prose: per-model realization profiles,
                    aggregation rules, faithfulness gate (slot coverage + NLI)
    providers/      LlmProvider interface: anthropic | openai | codex-cli | replay
    eval/           epic4-style harness: corpus, judgments, scorer, comparison reports
    review/         viewer generation (portable HTML) + thin local server for state writes
  runs/             gitignored run folders: artifacts + cached LLM responses
```

Key decisions and why:

1. **Kill the dual type system.** Zod schemas are canonical; TS types are `z.infer<>`. Services are TS, executed with `tsx` (or compiled). This deletes ~2,600 lines of hand-mirrored code and the entire class of drift bugs. (Run codegen to JSON Schema for any non-TS consumer — Image_Prep_Research's Python validators can consume those directly, which also unifies the two repos' contract languages.)

2. **Collapse 45 services into ~8 stage modules.** The current services are not services — they're file-per-function namespaces coupled through artifact shapes. Group by pipeline stage. The governance lifecycle (currently ~12 services: sourceRegistry, sourceEvidence, sourceClaims, sourceClaimReview, grammarRevision, revision-state handling inside pipeline, etc.) becomes **one state-machine module** with explicit, enumerated transitions and one operator-state artifact, because its invariants are a single connected design and should live in a single reviewable file.

3. **Collapse ~60 artifact types to ~15.** Keep: `source-package`, `extraction`, `scene-grammar` (base), `semantic-choice-graph`, `research-gaps` + `query-plan` (merged, persisted as a cross-run gap registry), `research-campaign`, `retrieval-policy`, `retrieval-candidates` (+ cache manifest), `source-lifecycle` (registry+evidence+claims+review merged, since they're one chain), `revisions` (+ state + deltas), `accepted-scene-grammar`, `psg/*.psg`, `psg-compile-diff`, `content-plans` + `realized-prompts` (replacing `sample-prompts`; plans are canonical, prose is derived), `review-report`, `run-manifest`, `eval-report`. The eleven provider-proof artifact types collapse to one `retrieval-log` with a `mode` field. An artifact earns separate existence only when a different human or system reads it at a different time.

4. **Provider abstraction with replay.** `LlmProvider` = `{ complete(request: SchemaBoundRequest): Promise<ValidatedResponse> }`. Implementations: Anthropic API, OpenAI API, codex-cli subprocess (preserving current behavior), and **replay** (reads cached responses from the run folder). Every live LLM response is written into the run folder; reruns default to replay. This restores the determinism the heuristics were falsely providing: *a run is reproducible because its model outputs are artifacts*, not because the code contains no model. This also satisfies the PRD's offline-fallback NFR honestly. Adopt the DSPy invariant on top: every semantic stage has a **typed signature and a declared metric**, and its prompt text is a versioned, re-derivable artifact tuned against the eval harness — never a hand-sacred string. This is what makes model swaps (codex-cli → API → local) a recompile rather than a rewrite.

5. **Two-sided QA, stolen from the garment work.** Observation QA: deterministic verifiers + judged eval that `extraction.json` faithfully represents a held-out source. Generation QA: validators that PSG output honors the accepted grammar (sampler/evaluator already partially do this — keep them). Gate-ladder semantics: schema-valid → provenance-verified → gates → scored quality → human acceptance, short-circuiting on failure.

6. **Tests restructured around the three classes.** Golden-fixture unit tests for deterministic stages (split the 6,546-line monolith along stage boundaries). Property tests for governance invariants (e.g., *for all* candidate sets and approval files, unapproved candidates never appear in claims — currently asserted only by example). The epic4 eval harness, promoted from experiment to CI gate for semantic stages, with **held-out briefs that are never committed alongside the prompts that process them**, scored by judgment rubric rather than equality. Perturbation fixtures stay. The harness additionally gains three instruments from the literature:
   - **Expressive range analysis** for the PSG generative space: sample each compiled graph heavily (~1k draws), score along interpretable metrics (archetype mix vs `DemographicMix` targets, constraint-violation rate, era-marker density, lexical diversity), and plot the distribution — finding what a grammar over-produces, under-produces, and cannot produce. **Generative shift analysis** between base and accepted compile targets: an accepted grammar delta must produce a *predicted, explainable* shift in the sampled distribution, which is a far stronger revision-acceptance test than inspecting delta JSON and directly operationalizes the roadshow's "explainable prompt delta" condition.
   - **Judge stress-tests as a meta-gate**: any judge-dependent metric is trusted only after the judge catches injected known-bad and known-good outputs; analytic (criterion-by-criterion) rubrics, reference-anchored grading, and position randomization for pairwise comparisons; a small human-rated calibration set tracks judge–human agreement per release.
   - **Covering-array sampling for review**: QA samples are drawn so every pair of choice-axis values (archetype × garment, era × material, zone × behavior) appears at least once, making contact-sheet review of prompt families tractable instead of hoping random sampling covers the interactions.

7. **Review surface: generated viewer first, server second.** Follow ExtraExtra: every run emits a self-contained `review.html` over the run's artifacts (read-only, portable, survives any environment). The interactive Workbench (approve/reject/rerun) becomes a thin server whose only writes are the operator-state files — same write boundary as today, dramatically less code, built with a normal toolchain once the environment is fixed. The current 53KB hand-rolled server exists because of a broken pnpm install; fix the environment, don't enshrine the workaround.

8. **Plan-then-realize for prompt output.** PSG sampling emits a structured **content plan** (slots + values + provenance refs + seed) as the canonical, deterministic artifact; a separate realization stage renders it to prose. This is the classic NLG pipeline's microplanning/surface-realization split, and it's the missing stage behind "randomized prompts read like slot soup" — concatenation is not realization. Realization runs per-model profiles from one plan (fluent caption prose for Flux/Wan/Qwen-class LLM-encoder models, keyword stacks for legacy CLIP-era models, tag streams where needed), because on the current generation stack natural reading is *generation quality*, not just operator ergonomics. LLM-based realization is allowed but faithfulness-gated: every plan slot must surface, nothing unsupported may appear (slot-coverage + NLI check), because the data-to-text literature's core finding is that neural fluency reliably injects unsupported content. `utdgRefs[]` attach to plan slots and are inherited by realized text; mutation and rotation operate on plans, never on prose. Hard compatibility/anachronism rules are enforced at sampling time (filter/resample), not at realization time.

9. **Photo observations as a first-class second input mode.** The uncommitted `researchHistoricalPhoto` direction is right: `ingest` accepts either text briefs or observation packets conforming to the Image_Prep_Research schema, and downstream stages are input-mode-agnostic. Adopt the sibling vocabulary wholesale: evidence basis (`observed | text_supported | external_research | proxy_analysis | inferred | generated`), hard gates vs scored confidence, review tiers, computed-at-export eligibility. These contracts are field-tested; Metagrinder's are not.

10. **The supplementary research loop: gaps become campaigns, campaigns close gaps with lineage.** Gap identification exists today (`research-gaps`, `query-plan`) but dead-ends at the retrieval boundary; nothing turns a gap into completed research. The reimplemented loop, which is the mini-UTDG lane's `retrieval_augmented_extraction` method (Method 4) finally given a shape:

    1. **Gap registry (persistent).** Gaps stop being per-run artifacts and become a cross-run registry keyed to the cell: low/no-evidence grammar fields, `unknown` signature slots, low-confidence weight ranges, missing material records. Each gap carries what evidence would close it. This is the durable "memory of the holes."
    2. **Campaign planning (LLM proposes, schema-bound).** Gaps cluster into a `research-campaign` artifact: target cell, prioritized gaps, and **source hypotheses** spanning a typed source-family vocabulary, each hypothesis carrying rationale, expected evidence type, and `status: hypothesized`. Hypotheses are proposals, never sources. The families, with their distinct strengths for a cell like 1909 Indianapolis:
       - **Commercial print** — the clothier ladder: period vendors, retailers, mail-order houses, trade publications (Sears Roebuck and Montgomery Ward catalogs, Hart Schaffner & Marx, Arrow, Stetson). Yields garment construction, product text, named materials, pricing/class signals.
       - **Photography collections** — LOC Prints & Photographs (the Bain News Service shot the 1909 Indianapolis races, largely "no known restrictions"), state historical societies, museum photo archives. Yields what people *actually wore at the event* — worn combinations, crowd demographics, zone behavior — the ground truth that catalogs (aspirational, posed) cannot provide.
       - **Newspapers** — Chronicling America and state archives: full-text-searchable, public-domain era papers. Double yield: department-store and clothier *advertising* (localizes the brand ladder to the actual city) and *event accounts* (weather that day, crowd size and composition, social texture) that constrain scene grammar directly.
       - **Institutional collections** — museum garment/object records, already the UTDG application profile's Layer 1 (Getty AAT, Europeana, institutional IDs). Yields material truth and authority normalization targets.
       In general: anything minable for evidence is hypothesizable — the family taxonomy is open, but every family must declare its evidence type and its extraction route before discovery runs.
    3. **Source discovery (agent-executed, candidate-only).** Bounded targeted searches against known archives (Internet Archive, HathiTrust, Library of Congress catalog + Chronicling America APIs, museum digital collections) to locate digitized instances of hypothesized sources. Output is retrieval candidates with rights metadata — publication date drives the rights ladder (pre-1930 US publications are public domain; LOC "no known restrictions" statements recorded verbatim; later material defaults `reference-only`). Search and metadata only; no scraping or content extraction before approval. The existing candidate-only boundary applies unchanged, and per the "Cited but Not Verified" finding, every agent-located source is verified to actually exist and match its hypothesis before it can be approved. Each approved source routes by family: photographs → the photo-observation intake (the path the Indy 500 fixtures already walk); newspaper text and ads → text intake with claim extraction; catalog pages → the Image_Prep crop/signature path. The cross-corroboration is the payoff: a catalog shows the garment, a photograph shows it worn at the event, a newspaper ad proves it was sold in that city that season — three evidence bases converging on one claim is exactly what the corroboration/contradiction reporting was built for.
    4. **Intake approval (human gate).** Operator approves located sources → `SourceRecord`s; acquired scans land in Image_Prep_Research as a new source family under its existing packet conventions (manifest, sidecars, rights boundary).
    5. **Extraction through the existing path.** Image_Prep harness → crops + product text + garment visual signatures → router → Metagrinder photo-observation intake → evidence → claims → citation review → staged UTDG candidates. Nothing new to build here; this is the manual path the catalog packets already walk, now fed by campaign output.
    6. **Gap closure accounting.** Each new claim records which gap(s) it closes; the campaign artifact tracks coverage; ERA re-runs show evidence-basis coverage improving across the grammar; remaining gaps re-prioritize the next campaign. Lineage runs gap → hypothesis → source → evidence → claim → closed gap.

    Campaigns are **time-bounded engagements, not a standing crawler** — exactly right for roadshow prep: one campaign against the 1909 Speedway cell's gap list, run to a coverage target, then stopped. The agent-loop halt rule applies: a campaign that stops locating new approvable sources surfaces its remaining gaps as human research tasks instead of elaborating.

### What this architecture refuses to build (and why)

- **No in-house semantic heuristics.** Keyword fallbacks may exist only as explicitly-labeled degraded mode (`analysisMode: 'degraded-keyword'`) that the review surface displays as a warning, never silently.
- **No retrieval scaffolding beyond the next real milestone.** The candidate-only boundary and policy gates stay (they're the safety design); the eleven-artifact provider-proof apparatus does not return until one real provider query has actually run. Build the proof, then the reliability tooling.
- **No UTDG canonical service.** Staged candidate export only, exactly as today — but shaped to the settled contracts: candidates use the application-profile entity shapes (`utdg:concept:*`, `utdg:archetype:*`, `utdg:evidence:*`, `utdg:rule:*` with `externalIds`, `rightsProfile`, `reviewStatus`), and emitted PSG carries `utdgRefs[]`/`evidenceRefs[]`/`lineage.packageId` rather than copied semantics. The mini-UTDG roadshow already proved JSON-first is sufficient; Metagrinder should target `utdg-mini-cell`-compatible packets, not a database.
- **No gate elaboration past the human boundary.** Each human gate gets exactly one state file, one validator, and one generated run card. The mini-UTDG build trail (111 builds of preflight-blockers-for-attestation-helpers while the actual human dry-run never ran) is the cautionary tale: when the pipeline reaches a human step, the system stops and asks, it does not scaffold.
- **Prompt browser / mutation lab deferred.** The PRD's Phase 2/3 surfaces remain out of scope until the extraction core is trustworthy on novel input — the current mutation services are operating on extraction output that's fiction outside the fixtures.

---

## Part 5: Redevelopment Plan

Recommended posture: **rebuild the core in place, port the periphery.** A full greenfield restart loses the governance semantics and PSG compiler that work; continuing to extend the current core entrenches the simulacrum. The repo keeps its history; `packages/core` gains a `src/` that becomes canonical, and the legacy tree is deleted at the end rather than migrated file-by-file.

### Phase 0 — Environment and hygiene (small, do first)

- Fix the pnpm/workspace problem for real (likely: stop working inside the synced/OneDrive-style folder, or pin a store-dir outside it). Everything downstream is hostage to this.
- Delete `node_modules (1)`, committed `tests/output/`, stale `/mnt/c/Users/Owner/...` links in README; add gitignore coverage.
- Decide the held-out eval brief set now (write 6–10 new briefs across domains: technical, culinary, sports, fantasy, industrial — domains absent from current fixtures) and keep their judgments in a maintainer-only location or clearly fenced folder. This is the new reward function and must exist before any agent loop touches the semantic stages.

### Phase 1 — Schema core (1 focused pass)

- Port `metagrinder.runtime.js` Zod schemas into `src/schemas/`, collapsing artifact families per Part 4. Types become `z.infer`. Delete `metagrinder.ts` as a separate artifact.
- Add the unified evidence-basis / gate / review-tier vocabulary from Image_Prep_Research.
- Emit JSON Schema for cross-repo consumers.
- Port `research-package.json` manifest + run-folder store with content hashing.
- Define the stable-ID policy now (hole 1): chunk and evidence IDs derived from content hashes, not sequence position, so identical material gets identical IDs across runs and reconciliation is possible later. This decision cannot be retrofitted cheaply.

### Phase 2 — Deterministic spine

- Port ingest/chunking (it's genuinely deterministic and fine), adding byte-span indexing so provenance can be verified by string matching.
- Port the PSG compiler, sampler, plausibility evaluator, and compile-diff mostly as-is.
- Implement the governance state machine as one module; port the invariants from the current services and the "What Must Never Happen" list as property tests. This is the highest-value porting work in the project.

### Phase 3 — Semantic stages on the provider interface

- Implement `LlmProvider` with anthropic/openai/codex-cli/replay backends; cached responses as run artifacts.
- Reimplement extract/classify/grammar-draft/choice-graph as schema-bound LLM calls + deterministic verifiers (per-mode attribution verification, ID existence, arithmetic sanity, enum discipline).
- Implement the realization stage: content-plan sampling (deterministic), then per-model realization profiles with the slot-coverage + NLI faithfulness gate.
- Promote the epic4 harness to `src/eval/`; CI runs replay-mode evals on the committed corpus; scheduled/manual runs hit live providers on the held-out set. Add the ERA/generative-shift tooling and the judge stress-test meta-gate here, before any judge-scored metric is trusted.
- Acceptance bar: semantic stages must beat the legacy heuristic baseline on the held-out briefs (the legacy code already lost on the committed ones, 106 vs 114).

### Phase 4 — Review surfaces

- Per-run generated `review.html` (read-only contact-sheet-style review, ExtraExtra pattern), with the review sample drawn by covering array over choice axes rather than pure random draws.
- Grammar-revision review shows the generative shift: side-by-side expressive-range plots for base vs accepted, so the operator approves a *visible distribution change*, not a JSON delta.
- Rebuild the Workbench thin: normal toolchain, same write boundary (operator-state files only), driving the new pipeline. Port the Codex-reuse behavior (existing parse results are reused by default; rerun is an explicit, costed action).

### Phase 5 — Ecosystem bridges

- Land the historical-photo observation intake against the new core (the uncommitted work, re-targeted).
- Emit an EraCrowd Reference Pack handoff artifact and a staged `utdg-candidates.json` from the same run, using the application-profile entity shapes and the `utdgRefs[]` PSG bridge fields. Acceptance test = Hypothesis B's pass condition: every prompt phrase traces to a UTDG ref, and a UTDG label/rule change produces an explainable prompt delta.
- Validate the export against the existing `utdg-mini-cell-v0.json` (1909 Indianapolis Speedway cell) — Metagrinder regenerating that cell's record families from its source anchors is the natural end-to-end proof, and it directly serves the roadshow demo path (`evidence -> staged UTDG -> PSG -> EraCrowd -> ExtraExtra -> explanation panel`).
- One real retrieval provider, one query, candidate-only, cache-replayed through approval and citation review — the milestone the current scaffolding was waiting for, built only now.
- **Roadshow research campaign**: run the first supplementary research campaign (decision 10) against the 1909 Speedway cell's gap registry — clothier/catalog, LOC photography (Bain News Service), and Chronicling America newspaper source hypotheses; archive discovery; operator-approved intake into Image_Prep_Research source families; extraction through to staged UTDG candidates with cross-family corroboration; gap-closure accounting as the campaign report. This doubles as the end-to-end proof that the gap → campaign → evidence → grammar loop works, and it produces the roadshow cell's missing evidence at the same time.

### Phase 6 — Delete the legacy tree

- Remove the 45 legacy services, the runtime mirror, the monolithic test file, and the speculative provider artifact code. Keep the fixtures (they become eval corpus members and golden inputs), keep the docs, write the closing checkpoint.

### Keep / Port / Discard summary

| Disposition | Items |
|---|---|
| **Keep as-is** | Governance invariants and lifecycle design; PSG flat-fragment output contract; semantic-choice-graph boundary; base/accepted targets; run-folder + manifest model; docs and checkpoint discipline; fixtures (as eval corpus); epic4 harness concept; candidate-only retrieval boundary; Workbench write boundary; Codex parse-reuse policy |
| **Port with rework** | Zod schemas (collapse, single-source); ingest/chunking (+ span index); PSG compiler/sampler/evaluator; governance services → one state machine; codex-cli invocation → one provider behind an interface; historical-photo intake |
| **Discard** | All keyword/canned-label extraction and archetype tables; hand-maintained `metagrinder.runtime.js`; 6,546-line test monolith (restructure); 11-artifact provider-proof apparatus; hand-rolled HTTP server; `C:\tmp` dependency workaround; mutation-lab services (until core is trustworthy) |

### Orchestration holes from the final-pass review

A full end-to-end trace of the loop (ingest → extraction → grammar → gaps → campaigns → discovery → intake → evidence → claims → revisions → accepted grammar → plans → realization → generation → QA → UTDG staging) surfaced eight holes. The pattern: every *stage* now has a design, but several of the *joints between stages* do not. Each hole below names its treatment and home phase.

1. **Identity, deduplication, and reconciliation across runs.** Re-running extraction on overlapping material produces new IDs for the same concepts, archetypes, and claims; nothing merges them into the cell. The old system map assigned "deduplicate, compare against existing UTDG" to a curator agent that was never designed. Treatment: content-derived stable IDs for chunks and evidence (hash-based, not sequence-based); a reconciliation step before UTDG staging that proposes `same-as | variantOf | distinct` links for human confirmation — LLM-proposed, embedding-assisted, never auto-merged. Without this, every campaign *bloats* the cell instead of *enriching* it. (Phase 1 for the ID policy — it cannot be retrofitted; Phase 5 for the reconciliation step.)

2. **Change propagation: supersession and retraction.** The governance chain only moves forward. Two backward cases are undesigned: new evidence *contradicting an already-accepted delta* (treatment: supersession is just another citation-gated revision targeting the same field — cheap, fits the existing machinery), and **source retraction** — a source later found misattributed, rights-reversed, or wrong. Retraction must cascade: source → evidence → claims → deltas → accepted grammar → compiled PSG → exported packs, flagging (not silently rewriting) everything downstream. The garment work's rule that export eligibility is *computed at export time, never cached* is the right mechanism generalized: downstream validity is always recomputed from current upstream status. (Phase 2 — this is a governance state-machine property, with a property test: no accepted artifact may depend on a retracted source without a visible flag.)

3. **Run lifecycle and resumability.** The current pipeline is a synchronous script; the designed loop is long-running with human gates in the middle — a campaign spans days and pauses twice for approval. Needs: a per-stage state machine in the run manifest (`pending | running | blocked_on_gate | failed | complete`), resume-from-partial-failure, and a **budget ledger** per run and per campaign (LLM spend, search calls, judge calls) with caps that halt rather than degrade silently. The Workbench's "rerun Codex costs money, so reuse by default" instinct, generalized. (Phase 2 manifest; Phase 3 ledger.)

4. **Review-queue economics.** The design deliberately makes humans the bottleneck, then does nothing to manage the bottleneck. Treatment: review queues ordered by expected impact (gap priority × predicted distribution shift × claim uncertainty), so the operator's first ten decisions matter most; batch ergonomics for low-stakes tiers (already designed via contact sheets); and **reviewer provenance** — id/role, date, decision rationale on every gate file, which Image_Prep_Research's roadmap already flagged as missing. One unprioritized queue after the first real campaign will teach the operator to rubber-stamp, which silently destroys the value of every gate. (Phase 4.)

5. **Generation-QA feedback channel.** The loop currently ends at generation QA; failures go nowhere. Treatment: QA failures become *typed* upstream signals — realization-profile defect (prompt didn't say it), grammar defect (grammar permitted it), signature defect (contract was wrong) — routed respectively to the realization profile backlog, the gap registry, or a revision proposal. The two-sided QA split already provides the diagnosis; this hole is just the routing. Hard rule preserved: generated output is never evidence; QA *outcomes* are legitimate signals about prompts and contracts. (Phase 5.)

6. **Negative-result memory.** The campaign design remembers holes but not *failed attempts to fill them*. Exhausted hypotheses ("searched Chronicling America for Indianapolis clothier ads May–June 1909 on date X; nothing usable") must persist in the campaign record with a checked-when timestamp, so future campaigns don't re-propose them — with a shelf life, since archives keep digitizing. (Phase 5, one field family on the campaign schema.)

7. **Cross-repo handoff receipts.** Every repo boundary (Metagrinder → Image_Prep packet, → EraCrowd pack, → ExtraExtra atlas, → UTDG staging) is currently a file drop with no acknowledgment. Lineage therefore breaks at exactly the boundaries the roadshow panel needs to cross, and "staged in EraCrowd" is an unverifiable claim — the mini-UTDG lane's own rule ("do not claim it has run unless an artifact proves it") applied to handoffs. Treatment: the consumer writes an **import receipt** (package ID, content hash, status, date) back into the producing run's folder; lineage queries traverse receipts. (Phase 5, alongside the bridges it instruments.)

8. **Model re-baselining triggers.** Realization profiles, QA baselines, and ERA distributions are all model-version-coupled, and the generation stack churns (ExtraExtra has already moved across LTX/Wan versions). The garment signature records model provenance per output, but nothing *triggers* revalidation on a swap. Treatment: a model registry in the run manifest pins provider/model/version per stage; any change marks dependent profiles and baselines `stale` until their validation reruns. (Phase 3, where providers land.)

### Risks and open questions

1. **LLM nondeterminism vs. the determinism promise.** Mitigated by replay-as-default and model outputs stored as reviewable artifacts — determinism of *runs*, not of *models*. This should be stated explicitly in the README to replace the "deterministic parser" claim, which the current implementation only honored by memorizing its inputs.
2. **Eval corpus maintenance cost.** Judged evals rot. Assign every semantic-stage change a rule: corpus or judgments change in the same PR, or the change doesn't merge.
3. **Agent-loop development.** If RALPH-style loops continue building this, their success criterion must be eval scores on briefs the loop cannot read, plus property-test invariants — never fixture equality. Otherwise Part 2 happens again. And loops must hard-stop at human gates: the mini-UTDG trail shows the alternative is hundreds of validators orbiting an action that never occurs. Budget rule of thumb: if a loop's last N builds changed only validators, reports, or checkpoint notes — not data, extraction quality, or a consumed artifact — the loop is in gate-elaboration mode and must halt.
4. **Cost control.** Per-run LLM spend is bounded by stage count and replay; the Workbench already treats Codex parses as costed actions — generalize that to all providers.
5. **Open question:** should the collapsed contracts live in a shared `contracts/` repo consumed by Metagrinder (TS), Image_Prep_Research (Python via JSON Schema), and the WildConstructBrain roadshow probes (PowerShell validators)? Three repos now hold overlapping copies of the same vocabulary — evidence basis, rights profiles, review states, UTDG entity shapes — and the application profile in this repo's docs is the closest thing to a canonical statement. One source of truth would prevent a three-way drift problem; the UTDG application profile v1 plus the garment visual signature are the natural seed contracts.

---

## Closing assessment

Metagrinder's designers wrote down the right product (the PRD), the right safety model (the governance invariants), and even built the instrument that detected the core flaw (the epic4 eval). The failure was letting a process that optimizes for green tests implement semantic understanding as keyword tables tuned to its own fixtures — and then armoring that core with thousands of lines of types, tests, and speculative scaffolding that made it look load-bearing. Meanwhile, the sibling workspace quietly developed the correct method at small scale: schema-bound records, hard gates, two-sided QA, judged review tiers, and portable review surfaces.

The reimplementation is therefore not a rescue. It is a reunification: Metagrinder's governance spine and PSG compiler, Image_Prep_Research's contract discipline and gate semantics, the UTDG application profile's record shapes and PSG bridge contract, ExtraExtra's review ergonomics, and an honestly-placed LLM in the middle — proposed, verified, gated, and approved, in that order. The 1909 Speedway mini-cell is sitting in the brain vault as the ready-made end-to-end target: when the rebuilt Metagrinder can regenerate that cell from source anchors and the roadshow panel can explain every record, the system is what its own PRD said it should be.

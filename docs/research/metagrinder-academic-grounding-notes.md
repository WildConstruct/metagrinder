# Academic Grounding Notes for the Metagrinder Reimplementation

_Created: 2026-06-10. Companion to `metagrinder-reimplementation-analysis.md`._

This note maps established academic work onto the three problems the user raised: (1) generating metaball packages (research → structured records → PSG graphs), (2) making randomized prompt output read naturally, and (3) the text-processing distinctions (observed vs inferred vs promptable), plus (4) the evaluation harness. None of these problems are novel in isolation; each has a literature with reusable results. The novelty of Metagrinder is the *combination* under provenance/rights governance.

---

## 1. Package generation: research → structured records → graphs

### Attributed / evidence-based generation (the claims-and-evidence stage)

The claim-extraction-with-provenance problem is now its own subfield:

- **AIS — "Attributable to Identified Sources"** (Rashkin et al., [Measuring Attribution in NLG Models](https://direct.mit.edu/coli/article/49/4/777/116438/Measuring-Attribution-in-Natural-Language), Computational Linguistics 2023). The formal test: a statement is attributable if a reader would agree "according to the source, X." This is exactly the contract our extraction stage needs, and it is *checkable* — the deterministic quote-verification layer in the reimplementation plan is an operationalization of AIS.
- **[Attribution, Citation, and Quotation: A Survey of Evidence-based Text Generation with LLMs](https://arxiv.org/html/2508.15396v1)** (2025) — consolidates generation-time citation vs post-hoc attribution (RARR-style revise-and-attribute). Post-hoc attribution maps to our verify-after-propose architecture.
- **Atomic claim decomposition** (FActScore lineage; [ClaimVer](https://arxiv.org/pdf/2403.09724) for KG-linked claim-level verification; [Attributed QA](https://github.com/google-research-datasets/Attributed-QA) for human-rated attribution data). Decomposing source text into minimal verifiable propositions before classification is the principled version of what `researchExtract` faked with sentence splitting — and the granularity question (sentence vs atomic claim) should be an explicit harness experiment.
- **[Cited but Not Verified](https://arxiv.org/html/2605.06635v1)** (2026) — evaluates source attribution in deep-research agents; directly relevant since deep-research dumps are a primary Metagrinder input. Its parsing/evaluation method is reusable for scoring incoming briefs' *own* citations (our `seed_unverified` problem).

### Structured extraction (the schema discipline)

- **[LLMs for Generative Information Extraction: A Survey](https://arxiv.org/pdf/2312.17617)** — the modern frame for entity/relation/event extraction as schema-constrained generation, replacing per-domain keyword pipelines (i.e., the academic verdict on the approach the current heuristic services took).
- **Grammar-constrained decoding**: PICARD → [XGrammar](https://mbrenndoerfer.com/writing/constrained-decoding-structured-llm-output)-class engines; **JSONSchemaBench** shows models still violate real-world schemas without enforcement, supporting our "Zod-validate everything, reject on failure" layer. Where we control inference (local models, Codex CLI flags, API structured outputs), turn schema enforcement on; where we don't, validate post-hoc.
- **Microsoft GraphRAG** (already anchored in the WildConstructBrain research lane) — LLM-built entity/community graphs over corpora. Right pattern for the *concept-cluster* family; too heavy as a first dependency, as the brain notes already concluded.
- **Ontology reuse**: the UTDG application profile's SKOS/PROV-O/Getty AAT grounding is the cultural-heritage-informatics consensus (Linked Art); no change recommended — this is the part of the design that is already standards-aligned.

### Pipeline programming (the shape of the orchestration)

- **[DSPy](https://arxiv.org/abs/2310.03714)** (Khattab et al., NeurIPS 2023): LM pipelines as declarative modules with typed signatures, *compiled* against a metric — prompts/few-shots are optimized artifacts, not hand-tuned strings. This is the academically validated version of the reimplementation plan's "stage modules + eval harness as reward function." Even if we don't adopt DSPy the library, adopt its invariant: **every semantic stage has a typed signature and a metric; prompt text is derived and re-derivable, never hand-sacred.** This also future-proofs model swaps (Codex → Claude → local).

---

## 2. Natural reading from randomized prompts (PSG → prose)

### The classic NLG pipeline names our missing stage

Reiter & Dale's reference architecture (content determination → document structuring → **microplanning** (aggregation, lexicalization, referring expressions) → **surface realization**) is the 30-year-old answer to why concatenated slot output reads like soup. PSG today does content determination (weighted choice) and crude linearization (concat) with **no microplanner and no realizer**. The fix is architectural, not prompt-tweaking:

1. PSG sampling emits a **content plan** (structured slots + values + provenance + seed), which stays the canonical, deterministic, testable artifact.
2. A **realization stage** renders the plan to fluent text. Three implementation tiers, in increasing fluency and decreasing verifiability:
   - template realization with aggregation rules (same-subject clause merging, determiner/number agreement, ordering by salience) — SimpleNLG-class;
   - grammar-based realizer;
   - **constrained LLM paraphrase of the plan, checked for faithfulness** (every plan slot must surface; nothing unsupported may appear — an NLI or slot-coverage check, see §4).

This is exactly the **data-to-text** problem, and that field's findings transfer directly:

- Surveys: [Innovations in Neural Data-to-text Generation](https://arxiv.org/abs/2207.12571), [Neural Methods for Data-to-text Generation (ACM TIST 2024)](https://dl.acm.org/doi/10.1145/3660639).
- **Faithfulness is the known failure mode** of neural realization: [factual inconsistency in D2T scales with LLM size](https://arxiv.org/pdf/2502.12372) (2025) and [an extensive evaluation of factual consistency in LLM D2T](https://arxiv.org/pdf/2411.19203) — i.e., "make it read nicely" via LLM *will* introduce unsupported content unless checked. The two-layer plan/realize split plus a faithfulness gate is the field's standard mitigation (cf. Kasner & Dušek's neural-pipeline work; NLI-based semantic accuracy checking: [arXiv 2011.10819](https://arxiv.org/pdf/2011.10819)).
- The **plan-then-realize** split also preserves the PSG bridge contract: `utdgRefs[]` attach to plan slots; the realized sentence inherits them. Mutation/rotation operate on plans, never on prose.

### Text-to-image prompts specifically

- **[A Taxonomy of Prompt Modifiers for Text-to-Image Generation](https://arxiv.org/abs/2204.13988)** (Oppenlaender, BIT 2023) — six modifier classes (subject, style, quality, repetition, magic terms, solidifiers). Useful as a *register* model: a PSG content plan can carry a typed modifier layer rather than mixing subject content and style modifiers in one bag — which is also how the garment `GarmentVisualSignature` separates `visualIdentity` from `generationControls`.
- Liu & Chilton's CHI 2022 design-guideline work and the community evidence ([PromptMagician](https://arxiv.org/pdf/2307.09036) etc.) found **keyword presence matters more than phrasing for CLIP-era models** — but this has inverted: current targets (Flux, Qwen-Image, Wan 2.2 — i.e., what ExtraExtra/Image_Prep actually run) use T5/LLM text encoders trained on dense natural captions, and reward fluent, spatially explicit prose. So "natural reading" is not just operator ergonomics; it is generation quality on the current model stack. Implication: **realization profiles per model family** (caption-style prose for Flux/Wan; keyword-stacked for legacy SD; tag streams for Danbooru-style models) from the same content plan. The profile belongs in the run manifest.
- Practical corollary from the taxonomy literature: keep *negative constraints* (our negative/ethical constraint records) as structured plan fields, since their surface form is model-specific (negative prompt channel vs in-prompt phrasing).

### Grammar-based text generation from the PCG community

- **Tracery** (Compton) is PSG's nearest academic relative — CFGs with slots and modifiers, plus a documented register of its weaknesses (agreement, long-range coherence) that PSG inherits. The PCG literature's response was not better grammars but **better evaluation of the generative space** (see §4) and constraint solving (ASP — Smith & Mateas) for hard compatibility rules. Our `CompatibilityRule`/anachronism gates are exactly the "hard constraints" case: enforce them at sampling time (filter/resample), not at realization time.

---

## 3. The text-processing distinctions (observed / inferred / promptable / uncertain)

- **Hedge and speculation detection is a solved-ish, benchmarked task**: BioScope corpus, CoNLL-2010 shared task on hedge cue detection. The current `UNCERTAINTY_MARKERS = ['often','usually','may',...]` list is a 10-word reinvention of that literature; an LLM stage with span-level cue+scope output (validated against the source text) is the modern version, and the old benchmarks are free training/eval material.
- **Evidentiality/attribution typing** (said vs inferred vs reported) comes from discourse literature and is operationalized by the AIS framework (§1): `attributionMode: quoted | paraphrased | inferred` should be *verified*, not trusted — quoted requires exact-substring; paraphrased requires NLI entailment from the cited chunk; inferred requires a recorded reasoning note and lands at lower default confidence.
- **Argument mining** (claim/premise detection and linking) is the field that corresponds to claims-and-evidence graph construction; its lesson after a decade: claim detection is context- and domain-sensitive and does not transfer via lexical rules — the precise failure mode the heuristic services exhibited.
- The garment work's **evidence-basis enum** (`observed | text_supported | external_research | proxy_analysis | inferred | generated`) is a strictly finer instrument than anything standard in the NLP literature (which mostly stops at attributable/not). Keep ours; use the academic machinery (AIS checks, NLI, hedge scope) as the *verifiers* that justify each basis label.

---

## 4. The evaluation harness (watch this closely)

The harness is where the reimplementation succeeds or re-fails, and four literatures supply its parts:

### a. Faithfulness metrics for extraction and realization

- **Slot-coverage + PARENT-style precision/recall** against the content plan for realized prompts (did every sampled slot surface; did anything unsupported appear).
- **NLI-based semantic accuracy** ([arXiv 2011.10819](https://arxiv.org/pdf/2011.10819)) as the automated check for `paraphrased` attribution and for LLM realization output.
- Exact-substring checks for `quoted` — no model needed.

### b. LLM-as-judge, used with its known failure modes priced in

- The [LLM-as-a-Judge survey](https://arxiv.org/html/2411.15594v6) (Gu et al.) and the bias literature (position, verbosity, bandwagon; >50% failure on adversarial bias tests for frontier judges — [Adaline summary](https://www.adaline.ai/blog/llm-as-a-judge-reliability-bias)) say: judges are usable but must be *engineered*.
- Concrete harness rules from the literature:
  - **Analytic rubrics, not holistic scores** — criterion-by-criterion (the epic4 judgments and the garment QA rubric already do this; keep it).
  - **Reference-anchored grading** where possible (compare against expected-judgment files, not free-floating quality).
  - **Position randomization** for any pairwise comparison; never single-pass A/B.
  - **Periodic judge stress-tests** (the [Judge Reliability Harness](https://arxiv.org/pdf/2603.05399) pattern, 2026): inject known-bad and known-good outputs and verify the judge catches them, before trusting a judge run. This is the meta-gate the harness needs so the harness itself doesn't rot.
  - Keep a small human-rated calibration set; track judge–human agreement per release.

### c. Expressive range analysis for the PSG generative space

This is the PCG community's gift to this project and the most directly novel borrow:

- **ERA** (Smith & Whitehead, [Analyzing the expressive range of a level generator](https://www.semanticscholar.org/paper/09f8fe6a89b5f5a480ab059f60a251052a31e2ed)): sample the generator heavily, score each output along interpretable metrics, plot the distribution; find what the grammar over-produces, under-produces, and *cannot* produce. For PSG: sample N=1k prompts per graph; metrics = archetype mix vs `DemographicMix` targets, constraint-violation rate, era-marker density, modifier balance, lexical diversity, realized-length distribution.
- **Generative shift analysis** ([Compressing and Comparing Generative Spaces](https://arxiv.org/pdf/2205.15133)): measure how the output *distribution* moves when the generator changes. This maps one-to-one onto our **base vs accepted grammar** compile targets — an accepted grammar delta should produce a *predicted, explainable* shift in the sampled distribution, and the harness should display it. That is a far stronger acceptance test for grammar revisions than inspecting the delta JSON, and it operationalizes the roadshow's "explainable prompt delta" pass condition (Hypothesis B).
- **Constrained expressive range** ([FDG 2025](https://arxiv.org/pdf/2504.05334)) for keeping outputs inside a target region while preserving variety — the formal frame for "plausible period crowd, not 500 identical extras."

### d. Combinatorial coverage for sampling efficiency

Pairwise/covering-array testing (standard software-testing result: most interaction faults are pairwise) applies to weighted-choice graphs: instead of pure random sampling for QA, generate a covering array over choice axes so every pair of (archetype × garment), (era × material), (zone × behavior) appears at least once in the review sample. This makes contact-sheet review of prompt families tractable at the same cost discipline ExtraExtra already applies to sprite review.

### Harness architecture implication

Combine §1's DSPy lesson with §4: the harness is not a test suite bolted on after — it is the *compiler target*. Every semantic stage declares its metric(s); CI runs replay-mode; scheduled runs hit live providers on held-out briefs; ERA + shift analysis run on every grammar revision; judge stress-tests gate every judge-dependent metric. The reimplementation plan's "change the reward function" requirement gets its concrete machinery here.

---

## Reading shortlist (in priority order for the harness work)

1. Smith & Whitehead — Expressive Range Analysis (and generative shift follow-ons)
2. Rashkin et al. — AIS / Measuring Attribution in NLG
3. Gu et al. — LLM-as-a-Judge survey + Judge Reliability Harness
4. DSPy paper — pipelines as compiled programs with metrics
5. D2T faithfulness pair: arXiv 2502.12372 + 2411.19203
6. Oppenlaender — Taxonomy of Prompt Modifiers
7. Reiter & Dale — Building NLG Systems (microplanning/aggregation chapters)
8. LLMs for Generative IE survey + JSONSchemaBench

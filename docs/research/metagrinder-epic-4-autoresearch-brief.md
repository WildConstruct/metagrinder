# Metagrinder Epic 4 Autoresearch Brief

_Last updated: 2026-03-09_

## Goal

Use `karpathy/autoresearch` as a research harness to identify the best framework for Metagrinder Epic 4 semantic research-mode review.

This is not a plan to drop `autoresearch` directly into production.

This is a plan to use an `autoresearch` loop to study the design space, compare candidate framework shapes, and produce a bounded recommendation for the real Metagrinder implementation.

## Why This Fits

The current Epic 4 heuristics are useful for learning artifact shape, but they are not the final answer.

The recent additional research tests exposed the core limitation:

- pure keyword heuristics drift on long analytical reports
- generic vocabulary can overpower actual document intent
- the useful system likely needs a semantic layer and bounded reasoning

`autoresearch` appears to be designed around a simple but strong pattern:

- the human edits a control document
- the agent edits a bounded target
- each run has a fixed budget
- results are evaluated against a stable metric
- improvements are accumulated and logged

That is a good fit for discovering the best Epic 4 framework before hardening it into Metagrinder.

## Research Question

What is the best bounded framework for an Epic 4 research-review agent that:

1. classifies research mode more usefully than heuristics alone
2. proposes category focus that is specific to the brief
3. produces inspectable rationales and warnings
4. remains stable, testable, and auditable

## What We Are Comparing

We are not comparing random prompt variations only.

We are comparing framework families.

### Family A: Heuristic-First Baseline

- deterministic intake
- chunk typing
- rule-based mode classification
- rule-based category proposal

Purpose:

- baseline cost, speed, and inspectability

### Family B: Embedding-Ranked Classification

- deterministic intake
- chunk or section summary embeddings
- nearest-neighbor or prototype matching for research modes
- category proposal from semantic similarity plus rule guardrails

Purpose:

- test whether semantic similarity fixes the current false positives

### Family C: Hybrid Semantic Review

- deterministic intake
- embedding retrieval against mode exemplars and category exemplars
- bounded agent synthesis pass that writes:
  - mode candidates
  - confidence
  - evidence anchors
  - category proposal
  - warnings

Purpose:

- likely target shape if inspectability stays high

### Family D: Full Agent Judgment

- deterministic intake
- minimal hard-coded rules
- agent decides mode, category focus, and review findings directly

Purpose:

- likely too loose, but useful as an upper-bound comparison

## Fixed Inputs

Use the same normalized brief corpus for all runs.

Start with:

- `packages/core/tests/fixtures/metagrinder/research-input-broadway.txt`
- `packages/core/tests/fixtures/metagrinder/research-input-greenhouse.txt`
- `packages/core/tests/fixtures/metagrinder/research-input-shipyard.txt`
- `packages/core/tests/fixtures/metagrinder/research-input-desert-outpost.txt`
- `spaghettiwestern.md`
- `research_tests/medieval_peasent_generator.md`
- `research_tests/tabloid_naming.md`
- `research_tests/weeklyworldnews`

Optional later:

- more real-world briefs that are not already overfit by the current tests

## Fixed Outputs To Judge

Every candidate framework should output the same artifact shape:

- `mode-detection.json`
- `category-hypothesis.json`
- `assumption-review.json`
- optional `augmentation-plan.json`

At minimum, the artifacts must include:

- selected `researchKind`
- ranked candidate modes
- confidence
- evidence anchors or matched signals
- recommended category focus
- warnings
- explanation for why the proposed category focus was chosen

## Evaluation Criteria

The harness should optimize for the following, in order:

1. mode usefulness
2. category usefulness
3. rationale inspectability
4. warning precision
5. stability across diverse briefs
6. implementation boundedness

### Concrete Scoring Rubric

For each brief, score:

- mode correctness: `0-2`
- mode usefulness even if not perfect: `0-2`
- category specificity: `0-2`
- rationale quality: `0-2`
- warning usefulness: `0-2`

Total per brief: `0-10`

Secondary penalties:

- opaque reasoning
- generic category suggestions
- noisy warnings
- over-claiming confidence
- framework complexity that is hard to audit

## Recommended Harness Shape

Adapt the `autoresearch` pattern like this:

### Human-controlled file

`program.md`

This should define:

- the research question
- the candidate framework families
- the evaluation rubric
- the allowed files the agent can edit
- the exact output report format

### Agent-editable target

One bounded experiment file or small folder, for example:

- `experiments/epic4_review_experiment.py`

or

- `experiments/epic4_review/`

Keep the editable surface deliberately small.

### Read-only corpus

- test briefs
- expected judgments
- evaluation harness

### Stable evaluator

The evaluator should:

- run the framework on the fixed corpus
- score outputs against expected judgments
- emit a single comparable score
- log per-brief failure modes

## Suggested Tonight Scope

Do not try to solve the entire framework tonight.

Tonight should establish the research loop.

### Tonight Deliverables

1. define the fixed corpus
2. define expected judgments for each brief
3. define the scoring rubric in machine-readable form
4. create a first `program.md`
5. create one bounded experiment target
6. run the first comparative loop across at least:
   - heuristic baseline
   - embedding-ranked baseline

## Minimal Expected Judgments

These should be treated as initial working judgments, not eternal truth.

- `research-input-broadway.txt`
  - expected mode: `historical-scene-research`
- `research-input-greenhouse.txt`
  - expected mode: `environment-observation`
- `research-input-shipyard.txt`
  - expected mode: `environment-observation`
- `research-input-desert-outpost.txt`
  - expected mode: `environment-observation`
- `spaghettiwestern.md`
  - expected mode: `mixed`
- `research_tests/medieval_peasent_generator.md`
  - expected mode: `character-framework`
- `research_tests/tabloid_naming.md`
  - expected mode: `style-analysis`
- `research_tests/weeklyworldnews`
  - expected mode: `style-analysis`

## Production Constraint

The winning framework should still preserve the Metagrinder product constraints:

- deterministic intake stays
- artifact outputs stay inspectable
- no hidden model-only black box
- operator review remains possible
- tests can run locally and deterministically enough for regression coverage

## Decision Rule

Do not pick the framework that gets the highest raw score if it is materially less auditable than the runner-up.

Prefer the most bounded framework that:

- beats heuristic-only mode detection on the difficult briefs
- improves category usefulness on mixed and analytical reports
- produces rationales an operator can actually inspect

## Sources

I was not able to reliably access the GitHub README directly during this pass, so the `autoresearch` summary above is based on recent reporting and reposted summaries of Karpathy's March 7-8, 2026 launch notes, which consistently describe the same core shape:

- human edits `program.md`
- agent edits training code
- fixed run budget
- stable evaluation loop

References:

- https://www.marktechpost.com/2026/03/08/andrej-karpathy-open-sources-autoresearch-a-630-line-python-tool-letting-ai-agents-run-autonomous-ml-experiments-on-single-gpus/
- https://x.com/i/trending/2030448892035441050

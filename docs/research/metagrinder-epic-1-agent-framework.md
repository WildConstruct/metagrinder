# Metagrinder Epic 1: Research Intake And Distillation Framework

_Last updated: 2026-03-07_

## 1. Epic Goal

Build the first Metagrinder workflow that takes one research document and turns it into inspectable, provenance-aware PSG collections.

This epic establishes the agent framework, pass contracts, and deterministic MVP pipeline.

## 2. User Value

By the end of Epic 1, a user should be able to provide a research document such as:

- `1950s New York Broadway audience on a cold evening`

and receive:

- chunked source coverage
- extracted claims and concept candidates
- clustered scene concepts
- prompt-ready PSG fragments
- a thin `research-package.json` manifest

The output should be useful for prompt authoring, reviewable by a human, and safe to refine in later passes.

## 3. In Scope

- single-document intake
- deterministic chunking
- extraction of claims, concepts, evidence, and uncertainty
- concept classification into reusable scene categories
- prompt synthesis PSG generation
- package manifest generation
- pass-by-pass JSON artifacts
- validation of output contracts

## 4. Out Of Scope

- multi-document merging
- autonomous web research
- direct UTDG submission
- curator workflow
- prompt mutation lab
- browser UI
- live editor integration
- authority reconciliation against external sources

## 5. Core Product Rules

1. No one-shot hidden parse.
2. Every derived record must retain source lineage.
3. Quoted, paraphrased, and inferred material must remain distinct.
4. Uncertainty must be explicit.
5. PSG collections are the canonical user-facing result.
6. UTDG contribution is a later epic, not part of Epic 1 delivery.

## 6. Deliverables

### Required

- one CLI entrypoint for the MVP pipeline
- pass contracts for `ingest`, `extract`, `classify`, `synthesize`, `score`, and `package`
- one deterministic local implementation of those passes
- output folder containing:
  - `ingest.json`
  - `extract.json`
  - `classify.json`
  - `synthesize.json`
  - `score.json`
  - `source-map.psg`
  - `concept-clusters.psg`
  - `prompt-synthesis.psg`
  - `research-package.json`
- tests for contract validity and minimum pipeline behavior

## 7. Success Criteria

Epic 1 is complete when:

1. one research document can be processed end-to-end without manual file editing
2. every derived record links back to one or more source chunks
3. prompt synthesis output is composed from concepts, not copied summaries
4. intermediate artifacts are inspectable and useful for debugging
5. another contributor can run the pipeline from the repository without guessing hidden steps

## 8. Risks

### Risk 1: Node soup

Mitigation:

- require collection-specific classification before PSG generation

### Risk 2: False authority

Mitigation:

- preserve uncertainty and evidence on extracted records

### Risk 3: Prompt fluff

Mitigation:

- score prompt fragments for provenance and reuse value

### Risk 4: Schema sprawl

Mitigation:

- keep pass contracts narrow and versioned

## 9. Story Map

Epic 1 is broken into these stories:

1. Story 1: Intake Contract And Chunking
2. Story 2: Extraction Pass For Claims, Concepts, And Evidence
3. Story 3: Classification Into Research Collections
4. Story 4: Prompt Synthesis PSG Builder
5. Story 5: Package Assembly And Validation
6. Story 6: Review Report And Operator Runbook

See:

- [Metagrinder Epic 1 Story Breakdown](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/docs/research/metagrinder-epic-1-story-breakdown.md)

## 10. Recommendation

Do not expand this epic into UTDG submission or browser UX.

The win condition for Epic 1 is a believable research-to-PSG package pipeline with inspectable intermediate state.

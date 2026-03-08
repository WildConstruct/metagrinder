# Metagrinder Epic 1 Story Breakdown

_Last updated: 2026-03-07_

## Story 1: Intake Contract And Chunking

### Goal

Create the intake contract and deterministic chunker for one research document.

### Scope

- raw text input
- stable source IDs
- section-aware chunking
- `ingest.json`

### Acceptance Criteria

1. one input text file can be normalized into ordered source chunks
2. each chunk has a stable ID and sequence
3. chunking prefers paragraph and heading boundaries over arbitrary splits
4. the pass emits valid `ingest.json`

## Story 2: Extraction Pass For Claims, Concepts, And Evidence

### Goal

Extract reusable findings from chunked source material without collapsing uncertainty.

### Scope

- claims
- concept candidates
- evidence snippets
- open questions
- warnings

### Acceptance Criteria

1. every extracted record carries `sourceChunkIds`
2. the pass distinguishes quoted, paraphrased, and inferred material
3. extraction separates at least:
   - wardrobe
   - people and crowd
   - weather and environment
   - lighting
   - materials and surfaces
4. ambiguous or weak findings are emitted as uncertainty, not flattened into fact

## Story 3: Classification Into Research Collections

### Goal

Route extracted findings into structured research collections that can become PSG assets.

### Scope

- `source-map`
- `claims-and-evidence`
- `concept-clusters`
- concept bucket assignment

### Acceptance Criteria

1. extracted findings are assigned into collection families
2. concept clusters are grouped into reusable scene categories
3. low-confidence or unresolved items are preserved in an explicit unresolved bucket
4. the pass emits valid `classify.json`

## Story 4: Prompt Synthesis PSG Builder

### Goal

Turn classified concepts into prompt-ready PSG fragments.

### Scope

- `prompt-synthesis.psg`
- prompt family generation
- lineage-preserving prompt nodes

### Acceptance Criteria

1. prompt fragments are built from concepts and claims, not copied source paragraphs
2. the builder emits a valid `prompt-synthesis.psg`
3. each prompt fragment retains lineage to concept IDs and source chunk IDs
4. the output contains distinct prompt families for at least:
   - atmosphere
   - wardrobe
   - crowd behavior
   - lighting

## Story 5: Package Assembly And Validation

### Goal

Assemble the generated collections into a bounded research package with validation.

### Scope

- `source-map.psg`
- `concept-clusters.psg`
- `prompt-synthesis.psg`
- `research-package.json`
- schema validation

### Acceptance Criteria

1. package generation writes all required files to a predictable output directory
2. `research-package.json` references all generated collections correctly
3. manifest and pass outputs validate against their schemas
4. the pipeline exits non-zero on invalid output

## Story 6: Review Report And Operator Runbook

### Goal

Make the MVP understandable and reviewable by another contributor.

### Scope

- `review.json`
- unresolved ambiguity reporting
- operator note

### Acceptance Criteria

1. the review pass reports missing provenance, weak concepts, and unresolved ambiguities
2. the repository includes a short operator note for running the MVP pipeline
3. another contributor can inspect pass outputs without reverse-engineering the code

## Recommended Build Order

1. Story 1
2. Story 2
3. Story 3
4. Story 4
5. Story 5
6. Story 6

## Suggested MVP Cut

If scope must tighten for the first runnable version, complete:

1. Story 1
2. Story 2
3. Story 3
4. Story 4
5. the minimum packaging subset of Story 5

Story 6 can follow immediately after the first end-to-end run.

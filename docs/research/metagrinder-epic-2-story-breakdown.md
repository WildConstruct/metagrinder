# Metagrinder Epic 2 Story Breakdown

_Last updated: 2026-03-07_

## Story 1: Multi-Input Intake Contract

### Goal

Allow the runner to accept multiple text inputs and preserve document boundaries in `ingest.json`.

### Scope

- input manifest or repeated CLI inputs
- multiple `sourceInputId` values
- document-aware chunk IDs

### Acceptance Criteria

1. the runner accepts at least 2 text inputs
2. each source document receives its own stable `sourceInputId`
3. chunk IDs remain deterministic and document-scoped
4. `ingest.json` preserves document title and source identity

## Story 2: Document-Aware Extraction

### Goal

Ensure extraction output preserves which document each claim, concept, and evidence record came from.

### Scope

- document-aware claim attribution
- document-aware concept attribution
- evidence tracking by document

### Acceptance Criteria

1. every extracted record still carries `sourceChunkIds`
2. every extracted record can also be traced to a specific source document
3. the extractor does not flatten multiple documents into one undifferentiated source stream

## Story 3: Cross-Document Concept Deduplication

### Goal

Merge or group repeated concepts from different source documents deterministically.

### Scope

- concept-key normalization
- repeated concept grouping
- duplicate tracking metadata

### Acceptance Criteria

1. repeated concepts from different documents do not create uncontrolled duplicates
2. merged concepts preserve all contributing `sourceChunkIds`
3. uncertain near-duplicates are surfaced for review instead of auto-merged

## Story 4: Corroboration-Aware Scoring

### Goal

Increase confidence when multiple documents support the same concept or claim.

### Scope

- corroboration count
- confidence uplift rules
- ambiguity penalties

### Acceptance Criteria

1. repeated support across documents raises confidence deterministically
2. single-source weak concepts remain lower confidence
3. contradictions reduce confidence or increase review burden

## Story 5: Conflict Reporting And Review Output

### Goal

Surface overlapping, conflicting, or weakly merged findings in `review.json`.

### Scope

- contradiction flags
- overlap warnings
- recommended review actions

### Acceptance Criteria

1. conflicting findings are visible in `review.json`
2. reviewers can see whether a concept is corroborated or disputed
3. unresolved overlap is not silently hidden

## Story 6: Package Manifest Upgrade

### Goal

Upgrade `research-package.json` so it accurately represents multi-document input.

### Scope

- multiple `sourceInputs`
- updated lineage metadata
- package-level confidence summary

### Acceptance Criteria

1. `research-package.json` lists all source inputs
2. package lineage remains explicit
3. output collections stay compatible with the Epic 1 package structure

## Recommended Build Order

1. Story 1
2. Story 2
3. Story 3
4. Story 4
5. Story 5
6. Story 6

## Suggested MVP Cut

If Epic 2 must be cut to the shortest useful slice, complete:

1. Story 1
2. Story 2
3. the minimal grouping subset of Story 3
4. the minimal confidence uplift subset of Story 4

That is enough to prove multi-document intake without building full contradiction handling yet.

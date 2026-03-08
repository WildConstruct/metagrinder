# Metagrinder Epic 2: Multi-Document Intake

_Last updated: 2026-03-07_

## 1. Epic Goal

Extend the Epic 1 Metagrinder pipeline from one research document to a bounded multi-document intake workflow.

The system should accept a small set of related source files, preserve document boundaries, and emit one combined research package without collapsing provenance.

## 2. Why This Epic Is Next

Epic 1 proved that one document can be distilled into:

- inspectable pass artifacts
- PSG research collections
- a valid `research-package.json`

The next structural weakness is that real research work rarely arrives as one clean file. It comes as:

- notes
- citations
- excerpts
- rough summaries
- partial visual observations

Multi-document intake strengthens the core Metagrinder architecture before mutation, UI, or UTDG submission grows the surface area.

## 3. User Value

By the end of Epic 2, a user should be able to provide a small dossier such as:

- one museum excerpt
- one costume note sheet
- one atmosphere note
- one production summary

and receive a single package that:

- preserves per-document provenance
- deduplicates repeated concepts
- distinguishes corroborated findings from one-off claims
- produces stronger concept clusters and synthesis output than any one source alone

## 4. In Scope

- intake manifest for multiple text inputs
- per-document chunking
- document-aware extraction
- cross-document concept deduplication
- corroboration scoring
- package manifest updates for multiple `sourceInputs`
- review output that identifies conflicts and overlap

## 5. Out Of Scope

- automatic internet research
- OCR
- PDF parsing
- image-derived extraction
- UTDG submission
- review UI
- collaborative merging

## 6. Core Product Rules

1. Each source document keeps its own stable ID.
2. Claims and concepts must preserve document-level provenance.
3. Cross-document merging must be explicit, not implicit.
4. Repeated evidence increases confidence; contradiction increases review load.
5. The package remains one research package, not many disconnected parses.

## 7. Deliverables

### Required

- one multi-input intake contract
- updated `ingest` pass for multiple source documents
- extraction that preserves `sourceInputId` and `sourceChunkIds`
- deduplication layer for concept candidates
- corroboration-aware `score.json`
- conflict-aware `review.json`
- updated `research-package.json` with multiple `sourceInputs`

## 8. Success Criteria

Epic 2 is complete when:

1. the runner accepts more than one text input
2. output provenance can be traced back to the originating document and chunk
3. repeated concepts from different documents are merged or grouped deterministically
4. conflicting findings are surfaced in `review.json`
5. package output remains understandable to another contributor

## 9. Story Map

Epic 2 is broken into these stories:

1. Story 1: Multi-Input Intake Contract
2. Story 2: Document-Aware Extraction
3. Story 3: Cross-Document Concept Deduplication
4. Story 4: Corroboration-Aware Scoring
5. Story 5: Conflict Reporting And Review Output
6. Story 6: Package Manifest Upgrade

See:

- [Metagrinder Epic 2 Story Breakdown](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/docs/research/metagrinder-epic-2-story-breakdown.md)

## 10. First Implementation Entry Points

The first code changes for Epic 2 should land in:

- [metagrinder-mvp.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/scripts/lib/metagrinder-mvp.js)
- [run-metagrinder-mvp.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/scripts/run-metagrinder-mvp.js)
- [metagrinder.ts](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/types/metagrinder.ts)
- [metagrinder.runtime.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/types/metagrinder.runtime.js)
- [metagrinder.test.ts](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/tests/metagrinder.test.ts)

## 11. Recommendation

Do not widen Epic 2 into broad import tooling.

The win condition is:

"Take a small research dossier, preserve provenance across documents, and produce one coherent package with stronger concept confidence."

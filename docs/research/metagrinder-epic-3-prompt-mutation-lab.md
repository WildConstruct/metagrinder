# Metagrinder Epic 3: Prompt Mutation Lab

_Last updated: 2026-03-08_

## 1. Epic Goal

Build the first bounded prompt-mutation workflow on top of the existing Metagrinder research package pipeline.

This epic should turn stable prompt fragments and concept lineage into controlled prompt variants without collapsing provenance or exploding combinatorics.

## 2. Why This Epic Is Next

Epic 1 established the deterministic research distillation backbone.

Epic 2 extended that backbone to multiple source documents with corroboration and conflict reporting.

The next useful step is not broader intake. It is controlled recombination of the prompt material already being produced. That is the first place Metagrinder starts acting like a practical authoring tool instead of only a parser.

## 3. User Value

By the end of Epic 3, a contributor should be able to take a validated research package and generate a bounded set of prompt variants that:

- preserve lineage back to concept and source IDs
- respect compatibility rules between fragment families
- expose weak or conflicting mutations before reuse
- remain inspectable as artifacts rather than hidden model output

## 4. In Scope

- mutation input contract
- fragment compatibility rules
- bounded variant generation
- mutation scoring and deduplication
- mutation review output
- `prompt-mutations` artifact and PSG collection support

## 5. Out Of Scope

- free-form LLM prompt brainstorming
- style transfer without provenance
- image-conditioned mutation
- UI mutation lab
- automatic publishing to downstream tools
- fully open-ended combinatorial generation

## 6. Core Product Rules

1. Mutations must start from validated prompt fragments, not raw source chunks.
2. Every mutation must retain lineage to contributing concept IDs and source input IDs.
3. Compatibility rules must be explicit and inspectable.
4. Mutation count must stay bounded by deterministic limits.
5. Low-value, redundant, or conflicting variants must be surfaced for review rather than promoted silently.
6. Mutation output must stay separate from canonical synthesis output.

## 7. Deliverables

### Required

- one mutation contract for fragment intake and compatibility evaluation
- one deterministic mutation generator
- mutation-aware `score` and `review` extensions
- `prompt-mutations.json` or equivalent intermediate artifact
- `prompt-mutations.psg`
- updated package manifest support for mutation collections
- tests covering compatibility, lineage, dedupe, and safety behavior

## 8. Success Criteria

Epic 3 is complete when:

1. a contributor can generate bounded prompt mutations from an existing research package
2. every mutation can be traced back to contributing prompt fragments, concepts, and source inputs
3. incompatible fragment combinations are rejected deterministically
4. duplicate or low-value variants are filtered or flagged
5. another contributor can inspect mutation output without reverse-engineering generator internals

## 9. Risks

### Risk 1: combinatorial blow-up

Mitigation:

- enforce per-family limits and deterministic generation caps

### Risk 2: provenance drift

Mitigation:

- require mutation lineage on every generated variant

### Risk 3: shallow novelty

Mitigation:

- score mutations for distinctiveness and reject near-duplicates

### Risk 4: unsafe semantic recombination

Mitigation:

- evaluate compatibility before generation and surface conflicts in review output

## 10. Story Map

Epic 3 is broken into these stories:

1. Story 1: Mutation Contract And Fragment Compatibility Rules
2. Story 2: Controlled Variant Generation
3. Story 3: Mutation Review And Safety Constraints
4. Story 4: Mutation Package And Manifest Integration

See:

- [Metagrinder Epic 3 Story Breakdown](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/docs/research/metagrinder-epic-3-story-breakdown.md)

## 11. First Implementation Entry Points

The first code changes for Epic 3 should land in:

- [metagrinder-mvp.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/scripts/lib/metagrinder-mvp.js)
- [run-metagrinder-mvp.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/scripts/run-metagrinder-mvp.js)
- [metagrinder.ts](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/types/metagrinder.ts)
- [metagrinder.runtime.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/types/metagrinder.runtime.js)
- [metagrinder.test.ts](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/packages/core/tests/metagrinder.test.ts)

## 12. Recommendation

Do not widen Epic 3 into a generative playground.

The win condition is:

"Take validated prompt material, generate bounded variants, and keep every mutation inspectable, reviewable, and provenance-aware."

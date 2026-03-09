# Metagrinder Epic 3 Story Breakdown

_Last updated: 2026-03-08_

## Story 1: Mutation Contract And Fragment Compatibility Rules

### Goal

Define what prompt fragments may enter the mutation pass and how compatibility is evaluated before recombination.

### Scope

- mutation input schema
- family compatibility rules
- lineage requirements
- deterministic rejection reasons

### Acceptance Criteria

1. mutation input can be derived from existing synthesis output without manual reshaping
2. every candidate fragment preserves `conceptIds`, `sourceInputIds`, and `sourceChunkIds`
3. incompatible fragment combinations are rejected before generation
4. the pass emits explicit compatibility or incompatibility reasons

## Story 2: Controlled Variant Generation

### Goal

Generate a bounded set of prompt mutations from compatible fragments.

### Scope

- deterministic generation caps
- family-aware recombination
- duplicate suppression
- prompt-mutation artifact emission

### Acceptance Criteria

1. the generator produces a bounded number of variants per run
2. mutations do not lose lineage
3. exact or near-duplicate variants are suppressed or flagged
4. the pass emits valid mutation artifacts

## Story 3: Mutation Review And Safety Constraints

### Goal

Make mutation output inspectable and safe to promote.

### Scope

- mutation review artifact
- weak mutation flags
- conflict flags
- promotion guidance

### Acceptance Criteria

1. low-value or conflicting mutations are visible in review output
2. reviewers can distinguish promotable variants from rejected ones
3. compatibility failures are preserved for inspection instead of disappearing silently

## Story 4: Mutation Package And Manifest Integration

### Goal

Integrate mutation output into the existing research package without collapsing it into the base synthesis collection.

### Scope

- `prompt-mutations.psg`
- package manifest update
- collection metadata and lineage
- validation coverage

### Acceptance Criteria

1. the package can include mutation output as a distinct collection
2. mutation collections remain compatible with the existing research package structure
3. package validation fails on malformed mutation output
4. the runner writes mutation output to a predictable location

## Recommended Build Order

1. Story 1
2. Story 2
3. Story 3
4. Story 4

## Suggested MVP Cut

If Epic 3 must be cut to the shortest useful slice, complete:

1. Story 1
2. the minimum bounded generation subset of Story 2
3. the minimum review subset of Story 3

That is enough to prove prompt mutation without widening the package surface too early.

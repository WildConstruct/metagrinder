# Metagrinder Epic 4 Story Breakdown

_Last updated: 2026-03-09_

## Story 1: Research Mode Detection

### Goal

Detect the likely type of deep research before extraction begins.

### Scope

- `researchKind` field
- mode-detection artifact
- deterministic or bounded heuristics for first-pass classification

### Acceptance Criteria

1. the system can classify common research briefs into one of the supported modes
2. the classification includes confidence and reasons
3. unknown or mixed briefs can be marked as mixed instead of forced into one mode

## Story 2: Category Hypothesis And Priority Proposal

### Goal

Generate a likely category schema based on detected research mode.

### Scope

- category hypothesis artifact
- default priority ordering
- operator-editable importance levels

### Acceptance Criteria

1. each research mode maps to a plausible category set
2. priorities are explicit rather than hidden
3. operators can override priorities without rewriting the full schema

## Story 3: Chunk Intent Typing

### Goal

Distinguish what each chunk is doing before extraction.

### Scope

- `chunkKind` tagging
- chunk kinds such as:
  - `source-note`
  - `observation`
  - `concept-list`
  - `generation-rule`
  - `template`
  - `uncertainty`

### Acceptance Criteria

1. dense briefs no longer treat templates and generation advice as ordinary factual claims
2. extraction behavior can branch by chunk kind
3. low-confidence or mixed-intent chunks are surfaced for review

## Story 4: Human Review Step

### Goal

Add the operator checkpoint between mode detection and full extraction.

### Scope

- assumption review artifact
- proceed / adjust / augment decisions
- lightweight UI or CLI review surface

### Acceptance Criteria

1. operators can see the detected mode and proposed categories
2. operators can redirect priorities before extraction
3. the review step remains fast enough for regular use

## Story 5: Augmentation Planning Layer

### Goal

Propose what extra work would improve confidence or package quality.

### Scope

- augmentation-plan artifact
- verification targets
- suggested missing source types
- suggested follow-up research directions

### Acceptance Criteria

1. the system can explain what is weak or missing
2. augmentation output is operational, not vague
3. this layer can later support a premium workflow without changing the core parser

## Recommended Build Order

1. Story 1
2. Story 2
3. Story 3
4. Story 4
5. Story 5

## Product Split

### Base Metagrinder

- intake cleanup
- mode detection
- category hypothesis
- operator review
- standard extraction and package generation

### Higher-Touch Augmentation

- assumption audit
- stronger verification planning
- targeted follow-up research suggestions
- confidence upgrade recommendations

This split keeps the core parser useful while leaving room for a higher-value assisted workflow.

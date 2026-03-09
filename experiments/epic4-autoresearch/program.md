# Epic 4 Semantic Review Framework Search

## Mission

Identify the best bounded framework for Metagrinder Epic 4 research-review classification and operator-facing review artifacts.

This harness is not selecting prompts only.

It is comparing framework families.

## Core Question

What framework best classifies research briefs into useful research modes, proposes specific category focus, and produces inspectable review artifacts without collapsing into an opaque agent-only system?

## Candidate Families

### A. Heuristic-First Baseline

- deterministic intake
- rule-based chunk typing
- rule-based mode detection
- rule-based category proposal

### B. Embedding-Ranked Baseline

- deterministic intake
- summary or chunk embeddings
- similarity against mode exemplars
- category proposal from semantic similarity with rules as guardrails

### C. Hybrid Semantic Review

- deterministic intake
- embedding retrieval against mode and category exemplars
- bounded agent synthesis pass for final review artifact

### D. Full Agent Judgment

- deterministic intake
- minimal hard-coded rules
- agent chooses mode and review outputs directly

## Constraints

- preserve deterministic intake
- preserve inspectable artifact outputs
- preserve local evaluability
- do not require hidden reasoning to understand mode selection
- prefer bounded complexity over maximal cleverness

## Fixed Corpus

Use the briefs listed in `judgments.json`.

Do not add or remove briefs during a run.

## Required Output Shape

For each brief, every framework must emit:

- `mode-detection.json`
- `category-hypothesis.json`
- `assumption-review.json`
- optional `augmentation-plan.json`

At minimum, the outputs must contain:

- selected `researchKind`
- ranked candidate modes
- confidence
- rationale or evidence anchors
- recommended category focus
- warnings

## Scoring Priorities

1. mode usefulness
2. category usefulness
3. rationale inspectability
4. warning precision
5. stability across mixed brief types
6. boundedness and auditability

## Editing Boundary

The research agent may edit files inside:

- `experiments/epic4-autoresearch/`

The research agent should not directly edit production Metagrinder code during framework search runs unless the human explicitly expands scope.

## Deliverable

Produce a recommendation that includes:

- best-performing framework family
- why it won
- key failure modes
- what should transfer into real Epic 4 implementation
- what should remain experimental

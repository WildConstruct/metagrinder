# Metagrinder Epic 4 Semantic Framework

_Last updated: 2026-03-09_

## Status

Recommended as the current winning Epic 4 framework shape after bounded framework search and expanded validation.

This is the framework to implement next.

It is not a claim that the work is permanently finished.

It is the current best bounded design.

## Executive Summary

Epic 4 should not stay heuristic-only.

It also should not become a freeform agent that decides mode, category focus, and warnings without strong structure.

The winning shape is:

1. deterministic structural intake
2. chunk-aware semantic prototype scoring
3. explicit mixed-mode handling
4. evidence-backed category ranking
5. inspectable confidence and warning artifacts

In short:

Epic 4 should be a bounded semantic review layer on top of deterministic intake.

## Why This Won

Framework search and expanded validation showed:

- heuristic-only logic handled straightforward briefs well
- heuristic-only logic failed the most important hybrid brief type
- the bounded semantic lane recovered those failures without regressing on the simple cases

Current comparison result on the expanded validation set:

- heuristic baseline: `106 / 120`
- semantic baseline: `114 / 120`

Key win:

- `spaghettiwestern.md` is treated as `mixed` instead of being flattened into `character-framework`

Additional validation wins:

- historical scene memo stays historical scene
- style-analysis brand brief stays style-analysis
- material-reference surface sheet stays material-reference
- procedural generator notes stay procedural-guide

## Product Decision

Implement Epic 4 as a semantic review pass that consumes deterministic intake output rather than replacing intake.

The review system should produce inspectable artifacts before full extraction widens.

## Core Architecture

### Layer 1: Deterministic Intake

Keep:

- normalized text intake
- structural preparsing
- section detection
- chunk building
- chunk kind typing

Why:

- this remains stable
- this is inspectable
- this gives semantic review the right substrate

### Layer 2: Semantic Mode Scoring

Replace heuristic-first mode selection with prototype scoring built over intake artifacts.

Inputs:

- normalized chunks
- section labels
- chunk kinds
- weighted token profile
- research mode prototypes

Behavior:

- compare intake profile against research mode prototypes
- weight rare and mode-specific signals more than generic vocabulary
- let category-level signals influence mode score
- preserve ranked candidate modes

Output:

- top mode
- candidate mode list
- confidence
- reasons

### Layer 3: Mixed-Mode Gate

Mixed-mode should not be a default fallback.

It should trigger only when:

- multiple non-mixed framework families remain strong
- structural evidence supports hybrid content
- template or generation-rule content materially coexists with observational content

This prevents:

- flattening hybrid briefs into one ontology
- incorrectly marking ordinary procedural guides as mixed just because they contain templates

### Layer 4: Category Hypothesis

Category ranking should be generated from:

1. winning research mode family
2. category-level signal matches in the brief

This is not a static mapping only.

It is a ranked, evidence-backed proposal.

Output requirements:

- category label
- priority
- rationale

### Layer 5: Assumption Review

Assumption review remains an explicit product artifact.

It should surface:

- detected mode
- candidate alternatives
- confidence
- detected chunk kinds
- recommended category focus
- warnings
- operator decisions

### Layer 6: Augmentation Planning

Augmentation remains optional but inspectable.

It should propose:

- verification targets
- missing source types
- follow-up research directions

## Required Artifacts

Keep the current artifact family:

- `mode-detection.json`
- `category-hypothesis.json`
- `assumption-review.json`
- optional `augmentation-plan.json`

These should remain ahead of `extract.json`.

## What Transfers From The Experiment

### Transfer

- prototype-based research mode scoring
- rarity-weighted token scoring
- category-signal influence on mode scoring
- structural mixed-mode gate
- evidence-backed category ranking
- confidence calibration against candidate gaps
- validation corpus plus machine-readable judgments
- comparison reports

### Do Not Transfer Directly

- the exact experiment scripts as product code
- the experiment scoring rubric as product logic
- the root-level sandbox structure

Those were research harness artifacts, not product architecture.

## Research Modes To Support

The implementation target should support at least:

- `historical-scene-research`
- `environment-observation`
- `material-reference`
- `character-framework`
- `style-analysis`
- `procedural-guide`
- `mixed`

## Product Constraints

The implementation must preserve:

- deterministic intake
- inspectable intermediate artifacts
- testable local behavior
- bounded review logic
- human-readable rationales

The implementation must avoid:

- hidden black-box mode decisions
- purely prompt-driven category proposals with no evidence anchors
- overusing `mixed`
- overconfident labels when candidate gaps are small

## Confidence Policy

Confidence is part of the product, not just internal math.

Rules:

- `high` only when the leading mode is clearly separated
- `medium` when the selected mode is likely but near alternatives remain plausible
- `low` only when the system has weak signal

Confidence should be grounded in:

- mode gap
- structural consistency
- signal specificity

## Warning Policy

Warnings should be precise, not decorative.

Good warnings:

- hybrid framework conflict
- template content mixed into evidence flow
- generation-rule content mixed into evidence flow
- reference-table restructuring need

Bad warnings:

- generic “review this” filler
- warnings on simple scene packets with no real risk

## Implementation Shape In Repo

Recommended target structure:

- `packages/core/services/researchReview/`
  - semantic scorer
  - mixed-mode gate
  - confidence calibration
  - category hypothesis builder
  - assumption review builder
- `packages/core/types/`
  - keep existing Epic 4 artifact schemas
  - add any semantic profile or prototype types only if necessary
- `packages/core/tests/research-review/`
  - keep the current fixture corpus
  - add the new adversarial validation briefs

## Validation Standard

The product implementation should not be considered ready until it passes:

1. existing Metagrinder fixture tests
2. the expanded adversarial validation set
3. artifact inspection on mixed and analytical briefs

Minimum benchmark:

- must preserve the `spaghettiwestern -> mixed` win
- must preserve correct handling of:
  - style-analysis reports
  - material-reference briefs
  - procedural-guide briefs

## Recommended Build Order

1. extract semantic scoring logic from experiment into product service
2. keep current schemas and artifact contract
3. replace heuristic mode selection with semantic scorer
4. replace static category proposal with evidence-backed ranking
5. port expanded validation corpus into product tests
6. rerun artifact inspection before any review UI wiring

## What This Means For Story 4

Do not wire the final operator review surface yet.

First:

- port the winning semantic layer into product code
- confirm the product artifacts match the experimental gains
- confirm inspectability remains high

Then:

- wire the review surface on top of the stabilized artifact model

## Final Recommendation

Run with this framework.

Do not continue open-ended framework search right now.

The bounded semantic review architecture is the current winner, and the next correct step is implementation, not more undirected exploration.

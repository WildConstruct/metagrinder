# Reverse Analysis Pipeline Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the thin executable pipeline behind reverse prompt analysis.

It separates:

- model-driven steps
- deterministic matching steps
- agent or human review steps

## 2. Pipeline Stages

### Stage A: Perception

Model-driven:

- segmentation
- object detection
- rough depth estimation
- rough normal estimation
- color clustering

Outputs:

- region masks
- object candidates
- visual feature summaries

### Stage B: Prompt Reconciliation

Deterministic plus heuristic:

- tokenize prompt or prompt history
- compare prompt concepts against detected regions and objects
- mark tokens as:
  - present
  - partial
  - absent
  - inferred

Outputs:

- prompt alignment records

### Stage C: UTDG Matching

Deterministic plus ranked lookup:

- material candidate lookup
- archetype lookup
- modifier lookup
- compatibility filtering

Inputs:

- visual features
- prompt-aligned tokens
- optional historical/style context

Outputs:

- UTDG match report
- candidate material/effect refs

### Stage D: Semantic Scene Package Assembly

Deterministic:

- build `semantic-scene-package.json`
- attach confidence summaries
- attach lineage and source refs
- emit adjustment handles

### Stage E: Optional Promotion

Agent or human reviewed:

- promote regions into world semantic field records
- emit patch proposals
- emit witness render manifests
- stage UTDG contribution candidates if appropriate

## 3. Review Boundary

These should not auto-merge without review in early versions:

- historical claims
- off-camera patch proposals
- new canonical UTDG contributions
- strong geometry continuation claims

## 4. Recommended Rainy Alley v1

For the current prototype family:

- use fixture-based region masks and object hypotheses
- skip live model calls
- simulate prompt reconciliation deterministically
- emit the semantic scene package and patch proposal as real files

That is enough to prove the artifact loop without solving live reverse analysis yet.

## 5. Recommendation

Build the first version as a staged pipeline with clear review boundaries.

That keeps the outputs trustworthy and makes later model swaps much easier.

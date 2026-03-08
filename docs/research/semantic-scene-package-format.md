# Semantic Scene Package Format

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the project-local artifact produced by reverse prompt analysis.

This package is intended to store recovered scene meaning from an image or render in a form that can later be edited, queried, and promoted into a world semantic field.

## 2. Role In The System

The semantic scene package sits between:

- raw render input

and

- full world semantic authoring

It is a transitional but durable artifact.

## 3. Package Goals

The package should preserve:

- scene segmentation results
- object and region hypotheses
- prompt alignment
- UTDG matches
- confidence and provenance
- latent adjustment handles

## 4. Proposed Files

### Required

- `semantic-scene-package.json`
- `scene-region-map.json`
- `prompt-reconciliation.json`
- `utdg-match-report.json`

### Optional

- `segmentation-mask.png`
- `depth-estimate.exr`
- `normal-estimate.exr`
- `splat-bootstrap.json`

## 5. Core Manifest Shape

Suggested top-level fields for `semantic-scene-package.json`:

- `packageId`
- `packageType`
- `sourceRender`
- `sourcePrompt`
- `analysisMode`
- `sceneRegions`
- `objectHypotheses`
- `promptAlignment`
- `utdgMatches`
- `adjustmentHandles`
- `confidenceSummary`
- `lineage`

## 6. Scene Region Record

Each region should be able to store:

- `regionId`
- `maskRef`
- `boundingBox`
- `dominantColors`
- `materialHypotheses`
- `objectHypotheses`
- `environmentalHypotheses`
- `promptRefs`
- `utdgRefs`
- `confidence`

## 7. Object Hypothesis Record

Each object hypothesis should store:

- `objectId`
- `label`
- `regionRefs`
- `materialRefs`
- `promptRefs`
- `utdgRefs`
- `confidence`

## 8. Prompt Alignment Record

The package should explicitly represent prompt-to-scene alignment:

- `promptToken`
- `matchedRegionRefs`
- `matchedObjectRefs`
- `status`
  - present
  - partial
  - absent
  - inferred
- `confidence`

This is important because later edits should know what was explicitly prompted versus inferred from the image.

## 9. UTDG Match Report

The match layer should carry:

- proposed material concepts
- proposed archetypes
- proposed modifiers
- supporting visual signals
- unresolved ambiguity

This should not automatically become canonical UTDG data.

It is a project-local interpretation unless separately staged for contribution.

## 10. Adjustment Handles

This package should create a lightweight latent adjustment layer.

Examples:

- `wetness`
- `roughness bias`
- `soot intensity`
- `fog density`
- `historic authenticity override`
- `surface age bias`

These are not final shader parameters.

They are semantic control handles that later tools can map into model prompts, masks, or material systems.

## 11. Promotion Paths

The package should support promotion into:

- world semantic points
- semantic regions
- semantic volumes
- splat bootstrap records
- render text packets
- staged UTDG submissions

## 12. Why This Format Matters

Without this package, reverse analysis remains ephemeral.

With it, the system gains:

- editability
- auditability
- later world-building value
- agent collaboration value

## 13. Recommendation

Treat this as a first-class Metagrinder package type, not just a temporary internal report.

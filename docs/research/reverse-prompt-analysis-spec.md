# Reverse Prompt Analysis Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a reverse-analysis workflow for turning a render plus prompt into a semantically recoverable scene package.

The goal is not to guess the exact original prompt string.

The goal is to recover enough structured scene meaning that the result becomes editable, queryable, and reusable.

## 2. Core Idea

Input:

- rendered image or still frame
- source prompt or prompt history
- optional depth, normal, mask, or metadata sidecars

Output:

- semantic scene package
- scene-region masks and object hypotheses
- UTDG-aligned material/effect matches
- editable adjustment handles for later renders or relensing

## 3. Why This Matters

A flat render is normally a dead endpoint.

Reverse prompt analysis turns it into:

- reusable scene structure
- editable semantic regions
- recoverable material logic
- a bootstrap for splat/world reconstruction
- a control surface for future generations

## 4. Pipeline

### Stage A: Scene Segmentation

Use segmentation and detection models to identify:

- major objects
- surface regions
- sky/ground/background separation
- likely material boundaries
- local color zones

Expected tools:

- SAM-like segmentation
- object detection
- depth estimation
- optional normal estimation

### Stage B: Prompt Reconciliation

Compare recovered regions against:

- input prompt text
- prompt variants
- known style notes
- prior render packets if available

The system should determine:

- which prompt concepts are visibly present
- which concepts are weakly present or absent
- which visible elements were likely not stated explicitly

### Stage C: UTDG Mapping

Map detected regions and prompt concepts to UTDG candidates such as:

- base materials
- archetypes
- modifiers
- environmental conditions
- compatibility rules

Color, texture, and shape cues should contribute to confidence, but not become the only signal.

### Stage D: Semantic Scene Backfill

Create a project-local semantic representation containing:

- objects
- regions
- local material hypotheses
- environmental hypotheses
- prompt-aligned text summaries
- confidence and provenance

### Stage E: Adjustment Surface Creation

Emit control handles that can later drive:

- localized prompt edits
- mask edits
- material swaps
- weather/effect adjustments
- relensing and camera changes

## 5. Key Principle

This system should produce a useful semantic interpretation of the image, not claim perfect truth.

Everything should carry:

- confidence
- provenance
- editable status
- unresolved ambiguity where needed

## 6. Recommended Outputs

### Required

- semantic scene package manifest
- region/object map
- prompt-to-scene reconciliation report
- UTDG match report

### Strong optional outputs

- segmentation masks
- color/material summary data
- rough depth estimate
- splat bootstrap hints
- render text packet candidate

## 7. Relationship To Metagrinder

Metagrinder should treat reverse prompt analysis as another intake mode.

Instead of:

- research prompt in

It becomes:

- render plus prompt in

Then the system emits:

- project-local semantic package
- staged UTDG candidates
- world bootstrap hints

## 8. Relationship To World Semantic Authoring

Reverse prompt analysis is a bootstrap path for semantic world authoring.

The likely sequence is:

1. ingest render and prompt
2. segment image
3. infer region/object semantics
4. align to UTDG
5. emit semantic scene package
6. promote selected regions into splats, regions, or volumes
7. support relensing and alternate camera work

## 9. Off-Camera Inference

Once the recovered scene is promoted into splats or a world semantic field, the system can make bounded guesses about off-camera content.

This is useful for:

- relensing
- camera changes
- witness renders for alternate angles
- continuity support

This must still be treated as hypothesis, not canonical geometry truth.

## 10. Recommended v1 Scope

Keep the first version narrow:

- one render
- one prompt
- segmentation-backed region map
- rough UTDG reconciliation
- semantic scene package output
- no claim of exact prompt reconstruction

## 11. Success Criteria

The workflow is successful if:

1. the output is more editable than the source render
2. recovered semantics are legible and useful
3. UTDG mapping improves later prompts or camera passes
4. the package is a plausible bootstrap for world authoring

## 12. Recommendation

Present this as semantic backfill and recovery, not "AI guesses your prompt."

That framing is more accurate and much more valuable.

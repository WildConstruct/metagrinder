# Progressive Scene Recovery Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the iterative recovery loop that turns a single image or render into a progressively better semantic world base.

The goal is not one-shot reconstruction.

The goal is staged improvement.

## 2. Core Idea

Start with:

- one image or render
- one prompt or prompt history
- optional depth, masks, or metadata

Produce:

- semantic scene package
- rough splat or proxy world
- alternate-angle witness renders
- patched scene hypotheses
- improved world semantic field

Then repeat.

## 3. Why This Matters

A single image rarely gives complete world truth.

But it can provide enough signal to begin a useful world model that improves over time.

That makes it possible to:

- patch in missing walls
- infer likely continuation surfaces
- relens scenes
- support new camera positions
- create a reusable base pass for later generation

## 4. Recovery Loop

### Stage A: Initial Backfill

Input image and prompt become:

- segmentation
- object/region hypotheses
- prompt alignment
- UTDG material hypotheses
- semantic scene package

### Stage B: Spatial Bootstrap

Promote selected scene elements into:

- semantic splats
- semantic regions
- proxy geometry
- rough world semantic field

### Stage C: Witness Expansion

Render cheap alternate-angle witness views from the rough world base.

These should be treated as provisional views, not final outputs.

### Stage D: Patch Inference

Use model inference plus UTDG guidance to propose:

- wall continuation
- hidden surface continuation
- environmental extension
- material continuity

### Stage E: Review And Merge

Let agents or humans:

- accept
- reject
- refine
- relabel

Then merge accepted changes back into the semantic scene package or world field.

## 5. Design Principle

Each iteration should increase utility even if it does not fully increase truth.

The key outcome is a better editable world base.

## 6. Stored Outputs Per Iteration

Each pass should be able to emit:

- updated semantic scene package
- updated world semantic field
- witness renders
- patch proposals
- reconciliation notes
- confidence deltas

## 7. Patchable Elements

Likely early patch targets:

- walls
- floors
- ceiling continuations
- alley continuation
- fog zones
- rain-affected regions
- occluded architectural surfaces

## 8. Bounded Inference Rules

Patching should use:

- existing visible materials
- UTDG compatibility
- spatial continuity
- perspective cues
- historical/reference constraints when available

Patching should not silently invent high-confidence scene truth.

Everything inferred should carry:

- confidence
- source basis
- review status

## 9. Relationship To Metagrinder

Metagrinder should support this as an iterative mode:

- analyze
- bootstrap
- witness
- patch
- merge

This is a natural extension of the reverse prompt analysis path.

## 10. Recommended v1 Scope

Keep the first recovery loop very small:

- one scene
- one alternate view
- one patch class
  - wall continuation
- one merge step

## 11. Success Criteria

The recovery loop is successful if:

1. the second pass gives a more usable world base than the first
2. proposed patches are understandable and editable
3. witness renders help later camera changes
4. UTDG improves patch plausibility

## 12. Recommendation

Frame this as progressive scene completion, not full reconstruction.

That is both more accurate and more achievable.

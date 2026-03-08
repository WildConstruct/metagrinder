# Semantic World Authoring Prototype Scope

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the narrowest prototype that can credibly prove the Semantic World Authoring direction.

The prototype should prove five things:

1. a world can be bootstrapped from image-derived or proxy inputs
2. humans can author semantics on top of it
3. Prompt Spaghetti graphs can bind to spatial zones
4. camera query can emit a useful render text packet
5. that packet can drive a downstream image-modify workflow

## 2. Prototype Boundary

### In scope

- one demo world
- one camera path
- one witness render pipeline
- one world semantic field
- one set of localized environmental/material effects
- one downstream adapter target

### Out of scope

- full reconstruction pipeline
- robust multi-shot consistency
- full volumetric simulation
- canonical UTDG publishing
- generalized relighting engine
- production-ready ComfyUI node pack

## 3. Chosen Demo World

Use:

- rainy alley

Why:

- visually legible
- strong material/environment interactions
- supports brick, stone, soot, leaks, dampness, puddles
- easy to reason about with camera-visible semantics

## 4. Required Prototype Inputs

### Authoring inputs

- one witness render or proxy scene render
- one metaball manifest
- one world semantic field
- one camera query config

### Strongly recommended helper inputs

- depth pass
- world normal pass
- one editable semantic mask

## 5. Required Prototype Artifacts

### Existing contract artifacts

- `research-package.json`
- `utdg-submission.json`
- `world-semantic-field.json`
- `render-text-packet.json`
- `camera-pass-manifest.json`
- `model-conditioning-payload.json`
- `luma-adapter-contract.json`

### Prototype-local additions

- one witness render image
- one semantic mask
- one localized effect mask
- one preview control image

## 6. Minimal Feature Set

### Feature 1: Spatial semantic authoring

Allow creation or loading of:

- one semantic region
- one semantic point
- one semantic volume

### Feature 2: Graph binding

Bind at least one Prompt Spaghetti graph or graph-like logic block to:

- wetness on wall
- rain direction effect

### Feature 3: Camera query

Given a camera, rank visible semantic records and emit a render text packet.

### Feature 4: Control bundle generation

Emit:

- render text packet
- semantic mask
- preview control image

### Feature 5: Downstream adapter payload

Generate a model-facing payload for one adapter target.

## 7. Success Criteria

The prototype is successful if:

1. the camera query produces a stable, readable packet
2. visible semantics feel relevant to the current view
3. environmental/material logic is reflected in the packet
4. the control bundle is plausible as downstream model input
5. users can understand and edit the authoring model

## 8. Failure Criteria

The prototype fails if:

1. the world semantic field is too hard to author
2. the packet is noisy or trivial
3. the graph binding adds no value over plain labels
4. the output bundle is not meaningfully better than a plain prompt

## 9. Recommended Implementation Order

1. static rainy alley fixture set
2. world semantic field loading
3. manual semantic authoring primitives
4. graph binding stub
5. camera query ranking
6. render text packet generation
7. preview control image and masks
8. one downstream adapter payload

## 10. Recommendation

Keep the first prototype small and opinionated.

It should prove the loop, not the full platform.

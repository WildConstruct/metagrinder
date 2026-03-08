# Deep Semantic EXR Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a proposed `Deep Semantic EXR` concept for Metagrinder-driven render and generative workflows.

Its purpose is to describe how deep EXR can carry:

- volumetric fog or atmospheric structure
- depth-aware semantic IDs
- effect weights
- auxiliary control information

without trying to store literal text as the source of truth.

## 2. Core Thesis

Deep EXR is a good carrier for fog-related semantic and volumetric information because it already supports:

- multiple samples per pixel
- depth-aware samples
- volumetric intervals using `Z` and `ZBack`
- arbitrary additional channels

That makes it suitable for:

- semantic fog passes
- atmospheric witness passes
- depth-aware effect guidance
- downstream compositing and model-conditioning helpers

It is not a replacement for:

- UTDG
- world semantic field
- metaball manifests
- render text packets

Those remain the semantic source of truth.

## 3. What It Should Carry

The deep EXR should carry machine-readable sample data, not human-authored text strings.

### Appropriate payloads

- volumetric depth interval
- density / opacity
- RGB or emissive color if useful
- semantic class IDs
- material or effect IDs
- influence weights
- environmental controller weights
- importance weights

### Inappropriate payloads

- full prompt strings
- long textual descriptions
- canonical ontology records

## 4. Why This Makes Sense For Fog

Fog is a naturally volumetric phenomenon.

It often needs:

- layered depth representation
- partial transparency
- accumulation over distance
- compositing awareness
- interaction with lighting and camera angle

Deep EXR already models these kinds of volumetric relationships well.

That is why fog is one of the best candidates for this approach.

## 5. Recommended Layering

### Canonical semantic layer

Stored in:

- UTDG

Defines:

- what kind of fog or atmosphere exists
- archetypes
- response semantics
- provenance

### Project/world layer

Stored in:

- metaball
- world semantic field

Defines:

- where fog or atmosphere exists
- which controllers are active
- which zones have narrative weight

### Camera/deep pass layer

Stored in:

- Deep Semantic EXR

Defines:

- what volumetric semantic samples are present in the current camera pass

## 6. Proposed Channel Strategy

### Standard deep/beauty-supporting channels

- `R`
- `G`
- `B`
- `A`
- `Z`
- `ZBack`

### Recommended semantic channels

- `semantic.class_id`
- `semantic.effect_id`
- `semantic.archetype_id`
- `semantic.importance`
- `semantic.influence`
- `semantic.env_controller`

### Optional control channels

- `semantic.density`
- `semantic.phase_bias`
- `semantic.scatter_weight`
- `semantic.story_weight`

These names are conceptual. Actual naming should be normalized later.

## 7. Example Use Cases

### 7.1 Fog volume

The deep EXR stores:

- fog interval depth
- fog density
- fog semantic class
- environment controller weight

### 7.2 Rain mist in alley

The deep EXR stores:

- atmospheric interval
- rain-mist effect ID
- narrative importance near hero zone
- environmental controller linkage

### 7.3 Smoke plume

The deep EXR stores:

- plume interval
- soot/smoke effect ID
- density and influence
- visibility weight

## 8. How It Connects To Render Text

The Deep Semantic EXR should not be decoded directly into raw text by reading colors as language.

Instead:

1. read semantic IDs and weights from the deep pass
2. reconcile against metaball/world semantic field/UTDG references
3. generate or refine a render text packet

This keeps text generation stable and grounded.

## 9. Semantic Lookup Model

### EXR sample stores

- IDs
- weights
- intervals

### Metaball / world semantic field stores

- labels
- localized intents
- volumes
- narrative and visibility metadata

### UTDG stores

- canonical meaning
- archetypes
- compatibility and response semantics

Together they produce:

- a human-readable packet
- a model-conditioning payload
- compositing or shader guidance

## 10. Why Not Just Use RGB Encoding

Encoding meaning as blended colors alone is fragile because:

- interpolation destroys categorical clarity
- filtering changes values
- compression and color transforms can distort data
- blended semantics become ambiguous

If color is used at all, it should be a display/debug view, not the canonical encoding.

IDs and explicit channels are safer.

## 11. Fit With Existing Render Pipelines

This concept fits well with:

- deep compositing
- AOV-style workflows
- witness renders
- volumetric passes
- camera-aligned helper passes

It is most useful as:

- a helper pass
- a semantic witness pass
- a volumetric control pass

not as the only render output.

## 12. Risks

### 1. Overloading EXR

If too much semantic meaning is packed into one pass, it becomes hard to manage.

### 2. Renderer/tool support differences

Not every renderer or tool handles deep data the same way.

### 3. Semantic drift

If EXR-carried IDs do not reconcile cleanly with metaball and UTDG references, the pipeline will become unstable.

## 13. Recommendation

Adopt `Deep Semantic EXR` as an optional derived pass for:

- fog
- smoke
- mist
- atmospheric context
- depth-aware semantic guidance

Do not treat it as the canonical semantic store.

Treat it as:

- camera-specific
- volumetric
- compositing-friendly
- decoder-dependent

## 14. Best Framing

The strongest way to present it is:

"Deep Semantic EXR is a camera-space volumetric helper pass that carries semantic IDs and effect weights for atmospheric and depth-aware generative workflows."

That is more accurate and more durable than claiming it literally stores text.

## 15. Primary Sources

- OpenEXR technical introduction:
  - https://openexr.com/en/latest/TechnicalIntroduction.html
- Interpreting deep pixels:
  - https://openexr.com/en/latest/InterpretingDeepPixels.html
- Deep IDs specification:
  - https://openexr.com/en/latest/DeepIDsSpecification.html
- Arnold deep EXR overview:
  - https://help.autodesk.com/cloudhelp/ENU/AR-Core/files/ac-output-aovs/arnold_user_guide_ac_output_aovs_ac_deep_exr_html.html

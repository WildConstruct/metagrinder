# World Semantic Field Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a `World Semantic Field` extension for Metagrinder/UTDG workflows.

Its purpose is to let a metaball carry world-anchored semantic information that can be:

- attached to spatial positions, regions, and volumes
- queried by a camera view
- ranked by importance and influence
- encoded into render-time text context

This is the bridge between:

- canonical UTDG meaning
- spatial world state
- view-conditioned render guidance

## 2. Core Thesis

A metaball can become more valuable if it contains not only prompt graphs and contribution artifacts, but also a world-anchored semantic layer.

That means the metaball is not just:

- a research package
- a prompt package

It can also be:

- a semantic world package

This is what makes it "spicy":

it can carry the context that a render system or image model needs to understand what matters in-frame.

## 3. What A World Semantic Field Is

A `World Semantic Field` is a spatial semantic index made of:

- points
- splats
- regions
- volumes

Each element references semantic meaning rather than only geometry.

Examples:

- a wet brick patch on a wall
- a soot plume zone above a torch
- a damp alley corridor
- a moss band along the lower stone base
- a hero prop zone with high narrative priority

## 4. Why Not Just Use Geometry

Geometry alone does not tell the system:

- what a surface means
- which local modifiers matter
- what is visually important
- what context should be sent to a model

The field exists so the camera can ask:

"What semantic information is visible and important right now?"

## 5. Spatial Record Types

### 5.1 Semantic Point

Use for:

- small local details
- sparse anchors
- material/effect hot spots

Examples:

- leak source
- scorch point
- moss cluster

Suggested fields:

- `id`
- `recordType`: `SemanticPoint`
- `worldPosition`
- `worldNormal`
- `influenceRadius`
- `falloff`
- `utdgRefs`
- `labels`
- `importanceWeight`
- `narrativeWeight`
- `visibilityWeight`

### 5.2 Semantic Splat

Use for:

- soft influence zones
- fuzzy or blended local effects

Examples:

- wetness spread
- splash zone
- grime halo

Suggested fields:

- `id`
- `recordType`: `SemanticSplat`
- `worldPosition`
- `orientation`
- `radius`
- `anisotropy`
- `falloff`
- `utdgRefs`
- `labels`
- `influenceWeight`

### 5.3 Semantic Region

Use for:

- contiguous surface areas
- logical wall or floor segments

Examples:

- west wall lower half
- damp stone stair tread area
- stained ceiling strip

Suggested fields:

- `id`
- `recordType`: `SemanticRegion`
- `geometryBindingRef`
- `bounds`
- `utdgRefs`
- `labels`
- `importanceWeight`
- `surfaceClass`

### 5.4 Semantic Volume

Use for:

- atmospheric or large contextual zones
- semantic conditions that are not tied to one surface only

Examples:

- fog pocket
- smoke accumulation region
- damp alley corridor
- snow-exposed roof zone

Suggested fields:

- `id`
- `recordType`: `SemanticVolume`
- `volumeType`
- `bounds`
- `utdgRefs`
- `labels`
- `importanceWeight`
- `environmentalControllerRefs`

## 6. Shared Fields

Every world semantic record should support:

- `id`
- `recordType`
- `utdgRefs[]`
- `sourceRefs[]`
- `labels[]`
- `worldPosition` or `bounds`
- `importanceWeight`
- `narrativeWeight`
- `visibilityWeight`
- `lineage`
- `reviewStatus`

Optional useful fields:

- `effectRefs[]`
- `localizedIntentRefs[]`
- `responseProfileRefs[]`
- `environmentalControllerRefs[]`

## 7. Geometry And Material Bindings

World semantic records should not duplicate raw mesh data.

Instead they should reference:

- geometry IDs
- material slots
- surface IDs
- region IDs
- object IDs

Suggested linkage fields:

- `geometryBindingRef`
- `materialBindingRef`
- `surfaceBindingRef`
- `objectRef`

## 8. Camera Query Model

The render system should be able to ask:

"Which semantic records are visible in this camera view, and which matter most?"

### Query inputs

- camera transform
- view frustum
- render resolution
- optional depth/occlusion data
- optional task context

### Query outputs

- visible semantic records
- ranked semantic records
- aggregated render-text packet

## 9. Visibility And Importance Ranking

Each visible record should be scored.

Suggested conceptual formula:

`finalScore = baseImportance * screenCoverage * visibility * distanceBias * narrativePriority * semanticInfluence`

### Score factors

#### `baseImportance`

General significance of the record.

#### `screenCoverage`

How much of the view it influences.

#### `visibility`

Frustum presence plus occlusion.

#### `distanceBias`

Nearer or hero-layer items can weigh more.

#### `narrativePriority`

Story-relevant items outrank incidental detail.

#### `semanticInfluence`

How strongly the record affects rendered appearance.

## 10. Render Text Packet

The camera query should not dump all visible text into the model.

It should emit a compressed packet.

### Goals

- summarize what is visually important
- preserve dominant material and effect context
- avoid token explosion

### Suggested packet sections

- `dominant_surfaces`
- `localized_effects`
- `environmental_conditions`
- `hero_details`
- `optional_background_context`

### Example packet

```json
{
  "dominant_surfaces": [
    "wet brick wall with directional rain streaking",
    "damp stone base with moss accumulation"
  ],
  "localized_effects": [
    "heavy wetness near leaking pipe on left wall",
    "soot staining above doorway arch"
  ],
  "environmental_conditions": [
    "wind-driven rain moving left-to-right and downward"
  ],
  "hero_details": [
    "foreground brick patch with high reflectivity and darkened mortar"
  ]
}
```

## 11. Why This Belongs In A Metaball

A metaball can hold:

- the prompt graphs
- the UTDG references
- the localized intents
- the environmental controllers
- the world semantic field

That means a metaball can become a portable semantic world package, not just a prompt package.

This is what makes the metaball materially more important:

- it carries meaning
- it carries spatial context
- it carries render guidance
- it can answer camera-conditioned queries

## 12. Suggested Metaball Additions

If this is adopted, a richer metaball may include:

- `world-semantic-field.json`
- `view-query-config.json`
- `render-text-packets/`

These should still be optional layers, not mandatory for the smallest package shape.

## 13. Storage Recommendation

### Canonical UTDG should store

- semantic meaning
- compatibility logic
- response semantics

### Metaball should store

- project-specific spatial anchoring
- world semantic records
- camera query config
- render packet generation settings

### Runtime should compute

- frustum filtering
- occlusion filtering
- score ranking
- final render packet generation

## 14. Example Use Cases

### 1. Filmmaker prebuilt world

The filmmaker prepares a world ahead of time and walks cameras through it.

Visible semantic records are queried and turned into context for render or model guidance.

### 2. Smart environmental storytelling

The view sees:

- wet alley walls
- soot above lamps
- snow cling on roof edges

The packet reflects those conditions automatically.

### 3. Context-aware image modification

A model receives the witness render plus ranked semantic packet and can modify or refine the image with stronger material fidelity.

## 15. Risks

### 1. Too much visible data

If every point emits text equally, the packet becomes unusable.

### 2. Overly literal storage

Do not store raw per-frame visibility results in the canonical package.

### 3. Confusing semantic and scene layers

Keep UTDG reference semantics separate from world-instance anchoring.

## 16. Recommendation

Adopt `World Semantic Field` as a derived metaball extension.

The right division is:

- UTDG = canonical meaning
- metaball = project/world packaging
- world semantic field = spatial semantic layer inside the metaball
- camera query = visibility and ranking system
- render packet = compressed text context for the model or render helper

## 17. Proposed Next Step

The next useful formalization would be:

1. a machine-readable schema for `world-semantic-field.json`
2. a schema for `render-text-packet`
3. a camera query contract for ranking and packet generation

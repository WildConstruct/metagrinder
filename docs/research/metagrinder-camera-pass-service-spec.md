# Metagrinder Camera Pass Service Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a launchable v1 service concept for Metagrinder:

`Metagrinder Camera Pass`

The purpose of the service is to generate a semantically informed camera-aligned control bundle that can be passed into downstream image or render workflows.

This is not a final renderer.

It is a semantic render-prep and model-conditioning layer.

## 2. Product Thesis

The easiest useful launch shape is:

- a ComfyUI-facing node or node pack
- backed by a hosted Metagrinder service
- outputting a semantic camera pass bundle

The node should make it easy to do what is manually possible but operationally annoying:

- gather visible semantic context
- rank what matters
- build render text packets
- generate local influence masks and control maps
- route that bundle into a downstream model pipeline

## 3. What The Service Is

The service takes:

- a current camera view
- a preview or witness render
- optional scene-aligned auxiliary passes
- a world semantic field
- project-local semantic packaging from the metaball

and produces:

- a ranked semantic context packet
- one or more control maps
- an output manifest
- optional model-ready request payloads

## 4. What The Service Is Not

It is not:

- a replacement for a game engine renderer
- a full path tracer
- a guarantee that downstream model output is perfectly spatially consistent
- a substitute for full geometry-aware compositing in every case

## 5. Launchable v1 Positioning

### Best framing

"Metagrinder Camera Pass generates the easiest semantic control bundle for prompt-based material and environment-aware image refinement."

### Why that is launchable

- ComfyUI can already move images, masks, and API calls through a graph
- Luma and other image systems can already consume image/reference/modify workflows
- witness render + text packet + masks is a tractable output bundle

## 6. Inputs

### 6.1 Required inputs

#### `witnessRender`

A preview RGB image aligned to the current camera.

Role:

- composition lock
- visual grounding
- image reference for downstream model workflows

#### `cameraMetadata`

Minimum fields:

- camera ID
- transform
- projection parameters
- resolution
- aspect ratio

#### `worldSemanticField`

The project-local semantic field stored in or referenced by the metaball.

Role:

- visible semantic lookup
- contextual weighting
- material/effect retrieval

#### `metaballManifest`

Used to locate:

- research package
- staged or local semantic assets
- world semantic field
- optional previous render packets

### 6.2 Strongly recommended inputs

#### `depthPass`

Role:

- occlusion and spatial consistency
- local effect placement

#### `worldNormalPass`

Role:

- directional environmental logic
- wall/floor/ceiling response separation
- rain / grime / exposure reasoning

#### `maskInputs`

Examples:

- painted mask
- object mask
- region mask
- semantic mask

Role:

- local control
- user intent

### 6.3 Optional inputs

#### `materialIdPass`

Role:

- separate different surfaces sharing the same frame

#### `objectIdPass`

Role:

- isolate hero objects or geometry groups

#### `styleRefs`

Role:

- downstream model styling

#### `taskMode`

Examples:

- material refinement
- weather pass
- grime pass
- witness-only

#### `environmentControllerState`

Examples:

- rain direction
- intensity
- runoff strength

## 7. Input Contract Summary

### Minimal v1 contract

- `witnessRender`
- `cameraMetadata`
- `worldSemanticField`
- `metaballManifest`

### Recommended practical v1 contract

- `witnessRender`
- `cameraMetadata`
- `worldSemanticField`
- `metaballManifest`
- `depthPass`
- `worldNormalPass`
- `maskInputs?`

## 8. Outputs

The service should return a bundle, not a single artifact.

### 8.1 Required outputs

#### `renderTextPacket`

Compressed visible semantic context for the current view.

#### `cameraPassManifest`

Structured metadata describing:

- input assets used
- field and packet IDs
- query settings
- output artifacts

#### `previewControlImage`

A camera-aligned helper image that may include:

- witness render
- semantic overlays
- low-res proxy texture realization

### 8.2 Strongly recommended outputs

#### `semanticMask`

Merged or layered mask representing semantic effect influence.

#### `localizedEffectMask`

A mask tuned to a specific material/effect combination.

#### `modelConditioningPayload`

A structured payload that can be routed into a downstream model call.

### 8.3 Optional outputs

#### `depthPassOut`

Refined or forwarded depth

#### `worldNormalPassOut`

Refined or forwarded world normal

#### `materialSelectionMap`

Material-aware routing map

#### `debugScoreBreakdown`

Per-record ranking diagnostics

## 9. Core Processing Pipeline

### Step 1: Load metaball context

Resolve:

- manifest
- world semantic field
- local semantic references

### Step 2: Camera query

Use the camera to:

- find visible semantic records
- estimate visibility
- compute rank

### Step 3: Packet generation

Compress top records into:

- dominant surfaces
- localized effects
- environmental conditions
- hero details

### Step 4: Control map generation

Combine:

- mask inputs
- semantic records
- depth
- world normals
- environmental controller state

to produce:

- semantic masks
- localized effect masks

### Step 5: Preview witness enrichment

Optionally bake or overlay:

- semantic highlights
- low-res material state hints
- local weather or response cues

### Step 6: Downstream routing

Emit:

- packet
- masks
- preview/control image
- model-ready payload

## 10. Suggested Camera Pass Manifest

Suggested file:

- `camera-pass-manifest.json`

Suggested fields:

- `cameraPassId`
- `metaballId`
- `cameraId`
- `worldSemanticFieldId`
- `renderTextPacketId`
- `inputArtifacts`
- `outputArtifacts`
- `queryConfig`
- `taskMode`
- `generatedAt`

## 11. Suggested Model-Conditioning Payload

This payload should be portable across downstream model adapters.

Suggested shape:

```json
{
  "taskMode": "material-refinement",
  "renderTextPacket": {
    "dominant_surfaces": ["wet brick wall with rain streaking"],
    "localized_effects": ["wet patch near left wall leak source"]
  },
  "conditioningAssets": {
    "witnessRender": "previewControlImage.png",
    "semanticMask": "semanticMask.png",
    "localizedEffectMask": "localizedEffectMask.png"
  },
  "styleRefs": [],
  "notes": ["Use witness render for composition lock"]
}
```

## 12. ComfyUI Workflow Placement

### Recommended node position

Place Metagrinder Camera Pass after:

- scene preview / witness generation
- optional mask generation

and before:

- image modify
- image-to-image refinement
- texture generation
- compositing

### Example graph shape

1. scene or witness render input
2. optional mask input
3. optional depth/normal input
4. Metagrinder Camera Pass node
5. downstream model node
6. optional compositing or post node

## 13. Business Model Fit

This service is monetizable because it does more than package prompts.

It provides:

- semantic ranking
- packet generation
- control map generation
- context packaging
- backend orchestration

That is the hard operational layer users do not want to assemble manually every time.

## 14. Risks

### 1. Overpromising final-render acceleration

The service should be positioned as render prep and model conditioning, not guaranteed final-render acceleration.

### 2. Weak inputs

If witness render, depth, normal, or masks are poor, output quality will degrade.

### 3. Token bloat

The render text packet must stay compressed and ranked.

### 4. Model mismatch

Different downstream models will need different payload shapes.

Mitigation:

- use adapter layer per model family

## 15. Launch Recommendation

Start with a narrow v1:

### Inputs

- witness render
- camera metadata
- world semantic field
- metaball manifest
- optional depth
- optional world normal
- optional one mask

### Outputs

- render text packet
- semantic mask
- preview control image
- camera pass manifest
- model-conditioning payload

This is enough to prove the concept without pretending the service is a full renderer.

## 16. Recommendation

Yes, this is realistic as a launch shape.

The strongest version is:

- Metagrinder as hosted semantic camera-pass service
- ComfyUI node as the easiest frontend
- witness render + world semantic field + camera query + control bundle as the core product

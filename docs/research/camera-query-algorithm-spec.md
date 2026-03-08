# Camera Query Algorithm Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the first practical algorithm for querying a metaball's world semantic field from a camera view.

Its job is to turn:

- spatial semantic records
- camera state
- optional depth or occlusion data

into:

- visible records
- ranked records
- a compressed render text packet

## 2. Scope

This is a prototype-facing algorithm spec.

It is intentionally narrow:

- one camera
- one world semantic field
- one ranking pass
- one render packet output

It does not attempt to solve:

- full multi-camera orchestration
- temporal coherence
- full volumetric visibility
- learned semantic ranking

## 3. Inputs

### Required

- `WorldSemanticField`
- `CameraQueryContract`
- camera transform
- view projection / frustum

### Optional

- depth buffer
- occlusion proxy geometry
- task context
- current narrative focus
- current material task or render mode

## 4. Output

The algorithm should return:

- `visibleRecords[]`
- `rankedRecords[]`
- `RenderTextPacket`
- optional debug scores

## 5. Record Eligibility Pass

Before ranking, determine whether a record is eligible for consideration.

### Rules

1. The record must intersect the camera frustum.
2. The record must not be filtered by task context.
3. The record must not be explicitly disabled by review or policy state.

### Suggested exclusions

- `restricted` records for unauthorized contexts
- records with zero effective importance
- records outside current query mode

## 6. Visibility Estimation

Use a record-type-specific visibility estimate.

### SemanticPoint

Estimate visibility from:

- point projection inside frustum
- optional depth/occlusion test
- projected influence radius

### SemanticSplat

Estimate visibility from:

- center visibility
- projected radius / ellipse
- optional depth test

### SemanticRegion

Estimate visibility from:

- bounds-frustum intersection
- projected screen coverage
- optional depth sample coverage

### SemanticVolume

Estimate visibility from:

- bounds-frustum intersection
- projected overlap
- task-context relevance

## 7. Score Model

Each visible record gets a score.

### Base formula

`finalScore = baseImportance * screenCoverage * visibility * distanceBias * narrativePriority * semanticInfluence`

### Factor definitions

#### `baseImportance`

Start with:

- `importanceWeight`

#### `screenCoverage`

Approximate how much screen-space area or influence the record occupies.

Suggested range:

- `0.0 - 1.0`

#### `visibility`

Represents view presence and occlusion confidence.

Suggested range:

- `0.0 - 1.0`

#### `distanceBias`

Bias nearer items or hero distance bands.

Suggested shape:

- inverse-distance curve or tuned falloff

#### `narrativePriority`

Start with:

- `narrativeWeight`

Multiply by optional task focus boosts.

#### `semanticInfluence`

Start with:

- `visibilityWeight`

Optionally boost if:

- effectRefs are active
- localized intents affect current render target
- material response is visually strong

## 8. Bias Controls From CameraQueryContract

Apply query-level weights after base record fields.

### Suggested contract fields already defined

- `distanceBias`
- `narrativePriorityBias`
- `semanticInfluenceBias`
- `useOcclusion`
- `maxRecords`
- `maxPacketEntries`

### Adjusted formula

`finalScore = baseImportance * screenCoverage * visibility * distance(distanceBias) * narrative(narrativePriorityBias) * semantic(semanticInfluenceBias)`

## 9. Ranking Process

### Step 1

Compute raw score for each visible record.

### Step 2

Sort descending by score.

### Step 3

Trim to `maxRecords`.

### Step 4

Bucket top results by semantic role:

- dominant surfaces
- localized effects
- environmental conditions
- hero details
- optional background context

### Step 5

Trim per bucket and overall using `maxPacketEntries`.

## 10. Bucket Assignment Heuristics

### `dominant_surfaces`

Prefer:

- SemanticRegion
- SemanticVolume
- high-coverage material archetypes

### `localized_effects`

Prefer:

- SemanticPoint
- SemanticSplat
- records with localizedIntentRefs or effectRefs

### `environmental_conditions`

Prefer:

- SemanticVolume
- records tied to environmental controllers

### `hero_details`

Prefer:

- high-score local records
- high narrative weight

### `optional_background_context`

Use:

- lower-priority but still meaningful context

## 11. Text Compression Rules

Do not emit raw labels only.

Instead build compressed readable strings from:

- labels
- utdgRefs
- effect refs
- environmental controller refs
- response profile hints

### Example transform

From:

- labels: `["wet brick", "leak zone"]`
- effect: `rain`
- response profile: `darkens, reflective, runoff`

To:

- `"wet brick leak zone with reflective darkening and runoff"`

## 12. Debug Output

Prototype mode should optionally emit:

- per-record scores
- factor breakdowns
- bucket assignment
- discarded reasons

This is important because the ranking will need tuning.

## 13. Failure Modes

### 1. Over-selection

Too many records survive and packet quality collapses.

Mitigation:

- stricter trimming
- better bucket limits

### 2. Under-selection

The packet misses meaningful visible context.

Mitigation:

- lower thresholds
- boost coverage-based surfaces

### 3. Narrative blindness

Large surfaces overwhelm hero details.

Mitigation:

- stronger narrative weighting
- hero-detail quota

### 4. Semantic noise

Low-value tags or weakly grounded records dominate packet text.

Mitigation:

- quality gates
- review-state filtering

## 14. Prototype Recommendation

For v1 prototype, use this sequence:

1. frustum test
2. optional occlusion boolean
3. screen coverage estimate
4. score computation
5. ranking and trim
6. bucket assignment
7. text compression
8. packet emit

## 15. Recommendation

This algorithm is sufficient for the first runtime prototype.

It is simple enough to implement now and structured enough to improve later with:

- temporal smoothing
- learned ranking
- multimodal conditioning
- per-task packet strategies

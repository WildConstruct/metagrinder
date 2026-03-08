# UTDG Extension: Environmental Effects And Smart Painter

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a UTDG-aligned extension for:

- smart painting
- localized environmental effects
- world-space procedural surface response

The motivating use case is:

"Paint an area of geometry as rain-reactive, then let a master environmental controller procedurally resolve how wetness, runoff, streaking, and related effects appear based on world normals, directionality, and material response."

## 2. Short Answer

Yes, this is a strong and coherent extension of the UTDG model.

It fits best when separated into:

1. semantic material meaning
2. painted influence or susceptibility
3. environmental controller logic
4. world-space geometric inputs
5. shader or material realization

The painter does not paint the final look directly.

The painter paints influence, permission, or susceptibility.

The procedural module computes the final effect.

## 3. Core Product Idea

An artist or system paints an influence field on geometry.

That influence field is linked to a semantic effect intent such as:

- rain-wetness
- seepage
- grime accumulation
- moss growth
- snow cling
- soot deposition

The system then combines:

- base material knowledge from UTDG
- painted influence map
- world normal and world-space orientation
- global environmental parameters
- optional contextual fields like shelter, curvature, or height

to generate a localized, coherent surface effect.

## 4. Why This Fits UTDG

UTDG already aims to describe:

- what a surface is
- what modifiers affect it
- what visual properties are associated with those modifiers
- what combinations are valid

Environmental effects are just a more dynamic version of modifier composition.

Example:

- `brick` is the base archetype
- `rain-wetness` is the environmental modifier
- `world-normal + rain vector + influence map` determines where and how the modifier appears

That is exactly the kind of semantic-to-render bridge UTDG should support.

## 5. The Right Conceptual Separation

### A. Base material

Examples:

- brick
- plaster
- wood siding
- oxidized metal

Defined by:

- UTDG concept or archetype

### B. Surface response profile

Examples:

- darkens strongly when wet
- becomes glossier when wet
- creates vertical runoff streaks
- accumulates grime in crevices
- dries unevenly

Defined by:

- UTDG response semantics tied to the material or archetype

### C. Influence map

Examples:

- painted mask
- vertex map
- UV texture mask
- world-space field

Role:

- tells the system where the effect is allowed or emphasized

### D. Environmental effect controller

Examples:

- rain controller
- snow controller
- dirt accumulation controller
- leak controller

Role:

- centralizes shared behavior and directionality

### E. Shader/material realization

Examples:

- roughness modulation
- albedo darkening
- normal breakup
- streak generation
- cavity accumulation

Role:

- turns semantic intent into rendered appearance

## 6. Example: Procedural Rain On Brick Wall

### Inputs

- base material: `brick`
- effect intent: `rain-wetness`
- influence map: artist paints a vertical wall area
- world normal: wall faces mostly sideways
- rain vector: wind-driven rain from left to right and downward
- global rain controls:
  - intensity
  - direction
  - runoff amount
  - streak length
  - pooling
  - drying rate

### Result

The wall does not simply get a uniform dark patch.

It receives:

- side-hit wetness
- directional streaking
- water accumulation on protruding and recessed areas according to shader logic
- response shaped by brick-specific material behavior

## 7. Why World Normal Matters

World normal is a critical input because it describes how a surface is oriented in the scene.

That enables:

- upward-facing surfaces to collect water
- vertical surfaces to show streaking and directional rain impact
- downward-facing surfaces to stay relatively protected
- sloped surfaces to create runoff paths

This is different from tangent-space texture normals.

The system needs actual world-space orientation, not only local micro-surface detail.

## 8. Recommended UTDG Extension Concepts

### 8.1 SurfaceResponseProfile

Represents how a base material responds to an environmental modifier.

Examples:

- brick response to rain
- plaster response to dampness
- wood response to soot

Suggested fields:

- `baseMaterialRef`
- `modifierRef`
- `roughnessResponse`
- `darkeningResponse`
- `specularResponse`
- `streakBehavior`
- `poolingBehavior`
- `dryingBehavior`
- `confidence`
- `evidenceRefs`

### 8.2 EnvironmentalEffectController

Represents a reusable master control node for an environmental process.

Examples:

- rain
- snow
- dirt accumulation
- leaking water

Suggested fields:

- `effectType`
- `directionVector`
- `intensity`
- `falloffModel`
- `gravityInfluence`
- `accumulationBias`
- `evaporationRate`
- `globalOverrides`

### 8.3 InfluenceField

Represents where the effect can occur and how strongly it should respond.

Examples:

- vertex color red channel
- texture mask
- world-space brush volume
- generated cavity field

Suggested fields:

- `fieldType`
- `carrier`
- `channel`
- `strength`
- `invert`
- `resolutionClass`

### 8.4 LocalizedEnvironmentalIntent

Represents the combination of:

- base material
- environmental effect
- influence field
- optional local overrides

Suggested fields:

- `baseMaterialRef`
- `effectControllerRef`
- `influenceFieldRef`
- `responseProfileRef`
- `localOverrides`
- `priority`

## 9. Smart Painter Model

The smart painter should not be understood as a literal pixel-painting brush only.

It is a semantic brush.

### What the painter paints

- effect eligibility
- intensity bias
- local override zones
- exception areas

### What the module computes

- final wetness distribution
- directional streaks
- pooling
- protected dry regions
- breakup noise
- effect interaction with the material

This is the core distinction that makes the tool scalable.

## 10. Master Control Behavior

The Photoshop analogy is correct.

The environmental controller should behave like a master style system:

- one node controls the logic
- many influenced surfaces update consistently
- local maps modulate how the master effect appears

### Example master controls for rain

- rain direction
- wind bias
- rainfall intensity
- splash intensity
- runoff strength
- streak length
- pooling threshold
- evaporation rate
- shelter sensitivity

Changing the controller should update all linked influence fields and affected materials coherently.

## 11. Suggested Evaluation Formula

A simplified conceptual model:

`finalEffect = materialResponse * influenceField * exposure * directionalFlow * controllerParams`

Where:

- `materialResponse` comes from UTDG response semantics
- `influenceField` comes from paint/mask data
- `exposure` comes from world normal, shelter, occlusion, height, and scene context
- `directionalFlow` comes from gravity and environmental vector
- `controllerParams` come from the master environmental node

This does not need to be implemented literally in this form, but it is the right conceptual architecture.

## 12. Spatial Inputs Beyond World Normal

World normal should not be the only geometric input.

High-value additional inputs:

- ambient occlusion or shelter
- curvature
- height relative to world up
- distance to leak source or impact source
- edge detection
- cavity masks
- flow map hints

These can make the effect much smarter without changing the semantic model.

## 13. Recommended Storage Boundary

### Canonical UTDG should store

- base material semantics
- modifier/effect semantics
- response profiles
- compatibility rules
- evidence and confidence

### Derived scene/workflow layer should store

- world normal data
- vertex maps
- texture masks
- world-space fields
- runtime controller values

### Shader/material layer should store

- actual render implementation
- blend graphs
- parameter wiring
- engine-specific realization

This separation keeps the standard reusable and portable.

## 14. Product Opportunities

### 1. Rain-reactive environment painting

Paint susceptibility once and art direct rain globally.

### 2. Smart grime and age systems

Paint likely accumulation zones and let material intelligence handle realism.

### 3. Gameplay or simulation-driven effects

Examples:

- impacts cause mud splash
- leaks dampen walls
- fire creates soot trails
- snow accumulates differently by exposure

### 4. Non-technical semantic art direction

Instead of painting masks blindly, users paint meaningful effect intent.

That is a strong product distinction.

## 15. Risks

### 1. Overloading canonical UTDG

Do not store raw scene-specific geometry fields in canonical UTDG.

### 2. Too much magic

If smart painting becomes unpredictable, users will not trust it.

### 3. Engine lock-in

Do not tie the semantic layer to one renderer or engine.

### 4. Poor material response definitions

If response profiles are weak, effects will look generic and fake.

## 16. Recommendation

This should be treated as a valid UTDG extension.

The correct architecture is:

- UTDG defines semantic effect meaning and material response
- the smart painter defines local influence
- world-space geometric data defines exposure and directionality
- the environmental controller defines global behavior
- the shader graph realizes the final look

## 17. Proposed Next Step

If this direction is accepted, the next useful formalization would be a v1.1 addition to the application profile covering:

- `SurfaceResponseProfile`
- `EnvironmentalEffectController`
- `InfluenceField`
- `LocalizedEnvironmentalIntent`

That would make the vertex-paint and procedural-weather use cases part of the same coherent extension path.

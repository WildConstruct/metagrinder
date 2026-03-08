# Metagrinder Tooling Integration Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document explains how the broader Metagrinder / metaball / UTDG system can integrate with adjacent tooling areas:

- particle systems
- relensing / novel-view assistance
- volumetric lighting
- lens aberrations
- rough image-to-UTDG extraction loops

The goal is not to fully design each subsystem.

The goal is to show how the semantic architecture can drive or inform them.

## 2. Core Principle

UTDG provides meaning.

Metaballs provide project-local spatial and operational context.

Tool plugins use that context to produce effect-specific passes, controls, or prompts.

## 3. Particle Systems

### Why Metagrinder helps

Particles are often context-sensitive.

Examples:

- rain droplets
- dust motes
- sparks
- drifting ash
- splash particles
- leaking water streak emitters

### What UTDG can provide

- what surfaces are present
- which materials respond to impacts, rain, heat, or soot
- what modifiers are active in the area

### What the metaball can provide

- world-space zones
- semantic volumes
- environmental controllers
- hero priority

### Practical integration

Particle plugins could consume:

- `SemanticVolume`
- `EnvironmentalEffectController`
- `SurfaceResponseProfile`

and derive:

- emission zones
- impact interactions
- particle type weighting
- splash or collision behavior cues

### Example

Rain volume intersects a brick wall and ground plane.

The particle plugin uses:

- rain intensity
- world normal
- wetness susceptibility

to bias:

- splash particle emission
- streak formation
- puddle disturbance hints

## 4. Relensing / Novel View Support

### Problem

If a user wants a new camera angle, a single witness render may not be enough.

### Metagrinder contribution

The system can provide:

- witness render from source angle
- world semantic field
- depth and normal helpers
- projected semantic masks
- camera pass manifests

### Plausible workflow

1. start from image or splat bootstrap
2. derive rough depth / geometry proxy
3. generate source-angle witness render
4. generate semantic packet and projected masks
5. move to a new camera angle
6. reproject semantic information where possible
7. emit new witness reference and camera-pass bundle

### Practical framing

Metagrinder should not claim full novel-view synthesis by itself.

It should claim:

- semantic relensing prep
- camera-change-aware witness regeneration
- textural positioning helper passes

### Useful outputs

- source camera pass
- target camera pass
- reprojected semantic mask
- updated render text packet

## 5. Volumetric Lighting Plugins

### Why this fits

Volumetric lighting is heavily driven by:

- atmospheric zones
- density volumes
- light direction
- narrative emphasis

### What the system can contribute

- semantic volumes for fog, smoke, dust, rain
- narrative weighting for hero shafts or moody zones
- environment controller state

### Example

The alley has:

- light rain volume
- faint smoke accumulation above doorway
- high narrative emphasis on a side shaft of light

The volumetric plugin can use the metaball to:

- boost fog density in selected volume
- preserve readability in hero zone
- create stronger scatter where semantics say atmosphere matters

## 6. Lens Aberrations Plugins

### Why semantics matter

Lens effects are usually camera-level, but the decision of when and where to emphasize them can be driven by scene semantics.

Examples:

- glare around wet reflections
- chromatic fringing around high-contrast hero lights
- bloom intensity biased by atmospheric story context

### Metagrinder contribution

- identify high-reflectivity wet regions
- identify hero lights and bright shafts
- identify emotionally important focus zones

### Practical use

Lens plugins could consume:

- render text packet
- hero details
- dominant surfaces
- environmental conditions

to bias:

- bloom
- chromatic aberration
- glare
- lens dirt overlays

## 7. Rough Image-To-UTDG Extraction Loop

### Question

Could a model extract semantic texture/material information from images, match it to UTDG, and receive spatially meaningful prompts back?

### Rough answer

Yes, as a weak-to-strong loop.

It should not be trusted as canonical truth at first pass.

### Proposed loop

1. image in
2. rough segmentation or splat bootstrap
3. model proposes:
   - likely materials
   - likely modifiers
   - likely environment states
4. proposals are matched against UTDG concepts/archetypes
5. system creates provisional spatial records
6. user or agent reviews and edits
7. approved structures feed world semantic field and staged UTDG candidates

### What comes back from UTDG

Once matched, UTDG can return:

- canonical labels
- archetype candidates
- response profiles
- compatibility rules
- prompt-native descriptors

Then the system can form:

- localized intents
- environmental effect suggestions
- render packet text

This is exactly the loop you described:

- rough image analysis
- map to UTDG
- UTDG returns structured semantic meaning
- that meaning is used to alter or refine the world

## 8. Proposed Extraction Stack

### Stage 1: Visual understanding

Extract:

- regions
- likely materials
- texture cues
- weather or wear state

### Stage 2: UTDG reconciliation

Match to:

- concepts
- archetypes
- modifiers
- response profiles

### Stage 3: Spatialization

Store as:

- semantic points
- splats
- regions
- volumes

### Stage 4: Authoring/refinement

Let:

- human edits
- agent suggestions
- graph bindings

refine the result

## 9. What The System Is Best At

The system is best used as:

- semantic middleware
- authoring support
- render/model prep
- effect coordination

It is not best framed as:

- one-step perfect scene understanding
- one-step perfect relensing
- one-step perfect material extraction

## 10. Plugin Family Structure

The broader product could eventually support plugin families such as:

### A. Semantic Camera Pass

- witness render
- render text packet
- control masks

### B. Smart Painter

- localized material intent
- environmental effect painting

### C. Particle Logic

- semantic-driven emission and response

### D. Relensing Assist

- camera-change-aware semantic reprojection

### E. Volumetric Context

- semantic fog/smoke/rain volumes

### F. Lens Context

- semantic lens artifact weighting

## 11. Recommendation

The system absolutely can play into these adjacent tool areas.

The right way to do it is:

- keep UTDG canonical
- keep metaballs project-local and operational
- let plugins consume semantic context rather than duplicating ontology logic

## 12. Near-Term Recommendation

Do not build all plugin families at once.

Prioritize:

1. semantic camera pass
2. smart painter / environmental response
3. rough image-to-UTDG reconciliation loop

Those three create the strongest core.

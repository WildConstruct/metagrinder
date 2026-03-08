# Semantic World Authoring Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a larger product direction for Metagrinder:

`Semantic World Authoring`

The goal is to let humans and agents collaboratively describe, refine, and operationalize a world using:

- image- or view-derived spatial reconstruction
- splats, regions, and volumes as spatial carriers
- UTDG-backed semantic meaning
- Prompt Spaghetti graphs as editable control logic

This is a synthesis document. It is meant to connect the earlier ideas into one system.

## 2. Core Thesis

The strongest version of this product is not just:

- prompt parsing
- UTDG curation
- render packet generation

It is:

"A semantic world authoring system where image-derived spatial representations become editable carriers for material, environmental, narrative, and prompt-native meaning."

In practical terms:

1. bootstrap a world from image inputs
2. attach semantics to the world
3. let humans and agents co-author those semantics
4. use the result to drive render guidance, model conditioning, and prompt-native workflows

## 3. Why This Is Plausible

This is not baseless speculation.

The research landscape already contains adjacent pieces:

### A. Fast image-to-splat or sparse-view reconstruction exists

Examples:

- `InstantSplat` for sparse-view Gaussian Splatting
- Apple's `SHARP` for single-image Gaussian-based view synthesis
- Apple's `DSplats` for splat-based 3D generation
- `GaussianObject` for few-view object reconstruction

Implication:

Bootstrapping a rough world from image inputs is realistic.

### B. Language-grounded splat/3D fields already exist

Examples:

- `LERF`
- `Feature 3DGS`
- `Language Embedded 3D Gaussians`
- `LangSurf`
- `Dr. Splat`
- `LangSplatV2`

Implication:

Associating language or semantic features with 3D carriers is already an active research direction.

### C. Text-guided editing of Gaussian scenes already exists

Examples:

- `Instruct-GS2GS`
- Feature 3DGS language-guided editing

Implication:

Instruction-based or language-based 3DGS editing is plausible and not alien to current systems.

### D. Standard render pipelines already support auxiliary semantic/material data

Examples:

- Blender shader AOVs
- OpenUSD `RenderVar`
- OpenUSD `primvars`
- MaterialX geometry properties

Implication:

Render passes that carry structured helper data are already a standard pattern.

## 4. What Makes This Direction Different

The differentiator is not:

"We discovered that language can connect to 3D."

The differentiator is the proposed product combination:

- UTDG as canonical texture/material meaning
- Metagrinder as ingestion and orchestration engine
- metaballs as portable project-local semantic world packages
- World Semantic Field for spatial semantic storage
- Prompt Spaghetti graphs as controllable behavior and composition logic
- camera-query and render-text packet generation
- smart painter and environmental effect controllers

That is a coherent production system, not just a paper idea.

## 5. High-Level Workflow

### Phase 1: Bootstrap

Input:

- single image
- few images
- sparse views
- witness render or proxy render

Output:

- rough splat-based or proxy spatial representation

### Phase 2: Semantic seeding

System proposes:

- likely surfaces
- material guesses
- semantic regions
- environmental zones
- candidate UTDG refs

### Phase 3: Human world authoring

User can:

- draw boxes
- paint splats
- define regions
- define volumes
- assign semantic labels
- attach Prompt Spaghetti graphs
- set weights, priorities, and sliders

### Phase 4: Agent refinement

Agents can:

- suggest archetypes
- suggest modifiers
- propose environmental controllers
- detect duplicates or inconsistencies
- propose render text packets

### Phase 5: Operationalization

The semantic world can drive:

- prompt generation
- render guidance
- model-conditioning payloads
- smart painter logic
- environmental effect systems

## 6. Core Authoring Primitives

The system should support multiple kinds of spatial primitives.

### 6.1 Splat

Good for:

- local detail
- soft influence
- image-derived anchors

### 6.2 Box or region

Good for:

- practical authoring
- fast large-area assignment
- wall and floor segmentation

### 6.3 Volume

Good for:

- rain
- fog
- dampness
- smoke
- snow exposure

### 6.4 Surface binding

Good for:

- explicit geometry attachment
- material slot linkage
- object-level control

These should coexist.

No one primitive is enough.

## 7. Why Prompt Spaghetti Matters Here

Prompt Spaghetti is not just a prompt UI in this system.

It becomes the logic layer.

### What a graph can control

- material composition
- local modifiers
- environmental response
- prompt packet generation
- visibility weighting
- narrative priority
- output routing

This is important because semantic world authoring is not only annotation.

It is behavior authoring.

## 8. Example Authoring Scenario

### Input

A filmmaker uploads a still or sparse set of frames of an alley.

### Bootstrap

The system creates:

- rough splats
- rough camera-aligned world
- probable wall/floor segmentation

### Human authoring

The user:

- draws a box over the left wall
- labels it `brick`
- paints a local leak zone
- creates a rain volume for the alley corridor
- attaches a Prompt Spaghetti graph controlling wetness, runoff, and narrative emphasis

### Agent help

The system suggests:

- `rain-darkened brick wall` archetype
- `brick rain response profile`
- high-priority leak point splats
- render text packet for current camera

### Result

The world now carries reusable semantic meaning rather than only pixels.

## 9. Human And Agent Division Of Labor

### Humans are best at

- intentional labeling
- art direction
- narrative importance
- exception handling
- approving or rejecting suggestions

### Agents are best at

- filling in repetitive structure
- proposing archetypes
- mapping to UTDG concepts
- ranking visible context
- compressing render text packets
- suggesting environmental logic

This should be a collaborative loop, not an autonomous replacement of human judgment.

## 10. Progressive Refinement

One of the strongest aspects of this idea is progressive refinement.

The system does not need a perfect world on day one.

It can improve through:

- more views
- better reconstruction
- better semantic labeling
- better agent suggestions
- better response profiles
- better render outputs feeding back into authoring

This makes the world editable and learnable over time.

## 11. What The Metaball Becomes

A metaball becomes more than a prompt package.

It becomes a portable semantic world container that can carry:

- research package
- prompt graphs
- UTDG refs
- world semantic field
- localized material intents
- environmental controllers
- camera query config
- render text packets
- camera pass manifests

That is a much more powerful artifact than a plain project file.

## 12. What Needs To Be Stored

### Canonical UTDG

Should store:

- meaning
- archetypes
- compatibility
- response semantics
- provenance

### Metaball

Should store:

- project-local world anchors
- splats, regions, and volumes
- graph bindings
- render packet settings
- camera pass outputs

### Runtime

Should compute:

- visibility
- ranking
- text packet generation
- control map generation
- downstream model adapter payloads

## 13. Suggested Data Types

The system should eventually formalize these:

- `SemanticPoint`
- `SemanticSplat`
- `SemanticRegion`
- `SemanticVolume`
- `LocalizedMaterialIntent`
- `LocalizedEnvironmentalIntent`
- `SurfaceResponseProfile`
- `EnvironmentalEffectController`
- `RenderTextPacket`
- `CameraPassManifest`
- `MetaballManifest`

Most of these are already specified in the current contract work.

## 14. Practical Input Requirements

For a launchable first version, the world authoring loop likely needs:

- one or more source images
- witness render or preview image
- camera metadata
- optional depth
- optional world normals
- optional masks

For stronger world authoring later:

- sparse-view image sets
- reconstruction bootstrap outputs
- object or material IDs
- geometry bindings

## 15. Product Opportunities

### 1. Semantic world editing

Creators describe the world directly instead of only describing prompts.

### 2. Material-aware render guidance

The camera sees what matters and emits structured context.

### 3. Environmental storytelling

Rain, soot, dampness, moss, snow, and grime become authorable semantic behaviors.

### 4. ComfyUI service integration

The node becomes the easiest front end for generating semantic control bundles.

### 5. Shared asset growth

Repeated world authoring patterns feed back into UTDG and archetype libraries.

## 16. Risks

### 1. Overbuilding too early

This can easily become too broad if every idea is implemented at once.

### 2. Semantic inconsistency

Agent suggestions may drift without strong review and normalization.

### 3. Novelty overclaim

Many component ideas already exist in research and graphics pipelines.

### 4. Authoring friction

If the world authoring UI is too heavy, users will not adopt it.

### 5. Weak reconstruction bootstrap

If the initial world is poor, user trust may drop quickly.

## 17. What Is Likely Novel Enough To Matter

Not the existence of:

- Gaussian splats
- language-grounded 3D fields
- custom render passes
- text-guided 3D editing

More likely differentiated:

- the specific product workflow
- UTDG-backed material semantics
- metaball packaging
- Prompt Spaghetti graph binding to spatial world structures
- camera-conditioned semantic packet generation for downstream image models

That is where the real product value likely lives.

## 18. Recommendation

This direction is important.

It should be treated as a real product and architecture thread, not a side idea.

The best next move is not trying to solve the whole stack immediately.

The best next move is building a narrow prototype that proves:

1. a world can be bootstrapped from image inputs
2. humans can paint semantic splats/regions/volumes on top
3. Prompt Spaghetti graphs can attach to those areas
4. camera query can emit a useful render text packet
5. that packet can drive a downstream image-modify workflow

If those five things work, the larger vision becomes much more credible.

## 19. Primary Sources

- 3D Gaussian Splatting: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
- InstantSplat: https://instantsplat.github.io/
- Apple SHARP: https://machinelearning.apple.com/research/sharp-monocular-view
- Apple DSplats: https://machinelearning.apple.com/research/dsplats-3d-generation
- LERF paper: https://openaccess.thecvf.com/content/ICCV2023/html/Kerr_LERF_Language_Embedded_Radiance_Fields_ICCV_2023_paper.html
- Feature 3DGS: https://feature-3dgs.github.io/
- Dr. Splat: https://drsplat.github.io/
- LangSurf: https://langsurf.github.io/
- Instruct-GS2GS: https://instruct-gs2gs.github.io/
- OpenUSD primvars: https://openusd.org/release/user_guides/primvars.html
- OpenUSD rendering guide: https://openusd.org/dev/user_guides/render_user_guide.html

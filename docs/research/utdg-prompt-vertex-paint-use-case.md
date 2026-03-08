# UTDG Use Case: Prompt-Driven Vertex Painting And Local Material Overrides

_Last updated: 2026-03-07_

## 1. Purpose

This document evaluates a concrete use case for UTDG:

"Use texture/material knowledge in the model to allow prompt-driven local material painting on geometry."

Example:

- base surface: `brick`
- local prompt modifier: `wet`
- result: paint or project a wet-material override onto part of the brick surface in the local vicinity of an interaction, actor, or render context

## 2. Short Answer

Yes, this is a strong use case for UTDG.

But the standard should not model it as "the prompt directly paints the shader."

The right architecture is:

1. UTDG resolves semantic material meaning
2. a spatial carrier identifies where the effect applies
3. a shader/material standard defines how the effect is rendered

In other words:

`wet brick near X` = semantic material composition + spatial mask + render binding

## 3. Why This Use Case Fits UTDG

UTDG is already trending toward:

- normalized material concepts
- archetypes
- compatibility logic
- provenance
- prompt generation

Prompt-driven local material painting is a natural extension because it needs all of those:

- the system must know what `brick` means
- it must know what `wet` means as a modifier
- it must know whether `wet` is valid for `brick`
- it must know what visual or shader properties to change
- it must know where the override applies

This is exactly the kind of semantic-to-render bridge that a good texture graph should support.

## 4. What The External Research Supports

### A. Vertex and paint-driven material masking are established workflows

Official engine and DCC docs already support geometry-bound paint data driving materials.

Relevant evidence:

- Unreal documents vertex color and vertex weight painting as a way to blend texture layers in materials.
- Unreal’s `VertexColor` material expression is explicitly used to utilize vertex color data and blend textures.
- Blender documents vertex painting as color attributes that can be consumed by render engines.
- MaterialX supports geometric properties and custom geometry properties, which are functionally similar to primvars and can be referenced in shading graphs.

Conclusion:

Using painted geometry data to drive material blending is standard practice, not a fringe technique.

### B. Layered and masked material systems are already standard practice

Relevant evidence:

- MaterialX is an open standard for look development, including patterns, texturing, nested materials, and geometric assignments.
- OpenPBR aims to represent the vast majority of practical CG materials.
- NVIDIA MDL is designed for portable physically based material definitions and exposes APIs to inspect material structure.
- Substance 3D Painter supports dynamic material layering and smart masks adapted to mesh topology.

Conclusion:

The rendering ecosystem already has mature patterns for layered materials and masks. UTDG does not need to invent shader behavior from scratch.

### C. Prompt-driven texture generation already exists

Relevant evidence:

- Adobe Substance 3D Sampler supports Text-to-Texture and Text-to-Pattern workflows from prompts.

Conclusion:

Prompt-driven material authoring is already real. The opportunity for UTDG is to make it semantically grounded and locally assignable, not just globally generative.

## 5. The Right Conceptual Model

The standard should separate four concerns.

### 1. Base material concept

Example:

- `brick`
- `aged brick`
- `fired red brick wall`

Stored in:

- UTDG concept or archetype layer

### 2. Modifier concept

Example:

- `wet`
- `mossy`
- `dusty`
- `charred`
- `frosted`

Stored in:

- UTDG modifier archetype layer

### 3. Spatial applicability

Example:

- painted mask
- vertex color channel
- texture paint mask
- primvar or geomprop
- world-space proximity to actor
- distance from impact point

Stored in:

- scene/geometry binding layer, not purely in canonical UTDG concept semantics

### 4. Render realization

Example:

- roughness drops
- darkening of albedo
- specular response changes
- normal blend from water film
- puddle edge breakup

Stored in:

- material/shader graph layer

## 6. Proposed UTDG Extension For This Use Case

To support prompt painting, UTDG should introduce or formalize three additional entity families.

### A. Modifier Archetype

Represents a reusable surface-state modifier.

Examples:

- wet
- muddy
- sooty
- moss-covered
- rain-darkened

Required fields:

- `modifierType`
- `compatibleBaseTypes`
- `visualEffects`
- `parameterHints`
- `evidenceRefs`

### B. Localized Surface Effect

Represents a compositional instruction:

- apply modifier X to base material Y under condition Z

Examples:

- wet applied to brick
- moss applied to stone
- burn residue applied to plaster

Required fields:

- `baseRef`
- `modifierRef`
- `blendMode`
- `priority`
- `compatibilityConfidence`

### C. Spatial Binding Descriptor

Represents how the effect is targeted in space.

Examples:

- vertex color red channel
- texture mask
- world-space sphere falloff
- object proximity
- impact-decay field

Required fields:

- `bindingType`
- `carrier`
- `channel`
- `falloff`
- `resolutionClass`

## 7. Proposed Data Flow

### Step 1: Prompt parse

User or system issues:

- `wet brick`
- `wet brick around this doorway`
- `wet brick in the vicinity of the splashing object`

### Step 2: UTDG semantic resolution

Resolve:

- base archetype: `brick`
- modifier archetype: `wet`

Check:

- compatibility
- context rules
- preferred render mapping

### Step 3: Spatial binding selection

Choose a carrier:

- vertex color if low-resolution local paint is acceptable
- texture color / virtual texture if higher resolution is needed
- MaterialX geomprop / OpenUSD primvar if pipeline-native
- world-space proximity field if driven by location or actor

### Step 4: Shader graph realization

Compile or bind:

- layered material override
- mask input
- modifier parameters

### Step 5: Runtime or authoring interaction

Paint or project the effect in editor or at runtime.

## 8. Example: `wet brick`

### Canonical UTDG side

Concepts:

- `brick`
- `wet`
- `wet brick` as a localized effect recipe or archetype if repeated enough

Suggested canonical semantics:

- `wet` reduces roughness
- may increase darkening
- may increase reflectivity
- may add pooled or streaked breakup

### Scene binding side

Examples:

- paint red vertex channel where wetness should appear
- bind effect to a world-space sphere around a leaking pipe
- drive mask by a splash simulation or gameplay event

### Material realization side

Potential targets:

- Unreal material using `VertexColor` or texture color masks
- MaterialX graph using geomprops or primvar-like geometric properties
- OpenUSD / UsdShade binding to local geometry collections or material variants

## 9. Important Technical Constraint

Vertex painting is only one carrier.

It should not be the only one the standard assumes.

### Why

Vertex painting has known limits:

- resolution depends on mesh density
- channels are limited
- per-instance behavior may differ by engine
- Nanite and similar workflows may prefer texture-color or other paint paths

Research-backed implication:

The standard should define a generic `spatial binding` model and let vertex colors be one implementation.

## 10. What The Standard Should Capture

### Canonical UTDG should capture

- what `brick` is
- what `wet` means as a modifier
- whether `wet brick` is valid
- what visual parameters or material properties are typically affected
- provenance and confidence

### Derived scene/material layer should capture

- where the effect is painted
- whether the carrier is vertex color, texture mask, or proximity field
- how the shader blends the override

This separation is important.

The semantic graph should remain reusable across engines and pipelines.

## 11. Why MaterialX / OpenPBR / MDL Matter Here

These standards give the proposal a portable render target.

### MaterialX

Useful because it already represents:

- shading networks
- patterns
- texturing
- nested materials
- geometric assignments
- custom geometry properties

### OpenPBR

Useful because it gives a standardized physically based surface model for many common materials.

### MDL

Useful because it allows material definitions to be inspected and rendered across supporting applications.

### OpenUSD / UsdShade

Useful because it provides material binding and collection-based assignment at scene level.

## 12. Recommended Standard Addition

If UTDG wants to support this use case explicitly, add a v1.1 concept like:

`LocalizedMaterialIntent`

Suggested fields:

- `baseMaterialRef`
- `modifierRef`
- `spatialBindingRef`
- `renderIntent`
- `parameterOverrides`
- `sourceRefs`

This should be derived or workflow-facing, not necessarily part of the smallest canonical core.

## 13. Product Opportunities

This use case opens several product directions:

### 1. Prompt paint brush

User paints:

- `wet`
- `mossy`
- `dirty`

onto a known base material

### 2. Context-aware automatic painting

System applies:

- `wet brick` near drains
- `moss stone` on north-facing shaded surfaces
- `dusty wood` near floor contact zones

### 3. Runtime event-driven material states

Examples:

- explosion scorches wall
- rain wets surfaces
- blood, mud, soot, frost, leaks, splash zones

### 4. Semantic authoring for non-technical users

Instead of painting channels manually, the user paints intent.

That is a strong product distinction.

## 14. Recommendation

This is a valid and high-value UTDG use case.

The main rule for making it durable is:

"Model semantic material intent in UTDG, but model spatial carriers and shader realization as separate layers."

That gives you a standards-aligned path:

- UTDG for meaning
- vertex colors / masks / primvars for locality
- MaterialX / OpenPBR / MDL / engine graphs for rendering

## 15. Sources

- Unreal Engine vertex color painting and texture blending docs:
  - https://dev.epicgames.com/documentation/en-us/unreal-engine/paint-vertex-colors-tool-in-unreal-engine
  - https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-a-texture-blended-material-for-vertex-weights-painting-in-unreal-engine
  - https://dev.epicgames.com/documentation/en-us/unreal-engine/constant-material-expressions-in-unreal-engine
- Blender vertex paint and color attributes:
  - https://docs.blender.org/manual/en/4.1/sculpt_paint/vertex_paint/introduction.html
  - https://docs.blender.org/manual/en/latest/render/shader_nodes/input/vertex_color.html
- MaterialX:
  - https://materialx.org/
  - https://materialx.org/Specification.html
  - https://materialx.org/docs/api/class_geom_prop_def.html
- OpenUSD / UsdShade material assignment:
  - https://openusd.org/docs/UsdShade-Material-Assignment.html
- OpenPBR:
  - https://github.com/AcademySoftwareFoundation/OpenPBR
- NVIDIA MDL:
  - https://developer.nvidia.com/rendering-technologies/mdl-sdk
- Adobe Substance 3D Painter and Sampler:
  - https://helpx.adobe.com/substance-3d-painter/features/dynamic-material-layering.html
  - https://helpx.adobe.com/substance-3d-painter/features/smart-materials-and-masks.html
  - https://helpx.adobe.com/substance-3d-sampler/features-and-workflows/generative-workflows.html

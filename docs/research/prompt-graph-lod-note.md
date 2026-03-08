# Prompt Graph LoD Note

_Last updated: 2026-03-07_

## 1. Purpose

This note evaluates whether Prompt Spaghetti graphs should support level-of-detail behavior for text semantics.

The short answer is yes.

## 2. Core Idea

A prompt graph should not always emit the same textual detail regardless of view distance or influence.

Instead:

- far away areas should resolve to coarse semantic language
- mid-range areas should resolve to more specific descriptors
- close-up areas should resolve to the most granular text and control detail

That is a good fit for both rendering logic and generative control.

## 3. Why This Makes Sense

This is directly analogous to established graphics patterns:

- geometry LOD
- mipmaps
- proxy versus render representations
- hierarchical scene description

The same principle can apply to semantic text.

## 4. Recommended Model

Each prompt graph node or semantic cluster can carry multiple semantic resolutions:

- `lod0`
  coarse concept
  Example: `brick wall`
- `lod1`
  mid detail
  Example: `rain-darkened brick wall`
- `lod2`
  fine detail
  Example: `rain-darkened brick wall with reflective mortar, localized runoff streaks, mineral staining`

The active level should be selected by:

- camera distance
- screen coverage
- influence strength
- narrative priority
- task mode

## 5. Selection Logic

Suggested control inputs:

- `distanceToCamera`
- `screenCoverage`
- `semanticInfluence`
- `narrativePriority`
- `maxPromptBudget`

This lets the graph degrade gracefully instead of dropping meaning arbitrarily.

## 6. Why This Is Better Than Plain Prompt Compression

Normal prompt compression usually throws away detail in a flat way.

Prompt-graph LoD is better because:

- it preserves the right detail for the current shot
- it aligns with spatial influence
- it stays tied to world semantics
- it can promote detail when the camera moves closer

## 7. Relationship To Existing Work

There is strong adjacent prior art even if this exact prompt-graph formulation is not standard.

### Graphics-side analogies

- Three.js `LOD` switches representations by camera distance.
- OpenGL mipmaps use progressively lower-resolution texture representations selected during sampling.
- OpenUSD separates `proxy` and `render` purpose for lightweight versus full-fidelity scene data.

### Vision-language analogies

- coarse-to-fine image captioning work shows descriptions can be built hierarchically from global to local detail
- patch-based caption enhancement work shows local regions improve fine-grained textual detail
- Prompt-to-Prompt shows that spatial layout and word influence are coupled through attention maps

## 8. Best Architectural Framing

This should be treated as:

- `semantic level of detail`
or
- `hierarchical prompt resolution`

not just prompt shortening.

## 9. Fit With Metagrinder

This fits naturally into:

- world semantic field queries
- render text packet generation
- reverse prompt analysis
- perspective witness rendering

The same scene can emit different semantic packets for:

- a wide shot
- a medium shot
- a close-up

without changing the underlying world meaning.

## 10. Recommendation

Add LoD to prompt graphs.

But implement it as hierarchical semantic resolution with explicit thresholds and budgets, not as a naive text cutoff.

## 11. Source Notes

Primary adjacent sources reviewed:

- Three.js `LOD` documentation
- OpenGL texture and mipmap level-of-detail documentation
- OpenUSD `purpose` and `proxy` / `render` guidance
- coarse-to-fine and patch-enhanced image captioning papers
- Prompt-to-Prompt cross-attention control

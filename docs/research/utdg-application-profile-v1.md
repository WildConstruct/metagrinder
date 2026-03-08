# UTDG Application Profile v1

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a minimal application profile for the Universal Texture Description Graph (UTDG).

Its purpose is to make UTDG implementable without inventing a fully bespoke ontology.

The design principle is:

"Reuse external standards for reference semantics, add only the minimum product-specific fields needed for texture discovery, provenance, compatibility, and prompt generation."

## 2. Scope

This is not a full ontology specification.

It is a practical profile for v1 that covers:

- canonical concepts
- archetypes
- provenance
- rights
- review state
- compatibility relations
- PSG-derived prompt surfaces

This document also includes a proposed `v1.1` extension for localized material intent and environmental effects.

## 3. Layer Model

### Layer 1: External authority and source layer

Examples:

- Getty AAT
- institutional object IDs
- Europeana record IDs
- Wikidata QIDs where useful

Role:

- normalization targets
- source authority references
- synonym control

### Layer 2: Canonical UTDG reference layer

Stores:

- normalized UTDG concepts
- archetypes
- compatibility rules
- provenance references
- rights state
- review state

### Layer 3: Derived PSG layer

Stores:

- prompt synthesis graphs
- prompt mutation graphs
- project-local research graphs
- prompt browser collections

Role:

- authoring
- execution
- creative generation

## 4. Design Principles

1. Identifier-first where possible.
2. Provenance-first always.
3. Rights attached per record.
4. Canonical UTDG is reference-oriented, not execution-oriented.
5. PSG is execution-oriented, not the canonical reference graph.
6. Archetypes are first-class.
7. Free-text is allowed for staging but should not be the only canonical representation when authority IDs exist.

## 5. Core UTDG Entity Types

### 5.1 Concept

Represents a normalized texture/material-related concept.

Examples:

- linen
- velvet
- brocade
- plain weave
- indigo dye

Primary standards mapping:

- `skos:Concept`

Minimum fields:

- `id`
- `prefLabel`
- `altLabels`
- `definition`
- `conceptType`
- `externalIds`
- `reviewStatus`
- `rightsProfile`

### 5.2 Archetype

Represents a reusable, synthesized, prompt-relevant canonical pattern built from one or more source records or concepts.

Examples:

- coarse homespun linen
- silk velvet with metallic brocade
- weathered vegetable-tanned leather

Standards alignment:

- modeled as a UTDG-specific specialization of a concept-like node
- concept semantics still align to `skos:Concept`

Why it is separate:

- archetypes are synthesis objects
- they are not always equivalent to one institutional record or one authority term

Minimum fields:

- `id`
- `label`
- `summary`
- `sourceConceptRefs`
- `evidenceRefs`
- `texturalQualities`
- `usageContexts`
- `reviewStatus`

### 5.3 Source Record Reference

Represents a cited external record or internal evidence-bearing source.

Examples:

- museum object record
- catalog entry
- public-domain image record

Standards alignment:

- `prov:Entity`
- selected `CIDOC CRM` / `Linked Art` object patterns where needed

Minimum fields:

- `id`
- `sourceSystem`
- `sourceRecordId`
- `sourceUrl`
- `title`
- `rightsStatement`
- `retrievedAt`

### 5.4 Evidence Assertion

Represents a claim backed by a source excerpt or observation.

Examples:

- "described as silk velvet with metal thread"
- "classified as woven linen"

Standards alignment:

- `prov:Entity` for the assertion payload
- provenance edges using `prov:wasDerivedFrom`

Minimum fields:

- `id`
- `assertionText`
- `confidence`
- `evidenceSnippet`
- `sourceRef`
- `extractionMethod`

### 5.5 Compatibility Rule

Represents compatibility or incompatibility between concepts or archetypes.

Examples:

- linen often layered with wool
- silk incompatible with peasant-garment archetype in a strict medieval setting

Standards alignment:

- UTDG-specific relation entity
- may also be represented as edge metadata

Minimum fields:

- `id`
- `ruleType`
- `subjectRef`
- `objectRef`
- `context`
- `confidence`
- `reason`
- `evidenceRefs`

### 5.6 Prompt Surface

Represents a derived prompt-use asset, not a canonical reference concept.

Examples:

- prompt phrase
- prompt template
- weighted prompt fragment

Alignment:

- stored in PSG or PSG-derived artifacts
- linked back to UTDG records through IDs and lineage metadata

## 6. Core Relationship Types

These should exist in canonical UTDG even if the storage implementation is not RDF-native.

### Concept relationships

- `broader`
  Alignment: `skos:broader`

- `narrower`
  Alignment: `skos:narrower`

- `related`
  Alignment: `skos:related`

- `sameAsExternal`
  Alignment: `owl:sameAs`-like semantics or product-specific external mapping

### Provenance relationships

- `wasDerivedFrom`
  Alignment: `prov:wasDerivedFrom`

- `wasGeneratedBy`
  Alignment: `prov:wasGeneratedBy`

- `wasAttributedTo`
  Alignment: `prov:wasAttributedTo`

- `usedSource`
  Product-specific readable alias for source use

### Texture/material relationships

- `hasVisualQuality`
- `usesTechnique`
- `associatedWithEra`
- `associatedWithRegion`
- `compatibleWith`
- `incompatibleWith`
- `oftenLayeredWith`
- `variantOf`
- `archetypeOf`

These are product-specific but should preserve external identifier links where possible.

## 7. Standards Mapping Summary

### SKOS

Use for:

- concept identity
- preferred labels
- alternate labels
- hierarchical and associative concept relationships

UTDG fields:

- `prefLabel` -> `skos:prefLabel`
- `altLabels[]` -> `skos:altLabel`
- `definition` -> `skos:definition`
- `broader[]` -> `skos:broader`
- `narrower[]` -> `skos:narrower`
- `related[]` -> `skos:related`

### PROV-O

Use for:

- source lineage
- extraction lineage
- contributor attribution
- package lineage

UTDG fields:

- `derivedFrom` -> `prov:wasDerivedFrom`
- `generatedByAgent` -> `prov:wasGeneratedBy`
- `contributorId` -> `prov:wasAttributedTo`
- `sourceEntityRef` -> `prov:Entity`

### CIDOC CRM / Linked Art patterns

Use for:

- object-like source references
- cultural-heritage context
- event-like provenance when needed

Recommendation:

Do not fully implement CIDOC CRM v1.

Borrow patterns selectively for:

- object references
- place and period context
- event-like provenance or production context

### Getty AAT

Use for:

- concept normalization targets
- materials
- techniques
- styles
- object and culture-adjacent controlled vocabulary support

UTDG field:

- `externalIds.gettyAatId`

### Wikidata

Use for:

- additional external linking
- cross-domain reconciliation

Guardrail:

Use as optional supporting identity, not the primary source of texture truth.

## 8. Identifier Policy

### Canonical entity IDs

Use product-controlled IDs for internal stability:

- `utdg:concept:*`
- `utdg:archetype:*`
- `utdg:source:*`
- `utdg:evidence:*`
- `utdg:rule:*`

### External IDs

Store as explicit mappings, not replacements for internal IDs.

Minimum external ID slots:

- `gettyAatId`
- `wikidataQid`
- `institutionRecordId`
- `europeanaRecordId`

## 9. Rights and Review Fields

Every canonical UTDG entity should carry:

- `rightsProfile`
- `reviewStatus`
- `provenanceRefs[]`
- `evidenceRefs[]`
- `sourceRefs[]`

Suggested values:

- `rightsProfile`: see rights matrix document
- `reviewStatus`: `draft`, `staged`, `approved`, `merged`, `restricted`, `rejected`

## 10. PSG Bridge Contract

PSG-derived artifacts should not duplicate all canonical semantics.

Instead they should carry:

- `utdgRefs[]`
- `sourceRefs[]`
- `archetypeRefs[]`
- `lineage.packageId`

### Example derived prompt surface

A `WeightedChoice` node in PSG might reference:

- one or more `utdg:archetype:*`
- one or more `utdg:concept:*`
- one or more source evidence IDs

This preserves the bridge without forcing PSG to become the canonical ontology store.

## 11. Minimal Canonical Entity Shapes

### Concept shape

```json
{
  "id": "utdg:concept:linen",
  "entityType": "Concept",
  "prefLabel": "linen",
  "altLabels": ["flax linen"],
  "definition": "A textile material made from flax fibers.",
  "conceptType": "material",
  "externalIds": {
    "gettyAatId": "example"
  },
  "provenanceRefs": ["utdg:evidence:123"],
  "rightsProfile": "attribution-required",
  "reviewStatus": "approved"
}
```

### Archetype shape

```json
{
  "id": "utdg:archetype:coarse-homespun-linen",
  "entityType": "Archetype",
  "label": "coarse homespun linen",
  "summary": "A rough, breathable linen archetype associated with lower-status garments.",
  "sourceConceptRefs": ["utdg:concept:linen"],
  "texturalQualities": ["coarse", "matte", "breathable"],
  "evidenceRefs": ["utdg:evidence:456"],
  "rightsProfile": "reference-only",
  "reviewStatus": "staged"
}
```

## 12. What This Profile Deliberately Defers

- full RDF serialization rules
- full CIDOC CRM implementation
- image-feature embeddings
- procedural texture parameter schema
- complete event modeling
- complete institution-specific field mappings

Those can come later.

## 13. v1.1 Extension: Localized Material And Environmental Effects

This extension formalizes the use cases described in:

- localized prompt-driven material overrides
- prompt painting
- smart painter
- rain, grime, moss, soot, snow, and other environmental effects

The goal is to let UTDG express semantic intent and response behavior without forcing scene-specific geometry data into the canonical core.

### 13.1 SurfaceResponseProfile

Purpose:

- describe how a base material responds to a modifier or environmental effect

Examples:

- brick response to rain
- plaster response to dampness
- wood response to soot

Suggested fields:

- `id`
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
- `reviewStatus`

### 13.2 EnvironmentalEffectController

Purpose:

- represent a reusable master controller for an environmental process

Examples:

- rain controller
- snow controller
- grime controller
- leak controller

Suggested fields:

- `id`
- `effectType`
- `directionVector`
- `intensity`
- `falloffModel`
- `gravityInfluence`
- `accumulationBias`
- `evaporationRate`
- `globalOverrides`
- `reviewStatus`

### 13.3 InfluenceField

Purpose:

- describe the local carrier that modulates where an effect applies

Examples:

- vertex color channel
- UV mask
- texture mask
- world-space field
- procedural cavity field

Suggested fields:

- `id`
- `fieldType`
- `carrier`
- `channel`
- `strength`
- `invert`
- `resolutionClass`

Guardrail:

- `InfluenceField` is workflow-facing and scene-facing
- canonical UTDG should describe the field type, not store scene-specific raw paint data

### 13.4 LocalizedMaterialIntent

Purpose:

- express a localized material override or modifier composition

Examples:

- wet brick near leaking pipe
- mossy stone in shaded region
- scorched plaster near blast point

Suggested fields:

- `id`
- `baseMaterialRef`
- `modifierRef`
- `spatialBindingRef`
- `renderIntent`
- `parameterOverrides`
- `sourceRefs`
- `reviewStatus`

### 13.5 LocalizedEnvironmentalIntent

Purpose:

- express an environment-driven effect tied to base material, controller, and local influence

Examples:

- rain-reactive brick wall
- dirt accumulation on lower wood siding
- snow cling on roof tiles

Suggested fields:

- `id`
- `baseMaterialRef`
- `effectControllerRef`
- `influenceFieldRef`
- `responseProfileRef`
- `localOverrides`
- `priority`
- `reviewStatus`

### 13.6 Extension boundary

Canonical UTDG should store:

- effect semantics
- response semantics
- compatible modifier logic

Derived scene/workflow layers should store:

- raw world normals
- raw vertex paint
- texture masks
- runtime controller state

This preserves portability across engines and tools.

## 14. Recommendation

Use this profile as the minimum semantic contract for v1.

If implementation remains consistent with this shape, UTDG will:

- stay interoperable
- preserve provenance
- support controlled growth
- remain compatible with PSG-derived prompt systems

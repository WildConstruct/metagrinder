# Research Parser + UTDG System Map

_Last updated: 2026-03-07_

## 1. Purpose

This document unifies the two earlier proposals:

- the Deep Research Parser as a PSG-native research package generator
- the Metagrinder as a dual-output system that can also generate staged UTDG contributions

Its job is to show:

- one shared pipeline
- the canonical artifacts produced at each stage
- where private, staged, and public data diverge
- which agents and product surfaces own which parts of the workflow

## 2. System Thesis

One ingestion workflow should power two outcomes:

1. immediate user value through PSG research and prompt assets
2. long-term ecosystem value through staged UTDG enrichment

The same parse should not be run twice with separate mental models.

Instead:

- source intake happens once
- extraction happens once
- classification branches into multiple collections
- user-facing assets and UTDG contribution candidates are packaged separately but linked

### Naming

Informal product language:

- the `Metagrinder` is the ingestion and transformation system
- a PSG project or packaged PSG research output produced by the Metagrinder can be called a `metaball`

Practical guidance:

- use `metaball` as product language or internal shorthand
- continue using explicit artifact names like `research package`, `PSG collection`, and `UTDG submission package` in schemas and contracts

## 3. Top-Level System Model

### Input

- pasted research prompt
- research dossier
- notes bundle
- museum/object descriptions
- fabric/material references
- production briefs

### Shared processing core

- ingest
- segment
- extract
- classify
- normalize
- score
- package
- review

### Output A: user package

- PSG-native research collections
- prompt synthesis graphs
- prompt mutation surfaces
- reusable project assets

### Output B: contribution package

- staged UTDG candidate records
- provenance graph or evidence graph
- review metadata
- rights and confidence metadata

## 4. Canonical Artifact Families

### A. Source intake artifact

Purpose:
Represent exactly what the user supplied and how it was segmented.

Suggested files:

- `source-map.psg`
- `intake-metadata.json`

### B. Research package

Purpose:
Support the user's own graph authoring and prompt workflows.

Suggested files:

- `claims-and-evidence.psg`
- `concept-clusters.psg`
- `prompt-synthesis.psg`
- `prompt-mutations.psg`
- `research-package.json`

### C. UTDG contribution package

Purpose:
Represent candidate shared knowledge derived from the same parse.

Suggested files:

- `utdg-candidates.json`
- `utdg-evidence.psg`
- `utdg-submission.json`

### D. Canonical UTDG records

Purpose:
Store approved shared texture/material knowledge.

Suggested storage surface:

- canonical UTDG service or datastore
- not raw user packages

## 5. State Boundaries

The system needs hard state boundaries.

### Boundary 1: Private

Visible only to the user or team.

Contains:

- source text
- private research graphs
- prompt assets
- unsubmitted UTDG candidates

### Boundary 2: Staged

Reviewable but not yet canonical.

Contains:

- submitted UTDG candidates
- provenance and evidence
- normalization suggestions
- duplicate detection notes
- rights review state

### Boundary 3: Canonical shared

Public or licensed shared UTDG records.

Contains:

- approved normalized nodes
- approved edges
- archetypes
- source citations and visible review state

## 6. Shared Pipeline Stages

### Stage 1: Ingest

Goal:
Capture the raw source and identify basic structure.

Outputs:

- source chunks
- section boundaries
- source metadata

Owner:

- research parser agent

### Stage 2: Extract

Goal:
Pull claims, entities, concepts, texture/material references, quotes, and constraints from the source.

Outputs:

- extracted findings
- evidence snippets
- uncertainty markers

Owner:

- extraction agent

### Stage 3: Classify

Goal:
Route extracted material into:

- research graph families
- prompt-material graph families
- UTDG-eligible record families

Outputs:

- typed node candidates
- edge candidates
- provenance links

Owner:

- classification agent

### Stage 4: Normalize

Goal:
Turn raw extracted material into stable reusable forms.

Examples:

- collapse synonyms
- propose canonical labels
- suggest archetypes
- map material/style/technique categories

Outputs:

- normalized user-facing concepts
- normalized UTDG candidates

Owner:

- normalization agent

### Stage 5: Score

Goal:
Assess trust and publishability.

Scoring dimensions:

- extraction confidence
- provenance completeness
- normalization confidence
- rights readiness
- duplication risk

Outputs:

- review annotations
- candidate tiers

Owner:

- validation agent

### Stage 6: Package

Goal:
Emit bounded artifacts for user and platform.

Outputs:

- research package
- UTDG contribution package

Owner:

- packaging agent

### Stage 7: Review

Goal:
Let humans or trusted agents approve, suppress, revise, or promote records.

Outputs:

- approved private assets
- staged submissions
- promoted canonical UTDG records

Owner:

- user
- curator
- optional reputation-based reviewer agent

## 7. Shared Data Model

### Common metadata all artifacts should preserve

- `package_id`
- `source_input_ids`
- `parser_version`
- `strategy_version`
- `created_at`
- `confidence_summary`
- `review_status`
- `provenance_refs`

### Common metadata all extracted nodes should preserve

- source references
- evidence snippets
- inferred vs quoted distinction
- confidence
- creator agent or contributor

## 8. User-Facing Product Surfaces

### 1. Research Intake

Where source material enters the system.

### 2. Collection Navigator

Where users browse source, claims, concepts, and prompt collections.

### 3. Prompt Browser

Where users rotate through prompt families and prompt variants.

### 4. Mutation Lab

Where prompt variants are blended, constrained, and remixed.

### 5. UTDG Candidate Review

Where users inspect extracted material/texture candidates.

### 6. Contribution Queue

Where staged submissions are reviewed and promoted.

### 7. UTDG Explorer

Where approved shared records are searched and browsed.

## 9. Agent Responsibilities

### Research parser agent

- segment source
- preserve source coverage
- create research package skeleton

### Prompt synthesis agent

- build prompt-ready PSG collections
- identify prompt families and mutation opportunities

### UTDG extraction agent

- find material/texture/style/technique candidates
- create structured candidate records

### Provenance agent

- attach citations, snippets, and source lineage

### Rights and policy agent

- classify likely rights status
- mark private-only vs stageable vs publishable

### Curator agent

- deduplicate
- compare against existing UTDG
- recommend promote/merge/reject actions

## 10. Canonical vs Derived State

### Canonical for user work

- PSG collections
- package manifests

### Canonical for UTDG contribution flow

- staged UTDG candidate records
- canonical UTDG records after review

### Derived

- editor wrappers
- preview state
- prompt browser projections
- search indexes
- vector embeddings
- recommendation caches

## 11. Core Product Rules

1. One source parse can feed multiple outputs.
2. User package and UTDG contribution package must remain linked but separate.
3. No direct write from user parse into canonical UTDG.
4. Provenance, confidence, and rights metadata are mandatory for contribution packages.
5. Mutation and synthesis outputs must retain lineage to source concepts.
6. Canonical UTDG should optimize for reusable archetypes and relationships, not raw note accumulation.

## 12. Monetization Boundary

### Free layer

- private parsing for personal use
- non-commercial access to approved public UTDG records
- contribution submission

### Commercial layer

- commercial rights to UTDG-backed usage
- organization/team submission workflows
- advanced curation and validation tooling
- ecosystem integrations and pipeline automation

The system should monetize commercial usage and workflow value, not basic community read access.

## 13. Review States

Suggested shared review vocabulary:

- `private`
- `draft`
- `staged`
- `needs_review`
- `approved`
- `merged`
- `rejected`
- `restricted`

## 14. Failure Modes To Design Against

### 1. Node soup

The parse creates lots of disconnected nodes without useful packaging.

### 2. Rights leakage

Private or restricted material is accidentally pushed to staging or public.

### 3. Canonical pollution

Low-confidence or duplicate UTDG candidates enter the shared graph.

### 4. User burden

Contribution review feels like extra unpaid labor.

### 5. Architecture sprawl

Too many artifact shapes cause PSG and UTDG confusion.

## 15. Recommended Near-Term Implementation Order

1. shared intake and segmentation model
2. research package generation
3. UTDG candidate extraction in private mode
4. staged submission package
5. curator review workflow
6. canonical UTDG explorer and query integration

## 16. What This System Is

- a shared ingestion pipeline
- a PSG-native research and prompt asset generator
- a staged UTDG contribution engine
- a bridge between private creative work and shared texture commons

## 17. What This System Is Not

- a generic chat feature
- a direct-to-public crowd wiki with no review
- a replacement for canonical UTDG governance
- a justification for mixing project-state PSG and source-fragment PSG again

## 18. Recommendation

Treat the Metagrinder as the intake and transformation backbone for both:

- user-facing research and prompt workflows
- staged UTDG commons growth

The central design principle should be:

"Shared pipeline, separate packages, hard review boundaries."

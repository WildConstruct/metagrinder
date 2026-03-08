# Rainy Alley Phase 1 Runtime Architecture

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the minimal runtime architecture for the Rainy Alley prototype.

It is intended to answer:

- what modules exist
- what data flows between them
- what is computed at runtime versus stored
- what the first prototype should actually do

## 2. Goal

Build the narrowest runtime that can:

1. load a metaball
2. load its world semantic field
3. query visible semantics from a camera
4. generate a render text packet
5. generate a camera pass manifest
6. generate a Luma-ready conditioning payload

## 3. Runtime Boundary

### In scope

- data loading
- camera query
- ranking
- text packet generation
- control-bundle manifest generation
- adapter payload generation

### Out of scope

- full world reconstruction
- online UTDG publishing
- advanced occlusion solving
- complex shader generation
- multi-shot state persistence

## 4. Runtime Modules

### A. Metaball Loader

Responsibilities:

- load `spicy-metaball.json`
- resolve file references
- load linked package artifacts

Inputs:

- metaball manifest path

Outputs:

- resolved runtime context

### B. Semantic Field Loader

Responsibilities:

- load `world-semantic-field.json`
- validate schema
- expose spatial records

Outputs:

- `WorldSemanticField`

### C. Camera Query Engine

Responsibilities:

- apply frustum eligibility
- estimate visibility
- compute scores
- rank records

Inputs:

- `WorldSemanticField`
- `CameraQueryContract`
- camera transform and projection

Outputs:

- visible records
- ranked records
- debug score data

### D. Render Text Packet Builder

Responsibilities:

- bucket ranked records
- compress them into readable semantic context

Inputs:

- ranked records

Outputs:

- `RenderTextPacket`

### E. Camera Pass Builder

Responsibilities:

- assemble:
  - render text packet ID
  - input artifact references
  - output artifact references
  - query config
  - task mode

Outputs:

- `CameraPassManifest`

### F. Model Payload Adapter

Responsibilities:

- map runtime outputs into a downstream model contract

Phase 1 target:

- Luma adapter payload

Outputs:

- `ModelConditioningPayload`
- `LumaAdapterContract`

## 5. Stored Artifacts vs Runtime Computation

### Stored in metaball / fixtures

- metaball manifest
- world semantic field
- camera query config
- optional prebuilt render text packet examples

### Computed at runtime

- visible record set
- ranked record set
- render text packet
- camera pass manifest
- adapter payload

## 6. Phase 1 Data Flow

### Step 1

Load metaball manifest.

### Step 2

Resolve world semantic field path.

### Step 3

Load field records.

### Step 4

Load camera query config.

### Step 5

Run camera query engine against:

- semantic point
- semantic region
- semantic volume

### Step 6

Build render text packet from ranked records.

### Step 7

Build camera pass manifest.

### Step 8

Build model-conditioning payload and Luma adapter contract.

## 7. Required Inputs For Phase 1

### Mandatory

- metaball manifest
- world semantic field
- camera query config
- camera metadata

### Optional but recommended

- witness render path
- depth pass path
- world normal pass path

These can be treated as referenced artifacts even if the runtime does not process them deeply yet.

## 8. Camera Query Simplification

For Phase 1, use a simplified visibility model:

- frustum inclusion by bounds or point projection
- no advanced occlusion required
- score based on:
  - importanceWeight
  - narrativeWeight
  - visibilityWeight
  - simple distance bias

This is enough to validate the concept.

## 9. Recommended File Outputs

Phase 1 runtime should emit:

- `generated-render-text-packet.json`
- `generated-camera-pass-manifest.json`
- `generated-model-conditioning-payload.json`
- `generated-luma-adapter-contract.json`

## 10. Success Criteria

The architecture is successful if:

1. runtime can load and validate fixture data
2. runtime can rank visible semantic records deterministically
3. packet output is readable and relevant
4. adapter payload is coherent for downstream use

## 11. Recommended Next Implementation Step

Implement a single script or service entrypoint:

- `run-rainy-alley-prototype`

It should:

- load fixtures
- run the camera query
- emit the four generated outputs

That is the shortest path from concept to proof.

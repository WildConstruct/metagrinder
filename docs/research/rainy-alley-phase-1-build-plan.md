# Rainy Alley Phase 1 Build Plan

_Last updated: 2026-03-07_

## 1. Purpose

This document converts the Rainy Alley prototype scope into a short execution plan.

It is intended to answer:

- what gets built first
- what can be deferred
- what must be proven by the end of Phase 1

## 2. Phase 1 Objective

Build the smallest working runtime that can:

1. load a metaball and linked artifacts
2. load a world semantic field
3. run a deterministic camera query
4. emit a render text packet
5. emit a camera pass manifest
6. emit a model-conditioning payload and Luma adapter payload

## 3. Non-Goals

Phase 1 does not attempt to solve:

- full semantic world authoring UI
- reconstruction from user images
- advanced occlusion solving
- production render integration
- canonical UTDG publishing
- generalized multi-model routing

## 4. Deliverables

### Required

- validated Metagrinder contracts
- fixture-backed rainy alley prototype data
- one runtime entrypoint
- four generated output files
- one operator-facing readme or usage note

### Generated outputs

- `generated-render-text-packet.json`
- `generated-camera-pass-manifest.json`
- `generated-model-conditioning-payload.json`
- `generated-luma-adapter-contract.json`

## 5. Implementation Phases

### Phase A: Contract Stability

Goal:

- ensure fixture and schema contracts are stable enough to code against

Tasks:

- keep `validate:metagrinder` green
- lock fixture names and required fields
- avoid adding new conceptual entities unless needed by runtime

Exit criteria:

- runtime can safely assume fixture shapes are stable

### Phase B: Runtime Skeleton

Goal:

- create a single script that loads the metaball and linked files

Tasks:

- load `spicy-metaball.json`
- resolve referenced artifact paths
- load world semantic field and camera query config
- validate loaded inputs

Exit criteria:

- script can print a resolved runtime context without errors

### Phase C: Camera Query

Goal:

- rank visible semantic records deterministically

Tasks:

- implement point/region/volume eligibility checks
- apply simplified visibility rules
- compute ranking score from:
  - importance
  - narrative weight
  - visibility weight
  - distance bias
- return ranked records plus debug score details

Exit criteria:

- query returns predictable ordering for the rainy alley camera

### Phase D: Output Builders

Goal:

- turn ranked records into downstream artifacts

Tasks:

- build render text packet from top-ranked records
- build camera pass manifest from input and output references
- build model-conditioning payload
- build Luma adapter payload

Exit criteria:

- four generated files are emitted and validate against contracts

### Phase E: Demo Readiness

Goal:

- make the prototype understandable to non-implementation reviewers

Tasks:

- document how to run the prototype
- describe expected output from Shot A
- capture one example before/after packet explanation

Exit criteria:

- product/agent reviewers can run and inspect the slice without reverse-engineering code

## 6. Runtime Sequence

1. load metaball manifest
2. resolve linked file paths
3. validate loaded artifacts
4. load camera metadata
5. run camera query
6. rank visible records
7. build render text packet
8. build camera pass manifest
9. build model-conditioning payload
10. build Luma adapter payload
11. validate generated outputs
12. write generated files

## 7. Dependencies

### Hard dependencies

- [metagrinder.ts](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/packages/core/types/metagrinder.ts)
- [metagrinder.runtime.js](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/packages/core/types/metagrinder.runtime.js)
- [spicy-metaball.json](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/packages/core/tests/fixtures/metagrinder/spicy-metaball.json)
- [world-semantic-field.json](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/packages/core/tests/fixtures/metagrinder/world-semantic-field.json)

### Soft dependencies

- witness render image
- optional depth pass
- optional world normal pass

## 8. Risks

### Risk 1: Packet quality is too generic

Mitigation:

- keep the rainy alley field small and semantically strong
- prefer fewer high-signal records over broad summaries

### Risk 2: Camera query is too weak

Mitigation:

- expose debug score output early
- keep scoring simple and deterministic before adding complexity

### Risk 3: Adapter payload is too speculative

Mitigation:

- treat the Luma payload as a structured prep contract, not a full production integration

## 9. Definition of Done

Phase 1 is done when:

1. a single script generates the four target outputs from the rainy alley fixtures
2. generated outputs validate against the Metagrinder contracts
3. the packet reads like camera-relevant semantic guidance, not generic prompt fluff
4. another agent can run the slice from the repository without guessing hidden steps

## 10. Recommendation

Do not expand the ontology or tool surface during Phase 1.

The win condition is a believable end-to-end slice, not a broader concept set.

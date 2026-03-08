# Rainy Alley Phase 1 Ticket Breakdown

_Last updated: 2026-03-07_

## 1. Purpose

This document breaks the Rainy Alley Phase 1 prototype into concrete implementation tickets.

The tickets assume the existing contract and fixture layer is already present.

## 2. Ticket List

### RA-001: Runtime Entrypoint

Goal:

- create a single prototype entrypoint for the rainy alley slice

Deliverables:

- `run-rainy-alley-prototype` script or equivalent entrypoint
- clear input and output paths

Acceptance criteria:

- command runs from repository context
- command exits non-zero on invalid inputs
- command writes generated artifacts to a predictable folder

### RA-002: Metaball Resolution

Goal:

- load the metaball and resolve linked artifacts into a runtime context

Deliverables:

- loader for `spicy-metaball.json`
- relative path resolver
- loaded artifact summary object

Acceptance criteria:

- missing referenced file fails clearly
- valid fixture set resolves cleanly

### RA-003: World Semantic Field Load and Validate

Goal:

- load and validate world semantic field records before query

Deliverables:

- field loader
- schema validation hook

Acceptance criteria:

- point, region, and volume records are available to the query layer
- invalid field input throws a readable validation error

### RA-004: Camera Query Engine v1

Goal:

- implement deterministic ranking for visible records

Deliverables:

- frustum eligibility checks
- simple distance bias
- visibility score calculation
- ranked result list with debug scores

Acceptance criteria:

- same inputs produce same ordering
- records outside eligibility are excluded
- debug score output is inspectable

### RA-005: Render Text Packet Builder

Goal:

- convert ranked records into a readable packet

Deliverables:

- packet builder
- top-record selection rules
- summary text generation rules

Acceptance criteria:

- packet contains camera-relevant context
- packet size stays bounded
- packet validates against schema

### RA-006: Camera Pass Manifest Builder

Goal:

- build the runtime artifact manifest for the current camera pass

Deliverables:

- manifest builder
- input artifact references
- output artifact references
- task mode and query config references

Acceptance criteria:

- manifest validates against schema
- manifest references generated artifacts consistently

### RA-007: Model Conditioning Payload Builder

Goal:

- create the downstream model-facing payload from runtime outputs

Deliverables:

- payload builder
- prompt packet reference
- witness/control asset references

Acceptance criteria:

- payload validates against schema
- payload contains enough information for adapter mapping

### RA-008: Luma Adapter Mapper v1

Goal:

- map the model-conditioning payload into the Luma adapter contract

Deliverables:

- adapter mapping function
- generated Luma contract artifact

Acceptance criteria:

- output validates against schema
- mapping is deterministic and documented

### RA-009: Output Validation and Write Step

Goal:

- validate generated outputs before writing them to disk

Deliverables:

- final validation step
- output directory writer

Acceptance criteria:

- invalid generated artifact fails before write completion
- successful run writes all four target files

### RA-010: Operator Note

Goal:

- make the slice runnable by another agent or reviewer

Deliverables:

- short run instructions
- expected outputs list
- known limitations

Acceptance criteria:

- another contributor can run the slice without reading all research docs

## 3. Suggested Order

1. RA-001
2. RA-002
3. RA-003
4. RA-004
5. RA-005
6. RA-006
7. RA-007
8. RA-008
9. RA-009
10. RA-010

## 4. Parallelization Notes

These can overlap safely:

- RA-005 and RA-006 after RA-004
- RA-007 and RA-010 after RA-006

These should not start early:

- RA-008 before RA-007
- RA-009 before at least one builder exists

## 5. Estimated Complexity

### Small

- RA-001
- RA-003
- RA-006
- RA-009
- RA-010

### Medium

- RA-002
- RA-005
- RA-007
- RA-008

### Medium-high

- RA-004

The camera query is the only part that can easily sprawl. Keep it deliberately simple in Phase 1.

## 6. Definition of Success

The ticket set is complete when the rainy alley prototype can be run end-to-end from fixtures and emit:

- `generated-render-text-packet.json`
- `generated-camera-pass-manifest.json`
- `generated-model-conditioning-payload.json`
- `generated-luma-adapter-contract.json`

All four outputs must validate against the Metagrinder contracts.

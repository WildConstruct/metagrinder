# UTDG Staging And Curation Workflow

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the workflow for moving UTDG candidate records from parse output into canonical shared records.

The governing rule is:

"No direct promotion from user parse to canonical UTDG."

## 2. Workflow Overview

### Entry points

- Metagrinder parse output
- manual contributor submission
- team/org batch submission
- curator-imported external datasets

### Main stages

1. draft
2. staged
3. review
4. approve / merge / reject / restrict
5. canonical publication

## 3. Record States

### `draft`

Meaning:

- created locally
- not yet submitted for shared review

Visibility:

- user or team only

### `staged`

Meaning:

- submitted to the contribution queue
- awaiting automated and/or human checks

Visibility:

- contributor
- curators
- optionally team/org reviewers

### `needs_review`

Meaning:

- blocked on unresolved issue

Common reasons:

- duplicate ambiguity
- rights ambiguity
- weak provenance
- low confidence extraction

### `approved`

Meaning:

- valid and publishable as its own canonical record

### `merged`

Meaning:

- content was absorbed into an existing canonical record

### `rejected`

Meaning:

- unsuitable for canonical UTDG

### `restricted`

Meaning:

- retained only in private or limited-access form

## 4. Queue Processing Stages

### Stage A: Automated intake checks

Checks:

- schema validity
- required fields present
- provenance present
- rights fields present
- entity type valid

If failed:

- route to `needs_review`

### Stage B: Duplicate and similarity checks

Checks:

- exact label match
- alias overlap
- external ID overlap
- semantic similarity
- evidence/source overlap

Possible outcomes:

- no match
- possible duplicate
- likely merge target

### Stage C: Normalization checks

Checks:

- authority mappings available
- concept type sensible
- label cleanup needed
- archetype vs source record distinction clear

### Stage D: Rights checks

Checks:

- source rights captured
- contribution terms captured
- rights profile derivable
- commercial allowance determinable

### Stage E: Curator decision

Curator actions:

- approve as new canonical record
- merge into existing record
- request edits
- restrict to private/reference-only
- reject

## 5. Roles

### Contributor

Can:

- submit candidate records
- edit their own staged records before final decision
- respond to review requests

### Curator

Can:

- review staged records
- merge duplicates
- approve or reject
- modify normalization fields
- assign rights profile

### Policy reviewer

Can:

- resolve rights ambiguity
- classify restricted material

### Reviewer agent

Can:

- pre-score duplicates
- suggest authority mappings
- flag missing provenance

Guardrail:

- reviewer agents suggest
- curators decide for canonical promotion

## 6. Decision Criteria

### Approve as canonical

Requirements:

- sufficient provenance
- acceptable rights profile
- normalized label and type
- no blocking duplicate issue

### Merge into existing

Requirements:

- strong duplicate evidence
- clear improvement to existing record or additional evidence

### Reject

Common reasons:

- too vague
- unsourced
- not texture/material relevant
- generated fluff with no evidentiary basis

### Restrict

Common reasons:

- rights ambiguity
- private source dependence
- useful internally but not safe to publish

## 7. Duplicate Handling Rules

Duplicate review should consider:

- label similarity
- authority IDs
- source overlap
- conceptual equivalence
- archetype equivalence

Do not merge purely because labels are similar.

Examples:

- `silk velvet` and `silk velvet with metal thread` may be related but not identical
- `coarse homespun linen` may be an archetype, not a duplicate of `linen`

## 8. Archetype-Specific Rules

Archetypes need stricter review because they are synthetic.

Approval requires:

- supporting evidence from one or more source records
- clear distinction from raw source facts
- useful synthesis rather than stylistic fluff
- provenance to the evidence set that justified the archetype

## 9. Provenance Requirements

Minimum for staged records:

- at least one source reference or evidence snippet
- extraction or authoring method
- contributor attribution

Minimum for canonical records:

- explicit provenance references
- visible evidence or citation trail
- visible promotion history

## 10. Rights Requirements

Minimum for staged records:

- rights profile candidate
- source rights entry
- contribution terms

If missing:

- do not auto-approve
- route to `needs_review`

## 11. Audit Trail Requirements

Every decision should log:

- who acted
- when
- what changed
- why

Minimum events:

- submitted
- auto-flagged
- duplicate-suspected
- rights-flagged
- approved
- merged
- rejected
- restricted

## 12. UX Surfaces

### Contributor queue

Shows:

- submission status
- requested edits
- duplicate warnings
- rights warnings

### Curator review panel

Shows:

- candidate details
- evidence and provenance
- similarity suggestions
- authority mappings
- rights panel
- decision actions

### Record history view

Shows:

- timeline of actions
- contributor and curator attribution
- merge and promotion history

## 13. Automation Boundaries

Automation is good for:

- field completeness checks
- duplicate candidate ranking
- authority suggestion
- rights warning heuristics

Automation should not have final authority for:

- canonical approval
- rights clearance
- merge decisions in ambiguous cases

## 14. Recommendation

Implement the workflow in this order:

1. local draft and submission states
2. automated checks
3. curator review UI
4. merge/promotion logic
5. contributor reputation or trusted-submitter policies later

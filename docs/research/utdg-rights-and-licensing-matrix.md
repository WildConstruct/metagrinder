# UTDG Rights And Licensing Matrix

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the recommended rights model for UTDG records and contribution packages.

This is product architecture guidance, not legal advice.

The main rule is:

"Rights are attached per record, not assumed globally."

## 2. Why This Exists

The external source ecosystem is mixed:

- some sources are CC0
- some require attribution
- some are non-commercial
- some are educational-only
- some are reference-only
- some user submissions may be private or restricted

Because of that, UTDG cannot rely on one blanket commercial policy for every record.

## 3. Rights Layers

Every record should track at least three distinct layers:

### Layer 1: Source rights

What the upstream source allows.

### Layer 2: Contribution rights

What the contributor is authorized to submit and under what terms.

### Layer 3: Platform rights profile

How the platform will expose or restrict the resulting UTDG record.

## 4. Rights Classes

### `unrestricted`

Meaning:

- safe for public and commercial reuse

Typical examples:

- CC0-backed factual metadata
- fully original contributor content explicitly licensed for broad reuse

Product treatment:

- may be included in commercial-safe subsets

### `attribution-required`

Meaning:

- reusable with attribution obligations

Typical examples:

- ODC-By-like vocabulary-linked material
- contributor material submitted under attribution terms

Product treatment:

- usable in shared corpus
- attribution surfaced in UI and export metadata

### `non-commercial`

Meaning:

- usable for personal, educational, or non-commercial contexts only

Typical examples:

- contributor content submitted under NC terms
- source-derived records with NC restrictions

Product treatment:

- excluded from commercial-safe subsets
- visible warnings in exports and downstream tooling

### `reference-only`

Meaning:

- usable as a factual or internal reference, but not as a reusable redistributable asset

Typical examples:

- records derived from sources whose metadata can be cited but not freely republished as enriched derivative assets

Product treatment:

- may guide search, curation, and archetype review
- should not be exported as commercial-safe content without additional clearance

### `restricted`

Meaning:

- team-only, contributor-only, or policy-blocked

Typical examples:

- private production notes
- internal scans
- rights-uncertain material under quarantine

Product treatment:

- private or tightly scoped visibility only

## 5. Required Fields

Every staged or canonical UTDG record should include:

- `rightsProfile`
- `sourceRights`
- `contributionTerms`
- `rightsConfidence`
- `rightsNotes`
- `attributionRequirements`
- `commercialAllowed`
- `sourceUrls[]`

## 6. Suggested Field Semantics

### `rightsProfile`

One of:

- `unrestricted`
- `attribution-required`
- `non-commercial`
- `reference-only`
- `restricted`

### `sourceRights`

Human-readable or normalized source rights label.

Examples:

- `CC0`
- `CC BY`
- `CC BY-NC`
- `ODC-By`
- `In Copyright`
- `Institution Terms`
- `Unknown`

### `contributionTerms`

What the contributor agreed to for their submitted material.

Examples:

- `platform-community-commons`
- `platform-attribution`
- `private-only`

### `rightsConfidence`

One of:

- `high`
- `medium`
- `low`

### `commercialAllowed`

Boolean derived from policy, not from guesswork.

## 7. Record Decision Matrix

| Scenario | Source Rights | Contribution Terms | Recommended Rights Profile | Commercial Allowed | Publish Target |
| --- | --- | --- | --- | --- | --- |
| Public-domain factual metadata from open institution | CC0 | platform-community-commons | unrestricted | true | canonical eligible |
| Getty-linked normalized concept with attribution needs | ODC-By / attribution | platform-attribution | attribution-required | true with attribution | canonical eligible |
| User-submitted synthesis with unclear source basis | Unknown | platform-community-commons | reference-only | false | staging only |
| User private research notes | private | private-only | restricted | false | private only |
| Non-commercial source-derived record | CC BY-NC / equivalent | platform-community-commons | non-commercial | false | canonical or staged with NC restrictions |
| Rights uncertain museum-derived enriched summary | Institution Terms / Unknown | platform-community-commons | reference-only | false | staging only until review |

## 8. Packaging Rules

### Private research package

Can contain mixed-rights material because it is not automatically shared.

### Staged UTDG package

Must include rights metadata for every candidate.

If rights metadata is missing:

- default to `restricted` or `reference-only`
- do not promote automatically

### Canonical UTDG

Only publish records whose rights class and review state are explicit.

## 9. Export Rules

### Commercial-safe export

Only include records where:

- `commercialAllowed = true`
- review state is approved or merged
- attribution requirements can be satisfied

### Non-commercial export

May include:

- unrestricted
- attribution-required
- non-commercial

But must surface all restrictions clearly.

### Reference-only export

Should default to:

- metadata-only
- search/index support
- internal analysis use

Not asset-pack-style export.

## 10. UI Rules

The UI should visibly distinguish:

- open/commercial-safe
- attribution-required
- non-commercial
- reference-only
- restricted/private

Suggested treatments:

- badges
- filter chips
- export warnings
- rights details panel

## 11. Promotion Rules

A staged record cannot be promoted unless:

1. `rightsProfile` is set
2. `sourceRights` is set or explicitly marked `Unknown`
3. `rightsConfidence` is not empty
4. `commercialAllowed` has been policy-derived
5. provenance is present

## 12. Commercial Product Implications

The platform should monetize:

- workflow tooling
- curation
- validation
- premium integrations
- commercial-safe curated subsets

The platform should not assume it can convert all mixed-rights source-derived records into one proprietary commercial corpus.

## 13. Recommendation

Adopt this matrix before implementing public contribution.

Without it, the contribution pipeline will create legal ambiguity faster than it creates product value.

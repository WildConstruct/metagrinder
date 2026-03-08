# Metagrinder Terminology

_Last updated: 2026-03-07_

## Purpose

This note defines the intended product language for the Metagrinder system.

It exists to keep product naming expressive without polluting schema and API contracts with unclear terms.

## Core Terms

### `Metagrinder`

The ingestion and transformation system that:

- accepts research and source material
- parses it into structured PSG collections
- emits staged UTDG contribution artifacts
- optionally derives prompt synthesis and mutation surfaces

### `metaball`

A PSG project or packaged PSG output produced by the Metagrinder.

This is a product nickname, not a schema term.

It is useful when talking about:

- user-facing outputs
- creative packaging
- internal product language

## Naming Rule

Use:

- `Metagrinder` in product language, concept docs, and roadmap discussions
- `metaball` in product language and informal UX copy where it adds character

Do not use:

- `metaball` as a manifest type
- `metaball` as a file format name
- `metaball` as an API resource name

For contracts, keep explicit terms such as:

- `research-package`
- `utdg-submission`
- `utdg candidate`
- `canonical UTDG record`

## Why This Works

`Metagrinder` suggests:

- transformation
- orchestration
- meta-level structuring

`metaball` suggests:

- field-like blending
- aggregation
- compositional shaping

That is unusually aligned with the product direction, especially around:

- influence maps
- localized semantic conditioning
- prompt blending
- environmental effects

## Recommendation

Keep the branding language.

Keep the contracts literal.

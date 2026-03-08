# UTDG Contribution Meat Grinder PRD

_Last updated: 2026-03-07_

## 1. Executive Summary

The Deep Research Parser should evolve into a dual-purpose ingestion pipeline:

1. it creates structured PSG assets that help the user immediately
2. it optionally produces staged UTDG contribution records from the same parse

This turns personal work into shared infrastructure.

The product idea is simple:

- users do research or prompt-building work for themselves
- the system extracts texture/material knowledge in parallel
- contributors keep the immediate benefit
- the broader ecosystem gains richer UTDG data over time

If done correctly, this can become a Wikipedia-like texture knowledge base with better structure, provenance, and licensing hygiene.

## 2. Product Thesis

The Metagrinder should not only convert research into prompt graphs. It should also identify which parts of the parse are suitable for the Universal Texture Description Graph and package them for staged contribution.

The best framing is:

"As users create work for themselves, they can also help build the shared texture commons."

## 3. Why This Matters

UTDG already has a conceptual direction in the repo:

- historical/material data integration
- node management APIs
- validation and constraint systems
- Wild Construct ecosystem integration
- archived notes that explicitly recommend a staging layer for uncertain or crowd-contributed data

What is missing is a contribution model that:

- fits normal user behavior
- preserves quality
- does not require users to become database curators
- aligns incentives between private work and shared graph enrichment

The Metagrinder is the right insertion point because it already performs extraction, classification, synthesis, and packaging.

## 4. Product Goal

Create a workflow where any qualifying research parse can emit:

1. project-local PSG collections
2. candidate UTDG records
3. contribution metadata for review, promotion, and licensing

## 5. Core Product Idea

When a user pastes research, notes, museum descriptions, fabric references, or production briefs into PSG, the system should run two tracks in parallel:

### Track A: Personal utility

Build prompt graphs, concept clusters, and reusable project assets for the user's own creative work.

### Track B: Shared knowledge extraction

Extract normalized material/texture knowledge that could become UTDG nodes, edges, archetypes, and evidence links.

The user should not feel like they are doing unpaid clerical work. Contribution should be a natural byproduct of useful authoring.

## 6. Product Positioning

### For students and hobbyists

- free access to the shared UTDG commons
- free ability to contribute structured knowledge
- free access to public/community-reviewed texture records

### For commercial users

- inexpensive commercial license
- access to the same shared corpus plus commercial usage rights
- optional premium features around workflow, validation, scale, or enterprise integration

### Strategic implication

This model grows the corpus through broad participation while keeping monetization attached to commercial rights and advanced workflow value, not to basic access.

## 7. Recommended Licensing Direction

This is product guidance, not legal advice.

### Recommended model

Separate:

1. access rights
2. contribution terms
3. commercial usage rights

### Suggested high-level policy shape

- public/community UTDG records are viewable and usable free for students, hobbyists, and non-commercial exploration
- commercial use requires a low-cost commercial license
- contributors agree that approved community contributions can enter the shared UTDG under the platform's commons terms
- provenance and source restrictions must be preserved at the record level

### Important warning

UTDG cannot assume all source material is equally relicensable. Every contribution path must capture:

- source type
- source URL or citation
- contributor assertion of rights
- downstream usage restrictions

Without this, the "Wikipedia of texture data" concept will become legally fragile.

## 8. Data Contribution Model

The Metagrinder should classify extracted material into three contribution tiers.

### Tier 1: Private-only parse output

Material useful to the user but not suitable for UTDG contribution.

Examples:

- proprietary production notes
- private art direction
- ambiguous internal shorthand

### Tier 2: Staged candidate contribution

Material that looks useful for UTDG but needs review, normalization, or rights confirmation.

Examples:

- inferred texture descriptions
- museum-derived notes with incomplete metadata
- archetype proposals generated from multiple sources

### Tier 3: Approved shared UTDG contribution

Material that has sufficient provenance, normalization, and policy clearance to enter the public/shared corpus.

Examples:

- normalized material archetypes
- reviewed relationship edges
- well-cited texture descriptors

## 9. Recommended UTDG Ingestion Flow

### Step 1: Parse source for user value

Generate the user's project-local research and prompt collections.

### Step 2: Detect UTDG-eligible facts

Extract candidate texture/material knowledge.

### Step 3: Normalize

Map into UTDG-friendly structures such as:

- material
- texture
- pattern
- style
- technique
- era
- region
- compatibility rule
- archetype

### Step 4: Score confidence and rights readiness

Each candidate should receive:

- extraction confidence
- provenance completeness
- rights confidence
- normalization confidence

### Step 5: Route into staging

Do not write directly to canonical UTDG by default.

Route into a staging graph first.

### Step 6: Review and promote

Approved items become canonical UTDG records.

## 10. Why Staging Is Mandatory

The archived UTDG research in the repo is right to recommend a quarantine or staging layer.

This should be treated as a hard product rule.

### Reasons

1. Research parses will contain uncertainty.
2. User-generated contributions will vary in quality.
3. Rights status will often be incomplete at first pass.
4. Duplicate and near-duplicate concepts will be common.
5. Some contributions should remain private or team-scoped.

## 11. Recommended UTDG Record Types

The Metagrinder should be able to emit candidate records for at least:

- `Material`
- `Texture`
- `Pattern`
- `Style`
- `Technique`
- `Composite`
- `Archetype`
- `CompatibilityRule`
- `IncompatibilityRule`
- `SourceCitation`
- `ImageReference`

## 12. Recommended Record Fields

Each staged UTDG candidate should capture:

- `candidate_id`
- `canonical_label`
- `aliases`
- `record_type`
- `description`
- `textural_qualities`
- `material_properties`
- `era`
- `region`
- `usage_context`
- `source_citations`
- `evidence_snippets`
- `confidence`
- `rights_status`
- `review_status`
- `contributor_id`
- `derived_from_package_id`

## 13. Archetype Strategy

UTDG should not only store raw source-derived entries. It should also support archetypes.

### Why archetypes matter

A raw museum entry is useful evidence, but users often need reusable generalized concepts such as:

- coarse homespun linen
- polished blackened leather
- faded indigo-dyed wool
- silk velvet with metallic brocade

These archetypes are far more useful for prompt generation and browsing than thousands of isolated records.

### Meat grinder role

The Metagrinder should identify repeated patterns across research packages and propose archetypes for review.

## 14. Community Contribution UX

### Key principle

Contribution must feel lightweight, optional, and rewarding.

### Recommended UX moments

1. After parse:
   Show "X UTDG candidates detected."

2. During review:
   Let users approve, edit, or suppress candidate contributions.

3. At save/package time:
   Offer:
   - keep private
   - submit to staging
   - submit on behalf of team/org

4. After approval:
   Show contribution status and any promoted records.

### Important product rule

Default should be safe.

That means:

- private by default for sensitive inputs
- staged by default for community contribution
- canonical by review only

## 15. Incentive Design

If the product wants sustained contribution, contributors need visible benefit.

### Recommended incentives

- immediate benefit in their own project outputs
- contribution profile or reputation
- attribution on approved public records
- easier discovery of related records from other contributors
- unlocks like better prompt browsers, richer suggestions, or curator tools

The primary incentive, though, should still be:

"This made my own work better."

## 16. UTDG as a Knowledge Engine

UTDG should not be treated as a passive database.

It should become a graph that powers:

- prompt composition
- constraint checking
- semantic search
- texture discovery
- era/region compatibility
- archetype suggestion

The Metagrinder should therefore emit not only nodes but also relationships.

## 17. Relationship Types To Capture

Minimum useful UTDG edge families:

- `same_as`
- `variant_of`
- `derived_from`
- `used_in`
- `associated_with_era`
- `associated_with_region`
- `compatible_with`
- `incompatible_with`
- `often_layered_with`
- `has_visual_quality`
- `supported_by_source`

## 18. Integration With The Deep Research Parser

This should be treated as an extension of the prior research package design, not a separate system.

### Recommended shared pipeline

1. ingest source
2. build source graph
3. extract claims and concepts
4. identify prompt material
5. identify UTDG-eligible texture/material knowledge
6. create user-facing PSG collections
7. create staged UTDG contribution package

### Shared benefit

One parse pass can feed both:

- creative generation
- long-term knowledge graph enrichment

## 19. Packaging Recommendation

The system should emit a companion contribution artifact alongside the user package.

### Suggested artifact set

1. user-facing research package
   - PSG collections for source, concepts, synthesis, prompt mutation

2. `utdg-candidates.json`
   - staged contribution candidates

3. optional `utdg-evidence.psg`
   - graph for review and provenance inspection

### Why not store everything directly as canonical UTDG

Because user output and public graph contribution have different review and rights requirements.

## 20. Search and Discovery Product Direction

If this succeeds, UTDG can become a "Wikipedia of texture data," but with graph semantics.

### Core discovery modes

- search by material
- search by tactile quality
- search by era
- search by region
- search by use case
- search by compatibility
- browse archetypes
- browse evidence-backed records only

### Long-term differentiator

Wikipedia is article-centric.

UTDG should be graph-centric, provenance-aware, and generation-ready.

## 21. Quality and Trust Requirements

The shared graph will only be valuable if users trust it.

### Required trust features

1. provenance visible on every shared record
2. clear distinction between source fact and inferred archetype
3. review state visible
4. contributor and curator history
5. conflict/contradiction handling
6. duplicate detection
7. rights restrictions visible

## 22. Risks

### 1. Rights contamination

If users contribute content derived from sources without clear reuse rights, the commons becomes risky.

### 2. Low-quality crowd noise

Without staging and review, the graph becomes cluttered and unreliable.

### 3. Misaligned incentives

If contribution feels like labor with no benefit, users will skip it.

### 4. Over-centralization

If canonical approval is too slow or opaque, community participation will stall.

### 5. Schema inflation

If the contribution model adds too many rigid fields too early, it will slow real usage.

## 23. Key Product Decisions

### Decision 1

The Metagrinder should create both user assets and UTDG candidates in one workflow.

### Decision 2

Canonical UTDG must have a staging layer for all community-derived content.

### Decision 3

Contribution must preserve provenance, confidence, and rights metadata.

### Decision 4

Archetypes should be a first-class contribution target, not an afterthought.

### Decision 5

Free non-commercial access plus low-cost commercial licensing is a viable strategic direction if rights tracking is built in from the start.

## 24. Phased Delivery Recommendation

### Phase 1: Parallel extraction

- identify UTDG candidates during research parse
- keep all candidates private or staged
- no public contribution yet

### Phase 2: Staging workflow

- let users submit candidate records to a review queue
- add normalization, duplicate checks, and provenance inspector

### Phase 3: Shared commons launch

- publish approved public/community records
- add public browsing and semantic search
- enable free non-commercial access

### Phase 4: Commercial licensing and ecosystem integration

- add low-cost commercial usage terms
- integrate canonical UTDG into prompt generation, validation, and Wild Construct tooling

## 25. Guidance For Other Agents

### For implementation agents

- do not write directly from user parse into canonical UTDG
- design staging and promotion from the beginning
- keep the user package and community package separate but linked

### For data/ontology agents

- optimize for archetypes, compatibility, and provenance
- avoid overfitting the schema to one historical niche

### For frontend agents

- show contribution as optional value-add, not mandatory workflow debt
- make provenance and review state easy to inspect

### For product owner

- define success as "users get better outputs and the commons gets better over time"
- not "we collected the most raw records"

## 26. Open Questions

1. What contribution agreement should govern staged and approved UTDG records?
2. Which source classes are safe for public contribution versus private-only extraction?
3. Will canonical approval be human-curated, reputation-based, or hybrid?
4. Should approved contributors be able to publish directly into certain namespaces?
5. Is the commercial license attached to dataset usage, generated outputs, platform access, or some combination?

## 27. Recommendation

Proceed with UTDG contribution design as a companion system to the Deep Research Parser.

The right product framing is:

"The Metagrinder helps users build their own prompt and research assets while also generating staged UTDG contributions that can grow into a shared, provenance-aware texture commons."

That framing aligns:

- user incentives
- community growth
- UTDG quality control
- long-term licensing strategy

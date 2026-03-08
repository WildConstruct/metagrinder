# UTDG Approach Validation

_Last updated: 2026-03-07_

## 1. Goal

This document validates whether the current UTDG direction and the proposed Metagrinder workflow are the right approach.

The questions being tested are:

1. Does a graph-based UTDG make sense?
2. Does the Metagrinder fit that strategy?
3. Are there established external models that support or contradict this direction?
4. What should change before this becomes an implementation program?

## 2. Short Answer

Yes, the overall direction makes sense.

A graph-based UTDG is directionally correct, and the Metagrinder is a credible way to grow it.

However, the current concept needs three corrections before it hardens into product strategy:

1. UTDG should align with existing cultural-heritage and provenance standards instead of inventing its own ontology from scratch.
2. Canonical UTDG should be a standards-aware reference graph, while PSG remains the execution and authoring surface.
3. The proposed free non-commercial / low-cost commercial access model conflicts with some open-data realities unless rights are tracked at the record level and monetization is shifted toward value-added layers rather than raw open records.

## 3. Research Summary

### A. The graph model is justified

The cultural-heritage field already uses graph-oriented semantic models for exactly this kind of cross-source integration.

Relevant evidence:

- CIDOC CRM describes itself as a formal ontology for information integration in cultural heritage and explicitly positions itself as the "semantic glue" for diverse datasets.
- Linked Art 1.0 is a practical, community-driven model and API built on standards for describing rich relationships between objects, people, places, concepts, events, and provenance.
- PROV-O is a W3C Recommendation for representing and exchanging provenance information across systems.
- SKOS is a W3C Recommendation for expressing thesauri, taxonomies, and concept schemes.

Conclusion:

UTDG as a graph is not speculative. It is the normal shape for interoperable cultural-heritage knowledge.

### B. Your data-source intuition is correct

There is a large ecosystem of machine-readable cultural-heritage data that is directly relevant to texture/material knowledge.

Relevant evidence:

- The Met exposes Open Access data and images under CC0 and offers an API.
- Smithsonian Open Access provides more than 5.1 million digital items and exposes data through an API and GitHub.
- V&A provides machine-readable collection data and images, plus API docs designed for data science workflows.
- Europeana APIs provide access to metadata from thousands of institutions across Europe.

Conclusion:

There is enough public or semi-open institutional data to justify building UTDG as a real ingestion system rather than a hand-authored boutique dataset.

### C. Your normalization instinct is also correct

External systems already converge around controlled vocabularies and linked identifiers.

Relevant evidence:

- Getty AAT is explicitly a thesaurus for materials, styles, cultures, and techniques.
- Getty says its vocabularies grow through expert-community contributions and are openly available under ODC-By.
- V&A’s API uses Getty identifiers for common materials and techniques.
- Linked Art explicitly highlights Getty AAT as a core component for interoperability.

Conclusion:

UTDG should not invent free-text labels as its primary canonical layer. It should normalize to shared concept identifiers where possible, especially for material, style, technique, and place concepts.

### D. Provenance is not optional

The external standards strongly support the idea that provenance must be first-class.

Relevant evidence:

- PROV-O exists specifically to represent and exchange provenance information across different systems and contexts.
- CIDOC CRM emphasizes evidence-based integration across dispersed cultural-heritage datasets.
- Linked Art includes provenance activities as a first-class modeling area.

Conclusion:

The earlier PRD recommendation that every UTDG candidate carry provenance, evidence snippets, and review state is correct and should be treated as mandatory.

### E. Community contribution is plausible, but governance is the hard part

The idea of a community-built texture commons is realistic, but not as a direct-write system.

Relevant evidence:

- Wikidata shows that a free, structured, machine-readable knowledge base with community editing can scale.
- Getty shows a more curated expert-community contribution model.
- Archived UTDG notes in the repo already recommended a staging layer for uncertain or crowd-contributed data.

Conclusion:

The Metagrinder should absolutely support contribution, but only through staged, reviewable submissions. This is the right middle ground between Wikidata-style openness and Getty-style curation.

## 4. What The Research Says You Are Right About

### 1. UTDG should be a graph, not a flat database

The external standards and platforms all point toward relationship-rich modeling.

Why this matters:

- texture/material knowledge is relational
- compatibility and incompatibility are relational
- provenance is relational
- archetypes are relational
- era and region constraints are relational

### 2. The Metagrinder is the right growth mechanism

The proposed Metagrinder is credible because it solves the hardest bootstrapping problem:

"How do we grow a useful knowledge graph without asking people to do separate cataloging work?"

Using real creative work as the contribution surface is a strong approach.

### 3. Archetypes are the right canonical target

The research supports your instinct that canonical value is not in raw item dumps alone.

Museum records are evidence.

UTDG’s differentiated value is likely to come from:

- normalized archetypes
- relationship logic
- queryability
- prompt-ready synthesis

### 4. Prompt generation and UTDG should stay connected

Linked Art and related standards emphasize interoperable knowledge and richer downstream use. Your Metagrinder proposal goes one step further by using that knowledge graph to generate prompts and texture descriptions.

That is a strong differentiator rather than a contradiction.

## 5. What Needs To Change

### Change 1: UTDG should be standards-aligned, not bespoke-first

Current risk:

The product language implies building a new ontology from scratch.

Research-backed correction:

UTDG should borrow its backbone from:

- SKOS for concept schemes and label relationships
- PROV-O for provenance
- CIDOC CRM or Linked Art patterns for cultural-heritage relationship modeling
- Getty AAT and related identifiers for normalization targets

Practical implication:

UTDG can still be product-specific, but it should be an application profile or layered graph, not an isolated vocabulary island.

### Change 2: Separate canonical UTDG from PSG execution surfaces

Current risk:

The discussion sometimes drifts toward making one graph do everything.

Research-backed correction:

Canonical UTDG should be the reference graph.

PSG should remain the execution, authoring, and prompt-generation surface.

Best model:

- canonical UTDG = standards-aware concept/reference graph
- PSG = derived executable graph surfaces for authoring, synthesis, and prompt mutation

Why:

- cultural-heritage reference graphs and prompt execution graphs have different needs
- trying to force them into one artifact will create schema confusion

### Change 3: Revise the licensing and access model

Current risk:

The current idea is:

- free for students and hobbyists
- inexpensive commercial access

That is workable for platform services, but not for all underlying records.

Research-backed correction:

The external source ecosystem is mixed:

- The Met uses CC0 for open access data and images.
- Smithsonian uses CC0 for designated Open Access items.
- Getty vocabularies are ODC-By.
- V&A data reuse is under its own terms.
- Europeana explicitly supports many rights states, including CC0, CC BY, CC BY-NC, In Copyright, and educational-only cases.

Implication:

You cannot treat the entire corpus as if it can be relicensed into a single low-cost commercial dataset.

Safer model:

- canonical UTDG stores rights metadata per record
- only some records are fully open for unrestricted reuse
- some are reference-only
- some may support non-commercial use only
- commercial monetization should attach to:
  - platform access
  - curation workflows
  - value-added derived products
  - premium validation and integrations
  - possibly curated commercial-safe subsets

Inference from the sources:

If a record comes from a CC0 source, the platform cannot meaningfully re-close that record.

### Change 4: UTDG should be identifier-first where possible

Current risk:

If the graph is built mainly from strings, duplicate and synonym collapse will be painful.

Research-backed correction:

Canonical records should preserve external IDs when available, especially:

- Getty AAT identifiers
- institutional object identifiers
- Europeana record IDs
- Wikidata QIDs when relevant and reliable

### Change 5: Contribution governance must be designed up front

Current risk:

A future community contribution model could easily collapse into noise.

Research-backed correction:

The platform should plan for:

- staging
- duplicate detection
- reviewer workflows
- contributor attribution
- review state visibility
- merge and reject actions

## 6. What The Meat Grinder Should Actually Do

Based on the research, the Metagrinder makes sense if it is defined as:

"A staged ingestion and transformation system that produces both PSG authoring assets and candidate UTDG records from the same source material."

That means it should:

1. segment source material
2. extract material/texture/style/technique concepts
3. normalize concepts against external vocabularies when possible
4. preserve provenance with evidence links
5. emit user-facing PSG collections
6. emit staged UTDG contribution packages
7. never publish directly to canonical UTDG without review

## 7. Recommended UTDG Architecture After Research

### Layer 1: External references

- museum APIs
- open collection data
- Getty vocabularies
- Europeana and other aggregators
- optional Wikidata links

### Layer 2: Canonical UTDG reference graph

- normalized concepts
- archetypes
- compatibility rules
- provenance links
- rights metadata
- review state

### Layer 3: Derived PSG surfaces

- prompt synthesis graphs
- prompt mutation graphs
- project-local research graphs
- user-facing prompt browser collections

### Layer 4: Product experiences

- research intake
- prompt browser
- mutation lab
- UTDG explorer
- candidate review
- commercial pipeline integrations

## 8. Validation Of The Community-Commons Vision

The "Wikipedia of texture data" vision is directionally sound, but it should behave more like:

- Wikidata in contribution mechanics
- Getty in controlled vocabulary discipline
- Linked Art in interoperability
- PROV-O in provenance

Not like:

- an unreviewed public wiki
- a flat spreadsheet of descriptors
- a closed proprietary ontology with no external alignment

## 9. Final Verdict

### Verdict on UTDG

UTDG is the right kind of system to build if the goal is:

- texture/material knowledge reuse
- provenance-aware discovery
- historical/contextual constraint handling
- prompt-ready synthesis

### Verdict on the Metagrinder

The Metagrinder makes sense and is one of the strongest parts of the concept.

It solves:

- corpus growth
- user incentive alignment
- extraction and packaging
- shared/private workflow branching

### Verdict on current approach quality

The approach is good, but it should now be reframed as:

"A standards-aligned reference graph with staged community contribution and PSG-derived execution surfaces."

That is stronger, safer, and more interoperable than a fully bespoke UTDG concept.

## 10. Recommended Next Moves

1. Define a minimal UTDG application profile that maps:
   - SKOS concepts
   - PROV-O provenance
   - selected CIDOC CRM / Linked Art relationship patterns
   - Getty AAT normalization hooks

2. Define rights classes for UTDG records:
   - unrestricted
   - attribution-required
   - non-commercial
   - reference-only
   - restricted/private

3. Keep the Metagrinder package split:
   - user PSG package
   - staged UTDG package

4. Design the curator workflow before public contribution launch.

5. Treat archetypes and compatibility rules as first-class canonical assets.

## 11. Sources

Primary sources used:

- W3C PROV-O: https://www.w3.org/TR/prov-o/
- W3C SKOS: https://www.w3.org/2004/02/skos/
- CIDOC CRM: https://cidoc-crm.org/
- Linked Art home/model/about: https://linked.art/ , https://linked.art/model/ , https://linked.art/about/
- Linked Art 1.0 release: https://linked.art/about/1.0/
- Getty Vocabularies / AAT: https://www.getty.edu/research/tools/vocabularies/
- Getty vocabulary access/licensing: https://www.getty.edu/research/tools/vocabularies/obtain/index.html
- The Met Open Access: https://www.metmuseum.org/es/hubs/open-access
- Smithsonian Open Access: https://www.si.edu/openaccess and https://www.si.edu/openaccess/faq
- V&A developer docs: https://developers.vam.ac.uk/ and https://developers.vam.ac.uk/guide/v2/welcome.html
- Europeana APIs: https://apis.europeana.eu/
- Europeana rights statements: https://pro.europeana.eu/page/available-rights-statements
- Wikidata main page: https://www.wikidata.org/wiki/Wikidata:Main_Page

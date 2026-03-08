# Deep Research Parser PRD

_Last updated: 2026-03-07_

## 1. Executive Summary

Prompt Spaghetti should support a new PSG-native workflow that takes a long-form "deep research" prompt or research dump and converts it into structured graph assets instead of leaving it as an opaque text blob.

This document proposes a product direction for a `Deep Research Parser`, informally the `Metagrinder`:

- ingest a large research prompt, notes bundle, or pasted research artifact
- parse it into multiple related PSG graph collections
- preserve provenance, evidence, and uncertainty
- expose the result as reusable project assets, prompt sets, and synthesis surfaces
- support agentic refinement through a skill-style framework rather than a one-shot parser

This is a product and architecture proposal only. It does not implement a feature.

## 2. Why This Should Exist

PSG already has:

- graph-native authoring
- prompt parsing
- LLM-assisted parsing and metadata extraction
- reusable `.psg` fragments
- asset/library concepts

What PSG does not yet have is a first-class way to turn messy research into a structured prompt system.

Today, the current parser direction is narrow:

- the Epic 1 parser mostly segments text into `TextBlock`, `WeightedChoice`, `Variable`, and an `Output`
- the LLM parser can draft graph structure, but it is still prompt-to-graph oriented rather than research-to-knowledge-system oriented
- the canonical live `.psg` contract is a flat fragment format, not a complete research project model

The product gap is not "parse text better." The gap is "convert research material into durable, inspectable, reusable graph assets."

## 3. Product Thesis

The Deep Research Parser should be a PSG-native ingestion and synthesis system that transforms raw research into three usable outputs:

1. Research graphs
2. Prompt synthesis graphs
3. Reusable project/library assets

The system should behave less like a normal parser and more like a bounded research agent pipeline.

## 4. Product Positioning

### Core statement

Users should be able to paste a large research prompt, dossier, transcript, outline, or note bundle into PSG and receive a structured set of nodes, regions, and related graphs that can be:

- explored
- validated
- remixed
- reused in other projects
- turned into prompt generation surfaces

### Jobs to be done

1. Convert unstructured research into graph-native knowledge.
2. Preserve where claims came from.
3. Separate facts, interpretations, open questions, and promptable material.
4. Build prompt sets from research without re-reading the whole source every time.
5. Browse, rotate, compare, and mutate prompt variants derived from the same research base.

## 5. Current-State Constraints From PSG

This proposal should respect the repo's current reality:

1. The live canonical `.psg` source contract is a flat fragment document with top-level `nodes`, `edges`, and optional `regions`, not the historical editor-project wrapper from `docs/psg-format-v2.md`.
2. PSG already tolerates multiple node dialects and compatibility paths, so this feature should reduce schema ambiguity, not add more.
3. Current prompt parsing is designed for prompt segmentation, not evidence modeling.
4. Asset and fragment workflows already fit the idea of reusable graph components.
5. LLM-assisted parsing, node intelligence, and metadata extraction already exist conceptually, so the right product move is orchestration, not another isolated endpoint.

## 6. Product Definition

### In scope

- paste or import deep research text
- parse into multiple graph collections, not just one chain of nodes
- create PSG-native research artifacts with provenance metadata
- let agents refine or expand the parse in bounded passes
- support browsing and reusing generated prompt collections
- support prompt mutation and recombination as a second-order workflow

### Out of scope for v1

- autonomous web research
- automatic truth verification across the open internet
- collaborative editing
- full academic citation management
- publishing a new universal knowledge graph standard for PSG

## 7. Primary Users

### 1. Research-heavy prompt designer

Needs to transform large piles of notes into prompt systems.

### 2. Creative development lead

Needs research organized into reusable categories, themes, motifs, characters, settings, references, and prompt starters.

### 3. Agent operator

Needs a structured substrate that downstream agents can reason over safely.

### 4. Product owner / content librarian

Needs research outputs to be storable, browsable, and reusable across projects.

## 8. Core Concept: Multi-Graph Research Ingestion

The parser should not emit one graph. It should emit a `research package` made of related PSG collections.

### Recommended graph families

#### A. Source Graph

Purpose:
Represent the original material in chunked form.

Typical node types:

- `SourceDocument`
- `SourceChunk`
- `Section`
- `Quote`
- `ExtractedEntity`

Key value:

- preserves raw text coverage
- enables traceability
- gives later agents stable references

#### B. Claim and Evidence Graph

Purpose:
Represent what the material appears to assert.

Typical node types:

- `Claim`
- `Evidence`
- `Counterpoint`
- `Uncertainty`
- `OpenQuestion`
- `Assumption`

Key value:

- separates fact-like statements from speculation
- preserves uncertainty instead of flattening everything into prompt fodder

#### C. Concept Graph

Purpose:
Cluster themes, entities, motifs, taxonomies, and reusable concepts.

Typical node types:

- `Theme`
- `Entity`
- `Location`
- `Organization`
- `Technique`
- `Constraint`
- `Style`
- `TimelineMarker`

Key value:

- lets users navigate research semantically
- becomes the basis for prompt browsing and recombination

#### D. Prompt Synthesis Graph

Purpose:
Convert research material into prompt-ready building blocks.

Typical node types:

- `TextBlock`
- `WeightedChoice`
- `Concat`
- `Variable`
- `Output`
- optional future synthesis nodes like `Template`, `Sequential`, or `Conditional`

Key value:

- turns research into something PSG already knows how to execute

#### E. Prompt Mutation Graph

Purpose:
Generate and connect alternate prompt formulations derived from the same concepts.

Typical node types:

- `PromptVariant`
- `MutationRule`
- `Constraint`
- `ReferencePrompt`
- `Blend`

Key value:

- supports the user's idea of rotating through prompt browsers
- supports mutation and recombination instead of static prompt lists

## 9. Recommended Information Model

The parser should classify incoming text into at least these layers:

1. `source`
Raw imported text and chunk boundaries.

2. `claim`
Statements that can be treated as assertions or findings.

3. `evidence`
Supporting excerpts or rationale linked back to source chunks.

4. `concept`
Entities, themes, categories, motifs, methods, settings, constraints.

5. `prompt_material`
Text that can directly become prompt building blocks.

6. `uncertainty`
Ambiguity, weak evidence, contradiction, or open research gaps.

This separation matters because prompt generation becomes much stronger when the system knows the difference between:

- "this was said"
- "this is inferred"
- "this is a reusable concept"
- "this is a promptable surface"

## 10. PSG Packaging Recommendation

The product should not overload the historical project-shaped `.psg` spec as the main source of truth for research ingestion.

### Recommendation

Use a package model composed of:

- one or more canonical PSG fragment documents for reusable graph collections
- a lightweight project manifest that links those fragments together
- optional import-time editor wrappers synthesized by the editor, not stored as canonical source

### Why

This aligns with current PSG direction:

- flat fragment documents are the clearest live contract
- `regions` already provide semantic grouping
- imported wrappers are already editor/runtime artifacts

### Suggested research package contents

1. `source-map.psg`
2. `claims-and-evidence.psg`
3. `concept-clusters.psg`
4. `prompt-synthesis.psg`
5. `prompt-mutations.psg`
6. `research-package.json` manifest

The manifest should remain thin. It should not become another sprawling alternate PSG dialect.

## 11. Agent Skill Framework Recommendation

This should be framed as a skill-driven agent workflow, not a single parser call.

### Proposed skill

`research-parser`

### Skill responsibility

Take a pasted research artifact and orchestrate staged conversion into PSG-native collections.

### Suggested stages

1. `ingest`
Normalize input, split sections, identify source boundaries.

2. `extract`
Find claims, entities, themes, quotes, constraints, and ambiguities.

3. `classify`
Map extracted material into graph families.

4. `synthesize`
Build prompt-ready nodes and prompt families.

5. `package`
Emit PSG fragments plus a manifest.

6. `review`
Surface confidence, unresolved issues, and recommended human actions.

### Why a skill framework is the right product shape

- parsing large research is multi-step
- later passes need awareness of earlier outputs
- users will want repeatable workflows
- other agents need a stable operating contract

## 12. Functional Requirements

### FR1: Large-text intake

Users can paste a long research prompt or research text bundle into a dedicated intake surface.

### FR2: Multi-collection output

The system produces multiple related graph collections when appropriate, not only a single linear graph.

### FR3: Provenance preservation

Every non-source node can link back to source chunks or source document references.

### FR4: Uncertainty capture

The system can represent low-confidence or contradictory material explicitly.

### FR5: Prompt synthesis

The system can derive PSG-executable prompt graphs from the research package.

### FR6: Prompt browser

Users can browse derived prompts by concept, source, theme, or synthesis strategy.

### FR7: Prompt mutation

Users can generate variant prompts by combining concepts, constraints, and styles from the research package.

### FR8: Bounded AI refinement

Agents can refine collections in scoped passes instead of rewriting the entire package every time.

### FR9: Project integration

Generated collections can be added to a project/library in a way that remains PSG-native and reusable.

## 13. Non-Functional Requirements

1. The system must preserve source traceability.
2. The system must remain understandable to humans after parsing.
3. The system must degrade gracefully when extraction confidence is low.
4. The system must not depend on one giant hidden LLM response.
5. The system must support incremental regeneration of only one graph family.
6. The system must support local or offline-safe fallback modes, even if reduced in quality.

## 14. UX Recommendation

### Primary flow

1. User opens `Research Intake`.
2. User pastes research prompt, notes, or dossier.
3. System shows parse plan before generation.
4. System generates collections progressively.
5. User reviews:
   - source coverage
   - extracted claims
   - concept clusters
   - prompt families
   - unresolved ambiguities
6. User saves selected collections into a project or library.

### Important UI principle

Do not show this as "Paste prompt -> Create nodes."

That pattern is too small for the job. The UI should communicate that PSG is building a structured research package.

### Recommended surfaces

- `Research Intake`
- `Collection Navigator`
- `Evidence Inspector`
- `Prompt Browser`
- `Mutation Lab`
- `Package Review`

## 15. Recommended Node and Edge Semantics

### Minimum new semantic node families

- `SourceChunk`
- `Claim`
- `Evidence`
- `Theme`
- `Entity`
- `Constraint`
- `OpenQuestion`
- `PromptVariant`
- `MutationRule`

### Minimum edge semantics

- `derived_from`
- `supported_by`
- `contradicts`
- `references`
- `belongs_to`
- `expands`
- `suggests`
- `mutates_into`
- `composed_with`

These can begin as metadata-rich edge labels rather than a full new execution runtime.

## 16. Prompt Browser Product Direction

The user's "browser of prompts" idea is strong and should be treated as a first-class consumer of the research package.

### Browser capabilities

- browse prompts by source collection
- browse prompts by concept cluster
- browse prompts by style/mood/constraint
- compare sibling prompt variants
- rotate through saved prompt sets
- pin strong prompts back into reusable PSG fragments

### Mutation capabilities

- merge prompt families from multiple concept clusters
- swap style layers
- swap constraint layers
- blend prompts while retaining source provenance

### Guardrail

Mutation should not destroy provenance. A mutated prompt should still know which source nodes or concept nodes it came from.

## 17. AI Orchestration Direction

### Recommended architecture

Do not ask one model call to:

- read the entire research dump
- invent ontology
- build all nodes
- optimize prompts
- package the result

Instead use bounded passes:

1. source segmentation
2. extraction
3. clustering
4. prompt synthesis
5. validation and repair

### Agent outputs should be structured

Each pass should emit:

- nodes
- edges
- metadata
- confidence
- provenance
- warnings
- recommended follow-up actions

## 18. Suggested Manifest Contract

The manifest should answer:

- what collections were generated
- what source inputs they came from
- what parser version and strategy were used
- what confidence summary exists
- what collections are reusable assets vs project-local drafts

### Example sections

- `package_id`
- `title`
- `source_inputs`
- `collections`
- `generation_strategy`
- `confidence_summary`
- `review_status`

## 19. Risks

### 1. Schema sprawl

If this becomes another PSG dialect, it will deepen current format confusion.

### 2. Over-automation

If the system mutates prompts aggressively without provenance and review, users will not trust it.

### 3. False authority

Research parsing can produce plausible but weak claims. The model must expose uncertainty.

### 4. Monolithic outputs

A single huge parse response will be brittle, expensive, and hard to review.

### 5. Product drift into generic research app

This should stay focused on PSG-native graph authoring and prompt synthesis, not become a generic notebook competitor.

## 20. Key Product Decisions

### Decision 1

Treat this as a `research package generator`, not a prompt parser upgrade.

### Decision 2

Use multi-graph outputs by default.

### Decision 3

Keep canonical source artifacts PSG fragment-shaped where possible.

### Decision 4

Use a skill/agent workflow for orchestration.

### Decision 5

Make provenance and uncertainty first-class product concepts.

## 21. Phased Delivery Recommendation

### Phase 1: Research intake and source mapping

- paste large research text
- chunk into source graph
- extract basic concepts and claims
- save source and concept collections

### Phase 2: Prompt synthesis collections

- create prompt-ready graph fragments
- generate prompt browser views
- enable concept-based prompt rotation

### Phase 3: Mutation lab

- combine prompt families
- blend concepts and styles
- track mutation lineage

### Phase 4: Agent workflow hardening

- add iterative refine/rebuild passes
- add package review loops
- add quality scoring and repair

## 22. Guidance For Other Agents

### For implementation agents

- do not start by extending the simple prompt parser
- do not assume one graph is enough
- do not use the historical project-shaped PSG v2 document as the canonical research source format
- build provenance into the base model, not as an afterthought

### For AI/agent engineers

- design staged transforms, not one-shot completions
- make every pass inspectable and replayable
- preserve references to source chunks at each stage

### For frontend agents

- design this as a package-building workflow, not a modal with a textarea
- prioritize collection review, evidence inspection, and prompt browsing

### For product owner

- define success as "research became reusable PSG assets"
- not "the model produced impressive-looking node soup"

## 23. Open Questions

1. Should research packages live as project-local assets first, library assets second, or both?
2. Does PSG want formal semantic node types for research collections, or should v1 store them as metadata-rich generic nodes?
3. Should prompt mutation be deterministic and seed-aware from the start?
4. How much of the research package should be executable versus inspectable only?
5. What review gate is required before a research-derived prompt family is published to the shared library?

## 24. Recommendation

Proceed with discovery and design around a `Deep Research Parser` as a PSG-native research package generator with a skill-based orchestration model.

The best near-term product framing is:

"Turn deep research into reusable PSG research collections, prompt synthesis graphs, and prompt mutation surfaces."

That framing fits the current architecture better than a generic parser upgrade and gives product, design, and agent teams a clear target.

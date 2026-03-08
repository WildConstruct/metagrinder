# Metagrinder Agent Framework Plan

_Last updated: 2026-03-07_

## 1. Purpose

This document converts the current Metagrinder research-parser concept into an implementation-facing agent framework plan.

It is intended to answer:

- how the agent should reason about research material
- what passes exist
- what each pass reads and writes
- what heuristics belong in v1
- what the MVP build order should be

## 2. Core Framing

The Metagrinder should be built as a staged distillation pipeline, not a one-shot parser.

The agent should not try to:

- read the entire source
- invent all structure at once
- generate final prompt graphs in one completion

Instead, it should progressively distill research into bounded artifacts that remain inspectable and replayable.

The central rule is:

"Compress toward reusable scene logic, not summary prose."

For example, if the source concerns a `1950s New York Broadway audience on a cold evening`, the agent should not stop at a paragraph summary. It should extract reusable scene logic such as:

- wardrobe heuristics
- crowd composition
- movement and social behavior
- light sources
- weather and atmospheric conditions
- street materials and reflections
- class and style signals
- uncertainty and source strength

## 3. Distillation Layers

Every pass should preserve or emit material in these semantic layers.

### `source`

Exact chunked source coverage.

Examples:

- paragraph excerpts
- citations
- notes section boundaries
- speaker or document attribution

### `claim`

Statements the source appears to assert.

Examples:

- audiences wore heavier wool overcoats
- post-show crowds gathered under marquees
- wet pavement amplified theater lighting

### `concept`

Reusable semantic units.

Examples:

- Broadway theater crowd
- mid-century winter outerwear
- neon marquee spill
- curbside steam plume
- cold evening pedestrian density

### `prompt_material`

Prompt-ready fragments that can become PSG nodes.

Examples:

- dense theatergoers in wool coats beneath marquee glow
- visible breath and damp curb reflections
- post-show sidewalk crowd in mid-century evening dress

### `uncertainty`

Ambiguous, inferred, contradictory, or weakly evidenced material.

Examples:

- glove usage common but not universal
- exact hat prevalence depends on venue and year
- street wetness may be inferred from lighting reflections rather than stated directly

## 4. Pass Architecture

The initial framework should use six core passes and one optional review pass.

### Pass 1: `ingest`

Purpose:

- normalize raw research input
- split it into stable source units
- preserve section boundaries and source metadata

Input:

- raw text
- optional title
- optional source metadata

Output:

- `ingest.json`

Suggested shape:

```json
{
  "inputId": "src_001",
  "title": "Broadway street audience research",
  "chunks": [
    {
      "chunkId": "src_001_chunk_001",
      "text": "After evening performances, theatergoers in dark wool coats gathered under lit marquees...",
      "sectionLabel": "street observations",
      "sequence": 1
    }
  ]
}
```

Heuristics:

- preserve chunk order
- prefer paragraph and heading boundaries over arbitrary token windows
- do not discard repeated language yet
- attach coarse document labels when available

### Pass 2: `extract`

Purpose:

- derive claims, entities, motifs, constraints, and evidence from source chunks

Input:

- `ingest.json`

Output:

- `extract.json`

Suggested shape:

```json
{
  "claims": [],
  "conceptCandidates": [],
  "evidence": [],
  "openQuestions": [],
  "warnings": []
}
```

Heuristics:

- distinguish `quoted`, `paraphrased`, and `inferred`
- prefer extraction of visual and material facts over interpretive summaries
- separate environment, wardrobe, crowd behavior, lighting, and spatial cues
- mark uncertainty explicitly instead of flattening it
- preserve `sourceChunkIds` on every extracted record

### Pass 3: `classify`

Purpose:

- route extracted findings into graph families

Input:

- `extract.json`

Output:

- `classify.json`

Graph families for v1:

- `source-map`
- `claims-and-evidence`
- `concept-clusters`

Heuristics:

- `source-map` should prioritize traceability
- `claims-and-evidence` should distinguish strong claims from weak or inferred claims
- `concept-clusters` should organize by reusable scene categories

Recommended v1 concept buckets:

- wardrobe
- people and crowd
- environment and weather
- architecture and streetscape
- lighting
- materials and surfaces
- behavior and motion
- mood and social tone
- unresolved questions

### Pass 4: `synthesize`

Purpose:

- convert concepts and claims into prompt-ready PSG collections

Input:

- `classify.json`

Output:

- `synthesize.json`
- `prompt-synthesis.psg`

Optional later output:

- `prompt-mutations.psg`

Heuristics:

- synthesize from concepts, not raw chunks
- keep prompt fragments composable
- separate environmental, wardrobe, crowd, and lighting fragments
- retain source and concept lineage for every prompt fragment
- prefer reusable prompt families over one polished paragraph

Example prompt family groups:

- crowd appearance
- evening outerwear
- street atmosphere
- marquee lighting
- cold-weather behavior

### Pass 5: `score`

Purpose:

- estimate reliability and usefulness of extracted material

Input:

- `extract.json`
- `classify.json`
- `synthesize.json`

Output:

- `score.json`

Scoring dimensions:

- extraction confidence
- provenance completeness
- normalization confidence
- prompt value
- ambiguity risk

Heuristics:

- quoted material with direct support scores higher than weak inference
- repeated evidence across chunks increases confidence
- vivid but unsupported phrasing should be down-ranked
- highly reusable scene concepts should receive higher prompt-value

### Pass 6: `package`

Purpose:

- emit PSG collections plus the thin package manifest

Input:

- prior pass outputs

Output:

- `source-map.psg`
- `claims-and-evidence.psg`
- `concept-clusters.psg`
- `prompt-synthesis.psg`
- `research-package.json`

Optional later outputs:

- `prompt-mutations.psg`
- `utdg-candidates.json`
- `utdg-submission.json`

Heuristics:

- package user-facing PSG collections first
- do not emit UTDG submission artifacts in the first MVP unless rights and provenance are already present
- mark incomplete collections clearly in package metadata

### Pass 7: `review` (recommended)

Purpose:

- present unresolved issues and suggested next actions

Input:

- all pass outputs

Output:

- `review.json`

Suggested fields:

- unresolved ambiguities
- missing provenance
- weak prompt families
- duplicate concepts
- suggested human review actions

## 5. Agent Roles

The framework can start as one orchestrated process, but its conceptual roles should remain distinct.

### Research parser agent

- owns `ingest`
- preserves source coverage

### Extraction agent

- owns `extract`
- identifies claims, concepts, and uncertainty

### Classification agent

- owns `classify`
- maps findings into graph families

### Prompt synthesis agent

- owns `synthesize`
- builds prompt-ready PSG fragments

### Validation agent

- owns `score`
- evaluates confidence, provenance, and prompt usefulness

### Packaging agent

- owns `package`
- writes PSG collections and package manifest

### Review agent

- owns `review`
- recommends follow-up actions without mutating source truth

## 6. Hard Rules For V1

1. No one-shot hidden parse that skips intermediate artifacts.
2. Every derived record must retain lineage to one or more source chunks.
3. The system must distinguish quoted, paraphrased, and inferred material.
4. Uncertainty must be represented explicitly.
5. PSG collections are the canonical user-facing output.
6. UTDG contribution artifacts remain separate from user package generation.
7. Canonical UTDG is not written directly from the parser.

## 7. MVP Build Recommendation

The shortest useful MVP should implement only private research package generation.

### Required MVP scope

- one CLI entrypoint such as `run-metagrinder-mvp`
- one input text file
- deterministic chunking
- heuristic extraction
- concept clustering
- prompt synthesis generation
- package writer
- validation step

### Required outputs

- `ingest.json`
- `extract.json`
- `classify.json`
- `synthesize.json`
- `score.json`
- `source-map.psg`
- `concept-clusters.psg`
- `prompt-synthesis.psg`
- `research-package.json`

### Explicitly deferred

- mutation lab
- UTDG submission package
- curator workflow
- authority reconciliation
- live browser UI
- external data fetching

## 8. Development Order

### Phase A: Contracts

- define JSON contracts for all pass outputs
- define minimal PSG writer requirements

### Phase B: Deterministic Pipeline

- implement CLI orchestrator
- implement `ingest`
- implement heuristic `extract`
- implement `classify`

### Phase C: PSG Output

- implement `prompt-synthesis` builder
- implement collection writers
- implement `research-package.json` writer

### Phase D: Validation and Repair

- add scoring
- add review report
- add schema validation
- add repair rules for malformed collections

### Phase E: Optional Agent Enhancement

- allow bounded LLM assistance inside individual passes
- keep pass contracts fixed
- keep heuristic fallback available

## 9. Immediate Implementation Recommendation

Build the first version as a deterministic local pipeline with optional future LLM enhancement.

That means:

- use rules and templates for chunking, extraction, and clustering first
- treat LLM assistance as a bounded later upgrade, not a prerequisite
- make every pass save inspectable JSON to disk

This gives the project a real substrate for future Claude-style or multi-agent workflows without forcing the first build to depend on opaque model behavior.

## 10. Recommendation

Proceed with Metagrinder as a pass-oriented research distillation framework whose first implementation target is:

"Take one research document, turn it into inspectable source, concept, and prompt PSG collections, and preserve provenance at every step."

That is the smallest implementation that is both believable and extensible.

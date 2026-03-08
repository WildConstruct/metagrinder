# Metagrinder Research Prompt Best Practices

_Last updated: 2026-03-07_

## 1. Purpose

This note defines a recommended structure for upstream research prompts and research responses that will later be ingested by the Metagrinder.

It is not a hard schema.

Its purpose is to:

- improve parse quality
- make source material easier to distill
- preserve spontaneous discoveries
- avoid overfitting the system to one subject domain

## 2. Core Principle

The parser should remain subject-agnostic.

That means research guidance should be:

- strong enough to improve structure
- loose enough to allow unexpected findings
- framed as a taxonomy and prompting pattern, not a rigid form

## 3. Recommended Research Shape

When using an upstream LLM to prepare research for Metagrinder, ask for output in these layers:

1. `source notes`
2. `key observations`
3. `reusable concepts`
4. `uncertainties and disputes`
5. `scene or prompt implications`
6. `stray discoveries`

This keeps the output parse-friendly without forcing every domain into the same narrow ontology.

## 4. Lightweight Taxonomy

The initial research should try to separate information into portable buckets when possible:

- people / actors / agents
- objects / artifacts
- environment / setting
- materials / surfaces
- behavior / process
- lighting / atmosphere
- mood / tone
- constraints / exclusions
- chronology / temporal cues
- evidence / provenance
- uncertainty / contradiction
- unexpected findings

These are not mandatory headings.

They are a best-practices taxonomy that helps both human readers and the parser.

## 5. What To Ask The Upstream LLM To Do

Recommended instructions:

- preserve direct observations separately from interpretation
- mark weak inferences explicitly
- keep reusable concepts short and nameable
- call out contradictions instead of resolving them silently
- include a small section for unexpected or anomalous findings
- avoid collapsing everything into polished prose

## 6. What To Avoid

Avoid asking the upstream LLM for:

- one beautiful summary paragraph
- a single authoritative answer with uncertainty removed
- only final prompt prose
- aggressive normalization that deletes source nuance
- rigid JSON unless the research workflow already needs it

Those outputs are harder for the parser to inspect, classify, and score.

## 7. Suggested Prompt Template

Use this as a recommended prompt pattern for upstream research generation:

```text
Prepare research notes for later parser ingestion.

Keep the output readable prose with headings, not strict JSON.

Organize the response into:
- Source Notes
- Key Observations
- Reusable Concepts
- Uncertainties / Contradictions
- Scene or Prompt Implications
- Unexpected Findings

Guidelines:
- Separate direct evidence from inference.
- Keep reusable concepts short and reusable.
- Mark uncertainty explicitly.
- Preserve surprising or domain-specific findings instead of over-normalizing them.
- If a useful detail does not fit the main outline, place it under Unexpected Findings instead of omitting it.
```

## 8. Parser Implications

This structure maps cleanly onto the current Metagrinder passes:

- `Source Notes` supports `ingest`
- `Key Observations` supports `extract`
- `Reusable Concepts` supports `classify`
- `Scene or Prompt Implications` supports `synthesize`
- `Uncertainties / Contradictions` supports `score` and `review`
- `Unexpected Findings` protects spontaneous discoveries from being lost early

## 9. Recommendation

Treat this as guidance for upstream research generation, not a required intake contract.

The best product posture is:

"Guide the research into parse-friendly layers, but leave room for discoveries the taxonomy did not predict."

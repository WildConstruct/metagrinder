# Spaghettiwestern Parser Comparison

_Date: 2026-03-09_

## Files

- Raw source: [spaghettiwestern.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/spaghettiwestern.md)
- Parser-friendly rewrite: [spaghettiwestern-parser-friendly.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/spaghettiwestern-parser-friendly.md)

## What Changed In The Rewrite

The parser-friendly version did not change the core subject. It changed the shape of the material.

Applied changes:

- restored real markdown headings instead of flattened inline section markers
- split one dense block into 11 semantically bounded sections
- separated context, observations, reusable concepts, assembly logic, and uncertainty
- converted long prose into short bullets
- pulled archetypes, wardrobe, behavior, and sensory material into reusable lists
- isolated generation advice from research observations
- preserved ambiguity explicitly under `Uncertainties / Contradictions`
- preserved meta-observations explicitly under `Unexpected Findings`

## Artifact Comparison

### Raw

- chunks: `1`
- claims: `191`
- concepts: `161`
- evidence records: `1`
- open questions: `29`
- contradictions: `1`
- weak concepts: `23`
- confidence: `overall medium`, `extraction low`, `normalization low`

### Parser-Friendly

- chunks: `11`
- claims: `33`
- concepts: `32`
- evidence records: `11`
- open questions: `3`
- contradictions: `0`
- weak concepts: `3`
- confidence: `overall medium`, `extraction medium`, `normalization medium`

## Interpretation

The raw file overloaded the deterministic extractor. Flattened headings, run-on structure, table text, and mixed intent caused the parser to treat guidance, examples, and context as one undifferentiated research mass.

The parser-friendly version improved performance because it gave the intake step:

- stable chunk boundaries
- recognizable section labels
- shorter claim units
- clearer separation between factual notes and generation advice

## Recommendation: Add A Lightweight Pre-Parser

Yes. A pre-parser is justified.

It should not rewrite content aggressively. It should only normalize structure before Metagrinder proper runs.

Suggested pre-parser responsibilities:

1. restore missing heading boundaries from common inline patterns like `I.`, `II.`, `A.`, `B.`
2. split dense paragraphs at repeated `Description 1`, `Description 2`, `IF`, `THEN`, and `Table` markers
3. detect flattened list runs and convert them into bullet-like chunks
4. separate `research context` from `generation instructions` using soft tags
5. keep the original source text available for provenance and audit

Suggested non-goals:

- no semantic summarization
- no heavy paraphrasing
- no domain-specific ontology
- no destruction of original phrasing

## Practical Conclusion

Metagrinder can parse dense markdown briefs now, but quality degrades sharply when formatting collapses. A structural pre-parser would likely give a meaningful quality gain across subject areas without making the system domain-specific.

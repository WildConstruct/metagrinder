# Semantic Baseline Starter

This file defines the minimum viable second lane for tonight's comparison.

## Purpose

Create a non-heuristic comparison target that is still bounded enough to build quickly.

The goal is not to solve Epic 4 tonight.

The goal is to produce a meaningful contrast against the current heuristic baseline.

## Minimum Shape

The semantic baseline should:

1. read the same fixed corpus from `judgments.json`
2. produce the same artifact shape as the heuristic baseline
3. use at least one semantic step that is not plain keyword mode matching

## Acceptable Semantic Steps

For tonight, any of the following count:

- embedding similarity against hand-written mode exemplars
- embedding similarity against brief summaries
- LLM classification from chunk summaries with bounded output schema
- agent-written rationale using retrieved exemplar matches

## Recommended Narrow Scope

Use mode exemplars first.

### Suggested mode exemplar shape

- `historical-scene-research`
  - scene packet
  - crowd behavior
  - wardrobe
  - lighting
  - weather
- `environment-observation`
  - place observation
  - structure/material/air/light conditions
  - movement through a setting
- `character-framework`
  - role/archetype taxonomy
  - appearance/behavior/capabilities
  - reusable character-generation notes
- `style-analysis`
  - genre
  - tone
  - reference points
  - aesthetic strategy
- `procedural-guide`
  - instructions
  - templates
  - decision rules
  - workflow logic
- `mixed`
  - multiple strong mode pulls

## Output Contract

Write outputs to:

- `runs/semantic-baseline/<brief-id>/mode-detection.json`
- `runs/semantic-baseline/<brief-id>/category-hypothesis.json`
- `runs/semantic-baseline/<brief-id>/assumption-review.json`
- `runs/semantic-baseline/<brief-id>/augmentation-plan.json`

## Success Condition For Tonight

The semantic baseline is successful tonight if:

1. it runs on the whole corpus
2. it beats the heuristic baseline on at least one difficult brief
3. its rationales are not less inspectable than the heuristic baseline

## Non-goals

- production integration
- perfect category selection
- full evaluator sophistication
- broad architecture decisions beyond first comparative evidence

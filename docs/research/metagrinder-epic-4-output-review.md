# Metagrinder Epic 4 Output Review

_Last updated: 2026-03-09_

## Purpose

Double-check whether the Epic 4 artifacts are useful enough to surface to an operator before wiring a dedicated review UI.

The question is not whether the artifacts validate. They do.

The question is whether the current outputs are specific, legible, and action-driving enough to justify a human review step.

## Sample Readout

### 1. Broadway audience brief

- detected mode: `historical-scene-research`
- confidence: `high`
- recommended focus:
  - `wardrobe`
  - `people-and-crowd`
  - `weather-and-environment`
- warnings: none
- augmentation prompts:
  - add period photographs or archival visuals
  - add primary-source descriptions or reportage

Assessment:

This is useful. The mode is correct, the category priorities are plausible, and the augmentation suggestions are concrete rather than decorative.

### 2. Spaghettiwestern framework brief

- detected mode: `mixed`
- confidence: `medium`
- strongest candidate modes:
  - `character-framework`
  - `style-analysis`
  - `procedural-guide`
- recommended focus:
  - `source-notes`
  - `reusable-concepts`
- warnings:
  - mixed-mode brief
  - template chunks detected
  - generation-rule chunks detected
- verification targets:
  - separate observations from generation guidance
  - review template chunks manually
  - confirm which rules should affect prompt assembly

Assessment:

This is also useful. The artifact does the right thing by refusing to over-commit to a single mode and by surfacing the exact reasons an operator should slow down.

### 3. Environment observation fixtures

Fixtures checked:

- `research-input-greenhouse.txt`
- `research-input-shipyard.txt`
- `research-input-desert-outpost.txt`

Observed pattern before tuning:

- detected mode was usually `environment-observation`
- confidence often stayed `medium`
- top scores were weak, typically in the `2-4` range
- recommended focus was too generic, usually:
  - `terrain`
  - `atmosphere`

Assessment:

That version was directionally right, but too generic to surface comfortably.

Two problems show up:

1. the keyword model is thin for environment briefs, so confidence is only moderately convincing even when the mode is probably correct
2. the proposed focus buckets do not adapt enough to the actual brief content such as greenhouse structures, industrial yard activity, or desert outpost materials

Observed pattern after tuning:

- greenhouse brief now emphasizes `structures`, `atmosphere`, and `lighting`
- shipyard brief now emphasizes `movement`, `lighting`, and `atmosphere`
- desert brief now emphasizes `materials`, `atmosphere`, and `structures`
- category rationales now cite matched brief signals instead of only repeating the detected mode

Assessment:

This is materially closer to a useful operator review artifact. It still is not a final UX decision, but the outputs now justify another round of inspection.

## What Looks Ready

- mode detection for clearly historical scene briefs
- mixed-mode detection for flattened framework plus procedural documents
- chunk-kind warnings for templates and generation rules
- augmentation suggestions when the brief obviously needs source separation

## What Does Not Yet Feel Ready To Surface

- generic category proposals for environment briefs
- low-information confidence readouts when scores are technically nonzero but still weak
- review outputs that do not explain why a category was proposed beyond the research-mode mapping

## Recommendation Before UI Wiring

Do not treat Story 4 as blocked, but do not lock in a review UI until one more pass confirms the outputs stay useful beyond the current fixtures.

First improve the usefulness of what would be shown:

1. pressure-test the tuned heuristics against additional non-fixture briefs
2. keep category proposals partially evidence-driven instead of only mode-driven
3. expose short category rationales tied to matched chunks or section labels
4. distinguish "correct but weak" mode guesses from genuinely convincing detections

## Practical Acceptance Gate

Epic 4 review outputs are worth surfacing once the following hold:

1. operators can see not only the selected mode, but why the mode beat nearby alternatives
2. category priorities feel tailored on at least the greenhouse, shipyard, and desert fixtures
3. warnings highlight chunk-shape risks without producing noise on ordinary research packets
4. an operator looking at the artifact can make a faster decision than they could by rereading the whole brief

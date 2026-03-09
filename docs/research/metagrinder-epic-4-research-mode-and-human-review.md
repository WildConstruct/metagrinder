# Metagrinder Epic 4: Research Mode Detection And Human Review

_Last updated: 2026-03-09_

## 1. Epic Goal

Add a human-in-the-loop layer that detects what kind of deep research has been provided, proposes the likely category system for that research, and lets the operator steer extraction before full package generation.

This epic should reduce parser drift on dense briefs by making Metagrinder explicit about its assumptions instead of silently forcing every document through the same extraction shape.

## 2. Why This Epic Is Next

Epic 1 established deterministic intake and package generation.

Epic 2 added multi-document provenance, corroboration, and conflict handling.

Epic 3 added bounded prompt mutation.

The next failure point is not package output. It is the mismatch between document type and extraction strategy. Dense research briefs, frameworks, and scene notes need different category assumptions.

## 3. Core Product Decision

Metagrinder should first identify the research mode, then propose the category schema, then let the user confirm or adjust priorities before extraction widens.

The parser should not assume that every deep-research document is best handled with the same ontology.

## 4. In Scope

- research mode detection
- category hypothesis generation
- operator-facing priority and importance review
- chunk intent typing
- extraction strategy selection by research mode
- review artifacts for assumptions and suggested augmentations

## 5. Out Of Scope

- full autonomous web research
- final UTDG lookup integration
- pricing and billing implementation
- complex frontend account features
- hidden model-only decisioning with no inspectable artifact

## 6. Research Modes To Support First

- historical scene research
- character or archetype framework
- material or industrial reference
- environment observation
- style or genre analysis
- procedural or generation guide

## 7. Required Artifacts

- `mode-detection.json`
- `category-hypothesis.json`
- `assumption-review.json`
- optional `augmentation-plan.json`

These should sit ahead of `extract.json`, not replace it.

## 8. Human-In-The-Loop Flow

1. intake and structural cleanup
2. detect likely research mode
3. propose category schema and priorities
4. surface ambiguities and likely gaps
5. operator chooses:
   - proceed as-is
   - adjust priorities
   - request augmentation guidance
6. run extraction using the chosen schema

## 9. Monetizable Augmentation Layer

The likely upcharge is not “better magic parsing.” It is a bounded augmentation pass.

That pass should provide:

- assumption audit
- suggested category refinements
- verification targets
- suggested missing source types
- recommended follow-up research directions

This can be expressed as a higher-value review and planning layer rather than a vague premium model call.

## 10. Success Criteria

Epic 4 is complete when:

1. Metagrinder can classify a research brief into a small, explicit set of research modes
2. it can propose a plausible category schema for that mode
3. an operator can confirm or redirect the extraction priorities before package generation
4. the resulting extraction quality improves on dense non-uniform briefs
5. assumption and augmentation outputs are inspectable artifacts

## 11. Risks

### Risk 1: overfitting to known brief types

Mitigation:

- keep research modes broad and extensible

### Risk 2: too much operator friction

Mitigation:

- keep the human review step lightweight and optional for simple inputs

### Risk 3: premium layer feels arbitrary

Mitigation:

- make augmentation outputs concrete, inspectable, and operational

## 12. Recommendation

Build the baseline human review path first.

Do not start with pricing mechanics. Start with the artifact model:

- what Metagrinder thinks the document is
- why it thinks that
- what categories it wants to use
- what it suggests doing next

If that is useful, the premium augmentation layer becomes easy to justify later.

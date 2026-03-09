# Epic 4 Autoresearch Starter

This folder is a small starter harness for tonight's framework search.

## Files

- `program.md`
  - the control document for the research agent
- `judgments.json`
  - fixed corpus plus working expected judgments
- `evaluate.js`
  - minimal evaluator for comparing run outputs

## Expected Run Layout

The evaluator expects a run directory like:

```text
some-run/
  broadway/
    mode-detection.json
    category-hypothesis.json
    assumption-review.json
  greenhouse/
    ...
```

Each brief ID must match the IDs in `judgments.json`.

## Minimal Usage

```bash
node experiments/epic4-autoresearch/evaluate.js path/to/run-dir
```

## Baseline Driver

To regenerate and score both current baselines:

```bash
node experiments/epic4-autoresearch/run-baselines.js
```

This will:

1. regenerate the heuristic baseline
2. regenerate the semantic baseline
3. score both with the shared evaluator

## Tonight Goal

Use this harness to compare at least:

1. heuristic baseline
2. semantic or embedding-ranked baseline

Do not overbuild the infrastructure before the first comparison run exists.

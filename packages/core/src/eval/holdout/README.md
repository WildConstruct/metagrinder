# Held-out Evaluation Fence

This directory contains policy only. Held-out briefs and judgments must never be
stored in this repository.

Per `docs/research/metagrinder-reimplementation-loop.md` rule A4.1, agents must
never read or execute the held-out corpus. The human operator owns its contents,
provider configuration, and runs.

Expected external layout:

```text
<METAGRINDER_HOLDOUT_DIR>/
  judgments.json
  briefs/
    <brief-id>.<ext>
```

Operator command:

```text
$env:METAGRINDER_HOLDOUT_DIR='C:\path\outside\the\repo'
pnpm eval:holdout -- record <anthropic|codex-cli> C:\path\to\holdout-run
```

The command runs the rebuilt pipeline and writes
`holdout-eval-report.json` into the specified run folder. A later `replay` run
must reuse the same provider/model identity as the recorded cache.

# Metagrinder GitHub Bootstrap

This document records the initial repo-management setup for the standalone Metagrinder project.

## Current Status

- `main` exists and is the active default branch
- Epic 3 has been merged
- local focused test suite is green
- PR templates, issue templates, and contributor guidance are now part of the repo

## Recommended Labels

- `epic`
- `story`
- `mvp`
- `research`
- `parser`
- `ci`
- `docs`

## Initial Issue Set

Create these as the first tracked work items:

1. `Epic 1 Closeout: Research Intake And Distillation Hardening`
2. `Epic 2 Closeout: Multi-Document Intake Hardening`
3. `Epic 3 Planning: Prompt Mutation Lab`
4. `Epic 3 Story 1: Mutation Contract And Fragment Compatibility Rules`
5. `Epic 3 Story 2: Controlled Variant Generation`
6. `Epic 3 Story 3: Mutation Review And Safety Constraints`

These were useful bootstrap issues. New work should continue from the live epic/story issue structure already in GitHub rather than recreating the bootstrap set.

## Branch Protection

Protect `main` with:

- pull requests required before merge
- at least 1 approval
- stale review dismissal enabled
- conversation resolution required
- force pushes disabled
- deletions disabled
- required status check: `metagrinder-tests`

Blocked on 2026-03-08: GitHub returned `403 Upgrade to GitHub Pro or make this repository public to enable this feature` when applying branch protection to the current private repository.

## CI Baseline

The minimum required workflow is [metagrinder-ci.yml](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/.github/workflows/metagrinder-ci.yml), which runs:

```bash
pnpm install --frozen-lockfile
pnpm test:metagrinder
```

Blocked on 2026-03-08: the workflow is registered, but GitHub Actions runs are returning `startup_failure` with `path: BuildFailed` before job creation. Local `pnpm test:metagrinder` passes, so this currently looks like a GitHub-side repo or org configuration problem rather than a failing test command.

## Repo Hygiene Baseline

The repo should keep these files current:

- [README.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/README.md)
- [CONTRIBUTING.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/CONTRIBUTING.md)
- [.github/PULL_REQUEST_TEMPLATE.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/.github/PULL_REQUEST_TEMPLATE.md)
- [.github/CODEOWNERS](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/.github/CODEOWNERS)
- [.github/ISSUE_TEMPLATE/story.yml](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/.github/ISSUE_TEMPLATE/story.yml)
- [.github/ISSUE_TEMPLATE/bug.yml](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork/.github/ISSUE_TEMPLATE/bug.yml)

## Manual GitHub Checklist

Because branch protection is currently blocked at the plan level, keep this manual checklist in place:

1. Open PRs instead of pushing feature work straight to `main`.
2. Require `pnpm test:metagrinder` locally before merge.
3. Keep epic/story issues linked in PR descriptions.
4. Keep labels applied consistently so issue filters stay useful.

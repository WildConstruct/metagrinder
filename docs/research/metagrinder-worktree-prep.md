# Metagrinder Worktree Prep

_Last updated: 2026-03-07_

## Purpose

This note prepares the staged fork operation for the Metagrinder subproject without executing it yet.

## Recommended Safe Target

Parent directory:

- `/mnt/c/Users/Owner/CascadeProjects`

Prepared sibling worktree path:

- `/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork`

Current source repo:

- `/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti`

Current source branch at prep time:

- `fix/stabilize-functional-baseline`

Current source commit at prep time:

- `487d2109a`

## Recommended Branch Name

Use:

- `exp/metagrinder-fork-staging`

This keeps the experimental branch clearly separate from MVP and stabilization work.

## Prepared Execution Script

Prepared but not executed:

- [prepare-metagrinder-worktree.sh](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/scripts/prepare-metagrinder-worktree.sh)

## What The Script Will Do

When you choose to run it, the script will:

1. verify the target sibling folder does not already exist
2. create a new git worktree at the sibling path
3. create and check out the staging branch there
4. print the next recommended steps for isolating or pruning the subproject work

## Why This Is Safe

This does not switch branches in the active checkout.

It does not move files in the current repo.

It does not write into the parent folder until you explicitly run the script.

That makes it safe for other agents working in the current checkout.

## After Creation

Once the worktree exists, the next recommended actions inside the new worktree are:

1. review the fork boundary doc
   - [metagrinder-fork-boundary.md](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/docs/research/metagrinder-fork-boundary.md)
2. review the path manifest
   - [metagrinder-subproject-manifest.json](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/docs/research/metagrinder-subproject-manifest.json)
3. decide whether the fork should:
   - keep the full repo with isolated branch history
   - or prune to the manifest-defined subproject path set

## Recommendation

Create the worktree first.

Do not prune or delete anything during the same step.

That keeps the first fork action reversible and low-risk.

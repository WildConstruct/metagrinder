Main agent cleanup note

The Metagrinder/UTDG subproject has been staged into a separate worktree at:

- `/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti-metagrinder-fork`
- branch: `exp/metagrinder-fork-staging`

You are clear to clean Metagrinder-specific work out of the main repo if the goal is
to keep the MVP branch focused.

What has been preserved in the fork:

- `docs/research/` Metagrinder, UTDG, semantic-world-authoring, rainy-alley, and reverse-analysis docs
- `docs/psg-format-v2.md`
- `docs/psg-file-format-implementation.md`
- `docs/external-tools-psg-generation-guide.md`
- `packages/core/types/metagrinder.ts`
- `packages/core/types/metagrinder.runtime.js`
- `packages/core/scripts/run-rainy-alley-prototype.js`
- `packages/core/scripts/validate-metagrinder-fixtures.js`
- `packages/core/scripts/validate-rainy-alley-prototype.js`
- `packages/core/scripts/validate-rainy-alley-shot-differences.js`
- `packages/core/tests/fixtures/metagrinder/`
- `packages/core/tests/metagrinder.test.ts`
- PSG reference files under `packages/core/fileFormats/`, `packages/core/services/`, `packages/core/runtime/nodes/epic1/`, and `packages/core/utils/unifiedPromptParser.ts`
- UTDG reference docs under `packages/core/docs/`

Important caveat:

- this fork was deliberately pruned and its manifests were simplified
- the fork currently has no installed dependencies, so it is a preserved implementation slice, not a freshly verified runtime checkout

Recommended cleanup target in the main repo:

- remove Metagrinder-specific docs, contracts, fixtures, scripts, and prototype artifacts that are now preserved in this fork
- keep unrelated PSG/MVP work in the main repo

If you need a source-of-truth list for the staged subproject, use:

- `docs/research/metagrinder-subproject-manifest.json`
- `docs/research/metagrinder-fork-boundary.md`

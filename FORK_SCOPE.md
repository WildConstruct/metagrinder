# Metagrinder Fork Scope

This fork is a pruned staging branch focused on the `Metagrinder`, `UTDG`, and `PSG`
implementation surface.

It intentionally keeps:

- Metagrinder contracts, runtime scripts, fixtures, and validators
- UTDG reference docs and integration notes
- PSG format and parser implementation references
- research and prototype docs needed to continue implementation

It intentionally removes:

- unrelated app surfaces
- frontend/client packages not needed for this prototype
- server/API/runtime areas not required for the Metagrinder slice
- historical repo material that does not support PSG, UTDG, or Metagrinder work

Start here:

- `docs/research/`
- `docs/psg-format-v2.md`
- `docs/psg-file-format-implementation.md`
- `docs/external-tools-psg-generation-guide.md`
- `packages/core/docs/utdg-api-specification.md`
- `packages/core/types/metagrinder.ts`
- `packages/core/scripts/run-rainy-alley-prototype.js`

Validation entrypoints:

- `npm run validate:metagrinder --workspace @prompt-spaghetti/core`
- `npm run validate:rainy-alley-prototype --workspace @prompt-spaghetti/core`
- `npm run validate:rainy-alley-shot-differences --workspace @prompt-spaghetti/core`

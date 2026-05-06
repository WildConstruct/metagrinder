# Metagrinder Scene Grammar Implementation Checkpoint

This checkpoint records the current Metagrinder scene-grammar implementation after the source-lifecycle hardening loops. It is a handoff document, not a feature proposal.

## What Changed From The Original MVP

The original MVP produced basic research artifacts and PSG outputs from source text. The current implementation adds a scene-grammar branch with:

- Scene grammar extraction for archetypes, location zones, compatibility rules, negative constraints, ethical constraints, visual references, samples, evaluations, and Prompt Spaghetti-compatible flat PSG branch graphs.
- A semantic choice graph boundary (`semantic-choice-graph.json`) between Codex brief analysis and PSG export, so choice axes can be inspected before Prompt Spaghetti import.
- Research gaps and query planning derived from the scene grammar.
- Retrieval policy and retrieval boundary artifacts for mock, dry-run, cache-replay, fixture-live, and guarded generic HTTP provider runs.
- Candidate-only live provider output with cache writes, response logs, source typing, and inspection reports.
- Canonical source registry, source evidence, source claims, source claim review, and citation-gated grammar revisions.
- Operator revision state, accepted/rejected/pending revision handling, accepted grammar deltas, accepted scene grammar, and base/accepted PSG compile targets.

No page scraping, automatic live source-claim extraction, broad live search, or automatic grammar mutation from live results is enabled.

## Current Artifact Pipeline

```text
ingest
-> extract/classify
-> scene grammar
-> semantic choice graph
-> gaps/query plan
-> retrieval policy
-> candidates
-> source approval
-> evidence/claims
-> citation review
-> grammar revisions
-> revision state
-> accepted deltas
-> accepted grammar
-> Prompt Spaghetti PSG compile
```

## Agentic Scene Grammar Architecture

Scene grammar is treated as a derived artifact from original inputs. The base grammar is source-of-record for extracted scene structure until an operator accepts grammar revisions. Accepted grammar is a separate artifact. Sampling, evaluation, plausibility review, flat Prompt Spaghetti graph generation, and branch graph generation consume either the base grammar or accepted grammar depending on the explicit compile target.

The historical crowd fixture, medieval market fixture, and perturbed historical wording fixture prove the grammar extractor is not limited to one exact input phrasing.

## Retrieval Safety Chain

Retrieval is split into policy, query attempts, candidates, cache, approval, evidence, claims, review, revisions, and accepted deltas. Live and live-shaped provider output enters only as retrieval candidates.

Candidate-only outputs include:

- `retrieval-candidates.json`
- `candidate-inspection.json`
- `candidate-inspection.md`
- `live-retrieval-requests.json`
- `live-retrieval-cache-write.json`
- `retrieval-cache-manifest.json`
- `provider-preflight-report.json`
- `provider-request-shapes.json`
- `provider-response-log.json`
- `provider-error-report.json`
- `real-endpoint-proof-report.json`

These artifacts are inspectable but do not directly create source claims or grammar revisions.

## Source Registry, Evidence, And Claims

The source lifecycle is:

```text
approved source result
-> source-registry.json
-> source-evidence.json
-> source-claims.json
-> source-claim-review.json
```

Source records are separate from evidence excerpts, and evidence records are separate from claims. Claims point to evidence IDs. Citation review gates whether claims can support material accepted grammar deltas.

## Revision-State Workflow

Grammar revisions are proposed from reviewed source claims. Operator state may mark revisions accepted, rejected, or pending. Only accepted revisions can be applied. Rejected and pending revisions remain inspectable but do not change accepted scene grammar.

Accepted revisions produce `accepted-grammar-deltas.json`, which records before/after values, material versus confirmation behavior, source claim IDs, evidence IDs, citation status, and warnings.

## Accepted Grammar Deltas

The bounded applicator supports material changes such as archetype weight ranges, compatibility rule effects, negative-constraint enforcement metadata, and support/confidence updates. A revision that does not change a target field is recorded as a confirmation, not a mutation.

Accepted scene grammar is produced from base scene grammar plus accepted, citation-allowed deltas. PSG compilation can target base or accepted grammar.

## Candidate-Only Live Boundary

The live boundary currently supports:

- `fixture-live`: live-shaped fixture provider, no network.
- `generic-http-search`: generic HTTP search adapter behind hard guards.
- Missing real config proof: safe skipped artifacts when the ignored local real config is absent.

The real local config path is ignored by git:

```text
packages/core/tests/fixtures/metagrinder/provider-config-generic-http-search-real.local.json
```

## Provider Contract Status

Provider contract artifacts define provider status, network requirements, candidate-only enforcement, cache support, request shapes, response logs, provider errors, and pilot/proof reports.

The generic HTTP adapter can run with injected/fake HTTP in tests and can accept no-auth or auth-required configs. Secrets are redacted from persisted artifacts. No committed config contains real endpoint secrets.

## What Remains Mock Or Fixture-Only

- Broad live retrieval remains disabled.
- Tests use fake or fixture provider payloads.
- No real endpoint config is committed.
- Selector extraction from pages is not implemented.
- Source typing remains deterministic heuristics.
- Operator workflow is still file-backed. The Workbench now provides a partial local review surface for opening runs, viewing artifacts, reusing Codex semantic parses, and writing review/state files.

## What Remains Intentionally Disabled

- Page scraping.
- Automatic source-claim creation from live candidates.
- Automatic grammar revision creation from live candidates.
- Automatic accepted-scene-grammar mutation during live runs.
- Broad live search beyond the one-query guarded provider boundary.

## Deferred Roadmap Status

| Item | Status | Note |
|---|---|---|
| Workbench artifact dashboard | Implemented | Local file-backed surface exists for runs, artifacts, semantic parse review, PSG export, and operator state files. |
| Previous run history | Partially implemented | Recent local runs are discoverable from the Workbench runs folder; no database or global workspace index. |
| Codex semantic parsing | Partially implemented | Local Codex runner and import/rebuild path exist; quality depends on reviewed Codex output contracts. |
| Linear semantic PSG graph | Partially implemented | Semantic PSG now renders from `semantic-choice-graph.json` as age/sex plus sex-conditioned wardrobe lanes; fully conditional role/type subgraphs remain future work. |
| Real provider retrieval | Intentionally deferred | Provider contract and guarded adapter scaffolding exist, but broad live retrieval remains disabled. |
| Page scraping and selector extraction | Intentionally deferred | No page content fetching or selector extraction is enabled. |
| Automatic source-claim extraction | Intentionally deferred | Candidates and pasted citations do not become verified claims without review gates. |
| Automatic grammar mutation | Intentionally deferred | Accepted grammar only changes through accepted, citation-gated revisions. |
| Operator approval UX | Partially implemented | Workbench writes review/state files, but there is no collaboration, auth, or full product shell. |

## What Must Never Happen

- Live candidates must never create source claims directly.
- Live candidates must never create grammar revisions directly.
- Unapproved candidates must never enter `source-registry.json` or `source-claims.json` as accepted evidence.
- Rejected or ambiguous approvals must not promote candidates.
- Rejected or `needs_review` citations must block material grammar deltas unless an explicit override is present.
- Low-quality sources must not create high-confidence revisions.
- Accepted grammar must only apply accepted revisions.
- PSG compile target must be explicit: `base` or `accepted`.

# Metagrinder RALPH Checkpoint Review

## 1. What Changed

This checkpoint turns the Metagrinder MVP into a guarded scene-grammar and research-source pipeline. The staged work adds scene grammar extraction, generic fixtures, PSG v2 scene/branch graph output, source registry and evidence artifacts, revision-state handling, accepted grammar deltas, candidate-only retrieval boundaries, provider contracts, candidate inspection reports, selector-based approval, and consolidation documentation.

## 2. Why It Changed

The MVP could emit useful research artifacts, but it could not prove source integrity or safe movement from research gaps to accepted grammar. The new layers make each transition explicit:

- Claims are traceable to source evidence.
- Revisions are traceable to reviewed source claims.
- Accepted grammar is traceable to accepted, citation-gated deltas.
- Live or live-shaped retrieval can only produce candidates and cache records.

The historical crowd fixture is a stress test, not the product domain. Metagrinder remains generic; the medieval market fixture and perturbed wording tests exist to guard against fixture-shaped parsing.

## 3. Current Pipeline

```text
ingest
-> extract/classify
-> scene grammar
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
-> PSG v2 compile
```

## 4. Artifact Lifecycle

Base artifacts such as `scene-grammar.json` and `retrieval-policy.json` define the current run. Proposed artifacts such as `retrieval-candidates.json`, `source-claims.json`, and `grammar-revisions.json` remain inspectable but cannot mutate accepted grammar by themselves. Accepted artifacts such as `approved-source-results.json`, `accepted-grammar-deltas.json`, and `accepted-scene-grammar.json` are produced only after approval and review gates pass.

`research-package.json` records the emitted collections. Candidate inspection and provider proof artifacts are review-only and do not feed accepted grammar directly.

## 5. Safety Invariants

- Live retrieval is not enabled by default.
- Candidates cannot create source claims directly.
- Candidates cannot create grammar revisions directly.
- Source claims require approval and citation review.
- Rejected or ambiguous candidate approvals do not promote.
- Rejected or `needs_review` citations block material deltas unless explicit override is present.
- Accepted grammar mutates only through accepted, citation-gated revisions.
- PSG output must remain PSG v2-compatible.
- PSG compile target must be explicit: `base` or `accepted`.
- Local real provider configs are ignored and must not be committed.

## 6. Test Coverage

The audit suite currently covers:

- Generic scene grammar extraction and perturbation resistance.
- Historical crowd and medieval market fixtures.
- Sampler/evaluator constraints and PSG v2 validation.
- Source registry, source evidence, source claims, and source claim review.
- Revision-state handling and accepted grammar deltas.
- Dry-run, mock, cache replay, fixture-live, and generic HTTP fake provider flows.
- Candidate-only live boundary and no-auto-promotion behavior.
- Source typing downgrade behavior for unknown and stock-photo candidates.
- Domain/source-type policy filtering.
- Secret redaction checks.
- Missing real local config skip behavior.
- Selector approval and ambiguous selector rejection.

## 7. Known Limitations

- The normal pnpm workflow fails in this synced Windows workspace while materializing dependencies under `node_modules/.pnpm`; the audit wrapper uses external dependencies from `C:\tmp\metagrinder-audit-deps`.
- Real provider reliability is not exercised because no ignored local real endpoint config is present.
- Source typing uses deterministic heuristics.
- Candidate approval is file-based.
- Citation review is file-based.
- No page-level selector extraction exists.

## 8. Intentionally Not Implemented

- Page scraping.
- Broad live search.
- Automatic content extraction from live pages.
- Automatic source-claim creation from live candidates.
- Automatic grammar revision creation from live candidates.
- Automatic accepted-scene-grammar mutation during live runs.
- Review UI.

## 9. Recommended Next Work

The next branch should either:

1. Provide an ignored local real endpoint config and run the one-query real-provider proof, then replay only from cache through selector approval and citation review.
2. Split this checkpoint into reviewable commits if a reviewer wants smaller history: schema/runtime contracts, scene grammar services, retrieval/source lifecycle, provider boundary, tests/fixtures, and docs.

Do not add page scraping or automatic claim extraction until the one-query real-provider proof has passed with candidate-only output and cache replay review.

# Metagrinder Test Matrix

This matrix documents the current proof coverage for scene grammar, retrieval safety, revision review, candidate inspection, and PSG v2 output.

## Historical Crowd Scene Grammar

- Purpose: Prove extraction of archetypes, zones, weights, compatibility rules, constraints, visual references, gaps, samples, and PSG outputs from the historical crowd fixture.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-historical-crowd-proof --title "Historical Crowd Scene Grammar Proof"`
- Expected key artifacts: `scene-grammar.json`, `research-gaps.json`, `sample-prompts.json`, `branch-graphs/*.psg`.
- Expected safety result: Base scene grammar only; no live retrieval required.

## Medieval Market Scene Grammar

- Purpose: Prove scene grammar extraction is generic and not fixture-shaped to the historical crowd wording.
- Command: Covered by `node packages/core/scripts/run-metagrinder-audit-tests.js`.
- Expected key artifacts: 3+ archetypes, 2+ location zones, compatibility rules, negative constraints, visual references, PSG v2.
- Expected safety result: No retrieval promotion.

## Perturbed Historical Crowd Wording

- Purpose: Prove changed wording still extracts middle-class weight, sparse/important female spectator logic, rail bias, and ethical representation constraints.
- Command: Covered by `node packages/core/scripts/run-metagrinder-audit-tests.js`.
- Expected key artifacts: Parsed scene grammar assertions.
- Expected safety result: No exact-phrase dependency.

## Mock Retrieval

- Purpose: Preserve fixture/mock retrieval source-claim path.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph7-mock --title "RALPH 7 Mock Retrieval" --web-research-mode mock`
- Expected key artifacts: `web-research-results.json`, `source-registry.json`, `source-claims.json`.
- Expected safety result: Mock mode remains bounded and test-only.

## Dry-Run Retrieval

- Purpose: Log planned query attempts without network or candidate promotion.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph7-dry-run --title "RALPH 7 Dry Run Retrieval" --web-research-mode dry-run --max-queries-total 3 --max-results-per-query 2`
- Expected key artifacts: `retrieval-policy.json`, `retrieval-run-log.json`, `retrieval-safety-report.json`.
- Expected safety result: No source claims and no grammar revisions.

## Cache Replay

- Purpose: Replay deterministic candidate cache without network.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph7-cache-replay --title "RALPH 7 Cache Replay Retrieval" --web-research-mode cache-replay --retrieval-cache-dir packages/core/tests/fixtures/metagrinder/retrieval-cache-historical-crowd.json --source-intake-approval-file packages/core/tests/fixtures/metagrinder/source-intake-approval-historical-crowd.json`
- Expected key artifacts: `retrieval-cache-manifest.json`, `approved-source-results.json`, `source-evidence.json`, `source-claims.json`.
- Expected safety result: Only approved cached candidates can become source evidence/claims.

## Live-Candidate-Only Blocked

- Purpose: Prove live-candidate mode blocks network without guards/config.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph11-env-blocked --title "RALPH 11 Env Blocked" --web-research-mode live-candidate-only --enable-live-retrieval --live-provider generic-http-search --max-queries-total 2 --max-results-per-query 2`
- Expected key artifacts: `provider-preflight-report.json`, `provider-response-log.json`, `retrieval-safety-report.json`.
- Expected safety result: Blocked; no candidates, no claims, no revisions.

## Fixture-Live Provider

- Purpose: Produce live-shaped candidates without network for boundary tests.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph10-fixture-typing --title "RALPH 10 Fixture Typing" --web-research-mode live-candidate-only --enable-live-retrieval --live-provider fixture-live --max-queries-total 4 --max-results-per-query 3`
- Expected key artifacts: `retrieval-candidates.json`, `source-typing-report.json`, `retrieval-cache-manifest.json`.
- Expected safety result: Candidate-only output.

## Generic HTTP Fake Provider

- Purpose: Prove generic provider contract, injected/fake response normalization, response logging, cache writes, and redaction without network.
- Command: `METAGRINDER_ENABLE_LIVE_RETRIEVAL=1 node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph11-fake-provider --title "RALPH 11 Fake Provider" --web-research-mode live-candidate-only --enable-live-retrieval --live-provider generic-http-search --provider-config-file packages/core/tests/fixtures/metagrinder/provider-config-generic-http-search-fake.json --max-queries-total 2 --max-results-per-query 2`
- Expected key artifacts: `provider-config.applied.json`, `provider-response-log.json`, `retrieval-candidates.json`, `live-retrieval-cache-write.json`.
- Expected safety result: Candidates only; no source claims or grammar revisions.

## Missing Real Config

- Purpose: Prove absent ignored local real config safely skips without throwing or promoting.
- Command: `METAGRINDER_ENABLE_LIVE_RETRIEVAL=1 node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph13-real-config-missing --title "RALPH 13 Real Config Missing" --web-research-mode live-candidate-only --enable-live-retrieval --live-provider generic-http-search --provider-config-file packages/core/tests/fixtures/metagrinder/provider-config-generic-http-search-real.local.json --max-queries-total 1 --max-queries-per-gap 1 --max-results-per-query 2`
- Expected key artifacts: `real-endpoint-proof-report.json`, `candidate-inspection.json`, `retrieval-safety-report.json`.
- Expected safety result: `skipped-no-provider-config`; no claims or revisions.

## Selector Approval Replay

- Purpose: Prove operator approval can target a cached candidate by canonical URL when candidate ID is not convenient.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph13-cache-replay-review --title "RALPH 13 Cache Replay Review" --web-research-mode cache-replay --retrieval-cache-dir tmp/metagrinder-ralph13-noauth-fallback/retrieval-cache-manifest.json --source-intake-approval-file packages/core/tests/fixtures/metagrinder/source-intake-approval-historical-crowd-selector.json --source-claim-review-file packages/core/tests/fixtures/metagrinder/source-claim-review-historical-crowd.json --revision-state-file packages/core/tests/fixtures/metagrinder/revision-state-historical-crowd-citation-gated.json --apply-accepted-revisions --compile-grammar accepted`
- Expected key artifacts: `approved-source-results.json`, `source-evidence.json`, `source-claims.json`, `accepted-grammar-deltas.json`.
- Expected safety result: Exactly one selector match; ambiguous selectors approve nothing.

## Citation Blocked Replay

- Purpose: Prove rejected or unreviewed citations block material revision application.
- Command: Covered by `node packages/core/scripts/run-metagrinder-audit-tests.js`.
- Expected key artifacts: `source-claim-review.json`, `accepted-grammar-deltas.json`, `revision-review.json`.
- Expected safety result: Blocked deltas include warnings and do not change accepted grammar.

## Accepted Grammar Material Delta

- Purpose: Prove accepted revisions can materially change grammar and PSG weighted choices.
- Command: `node packages/core/scripts/run-metagrinder-mvp.js packages/core/tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt --output-dir tmp/metagrinder-ralph6-accepted --title "RALPH 6 Accepted Grammar" --revision-state-file packages/core/tests/fixtures/metagrinder/revision-state-historical-crowd-material-delta.json --apply-accepted-revisions --compile-grammar accepted`
- Expected key artifacts: `accepted-grammar-deltas.json`, `accepted-scene-grammar.json`, `psg-compile-diff.json`.
- Expected safety result: Only accepted revisions with allowed citations apply.

## PSG v2 Branch Graph Validation

- Purpose: Prove scene grammar and branch graph PSG outputs use v2 graph shape.
- Command: Covered by audit tests and per-loop PSG validation scripts.
- Expected key artifacts: `scene-grammar.psg`, `branch-graphs/*.psg`.
- Expected safety result: Nodes include `id`, `type`, `position`, `data`; edges include `id`, `source`, `target`; `WeightedChoice` options are under `data.choices`.

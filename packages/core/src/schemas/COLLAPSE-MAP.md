# Artifact Collapse Map (legacy collection types → rebuilt families)

Legacy enum: `MetagrinderCollectionTypeSchema` in `types/metagrinder.runtime.js` (~60 values).
Rebuilt families: `ArtifactFamilySchema` in `package-manifest.ts` (18 values).
Rule applied: an artifact earns separate existence only when a different human or
system reads it at a different time.

| Legacy collection type(s) | New family | Notes |
|---|---|---|
| `source-map` | `source-package` | + photo intake merged |
| `photo-observations`, `color-hypotheses` | `source-package` | photo chunks carry chunkKind `photo-observation` / `color-hypothesis` |
| `claims-and-evidence`, `concept-clusters` | `extraction` | claims/concepts/evidence in one artifact |
| mode-detection, category-hypothesis, assumption-review, augmentation-plan (review-stage artifacts) | `extraction` | `detectedResearchKind`, `categories[]`, `warnings[]` |
| `structured-brief`, `structured-brief-seed`, `brief-analysis` | `extraction` | brief analysis is extraction output of input-mode `research-brief` |
| `codex-parse-request`, `codex-parse-request-markdown`, `codex-parse-output-schema`, `codex-parse-result` | *(provider request/response cache in run folder)* | provider I/O is replay cache, not package collections |
| `codex-sweeten-request`, `codex-sweeten-request-markdown`, `codex-sweeten-result`, `codex-sweeten-run-log`, `codex-sweeten-run-status` | `content-plans` (realized) + provider cache | "sweetening" becomes the realization stage with faithfulness gates |
| `scene-grammar` | `scene-grammar` (`grammarTarget: 'base'`) | records now carry full Provenance |
| `accepted-scene-grammar` | `accepted-scene-grammar` (same schema, `grammarTarget: 'accepted'`) | kept separate: different reader, different time |
| `research-gaps` | `gap-registry` | persistent cross-run; legacy per-run gaps merge in |
| (query plan) | `gap-registry` (`recommendedSearches`) + `research-campaign` | campaign owns search planning |
| `sample-prompts`, `psg-output-flight`, `psg-readability-review` | `content-plans` | plans canonical, realized prose derived, readability = faithfulness/QA fields |
| `scene-grammar-evaluation`, `plausibility-review` | `eval-report` | harness output family (schema lands with S3.5) |
| `scene-grammar-psg`, `branch-graph` | `psg` | flat Prompt Spaghetti fragment files, compiler-owned (S2.2) |
| `psg-compile-diff` | `psg-compile-diff` | kept |
| `grammar-revisions`, `accepted-grammar-revisions`, `rejected-grammar-revisions`, `revision-state`, `revision-state-applied`, `revision-review`, `accepted-grammar-deltas` | `revisions` | revisions + decisions + accepted deltas in one artifact |
| `source-registry`, `source-evidence`, `source-claims`, `source-claim-review` | `source-lifecycle` | one chain, one artifact; integrity flags computed |
| `source-intake-approval`, `approved-source-results` | operator-state file + `source-lifecycle.sources[]` | approval stays a human-written state file; approved results become registered sources |
| `retrieval-policy` | `retrieval.policy` | |
| `retrieval-candidates`, `retrieval-cache-manifest`, `retrieval-run-log` | `retrieval` | candidates + log + cache refs |
| `live-retrieval-readiness`, `live-retrieval-preflight`, `live-retrieval-requests`, `live-retrieval-cache-write`, `live-provider-contract`, `provider-config-applied`, `provider-preflight-report`, `provider-request-shapes`, `provider-response-log`, `provider-error-report`, `live-provider-pilot-report`, `real-endpoint-proof-report`, `retrieval-safety-report` | `retrieval.log[]` | the eleven-artifact apparatus → log entries with mode/event; reliability tooling returns only after a real provider run exists |
| `candidate-inspection`, `candidate-inspection-markdown` | `review-report` | review-surface output family (S4.1) |
| `source-typing-report` | `retrieval` (`sourceTypeGuess`/`rightsProfileGuess` on candidates) | |
| `operator-review` | `review-report` | |
| `prompt-synthesis`, `prompt-mutations` | `psg` + `content-plans` | mutation operates on plans (Mutation Lab itself deferred) |
| (new) | `research-campaign` | no legacy equivalent |
| (new) | `import-receipt` | no legacy equivalent |
| (new) | `run-manifest` | replaces implicit script state |
| (new) | `utdg-candidates` | legacy fixture existed; now schema-owned, staged-only |

Out of scope for the rebuild package (legacy schemas not ported; revisit only if their
consumers return): world-semantic-field, semantic-scene-package, prompt-graph-lod,
camera-pass, witness-render, render-text-packet, model-conditioning, luma-adapter,
packet-attribution, graph-match-report, suppressed-graph-nodes, patch-proposal,
rainy-alley prototypes. These belong to the camera/render experiment lane, not the
research-package pipeline.

v0.2 watchlist (garment-work pattern — judgment calls to revisit after real data flows):
- Does `extraction.categories[]` need to become a typed taxonomy artifact?
- Should `source-lifecycle` split claims out once campaigns produce hundreds?
- `eval-report` and `review-report` schemas land with their stories (S3.5, S4.1).
- PSG file schema stays compiler-owned (S2.2); decide then whether it joins `schemas/`.

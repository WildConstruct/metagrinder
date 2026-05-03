# Metagrinder Artifact Manifest

This manifest describes the current scene-grammar and retrieval-source artifact set. "Can affect accepted grammar" means the artifact can participate in the accepted grammar path after all required approval and review gates.

| Artifact | Purpose | Producer service | Consumer service | Status | Can affect accepted grammar | Requires operator approval |
|---|---|---|---|---|---|---|
| `agent-runs.json` | Records the local run envelope. | `researchAgentRuns` | `researchPackage` | Review-only | No | No |
| `source-map.psg` | Legacy/source map PSG output for package compatibility. | `researchPackage` | package consumers | Derived | No | No |
| `concept-clusters.psg` | Concept cluster PSG output for extracted concepts. | `researchPackage` | package consumers | Derived | No | No |
| `prompt-synthesis.psg` | Prompt synthesis PSG output. | `researchPackage` | package consumers | Derived | No | No |
| `prompt-mutations.psg` | Prompt mutation PSG output. | `researchPackage` | package consumers | Derived | No | No |
| `scene-grammar.json` | Base scene grammar derived from source inputs. | `researchSceneGrammar` | gaps, sampling, PSG compiler, revision applicator | Source-of-record | Yes, as base input | No |
| `sample-prompts.json` | Samples generated from scene grammar for evaluation. | scene grammar sampler | evaluation/plausibility review | Derived | No direct effect | No |
| `scene-grammar-evaluation.json` | Distribution and constraint evaluation of generated samples. | scene grammar evaluator | review/package | Review-only | No | No |
| `plausibility-review.json` | Pass/fail plausibility review for samples. | plausibility reviewer | review/package | Review-only | No | No |
| `scene-grammar.psg` (`scene-grammar-psg`) | PSG v2 graph compiled from base or accepted grammar. | `researchPsgCompiler` | downstream graph consumers | Derived | No | Compile target determines source |
| `research-gaps.json` | Gaps requiring more support or review. | `researchGaps` | `researchQueryPlan`, revisions | Derived | Indirect | No |
| `research-query-plan.json` | Query plan generated from gaps. | `researchQueryPlan` | retrieval boundary, provider request shapes | Proposed | Indirect | No |
| `retrieval-policy.json` | Run policy for retrieval mode, budgets, cache, source allowlists, and safety controls. | `researchRetrievalPolicy` | retrieval boundary, provider preflight | Source-of-record for retrieval run | Indirect | Operator-supplied policy may be used |
| `retrieval-run-log.json` | Logs retrieval attempts, budget usage, and skips. | `researchRetrievalCandidates` | audits, package | Review-only | No | No |
| `retrieval-candidates.json` | Candidate search results from mock/cache/live-shaped/live provider. | retrieval boundary/live provider/cache replay | candidate inspection, source approval | Proposed | No direct effect | Yes, before promotion |
| `candidate-inspection.json` | Structured operator inspection report for candidates. | `researchCandidateInspection` | operator review, package | Review-only | No | No |
| `candidate-inspection.md` (`candidate-inspection-markdown`) | Human-readable candidate inspection report. | `researchCandidateInspection` | operator review | Review-only | No | No |
| `source-intake-approval.json` | Operator approval, rejection, pending state, or selector match for candidates. | Operator fixture/file | `researchSourceIntakeApproval` | Source-of-record for candidate approval | Yes, after later gates | Yes |
| `approved-source-results.json` | Approved candidate results that may become sources/evidence. | `researchSourceIntakeApproval` | web result bridge, source registry/evidence | Accepted | Yes, after citation review | Yes |
| `source-registry.json` | Canonical source records and deduped source identity. | `researchSourceRegistry` | evidence, claims, package | Source-of-record | Yes, through claims | Requires approved result for candidate sources |
| `source-evidence.json` | Evidence excerpts/locators linked to sources and candidates/cache records. | `researchSourceEvidence` | source claims, operator review | Source-of-record for evidence | Yes, through reviewed claims | Citation review required |
| `source-claims.json` | Extracted claims linked to evidence IDs and grammar refs. | `researchSourceClaims` | grammar revisions | Proposed | Yes, after claim review and revision approval | Citation review required |
| `source-claim-review.json` | Operator citation status for claims. | `researchSourceClaimReview` | revision applicator | Source-of-record for citation gate | Yes | Yes |
| `grammar-revisions.json` | Proposed grammar changes linked to source claim IDs. | `researchGrammarRevision` | revision-state workflow, operator review | Proposed | Only if accepted and citation-allowed | Yes |
| `accepted-grammar-revisions.json` | Accepted subset of grammar revisions. | `researchGrammarRevision` | accepted delta applicator | Accepted | Yes | Yes |
| `rejected-grammar-revisions.json` | Rejected subset of grammar revisions. | `researchGrammarRevision` | review/package | Review-only | No | Yes |
| `revision-state.applied.json` (`revision-state-applied`) | Audit of accepted/rejected/skipped/unknown revision state application. | `researchGrammarRevision` | revision review/package | Review-only | Indirect | Based on operator state |
| `revision-review.json` | Summary of proposed, accepted, rejected, pending, warnings, and compile target. | `researchGrammarRevision` | operator/package | Review-only | No | No |
| `accepted-grammar-deltas.json` | Material and confirmation deltas applied from accepted revisions. | `researchGrammarRevision` | accepted scene grammar, review | Accepted | Yes | Yes |
| `operator-review.md` | Human-readable revision review report. | `researchPipeline` | operator | Review-only | No | No |
| `accepted-scene-grammar.json` | Base grammar plus accepted deltas only. | `researchGrammarRevision` | PSG compiler, package | Accepted | Yes | Yes |
| `psg-compile-diff.json` | Compares base and accepted PSG weighted-choice differences. | `researchPipeline` | operator review/package | Review-only | No | No |
| `live-provider-contract.json` | Provider statuses and capability/safety contract. | `researchLiveProviderContract` | preflight/package | Source-of-record for provider config | No | No |
| `provider-config.applied.json` (`provider-config-applied`) | Sanitized provider config and redaction settings. | `researchProviderConfig` | preflight/package | Review-only | No | Local config controls network eligibility |
| `provider-preflight-report.json` | Provider guard checks and network permission verdict. | `researchProviderPreflight` | request shapes/live retrieval | Source-of-record for provider execution | No | No |
| `provider-request-shapes.json` | Sanitized request objects planned for provider calls. | `researchProviderRequestShapes` | live retrieval/audit | Review-only | No | No |
| `provider-response-log.json` | Provider response statuses, hashes, result counts, and failures. | `researchLiveRetrieval` | proof report/errors/package | Review-only | No | No |
| `provider-error-report.json` | Nonfatal provider preflight/response errors. | `researchProviderErrors` | package/audit | Review-only | No | No |
| `live-retrieval-preflight.json` | Live retrieval guard report before provider-specific preflight. | `researchLiveRetrieval` | provider preflight/audit | Review-only | No | No |
| `live-retrieval-requests.json` | Executed or blocked live retrieval request log. | `researchLiveRetrieval` | package/audit | Review-only | No | No |
| `live-retrieval-cache-write.json` | Cache write records from live/live-shaped candidates. | `researchLiveRetrieval` | cache manifest/replay | Review-only | No | No |
| `live-retrieval-readiness.json` | Checklist for whether live retrieval prerequisites exist. | `researchPipeline` | package/audit | Review-only | No | No |
| `live-provider-pilot-report.json` | One-query/fake pilot safety summary. | `researchLiveProviderPilotReport` | package/audit | Review-only | No | No |
| `real-endpoint-proof-report.json` | Real-local-config proof or skipped/safe-failed-provider summary. | `researchRealEndpointProof` | package/audit | Review-only | No | No |
| `retrieval-safety-report.json` | Confirms candidate auto-promotion was blocked. | `researchSourceIntakeApproval` | package/audit | Review-only | No | No |
| `research-package.json` | Package manifest of all emitted artifacts. | `researchPackage` | downstream tooling | Review-only | No | No |

## Safety Invariants

- Live candidates must never create source claims directly.
- Live candidates must never create grammar revisions directly.
- Unapproved candidates must never enter `source-registry.json` or `source-claims.json` as accepted evidence.
- Rejected or ambiguous approvals must not promote.
- Rejected or `needs_review` citations must block material grammar deltas unless an explicit override is present.
- Low-quality sources must not create high-confidence revisions.
- Accepted grammar must only apply accepted revisions.
- PSG compile target must be explicit: `base` or `accepted`.

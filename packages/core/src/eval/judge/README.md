# Judge Calibration Gate

Judge-scored metrics remain disabled until `judge-meta-gate.json` reports
`passed: true`. The battery runs each known-good/bad case twice with mirrored
left/right presentation and requires complete criterion-by-criterion scoring.

The human operator owns the calibration ratings. Keep them outside the repo as
a JSON array with this shape:

```json
[
  {
    "caseId": "faithful_quote_vs_invention",
    "preferred": "candidate",
    "candidateScore": 4,
    "referenceScore": 0
  },
  {
    "caseId": "overconfidence_vs_uncertainty",
    "preferred": "reference",
    "candidateScore": 0,
    "referenceScore": 4
  }
]
```

Operator command:

```powershell
$env:METAGRINDER_JUDGE_CALIBRATION='C:\path\outside\repo\judge-calibration.json'
pnpm eval:judge -- record <anthropic|codex-cli> C:\path\to\judge-run
pnpm eval:judge -- replay <anthropic|codex-cli> C:\path\to\judge-run
```

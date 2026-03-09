const {
  MetagrinderReviewArtifactSchema,
  MetagrinderScoreArtifactSchema
} = require('../../types/metagrinder.runtime.js');

const CONTRADICTION_MARKERS = [
  'while others',
  'whereas',
  'in contrast',
  'but others',
  'however',
  'on the other hand'
];

function buildScoreArtifact({ ingestArtifact, extractArtifact, synthesizeArtifact }) {
  const inferredClaimCount = extractArtifact.claims.filter(
    (claim) => claim.attributionMode === 'inferred'
  ).length;
  const contradictionCount = extractArtifact.claims.filter((claim) =>
    CONTRADICTION_MARKERS.some((marker) => claim.text.toLowerCase().includes(marker))
  ).length;
  const nearDuplicateWarningCount = extractArtifact.warnings.filter(
    (warning) => warning.code === 'near-duplicate-concept'
  ).length;
  const provenanceCoverage = extractArtifact.evidence.length >= ingestArtifact.chunks.length;
  const corroboratedConceptIds = extractArtifact.conceptCandidates
    .filter((concept) => new Set(concept.sourceInputIds).size > 1)
    .map((concept) => concept.conceptId);
  const disputedConceptIds = extractArtifact.conceptCandidates
    .filter((concept) =>
      concept.summary.includes('|') &&
      (
        concept.attributionMode === 'inferred' ||
        concept.confidence !== 'high'
      )
    )
    .map((concept) => concept.conceptId);
  let extractionConfidence = inferredClaimCount === 0
    ? 'high'
    : inferredClaimCount <= 3
      ? 'medium'
      : 'low';
  let normalizationConfidence = extractArtifact.conceptCandidates.some(
    (concept) => concept.confidence !== 'high'
  ) ? 'medium' : 'high';

  if (corroboratedConceptIds.length >= 1 && extractionConfidence === 'medium') {
    extractionConfidence = 'high';
  }
  if (corroboratedConceptIds.length >= 2 && normalizationConfidence === 'medium') {
    normalizationConfidence = 'high';
  }
  if (disputedConceptIds.length >= 2 && normalizationConfidence === 'high') {
    normalizationConfidence = 'medium';
  }
  if (contradictionCount > 0) {
    extractionConfidence = extractionConfidence === 'high' ? 'medium' : 'low';
    normalizationConfidence = normalizationConfidence === 'high' ? 'medium' : 'low';
  }
  if (nearDuplicateWarningCount > 0 && normalizationConfidence === 'high') {
    normalizationConfidence = 'medium';
  }

  const overall = synthesizeArtifact.promptFragments.length >= 4 && provenanceCoverage
    ? extractionConfidence === 'high' && normalizationConfidence === 'high'
      ? 'high'
      : 'medium'
    : 'low';

  return MetagrinderScoreArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    corroboratedConceptIds,
    disputedConceptIds,
    confidenceSummary: {
      overall,
      extraction: extractionConfidence,
      normalization: normalizationConfidence,
      provenance: provenanceCoverage ? 'high' : 'medium',
      rights: 'low'
    },
    ambiguityFlags: [
      ...extractArtifact.openQuestions.map((question) => question.questionId),
      ...extractArtifact.claims
        .filter((claim) =>
          CONTRADICTION_MARKERS.some((marker) => claim.text.toLowerCase().includes(marker))
        )
        .map((claim) => claim.claimId),
      ...extractArtifact.warnings
        .filter((warning) => warning.code === 'near-duplicate-concept')
        .map((warning, index) => `${warning.code}_${index + 1}`)
    ]
  });
}

function buildReviewArtifact({ ingestArtifact, extractArtifact, synthesizeArtifact, scoreArtifact }) {
  const missingProvenance = extractArtifact.claims
    .filter((claim) => !Array.isArray(claim.sourceChunkIds) || claim.sourceChunkIds.length === 0)
    .map((claim) => claim.claimId);
  const weakConceptIds = extractArtifact.conceptCandidates
    .filter((concept) => concept.confidence !== 'high')
    .map((concept) => concept.conceptId);
  const corroboratedConceptIds = [...scoreArtifact.corroboratedConceptIds];
  const overlapWarnings = [
    ...extractArtifact.warnings
      .filter((warning) => warning.code === 'near-duplicate-concept')
      .map((warning) => warning.message),
    ...extractArtifact.conceptCandidates
      .filter((concept) =>
        new Set(concept.sourceInputIds).size > 1 &&
        (
          concept.summary.includes('|') ||
          concept.confidence !== 'high'
        )
      )
      .map((concept) => `Merged concept ${concept.label} spans ${new Set(concept.sourceInputIds).size} sources and should be reviewed for over-merge risk.`)
  ];
  const contradictionFlags = extractArtifact.claims
    .filter((claim) =>
      CONTRADICTION_MARKERS.some((marker) => claim.text.toLowerCase().includes(marker))
    )
    .map((claim) => `Potential contradiction in ${claim.claimId}: ${claim.text}`);
  const recommendedActions = [];

  if (extractArtifact.openQuestions.length > 0) {
    recommendedActions.push('Review inferred claims and decide which should remain unresolved versus promoted into stable concept buckets.');
  }
  if (weakConceptIds.length > 0) {
    recommendedActions.push('Tighten weak concept labels or attach stronger source evidence before wider reuse.');
  }
  if (synthesizeArtifact.promptFragments.length < 4) {
    recommendedActions.push('Add more prompt fragments so each required prompt family has usable variation.');
  }
  if (scoreArtifact.confidenceSummary.extraction !== 'high') {
    recommendedActions.push('Improve extraction heuristics or source quality to raise extraction confidence.');
  }
  if (new Set(extractArtifact.claims.flatMap((claim) => claim.sourceInputIds)).size > 1) {
    recommendedActions.push('Inspect repeated concepts across source documents before enabling automatic corroboration or merge logic.');
  }
  if (scoreArtifact.corroboratedConceptIds.length > 0) {
    recommendedActions.push('Review corroborated concepts as candidate stable scene heuristics for stronger downstream synthesis.');
  }
  if (scoreArtifact.disputedConceptIds.length > 0) {
    recommendedActions.push('Inspect merged concepts with differing summaries to decide whether they are true corroborations or near-duplicates.');
  }
  if (contradictionFlags.length > 0) {
    recommendedActions.push('Inspect contradiction flags before promoting cross-document concepts into high-confidence heuristics.');
  }
  if (overlapWarnings.length > 0) {
    recommendedActions.push('Review overlap warnings to decide whether broad merged concepts should be split into narrower concepts.');
  }

  return MetagrinderReviewArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    unresolvedAmbiguities: extractArtifact.openQuestions.map((question) => question.text),
    corroboratedConceptIds,
    overlapWarnings,
    contradictionFlags,
    missingProvenance,
    weakConceptIds,
    recommendedActions
  });
}

module.exports = {
  buildReviewArtifact,
  buildScoreArtifact
};

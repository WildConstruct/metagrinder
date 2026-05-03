const {
  MetagrinderSourceClaimsArtifactSchema
} = require('../../types/metagrinder.runtime.js');

const { dedupeKeyFor } = require('../researchSourceRegistry/index.js');

function claimTypeForGap(gap) {
  if (!gap) return 'source-support';
  if (gap.gapType === 'under-supported-distribution') return 'demographic-distribution';
  if (gap.gapType === 'visual-reference-without-support') return 'visual-reference-support';
  if (gap.gapType === 'negative-constraint-not-enforced') return 'constraint-enforcement';
  return gap.gapType;
}

function accessDateFor(result, webResearchResults) {
  return String(result.retrievedAt || webResearchResults.retrievedAt || new Date().toISOString()).slice(0, 10);
}

function buildSourceClaimsArtifact({
  sourceRegistryArtifact,
  webResearchResults,
  researchGapArtifact,
  sourceEvidenceArtifact,
  sourceClaimReviewArtifact
}) {
  const gapsById = new Map((researchGapArtifact?.gaps || []).map((gap) => [gap.gapId, gap]));
  const sourcesByDedupeKey = new Map(
    (sourceRegistryArtifact?.sources || []).map((source) => [source.dedupeKey, source])
  );
  const claims = [];
  const evidenceBySourceId = new Map();
  (sourceEvidenceArtifact?.evidence || []).forEach((evidence) => {
    const entries = evidenceBySourceId.get(evidence.sourceId) || [];
    entries.push(evidence);
    evidenceBySourceId.set(evidence.sourceId, entries);
  });
  const reviewByClaimId = new Map((sourceClaimReviewArtifact?.claimReviews || []).map((review) => [
    review.sourceClaimId,
    review
  ]));

  (webResearchResults?.results || []).forEach((result) => {
    const source = sourcesByDedupeKey.get(dedupeKeyFor(result));
    if (!source) return;
    const gap = gapsById.get(result.gapId);

    (result.claimsExtracted || []).forEach((claim, index) => {
      const sourceEvidence = evidenceBySourceId.get(source.sourceId) || [];
      const evidence = sourceEvidence[index] || sourceEvidence[0];
      const sourceClaimId = `source_claim_${String(claims.length + 1).padStart(3, '0')}`;
      const review = reviewByClaimId.get(sourceClaimId);
      claims.push({
        sourceClaimId,
        sourceId: source.sourceId,
        gapId: result.gapId,
        claim: claim.claim,
        claimType: claimTypeForGap(gap),
        supportsGrammarRefs: claim.supportsGrammarRefs || [],
        attributionMode: 'web-retrieved',
        confidence: result.sourceQuality === 'low' ? 'low' : claim.confidence,
        evidenceIds: evidence ? [evidence.evidenceId] : [],
        evidenceReviewStatus: review?.citationStatus || 'needs_review',
        evidenceText: claim.claim,
        evidenceLocator: {
          url: source.canonicalUrl || result.url,
          page: null,
          selector: null,
          accessDate: accessDateFor(result, webResearchResults)
        },
        limitations: [...new Set([...(source.limitations || []), ...(result.limitations || [])])],
        reviewStatus: 'needs_review'
      });
    });
  });

  return MetagrinderSourceClaimsArtifactSchema.parse({
    inputId: sourceRegistryArtifact.inputId,
    claims
  });
}

module.exports = {
  buildSourceClaimsArtifact,
  claimTypeForGap
};

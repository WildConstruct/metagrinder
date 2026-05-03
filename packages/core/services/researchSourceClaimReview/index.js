const {
  MetagrinderSourceClaimReviewArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function buildSourceClaimReviewArtifact({ inputId, reviewFile, sourceClaimsArtifact }) {
  if (reviewFile) {
    return MetagrinderSourceClaimReviewArtifactSchema.parse(reviewFile);
  }
  return MetagrinderSourceClaimReviewArtifactSchema.parse({
    inputId,
    claimReviews: (sourceClaimsArtifact?.claims || []).map((claim) => ({
      sourceClaimId: claim.sourceClaimId,
      evidenceIds: claim.evidenceIds || [],
      citationStatus: 'needs_review',
      riskFlags: []
    }))
  });
}

module.exports = {
  buildSourceClaimReviewArtifact
};

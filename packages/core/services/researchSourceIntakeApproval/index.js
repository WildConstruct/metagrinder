const {
  MetagrinderApprovedSourceResultsSchema,
  MetagrinderRetrievalSafetyReportSchema,
  MetagrinderSourceIntakeApprovalSchema
} = require('../../types/metagrinder.runtime.js');

function buildSourceIntakeApprovalArtifact({ inputId, approvalFile }) {
  return MetagrinderSourceIntakeApprovalSchema.parse(approvalFile || {
    inputId,
    approvals: []
  });
}

function selectorMatches(candidate, selector) {
  if (!selector) return false;
  if (selector.canonicalUrl && candidate.canonicalUrl !== selector.canonicalUrl) return false;
  if (selector.queryId && candidate.queryId !== selector.queryId) return false;
  if (selector.domain && candidate.domain !== selector.domain) return false;
  if (selector.titleContains && !candidate.title.toLowerCase().includes(selector.titleContains.toLowerCase())) return false;
  return Boolean(selector.canonicalUrl || selector.queryId || selector.domain || selector.titleContains);
}

function buildApprovedSourceResultsArtifact({
  retrievalCandidatesArtifact,
  sourceIntakeApprovalArtifact
}) {
  const candidatesById = new Map(retrievalCandidatesArtifact.candidates.map((candidate) => [
    candidate.candidateId,
    candidate
  ]));
  const approvedResults = [];
  const warnings = [];

  sourceIntakeApprovalArtifact.approvals.forEach((approval) => {
    if (approval.approvalStatus !== 'approved') return;
    let candidate = approval.candidateId
      ? candidatesById.get(approval.candidateId)
      : undefined;
    let approvalMatchMode = 'candidateId';
    if (!candidate && approval.candidateSelector) {
      const matches = retrievalCandidatesArtifact.candidates.filter((entry) =>
        selectorMatches(entry, approval.candidateSelector)
      );
      if (matches.length === 1) {
        candidate = matches[0];
        approvalMatchMode = approval.candidateSelector.canonicalUrl ? 'canonicalUrl' : 'selector';
      } else {
        warnings.push(`Approval selector matched ${matches.length} candidates; expected exactly one.`);
      }
    }
    if (!candidate) return;
    approvedResults.push({
      approvedResultId: `approved_source_result_${String(approvedResults.length + 1).padStart(3, '0')}`,
      candidateId: candidate.candidateId,
      gapId: candidate.gapId,
      title: candidate.title,
      url: candidate.url,
      sourceType: approval.approvedSourceType || candidate.sourceTypeHypothesis,
      sourceQuality: approval.approvedSourceQuality || candidate.sourceQualityHypothesis,
      operatorApprovalStatus: 'approved',
      approvalMatchMode: approval.approvalMatchMode || approvalMatchMode
    });
  });

  return MetagrinderApprovedSourceResultsSchema.parse({
    inputId: retrievalCandidatesArtifact.inputId,
    approvedResults,
    warnings
  });
}

function buildRetrievalSafetyReport({
  retrievalPolicyArtifact,
  retrievalCandidatesArtifact,
  approvedSourceResultsArtifact,
  sourceClaimsArtifact
}) {
  const liveCandidateCount = retrievalCandidatesArtifact.candidates
    .filter((candidate) => candidate.retrievalMode === 'live-candidate-only').length;
  const approvedCandidateCount = approvedSourceResultsArtifact.approvedResults.length;
  const sourceClaimsCreatedFromLiveCandidates = retrievalPolicyArtifact.mode === 'live-candidate-only'
    ? sourceClaimsArtifact.claims.length
    : 0;
  const blockedAutoPromotion = retrievalPolicyArtifact.requireOperatorApprovalForSourceClaims &&
    retrievalCandidatesArtifact.candidates.every((candidate) => !candidate.canCreateSourceClaim);
  const warnings = [];
  if (retrievalPolicyArtifact.mode === 'live-candidate-only') {
    warnings.push('Live candidates require operator approval before source claims can be created.');
  }
  if (retrievalPolicyArtifact.mode !== 'mock' && sourceClaimsArtifact.claims.length === 0) {
    warnings.push('Candidate retrieval output did not create source claims without approval.');
  }

  return MetagrinderRetrievalSafetyReportSchema.parse({
    inputId: retrievalPolicyArtifact.inputId,
    mode: retrievalPolicyArtifact.mode,
    candidateCount: retrievalCandidatesArtifact.candidates.length,
    approvedCandidateCount,
    sourceClaimsCreatedFromLiveCandidates,
    blockedAutoPromotion,
    warnings,
    verdict: sourceClaimsCreatedFromLiveCandidates === 0 ? 'safe' : 'unsafe'
  });
}

module.exports = {
  buildApprovedSourceResultsArtifact,
  buildRetrievalSafetyReport,
  buildSourceIntakeApprovalArtifact
};

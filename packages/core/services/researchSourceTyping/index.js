const {
  MetagrinderSourceTypingReportSchema
} = require('../../types/metagrinder.runtime.js');

function classifyCandidateSource(candidate) {
  const haystack = `${candidate.domain || ''} ${candidate.url || ''} ${candidate.title || ''} ${candidate.snippet || ''}`.toLowerCase();
  const reasons = [];
  let sourceType = candidate.sourceTypeHypothesis || 'unknown';
  let quality = candidate.sourceQualityHypothesis || 'low';
  let confidence = 'low';

  const set = (type, candidateQuality, candidateConfidence, reason) => {
    sourceType = type;
    quality = candidateQuality;
    confidence = candidateConfidence;
    reasons.push(reason);
  };

  if (/alamy|getty|shutterstock|stock/.test(haystack)) {
    set('stock-photo', 'low', 'medium', 'Stock-photo domain or metadata; reference-only by default.');
  } else if (/forum|reddit|social|blogspot|wordpress|blog/.test(haystack)) {
    set(haystack.includes('forum') || haystack.includes('reddit') ? 'forum' : 'blog', 'low', 'medium', 'Forum/blog/social metadata is low-authority by default.');
  } else if (/loc\.gov|archive\.|archives|digitalcollections/.test(haystack)) {
    set(haystack.includes('digitalcollections') || haystack.includes('library') || haystack.includes('loc.gov') ? 'library' : 'archive', 'medium', 'medium', 'Domain resembles archival or library source.');
  } else if (/museum|exhibit|catalog/.test(haystack)) {
    set('museum', 'medium', 'medium', 'Domain/title resembles museum catalog source.');
  } else if (/jstor|doi\.org|journal|\.edu/.test(haystack)) {
    set('scholarly', 'high', 'medium', 'Domain/path resembles scholarly source.');
  } else if (/newspaper|times|gazette|chronicle|tribune/.test(haystack)) {
    set('newspaper', 'medium', 'medium', 'Domain/title resembles newspaper source.');
  } else if (!candidate.sourceTypeHypothesis || candidate.sourceTypeHypothesis === 'unknown') {
    set('unknown', 'low', 'low', 'Weak or unknown source metadata.');
  } else {
    reasons.push('Preserved provider source type hypothesis.');
    confidence = 'medium';
  }

  const riskFlags = [];
  if (['stock-photo', 'blog', 'forum', 'unknown', 'low-quality-source'].includes(sourceType)) {
    riskFlags.push(`${sourceType}-requires-review`);
  }
  return {
    candidateId: candidate.candidateId,
    url: candidate.url,
    domain: candidate.domain,
    sourceTypeHypothesis: sourceType,
    sourceTypeConfidence: confidence,
    sourceQualityHypothesis: quality,
    qualityReasons: reasons,
    riskFlags,
    promotionRecommendation: riskFlags.length > 0 ? 'block' : 'needs_operator_review'
  };
}

function buildSourceTypingReport({ inputId, retrievalCandidatesArtifact }) {
  return MetagrinderSourceTypingReportSchema.parse({
    inputId,
    candidateClassifications: (retrievalCandidatesArtifact?.candidates || []).map(classifyCandidateSource)
  });
}

module.exports = {
  buildSourceTypingReport,
  classifyCandidateSource
};

const {
  MetagrinderCandidateInspectionArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function buildCandidateInspectionArtifact({
  inputId,
  retrievalCandidatesArtifact,
  sourceTypingReportArtifact,
  retrievalCacheManifestArtifact
}) {
  const typingByCandidateId = new Map((sourceTypingReportArtifact?.candidateClassifications || []).map((entry) => [
    entry.candidateId,
    entry
  ]));
  const cacheByCandidateId = new Map((retrievalCacheManifestArtifact?.cacheRecords || []).map((entry) => [
    entry.candidateId,
    entry
  ]));
  return MetagrinderCandidateInspectionArtifactSchema.parse({
    inputId,
    candidates: (retrievalCandidatesArtifact?.candidates || []).map((candidate) => {
      const typing = typingByCandidateId.get(candidate.candidateId);
      const cache = cacheByCandidateId.get(candidate.candidateId);
      const riskFlags = typing?.riskFlags || [];
      return {
        candidateId: candidate.candidateId,
        queryId: candidate.queryId,
        gapId: candidate.gapId,
        title: candidate.title,
        url: candidate.url,
        canonicalUrl: candidate.canonicalUrl,
        domain: candidate.domain,
        snippet: candidate.snippet,
        sourceTypeHypothesis: candidate.sourceTypeHypothesis,
        sourceQualityHypothesis: candidate.sourceQualityHypothesis,
        sourceTypingReasons: typing?.qualityReasons || [],
        riskFlags,
        cacheRecordId: cache?.cacheRecordId,
        payloadHash: cache?.payloadHash,
        canCreateSourceClaim: candidate.canCreateSourceClaim,
        recommendedAction: riskFlags.length > 0
          ? 'inspect carefully; leave pending unless operator can verify source quality'
          : 'inspect externally, then approve through source-intake-approval.json if useful'
      };
    })
  });
}

function buildCandidateInspectionMarkdown(candidateInspectionArtifact) {
  const lines = ['# Metagrinder Candidate Inspection', ''];
  if (candidateInspectionArtifact.candidates.length === 0) {
    lines.push('No retrieval candidates were produced for inspection.');
    lines.push('');
    return `${lines.join('\n')}\n`;
  }
  candidateInspectionArtifact.candidates.forEach((candidate) => {
    lines.push(`## ${candidate.candidateId}`);
    lines.push('');
    lines.push(`Query: ${candidate.queryId}`);
    lines.push(`Gap: ${candidate.gapId}`);
    lines.push(`Title: ${candidate.title}`);
    lines.push(`URL: ${candidate.url}`);
    lines.push(`Canonical URL: ${candidate.canonicalUrl}`);
    lines.push(`Domain: ${candidate.domain}`);
    lines.push(`Snippet: ${candidate.snippet}`);
    lines.push(`Source type: ${candidate.sourceTypeHypothesis}`);
    lines.push(`Quality: ${candidate.sourceQualityHypothesis}`);
    lines.push(`Typing reasons: ${(candidate.sourceTypingReasons || []).join('; ') || 'none'}`);
    lines.push(`Risk flags: ${(candidate.riskFlags || []).join('; ') || 'none'}`);
    lines.push(`Cache record: ${candidate.cacheRecordId || 'none'}`);
    lines.push(`Payload hash: ${candidate.payloadHash || 'none'}`);
    lines.push(`Recommended action: ${candidate.recommendedAction}`);
    lines.push(`Safety: canCreateSourceClaim=${candidate.canCreateSourceClaim}`);
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildCandidateInspectionArtifact,
  buildCandidateInspectionMarkdown
};

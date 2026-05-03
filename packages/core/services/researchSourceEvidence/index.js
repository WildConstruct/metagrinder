const {
  MetagrinderSourceEvidenceArtifactSchema
} = require('../../types/metagrinder.runtime.js');

const { dedupeKeyFor } = require('../researchSourceRegistry/index.js');

function normalizeExcerpt(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSourceEvidenceArtifact({
  sourceRegistryArtifact,
  webResearchResults,
  retrievalCandidatesArtifact,
  retrievalCacheManifestArtifact
}) {
  const sourcesByDedupeKey = new Map((sourceRegistryArtifact?.sources || []).map((source) => [
    source.dedupeKey,
    source
  ]));
  const candidatesByGap = new Map();
  (retrievalCandidatesArtifact?.candidates || []).forEach((candidate) => {
    if (!candidatesByGap.has(candidate.gapId)) {
      candidatesByGap.set(candidate.gapId, candidate);
    }
  });
  const cacheRecordByCandidateId = new Map((retrievalCacheManifestArtifact?.cacheRecords || []).map((record) => [
    record.candidateId,
    record
  ]));
  const evidence = [];

  (webResearchResults?.results || []).forEach((result) => {
    const source = sourcesByDedupeKey.get(dedupeKeyFor(result));
    if (!source) return;
    const candidate = candidatesByGap.get(result.gapId);
    const cacheRecord = candidate ? cacheRecordByCandidateId.get(candidate.candidateId) : undefined;
    (result.claimsExtracted || []).forEach((claim) => {
      evidence.push({
        evidenceId: `source_evidence_${String(evidence.length + 1).padStart(3, '0')}`,
        sourceId: source.sourceId,
        candidateId: candidate?.candidateId,
        sourceKind: candidate?.retrievalMode || webResearchResults.adapterMode || 'mock',
        evidenceType: 'source-snippet',
        excerptText: claim.claim,
        normalizedExcerpt: normalizeExcerpt(claim.claim),
        locator: {
          url: source.url || result.url,
          canonicalUrl: source.canonicalUrl || result.url,
          page: null,
          selector: null,
          lineStart: null,
          lineEnd: null,
          paragraphIndex: 0,
          imageRegion: null,
          cacheRecordId: cacheRecord?.cacheRecordId || null,
          accessDate: String(result.retrievedAt || webResearchResults.retrievedAt || new Date().toISOString()).slice(0, 10)
        },
        reviewStatus: 'needs_review',
        confidence: result.sourceQuality === 'low' ? 'low' : claim.confidence
      });
    });
  });

  return MetagrinderSourceEvidenceArtifactSchema.parse({
    inputId: sourceRegistryArtifact.inputId,
    evidence
  });
}

module.exports = {
  buildSourceEvidenceArtifact,
  normalizeExcerpt
};

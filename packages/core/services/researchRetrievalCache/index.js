const fs = require('fs');
const crypto = require('crypto');

const {
  MetagrinderRetrievalCacheManifestSchema,
  MetagrinderRetrievalCandidatesArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function readRetrievalCacheArtifact({ cachePath, inputId }) {
  if (!cachePath || !fs.existsSync(cachePath)) {
    return {
      cacheCandidatesArtifact: MetagrinderRetrievalCandidatesArtifactSchema.parse({
        inputId,
        candidates: []
      }),
      cacheHit: false,
      warnings: cachePath ? [`Retrieval cache not found: ${cachePath}`] : []
    };
  }
  const artifact = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const candidates = Array.isArray(artifact.candidates)
    ? artifact.candidates
    : Array.isArray(artifact.cacheRecords)
      ? artifact.cacheRecords.map((record) => record.candidate).filter(Boolean)
      : Array.isArray(artifact.cacheWrites)
        ? artifact.cacheWrites.map((record) => record.candidate).filter(Boolean)
        : [];
  return {
    cacheCandidatesArtifact: MetagrinderRetrievalCandidatesArtifactSchema.parse({
      inputId: artifact.inputId || inputId,
      candidates
    }),
    cacheHit: true,
    warnings: []
  };
}

function buildRetrievalCacheManifest({
  inputId,
  retrievalPolicyArtifact,
  cacheCandidatesArtifact,
  cacheHit,
  candidateCount,
  liveRetrievalCacheWriteArtifact,
  warnings = [],
  now = () => new Date().toISOString()
}) {
  const writesByCandidateId = new Map((liveRetrievalCacheWriteArtifact?.cacheWrites || []).map((write) => [
    write.candidateId,
    write
  ]));
  const cacheRecords = (cacheCandidatesArtifact?.candidates || []).map((candidate, index) => {
    const write = writesByCandidateId.get(candidate.candidateId);
    return ({
    cacheRecordId: `cache_record_${String(index + 1).padStart(3, '0')}`,
    candidateId: candidate.candidateId,
    queryId: candidate.queryId,
    gapId: candidate.gapId,
    payloadHash: `sha256:${crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex')}`,
    title: candidate.title,
    url: candidate.url,
    createdFromFixture: cacheHit,
    providerId: write?.providerId || (candidate.retrievalMode === 'live-candidate-only' ? 'fixture-live' : undefined),
    providerRequestShapeId: write?.providerRequestShapeId || (candidate.queryId
      ? `provider_request_shape_${String(index + 1).padStart(3, '0')}`
      : undefined),
    providerResponseId: write?.providerResponseId,
    rawCandidatePayload: write?.rawCandidatePayload || candidate,
    normalizedCandidatePayload: write?.normalizedCandidatePayload || candidate,
    createdAt: now(),
    candidate
  });
  });
  return MetagrinderRetrievalCacheManifestSchema.parse({
    inputId,
    cacheDir: retrievalPolicyArtifact.cache.cacheDir,
    cacheMode: retrievalPolicyArtifact.mode,
    cacheSource: retrievalPolicyArtifact.cache.cacheDir,
    mode: retrievalPolicyArtifact.mode,
    cacheHit,
    candidateCount,
    cacheRecords,
    warnings
  });
}

module.exports = {
  buildRetrievalCacheManifest,
  readRetrievalCacheArtifact
};

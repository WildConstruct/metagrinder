const {
  MetagrinderRealEndpointProofReportSchema
} = require('../../types/metagrinder.runtime.js');

function buildRealEndpointProofReport({
  inputId,
  providerId,
  configPath,
  configPresent,
  providerResponseLogArtifact,
  retrievalCandidatesArtifact,
  liveRetrievalCacheWriteArtifact,
  sourceClaimsArtifact,
  grammarRevisionArtifact,
  candidateInspectionArtifact
}) {
  const responses = providerResponseLogArtifact?.responses || [];
  const networkAttempted = Boolean(configPresent && responses.some((response) => response.status !== 'blocked'));
  const networkSucceeded = networkAttempted && responses.some((response) => response.status === 'success');
  const sourceClaimsCreated = sourceClaimsArtifact?.claims?.length || 0;
  const grammarRevisionsCreated = grammarRevisionArtifact?.revisions?.length || 0;
  const candidateCount = retrievalCandidatesArtifact?.candidates?.length || 0;
  const cacheWriteCount = liveRetrievalCacheWriteArtifact?.cacheWrites?.length || 0;
  const safe = sourceClaimsCreated === 0 && grammarRevisionsCreated === 0;
  return MetagrinderRealEndpointProofReportSchema.parse({
    inputId,
    providerId,
    configPath,
    configPresent,
    networkAttempted,
    networkSucceeded,
    queriesExecuted: responses.filter((response) => response.status !== 'blocked').length,
    candidateCount,
    sourceClaimsCreated,
    grammarRevisionsCreated,
    cacheWriteCount,
    candidateInspectionCreated: Boolean(candidateInspectionArtifact),
    verdict: !configPresent
      ? 'skipped-no-provider-config'
      : safe
        ? networkSucceeded
          ? 'safe'
          : 'safe-failed-provider'
        : 'unsafe'
  });
}

module.exports = {
  buildRealEndpointProofReport
};

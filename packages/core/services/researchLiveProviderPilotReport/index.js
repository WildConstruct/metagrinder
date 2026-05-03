const {
  MetagrinderLiveProviderPilotReportSchema
} = require('../../types/metagrinder.runtime.js');

function buildLiveProviderPilotReport({
  inputId,
  providerId,
  retrievalPolicyArtifact,
  providerPreflightReportArtifact,
  providerResponseLogArtifact,
  retrievalCandidatesArtifact,
  liveRetrievalCacheWriteArtifact,
  sourceClaimsArtifact,
  grammarRevisionArtifact
}) {
  const responses = providerResponseLogArtifact?.responses || [];
  const networkAttempted = providerId === 'generic-http-search' &&
    retrievalPolicyArtifact.mode === 'live-candidate-only' &&
    providerPreflightReportArtifact.verdict === 'allowed' &&
    responses.some((response) => response.status !== 'blocked');
  const networkSucceeded = networkAttempted && responses.some((response) => response.status === 'success');
  const sourceClaimsCreated = sourceClaimsArtifact?.claims?.length || 0;
  const grammarRevisionsCreated = grammarRevisionArtifact?.revisions?.length || 0;
  const candidateCount = retrievalCandidatesArtifact?.candidates?.length || 0;
  const cacheWriteCount = liveRetrievalCacheWriteArtifact?.cacheWrites?.length || 0;
  const safe = sourceClaimsCreated === 0 && grammarRevisionsCreated === 0;
  return MetagrinderLiveProviderPilotReportSchema.parse({
    inputId,
    providerId,
    mode: retrievalPolicyArtifact.mode,
    networkAttempted,
    networkSucceeded,
    queryBudget: {
      maxQueriesTotal: retrievalPolicyArtifact.maxQueriesTotal,
      queriesExecuted: responses.filter((response) => response.status !== 'blocked').length,
      maxResultsPerQuery: retrievalPolicyArtifact.maxResultsPerQuery
    },
    candidateCount,
    sourceClaimsCreated,
    grammarRevisionsCreated,
    cacheWriteCount,
    autoPromotionBlocked: safe,
    verdict: safe
      ? networkSucceeded || !networkAttempted
        ? 'safe'
        : 'safe-failed-provider'
      : 'unsafe'
  });
}

module.exports = {
  buildLiveProviderPilotReport
};

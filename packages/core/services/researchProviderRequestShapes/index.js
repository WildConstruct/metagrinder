const {
  MetagrinderProviderRequestShapesSchema
} = require('../../types/metagrinder.runtime.js');

function buildProviderRequestShapes({
  researchQueryPlan,
  retrievalPolicyArtifact,
  providerId,
  providerPreflightReportArtifact
}) {
  const requests = [];
  const perGapCounts = new Map();
  researchQueryPlan.queries.forEach((query) => {
    const currentGapCount = perGapCounts.get(query.gapId) || 0;
    if (requests.length >= retrievalPolicyArtifact.maxQueriesTotal) return;
    if (currentGapCount >= retrievalPolicyArtifact.maxQueriesPerGap) return;
    perGapCounts.set(query.gapId, currentGapCount + 1);
    requests.push({
      requestShapeId: `provider_request_shape_${String(requests.length + 1).padStart(3, '0')}`,
      providerId,
      queryId: query.queryId,
      gapId: query.gapId,
      method: 'search',
      query: query.query.slice(0, 256),
      maxResults: retrievalPolicyArtifact.maxResultsPerQuery,
      allowedDomains: retrievalPolicyArtifact.allowedDomains || [],
      blockedDomains: retrievalPolicyArtifact.blockedDomains || [],
      allowedSourceTypes: retrievalPolicyArtifact.allowedSourceTypes || [],
      blockedSourceTypes: retrievalPolicyArtifact.blockedSourceTypes || [],
      wouldExecute: providerPreflightReportArtifact.verdict === 'allowed',
      reason: providerPreflightReportArtifact.verdict === 'allowed'
        ? 'provider-preflight-allowed'
        : 'provider-preflight-blocked'
    });
  });
  return MetagrinderProviderRequestShapesSchema.parse({
    inputId: researchQueryPlan.inputId,
    requests
  });
}

module.exports = {
  buildProviderRequestShapes
};

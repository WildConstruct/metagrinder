const {
  MetagrinderRetrievalPolicySchema
} = require('../../types/metagrinder.runtime.js');

const DEFAULT_ALLOWED_SOURCE_TYPES = [
  'archive',
  'museum',
  'library',
  'scholarly',
  'newspaper',
  'high-quality-secondary'
];

function buildRetrievalPolicyArtifact({
  inputId,
  policyFile,
  mode = 'mock',
  maxQueriesTotal,
  maxQueriesPerGap,
  maxResultsPerQuery,
  allowedSourceTypes,
  allowedDomains,
  blockedDomains,
  blockedSourceTypes,
  retrievalCacheDir,
  enableLiveRetrieval = false
}) {
  return MetagrinderRetrievalPolicySchema.parse({
    inputId,
    ...(policyFile || {}),
    mode: policyFile?.mode || mode || 'mock',
    allowLiveRetrieval: Boolean(enableLiveRetrieval || policyFile?.allowLiveRetrieval),
    maxQueriesTotal: Number(maxQueriesTotal || policyFile?.maxQueriesTotal || 10),
    maxQueriesPerGap: Number(maxQueriesPerGap || policyFile?.maxQueriesPerGap || 2),
    maxResultsPerQuery: Number(maxResultsPerQuery || policyFile?.maxResultsPerQuery || 5),
    allowedSourceTypes: allowedSourceTypes && allowedSourceTypes.length > 0
      ? allowedSourceTypes
      : policyFile?.allowedSourceTypes || DEFAULT_ALLOWED_SOURCE_TYPES,
    allowedDomains: allowedDomains && allowedDomains.length > 0
      ? allowedDomains.map((domain) => domain.toLowerCase())
      : policyFile?.allowedDomains || [],
    blockedDomains: blockedDomains && blockedDomains.length > 0
      ? blockedDomains.map((domain) => domain.toLowerCase())
      : policyFile?.blockedDomains || [],
    blockedSourceTypes: blockedSourceTypes && blockedSourceTypes.length > 0
      ? blockedSourceTypes
      : policyFile?.blockedSourceTypes || [],
    requireOperatorApprovalForSourceClaims: policyFile?.requireOperatorApprovalForSourceClaims !== false,
    allowLowQualitySources: Boolean(policyFile?.allowLowQualitySources),
    failOnProviderError: Boolean(policyFile?.failOnProviderError),
    cache: {
      ...(policyFile?.cache || {}),
      cacheDir: retrievalCacheDir || policyFile?.cache?.cacheDir || 'tmp/metagrinder-retrieval-cache'
    }
  });
}

module.exports = {
  buildRetrievalPolicyArtifact
};

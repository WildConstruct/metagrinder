const {
  MetagrinderProviderPreflightReportSchema
} = require('../../types/metagrinder.runtime.js');

function buildProviderPreflightReport({
  inputId,
  providerId,
  retrievalPolicyArtifact,
  liveRetrievalPreflightArtifact,
  liveProviderContractArtifact,
  providerConfigAppliedArtifact,
  env = process.env
}) {
  const provider = (liveProviderContractArtifact.providers || [])
    .find((entry) => entry.providerId === providerId);
  const checks = [
    {
      checkId: 'cli-enable-flag',
      passed: Boolean(retrievalPolicyArtifact.allowLiveRetrieval),
      message: retrievalPolicyArtifact.allowLiveRetrieval ? undefined : '--enable-live-retrieval is not set.'
    },
    {
      checkId: 'env-enable-flag',
      passed: providerId === 'fixture-live' || env.METAGRINDER_ENABLE_LIVE_RETRIEVAL === '1',
      message: providerId === 'fixture-live' || env.METAGRINDER_ENABLE_LIVE_RETRIEVAL === '1'
        ? undefined
        : 'METAGRINDER_ENABLE_LIVE_RETRIEVAL is not set.'
    },
    {
      checkId: 'provider-available',
      passed: Boolean(provider && ['fixture-only', 'available'].includes(provider.status)),
      message: provider && ['fixture-only', 'available'].includes(provider.status)
        ? undefined
        : `${providerId} provider is unavailable in this build.`
    },
    {
      checkId: 'endpoint-configured',
      passed: providerId !== 'generic-http-search' || Boolean(providerConfigAppliedArtifact?.endpointConfigured),
      message: providerId !== 'generic-http-search' || providerConfigAppliedArtifact?.endpointConfigured
        ? undefined
        : 'generic-http-search endpoint is not configured.'
    },
    {
      checkId: 'api-key-configured',
      passed: providerId !== 'generic-http-search' || Boolean(providerConfigAppliedArtifact?.apiKeyConfigured),
      message: providerId !== 'generic-http-search' || providerConfigAppliedArtifact?.apiKeyConfigured
        ? undefined
        : 'generic-http-search API key is not configured.'
    },
    {
      checkId: 'candidate-only',
      passed: Boolean(provider?.candidateOnly),
      message: provider?.candidateOnly ? undefined : 'Provider must be candidate-only.'
    },
    {
      checkId: 'source-type-allowlist',
      passed: (retrievalPolicyArtifact.allowedSourceTypes || []).length > 0,
      message: (retrievalPolicyArtifact.allowedSourceTypes || []).length > 0
        ? undefined
        : 'Live provider preflight requires allowedSourceTypes.'
    }
  ];
  const verdict = checks.every((check) => check.passed) && liveRetrievalPreflightArtifact.verdict === 'allowed'
    ? 'allowed'
    : 'blocked';
  return MetagrinderProviderPreflightReportSchema.parse({
    inputId,
    providerId,
    mode: retrievalPolicyArtifact.mode,
    status: verdict,
    checks,
    networkAllowed: Boolean(verdict === 'allowed' && liveRetrievalPreflightArtifact.networkAllowed && provider?.requiresNetwork),
    verdict
  });
}

module.exports = {
  buildProviderPreflightReport
};

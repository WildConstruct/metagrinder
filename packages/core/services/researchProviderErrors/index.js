const {
  MetagrinderProviderErrorReportSchema
} = require('../../types/metagrinder.runtime.js');

function buildProviderErrorReport({ inputId, providerId, providerPreflightReportArtifact, providerResponseLogArtifact }) {
  const preflightErrors = providerPreflightReportArtifact.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      providerId,
      errorType: check.checkId === 'provider-available'
        ? 'provider-unavailable'
        : 'provider-preflight-blocked',
      message: check.message || `Provider preflight check failed: ${check.checkId}`,
      fatal: false
    }));
  const responseErrors = (providerResponseLogArtifact?.responses || [])
    .filter((response) => response.status !== 'success' && response.status !== 'blocked')
    .map((response) => ({
      providerId: response.providerId,
      queryId: response.queryId,
      errorType: response.status,
      message: (response.warnings || []).join(' ') || `Provider response status: ${response.status}`,
      fatal: false
    }));
  return MetagrinderProviderErrorReportSchema.parse({
    inputId,
    errors: [...preflightErrors, ...responseErrors]
  });
}

module.exports = {
  buildProviderErrorReport
};

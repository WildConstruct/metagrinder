const {
  MetagrinderLiveProviderContractSchema
} = require('../../types/metagrinder.runtime.js');

function buildLiveProviderContract({ inputId, defaultProvider = 'unavailable' }) {
  return MetagrinderLiveProviderContractSchema.parse({
    inputId,
    defaultProvider,
    providers: [
      {
        providerId: 'generic-http-search',
        providerKind: 'search',
        status: 'available',
        requiresNetwork: true,
        requiresApiKey: true,
        requiresEnvVars: [
          'METAGRINDER_ENABLE_LIVE_RETRIEVAL',
          'METAGRINDER_SEARCH_ENDPOINT',
          'METAGRINDER_SEARCH_API_KEY'
        ],
        supportedModes: ['live-candidate-only'],
        candidateOnly: true,
        autoPromotionAllowed: false,
        maxQueryLength: 256,
        supportsDomainFilters: true,
        supportsSourceTypeFilters: false,
        supportsResultSnippets: true,
        supportsCacheWrite: true
      },
      {
        providerId: 'generic-search',
        providerKind: 'search',
        status: 'unavailable',
        requiresNetwork: true,
        requiresApiKey: false,
        requiresEnvVars: ['METAGRINDER_ENABLE_LIVE_RETRIEVAL'],
        supportedModes: ['live-candidate-only'],
        candidateOnly: true,
        autoPromotionAllowed: false,
        maxQueryLength: 256,
        supportsDomainFilters: true,
        supportsSourceTypeFilters: false,
        supportsResultSnippets: true,
        supportsCacheWrite: true
      },
      {
        providerId: 'fixture-live',
        providerKind: 'fixture',
        status: 'fixture-only',
        requiresNetwork: false,
        requiresApiKey: false,
        requiresEnvVars: [],
        supportedModes: ['live-candidate-only'],
        candidateOnly: true,
        autoPromotionAllowed: false,
        maxQueryLength: 256,
        supportsDomainFilters: true,
        supportsSourceTypeFilters: true,
        supportsResultSnippets: true,
        supportsCacheWrite: true
      },
      {
        providerId: 'unavailable',
        providerKind: 'unavailable',
        status: 'unavailable',
        requiresNetwork: false,
        requiresApiKey: false,
        requiresEnvVars: [],
        supportedModes: ['live-candidate-only'],
        candidateOnly: true,
        autoPromotionAllowed: false,
        maxQueryLength: 256,
        supportsDomainFilters: false,
        supportsSourceTypeFilters: false,
        supportsResultSnippets: false,
        supportsCacheWrite: false
      }
    ]
  });
}

module.exports = {
  buildLiveProviderContract
};

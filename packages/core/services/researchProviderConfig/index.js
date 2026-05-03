const fs = require('fs');

const {
  MetagrinderProviderConfigAppliedSchema
} = require('../../types/metagrinder.runtime.js');

const SECRET_KEYS = [
  'apiKey',
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'token',
  'bearerToken'
];

function hasSecretKey(key) {
  return SECRET_KEYS.some((secretKey) =>
    key.toLowerCase().includes(secretKey.toLowerCase())
  );
}

function redactValue(value) {
  if (typeof value === 'string' && value.length > 0) return '[REDACTED]';
  return value;
}

function redactSecrets(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      hasSecretKey(key) ? redactValue(entry) : redactSecrets(entry)
    ]));
  }
  return value;
}

function readProviderConfigFile(filePath) {
  if (!filePath) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildProviderConfigApplied({
  providerId,
  providerConfigFile,
  providerConfigFilePath,
  providerTimeoutMs,
  providerMaxRetries,
  env = process.env
}) {
  const config = providerConfigFile || {};
  const endpoint = config.endpoint || env.METAGRINDER_SEARCH_ENDPOINT;
  const apiKeyEnvVar = config.apiKeyEnv || config.apiKeyEnvVar || 'METAGRINDER_SEARCH_API_KEY';
  const requiresApiKey = config.requiresApiKey !== undefined
    ? Boolean(config.requiresApiKey)
    : providerId === 'generic-http-search';
  const apiKeyConfigured = !requiresApiKey || Boolean(config.apiKey || env[apiKeyEnvVar]);
  const endpointConfigured = providerId !== 'generic-http-search' || Boolean(endpoint);
  const timeoutMs = Number(providerTimeoutMs || config.timeoutMs || 5000);
  const maxRetries = Number(providerMaxRetries || config.maxRetries || 0);
  const warnings = [];
  if (providerId === 'generic-http-search' && !endpointConfigured) {
    warnings.push('generic-http-search requires METAGRINDER_SEARCH_ENDPOINT or provider config endpoint.');
  }
  if (providerId === 'generic-http-search' && requiresApiKey && !apiKeyConfigured) {
    warnings.push(`${apiKeyEnvVar} is required by provider config but is not set.`);
  }

  return {
    artifact: MetagrinderProviderConfigAppliedSchema.parse({
      providerId,
      endpointConfigured,
      apiKeyConfigured,
      timeoutMs,
      maxRetries,
      redaction: {
        redactedEnvVars: [apiKeyEnvVar],
        redactAuthorizationHeaders: true
      },
      networkEnabled: false,
      warnings,
      configSource: providerConfigFilePath,
      sanitizedConfig: redactSecrets(config)
    }),
    runtimeConfig: {
      providerId,
      endpoint,
      apiKey: config.apiKey || env[apiKeyEnvVar],
      apiKeyEnvVar,
      requiresApiKey,
      timeoutMs,
      maxRetries,
      fakeResults: config.fakeResults,
      fakeResponses: config.fakeResponses,
      fakeError: config.fakeError,
      resultPath: config.resultPath || 'results',
      fieldMap: config.fieldMap || {
        title: 'title',
        url: 'url',
        snippet: 'snippet',
        sourceType: 'sourceType'
      }
    }
  };
}

module.exports = {
  buildProviderConfigApplied,
  readProviderConfigFile,
  redactSecrets
};

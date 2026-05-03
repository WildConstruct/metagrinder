const crypto = require('crypto');
const { execFileSync } = require('child_process');

function domainFor(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_error) {
    return 'unknown';
  }
}

function canonicalizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch (_error) {
    return String(rawUrl || '').replace(/[?#].*$/, '');
  }
}

function classifyQuality(sourceType) {
  if (['scholarly'].includes(sourceType)) return 'high';
  if (['archive', 'museum', 'library', 'newspaper', 'high-quality-secondary'].includes(sourceType)) return 'medium';
  return 'low';
}

function readPath(value, rawPath) {
  return String(rawPath || '').split('.').filter(Boolean).reduce((current, key) =>
    current && current[key] !== undefined ? current[key] : undefined,
  value);
}

function normalizeResultToCandidate({ result, query, candidateId, fieldMap = {} }) {
  const title = readPath(result, fieldMap.title || 'title') || result.title;
  const rawUrl = readPath(result, fieldMap.url || 'url') || result.url;
  const snippet = readPath(result, fieldMap.snippet || 'snippet') || result.snippet || result.description;
  const sourceType = readPath(result, fieldMap.sourceType || 'sourceType') ||
    result.sourceType ||
    result.sourceTypeHypothesis ||
    'unknown';
  const url = rawUrl || 'about:blank';
  const canonicalUrl = canonicalizeUrl(url);
  return {
    candidateId,
    queryId: query.queryId,
    gapId: query.gapId,
    title: title || 'Untitled provider result',
    url,
    canonicalUrl,
    domain: domainFor(canonicalUrl),
    snippet: snippet || '',
    sourceTypeHypothesis: sourceType,
    sourceQualityHypothesis: result.sourceQuality || result.sourceQualityHypothesis || classifyQuality(sourceType),
    relevance: result.relevance || 'medium',
    retrievalMode: 'live-candidate-only',
    reviewStatus: 'candidate',
    canCreateSourceClaim: false
  };
}

function buildRequestUrl(endpoint, query, maxResults) {
  const url = new URL(endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(maxResults));
  return url.toString();
}

function defaultRequestJson({ url, headers, timeoutMs }) {
  const startedAt = Date.now();
  const args = ['-sS', '-L', '--max-time', String(Math.max(1, Math.ceil((timeoutMs || 5000) / 1000)))];
  Object.entries(headers || {}).forEach(([key, value]) => {
    args.push('-H', `${key}: ${value}`);
  });
  args.push('-w', '\n%{http_code}', url);
  const output = execFileSync('curl', args, { encoding: 'utf8' });
  const splitIndex = output.lastIndexOf('\n');
  const text = splitIndex >= 0 ? output.slice(0, splitIndex) : output;
  const status = splitIndex >= 0 ? Number(output.slice(splitIndex + 1)) : 0;
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_error) {
    json = undefined;
  }
  return {
    status,
    json,
    text,
    durationMs: Date.now() - startedAt
  };
}

function responseStatusFromHttp(status) {
  if (status === 429) return 'rate-limited';
  if (status >= 400) return 'provider-error';
  return 'success';
}

function searchGenericHttpCandidates({
  query,
  requestShape,
  providerConfig,
  httpClient = defaultRequestJson,
  maxResults,
  nextCandidateIndex,
  nextResponseIndex,
  now = () => new Date().toISOString()
}) {
  const startedAt = now();
  const warnings = [];
  const responseId = `provider_response_${String(nextResponseIndex).padStart(3, '0')}`;
  const requestId = `live_request_${String(nextResponseIndex).padStart(3, '0')}`;

  if (providerConfig.fakeError) {
    const status = providerConfig.fakeError;
    return {
      candidates: [],
      response: {
        responseId,
        providerId: 'generic-http-search',
        requestId,
        queryId: query.queryId,
        gapId: query.gapId,
        status,
        durationMs: 0,
        rawResultCount: 0,
        normalizedCandidateCount: 0,
        payloadHash: `sha256:${crypto.createHash('sha256').update(status).digest('hex')}`,
        cacheWriteIds: [],
        warnings: [`Provider returned ${status}.`]
      }
    };
  }

  const url = buildRequestUrl(providerConfig.endpoint, query.query, maxResults);
  const headers = providerConfig.apiKey
    ? { Authorization: 'Bearer [REDACTED]' }
    : {};

  try {
    const result = providerConfig.fakeResponses
      ? {
          status: 200,
          json: providerConfig.fakeResponses[query.queryId] || providerConfig.fakeResponses.default || { results: [] },
          durationMs: 1
        }
      : httpClient({
          url,
          method: 'GET',
          headers,
          query: query.query,
          timeoutMs: providerConfig.timeoutMs
        });

    const payload = result.json;
    const resultArray = readPath(payload, providerConfig.resultPath || 'results');
    if (!payload || !Array.isArray(resultArray)) {
      return {
        candidates: [],
        response: {
          responseId,
          providerId: 'generic-http-search',
          requestId,
          queryId: query.queryId,
          gapId: query.gapId,
          status: 'parse-error',
          httpStatus: result.status,
          durationMs: result.durationMs || 0,
          rawResultCount: 0,
          normalizedCandidateCount: 0,
          payloadHash: `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex')}`,
          cacheWriteIds: [],
          warnings: [`Provider response did not contain a ${providerConfig.resultPath || 'results'} array.`]
        }
      };
    }

    const candidates = resultArray.slice(0, maxResults).map((entry, index) =>
      normalizeResultToCandidate({
        result: entry,
        query,
        candidateId: `retrieval_candidate_live_${String(nextCandidateIndex + index).padStart(3, '0')}`,
        fieldMap: providerConfig.fieldMap
      })
    );
    const status = responseStatusFromHttp(result.status || 200);
    if (status !== 'success') warnings.push(`Provider returned HTTP ${result.status}.`);
    if (candidates.length === 0) warnings.push('Provider returned an empty result set.');
    return {
      candidates,
      response: {
        responseId,
        providerId: 'generic-http-search',
        requestId,
        queryId: query.queryId,
        gapId: query.gapId,
        status,
        httpStatus: result.status,
        durationMs: result.durationMs || 0,
        rawResultCount: resultArray.length,
        normalizedCandidateCount: candidates.length,
        payloadHash: `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`,
        cacheWriteIds: [],
        warnings
      },
      rawPayload: payload,
      requestShape
    };
  } catch (error) {
    const isTimeout = /timeout/i.test(error.message || '');
    return {
      candidates: [],
      response: {
        responseId,
        providerId: 'generic-http-search',
        requestId,
        queryId: query.queryId,
        gapId: query.gapId,
        status: isTimeout ? 'timeout' : 'provider-error',
        durationMs: 0,
        rawResultCount: 0,
        normalizedCandidateCount: 0,
        payloadHash: `sha256:${crypto.createHash('sha256').update(error.message || 'provider-error').digest('hex')}`,
        cacheWriteIds: [],
        warnings: [error.message || 'Provider request failed.']
      }
    };
  }
}

module.exports = {
  searchGenericHttpCandidates
};

const crypto = require('crypto');

const {
  MetagrinderLiveRetrievalPreflightSchema,
  MetagrinderLiveRetrievalRequestsSchema,
  MetagrinderLiveRetrievalCacheWriteSchema,
  MetagrinderProviderResponseLogSchema,
  MetagrinderRetrievalCandidatesArtifactSchema
} = require('../../types/metagrinder.runtime.js');
const {
  searchGenericHttpCandidates
} = require('../researchGenericHttpSearchProvider/index.js');

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

function buildLiveRetrievalPreflight({
  inputId,
  retrievalPolicyArtifact,
  enableLiveRetrieval = false,
  liveProvider = 'unavailable',
  env = process.env
}) {
  const enabledByCli = Boolean(enableLiveRetrieval || retrievalPolicyArtifact.allowLiveRetrieval);
  const enabledByEnv = env.METAGRINDER_ENABLE_LIVE_RETRIEVAL === '1';
  const sourceTypes = retrievalPolicyArtifact.allowedSourceTypes || [];
  const warnings = [];
  const isLiveMode = retrievalPolicyArtifact.mode === 'live-candidate-only';
  const isFixtureProvider = liveProvider === 'fixture-live';

  if (!isLiveMode) warnings.push('Live retrieval preflight is inactive outside live-candidate-only mode.');
  if (!enabledByCli) warnings.push('Live retrieval requires --enable-live-retrieval.');
  if (!enabledByEnv && !isFixtureProvider) warnings.push('Live retrieval requires METAGRINDER_ENABLE_LIVE_RETRIEVAL=1.');
  if (sourceTypes.length === 0) warnings.push('Live retrieval requires a non-empty source-type allowlist.');
  if (liveProvider === 'unavailable') warnings.push('Live provider is unavailable; no network request will be executed.');
  if (isFixtureProvider) warnings.push('fixture-live provider produces live-shaped candidates without network access.');

  const executionAllowed = isLiveMode && enabledByCli && sourceTypes.length > 0 &&
    (isFixtureProvider || enabledByEnv) && liveProvider !== 'unavailable';
  const networkAllowed = executionAllowed && !isFixtureProvider;

  return MetagrinderLiveRetrievalPreflightSchema.parse({
    inputId,
    mode: retrievalPolicyArtifact.mode,
    enabledByCli,
    enabledByEnv,
    networkAllowed,
    provider: liveProvider,
    queryBudget: {
      maxQueriesTotal: retrievalPolicyArtifact.maxQueriesTotal,
      maxResultsPerQuery: retrievalPolicyArtifact.maxResultsPerQuery
    },
    allowlist: {
      sourceTypes,
      allowedDomains: retrievalPolicyArtifact.allowedDomains || [],
      blockedDomains: retrievalPolicyArtifact.blockedDomains || []
    },
    verdict: executionAllowed ? 'allowed' : 'blocked',
    warnings
  });
}

function fixtureCandidatesForQuery({ query, queryIndex, maxResults }) {
  const fixtures = [
    {
      title: `Live-shaped archive candidate: ${query.gapId}`,
      url: `https://archive.example.org/metagrinder/${query.gapId}`,
      snippet: `Live-shaped archive result for ${query.query}.`,
      sourceTypeHypothesis: 'archive',
      sourceQualityHypothesis: 'medium',
      relevance: 'high'
    },
    {
      title: `Live-shaped museum candidate: ${query.gapId}`,
      url: `https://museum.example.org/metagrinder/${query.gapId}`,
      snippet: `Live-shaped museum result for ${query.query}.`,
      sourceTypeHypothesis: 'museum',
      sourceQualityHypothesis: 'medium',
      relevance: 'medium'
    },
    {
      title: `Live-shaped unknown candidate: ${query.gapId}`,
      url: `https://unknown.example.org/metagrinder/${query.gapId}`,
      snippet: `Unclassified live-shaped result for ${query.query}.`,
      sourceTypeHypothesis: 'unknown',
      sourceQualityHypothesis: 'low',
      relevance: 'medium'
    },
    {
      title: `Stock photo candidate: ${query.gapId}`,
      url: `https://shutterstock.example.org/metagrinder/${query.gapId}`,
      snippet: `Stock photo style result for ${query.query}.`,
      sourceTypeHypothesis: 'stock-photo',
      sourceQualityHypothesis: 'low',
      relevance: 'low'
    }
  ];

  return fixtures.slice(0, maxResults).map((fixture, resultIndex) => {
    const candidateIndex = (queryIndex * maxResults) + resultIndex + 1;
    const canonicalUrl = canonicalizeUrl(fixture.url);
    return {
      candidateId: `retrieval_candidate_live_${String(candidateIndex).padStart(3, '0')}`,
      queryId: query.queryId,
      gapId: query.gapId,
      title: fixture.title,
      url: fixture.url,
      canonicalUrl,
      domain: domainFor(canonicalUrl),
      snippet: fixture.snippet,
      sourceTypeHypothesis: fixture.sourceTypeHypothesis,
      sourceQualityHypothesis: fixture.sourceQualityHypothesis,
      relevance: fixture.relevance,
      retrievalMode: 'live-candidate-only',
      reviewStatus: 'candidate',
      canCreateSourceClaim: false
    };
  });
}

function candidateAllowed(candidate, retrievalPolicyArtifact) {
  const allowed = retrievalPolicyArtifact.allowedSourceTypes || [];
  const blockedSourceTypes = retrievalPolicyArtifact.blockedSourceTypes || [];
  const blockedDomains = retrievalPolicyArtifact.blockedDomains || [];
  const allowedDomains = retrievalPolicyArtifact.allowedDomains || [];
  if (blockedDomains.includes(candidate.domain)) return false;
  if (allowedDomains.length > 0 && !allowedDomains.includes(candidate.domain)) return false;
  if (blockedSourceTypes.includes(candidate.sourceTypeHypothesis)) return false;
  return allowed.length === 0 || allowed.includes(candidate.sourceTypeHypothesis);
}

function searchLiveCandidates({
  researchQueryPlan,
  retrievalPolicyArtifact,
  liveRetrievalPreflightArtifact,
  providerPreflightReportArtifact,
  providerRequestShapesArtifact,
  providerConfigRuntime,
  providerHttpClient,
  liveProvider = 'unavailable',
  now = () => new Date().toISOString()
}) {
  if (retrievalPolicyArtifact.mode !== 'live-candidate-only') {
    return {
      liveRetrievalRequestsArtifact: MetagrinderLiveRetrievalRequestsSchema.parse({
        inputId: researchQueryPlan.inputId,
        requests: []
      }),
      liveRetrievalCacheWriteArtifact: MetagrinderLiveRetrievalCacheWriteSchema.parse({
        inputId: researchQueryPlan.inputId,
        cacheWrites: []
      }),
      providerResponseLogArtifact: MetagrinderProviderResponseLogSchema.parse({
        inputId: researchQueryPlan.inputId,
        responses: []
      }),
      retrievalCandidatesArtifact: MetagrinderRetrievalCandidatesArtifactSchema.parse({
        inputId: researchQueryPlan.inputId,
        candidates: []
      })
    };
  }

  const allowedQueries = [];
  const perGapCounts = new Map();
  researchQueryPlan.queries.forEach((query) => {
    const currentGapCount = perGapCounts.get(query.gapId) || 0;
    if (allowedQueries.length >= retrievalPolicyArtifact.maxQueriesTotal) return;
    if (currentGapCount >= retrievalPolicyArtifact.maxQueriesPerGap) return;
    allowedQueries.push(query);
    perGapCounts.set(query.gapId, currentGapCount + 1);
  });

  const candidates = [];
  const requests = [];
  const cacheWrites = [];
  const providerResponses = [];
  const allowedQueryIds = new Set(allowedQueries.map((query) => query.queryId));

  researchQueryPlan.queries.forEach((query, queryIndex) => {
    if (!allowedQueryIds.has(query.queryId)) return;
    const startedAt = now();
    const requestWarnings = [];
    let queryCandidates = [];
    let executed = false;

    const requestShape = (providerRequestShapesArtifact?.requests || [])
      .find((shape) => shape.queryId === query.queryId);
    if ((providerPreflightReportArtifact || liveRetrievalPreflightArtifact).verdict === 'allowed' && liveProvider === 'fixture-live') {
      executed = true;
      queryCandidates = fixtureCandidatesForQuery({
        query,
        queryIndex,
        maxResults: retrievalPolicyArtifact.maxResultsPerQuery
      }).filter((candidate) => {
        const allowed = candidateAllowed(candidate, retrievalPolicyArtifact);
        if (!allowed) requestWarnings.push(`Candidate ${candidate.candidateId} blocked by domain/source-type policy.`);
        return allowed;
      });
      candidates.push(...queryCandidates);
    } else if ((providerPreflightReportArtifact || liveRetrievalPreflightArtifact).verdict === 'allowed' && liveProvider === 'generic-http-search') {
      executed = true;
      const providerResult = searchGenericHttpCandidates({
        query,
        requestShape,
        providerConfig: providerConfigRuntime || {},
        httpClient: providerHttpClient,
        maxResults: retrievalPolicyArtifact.maxResultsPerQuery,
        nextCandidateIndex: candidates.length + 1,
        nextResponseIndex: providerResponses.length + 1,
        now
      });
      queryCandidates = (providerResult.candidates || []).filter((candidate) => {
        const allowed = candidateAllowed(candidate, retrievalPolicyArtifact);
        if (!allowed) requestWarnings.push(`Candidate ${candidate.candidateId} blocked by domain/source-type policy.`);
        return allowed;
      });
      const droppedCount = (providerResult.candidates || []).length - queryCandidates.length;
      if (droppedCount > 0 && providerResult.response) {
        providerResult.response.warnings = [
          ...(providerResult.response.warnings || []),
          `${droppedCount} candidate(s) blocked by domain/source-type policy.`
        ];
      }
      providerResponses.push(providerResult.response);
      candidates.push(...queryCandidates);
    } else {
      requestWarnings.push('Live retrieval preflight blocked execution; no network request was made.');
      providerResponses.push({
        responseId: `provider_response_${String(providerResponses.length + 1).padStart(3, '0')}`,
        providerId: liveProvider,
        requestId: `live_request_${String(requests.length + 1).padStart(3, '0')}`,
        queryId: query.queryId,
        gapId: query.gapId,
        status: 'blocked',
        durationMs: 0,
        rawResultCount: 0,
        normalizedCandidateCount: 0,
        payloadHash: `sha256:${crypto.createHash('sha256').update(`${liveProvider}:${query.queryId}:blocked`).digest('hex')}`,
        cacheWriteIds: [],
        warnings: requestWarnings
      });
    }

    const requestCacheWriteIds = queryCandidates.map((candidate, candidateIndex) => {
      const cacheRecordId = `cache_record_live_${String(cacheWrites.length + candidateIndex + 1).padStart(3, '0')}`;
      return cacheRecordId;
    });

    queryCandidates.forEach((candidate, candidateIndex) => {
      const cacheRecordId = requestCacheWriteIds[candidateIndex];
      const payloadHash = `sha256:${crypto.createHash('sha256').update(JSON.stringify(candidate)).digest('hex')}`;
      cacheWrites.push({
        cacheRecordId,
        candidateId: candidate.candidateId,
        queryId: candidate.queryId,
        gapId: candidate.gapId,
        payloadHash,
        writtenAt: now(),
        cachePath: `tmp/metagrinder-retrieval-cache/${cacheRecordId}.json`,
        providerId: liveProvider,
        providerRequestShapeId: requestShape?.requestShapeId,
        providerResponseId: providerResponses[providerResponses.length - 1]?.responseId,
        rawCandidatePayload: candidate,
        normalizedCandidatePayload: candidate,
        candidate
      });
    });
    if (providerResponses.length > 0) {
      const response = providerResponses[providerResponses.length - 1];
      if (response && response.queryId === query.queryId) {
        response.cacheWriteIds = requestCacheWriteIds;
        response.normalizedCandidateCount = queryCandidates.length;
      }
    }

    requests.push({
      requestId: `live_request_${String(requests.length + 1).padStart(3, '0')}`,
      queryId: query.queryId,
      gapId: query.gapId,
      query: query.query,
      provider: liveProvider,
      executed,
      startedAt,
      completedAt: now(),
      resultCount: queryCandidates.length,
      cacheWriteIds: requestCacheWriteIds,
      warnings: requestWarnings
    });
  });

  return {
    liveRetrievalRequestsArtifact: MetagrinderLiveRetrievalRequestsSchema.parse({
      inputId: researchQueryPlan.inputId,
      requests
    }),
    liveRetrievalCacheWriteArtifact: MetagrinderLiveRetrievalCacheWriteSchema.parse({
      inputId: researchQueryPlan.inputId,
      cacheWrites
    }),
    providerResponseLogArtifact: MetagrinderProviderResponseLogSchema.parse({
      inputId: researchQueryPlan.inputId,
      responses: providerResponses
    }),
    retrievalCandidatesArtifact: MetagrinderRetrievalCandidatesArtifactSchema.parse({
      inputId: researchQueryPlan.inputId,
      candidates
    })
  };
}

module.exports = {
  buildLiveRetrievalPreflight,
  searchLiveCandidates
};

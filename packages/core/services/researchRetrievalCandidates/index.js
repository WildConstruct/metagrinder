const {
  MetagrinderRetrievalCandidatesArtifactSchema,
  MetagrinderRetrievalRunLogSchema
} = require('../../types/metagrinder.runtime.js');

function canonicalizeMockUrl(rawUrl) {
  return String(rawUrl || '').replace(/[?#].*$/, '').toLowerCase();
}

function domainFor(rawUrl) {
  if (String(rawUrl || '').startsWith('mock://')) return 'mock';
  if (String(rawUrl || '').startsWith('cache://')) return 'cache';
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_error) {
    return 'unknown';
  }
}

function sourceTypeAllowed(candidate, retrievalPolicyArtifact) {
  const allowed = retrievalPolicyArtifact.allowedSourceTypes || [];
  return allowed.includes(candidate.sourceTypeHypothesis) ||
    (candidate.sourceTypeHypothesis === 'archival-photo' && allowed.includes('archive'));
}

function candidateFromResult(result, queryId, retrievalMode, index) {
  return {
    candidateId: `retrieval_candidate_${String(index + 1).padStart(3, '0')}`,
    queryId,
    gapId: result.gapId,
    title: result.title,
    url: result.url,
    canonicalUrl: canonicalizeMockUrl(result.url),
    domain: domainFor(result.url),
    snippet: result.claimsExtracted?.[0]?.claim || `Candidate evidence for ${result.gapId}.`,
    sourceTypeHypothesis: result.sourceType,
    sourceQualityHypothesis: result.sourceQuality,
    relevance: result.relevance,
    retrievalMode,
    reviewStatus: 'candidate',
    canCreateSourceClaim: false
  };
}

function buildRetrievalRunBoundary({
  researchQueryPlan,
  retrievalPolicyArtifact,
  mockWebResearchResults,
  cacheCandidatesArtifact,
  liveRetrievalPreflightArtifact,
  liveRetrievalRequestsArtifact,
  liveCandidatesArtifact,
  now = () => new Date().toISOString()
}) {
  const startedAt = now();
  const allowedQueries = [];
  const perGapCounts = new Map();
  const warnings = [];

  researchQueryPlan.queries.forEach((query) => {
    const currentGapCount = perGapCounts.get(query.gapId) || 0;
    if (allowedQueries.length >= retrievalPolicyArtifact.maxQueriesTotal) return;
    if (currentGapCount >= retrievalPolicyArtifact.maxQueriesPerGap) return;
    allowedQueries.push(query);
    perGapCounts.set(query.gapId, currentGapCount + 1);
  });

  const allowedQueryIds = new Set(allowedQueries.map((query) => query.queryId));
  const candidates = [];
  const queryAttempts = researchQueryPlan.queries.map((query, index) => {
    const allowedByBudget = allowedQueryIds.has(query.queryId);
    const mode = retrievalPolicyArtifact.mode;
    const wouldExecute = allowedByBudget && ['dry-run', 'live-candidate-only'].includes(mode);
    let resultCount = 0;
    let reason = allowedByBudget
      ? `${mode} mode handled by controlled retrieval boundary.`
      : 'Skipped by retrieval budget.';

    if (mode === 'dry-run') {
      reason = allowedByBudget
        ? 'dry-run mode records planned request without network access'
        : reason;
    } else if (mode === 'mock') {
      const mockResults = allowedByBudget
        ? (mockWebResearchResults?.results || [])
            .filter((result) => result.gapId === query.gapId)
            .slice(0, retrievalPolicyArtifact.maxResultsPerQuery)
        : [];
      mockResults.forEach((result, resultIndex) => {
        const candidate = candidateFromResult(result, query.queryId, 'mock', candidates.length + resultIndex);
        if (sourceTypeAllowed(candidate, retrievalPolicyArtifact) &&
          (retrievalPolicyArtifact.allowLowQualitySources || candidate.sourceQualityHypothesis !== 'low')) {
          candidates.push(candidate);
        }
      });
      resultCount = mockResults.length;
      reason = allowedByBudget
        ? 'mock mode replayed deterministic mock adapter results'
        : reason;
    } else if (mode === 'cache-replay') {
      const cachePool = cacheCandidatesArtifact?.candidates || [];
      const queryMatches = allowedByBudget
        ? cachePool.filter((candidate) => candidate.queryId === query.queryId)
        : [];
      const cacheResults = queryMatches
        .slice(0, retrievalPolicyArtifact.maxResultsPerQuery)
        .map((candidate, candidateIndex) => ({
          ...candidate,
          candidateId: String(candidate.candidateId || '').startsWith('retrieval_candidate_live_')
            ? candidate.candidateId
            : `retrieval_candidate_${String(candidates.length + candidateIndex + 1).padStart(3, '0')}`,
          retrievalMode: String(candidate.candidateId || '').startsWith('retrieval_candidate_live_')
            ? candidate.retrievalMode
            : 'cache-replay',
          reviewStatus: 'candidate',
          canCreateSourceClaim: false
        }));
      cacheResults.forEach((candidate) => {
        if (sourceTypeAllowed(candidate, retrievalPolicyArtifact) &&
          (retrievalPolicyArtifact.allowLowQualitySources || candidate.sourceQualityHypothesis !== 'low')) {
          candidates.push(candidate);
        }
      });
      resultCount = cacheResults.length;
      reason = allowedByBudget
        ? 'cache-replay mode used deterministic cached candidates without network access'
        : reason;
    } else if (mode === 'live-candidate-only') {
      const liveRequest = (liveRetrievalRequestsArtifact?.requests || [])
        .find((request) => request.queryId === query.queryId);
      const liveCandidates = allowedByBudget
        ? (liveCandidatesArtifact?.candidates || []).filter((candidate) => candidate.queryId === query.queryId)
        : [];
      liveCandidates.forEach((candidate) => candidates.push(candidate));
      resultCount = liveCandidates.length;
      reason = allowedByBudget
        ? liveRequest?.warnings?.[0] || (
            liveRetrievalPreflightArtifact?.networkAllowed
              ? 'live-candidate-only produced candidate-only retrieval results'
              : 'live-candidate-only preflight blocked execution; no network was used'
          )
        : reason;
      if (liveRetrievalPreflightArtifact?.warnings?.length) {
        warnings.push(...liveRetrievalPreflightArtifact.warnings);
      }
      if (liveRequest?.warnings?.length) {
        warnings.push(...liveRequest.warnings);
      }
    } else if (mode === 'off') {
      reason = allowedByBudget
        ? 'retrieval mode off; query was not executed'
        : reason;
    }

    return {
      queryAttemptId: `query_attempt_${String(index + 1).padStart(3, '0')}`,
      queryId: query.queryId,
      gapId: query.gapId,
      query: query.query,
      mode,
      wouldExecute,
      executed: false,
      ...(mode === 'live-candidate-only' && {
        executed: Boolean(liveRetrievalRequestsArtifact?.requests?.find((request) =>
          request.queryId === query.queryId && request.executed
        ))
      }),
      reason,
      resultCount: allowedByBudget ? resultCount : 0
    };
  });

  return {
    retrievalCandidatesArtifact: MetagrinderRetrievalCandidatesArtifactSchema.parse({
      inputId: researchQueryPlan.inputId,
      candidates
    }),
    retrievalRunLogArtifact: MetagrinderRetrievalRunLogSchema.parse({
      inputId: researchQueryPlan.inputId,
      mode: retrievalPolicyArtifact.mode,
      startedAt,
      completedAt: now(),
      queryAttempts,
      budgetUse: {
        queriesPlanned: researchQueryPlan.queries.length,
        queriesAllowed: allowedQueries.length,
        queriesExecuted: queryAttempts.filter((attempt) => attempt.executed).length,
        queriesSkippedByBudget: researchQueryPlan.queries.length - allowedQueries.length
      },
      warnings: [...new Set(warnings)]
    })
  };
}

module.exports = {
  buildRetrievalRunBoundary,
  candidateFromResult
};

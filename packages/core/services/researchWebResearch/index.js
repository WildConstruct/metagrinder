const {
  MetagrinderWebResearchResultsSchema
} = require('../../types/metagrinder.runtime.js');

const MOCK_SOURCE_TYPES = [
  {
    sourceType: 'archival-photo',
    sourceQuality: 'medium',
    relevance: 'high',
    titlePrefix: 'Archival photograph evidence',
    limitation: 'Mock archival-photo result; useful for visual placement patterns, not final authority.'
  },
  {
    sourceType: 'museum',
    sourceQuality: 'medium',
    relevance: 'medium',
    titlePrefix: 'Museum collection note',
    limitation: 'Mock museum record; requires curator/source review before acceptance.'
  },
  {
    sourceType: 'newspaper',
    sourceQuality: 'medium',
    relevance: 'medium',
    titlePrefix: 'Period newspaper mention',
    limitation: 'Mock newspaper result; event language may exaggerate attendance or social mix.'
  },
  {
    sourceType: 'high-quality-secondary',
    sourceQuality: 'medium',
    relevance: 'medium',
    titlePrefix: 'Secondary research synthesis',
    limitation: 'Mock secondary source; should corroborate rather than replace primary evidence.'
  },
  {
    sourceType: 'low-quality-source',
    sourceQuality: 'low',
    relevance: 'low',
    titlePrefix: 'Low-quality web summary',
    limitation: 'Low-quality mock source; may only create low-confidence review flags.'
  }
];

function createMockWebResearchAdapter({ now = () => new Date().toISOString() } = {}) {
  return {
    mode: 'mock',
    retrieve({ researchQueryPlan, researchGapArtifact }) {
      return buildWebResearchResults({
        researchQueryPlan,
        researchGapArtifact,
        now
      });
    }
  };
}

function createLiveWebResearchAdapter() {
  throw new Error('Live web research adapter is not implemented; audit mode uses the mock adapter only.');
}

function claimForGap(gap) {
  const refs = gap.affectedGrammarRefs && gap.affectedGrammarRefs.length > 0
    ? gap.affectedGrammarRefs
    : ['sceneGrammar'];

  if (gap.gapType === 'under-supported-distribution') {
    return {
      claim: 'Comparable scene evidence can refine the asserted distribution, but the current grammar should keep it as a reviewable range.',
      supportsGrammarRefs: refs,
      confidence: 'medium'
    };
  }

  if (gap.gapType === 'visual-reference-without-support') {
    return {
      claim: 'Visual references should be linked to specific supported silhouette, wardrobe, density, posture, or environment claims.',
      supportsGrammarRefs: refs,
      confidence: 'medium'
    };
  }

  if (gap.gapType === 'negative-constraint-not-enforced') {
    return {
      claim: 'Detected negative constraints need explicit compatibility or sampler enforcement before graph compilation.',
      supportsGrammarRefs: refs,
      confidence: 'medium'
    };
  }

  return {
    claim: `Mock retrieved source provides bounded support for gap question: ${gap.question}`,
    supportsGrammarRefs: refs,
    confidence: 'medium'
  };
}

function buildWebResearchResults({
  researchQueryPlan,
  researchGapArtifact,
  now = () => new Date().toISOString()
}) {
  const retrievedAt = now();
  const gapsById = new Map((researchGapArtifact?.gaps || []).map((gap) => [gap.gapId, gap]));
  const representativeQueries = researchQueryPlan.queries.filter((query, index, all) =>
    all.findIndex((candidate) => candidate.gapId === query.gapId) === index
  );

  const results = representativeQueries.flatMap((query, queryIndex) => {
    const gap = gapsById.get(query.gapId) || {
      gapId: query.gapId,
      gapType: 'sampling-risk',
      question: query.purpose || query.query,
      affectedGrammarRefs: []
    };

    return MOCK_SOURCE_TYPES.map((source, sourceIndex) => ({
      resultId: `${query.gapId}_mock_result_${String(sourceIndex + 1).padStart(2, '0')}`,
      gapId: query.gapId,
      sourceType: source.sourceType,
      title: `${source.titlePrefix}: ${query.query}`,
      url: `mock://metagrinder/${encodeURIComponent(query.query)}/${source.sourceType}`,
      retrievedAt,
      relevance: source.relevance,
      sourceQuality: source.sourceQuality,
      claimsExtracted: source.sourceQuality === 'low'
        ? [{
            claim: 'Uncited or weakly sourced material should not create high-confidence grammar revisions.',
            supportsGrammarRefs: gap.affectedGrammarRefs || [],
            confidence: 'low'
          }]
        : [claimForGap(gap)],
      limitations: [
        source.limitation,
        `Mock adapter result ${queryIndex + 1}; live retrieval remains deferred.`
      ]
    }));
  });

  return MetagrinderWebResearchResultsSchema.parse({
    inputId: researchQueryPlan.inputId,
    adapterMode: 'mock',
    retrievedAt,
    results
  });
}

function buildApprovedWebResearchResults({
  approvedSourceResultsArtifact,
  retrievalCandidatesArtifact,
  researchGapArtifact,
  now = () => new Date().toISOString()
}) {
  const retrievedAt = now();
  const candidatesById = new Map((retrievalCandidatesArtifact?.candidates || []).map((candidate) => [
    candidate.candidateId,
    candidate
  ]));
  const gapsById = new Map((researchGapArtifact?.gaps || []).map((gap) => [gap.gapId, gap]));
  const results = (approvedSourceResultsArtifact?.approvedResults || []).map((approvedResult) => {
    const candidate = candidatesById.get(approvedResult.candidateId);
    const gap = gapsById.get(approvedResult.gapId);
    return {
      resultId: approvedResult.approvedResultId,
      gapId: approvedResult.gapId,
      sourceType: approvedResult.sourceType,
      title: approvedResult.title,
      url: approvedResult.url,
      retrievedAt,
      relevance: candidate?.relevance || 'medium',
      sourceQuality: approvedResult.sourceQuality,
      claimsExtracted: [{
        claim: candidate?.snippet || `Approved operator-reviewed source result for ${approvedResult.gapId}.`,
        supportsGrammarRefs: gap?.affectedGrammarRefs || [],
        confidence: approvedResult.sourceQuality
      }],
      limitations: [
        'Operator-approved retrieval candidate; use remains subject to source-specific citation review.'
      ]
    };
  });

  return MetagrinderWebResearchResultsSchema.parse({
    inputId: approvedSourceResultsArtifact.inputId,
    adapterMode: 'mock',
    retrievedAt,
    results
  });
}

function buildEmptyWebResearchResults({ inputId, adapterMode = 'off', now = () => new Date().toISOString() }) {
  return MetagrinderWebResearchResultsSchema.parse({
    inputId,
    adapterMode,
    retrievedAt: now(),
    results: []
  });
}

module.exports = {
  buildApprovedWebResearchResults,
  buildEmptyWebResearchResults,
  buildWebResearchResults,
  createLiveWebResearchAdapter,
  createMockWebResearchAdapter
};

const {
  MetagrinderResearchQueryPlanSchema
} = require('../../types/metagrinder.runtime.js');

function buildResearchQueryPlan({ researchGapArtifact }) {
  const maxQueriesPerGap = 3;
  const queries = [];

  researchGapArtifact.gaps.forEach((gap) => {
    gap.recommendedSearches.slice(0, maxQueriesPerGap).forEach((query, index) => {
      queries.push({
        queryId: `${gap.gapId}_query_${String(index + 1).padStart(2, '0')}`,
        gapId: gap.gapId,
        query,
        purpose: `Find source support for: ${gap.question}`,
        allowedSourceTypes: [
          'archive',
          'museum',
          'library',
          'scholarly',
          'newspaper',
          'high-quality-secondary'
        ],
        maxResults: 5,
        priority: gap.severity === 'high' ? 'high' : 'medium'
      });
    });
  });

  return MetagrinderResearchQueryPlanSchema.parse({
    inputId: researchGapArtifact.inputId,
    webResearchMode: 'gaps-only',
    maxQueriesPerGap,
    maxSourcesPerGap: 5,
    allowedSourceTypes: [
      'archive',
      'museum',
      'library',
      'scholarly',
      'newspaper',
      'high-quality-secondary'
    ],
    requireCitationForGrammarRevision: true,
    queries
  });
}

module.exports = {
  buildResearchQueryPlan
};

const {
  MetagrinderClassifyArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function titleCaseBucketLabel(category) {
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildClassifyArtifact({ ingestArtifact, extractArtifact }) {
  const bucketsByCategory = new Map();

  extractArtifact.conceptCandidates.forEach((concept) => {
    const unresolved = concept.confidence !== 'high' || concept.attributionMode === 'inferred';
    const category = unresolved ? 'unresolved' : concept.category;

    if (!bucketsByCategory.has(category)) {
      bucketsByCategory.set(category, {
        bucketId: `${extractArtifact.inputId}_bucket_${category}`,
        label: titleCaseBucketLabel(category),
        category,
        conceptIds: [],
        claimIds: []
      });
    }

    bucketsByCategory.get(category).conceptIds.push(concept.conceptId);
  });

  extractArtifact.claims.forEach((claim) => {
    const unresolved = claim.confidence !== 'high' || claim.attributionMode === 'inferred';
    const category = unresolved ? 'unresolved' : claim.category;

    if (!bucketsByCategory.has(category)) {
      bucketsByCategory.set(category, {
        bucketId: `${extractArtifact.inputId}_bucket_${category}`,
        label: titleCaseBucketLabel(category),
        category,
        conceptIds: [],
        claimIds: []
      });
    }

    bucketsByCategory.get(category).claimIds.push(claim.claimId);
  });

  return MetagrinderClassifyArtifactSchema.parse({
    inputId: extractArtifact.inputId,
    collections: {
      sourceMapChunkIds: ingestArtifact.chunks.map((chunk) => chunk.chunkId),
      claimsAndEvidenceClaimIds: extractArtifact.claims.map((claim) => claim.claimId),
      conceptClusterBuckets: Array.from(bucketsByCategory.values())
    }
  });
}

module.exports = {
  buildClassifyArtifact
};

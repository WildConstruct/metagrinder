const {
  MetagrinderAssumptionReviewArtifactSchema,
  MetagrinderAugmentationPlanArtifactSchema,
  MetagrinderCategoryHypothesisArtifactSchema,
  MetagrinderClassifyArtifactSchema,
  MetagrinderExtractArtifactSchema,
  MetagrinderIngestArtifactSchema,
  MetagrinderModeDetectionArtifactSchema,
  MetagrinderMutationArtifactSchema,
  MetagrinderMutationReviewArtifactSchema,
  MetagrinderReviewArtifactSchema,
  MetagrinderScoreArtifactSchema,
  MetagrinderSynthesizeArtifactSchema,
  ResearchPackageManifestSchema
} = require('../../types/metagrinder.runtime.js');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'research-input';
}

function titleCaseBucketLabel(category) {
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildSourceMapPsg({ ingestArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const sectionLabels = [...new Set(
    ingestArtifact.chunks
      .map((chunk) => chunk.sectionLabel)
      .filter(Boolean)
  )];

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Source Map`,
    description: 'Metagrinder source-map fragment preserving chunked source coverage.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'source-map',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: ingestArtifact.chunks.map((chunk, index) => ({
      id: chunk.chunkId,
      type: 'TextBlock',
      name: `Source Chunk ${index + 1}`,
      description: chunk.sectionLabel,
      x: 120,
      y: 120 + (index * 160),
      value: chunk.text,
      data: {
        sourceInputId: chunk.sourceInputId,
        sectionLabel: chunk.sectionLabel,
        sequence: chunk.sequence,
        tags: chunk.tags
      }
    })),
    edges: [],
    regions: sectionLabels.map((label) => ({
      id: `${ingestArtifact.inputId}_${slugify(label)}_region`,
      name: label,
      nodes: ingestArtifact.chunks
        .filter((chunk) => chunk.sectionLabel === label)
        .map((chunk) => chunk.chunkId)
    }))
  };
}

function buildConceptClustersPsg({ ingestArtifact, extractArtifact, classifyArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const conceptMap = new Map(
    extractArtifact.conceptCandidates.map((concept) => [concept.conceptId, concept])
  );
  const bucketNodes = [];
  const edges = [];

  classifyArtifact.collections.conceptClusterBuckets.forEach((bucket, bucketIndex) => {
    bucket.conceptIds.forEach((conceptId, conceptIndex) => {
      const concept = conceptMap.get(conceptId);
      if (!concept) {
        return;
      }

      const nodeId = `${bucket.bucketId}_concept_${String(conceptIndex + 1).padStart(3, '0')}`;
      bucketNodes.push({
        id: nodeId,
        type: 'TextBlock',
        name: concept.label,
        description: concept.summary,
        x: 160 + (bucketIndex * 260),
        y: 120 + (conceptIndex * 150),
        value: concept.label,
        data: {
          conceptId: concept.conceptId,
          category: concept.category,
          confidence: concept.confidence,
          sourceInputIds: concept.sourceInputIds,
          sourceChunkIds: concept.sourceChunkIds,
          attributionMode: concept.attributionMode
        }
      });

      if (conceptIndex > 0) {
        edges.push({
          id: `${bucket.bucketId}_edge_${conceptIndex}`,
          source: `${bucket.bucketId}_concept_${String(conceptIndex).padStart(3, '0')}`,
          target: nodeId
        });
      }
    });
  });

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Concept Clusters`,
    description: 'Metagrinder concept-clusters fragment grouped into reusable scene categories.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'concept-clusters',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: bucketNodes,
    edges,
    regions: classifyArtifact.collections.conceptClusterBuckets.map((bucket) => ({
      id: `${bucket.bucketId}_region`,
      name: bucket.label,
      nodes: bucket.conceptIds.map((_, index) =>
        `${bucket.bucketId}_concept_${String(index + 1).padStart(3, '0')}`
      ),
      metadata: {
        category: bucket.category,
        claimIds: bucket.claimIds
      }
    }))
  };
}

function buildPromptSynthesisPsg({ ingestArtifact, synthesizeArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const families = ['atmosphere', 'wardrobe', 'crowd-behavior', 'lighting'];
  const familyNodes = families.map((family, index) => {
    const fragments = synthesizeArtifact.promptFragments.filter(
      (fragment) => fragment.family === family
    );

    return {
      id: `${family}-choice`,
      type: 'WeightedChoice',
      name: titleCaseBucketLabel(family),
      description: `Prompt family for ${family}`,
      x: 120,
      y: 120 + (index * 180),
      options: fragments.map((fragment) => ({
        text: fragment.text,
        weight: fragment.conceptIds.length > 0 ? 2 : 1,
        meta: {
          fragmentId: fragment.fragmentId,
          family: fragment.family,
          conceptIds: fragment.conceptIds,
          sourceInputIds: fragment.sourceInputIds,
          sourceChunkIds: fragment.sourceChunkIds
        }
      }))
    };
  });

  const concatNode = {
    id: 'prompt-compose',
    type: 'Concat',
    name: 'Prompt Compose',
    x: 520,
    y: 360,
    data: {
      separator: ', '
    }
  };

  const outputNode = {
    id: 'prompt-output',
    type: 'Output',
    name: 'Prompt Output',
    x: 860,
    y: 360,
    template: '{input}'
  };

  const edges = familyNodes.map((node, index) => ({
    id: `edge-${index + 1}`,
    source: node.id,
    target: concatNode.id,
    targetHandle: `input${index + 1}`
  }));

  edges.push({
    id: `edge-${edges.length + 1}`,
    source: concatNode.id,
    target: outputNode.id
  });

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Prompt Synthesis`,
    description: 'Metagrinder prompt synthesis fragment generated from classified research concepts.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'prompt-synthesis',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: [...familyNodes, concatNode, outputNode],
    edges
  };
}

function buildPromptMutationsPsg({ ingestArtifact, mutationArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const variantNodes = mutationArtifact.variants.map((variant, index) => ({
    id: variant.variantId,
    type: 'TextBlock',
    name: `Mutation Variant ${index + 1}`,
    description: `Distinctiveness ${variant.distinctivenessScore}`,
    x: 160,
    y: 120 + (index * 160),
    value: variant.text,
    data: {
      fragmentIds: variant.fragmentIds,
      families: variant.families,
      compatibilityDecisionIds: variant.compatibilityDecisionIds,
      conceptIds: variant.conceptIds,
      sourceInputIds: variant.sourceInputIds,
      sourceChunkIds: variant.sourceChunkIds,
      distinctivenessScore: variant.distinctivenessScore
    }
  }));

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Prompt Mutations`,
    description: 'Metagrinder prompt-mutation variants generated from compatible prompt fragments.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'prompt-mutations',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: variantNodes,
    edges: [],
    regions: [
      {
        id: `${ingestArtifact.inputId}_prompt_mutations_region`,
        name: 'Prompt Mutations',
        nodes: variantNodes.map((node) => node.id)
      }
    ]
  };
}

function buildResearchPackageManifest({ ingestArtifact, scoreArtifact, mutationArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const collections = [
    { id: 'col_source', type: 'source-map', path: 'source-map.psg' },
    { id: 'col_concepts', type: 'concept-clusters', path: 'concept-clusters.psg' },
    { id: 'col_synthesis', type: 'prompt-synthesis', path: 'prompt-synthesis.psg' },
    {
      id: 'col_mutations',
      type: 'prompt-mutations',
      path: 'prompt-mutations.psg'
    }
  ];
  const hasMutationSupport = Boolean(mutationArtifact);
  const strategyVersion = hasMutationSupport
    ? 'epic3-story4'
    : ingestArtifact.sourceInputs.length > 1
      ? 'epic2-story6'
      : 'epic1-story5';

  return ResearchPackageManifestSchema.parse({
    packageId: `${ingestArtifact.inputId}_research_package`,
    packageType: 'research-package',
    title: ingestArtifact.title,
    createdAt: ingestArtifact.createdAt,
    parserVersion: '0.1.0',
    strategyVersion,
    contributorId: 'local-metagrinder-mvp',
    sourceInputs: sourceInputIds,
    sourceInputIds,
    collections,
    lineage: {
      sourceInputIds
    },
    confidenceSummary: scoreArtifact.confidenceSummary,
    reviewStatus: 'draft'
  });
}

function validatePsgFile(psgFile, fileLabel) {
  if (!psgFile || typeof psgFile !== 'object') {
    throw new Error(`${fileLabel} must be an object.`);
  }
  if (typeof psgFile.version !== 'string' || psgFile.version.length === 0) {
    throw new Error(`${fileLabel} is missing a string version.`);
  }
  if (typeof psgFile.name !== 'string' || psgFile.name.length === 0) {
    throw new Error(`${fileLabel} is missing a name.`);
  }
  if (!Array.isArray(psgFile.nodes) || !Array.isArray(psgFile.edges)) {
    throw new Error(`${fileLabel} must contain nodes and edges arrays.`);
  }
  psgFile.nodes.forEach((node, index) => {
    if (typeof node.id !== 'string' || typeof node.type !== 'string') {
      throw new Error(`${fileLabel} node ${index} is missing id or type.`);
    }
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      throw new Error(`${fileLabel} node ${node.id} is missing coordinates.`);
    }
  });
  psgFile.edges.forEach((edge, index) => {
    if (
      typeof edge.id !== 'string' ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      throw new Error(`${fileLabel} edge ${index} is missing required fields.`);
    }
  });
}

function validatePackageArtifacts({
  augmentationPlanArtifact,
  assumptionReviewArtifact,
  categoryHypothesisArtifact,
  modeDetectionArtifact,
  ingestArtifact,
  extractArtifact,
  classifyArtifact,
  synthesizeArtifact,
  mutationArtifact,
  mutationReviewArtifact,
  scoreArtifact,
  reviewArtifact,
  sourceMapPsg,
  conceptClustersPsg,
  promptSynthesisPsg,
  promptMutationsPsg,
  researchPackageManifest
}) {
  MetagrinderAugmentationPlanArtifactSchema.parse(augmentationPlanArtifact);
  MetagrinderAssumptionReviewArtifactSchema.parse(assumptionReviewArtifact);
  MetagrinderCategoryHypothesisArtifactSchema.parse(categoryHypothesisArtifact);
  MetagrinderModeDetectionArtifactSchema.parse(modeDetectionArtifact);
  MetagrinderIngestArtifactSchema.parse(ingestArtifact);
  MetagrinderExtractArtifactSchema.parse(extractArtifact);
  MetagrinderClassifyArtifactSchema.parse(classifyArtifact);
  MetagrinderSynthesizeArtifactSchema.parse(synthesizeArtifact);
  if (mutationArtifact) {
    MetagrinderMutationArtifactSchema.parse(mutationArtifact);
  }
  if (mutationReviewArtifact) {
    MetagrinderMutationReviewArtifactSchema.parse(mutationReviewArtifact);
  }
  MetagrinderScoreArtifactSchema.parse(scoreArtifact);
  MetagrinderReviewArtifactSchema.parse(reviewArtifact);
  ResearchPackageManifestSchema.parse(researchPackageManifest);
  validatePsgFile(sourceMapPsg, 'source-map.psg');
  validatePsgFile(conceptClustersPsg, 'concept-clusters.psg');
  validatePsgFile(promptSynthesisPsg, 'prompt-synthesis.psg');
  if (promptMutationsPsg) {
    validatePsgFile(promptMutationsPsg, 'prompt-mutations.psg');
  }
}

module.exports = {
  buildConceptClustersPsg,
  buildPromptMutationsPsg,
  buildPromptSynthesisPsg,
  buildResearchPackageManifest,
  buildSourceMapPsg,
  validatePackageArtifacts
};

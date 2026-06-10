const {
  MetagrinderAcceptedGrammarDeltasArtifactSchema,
  MetagrinderAgentRunArtifactSchema,
  MetagrinderAssumptionReviewArtifactSchema,
  MetagrinderAugmentationPlanArtifactSchema,
  MetagrinderBriefAnalysisArtifactSchema,
  MetagrinderSemanticChoiceGraphArtifactSchema,
  MetagrinderCategoryHypothesisArtifactSchema,
  MetagrinderClassifyArtifactSchema,
  MetagrinderCodexParseOutputSchemaArtifactSchema,
  MetagrinderCodexParseRequestArtifactSchema,
  MetagrinderCodexParseResultArtifactSchema,
  MetagrinderExtractArtifactSchema,
  MetagrinderColorHypothesisArtifactSchema,
  MetagrinderGrammarRevisionArtifactSchema,
  MetagrinderHistoricalPhotoObservationArtifactSchema,
  MetagrinderIngestArtifactSchema,
  MetagrinderModeDetectionArtifactSchema,
  MetagrinderMutationArtifactSchema,
  MetagrinderMutationReviewArtifactSchema,
  MetagrinderPlausibilityReviewArtifactSchema,
  MetagrinderPsgCompileDiffArtifactSchema,
  MetagrinderPsgV2FileSchema,
  MetagrinderResearchGapArtifactSchema,
  MetagrinderResearchQueryPlanSchema,
  MetagrinderRetrievalPolicySchema,
  MetagrinderRetrievalRunLogSchema,
  MetagrinderRetrievalCandidatesArtifactSchema,
  MetagrinderLiveProviderContractSchema,
  MetagrinderProviderConfigAppliedSchema,
  MetagrinderProviderPreflightReportSchema,
  MetagrinderProviderRequestShapesSchema,
  MetagrinderProviderResponseLogSchema,
  MetagrinderLiveProviderPilotReportSchema,
  MetagrinderRealEndpointProofReportSchema,
  MetagrinderCandidateInspectionArtifactSchema,
  MetagrinderSourceTypingReportSchema,
  MetagrinderProviderErrorReportSchema,
  MetagrinderLiveRetrievalPreflightSchema,
  MetagrinderLiveRetrievalRequestsSchema,
  MetagrinderLiveRetrievalCacheWriteSchema,
  MetagrinderRetrievalCacheManifestSchema,
  MetagrinderSourceIntakeApprovalSchema,
  MetagrinderApprovedSourceResultsSchema,
  MetagrinderRetrievalSafetyReportSchema,
  MetagrinderRevisionReviewArtifactSchema,
  MetagrinderRevisionStateAppliedSchema,
  MetagrinderRevisionStateFileSchema,
  MetagrinderReviewArtifactSchema,
  MetagrinderSamplePromptsArtifactSchema,
  MetagrinderScoreArtifactSchema,
  MetagrinderStructuredBriefArtifactSchema,
  MetagrinderSceneGrammarArtifactSchema,
  MetagrinderSceneGrammarEvaluationSchema,
  MetagrinderSourceClaimsArtifactSchema,
  MetagrinderSourceEvidenceArtifactSchema,
  MetagrinderSourceClaimReviewArtifactSchema,
  MetagrinderSourceRegistryArtifactSchema,
  MetagrinderSynthesizeArtifactSchema,
  MetagrinderLiveRetrievalReadinessArtifactSchema,
  MetagrinderWebResearchResultsSchema,
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

function buildResearchPackageManifest({
  ingestArtifact,
  scoreArtifact,
  mutationArtifact,
  structuredBriefSeedArtifact,
  structuredBriefArtifact,
  briefAnalysisArtifact,
  semanticChoiceGraphArtifact,
  codexParseRequestArtifact,
  codexParseOutputSchemaArtifact,
  codexParseResultArtifact,
  sceneGrammarArtifact,
  historicalPhotoObservationArtifact,
  colorHypothesisArtifact,
  researchGapArtifact,
  samplePromptsArtifact,
  sceneGrammarEvaluation,
  plausibilityReviewArtifact,
  sceneGrammarPsg,
  grammarRevisionArtifact,
  acceptedGrammarRevisionArtifact,
  rejectedGrammarRevisionArtifact,
  revisionStateArtifact,
  revisionStateAppliedArtifact,
  revisionReviewArtifact,
  acceptedGrammarDeltasArtifact,
  operatorReviewArtifact,
  psgCompileDiffArtifact,
  liveRetrievalReadinessArtifact,
  liveProviderContractArtifact,
  providerConfigAppliedArtifact,
  providerPreflightReportArtifact,
  providerRequestShapesArtifact,
  providerResponseLogArtifact,
  liveProviderPilotReportArtifact,
  realEndpointProofReportArtifact,
  candidateInspectionArtifact,
  sourceTypingReportArtifact,
  providerErrorReportArtifact,
  liveRetrievalPreflightArtifact,
  liveRetrievalRequestsArtifact,
  liveRetrievalCacheWriteArtifact,
  sourceRegistryArtifact,
  sourceClaimsArtifact,
  sourceEvidenceArtifact,
  sourceClaimReviewArtifact,
  retrievalPolicyArtifact,
  retrievalRunLogArtifact,
  retrievalCandidatesArtifact,
  retrievalCacheManifestArtifact,
  sourceIntakeApprovalArtifact,
  approvedSourceResultsArtifact,
  retrievalSafetyReportArtifact,
  acceptedSceneGrammarArtifact,
  branchGraphPsgs
}) {
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
  if (structuredBriefSeedArtifact) {
    collections.push({ id: 'col_structured_brief_seed', type: 'structured-brief-seed', path: 'structured-brief.seed.json' });
  }
  if (structuredBriefArtifact) {
    collections.push({ id: 'col_structured_brief', type: 'structured-brief', path: 'structured-brief.json' });
  }
  if (briefAnalysisArtifact) {
    collections.push({ id: 'col_brief_analysis', type: 'brief-analysis', path: 'brief-analysis.json' });
  }
  if (semanticChoiceGraphArtifact) {
    collections.push({ id: 'col_semantic_choice_graph', type: 'semantic-choice-graph', path: 'semantic-choice-graph.json' });
  }
  if (codexParseRequestArtifact) {
    collections.push({ id: 'col_codex_parse_request', type: 'codex-parse-request', path: 'codex-parse-request.json' });
    collections.push({ id: 'col_codex_parse_request_md', type: 'codex-parse-request-markdown', path: 'codex-parse-request.md' });
  }
  if (codexParseOutputSchemaArtifact) {
    collections.push({ id: 'col_codex_parse_output_schema', type: 'codex-parse-output-schema', path: 'codex-parse-output.schema.json' });
  }
  if (codexParseResultArtifact) {
    collections.push({ id: 'col_codex_parse_result', type: 'codex-parse-result', path: 'codex-parse-result.json' });
  }
  if (sceneGrammarArtifact) {
    collections.push({ id: 'col_scene_grammar', type: 'scene-grammar', path: 'scene-grammar.json' });
  }
  if (historicalPhotoObservationArtifact) {
    collections.push({ id: 'col_photo_observations', type: 'photo-observations', path: 'photo-observations.json' });
  }
  if (colorHypothesisArtifact) {
    collections.push({ id: 'col_color_hypotheses', type: 'color-hypotheses', path: 'color-hypotheses.json' });
  }
  if (researchGapArtifact) {
    collections.push({ id: 'col_research_gaps', type: 'research-gaps', path: 'research-gaps.json' });
  }
  if (samplePromptsArtifact) {
    collections.push({ id: 'col_sample_prompts', type: 'sample-prompts', path: 'sample-prompts.json' });
  }
  if (sceneGrammarEvaluation) {
    collections.push({ id: 'col_scene_grammar_evaluation', type: 'scene-grammar-evaluation', path: 'scene-grammar-evaluation.json' });
  }
  if (plausibilityReviewArtifact) {
    collections.push({ id: 'col_plausibility_review', type: 'plausibility-review', path: 'plausibility-review.json' });
  }
  if (grammarRevisionArtifact) {
    collections.push({ id: 'col_grammar_revisions', type: 'grammar-revisions', path: 'grammar-revisions.json' });
  }
  if (acceptedGrammarRevisionArtifact) {
    collections.push({ id: 'col_accepted_grammar_revisions', type: 'accepted-grammar-revisions', path: 'accepted-grammar-revisions.json' });
  }
  if (rejectedGrammarRevisionArtifact) {
    collections.push({ id: 'col_rejected_grammar_revisions', type: 'rejected-grammar-revisions', path: 'rejected-grammar-revisions.json' });
  }
  if (sourceRegistryArtifact) {
    collections.push({ id: 'col_source_registry', type: 'source-registry', path: 'source-registry.json' });
  }
  if (sourceClaimsArtifact) {
    collections.push({ id: 'col_source_claims', type: 'source-claims', path: 'source-claims.json' });
  }
  if (sourceEvidenceArtifact) {
    collections.push({ id: 'col_source_evidence', type: 'source-evidence', path: 'source-evidence.json' });
  }
  if (sourceClaimReviewArtifact) {
    collections.push({ id: 'col_source_claim_review', type: 'source-claim-review', path: 'source-claim-review.json' });
  }
  if (retrievalPolicyArtifact) {
    collections.push({ id: 'col_retrieval_policy', type: 'retrieval-policy', path: 'retrieval-policy.json' });
  }
  if (retrievalRunLogArtifact) {
    collections.push({ id: 'col_retrieval_run_log', type: 'retrieval-run-log', path: 'retrieval-run-log.json' });
  }
  if (retrievalCandidatesArtifact) {
    collections.push({ id: 'col_retrieval_candidates', type: 'retrieval-candidates', path: 'retrieval-candidates.json' });
  }
  if (retrievalCacheManifestArtifact) {
    collections.push({ id: 'col_retrieval_cache_manifest', type: 'retrieval-cache-manifest', path: 'retrieval-cache-manifest.json' });
  }
  if (sourceIntakeApprovalArtifact) {
    collections.push({ id: 'col_source_intake_approval', type: 'source-intake-approval', path: 'source-intake-approval.json' });
  }
  if (approvedSourceResultsArtifact) {
    collections.push({ id: 'col_approved_source_results', type: 'approved-source-results', path: 'approved-source-results.json' });
  }
  if (retrievalSafetyReportArtifact) {
    collections.push({ id: 'col_retrieval_safety_report', type: 'retrieval-safety-report', path: 'retrieval-safety-report.json' });
  }
  if (revisionStateArtifact) {
    collections.push({ id: 'col_revision_state', type: 'revision-state', path: 'revision-state.json' });
  }
  if (revisionStateAppliedArtifact) {
    collections.push({ id: 'col_revision_state_applied', type: 'revision-state-applied', path: 'revision-state.applied.json' });
  }
  if (revisionReviewArtifact) {
    collections.push({ id: 'col_revision_review', type: 'revision-review', path: 'revision-review.json' });
  }
  if (acceptedGrammarDeltasArtifact) {
    collections.push({ id: 'col_accepted_grammar_deltas', type: 'accepted-grammar-deltas', path: 'accepted-grammar-deltas.json' });
  }
  if (operatorReviewArtifact) {
    collections.push({ id: 'col_operator_review', type: 'operator-review', path: 'operator-review.md' });
  }
  if (psgCompileDiffArtifact) {
    collections.push({ id: 'col_psg_compile_diff', type: 'psg-compile-diff', path: 'psg-compile-diff.json' });
  }
  if (liveRetrievalReadinessArtifact) {
    collections.push({ id: 'col_live_retrieval_readiness', type: 'live-retrieval-readiness', path: 'live-retrieval-readiness.json' });
  }
  if (liveProviderContractArtifact) {
    collections.push({ id: 'col_live_provider_contract', type: 'live-provider-contract', path: 'live-provider-contract.json' });
  }
  if (providerConfigAppliedArtifact) {
    collections.push({ id: 'col_provider_config_applied', type: 'provider-config-applied', path: 'provider-config.applied.json' });
  }
  if (providerPreflightReportArtifact) {
    collections.push({ id: 'col_provider_preflight_report', type: 'provider-preflight-report', path: 'provider-preflight-report.json' });
  }
  if (providerRequestShapesArtifact) {
    collections.push({ id: 'col_provider_request_shapes', type: 'provider-request-shapes', path: 'provider-request-shapes.json' });
  }
  if (providerResponseLogArtifact) {
    collections.push({ id: 'col_provider_response_log', type: 'provider-response-log', path: 'provider-response-log.json' });
  }
  if (liveProviderPilotReportArtifact) {
    collections.push({ id: 'col_live_provider_pilot_report', type: 'live-provider-pilot-report', path: 'live-provider-pilot-report.json' });
  }
  if (realEndpointProofReportArtifact) {
    collections.push({ id: 'col_real_endpoint_proof_report', type: 'real-endpoint-proof-report', path: 'real-endpoint-proof-report.json' });
  }
  if (candidateInspectionArtifact) {
    collections.push({ id: 'col_candidate_inspection', type: 'candidate-inspection', path: 'candidate-inspection.json' });
    collections.push({ id: 'col_candidate_inspection_md', type: 'candidate-inspection-markdown', path: 'candidate-inspection.md' });
  }
  if (sourceTypingReportArtifact) {
    collections.push({ id: 'col_source_typing_report', type: 'source-typing-report', path: 'source-typing-report.json' });
  }
  if (providerErrorReportArtifact) {
    collections.push({ id: 'col_provider_error_report', type: 'provider-error-report', path: 'provider-error-report.json' });
  }
  if (liveRetrievalPreflightArtifact) {
    collections.push({ id: 'col_live_retrieval_preflight', type: 'live-retrieval-preflight', path: 'live-retrieval-preflight.json' });
  }
  if (liveRetrievalRequestsArtifact) {
    collections.push({ id: 'col_live_retrieval_requests', type: 'live-retrieval-requests', path: 'live-retrieval-requests.json' });
  }
  if (liveRetrievalCacheWriteArtifact) {
    collections.push({ id: 'col_live_retrieval_cache_write', type: 'live-retrieval-cache-write', path: 'live-retrieval-cache-write.json' });
  }
  if (acceptedSceneGrammarArtifact) {
    collections.push({ id: 'col_accepted_scene_grammar', type: 'accepted-scene-grammar', path: 'accepted-scene-grammar.json' });
  }
  if (sceneGrammarPsg) {
    collections.push({ id: 'col_scene_grammar_psg', type: 'scene-grammar-psg', path: 'scene-grammar.psg' });
  }
  Object.keys(branchGraphPsgs || {}).forEach((fileName, index) => {
    collections.push({
      id: `col_branch_graph_${String(index + 1).padStart(2, '0')}`,
      type: 'branch-graph',
      path: `branch-graphs/${fileName}`
    });
  });
  const hasMutationSupport = Boolean(mutationArtifact);
  const hasSceneGrammarSupport = Boolean(sceneGrammarArtifact);
  const strategyVersion = hasSceneGrammarSupport
    ? 'scene-grammar-checkpoint'
    : hasMutationSupport
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
  agentRunsArtifact,
  ingestArtifact,
  extractArtifact,
  classifyArtifact,
  synthesizeArtifact,
  sourceModeArtifact,
  structuredBriefSeedArtifact,
  structuredBriefArtifact,
  briefAnalysisArtifact,
  semanticChoiceGraphArtifact,
  codexParseRequestArtifact,
  codexParseOutputSchemaArtifact,
  codexParseResultArtifact,
  sceneGrammarArtifact,
  researchGapArtifact,
  researchQueryPlan,
  webResearchResults,
  sourceRegistryArtifact,
  sourceClaimsArtifact,
  sourceEvidenceArtifact,
  sourceClaimReviewArtifact,
  retrievalPolicyArtifact,
  retrievalRunLogArtifact,
  retrievalCandidatesArtifact,
  retrievalCacheManifestArtifact,
  sourceIntakeApprovalArtifact,
  approvedSourceResultsArtifact,
  retrievalSafetyReportArtifact,
  grammarRevisionArtifact,
  acceptedGrammarRevisionArtifact,
  rejectedGrammarRevisionArtifact,
  revisionStateArtifact,
  revisionStateAppliedArtifact,
  revisionReviewArtifact,
  acceptedGrammarDeltasArtifact,
  psgCompileDiffArtifact,
  liveRetrievalReadinessArtifact,
  liveProviderContractArtifact,
  providerConfigAppliedArtifact,
  providerPreflightReportArtifact,
  providerRequestShapesArtifact,
  providerResponseLogArtifact,
  liveProviderPilotReportArtifact,
  realEndpointProofReportArtifact,
  candidateInspectionArtifact,
  sourceTypingReportArtifact,
  providerErrorReportArtifact,
  liveRetrievalPreflightArtifact,
  liveRetrievalRequestsArtifact,
  liveRetrievalCacheWriteArtifact,
  acceptedSceneGrammarArtifact,
  historicalPhotoObservationArtifact,
  colorHypothesisArtifact,
  samplePromptsArtifact,
  sceneGrammarEvaluation,
  plausibilityReviewArtifact,
  mutationArtifact,
  mutationReviewArtifact,
  scoreArtifact,
  reviewArtifact,
  sourceMapPsg,
  conceptClustersPsg,
  promptSynthesisPsg,
  promptMutationsPsg,
  sceneGrammarPsg,
  branchGraphPsgs,
  researchPackageManifest
}) {
  MetagrinderAugmentationPlanArtifactSchema.parse(augmentationPlanArtifact);
  MetagrinderAssumptionReviewArtifactSchema.parse(assumptionReviewArtifact);
  MetagrinderCategoryHypothesisArtifactSchema.parse(categoryHypothesisArtifact);
  MetagrinderModeDetectionArtifactSchema.parse(modeDetectionArtifact);
  if (agentRunsArtifact) {
    MetagrinderAgentRunArtifactSchema.parse(agentRunsArtifact);
  }
  MetagrinderIngestArtifactSchema.parse(ingestArtifact);
  MetagrinderExtractArtifactSchema.parse(extractArtifact);
  MetagrinderClassifyArtifactSchema.parse(classifyArtifact);
  MetagrinderSynthesizeArtifactSchema.parse(synthesizeArtifact);
  if (sourceModeArtifact) {
    if (!sourceModeArtifact.inputId || !Array.isArray(sourceModeArtifact.chunkModes)) {
      throw new Error('source-mode artifact must contain inputId and chunkModes.');
    }
  }
  if (structuredBriefSeedArtifact) {
    MetagrinderStructuredBriefArtifactSchema.parse(structuredBriefSeedArtifact);
  }
  if (structuredBriefArtifact) {
    MetagrinderStructuredBriefArtifactSchema.parse(structuredBriefArtifact);
  }
  if (briefAnalysisArtifact) {
    MetagrinderBriefAnalysisArtifactSchema.parse(briefAnalysisArtifact);
  }
  if (semanticChoiceGraphArtifact) {
    MetagrinderSemanticChoiceGraphArtifactSchema.parse(semanticChoiceGraphArtifact);
  }
  if (codexParseRequestArtifact) {
    MetagrinderCodexParseRequestArtifactSchema.parse(codexParseRequestArtifact);
  }
  if (codexParseOutputSchemaArtifact) {
    MetagrinderCodexParseOutputSchemaArtifactSchema.parse(codexParseOutputSchemaArtifact);
  }
  if (codexParseResultArtifact) {
    MetagrinderCodexParseResultArtifactSchema.parse(codexParseResultArtifact);
  }
  if (sceneGrammarArtifact) {
    MetagrinderSceneGrammarArtifactSchema.parse(sceneGrammarArtifact);
  }
  if (historicalPhotoObservationArtifact) {
    MetagrinderHistoricalPhotoObservationArtifactSchema.parse(historicalPhotoObservationArtifact);
  }
  if (colorHypothesisArtifact) {
    MetagrinderColorHypothesisArtifactSchema.parse(colorHypothesisArtifact);
  }
  if (researchGapArtifact) {
    MetagrinderResearchGapArtifactSchema.parse(researchGapArtifact);
  }
  if (researchQueryPlan) {
    MetagrinderResearchQueryPlanSchema.parse(researchQueryPlan);
  }
  if (webResearchResults) {
    MetagrinderWebResearchResultsSchema.parse(webResearchResults);
  }
  if (sourceRegistryArtifact) {
    MetagrinderSourceRegistryArtifactSchema.parse(sourceRegistryArtifact);
  }
  if (sourceClaimsArtifact) {
    MetagrinderSourceClaimsArtifactSchema.parse(sourceClaimsArtifact);
  }
  if (sourceEvidenceArtifact) {
    MetagrinderSourceEvidenceArtifactSchema.parse(sourceEvidenceArtifact);
  }
  if (sourceClaimReviewArtifact) {
    MetagrinderSourceClaimReviewArtifactSchema.parse(sourceClaimReviewArtifact);
  }
  if (retrievalPolicyArtifact) {
    MetagrinderRetrievalPolicySchema.parse(retrievalPolicyArtifact);
  }
  if (retrievalRunLogArtifact) {
    MetagrinderRetrievalRunLogSchema.parse(retrievalRunLogArtifact);
  }
  if (retrievalCandidatesArtifact) {
    MetagrinderRetrievalCandidatesArtifactSchema.parse(retrievalCandidatesArtifact);
  }
  if (retrievalCacheManifestArtifact) {
    MetagrinderRetrievalCacheManifestSchema.parse(retrievalCacheManifestArtifact);
  }
  if (sourceIntakeApprovalArtifact) {
    MetagrinderSourceIntakeApprovalSchema.parse(sourceIntakeApprovalArtifact);
  }
  if (approvedSourceResultsArtifact) {
    MetagrinderApprovedSourceResultsSchema.parse(approvedSourceResultsArtifact);
  }
  if (retrievalSafetyReportArtifact) {
    MetagrinderRetrievalSafetyReportSchema.parse(retrievalSafetyReportArtifact);
  }
  if (grammarRevisionArtifact) {
    MetagrinderGrammarRevisionArtifactSchema.parse(grammarRevisionArtifact);
  }
  if (acceptedGrammarRevisionArtifact) {
    MetagrinderGrammarRevisionArtifactSchema.parse(acceptedGrammarRevisionArtifact);
  }
  if (rejectedGrammarRevisionArtifact) {
    MetagrinderGrammarRevisionArtifactSchema.parse(rejectedGrammarRevisionArtifact);
  }
  if (revisionStateArtifact) {
    MetagrinderRevisionStateFileSchema.parse(revisionStateArtifact);
  }
  if (revisionStateAppliedArtifact) {
    MetagrinderRevisionStateAppliedSchema.parse(revisionStateAppliedArtifact);
  }
  if (revisionReviewArtifact) {
    MetagrinderRevisionReviewArtifactSchema.parse(revisionReviewArtifact);
  }
  if (acceptedGrammarDeltasArtifact) {
    MetagrinderAcceptedGrammarDeltasArtifactSchema.parse(acceptedGrammarDeltasArtifact);
  }
  if (psgCompileDiffArtifact) {
    MetagrinderPsgCompileDiffArtifactSchema.parse(psgCompileDiffArtifact);
  }
  if (liveRetrievalReadinessArtifact) {
    MetagrinderLiveRetrievalReadinessArtifactSchema.parse(liveRetrievalReadinessArtifact);
  }
  if (liveProviderContractArtifact) {
    MetagrinderLiveProviderContractSchema.parse(liveProviderContractArtifact);
  }
  if (providerConfigAppliedArtifact) {
    MetagrinderProviderConfigAppliedSchema.parse(providerConfigAppliedArtifact);
  }
  if (providerPreflightReportArtifact) {
    MetagrinderProviderPreflightReportSchema.parse(providerPreflightReportArtifact);
  }
  if (providerRequestShapesArtifact) {
    MetagrinderProviderRequestShapesSchema.parse(providerRequestShapesArtifact);
  }
  if (providerResponseLogArtifact) {
    MetagrinderProviderResponseLogSchema.parse(providerResponseLogArtifact);
  }
  if (liveProviderPilotReportArtifact) {
    MetagrinderLiveProviderPilotReportSchema.parse(liveProviderPilotReportArtifact);
  }
  if (realEndpointProofReportArtifact) {
    MetagrinderRealEndpointProofReportSchema.parse(realEndpointProofReportArtifact);
  }
  if (candidateInspectionArtifact) {
    MetagrinderCandidateInspectionArtifactSchema.parse(candidateInspectionArtifact);
  }
  if (sourceTypingReportArtifact) {
    MetagrinderSourceTypingReportSchema.parse(sourceTypingReportArtifact);
  }
  if (providerErrorReportArtifact) {
    MetagrinderProviderErrorReportSchema.parse(providerErrorReportArtifact);
  }
  if (liveRetrievalPreflightArtifact) {
    MetagrinderLiveRetrievalPreflightSchema.parse(liveRetrievalPreflightArtifact);
  }
  if (liveRetrievalRequestsArtifact) {
    MetagrinderLiveRetrievalRequestsSchema.parse(liveRetrievalRequestsArtifact);
  }
  if (liveRetrievalCacheWriteArtifact) {
    MetagrinderLiveRetrievalCacheWriteSchema.parse(liveRetrievalCacheWriteArtifact);
  }
  if (acceptedSceneGrammarArtifact) {
    MetagrinderSceneGrammarArtifactSchema.parse(acceptedSceneGrammarArtifact);
  }
  if (samplePromptsArtifact) {
    MetagrinderSamplePromptsArtifactSchema.parse(samplePromptsArtifact);
  }
  if (sceneGrammarEvaluation) {
    MetagrinderSceneGrammarEvaluationSchema.parse(sceneGrammarEvaluation);
  }
  if (plausibilityReviewArtifact) {
    MetagrinderPlausibilityReviewArtifactSchema.parse(plausibilityReviewArtifact);
  }
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
  if (sceneGrammarPsg) {
    validatePsgV2File(sceneGrammarPsg, 'scene-grammar.psg');
  }
  Object.entries(branchGraphPsgs || {}).forEach(([fileName, graph]) => {
    validatePsgV2File(graph, `branch-graphs/${fileName}`);
  });
}

function validatePsgV2File(psgFile, fileLabel) {
  const parsed = MetagrinderPsgV2FileSchema.parse(psgFile);
  const nodeIds = new Set();

  parsed.nodes.forEach((node) => {
    if (nodeIds.has(node.id)) {
      throw new Error(`${fileLabel} contains duplicate node id ${node.id}.`);
    }
    if (node.type === 'WeightedChoice') {
      if (!Array.isArray(node.options)) {
        throw new Error(`${fileLabel} WeightedChoice node ${node.id} is missing options.`);
      }
      node.options.forEach((choice, index) => {
        if (typeof choice.text !== 'string' || typeof choice.weight !== 'number') {
          throw new Error(`${fileLabel} WeightedChoice node ${node.id} choice ${index} must include text and weight.`);
        }
      });
    }
    nodeIds.add(node.id);
  });

  parsed.edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`${fileLabel} edge ${edge.id} references a missing endpoint.`);
    }
  });
}

module.exports = {
  buildConceptClustersPsg,
  buildPromptMutationsPsg,
  buildPromptSynthesisPsg,
  buildResearchPackageManifest,
  buildSourceMapPsg,
  validatePackageArtifacts,
  validatePsgV2File
};

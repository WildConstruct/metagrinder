const { z } = require('zod');

const MetagrinderReviewStatusSchema = z.enum([
  'draft',
  'private',
  'team',
  'staged',
  'needs_review',
  'approved',
  'merged',
  'rejected',
  'restricted'
]);

const MetagrinderConfidenceLevelSchema = z.enum(['low', 'medium', 'high']);

const MetagrinderRightsProfileSchema = z.enum([
  'unrestricted',
  'attribution-required',
  'non-commercial',
  'reference-only',
  'restricted'
]);

const MetagrinderCollectionTypeSchema = z.enum([
  'source-map',
  'claims-and-evidence',
  'concept-clusters',
  'prompt-synthesis',
  'prompt-mutations',
  'scene-grammar',
  'research-gaps',
  'sample-prompts',
  'scene-grammar-evaluation',
  'plausibility-review',
  'scene-grammar-psg',
  'grammar-revisions',
  'branch-graph'
]);

const MetagrinderEntityTypeSchema = z.enum([
  'Concept',
  'Archetype',
  'SourceRecordReference',
  'EvidenceAssertion',
  'CompatibilityRule',
  'SurfaceResponseProfile',
  'EnvironmentalEffectController',
  'InfluenceField',
  'LocalizedMaterialIntent',
  'LocalizedEnvironmentalIntent',
  'SemanticPoint',
  'SemanticSplat',
  'SemanticRegion',
  'SemanticVolume'
]);

const MetagrinderExternalIdsSchema = z.object({
  gettyAatId: z.string().nullable().optional(),
  wikidataQid: z.string().nullable().optional(),
  institutionRecordId: z.string().nullable().optional(),
  europeanaRecordId: z.string().nullable().optional()
});

const MetagrinderConfidenceSummarySchema = z.object({
  overall: MetagrinderConfidenceLevelSchema,
  extraction: MetagrinderConfidenceLevelSchema.optional(),
  normalization: MetagrinderConfidenceLevelSchema.optional(),
  provenance: MetagrinderConfidenceLevelSchema.optional(),
  rights: MetagrinderConfidenceLevelSchema.optional()
});

const MetagrinderLineageSchema = z.object({
  sourceInputIds: z.array(z.string()).default([]),
  derivedFromPackageId: z.string().optional()
});

const MetagrinderCollectionManifestSchema = z.object({
  id: z.string(),
  type: MetagrinderCollectionTypeSchema,
  path: z.string()
});

const MetagrinderSourceTypeSchema = z.enum([
  'plain-text',
  'notes-bundle',
  'research-brief'
]);

const MetagrinderResearchKindSchema = z.enum([
  'historical-scene-research',
  'character-framework',
  'material-reference',
  'environment-observation',
  'style-analysis',
  'procedural-guide',
  'mixed',
  'unknown'
]);

const MetagrinderChunkKindSchema = z.enum([
  'source-note',
  'observation',
  'concept-list',
  'generation-rule',
  'template',
  'uncertainty',
  'reference-table',
  'visual-reference-caption',
  'negative-constraint',
  'ethical-constraint',
  'sample-output',
  'unknown'
]);

const MetagrinderAttributionModeSchema = z.enum([
  'quoted',
  'paraphrased',
  'inferred',
  'web-retrieved'
]);

const MetagrinderIngestChunkSchema = z.object({
  chunkId: z.string(),
  sourceInputId: z.string(),
  text: z.string().min(1),
  sectionLabel: z.string().optional(),
  chunkKind: MetagrinderChunkKindSchema.default('unknown'),
  sequence: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([])
});

const MetagrinderSourceInputSchema = z.object({
  sourceInputId: z.string(),
  title: z.string(),
  sourceType: MetagrinderSourceTypeSchema.default('plain-text'),
  path: z.string().optional(),
  sequence: z.number().int().nonnegative()
});

const MetagrinderIngestArtifactSchema = z.object({
  inputId: z.string(),
  title: z.string(),
  sourceType: MetagrinderSourceTypeSchema.default('plain-text'),
  researchKind: MetagrinderResearchKindSchema.default('unknown'),
  createdAt: z.string().datetime().optional(),
  sourceInputs: z.array(MetagrinderSourceInputSchema).min(1).default([]),
  chunks: z.array(MetagrinderIngestChunkSchema).min(1)
});

const MetagrinderModeDetectionArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  confidence: MetagrinderConfidenceLevelSchema,
  reasons: z.array(z.string()).default([]),
  suggestedCategories: z.array(z.string()).default([]),
  candidateKinds: z.array(z.object({
    researchKind: MetagrinderResearchKindSchema,
    score: z.number().int().nonnegative()
  })).default([])
});

const MetagrinderCategoryPrioritySchema = z.enum([
  'primary',
  'secondary',
  'optional'
]);

const MetagrinderCategoryHypothesisEntrySchema = z.object({
  categoryId: z.string(),
  label: z.string(),
  priority: MetagrinderCategoryPrioritySchema,
  rationale: z.string()
});

const MetagrinderCategoryHypothesisArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  categories: z.array(MetagrinderCategoryHypothesisEntrySchema).default([]),
  recommendedFocus: z.array(z.string()).default([])
});

const MetagrinderReviewDecisionOptionSchema = z.enum([
  'proceed-as-is',
  'adjust-priorities',
  'request-augmentation'
]);

const MetagrinderAssumptionReviewArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  detectedChunkKinds: z.array(MetagrinderChunkKindSchema).default([]),
  recommendedFocus: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  decisionOptions: z.array(MetagrinderReviewDecisionOptionSchema).default([])
});

const MetagrinderAugmentationPlanArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  verificationTargets: z.array(z.string()).default([]),
  missingSourceTypes: z.array(z.string()).default([]),
  followUpResearchDirections: z.array(z.string()).default([]),
  rationale: z.array(z.string()).default([])
});

const MetagrinderExtractedClaimSchema = z.object({
  claimId: z.string(),
  text: z.string(),
  claimType: z.string().optional(),
  category: z.enum([
    'wardrobe',
    'people-and-crowd',
    'weather-and-environment',
    'lighting',
    'materials-and-surfaces',
    'behavior-and-motion',
    'architecture-and-streetscape',
    'mood-and-social-tone'
  ]),
  confidence: MetagrinderConfidenceLevelSchema,
  sourceInputIds: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()).min(1),
  attributionMode: MetagrinderAttributionModeSchema
});

const MetagrinderConceptCandidateSchema = z.object({
  conceptId: z.string(),
  label: z.string(),
  category: z.enum([
    'wardrobe',
    'people-and-crowd',
    'weather-and-environment',
    'lighting',
    'materials-and-surfaces',
    'behavior-and-motion',
    'architecture-and-streetscape',
    'mood-and-social-tone',
    'unresolved'
  ]),
  summary: z.string().optional(),
  confidence: MetagrinderConfidenceLevelSchema,
  sourceInputIds: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()).min(1),
  attributionMode: MetagrinderAttributionModeSchema
});

const MetagrinderEvidenceSnippetSchema = z.object({
  evidenceId: z.string(),
  text: z.string(),
  sourceInputIds: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()).min(1),
  attributionMode: MetagrinderAttributionModeSchema
});

const MetagrinderOpenQuestionSchema = z.object({
  questionId: z.string(),
  text: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderExtractArtifactSchema = z.object({
  inputId: z.string(),
  claims: z.array(MetagrinderExtractedClaimSchema).default([]),
  conceptCandidates: z.array(MetagrinderConceptCandidateSchema).default([]),
  evidence: z.array(MetagrinderEvidenceSnippetSchema).default([]),
  openQuestions: z.array(MetagrinderOpenQuestionSchema).default([]),
  warnings: z.array(MetagrinderWarningSchema).default([])
});

const MetagrinderClassifiedBucketSchema = z.object({
  bucketId: z.string(),
  label: z.string(),
  category: z.string(),
  conceptIds: z.array(z.string()).default([]),
  claimIds: z.array(z.string()).default([])
});

const MetagrinderClassifyArtifactSchema = z.object({
  inputId: z.string(),
  collections: z.object({
    sourceMapChunkIds: z.array(z.string()).default([]),
    claimsAndEvidenceClaimIds: z.array(z.string()).default([]),
    conceptClusterBuckets: z.array(MetagrinderClassifiedBucketSchema).default([])
  })
});

const MetagrinderPromptFragmentSchema = z.object({
  fragmentId: z.string(),
  family: z.enum([
    'atmosphere',
    'wardrobe',
    'crowd-behavior',
    'lighting'
  ]),
  text: z.string(),
  conceptIds: z.array(z.string()).default([]),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderSynthesizeArtifactSchema = z.object({
  inputId: z.string(),
  promptFragments: z.array(MetagrinderPromptFragmentSchema).default([])
});

const MetagrinderMutationCompatibilityStatusSchema = z.enum([
  'compatible',
  'incompatible'
]);

const MetagrinderMutationInputFragmentSchema = z.object({
  fragmentId: z.string(),
  family: z.enum([
    'atmosphere',
    'wardrobe',
    'crowd-behavior',
    'lighting'
  ]),
  text: z.string(),
  conceptIds: z.array(z.string()).default([]),
  sourceInputIds: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()).min(1)
});

const MetagrinderMutationCompatibilityDecisionSchema = z.object({
  decisionId: z.string(),
  leftFragmentId: z.string(),
  rightFragmentId: z.string(),
  status: MetagrinderMutationCompatibilityStatusSchema,
  reasons: z.array(z.string()).min(1),
  sharedConceptIds: z.array(z.string()).default([]),
  sharedSourceInputIds: z.array(z.string()).default([])
});

const MetagrinderPromptMutationVariantSchema = z.object({
  variantId: z.string(),
  text: z.string(),
  fragmentIds: z.array(z.string()).min(2),
  families: z.array(z.enum([
    'atmosphere',
    'wardrobe',
    'crowd-behavior',
    'lighting'
  ])).min(2),
  compatibilityDecisionIds: z.array(z.string()).min(1),
  conceptIds: z.array(z.string()).default([]),
  sourceInputIds: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()).min(1),
  distinctivenessScore: z.number().min(0).max(1)
});

const MetagrinderMutationGenerationSummarySchema = z.object({
  maxVariants: z.number().int().positive(),
  compatiblePairCount: z.number().int().nonnegative(),
  incompatiblePairCount: z.number().int().nonnegative(),
  generatedVariantCount: z.number().int().nonnegative(),
  droppedDuplicateCount: z.number().int().nonnegative()
});

const MetagrinderDroppedMutationVariantSchema = z.object({
  droppedVariantId: z.string(),
  text: z.string(),
  fragmentIds: z.array(z.string()).min(2),
  compatibilityDecisionIds: z.array(z.string()).min(1),
  reason: z.literal('duplicate-variant-text')
});

const MetagrinderMutationArtifactSchema = z.object({
  inputId: z.string(),
  candidateFragments: z.array(MetagrinderMutationInputFragmentSchema).default([]),
  compatibilityDecisions: z.array(MetagrinderMutationCompatibilityDecisionSchema).default([]),
  variants: z.array(MetagrinderPromptMutationVariantSchema).default([]),
  droppedVariants: z.array(MetagrinderDroppedMutationVariantSchema).default([]),
  generationSummary: MetagrinderMutationGenerationSummarySchema
});

const MetagrinderMutationReviewArtifactSchema = z.object({
  inputId: z.string(),
  promotableVariantIds: z.array(z.string()).default([]),
  flaggedVariantIds: z.array(z.string()).default([]),
  rejectedVariantIds: z.array(z.string()).default([]),
  duplicateVariantIds: z.array(z.string()).default([]),
  weakVariantIds: z.array(z.string()).default([]),
  incompatibilityWarnings: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([])
});

const MetagrinderScoreArtifactSchema = z.object({
  inputId: z.string(),
  corroboratedConceptIds: z.array(z.string()).default([]),
  disputedConceptIds: z.array(z.string()).default([]),
  confidenceSummary: MetagrinderConfidenceSummarySchema,
  ambiguityFlags: z.array(z.string()).default([])
});

const MetagrinderReviewArtifactSchema = z.object({
  inputId: z.string(),
  unresolvedAmbiguities: z.array(z.string()).default([]),
  corroboratedConceptIds: z.array(z.string()).default([]),
  overlapWarnings: z.array(z.string()).default([]),
  contradictionFlags: z.array(z.string()).default([]),
  missingProvenance: z.array(z.string()).default([]),
  weakConceptIds: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([])
});

const ResearchPackageManifestSchema = z.object({
  packageId: z.string(),
  packageType: z.literal('research-package'),
  title: z.string(),
  createdAt: z.string().datetime().optional(),
  parserVersion: z.string().optional(),
  strategyVersion: z.string().optional(),
  contributorId: z.string().optional(),
  sourceInputs: z.array(z.string()).default([]),
  sourceInputIds: z.array(z.string()).default([]),
  collections: z.array(MetagrinderCollectionManifestSchema),
  lineage: MetagrinderLineageSchema,
  confidenceSummary: MetagrinderConfidenceSummarySchema,
  reviewStatus: MetagrinderReviewStatusSchema
});

const UtdgSubmissionManifestSchema = z.object({
  submissionId: z.string(),
  packageType: z.literal('utdg-submission'),
  derivedFromPackageId: z.string(),
  candidateFile: z.string(),
  evidenceFile: z.string(),
  contributorId: z.string(),
  submissionMode: z.enum(['staged', 'team', 'private']).default('staged'),
  createdAt: z.string().datetime().optional(),
  parserVersion: z.string().optional(),
  strategyVersion: z.string().optional(),
  sourceInputIds: z.array(z.string()).default([]),
  confidenceSummary: MetagrinderConfidenceSummarySchema.optional(),
  reviewStatus: MetagrinderReviewStatusSchema
});

const UtdgCandidateNormalizationSchema = z.object({
  conceptType: z.string().optional(),
  externalIds: MetagrinderExternalIdsSchema.optional()
});

const UtdgCandidateSchema = z.object({
  candidateId: z.string(),
  entityType: MetagrinderEntityTypeSchema,
  label: z.string(),
  summary: z.string(),
  sourceRefs: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  proposedRightsProfile: MetagrinderRightsProfileSchema,
  sourceRights: z.string(),
  contributionTerms: z.string(),
  rightsConfidence: MetagrinderConfidenceLevelSchema,
  commercialAllowed: z.boolean(),
  normalization: UtdgCandidateNormalizationSchema,
  confidence: z.object({
    extraction: MetagrinderConfidenceLevelSchema,
    normalization: MetagrinderConfidenceLevelSchema
  }),
  reviewStatus: MetagrinderReviewStatusSchema
});

const UtdgCandidatesFileSchema = z.object({
  submissionId: z.string(),
  derivedFromPackageId: z.string(),
  candidates: z.array(UtdgCandidateSchema)
});

const CanonicalUtdgRecordSchema = z.object({
  id: z.string(),
  entityType: MetagrinderEntityTypeSchema,
  label: z.string(),
  summary: z.string().optional(),
  definition: z.string().optional(),
  externalIds: MetagrinderExternalIdsSchema.optional(),
  provenanceRefs: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  rightsProfile: MetagrinderRightsProfileSchema,
  sourceRights: z.string(),
  contributionTerms: z.string(),
  rightsConfidence: MetagrinderConfidenceLevelSchema,
  commercialAllowed: z.boolean(),
  reviewStatus: MetagrinderReviewStatusSchema,
  createdFromSubmissionId: z.string().optional()
});

const WorldPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const WorldBoundsSchema = z.object({
  min: WorldPositionSchema,
  max: WorldPositionSchema
});

const SemanticLineageSchema = z.object({
  packageId: z.string().optional(),
  sourceInputIds: z.array(z.string()).default([]),
  derivedFromIds: z.array(z.string()).default([])
});

const SemanticLodOverrideSchema = z.object({
  minLod: z.enum(['lod0', 'lod1', 'lod2']).optional(),
  preserveHeroDetailsAboveNarrativeWeight: z.number().optional(),
  forceIncludeInWideShots: z.boolean().optional()
});

const BaseWorldSemanticRecordSchema = z.object({
  id: z.string(),
  utdgRefs: z.array(z.string()).default([]),
  sourceRefs: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  importanceWeight: z.number().default(1),
  narrativeWeight: z.number().default(1),
  visibilityWeight: z.number().default(1),
  effectRefs: z.array(z.string()).default([]),
  localizedIntentRefs: z.array(z.string()).default([]),
  responseProfileRefs: z.array(z.string()).default([]),
  environmentalControllerRefs: z.array(z.string()).default([]),
  geometryBindingRef: z.string().optional(),
  materialBindingRef: z.string().optional(),
  surfaceBindingRef: z.string().optional(),
  objectRef: z.string().optional(),
  semanticLodOverride: SemanticLodOverrideSchema.optional(),
  lineage: SemanticLineageSchema.optional(),
  reviewStatus: MetagrinderReviewStatusSchema
});

const SemanticPointSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticPoint'),
  worldPosition: WorldPositionSchema,
  worldNormal: WorldPositionSchema.optional(),
  influenceRadius: z.number().optional(),
  falloff: z.string().optional()
});

const SemanticSplatSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticSplat'),
  worldPosition: WorldPositionSchema,
  orientation: WorldPositionSchema.optional(),
  radius: z.number().optional(),
  anisotropy: z.number().optional(),
  falloff: z.string().optional(),
  influenceWeight: z.number().optional()
});

const SemanticRegionSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticRegion'),
  bounds: WorldBoundsSchema,
  surfaceClass: z.string().optional()
});

const SemanticVolumeSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticVolume'),
  bounds: WorldBoundsSchema,
  volumeType: z.string().optional()
});

const WorldSemanticRecordSchema = z.discriminatedUnion('recordType', [
  SemanticPointSchema,
  SemanticSplatSchema,
  SemanticRegionSchema,
  SemanticVolumeSchema
]);

const WorldSemanticFieldSchema = z.object({
  fieldId: z.string(),
  packageId: z.string().optional(),
  coordinateSpace: z.enum(['world']).default('world'),
  records: z.array(WorldSemanticRecordSchema)
});

const PromptAlignmentRecordSchema = z.object({
  promptToken: z.string(),
  matchedRegionRefs: z.array(z.string()).default([]),
  matchedObjectRefs: z.array(z.string()).default([]),
  status: z.enum(['present', 'partial', 'absent', 'inferred']),
  confidence: MetagrinderConfidenceLevelSchema
});

const SceneRegionRecordSchema = z.object({
  regionId: z.string(),
  maskRef: z.string().optional(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  dominantColors: z.array(z.string()).default([]),
  materialHypotheses: z.array(z.string()).default([]),
  objectHypotheses: z.array(z.string()).default([]),
  environmentalHypotheses: z.array(z.string()).default([]),
  promptRefs: z.array(z.string()).default([]),
  utdgRefs: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema
});

const ObjectHypothesisRecordSchema = z.object({
  objectId: z.string(),
  label: z.string(),
  regionRefs: z.array(z.string()).default([]),
  materialRefs: z.array(z.string()).default([]),
  promptRefs: z.array(z.string()).default([]),
  utdgRefs: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema
});

const SemanticScenePackageSchema = z.object({
  packageId: z.string(),
  packageType: z.literal('semantic-scene-package'),
  sourceRender: z.string(),
  sourcePrompt: z.string(),
  analysisMode: z.enum(['reverse-prompt-analysis', 'render-backfill']),
  sceneRegions: z.array(SceneRegionRecordSchema),
  objectHypotheses: z.array(ObjectHypothesisRecordSchema).default([]),
  promptAlignment: z.array(PromptAlignmentRecordSchema).default([]),
  utdgMatches: z.array(z.string()).default([]),
  adjustmentHandles: z.array(z.string()).default([]),
  confidenceSummary: MetagrinderConfidenceSummarySchema,
  lineage: MetagrinderLineageSchema
});

const PromptGraphLoDPolicySchema = z.object({
  policyId: z.string(),
  strategy: z.enum(['distance-and-budget']),
  thresholds: z.object({
    lod0MinDistance: z.number().nonnegative(),
    lod1MinDistance: z.number().nonnegative(),
    lod2MaxDistance: z.number().nonnegative()
  }),
  budgets: z.object({
    lod0: z.object({
      maxEntries: z.number().int().positive(),
      strategy: z.enum(['coarse', 'balanced', 'fine'])
    }),
    lod1: z.object({
      maxEntries: z.number().int().positive(),
      strategy: z.enum(['coarse', 'balanced', 'fine'])
    }),
    lod2: z.object({
      maxEntries: z.number().int().positive(),
      strategy: z.enum(['coarse', 'balanced', 'fine'])
    })
  }),
  compaction: z.object({
    preserveHeroDetails: z.boolean().default(true),
    heroNarrativeThreshold: z.number().default(1),
    preserveLocalizedEffectsInWideShots: z.boolean().default(false)
  }).optional()
});

const PromptGraphTextVariantsSchema = z.object({
  lod0: z.array(z.string()).default([]),
  lod1: z.array(z.string()).default([]),
  lod2: z.array(z.string()).default([])
});

const PromptGraphNodeSchema = z.object({
  nodeId: z.string(),
  label: z.string(),
  semanticRefs: z.array(z.string()).default([]),
  spatialRefs: z.array(z.string()).default([]),
  nodeType: z.enum([
    'surface',
    'localized-effect',
    'environment',
    'hero-detail',
    'background-context'
  ]),
  narrativePriority: z.number().default(1),
  priorityWeight: z.number().default(1),
  forceInclude: z.boolean().default(false),
  minScreenCoverage: z.number().min(0).max(1).optional(),
  minSemanticInfluence: z.number().min(0).optional(),
  textVariants: PromptGraphTextVariantsSchema
});

const PromptGraphEdgeSchema = z.object({
  edgeId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  relationship: z.enum(['modifies', 'depends-on', 'context-for', 'inherits-from'])
});

const PromptGraphManifestSchema = z.object({
  graphId: z.string(),
  packageId: z.string().optional(),
  title: z.string(),
  lodPolicyRef: z.string().optional(),
  nodes: z.array(PromptGraphNodeSchema),
  edges: z.array(PromptGraphEdgeSchema).default([])
});

const PacketAttributionEntrySchema = z.object({
  text: z.string(),
  bucket: z.enum([
    'dominant_surfaces',
    'localized_effects',
    'environmental_conditions',
    'hero_details',
    'optional_background_context'
  ]),
  source: z.enum(['prompt-graph', 'heuristic', 'compaction-policy', 'patch-proposal']),
  recordId: z.string().nullable(),
  semanticLod: z.enum(['lod0', 'lod1', 'lod2']),
  graphNodeId: z.string().nullable().optional(),
  matchType: z.string().optional(),
  matchedRefs: z.array(z.string()).default([]),
  screenCoverageEstimate: z.number().min(0).max(1).optional(),
  semanticInfluence: z.number().min(0).optional()
});

const PacketAttributionManifestSchema = z.object({
  packetId: z.string(),
  cameraId: z.string(),
  entries: z.array(PacketAttributionEntrySchema)
});

const GraphMatchReportEntrySchema = z.object({
  recordId: z.string(),
  graphNodeId: z.string(),
  semanticLod: z.enum(['lod0', 'lod1', 'lod2']),
  matchType: z.enum(['spatial', 'semantic']),
  matchedRefs: z.array(z.string()).default([]),
  screenCoverageEstimate: z.number().min(0).max(1).optional(),
  semanticInfluence: z.number().min(0).optional(),
  bucket: z.enum([
    'dominant_surfaces',
    'localized_effects',
    'environmental_conditions',
    'hero_details',
    'optional_background_context'
  ]),
  selectedText: z.array(z.string()).default([])
});

const GraphMatchReportSchema = z.object({
  graphId: z.string(),
  cameraId: z.string(),
  packetId: z.string(),
  entries: z.array(GraphMatchReportEntrySchema)
});

const SuppressedGraphNodeEntrySchema = z.object({
  recordId: z.string(),
  graphNodeId: z.string(),
  semanticLod: z.enum(['lod0', 'lod1', 'lod2']),
  bucket: z.enum([
    'dominant_surfaces',
    'localized_effects',
    'environmental_conditions',
    'hero_details',
    'optional_background_context'
  ]),
  selectedText: z.array(z.string()).default([]),
  suppressionReason: z.enum(['bucket-budget', 'packet-budget']),
  screenCoverageEstimate: z.number().min(0).max(1).optional(),
  semanticInfluence: z.number().min(0).optional(),
  narrativePriority: z.number(),
  priorityWeight: z.number()
});

const SuppressedGraphNodesReportSchema = z.object({
  graphId: z.string(),
  cameraId: z.string(),
  packetId: z.string(),
  entries: z.array(SuppressedGraphNodeEntrySchema)
});

const PatchProposalSchema = z.object({
  proposalId: z.string(),
  packageId: z.string(),
  targetType: z.enum(['wall-continuation', 'surface-extension', 'environment-extension']),
  targetRefs: z.array(z.string()).default([]),
  proposedSemanticRefs: z.array(z.string()).default([]),
  rationale: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema,
  reviewStatus: MetagrinderReviewStatusSchema
});

const WitnessRenderManifestSchema = z.object({
  witnessRenderId: z.string(),
  packageId: z.string(),
  cameraId: z.string(),
  sourceFieldId: z.string().optional(),
  renderPath: z.string(),
  depthPath: z.string().optional(),
  normalPath: z.string().optional(),
  semanticOverlayPath: z.string().optional(),
  mode: z.enum(['proxy-reprojection', 'splat-preview', 'projected-texture-preview']),
  generatedAt: z.string().datetime().optional()
});

const RenderTextPacketSchema = z.object({
  packetId: z.string(),
  generatedFromFieldId: z.string().optional(),
  cameraId: z.string().optional(),
  semanticLod: z.enum(['lod0', 'lod1', 'lod2']).optional(),
  semanticBudget: z.object({
    maxEntries: z.number().int().positive(),
    strategy: z.enum(['coarse', 'balanced', 'fine'])
  }).optional(),
  dominant_surfaces: z.array(z.string()).default([]),
  localized_effects: z.array(z.string()).default([]),
  environmental_conditions: z.array(z.string()).default([]),
  hero_details: z.array(z.string()).default([]),
  optional_background_context: z.array(z.string()).default([])
});

const CameraQueryContractSchema = z.object({
  cameraId: z.string(),
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  useOcclusion: z.boolean().default(true),
  distanceBias: z.number().default(1),
  narrativePriorityBias: z.number().default(1),
  semanticInfluenceBias: z.number().default(1),
  maxRecords: z.number().int().positive().default(64),
  maxPacketEntries: z.number().int().positive().default(16)
});

const CameraPassManifestSchema = z.object({
  cameraPassId: z.string(),
  metaballId: z.string(),
  cameraId: z.string(),
  worldSemanticFieldId: z.string().optional(),
  renderTextPacketId: z.string().optional(),
  inputArtifacts: z.array(z.string()).default([]),
  outputArtifacts: z.array(z.string()).default([]),
  queryConfig: CameraQueryContractSchema,
  taskMode: z.enum([
    'witness-only',
    'material-refinement',
    'weather-pass',
    'grime-pass',
    'image-modify-prep'
  ]),
  generatedAt: z.string().datetime().optional()
});

const ModelConditioningPayloadSchema = z.object({
  taskMode: z.enum([
    'material-refinement',
    'weather-pass',
    'grime-pass',
    'image-modify-prep'
  ]),
  renderTextPacket: RenderTextPacketSchema,
  conditioningAssets: z.object({
    witnessRender: z.string().optional(),
    semanticMask: z.string().optional(),
    localizedEffectMask: z.string().optional(),
    depthPass: z.string().optional(),
    worldNormalPass: z.string().optional()
  }),
  styleRefs: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([])
});

const LumaAdapterContractSchema = z.object({
  adapterId: z.string(),
  provider: z.literal('luma'),
  mode: z.enum(['image-generation', 'image-modify']),
  prompt: z.string(),
  imageRef: z.string().optional(),
  styleRefs: z.array(z.string()).default([]),
  characterRefs: z.array(z.string()).default([]),
  modifyImage: z.string().optional(),
  metadata: z.object({
    renderTextPacketId: z.string().optional(),
    cameraPassId: z.string().optional(),
    metaballId: z.string().optional(),
    notes: z.array(z.string()).default([])
  }).optional()
});

const MetagrinderAgentRunRecordSchema = z.object({
  runId: z.string(),
  passName: z.string(),
  mode: z.enum(['deterministic', 'agent-interface', 'mock-adapter']),
  strategyVersion: z.string(),
  inputArtifactIds: z.array(z.string()).default([]),
  outputArtifactIds: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderAgentRunArtifactSchema = z.object({
  inputId: z.string(),
  createdAt: z.string().datetime().optional(),
  runs: z.array(MetagrinderAgentRunRecordSchema).default([])
});

const MetagrinderWeightedRangeSchema = z.object({
  label: z.string(),
  min: z.number().min(0),
  max: z.number().min(0),
  unit: z.enum(['percent', 'weight']).default('percent'),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema.default('medium')
}).refine((value) => value.max >= value.min, {
  message: 'weighted range max must be greater than or equal to min'
});

const MetagrinderSceneContextSchema = z.object({
  contextId: z.string(),
  title: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  summary: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderSceneEvidenceSchema = z.object({
  evidenceId: z.string(),
  text: z.string(),
  claimType: z.string(),
  attributionMode: MetagrinderAttributionModeSchema,
  confidence: MetagrinderConfidenceLevelSchema,
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderPopulationModelSchema = z.object({
  modelId: z.string(),
  label: z.string(),
  baselineWeights: z.array(MetagrinderWeightedRangeSchema).default([]),
  notes: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderArchetypeSchema = z.object({
  archetypeId: z.string(),
  label: z.string(),
  summary: z.string(),
  role: z.string(),
  genderPresentation: z.string(),
  classBand: z.string(),
  raceEthnicityContext: z.string().optional(),
  weightRange: MetagrinderWeightedRangeSchema.optional(),
  dominantAttributes: z.array(z.string()).default([]),
  optionalAttributes: z.array(z.string()).default([]),
  wardrobeRefs: z.array(z.string()).default([]),
  behaviorRefs: z.array(z.string()).default([]),
  locationZoneRefs: z.array(z.string()).default([]),
  promptText: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema
});

const MetagrinderDemographicDistributionSchema = z.object({
  distributionId: z.string(),
  label: z.string(),
  entries: z.array(MetagrinderWeightedRangeSchema).default([]),
  appliesToRefs: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderWardrobeSystemSchema = z.object({
  wardrobeId: z.string(),
  label: z.string(),
  items: z.array(z.string()).default([]),
  avoidItems: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderBehaviorStateSchema = z.object({
  behaviorId: z.string(),
  label: z.string(),
  promptText: z.string(),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderEnvironmentalModifierSchema = z.object({
  modifierId: z.string(),
  label: z.string(),
  promptText: z.string(),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderVisualReferenceSetSchema = z.object({
  referenceId: z.string(),
  kind: z.literal('image-reference'),
  path: z.string().optional(),
  caption: z.string(),
  supports: z.array(z.string()).default([]),
  linkedArchetypeIds: z.array(z.string()).default([]),
  rightsProfile: MetagrinderRightsProfileSchema.default('reference-only'),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderLocationZoneSchema = z.object({
  zoneId: z.string(),
  label: z.string(),
  promptText: z.string(),
  demographicDistributionRefs: z.array(z.string()).default([]),
  archetypeBiases: z.array(MetagrinderWeightedRangeSchema).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderRuleEffectSchema = z.object({
  action: z.enum([
    'force',
    'allow',
    'avoid',
    'increase',
    'decrease',
    'exclude',
    'requires',
    'incompatible-with',
    'bias-toward',
    'bias-away-from'
  ]),
  target: z.string()
});

const MetagrinderCompatibilityRuleSchema = z.object({
  ruleId: z.string(),
  label: z.string(),
  condition: z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not-equals', 'includes', 'exists']),
    value: z.string()
  }),
  effects: z.array(MetagrinderRuleEffectSchema).min(1),
  sourceChunkIds: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema
});

const MetagrinderNegativeConstraintSchema = z.object({
  constraintId: z.string(),
  label: z.string(),
  text: z.string(),
  constraintType: z.enum([
    'negative',
    'ethical-historical',
    'ethical-historical-representation',
    'modern-artifact-risk',
    'compatibility'
  ]),
  appliesTo: z.array(z.string()).default([]),
  enforcement: z.object({
    avoid: z.array(z.string()).default([]),
    allow: z.array(z.string()).default([]),
    force: z.array(z.string()).default([]),
    exclude: z.array(z.string()).default([])
  }).optional(),
  enforcedByRuleIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema
});

const MetagrinderSceneGrammarArtifactSchema = z.object({
  inputId: z.string(),
  sceneContext: MetagrinderSceneContextSchema,
  sourceLinks: z.array(z.object({
    sourceInputId: z.string(),
    title: z.string(),
    path: z.string().optional()
  })).default([]),
  evidence: z.array(MetagrinderSceneEvidenceSchema).default([]),
  populationModel: MetagrinderPopulationModelSchema,
  archetypes: z.array(MetagrinderArchetypeSchema).default([]),
  demographicDistributions: z.array(MetagrinderDemographicDistributionSchema).default([]),
  wardrobeSystem: z.array(MetagrinderWardrobeSystemSchema).default([]),
  groomingAndHair: z.array(MetagrinderWardrobeSystemSchema).default([]),
  propsAndAccessories: z.array(MetagrinderWardrobeSystemSchema).default([]),
  locationZones: z.array(MetagrinderLocationZoneSchema).default([]),
  behaviorStates: z.array(MetagrinderBehaviorStateSchema).default([]),
  environmentalModifiers: z.array(MetagrinderEnvironmentalModifierSchema).default([]),
  visualReferenceSets: z.array(MetagrinderVisualReferenceSetSchema).default([]),
  compatibilityRules: z.array(MetagrinderCompatibilityRuleSchema).default([]),
  negativeConstraints: z.array(MetagrinderNegativeConstraintSchema).default([]),
  uncertainties: z.array(z.string()).default([]),
  reviewFlags: z.array(z.string()).default([])
});

const MetagrinderResearchGapSchema = z.object({
  gapId: z.string(),
  gapType: z.enum([
    'under-supported-distribution',
    'missing-behavior-model',
    'missing-location-distribution',
    'visual-reference-without-support',
    'negative-constraint-not-enforced',
    'unsupported-weight',
    'sampling-risk'
  ]),
  severity: z.enum(['low', 'medium', 'high']),
  affectedGrammarRefs: z.array(z.string()).default([]),
  question: z.string(),
  currentSupport: z.array(z.string()).default([]),
  missingSupport: z.array(z.string()).default([]),
  recommendedSearches: z.array(z.string()).default([]),
  reviewStatus: z.enum(['needs_research', 'needs_review', 'accepted']).default('needs_research')
});

const MetagrinderResearchGapArtifactSchema = z.object({
  inputId: z.string(),
  gaps: z.array(MetagrinderResearchGapSchema).default([])
});

const MetagrinderResearchQueryPlanSchema = z.object({
  inputId: z.string(),
  webResearchMode: z.enum(['off', 'gaps-only', 'standard', 'deep']).default('gaps-only'),
  maxQueriesPerGap: z.number().int().positive().default(3),
  maxSourcesPerGap: z.number().int().positive().default(5),
  allowedSourceTypes: z.array(z.enum([
    'archive',
    'museum',
    'library',
    'scholarly',
    'newspaper',
    'high-quality-secondary'
  ])).default([]),
  requireCitationForGrammarRevision: z.boolean().default(true),
  queries: z.array(z.object({
    queryId: z.string(),
    gapId: z.string(),
    query: z.string(),
    purpose: z.string().optional(),
    allowedSourceTypes: z.array(z.enum([
      'archive',
      'museum',
      'library',
      'scholarly',
      'newspaper',
      'high-quality-secondary'
    ])).default([]),
    maxResults: z.number().int().positive().default(5),
    priority: z.enum(['low', 'medium', 'high']).default('medium')
  })).default([])
});

const MetagrinderWebResearchResultsSchema = z.object({
  inputId: z.string(),
  adapterMode: z.enum(['mock', 'off', 'live']).default('mock'),
  retrievedAt: z.string().datetime().optional(),
  results: z.array(z.object({
    resultId: z.string(),
    gapId: z.string(),
    sourceType: z.string(),
    title: z.string(),
    url: z.string(),
    retrievedAt: z.string().datetime().optional(),
    relevance: z.enum(['low', 'medium', 'high']),
    sourceQuality: MetagrinderConfidenceLevelSchema,
    claimsExtracted: z.array(z.object({
      claim: z.string(),
      supportsGrammarRefs: z.array(z.string()).default([]),
      confidence: MetagrinderConfidenceLevelSchema
    })).default([]),
    limitations: z.array(z.string()).default([])
  })).default([])
});

const MetagrinderGrammarRevisionSchema = z.object({
  revisionId: z.string(),
  gapId: z.string(),
  changeType: z.enum([
    'adjust-weight-range',
    'add-support-claim',
    'tighten-constraint',
    'add-compatibility-rule',
    'flag-low-quality-source',
    'no-op'
  ]),
  targetGrammarRef: z.string(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  supportingResultIds: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema,
  reviewStatus: z.enum(['proposed', 'accepted', 'rejected', 'needs_review']).default('needs_review')
});

const MetagrinderGrammarRevisionArtifactSchema = z.object({
  inputId: z.string(),
  revisions: z.array(MetagrinderGrammarRevisionSchema).default([])
});

const MetagrinderSamplePromptSchema = z.object({
  sampleId: z.string(),
  sampleMode: z.enum(['global-baseline', 'location-zone', 'archetype', 'branch', 'invalid-test']),
  locationZone: z.string().optional(),
  selectedArchetypeIds: z.array(z.string()).default([]),
  generatedPrompt: z.string(),
  grammarRefs: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

const MetagrinderSamplePromptsArtifactSchema = z.object({
  inputId: z.string(),
  samples: z.array(MetagrinderSamplePromptSchema).default([])
});

const MetagrinderSceneGrammarEvaluationSchema = z.object({
  inputId: z.string(),
  distributionTests: z.array(z.object({
    testId: z.string(),
    sampleCount: z.number().int().nonnegative(),
    expected: z.record(z.string()),
    observed: z.record(z.string()),
    verdict: z.enum(['pass', 'warn', 'fail'])
  })).default([]),
  criticFlags: z.array(z.object({
    code: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    message: z.string(),
    grammarRefs: z.array(z.string()).default([])
  })).default([])
});

const MetagrinderPlausibilityReviewArtifactSchema = z.object({
  inputId: z.string(),
  reviews: z.array(z.object({
    sampleId: z.string(),
    generatedPrompt: z.string(),
    scores: z.object({
      periodAccuracy: z.number().min(0).max(1),
      eventAttendancePlausibility: z.number().min(0).max(1),
      wardrobeCompatibility: z.number().min(0).max(1),
      locationCompatibility: z.number().min(0).max(1),
      roleCompatibility: z.number().min(0).max(1).optional(),
      classRoleCoherence: z.number().min(0).max(1).optional(),
      demographicPlacement: z.number().min(0).max(1).optional(),
      behaviorPlausibility: z.number().min(0).max(1).optional(),
      environmentalAdaptation: z.number().min(0).max(1).optional(),
      modernArtifactAvoidance: z.number().min(0).max(1).optional(),
      negativeConstraintCompliance: z.number().min(0).max(1).optional(),
      ethicalConstraintCompliance: z.number().min(0).max(1)
    }),
    verdict: z.enum(['plausible', 'needs_review', 'fail']),
    reasoningSummary: z.string(),
    failureReasons: z.array(z.string()).default([]),
    recommendedFixes: z.array(z.string()).default([])
  })).default([])
});

const MetagrinderPsgV2EditStateSchema = z.object({
  isEditing: z.boolean().default(false),
  editBuffer: z.string().nullable().default(null),
  lastEditTimestamp: z.string().datetime().optional(),
  validationErrors: z.array(z.string()).default([]),
  isDirty: z.boolean().default(false)
});

const MetagrinderPsgV2NodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'TextBlock',
    'WeightedChoice',
    'Concat',
    'Output',
    'Include',
    'SetVariable',
    'GetVariable'
  ]),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.object({
    value: z.union([
      z.string(),
      z.array(z.object({
        id: z.string(),
        text: z.string(),
        weight: z.number()
      })),
      z.object({
        separator: z.string().optional(),
        trimInputs: z.boolean().optional()
      })
    ]),
    editState: MetagrinderPsgV2EditStateSchema.optional()
  }).passthrough(),
  label: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([])
});

const MetagrinderPsgV2EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  data: z.record(z.unknown()).optional()
});

const MetagrinderPsgV2FileSchema = z.object({
  fileType: z.literal('psg'),
  formatVersion: z.literal('2.0.0'),
  metadata: z.object({
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string().datetime(),
    lastModified: z.string().datetime(),
    author: z.string()
  }).passthrough(),
  graph: z.object({
    nodes: z.array(MetagrinderPsgV2NodeSchema),
    edges: z.array(MetagrinderPsgV2EdgeSchema)
  })
});

const MetaballManifestSchema = z.object({
  metaballId: z.string(),
  title: z.string(),
  packageType: z.literal('metaball-manifest'),
  researchPackage: z.object({
    path: z.string(),
    packageId: z.string()
  }),
  utdgSubmission: z.object({
    path: z.string(),
    submissionId: z.string()
  }).optional(),
  worldSemanticField: z.object({
    path: z.string(),
    fieldId: z.string()
  }).optional(),
  renderTextPackets: z.array(
    z.object({
      path: z.string(),
      packetId: z.string()
    })
  ).default([]),
  promptGraphs: z.array(
    z.object({
      path: z.string(),
      graphId: z.string()
    })
  ).default([]),
  semanticScenePackages: z.array(
    z.object({
      path: z.string(),
      packageId: z.string()
    })
  ).default([]),
  patchProposals: z.array(
    z.object({
      path: z.string(),
      proposalId: z.string()
    })
  ).default([]),
  witnessRenders: z.array(
    z.object({
      path: z.string(),
      witnessRenderId: z.string()
    })
  ).default([]),
  cameraPasses: z.array(
    z.object({
      path: z.string(),
      cameraPassId: z.string()
    })
  ).default([]),
  viewQueryConfig: CameraQueryContractSchema.optional(),
  promptGraphLoDPolicy: PromptGraphLoDPolicySchema.optional(),
  metadata: z.object({
    description: z.string().optional(),
    createdAt: z.string().datetime().optional()
  }).optional()
});

module.exports = {
  CameraPassManifestSchema,
  CameraQueryContractSchema,
  CanonicalUtdgRecordSchema,
  LumaAdapterContractSchema,
  MetagrinderAgentRunArtifactSchema,
  MetagrinderAgentRunRecordSchema,
  MetagrinderAssumptionReviewArtifactSchema,
  MetagrinderAugmentationPlanArtifactSchema,
  MetagrinderClassifyArtifactSchema,
  MetagrinderConceptCandidateSchema,
  MetagrinderArchetypeSchema,
  MetagrinderAttributionModeSchema,
  MetagrinderBehaviorStateSchema,
  MetagrinderCompatibilityRuleSchema,
  MetagrinderDemographicDistributionSchema,
  MetagrinderEnvironmentalModifierSchema,
  MetagrinderEvidenceSnippetSchema,
  MetagrinderExtractArtifactSchema,
  MetagrinderExtractedClaimSchema,
  MetagrinderGrammarRevisionArtifactSchema,
  MetagrinderGrammarRevisionSchema,
  MetagrinderCategoryHypothesisArtifactSchema,
  MetagrinderCategoryHypothesisEntrySchema,
  MetagrinderCategoryPrioritySchema,
  MetagrinderChunkKindSchema,
  MetagrinderIngestArtifactSchema,
  MetagrinderIngestChunkSchema,
  MetagrinderModeDetectionArtifactSchema,
  MetagrinderNegativeConstraintSchema,
  MetagrinderPlausibilityReviewArtifactSchema,
  MetagrinderResearchKindSchema,
  MetagrinderResearchGapArtifactSchema,
  MetagrinderResearchGapSchema,
  MetagrinderResearchQueryPlanSchema,
  MetagrinderSourceInputSchema,
  MetagrinderOpenQuestionSchema,
  MetagrinderPromptFragmentSchema,
  MetagrinderPsgV2FileSchema,
  MetagrinderPsgV2NodeSchema,
  MetagrinderPsgV2EdgeSchema,
  MetagrinderReviewDecisionOptionSchema,
  MetagrinderReviewArtifactSchema,
  MetagrinderMutationArtifactSchema,
  MetagrinderMutationCompatibilityDecisionSchema,
  MetagrinderMutationGenerationSummarySchema,
  MetagrinderMutationCompatibilityStatusSchema,
  MetagrinderMutationInputFragmentSchema,
  MetagrinderMutationReviewArtifactSchema,
  MetagrinderPromptMutationVariantSchema,
  MetagrinderScoreArtifactSchema,
  MetagrinderSceneContextSchema,
  MetagrinderSceneEvidenceSchema,
  MetagrinderSceneGrammarArtifactSchema,
  MetagrinderSceneGrammarEvaluationSchema,
  MetagrinderSamplePromptsArtifactSchema,
  MetagrinderSamplePromptSchema,
  MetagrinderSourceTypeSchema,
  MetagrinderSynthesizeArtifactSchema,
  MetagrinderVisualReferenceSetSchema,
  MetagrinderWarningSchema,
  MetagrinderWardrobeSystemSchema,
  MetagrinderWebResearchResultsSchema,
  MetagrinderWeightedRangeSchema,
  MetagrinderPopulationModelSchema,
  MetaballManifestSchema,
  ModelConditioningPayloadSchema,
  PatchProposalSchema,
  PacketAttributionManifestSchema,
  PromptGraphLoDPolicySchema,
  PromptGraphManifestSchema,
  SemanticScenePackageSchema,
  GraphMatchReportSchema,
  SuppressedGraphNodesReportSchema,
  RenderTextPacketSchema,
  ResearchPackageManifestSchema,
  UtdgCandidatesFileSchema,
  UtdgSubmissionManifestSchema,
  WitnessRenderManifestSchema,
  WorldSemanticFieldSchema
};

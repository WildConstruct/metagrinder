import { z } from 'zod';

export const MetagrinderReviewStatusSchema = z.enum([
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

export const MetagrinderConfidenceLevelSchema = z.enum([
  'low',
  'medium',
  'high'
]);

export const MetagrinderRightsProfileSchema = z.enum([
  'unrestricted',
  'attribution-required',
  'non-commercial',
  'reference-only',
  'restricted'
]);

export const MetagrinderPackageTypeSchema = z.enum([
  'research-package',
  'utdg-submission',
  'metaball-manifest',
  'semantic-scene-package'
]);

export const MetagrinderCollectionTypeSchema = z.enum([
  'source-map',
  'claims-and-evidence',
  'concept-clusters',
  'prompt-synthesis',
  'prompt-mutations'
]);

export const MetagrinderEntityTypeSchema = z.enum([
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

export const MetagrinderSpatialRecordTypeSchema = z.enum([
  'SemanticPoint',
  'SemanticSplat',
  'SemanticRegion',
  'SemanticVolume'
]);

export const MetagrinderExternalIdsSchema = z.object({
  gettyAatId: z.string().nullable().optional(),
  wikidataQid: z.string().nullable().optional(),
  institutionRecordId: z.string().nullable().optional(),
  europeanaRecordId: z.string().nullable().optional()
});

export const MetagrinderConfidenceSummarySchema = z.object({
  overall: MetagrinderConfidenceLevelSchema,
  extraction: MetagrinderConfidenceLevelSchema.optional(),
  normalization: MetagrinderConfidenceLevelSchema.optional(),
  provenance: MetagrinderConfidenceLevelSchema.optional(),
  rights: MetagrinderConfidenceLevelSchema.optional()
});

export const MetagrinderLineageSchema = z.object({
  sourceInputIds: z.array(z.string()).default([]),
  derivedFromPackageId: z.string().optional()
});

export const MetagrinderCollectionManifestSchema = z.object({
  id: z.string(),
  type: MetagrinderCollectionTypeSchema,
  path: z.string()
});

export const MetagrinderSourceTypeSchema = z.enum([
  'plain-text',
  'notes-bundle',
  'research-brief'
]);

export const MetagrinderResearchKindSchema = z.enum([
  'historical-scene-research',
  'character-framework',
  'material-reference',
  'environment-observation',
  'style-analysis',
  'procedural-guide',
  'mixed',
  'unknown'
]);

export const MetagrinderChunkKindSchema = z.enum([
  'source-note',
  'observation',
  'concept-list',
  'generation-rule',
  'template',
  'uncertainty',
  'reference-table',
  'unknown'
]);

export const MetagrinderIngestChunkSchema = z.object({
  chunkId: z.string(),
  sourceInputId: z.string(),
  text: z.string().min(1),
  sectionLabel: z.string().optional(),
  chunkKind: MetagrinderChunkKindSchema.default('unknown'),
  sequence: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([])
});

export const MetagrinderSourceInputSchema = z.object({
  sourceInputId: z.string(),
  title: z.string(),
  sourceType: MetagrinderSourceTypeSchema.default('plain-text'),
  path: z.string().optional(),
  sequence: z.number().int().nonnegative()
});

export const MetagrinderIngestArtifactSchema = z.object({
  inputId: z.string(),
  title: z.string(),
  sourceType: MetagrinderSourceTypeSchema.default('plain-text'),
  researchKind: MetagrinderResearchKindSchema.default('unknown'),
  createdAt: z.string().datetime().optional(),
  sourceInputs: z.array(MetagrinderSourceInputSchema).min(1).default([]),
  chunks: z.array(MetagrinderIngestChunkSchema).min(1)
});

export const MetagrinderModeDetectionArtifactSchema = z.object({
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

export const MetagrinderCategoryPrioritySchema = z.enum([
  'primary',
  'secondary',
  'optional'
]);

export const MetagrinderCategoryHypothesisEntrySchema = z.object({
  categoryId: z.string(),
  label: z.string(),
  priority: MetagrinderCategoryPrioritySchema,
  rationale: z.string()
});

export const MetagrinderCategoryHypothesisArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  categories: z.array(MetagrinderCategoryHypothesisEntrySchema).default([]),
  recommendedFocus: z.array(z.string()).default([])
});

export const MetagrinderReviewDecisionOptionSchema = z.enum([
  'proceed-as-is',
  'adjust-priorities',
  'request-augmentation'
]);

export const MetagrinderAssumptionReviewArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  detectedChunkKinds: z.array(MetagrinderChunkKindSchema).default([]),
  recommendedFocus: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  decisionOptions: z.array(MetagrinderReviewDecisionOptionSchema).default([])
});

export const MetagrinderAugmentationPlanArtifactSchema = z.object({
  inputId: z.string(),
  researchKind: MetagrinderResearchKindSchema,
  verificationTargets: z.array(z.string()).default([]),
  missingSourceTypes: z.array(z.string()).default([]),
  followUpResearchDirections: z.array(z.string()).default([]),
  rationale: z.array(z.string()).default([])
});

export const MetagrinderPassSourceAttributionSchema = z.object({
  sourceChunkIds: z.array(z.string()).min(1),
  attributionMode: z.enum(['quoted', 'paraphrased', 'inferred'])
});

export const MetagrinderExtractedClaimSchema = z.object({
  claimId: z.string(),
  text: z.string(),
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
  attributionMode: z.enum(['quoted', 'paraphrased', 'inferred'])
});

export const MetagrinderConceptCandidateSchema = z.object({
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
  attributionMode: z.enum(['quoted', 'paraphrased', 'inferred'])
});

export const MetagrinderEvidenceSnippetSchema = z.object({
  evidenceId: z.string(),
  text: z.string(),
  sourceInputIds: z.array(z.string()).min(1),
  sourceChunkIds: z.array(z.string()).min(1),
  attributionMode: z.enum(['quoted', 'paraphrased', 'inferred'])
});

export const MetagrinderOpenQuestionSchema = z.object({
  questionId: z.string(),
  text: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

export const MetagrinderWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
});

export const MetagrinderExtractArtifactSchema = z.object({
  inputId: z.string(),
  claims: z.array(MetagrinderExtractedClaimSchema).default([]),
  conceptCandidates: z.array(MetagrinderConceptCandidateSchema).default([]),
  evidence: z.array(MetagrinderEvidenceSnippetSchema).default([]),
  openQuestions: z.array(MetagrinderOpenQuestionSchema).default([]),
  warnings: z.array(MetagrinderWarningSchema).default([])
});

export const MetagrinderClassifiedBucketSchema = z.object({
  bucketId: z.string(),
  label: z.string(),
  category: z.string(),
  conceptIds: z.array(z.string()).default([]),
  claimIds: z.array(z.string()).default([])
});

export const MetagrinderClassifyArtifactSchema = z.object({
  inputId: z.string(),
  collections: z.object({
    sourceMapChunkIds: z.array(z.string()).default([]),
    claimsAndEvidenceClaimIds: z.array(z.string()).default([]),
    conceptClusterBuckets: z.array(MetagrinderClassifiedBucketSchema).default([])
  })
});

export const MetagrinderPromptFragmentSchema = z.object({
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

export const MetagrinderSynthesizeArtifactSchema = z.object({
  inputId: z.string(),
  promptFragments: z.array(MetagrinderPromptFragmentSchema).default([])
});

export const MetagrinderMutationCompatibilityStatusSchema = z.enum([
  'compatible',
  'incompatible'
]);

export const MetagrinderMutationInputFragmentSchema = z.object({
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

export const MetagrinderMutationCompatibilityDecisionSchema = z.object({
  decisionId: z.string(),
  leftFragmentId: z.string(),
  rightFragmentId: z.string(),
  status: MetagrinderMutationCompatibilityStatusSchema,
  reasons: z.array(z.string()).min(1),
  sharedConceptIds: z.array(z.string()).default([]),
  sharedSourceInputIds: z.array(z.string()).default([])
});

export const MetagrinderPromptMutationVariantSchema = z.object({
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

export const MetagrinderMutationGenerationSummarySchema = z.object({
  maxVariants: z.number().int().positive(),
  compatiblePairCount: z.number().int().nonnegative(),
  incompatiblePairCount: z.number().int().nonnegative(),
  generatedVariantCount: z.number().int().nonnegative(),
  droppedDuplicateCount: z.number().int().nonnegative()
});

export const MetagrinderDroppedMutationVariantSchema = z.object({
  droppedVariantId: z.string(),
  text: z.string(),
  fragmentIds: z.array(z.string()).min(2),
  compatibilityDecisionIds: z.array(z.string()).min(1),
  reason: z.literal('duplicate-variant-text')
});

export const MetagrinderMutationArtifactSchema = z.object({
  inputId: z.string(),
  candidateFragments: z.array(MetagrinderMutationInputFragmentSchema).default([]),
  compatibilityDecisions: z.array(MetagrinderMutationCompatibilityDecisionSchema).default([]),
  variants: z.array(MetagrinderPromptMutationVariantSchema).default([]),
  droppedVariants: z.array(MetagrinderDroppedMutationVariantSchema).default([]),
  generationSummary: MetagrinderMutationGenerationSummarySchema
});

export const MetagrinderMutationReviewArtifactSchema = z.object({
  inputId: z.string(),
  promotableVariantIds: z.array(z.string()).default([]),
  flaggedVariantIds: z.array(z.string()).default([]),
  rejectedVariantIds: z.array(z.string()).default([]),
  duplicateVariantIds: z.array(z.string()).default([]),
  weakVariantIds: z.array(z.string()).default([]),
  incompatibilityWarnings: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([])
});

export const MetagrinderScoreArtifactSchema = z.object({
  inputId: z.string(),
  corroboratedConceptIds: z.array(z.string()).default([]),
  disputedConceptIds: z.array(z.string()).default([]),
  confidenceSummary: MetagrinderConfidenceSummarySchema,
  ambiguityFlags: z.array(z.string()).default([])
});

export const MetagrinderReviewArtifactSchema = z.object({
  inputId: z.string(),
  unresolvedAmbiguities: z.array(z.string()).default([]),
  corroboratedConceptIds: z.array(z.string()).default([]),
  overlapWarnings: z.array(z.string()).default([]),
  contradictionFlags: z.array(z.string()).default([]),
  missingProvenance: z.array(z.string()).default([]),
  weakConceptIds: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([])
});

export const ResearchPackageManifestSchema = z.object({
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

export const UtdgSubmissionManifestSchema = z.object({
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

export const UtdgCandidateNormalizationSchema = z.object({
  conceptType: z.string().optional(),
  externalIds: MetagrinderExternalIdsSchema.optional()
});

export const UtdgCandidateSchema = z.object({
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

export const UtdgCandidatesFileSchema = z.object({
  submissionId: z.string(),
  derivedFromPackageId: z.string(),
  candidates: z.array(UtdgCandidateSchema)
});

export const CanonicalUtdgRecordSchema = z.object({
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

export const SurfaceResponseProfileSchema = z.object({
  id: z.string(),
  entityType: z.literal('SurfaceResponseProfile'),
  baseMaterialRef: z.string(),
  modifierRef: z.string(),
  roughnessResponse: z.record(z.unknown()).optional(),
  darkeningResponse: z.record(z.unknown()).optional(),
  specularResponse: z.record(z.unknown()).optional(),
  streakBehavior: z.record(z.unknown()).optional(),
  poolingBehavior: z.record(z.unknown()).optional(),
  dryingBehavior: z.record(z.unknown()).optional(),
  confidence: MetagrinderConfidenceLevelSchema,
  evidenceRefs: z.array(z.string()).default([]),
  reviewStatus: MetagrinderReviewStatusSchema
});

export const EnvironmentalEffectControllerSchema = z.object({
  id: z.string(),
  entityType: z.literal('EnvironmentalEffectController'),
  effectType: z.string(),
  directionVector: z.array(z.number()).length(3).optional(),
  intensity: z.number().optional(),
  falloffModel: z.string().optional(),
  gravityInfluence: z.number().optional(),
  accumulationBias: z.number().optional(),
  evaporationRate: z.number().optional(),
  globalOverrides: z.record(z.unknown()).optional(),
  reviewStatus: MetagrinderReviewStatusSchema
});

export const InfluenceFieldSchema = z.object({
  id: z.string(),
  entityType: z.literal('InfluenceField'),
  fieldType: z.string(),
  carrier: z.enum([
    'vertex-color',
    'uv-mask',
    'texture-mask',
    'world-space-field',
    'procedural-field'
  ]),
  channel: z.string().optional(),
  strength: z.number().optional(),
  invert: z.boolean().optional(),
  resolutionClass: z.enum(['low', 'medium', 'high']).optional()
});

export const LocalizedMaterialIntentSchema = z.object({
  id: z.string(),
  entityType: z.literal('LocalizedMaterialIntent'),
  baseMaterialRef: z.string(),
  modifierRef: z.string(),
  spatialBindingRef: z.string(),
  renderIntent: z.string().optional(),
  parameterOverrides: z.record(z.unknown()).optional(),
  sourceRefs: z.array(z.string()).default([]),
  reviewStatus: MetagrinderReviewStatusSchema
});

export const LocalizedEnvironmentalIntentSchema = z.object({
  id: z.string(),
  entityType: z.literal('LocalizedEnvironmentalIntent'),
  baseMaterialRef: z.string(),
  effectControllerRef: z.string(),
  influenceFieldRef: z.string(),
  responseProfileRef: z.string(),
  localOverrides: z.record(z.unknown()).optional(),
  priority: z.number().optional(),
  reviewStatus: MetagrinderReviewStatusSchema
});

export const WorldPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export const WorldBoundsSchema = z.object({
  min: WorldPositionSchema,
  max: WorldPositionSchema
});

export const SemanticLineageSchema = z.object({
  packageId: z.string().optional(),
  sourceInputIds: z.array(z.string()).default([]),
  derivedFromIds: z.array(z.string()).default([])
});

export const SemanticLodOverrideSchema = z.object({
  minLod: z.enum(['lod0', 'lod1', 'lod2']).optional(),
  preserveHeroDetailsAboveNarrativeWeight: z.number().optional(),
  forceIncludeInWideShots: z.boolean().optional()
});

export const BaseWorldSemanticRecordSchema = z.object({
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

export const SemanticPointSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticPoint'),
  worldPosition: WorldPositionSchema,
  worldNormal: WorldPositionSchema.optional(),
  influenceRadius: z.number().optional(),
  falloff: z.string().optional()
});

export const SemanticSplatSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticSplat'),
  worldPosition: WorldPositionSchema,
  orientation: WorldPositionSchema.optional(),
  radius: z.number().optional(),
  anisotropy: z.number().optional(),
  falloff: z.string().optional(),
  influenceWeight: z.number().optional()
});

export const SemanticRegionSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticRegion'),
  bounds: WorldBoundsSchema,
  surfaceClass: z.string().optional()
});

export const SemanticVolumeSchema = BaseWorldSemanticRecordSchema.extend({
  recordType: z.literal('SemanticVolume'),
  bounds: WorldBoundsSchema,
  volumeType: z.string().optional()
});

export const WorldSemanticRecordSchema = z.discriminatedUnion('recordType', [
  SemanticPointSchema,
  SemanticSplatSchema,
  SemanticRegionSchema,
  SemanticVolumeSchema
]);

export const WorldSemanticFieldSchema = z.object({
  fieldId: z.string(),
  packageId: z.string().optional(),
  coordinateSpace: z.enum(['world']).default('world'),
  records: z.array(WorldSemanticRecordSchema)
});

export const PromptAlignmentRecordSchema = z.object({
  promptToken: z.string(),
  matchedRegionRefs: z.array(z.string()).default([]),
  matchedObjectRefs: z.array(z.string()).default([]),
  status: z.enum(['present', 'partial', 'absent', 'inferred']),
  confidence: MetagrinderConfidenceLevelSchema
});

export const SceneRegionRecordSchema = z.object({
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

export const ObjectHypothesisRecordSchema = z.object({
  objectId: z.string(),
  label: z.string(),
  regionRefs: z.array(z.string()).default([]),
  materialRefs: z.array(z.string()).default([]),
  promptRefs: z.array(z.string()).default([]),
  utdgRefs: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema
});

export const SemanticScenePackageSchema = z.object({
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

export const PromptGraphLoDPolicySchema = z.object({
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

export const PromptGraphTextVariantsSchema = z.object({
  lod0: z.array(z.string()).default([]),
  lod1: z.array(z.string()).default([]),
  lod2: z.array(z.string()).default([])
});

export const PromptGraphNodeSchema = z.object({
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

export const PromptGraphEdgeSchema = z.object({
  edgeId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  relationship: z.enum(['modifies', 'depends-on', 'context-for', 'inherits-from'])
});

export const PromptGraphManifestSchema = z.object({
  graphId: z.string(),
  packageId: z.string().optional(),
  title: z.string(),
  lodPolicyRef: z.string().optional(),
  nodes: z.array(PromptGraphNodeSchema),
  edges: z.array(PromptGraphEdgeSchema).default([])
});

export const PacketAttributionEntrySchema = z.object({
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

export const PacketAttributionManifestSchema = z.object({
  packetId: z.string(),
  cameraId: z.string(),
  entries: z.array(PacketAttributionEntrySchema)
});

export const GraphMatchReportEntrySchema = z.object({
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

export const GraphMatchReportSchema = z.object({
  graphId: z.string(),
  cameraId: z.string(),
  packetId: z.string(),
  entries: z.array(GraphMatchReportEntrySchema)
});

export const SuppressedGraphNodeEntrySchema = z.object({
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

export const SuppressedGraphNodesReportSchema = z.object({
  graphId: z.string(),
  cameraId: z.string(),
  packetId: z.string(),
  entries: z.array(SuppressedGraphNodeEntrySchema)
});

export const PatchProposalSchema = z.object({
  proposalId: z.string(),
  packageId: z.string(),
  targetType: z.enum(['wall-continuation', 'surface-extension', 'environment-extension']),
  targetRefs: z.array(z.string()).default([]),
  proposedSemanticRefs: z.array(z.string()).default([]),
  rationale: z.array(z.string()).default([]),
  confidence: MetagrinderConfidenceLevelSchema,
  reviewStatus: MetagrinderReviewStatusSchema
});

export const WitnessRenderManifestSchema = z.object({
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

export const RenderTextPacketSchema = z.object({
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

export const CameraQueryContractSchema = z.object({
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

export const CameraPassManifestSchema = z.object({
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

export const ModelConditioningPayloadSchema = z.object({
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

export const LumaAdapterContractSchema = z.object({
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

export const MetaballManifestSchema = z.object({
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
  promptGraphLodPolicy: PromptGraphLoDPolicySchema.optional(),
  metadata: z.object({
    description: z.string().optional(),
    createdAt: z.string().datetime().optional()
  }).optional()
});

export type MetagrinderReviewStatus = z.infer<
  typeof MetagrinderReviewStatusSchema
>;
export type MetagrinderConfidenceLevel = z.infer<
  typeof MetagrinderConfidenceLevelSchema
>;
export type MetagrinderRightsProfile = z.infer<
  typeof MetagrinderRightsProfileSchema
>;
export type ResearchPackageManifest = z.infer<
  typeof ResearchPackageManifestSchema
>;
export type MetagrinderSourceType = z.infer<typeof MetagrinderSourceTypeSchema>;
export type MetagrinderResearchKind = z.infer<typeof MetagrinderResearchKindSchema>;
export type MetagrinderChunkKind = z.infer<typeof MetagrinderChunkKindSchema>;
export type MetagrinderSourceInput = z.infer<typeof MetagrinderSourceInputSchema>;
export type MetagrinderIngestChunk = z.infer<typeof MetagrinderIngestChunkSchema>;
export type MetagrinderIngestArtifact = z.infer<typeof MetagrinderIngestArtifactSchema>;
export type MetagrinderModeDetectionArtifact = z.infer<typeof MetagrinderModeDetectionArtifactSchema>;
export type MetagrinderCategoryPriority = z.infer<typeof MetagrinderCategoryPrioritySchema>;
export type MetagrinderCategoryHypothesisEntry = z.infer<typeof MetagrinderCategoryHypothesisEntrySchema>;
export type MetagrinderCategoryHypothesisArtifact = z.infer<typeof MetagrinderCategoryHypothesisArtifactSchema>;
export type MetagrinderReviewDecisionOption = z.infer<typeof MetagrinderReviewDecisionOptionSchema>;
export type MetagrinderAssumptionReviewArtifact = z.infer<typeof MetagrinderAssumptionReviewArtifactSchema>;
export type MetagrinderAugmentationPlanArtifact = z.infer<typeof MetagrinderAugmentationPlanArtifactSchema>;
export type MetagrinderExtractedClaim = z.infer<typeof MetagrinderExtractedClaimSchema>;
export type MetagrinderConceptCandidate = z.infer<typeof MetagrinderConceptCandidateSchema>;
export type MetagrinderEvidenceSnippet = z.infer<typeof MetagrinderEvidenceSnippetSchema>;
export type MetagrinderOpenQuestion = z.infer<typeof MetagrinderOpenQuestionSchema>;
export type MetagrinderWarning = z.infer<typeof MetagrinderWarningSchema>;
export type MetagrinderExtractArtifact = z.infer<typeof MetagrinderExtractArtifactSchema>;
export type MetagrinderClassifiedBucket = z.infer<typeof MetagrinderClassifiedBucketSchema>;
export type MetagrinderClassifyArtifact = z.infer<typeof MetagrinderClassifyArtifactSchema>;
export type MetagrinderPromptFragment = z.infer<typeof MetagrinderPromptFragmentSchema>;
export type MetagrinderSynthesizeArtifact = z.infer<typeof MetagrinderSynthesizeArtifactSchema>;
export type MetagrinderMutationCompatibilityStatus = z.infer<
  typeof MetagrinderMutationCompatibilityStatusSchema
>;
export type MetagrinderMutationInputFragment = z.infer<
  typeof MetagrinderMutationInputFragmentSchema
>;
export type MetagrinderMutationCompatibilityDecision = z.infer<
  typeof MetagrinderMutationCompatibilityDecisionSchema
>;
export type MetagrinderPromptMutationVariant = z.infer<
  typeof MetagrinderPromptMutationVariantSchema
>;
export type MetagrinderMutationGenerationSummary = z.infer<
  typeof MetagrinderMutationGenerationSummarySchema
>;
export type MetagrinderMutationArtifact = z.infer<
  typeof MetagrinderMutationArtifactSchema
>;
export type MetagrinderMutationReviewArtifact = z.infer<
  typeof MetagrinderMutationReviewArtifactSchema
>;
export type MetagrinderScoreArtifact = z.infer<typeof MetagrinderScoreArtifactSchema>;
export type MetagrinderReviewArtifact = z.infer<typeof MetagrinderReviewArtifactSchema>;
export type UtdgSubmissionManifest = z.infer<
  typeof UtdgSubmissionManifestSchema
>;
export type UtdgCandidate = z.infer<typeof UtdgCandidateSchema>;
export type UtdgCandidatesFile = z.infer<typeof UtdgCandidatesFileSchema>;
export type CanonicalUtdgRecord = z.infer<typeof CanonicalUtdgRecordSchema>;
export type SurfaceResponseProfile = z.infer<
  typeof SurfaceResponseProfileSchema
>;
export type EnvironmentalEffectController = z.infer<
  typeof EnvironmentalEffectControllerSchema
>;
export type InfluenceField = z.infer<typeof InfluenceFieldSchema>;
export type LocalizedMaterialIntent = z.infer<
  typeof LocalizedMaterialIntentSchema
>;
export type LocalizedEnvironmentalIntent = z.infer<
  typeof LocalizedEnvironmentalIntentSchema
>;
export type WorldPosition = z.infer<typeof WorldPositionSchema>;
export type WorldBounds = z.infer<typeof WorldBoundsSchema>;
export type SemanticLodOverride = z.infer<typeof SemanticLodOverrideSchema>;
export type SemanticPoint = z.infer<typeof SemanticPointSchema>;
export type SemanticSplat = z.infer<typeof SemanticSplatSchema>;
export type SemanticRegion = z.infer<typeof SemanticRegionSchema>;
export type SemanticVolume = z.infer<typeof SemanticVolumeSchema>;
export type WorldSemanticRecord = z.infer<typeof WorldSemanticRecordSchema>;
export type WorldSemanticField = z.infer<typeof WorldSemanticFieldSchema>;
export type PromptAlignmentRecord = z.infer<typeof PromptAlignmentRecordSchema>;
export type SceneRegionRecord = z.infer<typeof SceneRegionRecordSchema>;
export type ObjectHypothesisRecord = z.infer<typeof ObjectHypothesisRecordSchema>;
export type SemanticScenePackage = z.infer<typeof SemanticScenePackageSchema>;
export type PromptGraphLoDPolicy = z.infer<typeof PromptGraphLoDPolicySchema>;
export type PromptGraphTextVariants = z.infer<typeof PromptGraphTextVariantsSchema>;
export type PromptGraphNode = z.infer<typeof PromptGraphNodeSchema>;
export type PromptGraphEdge = z.infer<typeof PromptGraphEdgeSchema>;
export type PromptGraphManifest = z.infer<typeof PromptGraphManifestSchema>;
export type PacketAttributionEntry = z.infer<typeof PacketAttributionEntrySchema>;
export type PacketAttributionManifest = z.infer<typeof PacketAttributionManifestSchema>;
export type GraphMatchReportEntry = z.infer<typeof GraphMatchReportEntrySchema>;
export type GraphMatchReport = z.infer<typeof GraphMatchReportSchema>;
export type SuppressedGraphNodeEntry = z.infer<typeof SuppressedGraphNodeEntrySchema>;
export type SuppressedGraphNodesReport = z.infer<typeof SuppressedGraphNodesReportSchema>;
export type PatchProposal = z.infer<typeof PatchProposalSchema>;
export type WitnessRenderManifest = z.infer<typeof WitnessRenderManifestSchema>;
export type RenderTextPacket = z.infer<typeof RenderTextPacketSchema>;
export type CameraQueryContract = z.infer<typeof CameraQueryContractSchema>;
export type CameraPassManifest = z.infer<typeof CameraPassManifestSchema>;
export type ModelConditioningPayload = z.infer<
  typeof ModelConditioningPayloadSchema
>;
export type LumaAdapterContract = z.infer<typeof LumaAdapterContractSchema>;
export type MetaballManifest = z.infer<typeof MetaballManifestSchema>;

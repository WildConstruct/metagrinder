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
  'unknown',
  'public-domain',
  'unrestricted',
  'attribution-required',
  'non-commercial',
  'reference-only',
  'restricted'
]);

const MetagrinderCollectionTypeSchema = z.enum([
  'source-map',
  'photo-observations',
  'color-hypotheses',
  'claims-and-evidence',
  'concept-clusters',
  'prompt-synthesis',
  'prompt-mutations',
  'structured-brief',
  'structured-brief-seed',
  'brief-analysis',
  'semantic-choice-graph',
  'psg-output-flight',
  'psg-readability-review',
  'codex-sweeten-request',
  'codex-sweeten-request-markdown',
  'codex-sweeten-result',
  'codex-sweeten-run-log',
  'codex-sweeten-run-status',
  'codex-parse-request',
  'codex-parse-request-markdown',
  'codex-parse-output-schema',
  'codex-parse-result',
  'scene-grammar',
  'research-gaps',
  'sample-prompts',
  'scene-grammar-evaluation',
  'plausibility-review',
  'scene-grammar-psg',
  'grammar-revisions',
  'accepted-grammar-revisions',
  'rejected-grammar-revisions',
  'source-registry',
  'source-claims',
  'source-evidence',
  'source-claim-review',
  'accepted-scene-grammar',
  'revision-state',
  'revision-state-applied',
  'revision-review',
  'accepted-grammar-deltas',
  'operator-review',
  'psg-compile-diff',
  'live-retrieval-readiness',
  'live-provider-pilot-report',
  'real-endpoint-proof-report',
  'candidate-inspection',
  'candidate-inspection-markdown',
  'live-retrieval-preflight',
  'live-retrieval-requests',
  'live-retrieval-cache-write',
  'live-provider-contract',
  'provider-config-applied',
  'provider-preflight-report',
  'provider-request-shapes',
  'provider-response-log',
  'source-typing-report',
  'provider-error-report',
  'retrieval-policy',
  'retrieval-run-log',
  'retrieval-candidates',
  'retrieval-cache-manifest',
  'source-intake-approval',
  'approved-source-results',
  'retrieval-safety-report',
  'branch-graph'
]);

const MetagrinderEntityTypeSchema = z.enum([
  'Concept',
  'Archetype',
  'SourceRecordReference',
  'ColorHypothesis',
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
  'research-brief',
  'photo-reference'
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
  'photo-observation',
  'color-hypothesis',
  'wardrobe-observation',
  'concept-list',
  'generation-rule',
  'generation-palette',
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

const MetagrinderHistoricalPhotoClaimSchema = z.object({
  claim: z.string(),
  confidence: MetagrinderConfidenceLevelSchema,
  basis: z.string()
}).passthrough();

const MetagrinderHistoricalPhotoColorHypothesisClaimSchema = z.object({
  target: z.string(),
  candidateColors: z.array(z.string()).min(1),
  confidence: MetagrinderConfidenceLevelSchema,
  basis: z.array(z.string()).default([]),
  externalSourceRefs: z.array(z.string()).default([]),
  notEvidenceFor: z.array(z.string()).default([]),
  downstreamRefs: z.object({
    metagrinder: z.string(),
    utdgCandidate: z.string(),
    eracrowdRoute: z.string()
  })
}).passthrough().superRefine((claim, ctx) => {
  if (!claim.notEvidenceFor.includes('canonical UTDG color')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['notEvidenceFor'],
      message: 'Color hypotheses must not be evidence for canonical UTDG color.'
    });
  }
});

const MetagrinderHistoricalPhotoGenerationPaletteSchema = z.object({
  target: z.string(),
  palette: z.array(z.string()).min(1),
  confidence: MetagrinderConfidenceLevelSchema,
  evidenceGuardrail: z.string()
}).superRefine((palette, ctx) => {
  if (!palette.evidenceGuardrail.toLowerCase().includes('not source evidence')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidenceGuardrail'],
      message: 'Generation palettes must state they are not source evidence.'
    });
  }
});

const MetagrinderHistoricalPhotoColorHypothesisSchema = z.object({
  photoProcessHypothesis: z.array(MetagrinderHistoricalPhotoClaimSchema).min(1),
  tonalEvidence: z.array(z.object({
    target: z.string(),
    claim: z.string(),
    confidence: MetagrinderConfidenceLevelSchema,
    basis: z.string()
  }).passthrough()).min(1),
  historicalColorPriors: z.array(z.object({
    target: z.string(),
    candidateColors: z.array(z.string()).min(1),
    confidence: MetagrinderConfidenceLevelSchema,
    basis: z.string(),
    sourcesNeeded: z.array(z.string()).min(1)
  }).passthrough()).default([]),
  colorHypotheses: z.array(MetagrinderHistoricalPhotoColorHypothesisClaimSchema).min(1),
  generationPalette: z.array(MetagrinderHistoricalPhotoGenerationPaletteSchema).min(1),
  researchNeeds: z.array(z.record(z.unknown())).default([]),
  evidenceBoundary: z.array(z.string()).min(1)
}).superRefine((hypothesis, ctx) => {
  const boundary = hypothesis.evidenceBoundary.join(' ').toLowerCase();
  if (!boundary.includes('source evidence')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidenceBoundary'],
      message: 'Color hypothesis evidence boundary must mention source evidence.'
    });
  }
});

const MetagrinderHistoricalPhotoObservationSchema = z.object({
  observationVersion: z.string(),
  recordId: z.string(),
  source: z.object({
    sourceId: z.string(),
    sourcePath: z.string(),
    caption: z.string().optional(),
    eraRange: z.array(z.number().int()).length(2),
    event: z.string(),
    location: z.string().optional(),
    imageMode: z.enum(['color_photo', 'black_and_white_photo', 'sepia_photo', 'unknown']),
    rightsBoundary: z.string(),
    sourceConfidence: MetagrinderConfidenceLevelSchema.optional()
  }).passthrough(),
  photoIntake: z.record(z.unknown()),
  observed: z.record(z.unknown()),
  inferred: z.object({
    claims: z.array(MetagrinderHistoricalPhotoClaimSchema).default([]),
    researchNeeds: z.array(z.record(z.unknown())).default([])
  }).passthrough(),
  unknown: z.record(z.unknown()),
  generatedCandidateUse: z.object({
    allowed: z.array(z.string()).default([]),
    notAllowed: z.array(z.string()).default([]),
    recipeRoutes: z.array(z.object({
      routeId: z.string(),
      purpose: z.string(),
      evidenceGuardrail: z.string()
    }).passthrough()).default([])
  }).passthrough(),
  colorHypothesis: MetagrinderHistoricalPhotoColorHypothesisSchema,
  confidenceSummary: z.record(z.unknown()),
  downstream: z.object({
    metagrinderFragments: z.array(z.record(z.unknown())).default([]),
    utdgCandidates: z.array(z.record(z.unknown())).default([]),
    eracrowdHandoff: z.array(z.record(z.unknown())).default([])
  }).passthrough()
}).superRefine((photo, ctx) => {
  if (photo.source.imageMode === 'black_and_white_photo' || photo.source.imageMode === 'sepia_photo') {
    photo.colorHypothesis.colorHypotheses.forEach((claim, index) => {
      if (claim.confidence === 'high' && claim.externalSourceRefs.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['colorHypothesis', 'colorHypotheses', index, 'confidence'],
          message: 'High-confidence B&W color hypotheses require external source refs.'
        });
      }
    });
  }
});

const MetagrinderHistoricalPhotoObservationArtifactSchema = z.object({
  inputId: z.string(),
  packageId: z.string(),
  photos: z.array(MetagrinderHistoricalPhotoObservationSchema).min(1)
});

const MetagrinderColorHypothesisArtifactSchema = z.object({
  inputId: z.string(),
  packageId: z.string(),
  records: z.array(z.object({
    recordId: z.string(),
    sourceInputId: z.string(),
    imageMode: z.string(),
    colorHypothesis: MetagrinderHistoricalPhotoColorHypothesisSchema
  })).min(1)
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

const MetagrinderStructuredBriefProvenanceSchema = z.object({
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  excerptText: z.string(),
  attributionMode: MetagrinderAttributionModeSchema,
  confidence: MetagrinderConfidenceLevelSchema
});

const MetagrinderStructuredBriefEntitySchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  entityId: z.string(),
  label: z.string(),
  entityKind: z.enum(['concept', 'archetype', 'specimen', 'role', 'zone-or-context', 'schema-field-set']).default('concept'),
  summary: z.string(),
  attributeRefs: z.array(z.string()).default([]),
  weightRefs: z.array(z.string()).default([]),
  ruleRefs: z.array(z.string()).default([])
});

const MetagrinderStructuredBriefWeightSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  weightId: z.string(),
  label: z.string(),
  min: z.number().min(0),
  max: z.number().min(0),
  unit: z.enum(['percent', 'weight']).default('percent'),
  appliesTo: z.string().optional()
}).refine((value) => value.max >= value.min, {
  message: 'structured brief weight max must be greater than or equal to min'
});

const MetagrinderStructuredBriefAttributeClusterSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  clusterId: z.string(),
  label: z.string(),
  category: z.enum(['wardrobe-or-attribute', 'behavior', 'modifier', 'implementation', 'other']).default('other'),
  items: z.array(z.string()).default([])
});

const MetagrinderStructuredBriefRuleSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  ruleId: z.string(),
  label: z.string(),
  conditionText: z.string(),
  effects: z.array(z.object({
    action: z.string(),
    target: z.string()
  })).default([])
});

const MetagrinderStructuredBriefConstraintSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  constraintId: z.string(),
  label: z.string(),
  constraintType: z.enum(['negative', 'ethical', 'compatibility', 'safety']).default('negative'),
  text: z.string()
});

const MetagrinderStructuredBriefContextSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  contextId: z.string(),
  label: z.string(),
  contextKind: z.enum(['location-zone', 'context', 'section']).default('context'),
  description: z.string(),
  weightRefs: z.array(z.string()).default([]),
  ruleRefs: z.array(z.string()).default([])
});

const MetagrinderStructuredBriefModifierSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  modifierId: z.string(),
  label: z.string(),
  modifierType: z.string(),
  text: z.string()
});

const MetagrinderStructuredBriefExampleSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  exampleId: z.string(),
  label: z.string(),
  exampleType: z.enum(['prompt', 'specimen', 'example']).default('example'),
  text: z.string()
});

const MetagrinderStructuredBriefFieldSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  fieldId: z.string(),
  name: z.string(),
  label: z.string(),
  valueHint: z.string().optional()
});

const MetagrinderStructuredBriefCitationSchema = MetagrinderStructuredBriefProvenanceSchema.extend({
  citationId: z.string(),
  label: z.string(),
  url: z.string().optional(),
  citationText: z.string(),
  verificationStatus: z.enum(['unverified-pasted-citation', 'reviewed', 'retrieved']).default('unverified-pasted-citation')
});

const MetagrinderStructuredBriefCoverageSchema = z.object({
  category: z.string(),
  status: z.enum(['extracted', 'partial', 'not_found', 'ignored']).default('not_found'),
  count: z.number().int().nonnegative(),
  note: z.string().optional()
});

const MetagrinderBriefAnalysisValidationStatusSchema = z.enum([
  'supported',
  'weak',
  'contradicted',
  'needs_review',
  'seed_unverified',
  'ignored'
]);

const MetagrinderBriefAnalysisProvenanceSchema = z.object({
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  excerptText: z.string().default(''),
  attributionMode: MetagrinderAttributionModeSchema,
  confidence: MetagrinderConfidenceLevelSchema,
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
});

const MetagrinderBriefMainSubjectSchema = MetagrinderBriefAnalysisProvenanceSchema.extend({
  subjectId: z.string(),
  label: z.string(),
  subjectType: z.string().default('brief'),
  summary: z.string()
});

const MetagrinderBriefSubcategoryCandidateSchema = MetagrinderBriefAnalysisProvenanceSchema.extend({
  subcategoryId: z.string(),
  label: z.string(),
  parentSubjectId: z.string(),
  supportStatus: z.enum(['supported', 'weak', 'contradicted', 'inferred']).default('weak'),
  evidenceSummary: z.string().default('')
});

const MetagrinderBriefSubcategoryEvidenceCheckSchema = MetagrinderBriefAnalysisProvenanceSchema.extend({
  checkId: z.string(),
  subcategoryId: z.string(),
  supportStatus: z.enum(['supported', 'weak', 'contradicted', 'inferred']).default('weak'),
  supportingExcerptIds: z.array(z.string()).default([]),
  contradictingExcerptIds: z.array(z.string()).default([]),
  assessment: z.string().default('')
});

const MetagrinderBriefSubcategoryCharacteristicSchema = MetagrinderBriefAnalysisProvenanceSchema.extend({
  characteristicId: z.string(),
  subcategoryId: z.string().optional(),
  label: z.string(),
  characteristicType: z.string().default('attribute'),
  values: z.array(z.string()).default([])
});

const MetagrinderBriefAnalysisWeightSchema = MetagrinderBriefAnalysisProvenanceSchema.extend({
  weightId: z.string(),
  label: z.string(),
  min: z.number().min(0),
  max: z.number().min(0),
  unit: z.enum(['percent', 'weight']).default('percent'),
  appliesTo: z.string().optional(),
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
}).refine((value) => value.max >= value.min, {
  message: 'brief analysis weight max must be greater than or equal to min'
});

const MetagrinderBriefAnalysisRuleSchema = MetagrinderStructuredBriefRuleSchema.extend({
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
});

const MetagrinderBriefAnalysisConstraintSchema = MetagrinderStructuredBriefConstraintSchema.extend({
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
});

const MetagrinderBriefAnalysisExampleSchema = MetagrinderStructuredBriefExampleSchema.extend({
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
});

const MetagrinderBriefAnalysisFieldSchema = MetagrinderStructuredBriefFieldSchema.extend({
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
});

const MetagrinderBriefAnalysisCitationSchema = MetagrinderStructuredBriefCitationSchema.extend({
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review')
});

const MetagrinderBriefAnalysisResearchGapSchema = MetagrinderBriefAnalysisProvenanceSchema.extend({
  gapId: z.string(),
  label: z.string(),
  reason: z.string(),
  recommendedAction: z.string().default('review-or-research')
});

const MetagrinderBriefAnalysisGraphAssemblyPlanSchema = z.object({
  readiness: z.enum(['ready', 'needs_codex_review', 'not_ready']).default('needs_codex_review'),
  nodes: z.array(z.object({
    nodeId: z.string(),
    label: z.string(),
    nodeType: z.string(),
    sourceRecordIds: z.array(z.string()).default([]),
    reviewStatus: z.string().default('needs_review')
  })).default([]),
  edges: z.array(z.object({
    edgeId: z.string(),
    source: z.string(),
    target: z.string(),
    relation: z.string()
  })).default([]),
  notes: z.array(z.string()).default([])
});

const MetagrinderBriefAnalysisArtifactSchema = z.object({
  inputId: z.string(),
  analysisMode: z.enum(['seed-only', 'codex-semantic', 'codex-imported']).default('seed-only'),
  sourceInputIds: z.array(z.string()).default([]),
  mainSubject: MetagrinderBriefMainSubjectSchema,
  subjectType: z.string().default('brief'),
  subcategoryCandidates: z.array(MetagrinderBriefSubcategoryCandidateSchema).default([]),
  subcategoryEvidenceChecks: z.array(MetagrinderBriefSubcategoryEvidenceCheckSchema).default([]),
  subcategoryCharacteristics: z.array(MetagrinderBriefSubcategoryCharacteristicSchema).default([]),
  weightedGroups: z.array(MetagrinderBriefAnalysisWeightSchema).default([]),
  rules: z.array(MetagrinderBriefAnalysisRuleSchema).default([]),
  constraints: z.array(MetagrinderBriefAnalysisConstraintSchema).default([]),
  examples: z.array(MetagrinderBriefAnalysisExampleSchema).default([]),
  implementationFields: z.array(MetagrinderBriefAnalysisFieldSchema).default([]),
  citations: z.array(MetagrinderBriefAnalysisCitationSchema).default([]),
  researchGaps: z.array(MetagrinderBriefAnalysisResearchGapSchema).default([]),
  graphAssemblyPlan: MetagrinderBriefAnalysisGraphAssemblyPlanSchema,
  coverage: z.array(MetagrinderStructuredBriefCoverageSchema).default([])
});

const MetagrinderSemanticChoiceGraphConditionSchema = z.object({
  choiceId: z.string(),
  text: z.string(),
  weight: z.number().default(1)
});

const MetagrinderSemanticChoiceGraphChoiceSchema = z.object({
  choiceId: z.string(),
  text: z.string(),
  weight: z.number().default(1),
  appliesWhen: z.array(MetagrinderSemanticChoiceGraphConditionSchema).default([]),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  excerptText: z.string().default(''),
  confidence: MetagrinderConfidenceLevelSchema.default('medium'),
  attributionMode: MetagrinderAttributionModeSchema.default('inferred'),
  validationStatus: MetagrinderBriefAnalysisValidationStatusSchema.default('needs_review'),
  evidenceStatus: z.string().default('extracted-from-text'),
  projectionSource: z.enum(['codex', 'inferred', 'fallback']).default('inferred')
});

const MetagrinderSemanticChoiceGraphAxisSchema = z.object({
  axisId: z.string(),
  label: z.string(),
  axisType: z.string(),
  order: z.number().int().nonnegative(),
  appliesWhen: z.array(MetagrinderSemanticChoiceGraphConditionSchema).default([]),
  choices: z.array(MetagrinderSemanticChoiceGraphChoiceSchema).default([])
});

const MetagrinderSemanticChoiceGraphEdgeSchema = z.object({
  edgeId: z.string(),
  sourceAxisId: z.string(),
  sourceChoiceId: z.string().optional(),
  targetAxisId: z.string(),
  relation: z.enum(['linear', 'branch', 'conditional']).default('linear')
});

const MetagrinderSemanticChoiceGraphWarningSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']).default('warning'),
  message: z.string(),
  relatedAxisIds: z.array(z.string()).default([]),
  relatedChoiceIds: z.array(z.string()).default([])
});

const MetagrinderSemanticChoiceGraphArtifactSchema = z.object({
  inputId: z.string(),
  analysisMode: z.enum(['seed-only', 'codex-semantic', 'codex-imported']).default('seed-only'),
  subject: z.object({
    label: z.string(),
    subjectType: z.string().default('brief'),
    summary: z.string().default('')
  }),
  sourceArtifacts: z.array(z.string()).default([]),
  axes: z.array(MetagrinderSemanticChoiceGraphAxisSchema).default([]),
  edges: z.array(MetagrinderSemanticChoiceGraphEdgeSchema).default([]),
  warnings: z.array(MetagrinderSemanticChoiceGraphWarningSchema).default([]),
  coverage: z.array(MetagrinderStructuredBriefCoverageSchema).default([]),
  graphAssemblyPlan: MetagrinderBriefAnalysisGraphAssemblyPlanSchema.optional()
});

const MetagrinderPsgOutputFlightSelectedChoiceSchema = z.object({
  axisId: z.string(),
  axisLabel: z.string().default(''),
  choiceId: z.string(),
  text: z.string(),
  weight: z.number().default(1)
});

const MetagrinderPsgOutputFlightSampleSchema = z.object({
  seed: z.number(),
  outputText: z.string(),
  selectedChoices: z.array(MetagrinderPsgOutputFlightSelectedChoiceSchema).default([])
});

const MetagrinderPsgOutputFlightArtifactSchema = z.object({
  inputId: z.string(),
  artifactType: z.literal('psg-output-flight').default('psg-output-flight'),
  createdAt: z.string(),
  graphPath: z.string(),
  graphHash: z.string(),
  semanticChoiceGraphHash: z.string(),
  sampleCount: z.number().int().positive(),
  seeds: z.array(z.number()).default([]),
  samples: z.array(MetagrinderPsgOutputFlightSampleSchema).default([])
});

const MetagrinderPsgReadabilityFindingSchema = z.object({
  findingId: z.string(),
  severity: z.enum(['info', 'warning', 'error']).default('warning'),
  findingType: z.string(),
  choiceId: z.string().nullable().default(null),
  axisId: z.string().nullable().default(null),
  sampleSeed: z.number().nullable().default(null),
  text: z.string().default(''),
  message: z.string()
});

const MetagrinderPsgReadabilityReviewArtifactSchema = z.object({
  inputId: z.string(),
  artifactType: z.literal('psg-readability-review').default('psg-readability-review'),
  createdAt: z.string(),
  graphPath: z.string(),
  graphHash: z.string(),
  semanticChoiceGraphHash: z.string(),
  sampleCount: z.number().int().nonnegative(),
  readabilityStatus: z.enum(['missing', 'flight-ready', 'review-running', 'needs-sweetening', 'sweetened', 'failed']).default('missing'),
  codexStatus: z.string().default('not-run'),
  appliedRewriteCount: z.number().int().nonnegative().default(0),
  findingCounts: z.record(z.number()).default({}),
  findings: z.array(MetagrinderPsgReadabilityFindingSchema).default([])
});

const MetagrinderCodexSweetenRewriteSchema = z.object({
  choiceId: z.string(),
  beforeText: z.string(),
  afterText: z.string(),
  reason: z.string().default('')
});

const MetagrinderCodexSweetenRequestArtifactSchema = z.object({
  inputId: z.string(),
  artifactType: z.literal('codex-sweeten-request').default('codex-sweeten-request'),
  createdAt: z.string(),
  expectedOutputPath: z.string().default('codex-sweeten-result.json'),
  strictRules: z.array(z.string()).default([]),
  graphPath: z.string(),
  graphHash: z.string(),
  semanticChoiceGraphHash: z.string(),
  samples: z.array(MetagrinderPsgOutputFlightSampleSchema).default([]),
  findings: z.array(MetagrinderPsgReadabilityFindingSchema).default([]),
  choices: z.array(z.object({
    axisId: z.string(),
    axisLabel: z.string(),
    choiceId: z.string(),
    text: z.string(),
    weight: z.number().default(1)
  })).default([])
});

const MetagrinderCodexSweetenResultArtifactSchema = z.object({
  inputId: z.string().optional(),
  rewrites: z.array(MetagrinderCodexSweetenRewriteSchema).default([])
});

const MetagrinderCodexParseRequestArtifactSchema = z.object({
  inputId: z.string(),
  requestVersion: z.string(),
  taskTitle: z.string(),
  instructions: z.array(z.string()).default([]),
  sourceInputs: z.array(z.object({
    sourceInputId: z.string(),
    title: z.string(),
    path: z.string().optional()
  })).default([]),
  chunks: z.array(z.object({
    chunkId: z.string(),
    sourceInputId: z.string(),
    sectionLabel: z.string().default(''),
    text: z.string()
  })).default([]),
  seedArtifactPath: z.string(),
  outputContractPath: z.string(),
  expectedOutputPath: z.string(),
  seedSummary: z.record(z.number()).default({})
});

const MetagrinderCodexParseOutputSchemaArtifactSchema = z.object({
  inputId: z.string(),
  schemaVersion: z.string(),
  artifactName: z.string(),
  requiredTopLevelFields: z.array(z.string()).default([]),
  provenanceRequiredFields: z.array(z.string()).default([]),
  jsonSchema: z.record(z.any()).default({}),
  notes: z.array(z.string()).default([]),
  exampleRecordShape: z.record(z.any()).default({})
});

const MetagrinderCodexParseResultArtifactSchema = MetagrinderBriefAnalysisArtifactSchema.extend({
  analysisMode: z.enum(['codex-semantic', 'codex-imported']).default('codex-semantic')
});

const MetagrinderStructuredBriefArtifactSchema = z.object({
  inputId: z.string(),
  sourceInputIds: z.array(z.string()).default([]),
  entities: z.array(MetagrinderStructuredBriefEntitySchema).default([]),
  weightedGroups: z.array(MetagrinderStructuredBriefWeightSchema).default([]),
  attributeClusters: z.array(MetagrinderStructuredBriefAttributeClusterSchema).default([]),
  rules: z.array(MetagrinderStructuredBriefRuleSchema).default([]),
  constraints: z.array(MetagrinderStructuredBriefConstraintSchema).default([]),
  zonesOrContexts: z.array(MetagrinderStructuredBriefContextSchema).default([]),
  modifiers: z.array(MetagrinderStructuredBriefModifierSchema).default([]),
  examples: z.array(MetagrinderStructuredBriefExampleSchema).default([]),
  implementationFields: z.array(MetagrinderStructuredBriefFieldSchema).default([]),
  citations: z.array(MetagrinderStructuredBriefCitationSchema).default([]),
  openQuestions: z.array(z.object({
    questionId: z.string(),
    text: z.string(),
    sourceInputIds: z.array(z.string()).default([]),
    sourceChunkIds: z.array(z.string()).default([]),
    excerptText: z.string(),
    attributionMode: MetagrinderAttributionModeSchema,
    confidence: MetagrinderConfidenceLevelSchema
  })).default([]),
  coverage: z.array(MetagrinderStructuredBriefCoverageSchema).default([])
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

const MetagrinderResearchSourceTypeSchema = z.enum([
  'archive',
  'museum',
  'library',
  'scholarly',
  'newspaper',
  'high-quality-secondary',
  'low-quality-source',
  'stock-photo',
  'blog',
  'forum',
  'unknown',
  'archival-photo',
  'user-provided'
]);

const MetagrinderRetrievalModeSchema = z.enum([
  'off',
  'mock',
  'dry-run',
  'cache-replay',
  'live-candidate-only'
]);

const MetagrinderRetrievalPolicySchema = z.object({
  inputId: z.string(),
  mode: MetagrinderRetrievalModeSchema.default('mock'),
  allowLiveRetrieval: z.boolean().default(false),
  maxQueriesTotal: z.number().int().positive().default(10),
  maxQueriesPerGap: z.number().int().positive().default(2),
  maxResultsPerQuery: z.number().int().positive().default(5),
  allowedSourceTypes: z.array(MetagrinderResearchSourceTypeSchema).default([
    'archive',
    'museum',
    'library',
    'scholarly',
    'newspaper',
    'high-quality-secondary'
  ]),
  blockedSourceTypes: z.array(MetagrinderResearchSourceTypeSchema).default([]),
  blockedDomains: z.array(z.string()).default([]),
  allowedDomains: z.array(z.string()).default([]),
  requireOperatorApprovalForSourceClaims: z.boolean().default(true),
  allowLowQualitySources: z.boolean().default(false),
  failOnProviderError: z.boolean().default(false),
  cache: z.object({
    enabled: z.boolean().default(true),
    readFromCache: z.boolean().default(true),
    writeToCache: z.boolean().default(true),
    cacheDir: z.string().default('tmp/metagrinder-retrieval-cache')
  }).default({})
});

const MetagrinderRetrievalRunLogSchema = z.object({
  inputId: z.string(),
  mode: MetagrinderRetrievalModeSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  queryAttempts: z.array(z.object({
    queryAttemptId: z.string(),
    queryId: z.string(),
    gapId: z.string(),
    query: z.string(),
    mode: MetagrinderRetrievalModeSchema,
    wouldExecute: z.boolean(),
    executed: z.boolean(),
    reason: z.string(),
    resultCount: z.number().int().nonnegative()
  })).default([]),
  budgetUse: z.object({
    queriesPlanned: z.number().int().nonnegative(),
    queriesAllowed: z.number().int().nonnegative(),
    queriesExecuted: z.number().int().nonnegative(),
    queriesSkippedByBudget: z.number().int().nonnegative()
  }),
  warnings: z.array(z.string()).default([])
});

const MetagrinderRetrievalCandidateSchema = z.object({
  candidateId: z.string(),
  queryId: z.string(),
  gapId: z.string(),
  title: z.string(),
  url: z.string(),
  canonicalUrl: z.string(),
  domain: z.string(),
  snippet: z.string(),
  sourceTypeHypothesis: z.string(),
  sourceQualityHypothesis: MetagrinderConfidenceLevelSchema,
  relevance: z.enum(['low', 'medium', 'high']),
  retrievalMode: MetagrinderRetrievalModeSchema,
  reviewStatus: z.enum(['candidate', 'approved', 'rejected', 'pending']).default('candidate'),
  canCreateSourceClaim: z.boolean().default(false)
});

const MetagrinderRetrievalCandidatesArtifactSchema = z.object({
  inputId: z.string(),
  candidates: z.array(MetagrinderRetrievalCandidateSchema).default([])
});

const MetagrinderLiveProviderContractSchema = z.object({
  inputId: z.string(),
  providers: z.array(z.object({
    providerId: z.string(),
    providerKind: z.enum(['search', 'fixture', 'unavailable']),
    status: z.enum(['disabled', 'unavailable', 'fixture-only', 'available']),
    requiresNetwork: z.boolean(),
    requiresApiKey: z.boolean(),
    requiresEnvVars: z.array(z.string()).default([]),
    supportedModes: z.array(MetagrinderRetrievalModeSchema).default([]),
    candidateOnly: z.boolean(),
    autoPromotionAllowed: z.boolean(),
    maxQueryLength: z.number().int().positive(),
    supportsDomainFilters: z.boolean(),
    supportsSourceTypeFilters: z.boolean(),
    supportsResultSnippets: z.boolean(),
    supportsCacheWrite: z.boolean()
  })).default([]),
  defaultProvider: z.string()
});

const MetagrinderProviderPreflightReportSchema = z.object({
  inputId: z.string(),
  providerId: z.string(),
  mode: MetagrinderRetrievalModeSchema,
  status: z.enum(['allowed', 'blocked']),
  checks: z.array(z.object({
    checkId: z.string(),
    passed: z.boolean(),
    message: z.string().optional()
  })).default([]),
  networkAllowed: z.boolean(),
  verdict: z.enum(['allowed', 'blocked'])
});

const MetagrinderProviderConfigAppliedSchema = z.object({
  providerId: z.string(),
  endpointConfigured: z.boolean(),
  apiKeyConfigured: z.boolean(),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().nonnegative(),
  redaction: z.object({
    redactedEnvVars: z.array(z.string()).default([]),
    redactAuthorizationHeaders: z.boolean()
  }),
  networkEnabled: z.boolean(),
  warnings: z.array(z.string()).default([]),
  configSource: z.string().optional(),
  sanitizedConfig: z.unknown().optional()
});

const MetagrinderProviderRequestShapesSchema = z.object({
  inputId: z.string(),
  requests: z.array(z.object({
    requestShapeId: z.string(),
    providerId: z.string(),
    queryId: z.string(),
    gapId: z.string(),
    method: z.literal('search'),
    query: z.string(),
    maxResults: z.number().int().nonnegative(),
    allowedDomains: z.array(z.string()).default([]),
    blockedDomains: z.array(z.string()).default([]),
    allowedSourceTypes: z.array(z.string()).default([]),
    blockedSourceTypes: z.array(z.string()).default([]),
    wouldExecute: z.boolean(),
    reason: z.string()
  })).default([])
});

const MetagrinderProviderResponseEntrySchema = z.object({
  responseId: z.string(),
  providerId: z.string(),
  requestId: z.string(),
  queryId: z.string(),
  gapId: z.string(),
  status: z.enum(['success', 'timeout', 'rate-limited', 'provider-error', 'parse-error', 'blocked']),
  httpStatus: z.number().int().optional(),
  durationMs: z.number().nonnegative(),
  rawResultCount: z.number().int().nonnegative(),
  normalizedCandidateCount: z.number().int().nonnegative(),
  payloadHash: z.string(),
  cacheWriteIds: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderProviderResponseLogSchema = z.object({
  inputId: z.string(),
  responses: z.array(MetagrinderProviderResponseEntrySchema).default([])
});

const MetagrinderLiveProviderPilotReportSchema = z.object({
  inputId: z.string(),
  providerId: z.string(),
  mode: MetagrinderRetrievalModeSchema,
  networkAttempted: z.boolean(),
  networkSucceeded: z.boolean(),
  queryBudget: z.object({
    maxQueriesTotal: z.number().int().nonnegative(),
    queriesExecuted: z.number().int().nonnegative(),
    maxResultsPerQuery: z.number().int().nonnegative()
  }),
  candidateCount: z.number().int().nonnegative(),
  sourceClaimsCreated: z.number().int().nonnegative(),
  grammarRevisionsCreated: z.number().int().nonnegative(),
  cacheWriteCount: z.number().int().nonnegative(),
  autoPromotionBlocked: z.boolean(),
  verdict: z.enum(['safe', 'safe-failed-provider', 'unsafe'])
});

const MetagrinderRealEndpointProofReportSchema = z.object({
  inputId: z.string(),
  providerId: z.string(),
  configPath: z.string().optional(),
  configPresent: z.boolean(),
  networkAttempted: z.boolean(),
  networkSucceeded: z.boolean(),
  queriesExecuted: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  sourceClaimsCreated: z.number().int().nonnegative(),
  grammarRevisionsCreated: z.number().int().nonnegative(),
  cacheWriteCount: z.number().int().nonnegative(),
  candidateInspectionCreated: z.boolean(),
  verdict: z.enum(['safe', 'safe-failed-provider', 'skipped-no-provider-config', 'unsafe'])
});

const MetagrinderCandidateInspectionEntrySchema = z.object({
  candidateId: z.string(),
  queryId: z.string(),
  gapId: z.string(),
  title: z.string(),
  url: z.string(),
  canonicalUrl: z.string(),
  domain: z.string(),
  snippet: z.string(),
  sourceTypeHypothesis: z.string(),
  sourceQualityHypothesis: MetagrinderConfidenceLevelSchema,
  sourceTypingReasons: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([]),
  cacheRecordId: z.string().optional(),
  payloadHash: z.string().optional(),
  canCreateSourceClaim: z.boolean(),
  recommendedAction: z.string()
});

const MetagrinderCandidateInspectionArtifactSchema = z.object({
  inputId: z.string(),
  candidates: z.array(MetagrinderCandidateInspectionEntrySchema).default([])
});

const MetagrinderSourceTypingReportSchema = z.object({
  inputId: z.string(),
  candidateClassifications: z.array(z.object({
    candidateId: z.string(),
    url: z.string(),
    domain: z.string(),
    sourceTypeHypothesis: z.string(),
    sourceTypeConfidence: MetagrinderConfidenceLevelSchema,
    sourceQualityHypothesis: MetagrinderConfidenceLevelSchema,
    qualityReasons: z.array(z.string()).default([]),
    riskFlags: z.array(z.string()).default([]),
    promotionRecommendation: z.enum(['needs_operator_review', 'block', 'allow_with_approval'])
  })).default([])
});

const MetagrinderProviderErrorReportSchema = z.object({
  inputId: z.string(),
  errors: z.array(z.object({
    providerId: z.string(),
    queryId: z.string().optional(),
    errorType: z.string(),
    message: z.string(),
    fatal: z.boolean()
  })).default([])
});

const MetagrinderLiveRetrievalPreflightSchema = z.object({
  inputId: z.string(),
  mode: MetagrinderRetrievalModeSchema,
  enabledByCli: z.boolean(),
  enabledByEnv: z.boolean(),
  networkAllowed: z.boolean(),
  provider: z.string(),
  queryBudget: z.object({
    maxQueriesTotal: z.number().int().nonnegative(),
    maxResultsPerQuery: z.number().int().nonnegative()
  }),
  allowlist: z.object({
    sourceTypes: z.array(z.string()).default([]),
    allowedDomains: z.array(z.string()).default([]),
    blockedDomains: z.array(z.string()).default([])
  }),
  verdict: z.enum(['allowed', 'blocked']),
  warnings: z.array(z.string()).default([])
});

const MetagrinderLiveRetrievalRequestEntrySchema = z.object({
  requestId: z.string(),
  queryId: z.string(),
  gapId: z.string(),
  query: z.string(),
  provider: z.string(),
  executed: z.boolean(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  resultCount: z.number().int().nonnegative(),
  cacheWriteIds: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderLiveRetrievalRequestsSchema = z.object({
  inputId: z.string(),
  requests: z.array(MetagrinderLiveRetrievalRequestEntrySchema).default([])
});

const MetagrinderLiveRetrievalCacheWriteEntrySchema = z.object({
  cacheRecordId: z.string(),
  candidateId: z.string(),
  queryId: z.string(),
  gapId: z.string(),
  payloadHash: z.string(),
  writtenAt: z.string().datetime(),
  cachePath: z.string(),
  providerId: z.string().optional(),
  providerRequestShapeId: z.string().optional(),
  providerResponseId: z.string().optional(),
  rawCandidatePayload: z.unknown().optional(),
  normalizedCandidatePayload: z.unknown().optional(),
  candidate: MetagrinderRetrievalCandidateSchema.optional()
});

const MetagrinderLiveRetrievalCacheWriteSchema = z.object({
  inputId: z.string(),
  cacheWrites: z.array(MetagrinderLiveRetrievalCacheWriteEntrySchema).default([])
});

const MetagrinderRetrievalCacheManifestSchema = z.object({
  inputId: z.string(),
  cacheDir: z.string(),
  cacheMode: MetagrinderRetrievalModeSchema.optional(),
  cacheSource: z.string().optional(),
  mode: MetagrinderRetrievalModeSchema,
  cacheHit: z.boolean(),
  candidateCount: z.number().int().nonnegative(),
  cacheRecords: z.array(z.object({
    cacheRecordId: z.string(),
    candidateId: z.string(),
    queryId: z.string(),
    gapId: z.string(),
    payloadHash: z.string(),
    title: z.string(),
    url: z.string(),
    createdFromFixture: z.boolean(),
    providerId: z.string().optional(),
    providerRequestShapeId: z.string().optional(),
    providerResponseId: z.string().optional(),
    rawCandidatePayload: z.unknown().optional(),
    normalizedCandidatePayload: z.unknown().optional(),
    createdAt: z.string().datetime().optional(),
    candidate: MetagrinderRetrievalCandidateSchema.optional()
  })).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderSourceIntakeApprovalEntrySchema = z.object({
  candidateId: z.string().optional(),
  candidateSelector: z.object({
    canonicalUrl: z.string().optional(),
    queryId: z.string().optional(),
    domain: z.string().optional(),
    titleContains: z.string().optional()
  }).optional(),
  approvalStatus: z.enum(['approved', 'rejected', 'pending']),
  operatorNote: z.string().optional(),
  approvedSourceType: MetagrinderResearchSourceTypeSchema.optional(),
  approvedSourceQuality: MetagrinderConfidenceLevelSchema.optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  approvalMatchMode: z.enum(['candidateId', 'canonicalUrl', 'selector']).optional()
});

const MetagrinderSourceIntakeApprovalSchema = z.object({
  inputId: z.string(),
  approvals: z.array(MetagrinderSourceIntakeApprovalEntrySchema).default([])
});

const MetagrinderApprovedSourceResultsSchema = z.object({
  inputId: z.string(),
  approvedResults: z.array(z.object({
    approvedResultId: z.string(),
    candidateId: z.string(),
    gapId: z.string(),
    title: z.string(),
    url: z.string(),
    sourceType: MetagrinderResearchSourceTypeSchema,
    sourceQuality: MetagrinderConfidenceLevelSchema,
    operatorApprovalStatus: z.literal('approved'),
    approvalMatchMode: z.enum(['candidateId', 'canonicalUrl', 'selector']).optional()
  })).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderSourceEvidenceRecordSchema = z.object({
  evidenceId: z.string(),
  sourceId: z.string(),
  candidateId: z.string().optional(),
  sourceKind: z.string(),
  evidenceType: z.enum(['text-excerpt', 'image-caption', 'metadata-field', 'source-snippet', 'operator-note']),
  excerptText: z.string(),
  normalizedExcerpt: z.string(),
  locator: z.object({
    url: z.string().optional(),
    canonicalUrl: z.string().optional(),
    page: z.union([z.string(), z.number()]).nullable().optional(),
    selector: z.string().nullable().optional(),
    lineStart: z.number().int().nullable().optional(),
    lineEnd: z.number().int().nullable().optional(),
    paragraphIndex: z.number().int().nullable().optional(),
    imageRegion: z.record(z.unknown()).nullable().optional(),
    cacheRecordId: z.string().nullable().optional(),
    accessDate: z.string()
  }),
  reviewStatus: z.enum(['accepted', 'rejected', 'needs_review']).default('needs_review'),
  confidence: MetagrinderConfidenceLevelSchema
});

const MetagrinderSourceEvidenceArtifactSchema = z.object({
  inputId: z.string(),
  evidence: z.array(MetagrinderSourceEvidenceRecordSchema).default([])
});

const MetagrinderSourceClaimReviewEntrySchema = z.object({
  sourceClaimId: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  citationStatus: z.enum(['accepted', 'rejected', 'needs_review']),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  operatorNote: z.string().optional(),
  riskFlags: z.array(z.string()).default([])
});

const MetagrinderSourceClaimReviewArtifactSchema = z.object({
  inputId: z.string(),
  claimReviews: z.array(MetagrinderSourceClaimReviewEntrySchema).default([])
});

const MetagrinderRetrievalSafetyReportSchema = z.object({
  inputId: z.string(),
  mode: MetagrinderRetrievalModeSchema,
  candidateCount: z.number().int().nonnegative(),
  approvedCandidateCount: z.number().int().nonnegative(),
  sourceClaimsCreatedFromLiveCandidates: z.number().int().nonnegative(),
  blockedAutoPromotion: z.boolean(),
  warnings: z.array(z.string()).default([]),
  verdict: z.enum(['safe', 'blocked', 'unsafe'])
});

const MetagrinderSourceRegistryArtifactSchema = z.object({
  inputId: z.string(),
  sources: z.array(z.object({
    sourceId: z.string(),
    sourceKind: z.enum(['original-input', 'web-result', 'visual-reference', 'manual-note']),
    title: z.string(),
    url: z.string().optional(),
    canonicalUrl: z.string().optional(),
    domain: z.string().optional(),
    retrievedAt: z.string().datetime().optional(),
    sourceType: MetagrinderResearchSourceTypeSchema,
    sourceQuality: MetagrinderConfidenceLevelSchema,
    rightsProfile: MetagrinderRightsProfileSchema.default('unknown'),
    limitations: z.array(z.string()).default([]),
    dedupeKey: z.string(),
    mergedFromResultIds: z.array(z.string()).default([]),
    sourceInputIds: z.array(z.string()).default([]),
    sourceChunkIds: z.array(z.string()).default([]),
    reviewStatus: z.enum(['needs_review', 'accepted', 'rejected']).default('needs_review')
  })).default([])
});

const MetagrinderSourceClaimsArtifactSchema = z.object({
  inputId: z.string(),
  claims: z.array(z.object({
    sourceClaimId: z.string(),
    sourceId: z.string(),
    gapId: z.string(),
    claim: z.string(),
    claimType: z.string(),
    supportsGrammarRefs: z.array(z.string()).default([]),
    attributionMode: z.enum(['web-retrieved', 'original-source', 'manual-note']).default('web-retrieved'),
    confidence: MetagrinderConfidenceLevelSchema,
    evidenceIds: z.array(z.string()).default([]),
    evidenceReviewStatus: z.enum(['accepted', 'rejected', 'needs_review']).default('needs_review'),
    evidenceText: z.string(),
    evidenceLocator: z.object({
      url: z.string().optional(),
      page: z.union([z.string(), z.number()]).nullable().optional(),
      selector: z.string().nullable().optional(),
      accessDate: z.string()
    }),
    limitations: z.array(z.string()).default([]),
    reviewStatus: z.enum(['needs_review', 'accepted', 'rejected']).default('needs_review')
  })).default([])
});

const MetagrinderRevisionReviewStatusSchema = z.enum([
  'accepted',
  'rejected',
  'needs_review',
  'pending'
]);

const MetagrinderRevisionStateEntrySchema = z.object({
  revisionId: z.string(),
  reviewStatus: MetagrinderRevisionReviewStatusSchema,
  operatorNote: z.string().optional(),
  overrideCitationReview: z.boolean().default(false),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional()
});

const MetagrinderRevisionStateFileSchema = z.object({
  inputId: z.string(),
  revisionStates: z.array(MetagrinderRevisionStateEntrySchema).default([])
}).superRefine((value, context) => {
  const seen = new Set();
  value.revisionStates.forEach((entry, index) => {
    if (seen.has(entry.revisionId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['revisionStates', index, 'revisionId'],
        message: `Duplicate revision state entry for ${entry.revisionId}`
      });
    }
    seen.add(entry.revisionId);
  });
});

const MetagrinderRevisionStateAppliedSchema = z.object({
  inputId: z.string(),
  revisionStateFile: z.string().optional(),
  appliedRevisionIds: z.array(z.string()).default([]),
  rejectedRevisionIds: z.array(z.string()).default([]),
  skippedRevisionIds: z.array(z.string()).default([]),
  unknownRevisionIds: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderGrammarRevisionSchema = z.object({
  revisionId: z.string(),
  gapId: z.string(),
  changeType: z.enum([
    'confirm-weight-range',
    'adjust-weight-range',
    'adjust-location-distribution',
    'add-compatibility-effect',
    'tighten-negative-constraint',
    'add-source-support',
    'adjust-confidence',
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
  sourceClaimIds: z.array(z.string()).min(1),
  confidence: MetagrinderConfidenceLevelSchema,
  reviewStatus: z.enum(['proposed', 'accepted', 'rejected', 'needs_review']).default('needs_review')
});

const MetagrinderGrammarRevisionArtifactSchema = z.object({
  inputId: z.string(),
  revisions: z.array(MetagrinderGrammarRevisionSchema).default([])
});

const MetagrinderRevisionReviewArtifactSchema = z.object({
  inputId: z.string(),
  proposedRevisionCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  unknownRevisionIds: z.array(z.string()).default([]),
  sourceClaimsSupportingAcceptedRevisions: z.array(z.string()).default([]),
  lowQualitySourceWarnings: z.array(z.string()).default([]),
  affectedGrammarRefs: z.array(z.string()).default([]),
  materialDeltaCount: z.number().int().nonnegative().default(0),
  confirmationCount: z.number().int().nonnegative().default(0),
  appliedMutationCount: z.number().int().nonnegative().default(0),
  skippedMutationCount: z.number().int().nonnegative().default(0),
  acceptedRevisionIdsWithNoMaterialEffect: z.array(z.string()).default([]),
  baseVsAcceptedPsgMaterialDifferences: z.boolean().default(false),
  citationStatusCounts: z.record(z.number().int().nonnegative()).default({}),
  citationWarnings: z.array(z.string()).default([]),
  compileGrammarTarget: z.enum(['base', 'accepted']),
  warnings: z.array(z.string()).default([])
});

const MetagrinderAcceptedSceneGrammarArtifactSchema = MetagrinderSceneGrammarArtifactSchema;

const MetagrinderAcceptedGrammarDeltaSchema = z.object({
  deltaId: z.string(),
  revisionId: z.string(),
  targetGrammarRef: z.string(),
  changeType: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  materialChange: z.boolean(),
  applied: z.boolean(),
  effect: z.string().optional(),
  supportingSourceClaimIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  citationStatus: z.enum(['accepted', 'rejected', 'needs_review', 'mixed', 'none']).default('none'),
  riskFlags: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

const MetagrinderAcceptedGrammarDeltasArtifactSchema = z.object({
  inputId: z.string(),
  deltas: z.array(MetagrinderAcceptedGrammarDeltaSchema).default([])
});

const MetagrinderPsgCompileDiffChoiceSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  weight: z.number()
});

const MetagrinderPsgCompileDiffChangedNodeSchema = z.object({
  graphPath: z.string(),
  nodeId: z.string(),
  changeType: z.literal('weighted-choice-delta'),
  beforeChoices: z.array(MetagrinderPsgCompileDiffChoiceSchema).default([]),
  afterChoices: z.array(MetagrinderPsgCompileDiffChoiceSchema).default([])
});

const MetagrinderPsgCompileDiffArtifactSchema = z.object({
  inputId: z.string(),
  baseGraphPath: z.string(),
  acceptedGraphPath: z.string(),
  changedNodes: z.array(MetagrinderPsgCompileDiffChangedNodeSchema).default([]),
  materialDifference: z.boolean()
});

const MetagrinderLiveRetrievalReadinessArtifactSchema = z.object({
  inputId: z.string(),
  ready: z.boolean(),
  checks: z.array(z.object({
    id: z.string(),
    label: z.string(),
    exists: z.boolean(),
    note: z.string().optional()
  })).default([]),
  missingPrerequisites: z.array(z.string()).default([])
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

const MetagrinderPsgV2NodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'TextBlock',
    'WeightedChoice',
    'Concat',
    'Output'
  ]),
  x: z.number(),
  y: z.number(),
  name: z.string().optional(),
  value: z.string().optional(),
  template: z.string().optional(),
  options: z.array(z.object({
    text: z.string(),
    weight: z.number()
  })).optional(),
  description: z.string().optional(),
  data: z.record(z.unknown()).optional()
}).passthrough().superRefine((node, ctx) => {
  if (node.type === 'WeightedChoice' && (!Array.isArray(node.options) || node.options.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'WeightedChoice nodes must include non-empty options.'
    });
  }
  if (node.type === 'TextBlock' && typeof node.value !== 'string') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'TextBlock nodes must include a string value.'
    });
  }
  if (node.type === 'Output' && typeof node.template !== 'string') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Output nodes must include a template.'
    });
  }
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
  version: z.literal('1.0.0'),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.object({
    type: z.literal('ASSET_FRAGMENT').optional(),
    source: z.literal('metagrinder').optional(),
    tags: z.array(z.string()).optional()
  }).passthrough().optional(),
  nodes: z.array(MetagrinderPsgV2NodeSchema),
  edges: z.array(MetagrinderPsgV2EdgeSchema),
  regions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional(),
    nodes: z.array(z.string()).default([]),
    description: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  }).passthrough()).default([])
}).superRefine((file, ctx) => {
  const nodeIds = new Set(file.nodes.map((node) => node.id));
  file.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index, 'source'],
        message: `Edge source ${edge.source} does not reference a node.`
      });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index, 'target'],
        message: `Edge target ${edge.target} does not reference a node.`
      });
    }
    const targetNode = file.nodes.find((node) => node.id === edge.target);
    if (targetNode?.type === 'Concat' && !['input1', 'input2'].includes(edge.targetHandle || '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index, 'targetHandle'],
        message: 'Edges into Concat nodes must use targetHandle input1 or input2.'
      });
    }
    if (targetNode?.type === 'Output' && edge.targetHandle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['edges', index, 'targetHandle'],
        message: 'Edges into Output nodes must omit targetHandle.'
      });
    }
  });
  file.regions.forEach((region, regionIndex) => {
    region.nodes.forEach((nodeId, nodeIndex) => {
      if (!nodeIds.has(nodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['regions', regionIndex, 'nodes', nodeIndex],
          message: `Region node ${nodeId} does not reference a node.`
        });
      }
    });
  });
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
  MetagrinderColorHypothesisArtifactSchema,
  MetagrinderHistoricalPhotoClaimSchema,
  MetagrinderHistoricalPhotoColorHypothesisClaimSchema,
  MetagrinderHistoricalPhotoColorHypothesisSchema,
  MetagrinderHistoricalPhotoGenerationPaletteSchema,
  MetagrinderHistoricalPhotoObservationArtifactSchema,
  MetagrinderHistoricalPhotoObservationSchema,
  MetagrinderIngestArtifactSchema,
  MetagrinderIngestChunkSchema,
  MetagrinderModeDetectionArtifactSchema,
  MetagrinderNegativeConstraintSchema,
  MetagrinderPlausibilityReviewArtifactSchema,
  MetagrinderResearchKindSchema,
  MetagrinderResearchGapArtifactSchema,
  MetagrinderResearchGapSchema,
  MetagrinderResearchQueryPlanSchema,
  MetagrinderResearchSourceTypeSchema,
  MetagrinderRetrievalModeSchema,
  MetagrinderRetrievalPolicySchema,
  MetagrinderRetrievalRunLogSchema,
  MetagrinderRetrievalCandidateSchema,
  MetagrinderRetrievalCandidatesArtifactSchema,
  MetagrinderLiveProviderContractSchema,
  MetagrinderProviderConfigAppliedSchema,
  MetagrinderProviderPreflightReportSchema,
  MetagrinderProviderRequestShapesSchema,
  MetagrinderProviderResponseEntrySchema,
  MetagrinderProviderResponseLogSchema,
  MetagrinderLiveProviderPilotReportSchema,
  MetagrinderRealEndpointProofReportSchema,
  MetagrinderCandidateInspectionEntrySchema,
  MetagrinderCandidateInspectionArtifactSchema,
  MetagrinderSourceTypingReportSchema,
  MetagrinderProviderErrorReportSchema,
  MetagrinderLiveRetrievalPreflightSchema,
  MetagrinderLiveRetrievalRequestEntrySchema,
  MetagrinderLiveRetrievalRequestsSchema,
  MetagrinderLiveRetrievalCacheWriteEntrySchema,
  MetagrinderLiveRetrievalCacheWriteSchema,
  MetagrinderRetrievalCacheManifestSchema,
  MetagrinderSourceIntakeApprovalEntrySchema,
  MetagrinderSourceIntakeApprovalSchema,
  MetagrinderApprovedSourceResultsSchema,
  MetagrinderSourceEvidenceRecordSchema,
  MetagrinderSourceEvidenceArtifactSchema,
  MetagrinderSourceClaimReviewEntrySchema,
  MetagrinderSourceClaimReviewArtifactSchema,
  MetagrinderRetrievalSafetyReportSchema,
  MetagrinderRevisionReviewStatusSchema,
  MetagrinderRevisionStateEntrySchema,
  MetagrinderRevisionStateFileSchema,
  MetagrinderRevisionStateAppliedSchema,
  MetagrinderRevisionReviewArtifactSchema,
  MetagrinderAcceptedSceneGrammarArtifactSchema,
  MetagrinderAcceptedGrammarDeltaSchema,
  MetagrinderAcceptedGrammarDeltasArtifactSchema,
  MetagrinderPsgCompileDiffArtifactSchema,
  MetagrinderLiveRetrievalReadinessArtifactSchema,
  MetagrinderSourceRegistryArtifactSchema,
  MetagrinderSourceClaimsArtifactSchema,
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
  MetagrinderBriefAnalysisArtifactSchema,
  MetagrinderBriefAnalysisGraphAssemblyPlanSchema,
  MetagrinderBriefMainSubjectSchema,
  MetagrinderBriefSubcategoryCandidateSchema,
  MetagrinderBriefSubcategoryCharacteristicSchema,
  MetagrinderBriefSubcategoryEvidenceCheckSchema,
  MetagrinderSemanticChoiceGraphArtifactSchema,
  MetagrinderSemanticChoiceGraphAxisSchema,
  MetagrinderSemanticChoiceGraphChoiceSchema,
  MetagrinderSemanticChoiceGraphEdgeSchema,
  MetagrinderSemanticChoiceGraphWarningSchema,
  MetagrinderPsgOutputFlightArtifactSchema,
  MetagrinderPsgOutputFlightSampleSchema,
  MetagrinderPsgReadabilityReviewArtifactSchema,
  MetagrinderPsgReadabilityFindingSchema,
  MetagrinderCodexSweetenRequestArtifactSchema,
  MetagrinderCodexSweetenResultArtifactSchema,
  MetagrinderCodexSweetenRewriteSchema,
  MetagrinderCodexParseOutputSchemaArtifactSchema,
  MetagrinderCodexParseRequestArtifactSchema,
  MetagrinderCodexParseResultArtifactSchema,
  MetagrinderStructuredBriefArtifactSchema,
  MetagrinderStructuredBriefEntitySchema,
  MetagrinderStructuredBriefWeightSchema,
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

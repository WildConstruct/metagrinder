import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  CameraQueryContractSchema,
  CameraPassManifestSchema,
  CanonicalUtdgRecordSchema,
  LumaAdapterContractSchema,
  MetagrinderAcceptedGrammarDeltasArtifactSchema,
  MetagrinderAgentRunArtifactSchema,
  MetagrinderAssumptionReviewArtifactSchema,
  MetagrinderAugmentationPlanArtifactSchema,
  MetagrinderBriefAnalysisArtifactSchema,
  MetagrinderCategoryHypothesisArtifactSchema,
  MetagrinderClassifyArtifactSchema,
    MetagrinderCodexParseOutputSchemaArtifactSchema,
    MetagrinderCodexParseRequestArtifactSchema,
    MetagrinderCodexParseResultArtifactSchema,
    MetagrinderExtractArtifactSchema,
    MetagrinderGrammarRevisionArtifactSchema,
    MetagrinderIngestArtifactSchema,
    MetagrinderModeDetectionArtifactSchema,
    MetagrinderMutationArtifactSchema,
    MetagrinderMutationReviewArtifactSchema,
    MetagrinderPlausibilityReviewArtifactSchema,
    MetagrinderPsgCompileDiffArtifactSchema,
    MetagrinderPsgOutputFlightArtifactSchema,
    MetagrinderPsgReadabilityReviewArtifactSchema,
    MetagrinderPsgV2FileSchema,
    MetagrinderSemanticChoiceGraphArtifactSchema,
    MetagrinderCodexSweetenResultArtifactSchema,
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
    MetagrinderLiveRetrievalReadinessArtifactSchema,
    MetagrinderSamplePromptsArtifactSchema,
    MetagrinderScoreArtifactSchema,
    MetagrinderSceneGrammarArtifactSchema,
    MetagrinderSceneGrammarEvaluationSchema,
    MetagrinderStructuredBriefArtifactSchema,
    MetagrinderSourceClaimsArtifactSchema,
    MetagrinderSourceEvidenceArtifactSchema,
    MetagrinderSourceClaimReviewArtifactSchema,
    MetagrinderSourceRegistryArtifactSchema,
    MetagrinderSynthesizeArtifactSchema,
    MetagrinderWebResearchResultsSchema,
  MetaballManifestSchema,
  ModelConditioningPayloadSchema,
  GraphMatchReportSchema,
  PacketAttributionManifestSchema,
  PatchProposalSchema,
  PromptGraphManifestSchema,
  SemanticScenePackageSchema,
  SuppressedGraphNodesReportSchema,
  RenderTextPacketSchema,
  ResearchPackageManifestSchema,
  UtdgCandidatesFileSchema,
  UtdgSubmissionManifestSchema,
  WitnessRenderManifestSchema,
  WorldSemanticFieldSchema
} from '../types/metagrinder';

const {
      buildAssumptionReviewArtifact,
      buildAugmentationPlanArtifact,
      buildClassifyArtifact,
      buildCategoryHypothesisArtifact,
      buildConceptClustersPsg,
      buildExtractArtifact,
      buildIngestArtifact,
      buildModeDetectionArtifact,
      buildMutationArtifact,
      buildMutationReviewArtifact,
      buildMultiInputIngestArtifact,
      buildPromptMutationsPsg,
      buildPromptSynthesisPsg,
      buildAgentRunsArtifact,
      buildSourceModeArtifact,
      buildStructuredBriefArtifact,
      buildBriefAnalysisFromSeed,
      buildCodexParseOutputSchemaArtifact,
      buildCodexParseRequestArtifact,
      buildProjectionStructuredBriefFromAnalysis,
      normalizeCodexParseResult,
      buildSceneGrammarArtifact,
      buildSemanticChoiceGraphArtifact,
      buildResearchGapArtifact,
      buildResearchQueryPlan,
      buildWebResearchResults,
      buildSourceRegistryArtifact,
      buildSourceClaimsArtifact,
      buildGrammarRevisionArtifact,
      applyRevisionStateFile,
      applyAcceptedGrammarRevisions,
      applyAcceptedGrammarRevisionsWithDeltas,
      splitGrammarRevisionArtifact,
      buildRevisionReviewArtifact,
      buildSamplePromptsArtifact,
      buildSceneGrammarEvaluation,
      buildPlausibilityReviewArtifact,
      buildSceneGrammarPsg,
      buildBranchSceneGrammarPsgs,
      preparseResearchBrief,
      buildResearchBriefReviewArtifacts,
      buildResearchPackageManifest,
    buildReviewArtifact,
    buildScoreArtifact,
    buildSourceMapPsg,
    buildSynthesizeArtifact,
    runMetagrinderMvp
  } = require('../scripts/lib/metagrinder-mvp.js');
const researchIngestService = require('../services/researchIngest/index.js');
const researchClassifyService = require('../services/researchClassify/index.js');
const researchExtractService = require('../services/researchExtract/index.js');
const researchMutationService = require('../services/researchMutation/index.js');
const researchPackageService = require('../services/researchPackage/index.js');
const researchPipelineService = require('../services/researchPipeline/index.js');
const researchReviewService = require('../services/researchReview/index.js');
const researchScoreService = require('../services/researchScore/index.js');
const researchSynthesizeService = require('../services/researchSynthesize/index.js');
const researchWebResearchService = require('../services/researchWebResearch/index.js');
const { buildApprovedSourceResultsArtifact } = require('../services/researchSourceIntakeApproval/index.js');
const { buildPsgOutputFlightArtifact } = require('../services/researchPsgOutputFlight/index.js');
const { buildPsgReadabilityReviewArtifact } = require('../services/researchPsgReadabilityReview/index.js');
const { applySweetenRewrites, validateSweetenResult } = require('../services/researchCodexPsgSweeten/index.js');
const metagrinderWorkbenchService = require('../services/metagrinderWorkbench/index.js');
const metagrinderWorkbenchServer = require('../scripts/serve-metagrinder-workbench.js');

const readFixture = (name: string) => {
  const fixturePath = path.join(
    __dirname,
    'fixtures',
    'metagrinder',
    name
  );
  return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
};

const readTextFixture = (name: string) => {
  const fixturePath = path.join(
    __dirname,
    'fixtures',
    'metagrinder',
    name
  );
  return fs.readFileSync(fixturePath, 'utf-8');
};

const expectPromptSpaghettiPsg = (psg: any) => {
  expect(() => MetagrinderPsgV2FileSchema.parse(psg)).not.toThrow();
  expect(psg.version).toBe('1.0.0');
  expect(psg.metadata?.type).toBe('ASSET_FRAGMENT');
  expect(psg.metadata?.source).toBe('metagrinder');
  expect(psg.graph).toBeUndefined();
  expect(psg.fileType).toBeUndefined();
  expect(psg.formatVersion).toBeUndefined();
  expect(Array.isArray(psg.nodes)).toBe(true);
  expect(Array.isArray(psg.edges)).toBe(true);
  const nodeIds = new Set(psg.nodes.map((node: any) => node.id));
  psg.nodes.forEach((node: any) => {
    expect(node.id).toBeTruthy();
    expect(node.type).toBeTruthy();
    expect(typeof node.x).toBe('number');
    expect(typeof node.y).toBe('number');
    expect(node.position).toBeUndefined();
    if (node.type === 'WeightedChoice') {
      expect(Array.isArray(node.options)).toBe(true);
      expect(node.options.length).toBeGreaterThan(0);
      expect(node.options.every((choice: any) =>
        typeof choice.text === 'string' && typeof choice.weight === 'number'
      )).toBe(true);
      expect(node.data?.choices).toBeUndefined();
    }
  });
  psg.edges.forEach((edge: any) => {
    expect(edge.id).toBeTruthy();
    expect(nodeIds.has(edge.source)).toBe(true);
    expect(nodeIds.has(edge.target)).toBe(true);
    const target = psg.nodes.find((node: any) => node.id === edge.target);
    if (target?.type === 'Concat') {
      expect(['input1', 'input2']).toContain(edge.targetHandle);
    }
    if (target?.type === 'Output') {
      expect(edge.targetHandle).toBeUndefined();
    }
  });
};

const testSemanticChoiceGraph = () => MetagrinderSemanticChoiceGraphArtifactSchema.parse({
  inputId: 'readability-test',
  analysisMode: 'codex-semantic',
  subject: {
    label: '1909 spectator prompt graph',
    subjectType: 'scene-brief',
    summary: 'Prompt graph for period spectator characters.'
  },
  sourceArtifacts: ['brief-analysis.json'],
  axes: [
    {
      axisId: 'age',
      label: 'Age Choice',
      axisType: 'age',
      order: 1,
      choices: [
        { choiceId: 'age_adult', text: 'adult', weight: 85 },
        { choiceId: 'age_child_if_supported', text: 'Child if supported', weight: 15 }
      ]
    },
    {
      axisId: 'sex',
      label: 'Sex Choice',
      axisType: 'sex',
      order: 2,
      choices: [
        { choiceId: 'sex_male', text: 'male', weight: 80 },
        { choiceId: 'sex_female', text: 'female', weight: 20 }
      ]
    },
    {
      axisId: 'male_hat_hair',
      label: 'Male Hat / Hair',
      axisType: 'hat-hair',
      order: 4,
      appliesWhen: [{ choiceId: 'sex_male', text: 'male', weight: 80 }],
      choices: [
        { choiceId: 'male_boater', text: 'wearing a straw boater hat', weight: 70 },
        { choiceId: 'male_bareheaded', text: 'bareheaded', weight: 30 }
      ]
    },
    {
      axisId: 'male_condition_behavior',
      label: 'Male Condition / Behavior',
      axisType: 'condition-behavior',
      order: 9,
      appliesWhen: [{ choiceId: 'sex_male', text: 'male', weight: 80 }],
      choices: [
        { choiceId: 'male_dust', text: 'dust accumulation', weight: 50 },
        { choiceId: 'male_walk', text: 'walking group', weight: 50 }
      ]
    },
    {
      axisId: 'female_hat_hair',
      label: 'Female Hat / Hair',
      axisType: 'hat-hair',
      order: 4,
      appliesWhen: [{ choiceId: 'sex_female', text: 'female', weight: 20 }],
      choices: [
        { choiceId: 'female_picture_hat', text: 'wearing a wide-brimmed picture hat', weight: 100 }
      ]
    }
  ],
  edges: [
    { edgeId: 'age_to_sex', sourceAxisId: 'age', targetAxisId: 'sex', relation: 'linear' },
    { edgeId: 'sex_to_male_hat', sourceAxisId: 'sex', sourceChoiceId: 'sex_male', targetAxisId: 'male_hat_hair', relation: 'branch' },
    { edgeId: 'sex_to_female_hat', sourceAxisId: 'sex', sourceChoiceId: 'sex_female', targetAxisId: 'female_hat_hair', relation: 'branch' },
    { edgeId: 'male_hat_to_condition', sourceAxisId: 'male_hat_hair', targetAxisId: 'male_condition_behavior', relation: 'linear' }
  ],
  warnings: [],
  coverage: []
});
describe('metagrinder schemas', () => {
  test('parses research package fixture', () => {
    const fixture = readFixture('research-package.json');
    const result = ResearchPackageManifestSchema.parse(fixture);

    expect(result.packageType).toBe('research-package');
    expect(result.collections).toHaveLength(3);
    expect(result.reviewStatus).toBe('draft');
  });

  test('parses metagrinder ingest artifact', () => {
    const result = MetagrinderIngestArtifactSchema.parse({
      inputId: 'src_001',
      title: 'Broadway notes',
      sourceType: 'plain-text',
      researchKind: 'historical-scene-research',
      sourceInputs: [
        {
          sourceInputId: 'src_001',
          title: 'Broadway notes',
          sourceType: 'plain-text',
          sequence: 0
        }
      ],
      chunks: [
        {
          chunkId: 'src_001_chunk_001',
          sourceInputId: 'src_001',
          text: 'Crowds gathered beneath the marquee.',
          sequence: 0
        }
      ]
    });

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].sourceInputId).toBe('src_001');
    expect(result.chunks[0].chunkKind).toBe('unknown');
  });

  test('parses metagrinder mode detection artifact', () => {
    const result = MetagrinderModeDetectionArtifactSchema.parse({
      inputId: 'src_001',
      researchKind: 'historical-scene-research',
      confidence: 'high',
      reasons: ['Top detected mode: historical-scene-research (9).'],
      suggestedCategories: ['wardrobe', 'people-and-crowd'],
      candidateKinds: [
        {
          researchKind: 'historical-scene-research',
          score: 9
        },
        {
          researchKind: 'style-analysis',
          score: 2
        }
      ]
    });

    expect(result.researchKind).toBe('historical-scene-research');
    expect(result.candidateKinds[0].score).toBe(9);
  });

  test('parses metagrinder category hypothesis artifact', () => {
    const result = MetagrinderCategoryHypothesisArtifactSchema.parse({
      inputId: 'src_001',
      researchKind: 'historical-scene-research',
      categories: [
        {
          categoryId: 'wardrobe',
          label: 'wardrobe',
          priority: 'primary',
          rationale: 'Proposed from research mode historical-scene-research.'
        }
      ],
      recommendedFocus: ['wardrobe']
    });

    expect(result.categories[0].priority).toBe('primary');
    expect(result.recommendedFocus).toContain('wardrobe');
  });

  test('parses metagrinder assumption review artifact', () => {
    const result = MetagrinderAssumptionReviewArtifactSchema.parse({
      inputId: 'src_001',
      researchKind: 'mixed',
      detectedChunkKinds: ['observation', 'template'],
      recommendedFocus: ['source-notes'],
      warnings: ['Template chunks were detected.'],
      decisionOptions: ['proceed-as-is', 'adjust-priorities', 'request-augmentation']
    });

    expect(result.detectedChunkKinds).toContain('template');
    expect(result.decisionOptions).toContain('adjust-priorities');
  });

  test('parses metagrinder augmentation plan artifact', () => {
    const result = MetagrinderAugmentationPlanArtifactSchema.parse({
      inputId: 'src_001',
      researchKind: 'mixed',
      verificationTargets: ['Separate observations from templates.'],
      missingSourceTypes: ['separate observational source notes'],
      followUpResearchDirections: ['Create a clean example bank.'],
      rationale: ['Mixed-mode briefs need stronger separation.']
    });

    expect(result.researchKind).toBe('mixed');
    expect(result.missingSourceTypes).toContain('separate observational source notes');
  });

  test('parses metagrinder extract artifact', () => {
    const result = MetagrinderExtractArtifactSchema.parse({
      inputId: 'src_001',
      claims: [
        {
          claimId: 'claim_001',
          text: 'Crowds gathered beneath the marquee.',
          category: 'people-and-crowd',
          confidence: 'high',
          sourceInputIds: ['src_001'],
          sourceChunkIds: ['src_001_chunk_001'],
          attributionMode: 'paraphrased'
        }
      ]
    });

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].category).toBe('people-and-crowd');
  });

  test('parses metagrinder classify artifact', () => {
    const result = MetagrinderClassifyArtifactSchema.parse({
      inputId: 'src_001',
      collections: {
        sourceMapChunkIds: ['src_001_chunk_001'],
        claimsAndEvidenceClaimIds: ['claim_001'],
        conceptClusterBuckets: [
          {
            bucketId: 'bucket_wardrobe',
            label: 'Wardrobe',
            category: 'wardrobe',
            conceptIds: ['concept_001'],
            claimIds: ['claim_001']
          }
        ]
      }
    });

    expect(result.collections.conceptClusterBuckets).toHaveLength(1);
    expect(result.collections.conceptClusterBuckets[0].category).toBe('wardrobe');
  });

  test('parses metagrinder synthesize artifact', () => {
    const result = MetagrinderSynthesizeArtifactSchema.parse({
      inputId: 'src_001',
      promptFragments: [
        {
          fragmentId: 'fragment_001',
          family: 'lighting',
          text: 'bright marquee glow',
          conceptIds: ['concept_001'],
          sourceInputIds: ['src_001'],
          sourceChunkIds: ['src_001_chunk_001']
        }
      ]
    });

    expect(result.promptFragments).toHaveLength(1);
    expect(result.promptFragments[0].family).toBe('lighting');
  });

  test('parses metagrinder mutation artifact', () => {
    const result = MetagrinderMutationArtifactSchema.parse({
      inputId: 'src_001',
      candidateFragments: [
        {
          fragmentId: 'fragment_001',
          family: 'lighting',
          text: 'bright marquee glow',
          conceptIds: ['concept_001'],
          sourceInputIds: ['src_001'],
          sourceChunkIds: ['src_001_chunk_001']
        }
      ],
      compatibilityDecisions: [
        {
          decisionId: 'decision_001',
          leftFragmentId: 'fragment_001',
          rightFragmentId: 'fragment_002',
          status: 'incompatible',
          reasons: ['same-family-fragments-cannot-be-recombined'],
          sharedConceptIds: [],
          sharedSourceInputIds: ['src_001']
        }
      ],
      variants: [
        {
          variantId: 'variant_001',
          text: 'bright marquee glow, heavy evening overcoats',
          fragmentIds: ['fragment_001', 'fragment_002'],
          families: ['lighting', 'wardrobe'],
          compatibilityDecisionIds: ['decision_002'],
          conceptIds: ['concept_001', 'concept_002'],
          sourceInputIds: ['src_001'],
          sourceChunkIds: ['src_001_chunk_001', 'src_001_chunk_002'],
          distinctivenessScore: 0.55
        }
      ],
      droppedVariants: [
        {
          droppedVariantId: 'dropped_001',
          text: 'bright marquee glow, heavy evening overcoats',
          fragmentIds: ['fragment_001', 'fragment_002'],
          compatibilityDecisionIds: ['decision_002'],
          reason: 'duplicate-variant-text'
        }
      ],
      generationSummary: {
        maxVariants: 12,
        compatiblePairCount: 1,
        incompatiblePairCount: 1,
        generatedVariantCount: 1,
        droppedDuplicateCount: 0
      }
    });

    expect(result.candidateFragments).toHaveLength(1);
    expect(result.compatibilityDecisions[0].status).toBe('incompatible');
    expect(result.variants[0].variantId).toBe('variant_001');
    expect(result.droppedVariants[0].reason).toBe('duplicate-variant-text');
  });

  test('parses metagrinder mutation review artifact', () => {
    const result = MetagrinderMutationReviewArtifactSchema.parse({
      inputId: 'src_001',
      promotableVariantIds: ['variant_001'],
      flaggedVariantIds: ['variant_002'],
      rejectedVariantIds: ['variant_003'],
      duplicateVariantIds: ['variant_003'],
      weakVariantIds: ['variant_002'],
      incompatibilityWarnings: ['fragment_001 + fragment_004: same-family-fragments-cannot-be-recombined'],
      recommendedActions: ['Inspect flagged mutation variants for weak distinctiveness.']
    });

    expect(result.promotableVariantIds).toContain('variant_001');
    expect(result.rejectedVariantIds).toContain('variant_003');
  });

  test('parses metagrinder score artifact', () => {
    const result = MetagrinderScoreArtifactSchema.parse({
      inputId: 'src_001',
      corroboratedConceptIds: ['concept_001'],
      disputedConceptIds: [],
      confidenceSummary: {
        overall: 'medium',
        extraction: 'medium',
        normalization: 'medium',
        provenance: 'high',
        rights: 'low'
      },
      ambiguityFlags: ['question_001']
    });

    expect(result.confidenceSummary.provenance).toBe('high');
  });

  test('parses metagrinder review artifact', () => {
    const result = MetagrinderReviewArtifactSchema.parse({
      inputId: 'src_001',
      unresolvedAmbiguities: ['Review hat prevalence.'],
      corroboratedConceptIds: ['concept_001'],
      contradictionFlags: ['Potential contradiction in claim_001'],
      recommendedActions: ['Tighten weak concept labels.']
    });

    expect(result.unresolvedAmbiguities).toHaveLength(1);
  });

  test('builds deterministic ingest artifact from research text fixture', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const result = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-07T12:00:00.000Z'
    });

    expect(result.title).toBe('1950s New York Broadway audience on a cold evening');
    expect(result.chunks.length).toBeGreaterThanOrEqual(3);
    expect(result.chunks[0].chunkId).toBe('research-input-broadway_chunk_001');
    expect(result.chunks[1].sectionLabel).toBe('Street Atmosphere');
    expect(result.chunks.some(chunk => chunk.sectionLabel === 'Wardrobe Notes')).toBe(true);
  });

  test('recognizes best-practices heading taxonomy during ingest', () => {
    const rawText = readTextFixture('research-input-best-practices.txt');
    const result = buildIngestArtifact({
      inputPath: 'research-input-best-practices.txt',
      rawText,
      inputId: 'research-input-best-practices',
      title: '1950s Broadway audience research packet',
      createdAt: '2026-03-07T12:00:00.000Z'
    });

    expect(
      result.chunks.some(chunk => chunk.tags.includes('source-notes'))
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.tags.includes('reusable-concepts'))
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.tags.includes('unexpected-findings'))
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.chunkKind === 'source-note')
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.chunkKind === 'concept-list')
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.chunkKind === 'uncertainty')
    ).toBe(true);
  });

  test('preparses flattened research briefs into a more chunkable structure', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const result = preparseResearchBrief(rawText);

    expect(result.diagnostics).toContain('restored-inline-roman-headings');
    expect(result.diagnostics).toContain('split-description-runs');
    expect(result.normalizedText).toContain('\n\nII. Foundational Archetypes');
    expect(result.normalizedText).toContain('\nDescription 1:');
    expect(result.normalizedText).toContain('\n\nVIII. Assembly Logic');
  });

  test('shared research brief preparser module exposes the intake normalizer', () => {
    const preparser = require('../scripts/lib/research-brief-preparser.js');

    expect(typeof preparser.preparseResearchBrief).toBe('function');
    expect(
      preparser.preparseResearchBrief('OverviewI. Section body.').diagnostics
    ).toContain('restored-inline-roman-headings');
  });

  test('uses structural preparse heuristics to improve ingest chunking for flattened briefs', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const result = buildIngestArtifact({
      inputPath: 'spaghettiwestern.md',
      rawText,
      inputId: 'spaghettiwestern',
      title: 'Spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    expect(result.chunks.length).toBeGreaterThan(1);
    expect(
      result.chunks.some(chunk => chunk.tags.includes('restored-inline-roman-headings'))
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.sectionLabel?.includes('Foundational Archetypes'))
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.sectionLabel?.includes('Assembly Logic'))
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.chunkKind === 'generation-rule')
    ).toBe(true);
    expect(
      result.chunks.some(chunk => chunk.chunkKind === 'template')
    ).toBe(true);
  });

  test('researchIngest service matches the exported ingest path', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const directServiceArtifact = researchIngestService.buildIngestArtifact({
      inputPath: 'spaghettiwestern.md',
      rawText,
      inputId: 'spaghettiwestern',
      title: 'Spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z',
      preparseResearchBrief,
      buildModeDetectionArtifact: researchReviewService.buildModeDetectionArtifact
    });
    const exportedArtifact = buildIngestArtifact({
      inputPath: 'spaghettiwestern.md',
      rawText,
      inputId: 'spaghettiwestern',
      title: 'Spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    expect(directServiceArtifact).toEqual(exportedArtifact);
    expect(directServiceArtifact.researchKind).toBe('mixed');
  });

  test('detects historical scene research mode for Broadway notes', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const modeDetectionArtifact = buildModeDetectionArtifact({
      inputId: ingestArtifact.inputId,
      title: ingestArtifact.title,
      chunks: ingestArtifact.chunks
    });

    expect(ingestArtifact.researchKind).toBe('historical-scene-research');
    expect(modeDetectionArtifact.researchKind).toBe('historical-scene-research');
    expect(modeDetectionArtifact.suggestedCategories).toContain('wardrobe');
    expect(modeDetectionArtifact.suggestedCategories).toContain('people-and-crowd');

    const categoryHypothesisArtifact = buildCategoryHypothesisArtifact({
      inputId: ingestArtifact.inputId,
      modeDetectionArtifact,
      ingestArtifact
    });
    const assumptionReviewArtifact = buildAssumptionReviewArtifact({
      inputId: ingestArtifact.inputId,
      modeDetectionArtifact,
      categoryHypothesisArtifact,
      ingestArtifact
    });
    const augmentationPlanArtifact = buildAugmentationPlanArtifact({
      inputId: ingestArtifact.inputId,
      modeDetectionArtifact,
      categoryHypothesisArtifact,
      assumptionReviewArtifact,
      ingestArtifact
    });

    expect(categoryHypothesisArtifact.recommendedFocus).toContain('wardrobe');
    expect(categoryHypothesisArtifact.recommendedFocus).toContain('people-and-crowd');
    expect(
      categoryHypothesisArtifact.categories.find((entry: any) => entry.label === 'lighting')?.priority
    ).toBe('secondary');
    expect(assumptionReviewArtifact.decisionOptions).toContain('proceed-as-is');
    expect(augmentationPlanArtifact.missingSourceTypes).toContain('period photographs or archival visual references');
  });

  test('detects mixed research mode for the spaghettiwestern framework brief', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'spaghettiwestern.md',
      rawText,
      inputId: 'spaghettiwestern',
      title: 'Spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const modeDetectionArtifact = buildModeDetectionArtifact({
      inputId: ingestArtifact.inputId,
      title: ingestArtifact.title,
      chunks: ingestArtifact.chunks
    });

    expect(modeDetectionArtifact.researchKind).toBe('mixed');
    expect(
      modeDetectionArtifact.candidateKinds.some(candidate => candidate.researchKind === 'character-framework')
    ).toBe(true);
    expect(
      modeDetectionArtifact.candidateKinds.some(candidate => candidate.researchKind === 'procedural-guide')
    ).toBe(true);

    const categoryHypothesisArtifact = buildCategoryHypothesisArtifact({
      inputId: ingestArtifact.inputId,
      modeDetectionArtifact,
      ingestArtifact
    });
    const assumptionReviewArtifact = buildAssumptionReviewArtifact({
      inputId: ingestArtifact.inputId,
      modeDetectionArtifact,
      categoryHypothesisArtifact,
      ingestArtifact
    });
    const augmentationPlanArtifact = buildAugmentationPlanArtifact({
      inputId: ingestArtifact.inputId,
      modeDetectionArtifact,
      categoryHypothesisArtifact,
      assumptionReviewArtifact,
      ingestArtifact
    });

    expect(categoryHypothesisArtifact.recommendedFocus).toContain('source-notes');
    expect(categoryHypothesisArtifact.recommendedFocus).toContain('reusable-concepts');
    expect(
      categoryHypothesisArtifact.categories.find((entry: any) => entry.label === 'templates')?.priority
    ).toBe('secondary');
    expect(assumptionReviewArtifact.warnings.length).toBeGreaterThanOrEqual(1);
    expect(assumptionReviewArtifact.decisionOptions).toContain('request-augmentation');
    expect(augmentationPlanArtifact.verificationTargets.length).toBeGreaterThanOrEqual(1);
    expect(augmentationPlanArtifact.missingSourceTypes).toContain('separate observational source notes');
  });

  test('researchReview service matches the exported semantic mode path', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'spaghettiwestern.md',
      rawText,
      inputId: 'spaghettiwestern',
      title: 'Spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    const directServiceArtifact = researchReviewService.buildModeDetectionArtifact({
      inputId: ingestArtifact.inputId,
      title: ingestArtifact.title,
      chunks: ingestArtifact.chunks
    });
    const exportedArtifact = buildModeDetectionArtifact({
      inputId: ingestArtifact.inputId,
      title: ingestArtifact.title,
      chunks: ingestArtifact.chunks
    });

    expect(directServiceArtifact).toEqual(exportedArtifact);
    expect(directServiceArtifact.researchKind).toBe('mixed');
  });

  test('researchExtract service matches the exported extract path', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText: readTextFixture('research-input-broadway.txt'),
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    const directServiceArtifact = researchExtractService.buildExtractArtifact({
      ingestArtifact
    });
    const exportedArtifact = buildExtractArtifact({
      ingestArtifact
    });

    expect(directServiceArtifact).toEqual(exportedArtifact);
    expect(directServiceArtifact.claims.length).toBeGreaterThan(0);
  });

  test('researchClassify service matches the exported classify path', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText: readTextFixture('research-input-broadway.txt'),
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });

    const directServiceArtifact = researchClassifyService.buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });
    const exportedArtifact = buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });

    expect(directServiceArtifact).toEqual(exportedArtifact);
    expect(directServiceArtifact.collections.conceptClusterBuckets.length).toBeGreaterThan(0);
  });

  test('researchSynthesize service matches the exported synthesize path', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText: readTextFixture('research-input-broadway.txt'),
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });

    const directServiceArtifact = researchSynthesizeService.buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const exportedArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });

    expect(directServiceArtifact).toEqual(exportedArtifact);
    expect(directServiceArtifact.promptFragments.length).toBeGreaterThan(0);
  });

  test('researchMutation service matches the exported mutation paths', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText: readTextFixture('research-input-broadway.txt'),
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });

    const directMutationArtifact = researchMutationService.buildMutationArtifact({
      synthesizeArtifact
    });
    const exportedMutationArtifact = buildMutationArtifact({
      synthesizeArtifact
    });
    const directReviewArtifact = researchMutationService.buildMutationReviewArtifact({
      mutationArtifact: directMutationArtifact
    });
    const exportedReviewArtifact = buildMutationReviewArtifact({
      mutationArtifact: exportedMutationArtifact
    });

    expect(directMutationArtifact).toEqual(exportedMutationArtifact);
    expect(directReviewArtifact).toEqual(exportedReviewArtifact);
  });

  test('researchScore service matches the exported score and review paths', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText: readTextFixture('research-input-broadway.txt'),
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });

    const directScoreArtifact = researchScoreService.buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });
    const exportedScoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });
    const directReviewArtifact = researchScoreService.buildReviewArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact,
      scoreArtifact: directScoreArtifact
    });
    const exportedReviewArtifact = buildReviewArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact,
      scoreArtifact: exportedScoreArtifact
    });

    expect(directScoreArtifact).toEqual(exportedScoreArtifact);
    expect(directReviewArtifact).toEqual(exportedReviewArtifact);
  });

  test('researchPackage service matches the exported PSG and package paths', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText: readTextFixture('research-input-broadway.txt'),
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const classifyArtifact = buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });

    const directSourceMapPsg = researchPackageService.buildSourceMapPsg({
      ingestArtifact
    });
    const exportedSourceMapPsg = buildSourceMapPsg({
      ingestArtifact
    });
    const directConceptClustersPsg = researchPackageService.buildConceptClustersPsg({
      ingestArtifact,
      extractArtifact,
      classifyArtifact
    });
    const exportedConceptClustersPsg = buildConceptClustersPsg({
      ingestArtifact,
      extractArtifact,
      classifyArtifact
    });
    const directPromptSynthesisPsg = researchPackageService.buildPromptSynthesisPsg({
      ingestArtifact,
      synthesizeArtifact
    });
    const exportedPromptSynthesisPsg = buildPromptSynthesisPsg({
      ingestArtifact,
      synthesizeArtifact
    });
    const directPromptMutationsPsg = researchPackageService.buildPromptMutationsPsg({
      ingestArtifact,
      mutationArtifact
    });
    const exportedPromptMutationsPsg = buildPromptMutationsPsg({
      ingestArtifact,
      mutationArtifact
    });
    const directResearchPackageManifest = researchPackageService.buildResearchPackageManifest({
      ingestArtifact,
      scoreArtifact,
      mutationArtifact
    });
    const exportedResearchPackageManifest = buildResearchPackageManifest({
      ingestArtifact,
      scoreArtifact,
      mutationArtifact
    });

    expect(directSourceMapPsg).toEqual(exportedSourceMapPsg);
    expect(directConceptClustersPsg).toEqual(exportedConceptClustersPsg);
    expect(directPromptSynthesisPsg).toEqual(exportedPromptSynthesisPsg);
    expect(directPromptMutationsPsg).toEqual(exportedPromptMutationsPsg);
    expect(directResearchPackageManifest).toEqual(exportedResearchPackageManifest);
  });

  test('researchPipeline service matches the exported runner path', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-pipeline-exported-'));
    const directOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-pipeline-direct-'));
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-broadway.txt'
    );

    const exportedResult = runMetagrinderMvp({
      inputPath,
      outputDir
    });
    const directResult = researchPipelineService.runPipeline({
      inputPath,
      outputDir: directOutputDir,
      resolveInputPath: (candidatePath: string) => {
        const candidateInputPaths = [
          path.resolve(candidatePath),
          path.resolve(__dirname, '..', '..', '..', candidatePath)
        ];
        return candidateInputPaths.find((resolvedPath) => fs.existsSync(resolvedPath));
      },
      readTextFile: (filePath: string) => fs.readFileSync(filePath, 'utf8'),
      ensureDir: (dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }),
      writeJson: (filePath: string, value: unknown) =>
        fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'),
      deriveTitle: researchIngestService.deriveTitle,
      deriveCombinedTitle: researchIngestService.deriveCombinedTitle,
      slugify: (value: string) => value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'research-input',
      buildIngestArtifact,
      buildMultiInputIngestArtifact,
      buildResearchBriefReviewArtifacts,
      buildExtractArtifact,
      buildClassifyArtifact,
      buildSynthesizeArtifact,
      buildMutationArtifact,
      buildMutationReviewArtifact,
      buildScoreArtifact,
      buildReviewArtifact,
      buildSourceMapPsg,
      buildConceptClustersPsg,
      buildPromptSynthesisPsg,
      buildPromptMutationsPsg,
      buildAgentRunsArtifact,
      buildSourceModeArtifact,
      buildStructuredBriefArtifact,
      buildSceneGrammarArtifact,
      buildResearchGapArtifact,
      buildResearchQueryPlan,
      buildWebResearchResults,
      buildSourceRegistryArtifact,
      buildSourceClaimsArtifact,
      buildGrammarRevisionArtifact,
      applyRevisionStateFile,
      splitGrammarRevisionArtifact,
      applyAcceptedGrammarRevisions,
      buildRevisionReviewArtifact,
      buildSamplePromptsArtifact,
      buildSceneGrammarEvaluation,
      buildPlausibilityReviewArtifact,
      buildSceneGrammarPsg,
      buildBranchSceneGrammarPsgs,
      buildResearchPackageManifest,
      validatePackageArtifacts: researchPackageService.validatePackageArtifacts,
      now: () => exportedResult.ingestArtifact.createdAt
    });

    expect(directResult).toEqual({
      ...exportedResult,
      outputDir: path.resolve(directOutputDir)
    });
    expect(fs.readFileSync(path.join(directOutputDir, 'research-package.json'), 'utf8')).toBe(
      fs.readFileSync(path.join(outputDir, 'research-package.json'), 'utf8')
    );
  });

  test('builds a review bundle for operator inspection before extraction', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const result = buildResearchBriefReviewArtifacts({
      rawText,
      title: 'Spaghettiwestern',
      inputPath: 'spaghettiwestern.md',
      inputId: 'spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    expect(result.ingestArtifact.inputId).toBe('spaghettiwestern');
    expect(result.modeDetectionArtifact.researchKind).toBe('mixed');
    expect(result.categoryHypothesisArtifact.recommendedFocus).toContain('source-notes');
    expect(result.assumptionReviewArtifact.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.augmentationPlanArtifact.verificationTargets.length).toBeGreaterThanOrEqual(1);
  });

  test('review service handles low-signal briefs with no primary focus', () => {
    const modeDetectionArtifact = {
      inputId: 'low-signal-brief',
      researchKind: 'unknown'
    };
    const categoryHypothesisArtifact = {
      inputId: 'low-signal-brief',
      researchKind: 'unknown',
      categories: [],
      recommendedFocus: []
    };
    const assumptionReviewArtifact = researchReviewService.buildAssumptionReviewArtifact({
      inputId: 'low-signal-brief',
      modeDetectionArtifact,
      categoryHypothesisArtifact,
      ingestArtifact: {
        chunks: []
      }
    });
    const augmentationPlanArtifact = researchReviewService.buildAugmentationPlanArtifact({
      inputId: 'low-signal-brief',
      modeDetectionArtifact,
      categoryHypothesisArtifact,
      assumptionReviewArtifact
    });

    expect(categoryHypothesisArtifact.recommendedFocus).toEqual([]);
    expect(
      assumptionReviewArtifact.warnings.some(warning => warning.includes('No clear primary focus'))
    ).toBe(true);
    expect(
      augmentationPlanArtifact.verificationTargets.some(target => target.includes('Choose at least one primary extraction focus'))
    ).toBe(true);
    expect(
      augmentationPlanArtifact.rationale.some(entry => entry.includes('No primary focus'))
    ).toBe(true);
  });

  test('review service buildResearchBriefReviewArtifacts can build ingest on demand', () => {
    const result = researchReviewService.buildResearchBriefReviewArtifacts({
      rawText: '# Notes\n\nTemplate:\n- lone gunslinger\n\nObservations:\nDry wind across the street.',
      title: 'On demand brief',
      inputPath: 'on-demand.txt',
      inputId: 'on-demand-brief',
      createdAt: '2026-03-09T12:00:00.000Z',
      buildIngestArtifact
    });

    expect(result.ingestArtifact.inputId).toBe('on-demand-brief');
    expect(result.modeDetectionArtifact.researchKind).toBeDefined();
    expect(result.assumptionReviewArtifact.decisionOptions).toContain('adjust-priorities');
  });

  test('tailors environment-observation category focus to the actual brief content', () => {
    const greenhouse = buildResearchBriefReviewArtifacts({
      rawText: readTextFixture('research-input-greenhouse.txt'),
      title: 'Glasshouse at Dawn',
      inputPath: 'research-input-greenhouse.txt',
      inputId: 'research-input-greenhouse',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const shipyard = buildResearchBriefReviewArtifacts({
      rawText: readTextFixture('research-input-shipyard.txt'),
      title: 'Winter Shipyard Shift Change',
      inputPath: 'research-input-shipyard.txt',
      inputId: 'research-input-shipyard',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const desert = buildResearchBriefReviewArtifacts({
      rawText: readTextFixture('research-input-desert-outpost.txt'),
      title: 'Desert Relay Station at Dusk',
      inputPath: 'research-input-desert-outpost.txt',
      inputId: 'research-input-desert-outpost',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    expect(greenhouse.modeDetectionArtifact.reasons.join(' ')).toContain('greenhouse');
    expect(greenhouse.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['structures', 'atmosphere', 'lighting'])
    );
    expect(
      greenhouse.categoryHypothesisArtifact.categories.find((entry: any) => entry.label === 'structures')?.rationale
    ).toContain('greenhouse');

    expect(shipyard.modeDetectionArtifact.confidence).toBe('high');
    expect(shipyard.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['movement', 'lighting', 'atmosphere'])
    );
    expect(
      shipyard.categoryHypothesisArtifact.categories.find((entry: any) => entry.label === 'structures')?.priority
    ).toBe('secondary');

    expect(desert.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['materials', 'atmosphere', 'structures'])
    );
    expect(
      desert.categoryHypothesisArtifact.categories.find((entry: any) => entry.label === 'lighting')?.priority
    ).toBe('secondary');
  });

  test('classifies additional long-form research reports more usefully than generic environment mode', () => {
    const medieval = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'research_tests', 'medieval_peasent_generator.md'),
        'utf-8'
      ),
      title: 'medieval_peasent_generator',
      inputPath: 'research_tests/medieval_peasent_generator.md',
      inputId: 'medieval-peasent-generator',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const naming = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'research_tests', 'tabloid_naming.md'),
        'utf-8'
      ),
      title: 'tabloid_naming',
      inputPath: 'research_tests/tabloid_naming.md',
      inputId: 'tabloid-naming',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const doomDigest = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'research_tests', 'weeklyworldnews'),
        'utf-8'
      ),
      title: 'weeklyworldnews',
      inputPath: 'research_tests/weeklyworldnews',
      inputId: 'weeklyworldnews',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    expect(medieval.modeDetectionArtifact.researchKind).toBe('character-framework');
    expect(medieval.modeDetectionArtifact.reasons.join(' ')).toContain('characteristics');
    expect(medieval.assumptionReviewArtifact.detectedChunkKinds).toContain('reference-table');

    expect(naming.modeDetectionArtifact.researchKind).toBe('style-analysis');
    expect(naming.modeDetectionArtifact.reasons.join(' ')).toContain('style');
    expect(naming.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['genre-context', 'visual-signifiers'])
    );

    expect(doomDigest.modeDetectionArtifact.researchKind).toBe('style-analysis');
    expect(doomDigest.modeDetectionArtifact.reasons.join(' ')).toContain('tone');
    expect(doomDigest.assumptionReviewArtifact.detectedChunkKinds).toContain('generation-rule');
  });

  test('holds up on unseen adversarial validation briefs from the semantic framework study', () => {
    const archival = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'experiments', 'epic4-autoresearch', 'validation', 'archival-costume-crowd-memo.md'),
        'utf-8'
      ),
      title: 'Archival costume crowd memo',
      inputPath: 'experiments/epic4-autoresearch/validation/archival-costume-crowd-memo.md',
      inputId: 'archival-costume-crowd-memo',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const material = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'experiments', 'epic4-autoresearch', 'validation', 'canyon-foundry-surface-sheet.md'),
        'utf-8'
      ),
      title: 'Canyon foundry surface sheet',
      inputPath: 'experiments/epic4-autoresearch/validation/canyon-foundry-surface-sheet.md',
      inputId: 'canyon-foundry-surface-sheet',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const brandKit = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'experiments', 'epic4-autoresearch', 'validation', 'outlaw-press-brand-kit.md'),
        'utf-8'
      ),
      title: 'Outlaw press brand kit',
      inputPath: 'experiments/epic4-autoresearch/validation/outlaw-press-brand-kit.md',
      inputId: 'outlaw-press-brand-kit',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const procedural = buildResearchBriefReviewArtifacts({
      rawText: fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'experiments', 'epic4-autoresearch', 'validation', 'modular-enemy-generator-notes.md'),
        'utf-8'
      ),
      title: 'Modular enemy generator notes',
      inputPath: 'experiments/epic4-autoresearch/validation/modular-enemy-generator-notes.md',
      inputId: 'modular-enemy-generator-notes',
      createdAt: '2026-03-09T12:00:00.000Z'
    });

    expect(archival.modeDetectionArtifact.researchKind).toBe('historical-scene-research');
    expect(archival.modeDetectionArtifact.confidence).toBe('high');
    expect(archival.modeDetectionArtifact.reasons.join(' ')).toContain('crowd');
    expect(archival.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['wardrobe', 'people-and-crowd', 'weather-and-environment'])
    );

    expect(material.modeDetectionArtifact.researchKind).toBe('material-reference');
    expect(material.modeDetectionArtifact.reasons.join(' ')).toContain('surface');
    expect(material.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['materials', 'surface-response', 'wear-and-damage'])
    );

    expect(brandKit.modeDetectionArtifact.researchKind).toBe('style-analysis');
    expect(brandKit.modeDetectionArtifact.confidence).toBe('high');
    expect(brandKit.modeDetectionArtifact.reasons.join(' ')).toContain('brand');
    expect(brandKit.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['genre-context', 'visual-signifiers'])
    );

    expect(procedural.modeDetectionArtifact.researchKind).toBe('procedural-guide');
    expect(procedural.modeDetectionArtifact.reasons.join(' ')).toContain('template');
    expect(procedural.categoryHypothesisArtifact.recommendedFocus).toEqual(
      expect.arrayContaining(['generation-rules', 'templates'])
    );
    expect(procedural.assumptionReviewArtifact.warnings.join(' ')).toContain('Template chunks were detected');
    expect(procedural.assumptionReviewArtifact.detectedChunkKinds).toEqual(
      expect.arrayContaining(['generation-rule', 'template'])
    );
  });

  test('builds multi-input ingest artifact preserving source identities', () => {
    const broadwayText = readTextFixture('research-input-broadway.txt');
    const costumeText = readTextFixture('research-input-costume-notes.txt');
    const result = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'research-input-broadway.txt',
          rawText: broadwayText,
          title: '1950s New York Broadway audience on a cold evening',
          sourceInputId: 'research-input-broadway'
        },
        {
          path: 'research-input-costume-notes.txt',
          rawText: costumeText,
          title: 'Costume note sheet for Broadway street crowd',
          sourceInputId: 'research-input-costume-notes'
        }
      ],
      inputId: 'multi-research-input-broadway',
      title: 'Broadway dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });

    expect(result.sourceInputs).toHaveLength(2);
    expect(result.sourceInputs[1].sourceInputId).toBe('research-input-costume-notes');
    expect(
      result.chunks.some(chunk => chunk.sourceInputId === 'research-input-costume-notes')
    ).toBe(true);
    expect(result.chunks[0].chunkId.startsWith('research-input-broadway_chunk_')).toBe(true);
  });

  test('builds multi-input extract artifact preserving sourceInputIds', () => {
    const broadwayText = readTextFixture('research-input-broadway.txt');
    const costumeText = readTextFixture('research-input-costume-notes.txt');
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'research-input-broadway.txt',
          rawText: broadwayText,
          title: '1950s New York Broadway audience on a cold evening',
          sourceInputId: 'research-input-broadway'
        },
        {
          path: 'research-input-costume-notes.txt',
          rawText: costumeText,
          title: 'Costume note sheet for Broadway street crowd',
          sourceInputId: 'research-input-costume-notes'
        }
      ],
      inputId: 'multi-research-input-broadway',
      title: 'Broadway dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });

    expect(
      extractArtifact.claims.some(claim => claim.sourceInputIds.includes('research-input-costume-notes'))
    ).toBe(true);
    expect(
      extractArtifact.evidence.some(entry => entry.sourceInputIds.includes('research-input-costume-notes'))
    ).toBe(true);
    expect(
      extractArtifact.openQuestions.every(question => Array.isArray(question.sourceInputIds))
    ).toBe(true);
  });

  test('merges repeated concepts across source documents while preserving provenance', () => {
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'a.txt',
          rawText: '# A\n\nDamp pavement reflected neon lettering and taxi light.',
          title: 'A',
          sourceInputId: 'src_a'
        },
        {
          path: 'b.txt',
          rawText: '# B\n\nNeon lettering reflected across damp pavement outside the theater.',
          title: 'B',
          sourceInputId: 'src_b'
        }
      ],
      inputId: 'multi-neon',
      title: 'Neon dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const mergedConcept = extractArtifact.conceptCandidates.find(
      concept => concept.label === 'neon street reflections'
    );

    expect(mergedConcept).toBeDefined();
    expect(mergedConcept.sourceInputIds.sort()).toEqual(['src_a', 'src_b']);
    expect(mergedConcept.sourceChunkIds).toHaveLength(2);
  });

  test('raises score confidence for corroborated multi-source concepts', () => {
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'a.txt',
          rawText: '# A\n\nDamp pavement reflected neon lettering and taxi light.',
          title: 'A',
          sourceInputId: 'src_a'
        },
        {
          path: 'b.txt',
          rawText: '# B\n\nNeon lettering reflected across damp pavement and taxi light.',
          title: 'B',
          sourceInputId: 'src_b'
        }
      ],
      inputId: 'multi-neon',
      title: 'Neon dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });

    expect(scoreArtifact.corroboratedConceptIds.length).toBeGreaterThanOrEqual(1);
    expect(scoreArtifact.confidenceSummary.extraction).toBe('high');
  });

  test('keeps near-duplicate cross-document concepts separate and surfaces review warnings', () => {
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'a.txt',
          rawText: '# A\n\nNeon lettering reflected across damp pavement outside the theater.',
          title: 'A',
          sourceInputId: 'src_a'
        },
        {
          path: 'b.txt',
          rawText: '# B\n\nNeon signs flashed over storefront glass and puddled gutters at the block edge.',
          title: 'B',
          sourceInputId: 'src_b'
        }
      ],
      inputId: 'multi-lighting-overlap',
      title: 'Lighting overlap dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const lightingConcepts = extractArtifact.conceptCandidates.filter(
      concept => concept.category === 'lighting'
    );

    expect(lightingConcepts.length).toBeGreaterThanOrEqual(2);
    expect(
      extractArtifact.warnings.some(warning => warning.code === 'near-duplicate-concept')
    ).toBe(true);
  });

  test('surfaces contradiction flags and corroborated concepts in review output', () => {
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'a.txt',
          rawText: '# A\n\nDark wool overcoats were common outside the theater.',
          title: 'A',
          sourceInputId: 'src_a'
        },
        {
          path: 'b.txt',
          rawText: '# B\n\nSome accounts emphasize formal gloves, while others focus on practical winter outerwear.',
          title: 'B',
          sourceInputId: 'src_b'
        }
      ],
      inputId: 'multi-contrast',
      title: 'Contrast dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });
    const reviewArtifact = buildReviewArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact,
      scoreArtifact
    });

    expect(Array.isArray(reviewArtifact.corroboratedConceptIds)).toBe(true);
    expect(reviewArtifact.contradictionFlags.length).toBeGreaterThanOrEqual(1);
    expect(
      reviewArtifact.recommendedActions.some(action => action.includes('contradiction flags'))
    ).toBe(true);
  });

  test('reduces score confidence when contradictions are present', () => {
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'a.txt',
          rawText: '# A\n\nDark wool overcoats were common outside the theater.',
          title: 'A',
          sourceInputId: 'src_a'
        },
        {
          path: 'b.txt',
          rawText: '# B\n\nSome accounts emphasize formal gloves, while others focus on practical winter outerwear.',
          title: 'B',
          sourceInputId: 'src_b'
        }
      ],
      inputId: 'multi-contrast-score',
      title: 'Contrast score dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });

    expect(scoreArtifact.confidenceSummary.extraction).not.toBe('high');
    expect(scoreArtifact.confidenceSummary.normalization).not.toBe('high');
    expect(scoreArtifact.ambiguityFlags.length).toBeGreaterThan(0);
  });

  test('downgrades normalization for disputed concepts and near-duplicate warnings', () => {
    const scoreArtifact = researchScoreService.buildScoreArtifact({
      ingestArtifact: {
        inputId: 'score-disputes',
        chunks: [
          { chunkId: 'chunk_001' },
          { chunkId: 'chunk_002' }
        ]
      },
      extractArtifact: {
        claims: [
          {
            claimId: 'claim_001',
            text: 'Neon signage reflected on the street.',
            attributionMode: 'quoted'
          }
        ],
        evidence: [
          { evidenceId: 'ev_001' },
          { evidenceId: 'ev_002' }
        ],
        openQuestions: [],
        warnings: [
          {
            code: 'near-duplicate-concept'
          }
        ],
        conceptCandidates: [
          {
            conceptId: 'concept_001',
            label: 'street reflections',
            summary: 'cool reflections|warm reflections',
            attributionMode: 'inferred',
            confidence: 'medium',
            sourceInputIds: ['src_a', 'src_b']
          },
          {
            conceptId: 'concept_002',
            label: 'sign glow',
            summary: 'steady marquee glow|flickering shop glow',
            attributionMode: 'quoted',
            confidence: 'medium',
            sourceInputIds: ['src_a', 'src_b']
          }
        ]
      },
      synthesizeArtifact: {
        promptFragments: [{}, {}, {}, {}]
      }
    });

    expect(scoreArtifact.disputedConceptIds).toEqual(['concept_001', 'concept_002']);
    expect(scoreArtifact.confidenceSummary.normalization).toBe('medium');
    expect(scoreArtifact.ambiguityFlags).toContain('near-duplicate-concept_1');
  });

  test('review artifact includes actions for weak concepts, sparse synthesis, disputes, and overlap warnings', () => {
    const scoreArtifact = researchScoreService.buildScoreArtifact({
      ingestArtifact: {
        inputId: 'score-review-actions',
        chunks: [{ chunkId: 'chunk_001' }]
      },
      extractArtifact: {
        claims: [
          {
            claimId: 'claim_001',
            text: 'Some accounts emphasize gloves, while others focus on coats.',
            attributionMode: 'inferred',
            sourceInputIds: ['src_a', 'src_b']
          }
        ],
        evidence: [],
        openQuestions: [
          {
            questionId: 'open_001',
            text: 'Were gloves universal or occasional?'
          }
        ],
        warnings: [
          {
            code: 'near-duplicate-concept',
            message: 'Two wardrobe concepts may be over-merged.'
          }
        ],
        conceptCandidates: [
          {
            conceptId: 'concept_001',
            label: 'winter outerwear',
            summary: 'coats|gloves',
            attributionMode: 'inferred',
            confidence: 'medium',
            sourceInputIds: ['src_a', 'src_b']
          }
        ]
      },
      synthesizeArtifact: {
        promptFragments: [{ family: 'atmosphere' }]
      }
    });

    const reviewArtifact = researchScoreService.buildReviewArtifact({
      ingestArtifact: {
        inputId: 'score-review-actions'
      },
      extractArtifact: {
        claims: [
          {
            claimId: 'claim_001',
            text: 'Some accounts emphasize gloves, while others focus on coats.',
            sourceChunkIds: [],
            sourceInputIds: ['src_a', 'src_b']
          }
        ],
        openQuestions: [
          {
            questionId: 'open_001',
            text: 'Were gloves universal or occasional?'
          }
        ],
        warnings: [
          {
            code: 'near-duplicate-concept',
            message: 'Two wardrobe concepts may be over-merged.'
          }
        ],
        conceptCandidates: [
          {
            conceptId: 'concept_001',
            label: 'winter outerwear',
            summary: 'coats|gloves',
            confidence: 'medium',
            sourceInputIds: ['src_a', 'src_b']
          }
        ]
      },
      synthesizeArtifact: {
        promptFragments: [{ family: 'atmosphere' }]
      },
      scoreArtifact
    });

    expect(reviewArtifact.missingProvenance).toEqual(['claim_001']);
    expect(reviewArtifact.weakConceptIds).toEqual(['concept_001']);
    expect(
      reviewArtifact.recommendedActions.some(action => action.includes('Add more prompt fragments'))
    ).toBe(true);
    expect(
      reviewArtifact.recommendedActions.some(action => action.includes('Tighten weak concept labels'))
    ).toBe(true);
    expect(
      reviewArtifact.recommendedActions.some(action => action.includes('Inspect merged concepts with differing summaries'))
    ).toBe(true);
    expect(
      reviewArtifact.recommendedActions.some(action => action.includes('Review overlap warnings'))
    ).toBe(true);
  });

  test('builds deterministic extract artifact from ingest fixture', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const result = buildExtractArtifact({
      ingestArtifact
    });

    expect(result.claims.length).toBeGreaterThanOrEqual(5);
    expect(result.evidence).toHaveLength(3);
    expect(result.claims[0].sourceInputIds).toEqual(['research-input-broadway']);
    expect(
      result.claims.some(claim => claim.category === 'wardrobe')
    ).toBe(true);
    expect(
      result.claims.some(claim =>
        claim.category === 'lighting' || claim.category === 'weather-and-environment'
      )
    ).toBe(true);
    expect(
      result.conceptCandidates.some(concept => concept.label.includes('neon'))
    ).toBe(true);
    expect(
      result.openQuestions.length
    ).toBeGreaterThanOrEqual(1);
  });

  test('uses best-practices heading taxonomy as a soft extraction hint', () => {
    const rawText = readTextFixture('research-input-best-practices.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-best-practices.txt',
      rawText,
      inputId: 'research-input-best-practices',
      title: '1950s Broadway audience research packet',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });

    expect(
      extractArtifact.conceptCandidates.some(concept => concept.label.includes('neon'))
    ).toBe(true);
    expect(
      extractArtifact.warnings.some(warning => warning.code === 'unexpected-finding')
    ).toBe(true);
  });

  test('extract preserves empty, reference-table, and inferred review cases', () => {
    const extractArtifact = researchExtractService.buildExtractArtifact({
      ingestArtifact: {
        inputId: 'extract-edge-cases',
        chunks: [
          {
            chunkId: 'chunk_001',
            sourceInputId: 'src_001',
            text: '   ',
            sectionLabel: 'Blank',
            sequence: 0,
            chunkKind: 'source-note',
            tags: []
          },
          {
            chunkId: 'chunk_002',
            sourceInputId: 'src_001',
            text: 'Hat | Coat | Gloves',
            sectionLabel: 'Wardrobe Grid',
            sequence: 1,
            chunkKind: 'reference-table',
            tags: []
          },
          {
            chunkId: 'chunk_003',
            sourceInputId: 'src_001',
            text: 'The crowd may have lingered under the marquee.',
            sectionLabel: 'Unexpected',
            sequence: 2,
            chunkKind: 'concept-list',
            tags: ['unexpected-findings']
          }
        ]
      }
    });

    expect(
      extractArtifact.warnings.some(warning => warning.code === 'empty-chunk')
    ).toBe(true);
    expect(
      extractArtifact.warnings.some(warning => warning.code === 'reference-table-chunk-preserved-for-review')
    ).toBe(true);
    expect(
      extractArtifact.warnings.some(warning => warning.code === 'unexpected-finding')
    ).toBe(true);
    expect(extractArtifact.openQuestions.length).toBeGreaterThanOrEqual(1);
    expect(extractArtifact.claims[0].confidence).toBe('medium');
  });

  test('extract merges concept summaries across sources and downgrades merged confidence when later evidence is weaker', () => {
    const extractArtifact = researchExtractService.buildExtractArtifact({
      ingestArtifact: {
        inputId: 'extract-merge-cases',
        chunks: [
          {
            chunkId: 'chunk_001',
            sourceInputId: 'src_a',
            text: 'Neon signage reflected on the wet street.',
            sectionLabel: 'Lighting',
            sequence: 0,
            chunkKind: 'source-note',
            tags: []
          },
          {
            chunkId: 'chunk_002',
            sourceInputId: 'src_b',
            text: 'Neon signage may have reflected on the wet street.',
            sectionLabel: 'Lighting',
            sequence: 1,
            chunkKind: 'source-note',
            tags: []
          }
        ]
      }
    });

    const mergedConcept = extractArtifact.conceptCandidates.find(
      concept => concept.label === 'neon street reflections'
    );

    expect(mergedConcept?.sourceInputIds.sort()).toEqual(['src_a', 'src_b']);
    expect(mergedConcept?.summary).toContain('|');
    expect(mergedConcept?.confidence).toBe('medium');
    expect(mergedConcept?.attributionMode).toBe('inferred');
  });

  test('preserves template and generation-rule chunks without treating them as ordinary claims', () => {
    const rawText = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'spaghettiwestern.md'),
      'utf-8'
    );
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'spaghettiwestern.md',
      rawText,
      inputId: 'spaghettiwestern',
      title: 'Spaghettiwestern',
      createdAt: '2026-03-09T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });

    expect(
      ingestArtifact.chunks.some(chunk => chunk.chunkKind === 'template')
    ).toBe(true);
    expect(
      ingestArtifact.chunks.some(chunk => chunk.chunkKind === 'generation-rule')
    ).toBe(true);
    expect(
      extractArtifact.warnings.some(warning => warning.code === 'template-chunk-preserved-for-review')
    ).toBe(true);
    expect(
      extractArtifact.warnings.some(warning => warning.code === 'generation-rule-chunk-preserved-for-review')
    ).toBe(true);
  });

  test.each([
    ['research-input-greenhouse.txt', 'Glasshouse at dawn'],
    ['research-input-shipyard.txt', 'Winter shipyard shift change'],
    ['research-input-desert-outpost.txt', 'Desert relay station at dusk']
  ])('runs end-to-end on a non-Broadway research subject: %s', (fixtureName, title) => {
    const rawText = readTextFixture(fixtureName);
    const ingestArtifact = buildIngestArtifact({
      inputPath: fixtureName,
      rawText,
      inputId: fixtureName.replace(/\.txt$/, ''),
      title,
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const classifyArtifact = buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });
    const reviewArtifact = buildReviewArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact,
      scoreArtifact
    });

    expect(ingestArtifact.chunks.length).toBeGreaterThanOrEqual(3);
    expect(extractArtifact.claims.length).toBeGreaterThan(0);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'lighting')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceChunkIds.length > 0)
    ).toBe(true);
    expect(classifyArtifact.collections.conceptClusterBuckets.length).toBeGreaterThan(0);
    expect(Array.isArray(reviewArtifact.contradictionFlags)).toBe(true);
  });

  test('builds deterministic classify artifact from Broadway fixture', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const result = buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });

    expect(result.collections.sourceMapChunkIds).toHaveLength(3);
    expect(result.collections.claimsAndEvidenceClaimIds).toHaveLength(
      extractArtifact.claims.length
    );
    expect(
      result.collections.conceptClusterBuckets.some(bucket =>
        bucket.category === 'wardrobe' || bucket.category === 'lighting'
      )
    ).toBe(true);
    expect(
      result.collections.conceptClusterBuckets.some(bucket => bucket.category === 'unresolved')
    ).toBe(true);
  });

  test('builds synthesize artifact and prompt-synthesis PSG from Broadway fixture', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const psg = buildPromptSynthesisPsg({
      ingestArtifact,
      synthesizeArtifact
    });

    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'atmosphere')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'wardrobe')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'crowd-behavior')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'lighting')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => Array.isArray(fragment.sourceInputIds))
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceInputIds.length > 0)
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceChunkIds.length > 0)
    ).toBe(true);
    expect(psg.nodes.some((node: any) => node.type === 'WeightedChoice')).toBe(true);
    expect(psg.nodes.some((node: any) => node.type === 'Concat')).toBe(true);
    expect(psg.nodes.some((node: any) => node.type === 'Output')).toBe(true);
  });

  test('backs missing prompt families with derived claims instead of synthetic provenance', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'single-note.txt',
      rawText: '# Notes\n\nCrowds gathered beneath the marquee.',
      inputId: 'single-note',
      title: 'Single note',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });

    expect(synthesizeArtifact.promptFragments.length).toBeGreaterThanOrEqual(4);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'atmosphere')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'wardrobe')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'crowd-behavior')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.some(fragment => fragment.family === 'lighting')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceInputIds[0] === 'single-note')
    ).toBe(true);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceChunkIds[0] === 'single-note_chunk_001')
    ).toBe(true);
  });

  test('dedupes repeated prompt fragments and uses synthetic fallbacks when families remain empty', () => {
    const synthesizeArtifact = researchSynthesizeService.buildSynthesizeArtifact({
      extractArtifact: {
        inputId: 'empty-synthesis',
        claims: [],
        conceptCandidates: [
          {
            conceptId: 'concept_001',
            label: 'wet pavement reflections',
            category: 'materials-and-surfaces',
            confidence: 'high',
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_001']
          },
          {
            conceptId: 'concept_002',
            label: 'wet pavement reflections',
            category: 'materials-and-surfaces',
            confidence: 'high',
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_001']
          }
        ]
      }
    });

    expect(
      synthesizeArtifact.promptFragments.filter(
        fragment => fragment.family === 'atmosphere' && fragment.text === 'wet pavement reflections'
      )
    ).toHaveLength(1);
    expect(synthesizeArtifact.promptFragments).toHaveLength(4);
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceChunkIds.length > 0)
    ).toBe(true);
  });

  test('uses claim fallback when concept candidates do not cover a missing prompt family', () => {
    const synthesizeArtifact = researchSynthesizeService.buildSynthesizeArtifact({
      extractArtifact: {
        inputId: 'claim-fallback',
        conceptCandidates: [],
        claims: [
          {
            claimId: 'claim_001',
            text: 'Orderly ushers guided patrons through the lobby.',
            category: 'people-and-crowd',
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_001']
          }
        ]
      }
    });

    const crowdFragment = synthesizeArtifact.promptFragments.find(
      fragment => fragment.family === 'crowd-behavior'
    );

    expect(crowdFragment?.text).toBe('Orderly ushers guided patrons through the lobby');
    expect(crowdFragment?.sourceChunkIds).toEqual(['src_001_chunk_001']);
  });

  test('uses explicit synthetic fallback copy when no concepts or claims exist', () => {
    const synthesizeArtifact = researchSynthesizeService.buildSynthesizeArtifact({
      extractArtifact: {
        inputId: 'desert-station',
        conceptCandidates: [],
        claims: []
      }
    });

    expect(
      synthesizeArtifact.promptFragments.find(fragment => fragment.family === 'wardrobe')?.text
    ).toBe('period outerwear and evening dress suited to the setting');
    expect(
      synthesizeArtifact.promptFragments.find(fragment => fragment.family === 'crowd-behavior')?.text
    ).toBe('orderly pedestrian crowd movement around the venue');
    expect(
      synthesizeArtifact.promptFragments.find(fragment => fragment.family === 'lighting')?.text
    ).toBe('localized signage and directional evening light');
    expect(
      synthesizeArtifact.promptFragments.find(fragment => fragment.family === 'atmosphere')?.text
    ).toBe('ambient environmental conditions consistent with desert-station');
    expect(
      synthesizeArtifact.promptFragments.every(fragment => fragment.sourceInputIds.length === 0)
    ).toBe(true);
  });

  test('prefers matching concepts over claims when deriving fallback fragments for missing families', () => {
    const synthesizeArtifact = researchSynthesizeService.buildSynthesizeArtifact({
      extractArtifact: {
        inputId: 'concept-fallback',
        conceptCandidates: [
          {
            conceptId: 'concept_001',
            label: 'lamplit storefront glow',
            category: 'lighting',
            confidence: 'high',
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_001']
          }
        ],
        claims: [
          {
            claimId: 'claim_001',
            text: 'Direction signs cast long beams down the street.',
            category: 'lighting',
            sourceInputIds: ['src_002'],
            sourceChunkIds: ['src_002_chunk_001']
          }
        ]
      }
    });

    const lightingFragment = synthesizeArtifact.promptFragments.find(
      fragment => fragment.family === 'lighting'
    );

    expect(lightingFragment?.text).toBe('lamplit storefront glow');
    expect(lightingFragment?.conceptIds).toEqual(['concept_001']);
    expect(lightingFragment?.sourceChunkIds).toEqual(['src_001_chunk_001']);
  });

  test('builds mutation artifact directly from synthesis output without reshaping', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact
    });

    expect(mutationArtifact.candidateFragments).toHaveLength(
      synthesizeArtifact.promptFragments.length
    );
    expect(
      mutationArtifact.candidateFragments.every(fragment => fragment.sourceInputIds.length > 0)
    ).toBe(true);
    expect(
      mutationArtifact.candidateFragments.every(fragment => fragment.sourceChunkIds.length > 0)
    ).toBe(true);
    expect(mutationArtifact.compatibilityDecisions.length).toBeGreaterThan(0);
    expect(
      mutationArtifact.compatibilityDecisions.every(decision => decision.reasons.length > 0)
    ).toBe(true);
    expect(mutationArtifact.generationSummary.generatedVariantCount).toBe(
      mutationArtifact.variants.length
    );
    expect(
      mutationArtifact.variants.every(variant => variant.sourceChunkIds.length > 0)
    ).toBe(true);
  });

  test('marks same-family fragment pairs as incompatible during mutation compatibility evaluation', () => {
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact: {
        inputId: 'mutation-test',
        promptFragments: [
          {
            fragmentId: 'fragment_001',
            family: 'lighting',
            text: 'bright sign glow over wet ground',
            conceptIds: ['concept_001'],
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_001']
          },
          {
            fragmentId: 'fragment_002',
            family: 'lighting',
            text: 'hard flood-lamp reflection on steel deck',
            conceptIds: ['concept_002'],
            sourceInputIds: ['src_002'],
            sourceChunkIds: ['src_002_chunk_001']
          },
          {
            fragmentId: 'fragment_003',
            family: 'wardrobe',
            text: 'heavy winter outerwear and gloves',
            conceptIds: ['concept_003'],
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_002']
          }
        ]
      }
    });

    const sameFamilyDecision = mutationArtifact.compatibilityDecisions.find(
      decision =>
        decision.leftFragmentId === 'fragment_001' &&
        decision.rightFragmentId === 'fragment_002'
    );
    const crossFamilyDecision = mutationArtifact.compatibilityDecisions.find(
      decision =>
        decision.leftFragmentId === 'fragment_001' &&
        decision.rightFragmentId === 'fragment_003'
    );

    expect(sameFamilyDecision?.status).toBe('incompatible');
    expect(sameFamilyDecision?.reasons).toContain('same-family-fragments-cannot-be-recombined');
    expect(crossFamilyDecision?.status).toBe('compatible');
    expect(crossFamilyDecision?.reasons).toContain('distinct-families');
  });

  test('bounds mutation generation and suppresses duplicate variants deterministically', () => {
    const promptFragments = [
      {
        fragmentId: 'fragment_001',
        family: 'atmosphere',
        text: 'humid dawn air around glass panes',
        conceptIds: ['concept_001'],
        sourceInputIds: ['src_001'],
        sourceChunkIds: ['src_001_chunk_001']
      },
      {
        fragmentId: 'fragment_002',
        family: 'wardrobe',
        text: 'workers in heavy canvas jackets',
        conceptIds: ['concept_002'],
        sourceInputIds: ['src_001'],
        sourceChunkIds: ['src_001_chunk_002']
      },
      {
        fragmentId: 'fragment_003',
        family: 'crowd-behavior',
        text: 'compact groups moving through the wind',
        conceptIds: ['concept_003'],
        sourceInputIds: ['src_002'],
        sourceChunkIds: ['src_002_chunk_001']
      },
      {
        fragmentId: 'fragment_004',
        family: 'lighting',
        text: 'hard flood-lamp reflections on steel deck',
        conceptIds: ['concept_004'],
        sourceInputIds: ['src_002'],
        sourceChunkIds: ['src_002_chunk_002']
      },
      {
        fragmentId: 'fragment_005',
        family: 'lighting',
        text: 'hard flood-lamp reflections on steel deck',
        conceptIds: ['concept_005'],
        sourceInputIds: ['src_003'],
        sourceChunkIds: ['src_003_chunk_001']
      },
      {
        fragmentId: 'fragment_006',
        family: 'wardrobe',
        text: 'workers in heavy canvas jackets',
        conceptIds: ['concept_006'],
        sourceInputIds: ['src_003'],
        sourceChunkIds: ['src_003_chunk_002']
      }
    ];

    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact: {
        inputId: 'mutation-bounds',
        promptFragments
      }
    });

    expect(mutationArtifact.variants.length).toBeLessThanOrEqual(
      mutationArtifact.generationSummary.maxVariants
    );
    expect(mutationArtifact.generationSummary.droppedDuplicateCount).toBeGreaterThanOrEqual(1);
    expect(mutationArtifact.droppedVariants.length).toBeGreaterThanOrEqual(1);
    expect(
      mutationArtifact.variants.every(variant => variant.compatibilityDecisionIds.length > 0)
    ).toBe(true);
    expect(
      mutationArtifact.variants.every(variant => variant.fragmentIds.length === 2)
    ).toBe(true);
  });

  test('builds mutation review output with promotable, flagged, and rejected variants', () => {
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact: {
        inputId: 'mutation-review-test',
        promptFragments: [
          {
            fragmentId: 'fragment_001',
            family: 'atmosphere',
            text: 'humid dawn air around glass panes',
            conceptIds: ['concept_001'],
            sourceInputIds: ['src_001', 'src_002'],
            sourceChunkIds: ['src_001_chunk_001']
          },
          {
            fragmentId: 'fragment_002',
            family: 'lighting',
            text: 'soft reflected dawn light on wet tile',
            conceptIds: ['concept_002'],
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_002']
          },
          {
            fragmentId: 'fragment_003',
            family: 'wardrobe',
            text: 'workers in coats',
            conceptIds: ['concept_003'],
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['src_001_chunk_003']
          },
          {
            fragmentId: 'fragment_004',
            family: 'lighting',
            text: 'soft reflected dawn light on wet tile',
            conceptIds: ['concept_004'],
            sourceInputIds: ['src_003'],
            sourceChunkIds: ['src_003_chunk_001']
          }
        ]
      }
    });
    const mutationReviewArtifact = buildMutationReviewArtifact({
      mutationArtifact
    });

    expect(mutationReviewArtifact.promotableVariantIds.length).toBeGreaterThanOrEqual(1);
    expect(mutationReviewArtifact.flaggedVariantIds.length).toBeGreaterThanOrEqual(1);
    expect(mutationReviewArtifact.duplicateVariantIds.length).toBeGreaterThanOrEqual(1);
    expect(mutationReviewArtifact.incompatibilityWarnings.length).toBeGreaterThanOrEqual(1);
    expect(
      mutationReviewArtifact.recommendedActions.some(action => action.includes('flagged mutation variants'))
    ).toBe(true);
    expect(
      mutationReviewArtifact.recommendedActions.some(action => action.includes('dropped duplicate mutation variants'))
    ).toBe(true);
  });

  test('builds score artifact and package outputs from Broadway fixture', () => {
    const rawText = readTextFixture('research-input-broadway.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-broadway.txt',
      rawText,
      inputId: 'research-input-broadway',
      title: '1950s New York Broadway audience on a cold evening',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const classifyArtifact = buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });
    const reviewArtifact = buildReviewArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact,
      scoreArtifact
    });
    const sourceMapPsg = buildSourceMapPsg({
      ingestArtifact
    });
    const conceptClustersPsg = buildConceptClustersPsg({
      ingestArtifact,
      extractArtifact,
      classifyArtifact
    });
    const promptMutationsPsg = buildPromptMutationsPsg({
      ingestArtifact,
      mutationArtifact
    });
    const researchPackageManifest = buildResearchPackageManifest({
      ingestArtifact,
      scoreArtifact,
      mutationArtifact
    });

    expect(scoreArtifact.confidenceSummary.provenance).toBe('high');
    expect(scoreArtifact.confidenceSummary.extraction).toBe('medium');
    expect(Array.isArray(reviewArtifact.corroboratedConceptIds)).toBe(true);
    expect(reviewArtifact.unresolvedAmbiguities.length).toBeGreaterThanOrEqual(1);
    expect(sourceMapPsg.nodes).toHaveLength(3);
    expect(conceptClustersPsg.regions.some((region: any) => region.name === 'Unresolved')).toBe(true);
    expect(promptMutationsPsg.metadata.collectionType).toBe('prompt-mutations');
    expect(researchPackageManifest.collections).toHaveLength(4);
    expect(researchPackageManifest.collections[0].path).toBe('source-map.psg');
    expect(
      researchPackageManifest.collections.some(collection => collection.path === 'prompt-mutations.psg')
    ).toBe(true);
  });

  test('package service skips missing concept nodes and validates optional mutation bundles', () => {
    const conceptClustersPsg = researchPackageService.buildConceptClustersPsg({
      ingestArtifact: {
        inputId: 'package-skip-test',
        title: 'Package skip test',
        sourceInputs: [{ sourceInputId: 'src_001' }]
      },
      extractArtifact: {
        conceptCandidates: [
          {
            conceptId: 'concept_001',
            label: 'marquee glow',
            summary: 'Bright marquee glow over the entrance.',
            category: 'lighting',
            confidence: 'high',
            sourceInputIds: ['src_001'],
            sourceChunkIds: ['chunk_001'],
            attributionMode: 'quoted'
          }
        ]
      },
      classifyArtifact: {
        collections: {
          conceptClusterBuckets: [
            {
              bucketId: 'bucket_001',
              label: 'Lighting',
              category: 'lighting',
              conceptIds: ['concept_001', 'concept_missing'],
              claimIds: []
            }
          ]
        }
      }
    });

    expect(conceptClustersPsg.nodes).toHaveLength(1);
    expect(conceptClustersPsg.edges).toHaveLength(0);

    expect(() => researchPackageService.validatePackageArtifacts({
      augmentationPlanArtifact: {
        inputId: 'pkg',
        researchKind: 'historical-scene-research',
        verificationTargets: [],
        missingSourceTypes: [],
        followUpResearchDirections: [],
        rationale: []
      },
      assumptionReviewArtifact: {
        inputId: 'pkg',
        researchKind: 'historical-scene-research',
        detectedChunkKinds: ['source-note'],
        recommendedFocus: ['lighting'],
        warnings: [],
        decisionOptions: ['proceed-as-is']
      },
      categoryHypothesisArtifact: {
        inputId: 'pkg',
        researchKind: 'historical-scene-research',
        categories: [],
        recommendedFocus: []
      },
      modeDetectionArtifact: {
        inputId: 'pkg',
        researchKind: 'historical-scene-research',
        confidence: 'high',
        reasons: [],
        suggestedCategories: [],
        candidateKinds: []
      },
      ingestArtifact: {
        inputId: 'pkg',
        title: 'Pkg',
        sourceType: 'plain-text',
        researchKind: 'historical-scene-research',
        sourceInputs: [{ sourceInputId: 'src_001', title: 'Pkg', sourceType: 'plain-text', sequence: 0 }],
        chunks: [{ chunkId: 'chunk_001', sourceInputId: 'src_001', text: 'Text', sequence: 0, chunkKind: 'source-note', tags: [] }]
      },
      extractArtifact: {
        inputId: 'pkg',
        claims: [],
        conceptCandidates: [],
        evidence: [],
        openQuestions: [],
        warnings: []
      },
      classifyArtifact: {
        inputId: 'pkg',
        collections: {
          sourceMapChunkIds: [],
          claimsAndEvidenceClaimIds: [],
          conceptClusterBuckets: []
        }
      },
      synthesizeArtifact: {
        inputId: 'pkg',
        promptFragments: []
      },
      mutationArtifact: null,
      mutationReviewArtifact: null,
      scoreArtifact: {
        inputId: 'pkg',
        corroboratedConceptIds: [],
        disputedConceptIds: [],
        confidenceSummary: {
          overall: 'low',
          extraction: 'low',
          normalization: 'low',
          provenance: 'medium',
          rights: 'low'
        },
        ambiguityFlags: []
      },
      reviewArtifact: {
        inputId: 'pkg',
        unresolvedAmbiguities: [],
        corroboratedConceptIds: [],
        overlapWarnings: [],
        contradictionFlags: [],
        missingProvenance: [],
        weakConceptIds: [],
        recommendedActions: []
      },
      sourceMapPsg: {
        version: '1.0.0',
        name: 'Source Map',
        nodes: [{ id: 'node_001', type: 'TextBlock', x: 0, y: 0 }],
        edges: []
      },
      conceptClustersPsg,
      promptSynthesisPsg: {
        version: '1.0.0',
        name: 'Prompt Synthesis',
        nodes: [{ id: 'node_001', type: 'WeightedChoice', x: 0, y: 0 }],
        edges: []
      },
      promptMutationsPsg: null,
      researchPackageManifest: {
        packageId: 'pkg_research_package',
        packageType: 'research-package',
        title: 'Pkg',
        parserVersion: '0.1.0',
        strategyVersion: 'epic1-story5',
        contributorId: 'local-metagrinder-mvp',
        sourceInputs: ['src_001'],
        sourceInputIds: ['src_001'],
        collections: [],
        lineage: { sourceInputIds: ['src_001'] },
        confidenceSummary: {
          overall: 'low',
          extraction: 'low',
          normalization: 'low',
          provenance: 'medium',
          rights: 'low'
        },
        reviewStatus: 'draft'
      }
    })).not.toThrow();
  });

  test('package validation rejects malformed PSG files', () => {
    expect(() => researchPackageService.validatePackageArtifacts({
      augmentationPlanArtifact: {
        inputId: 'pkg-bad',
        researchKind: 'historical-scene-research',
        verificationTargets: [],
        missingSourceTypes: [],
        followUpResearchDirections: [],
        rationale: []
      },
      assumptionReviewArtifact: {
        inputId: 'pkg-bad',
        researchKind: 'historical-scene-research',
        detectedChunkKinds: ['source-note'],
        recommendedFocus: [],
        warnings: [],
        decisionOptions: ['proceed-as-is']
      },
      categoryHypothesisArtifact: {
        inputId: 'pkg-bad',
        researchKind: 'historical-scene-research',
        categories: [],
        recommendedFocus: []
      },
      modeDetectionArtifact: {
        inputId: 'pkg-bad',
        researchKind: 'historical-scene-research',
        confidence: 'high',
        reasons: [],
        suggestedCategories: [],
        candidateKinds: []
      },
      ingestArtifact: {
        inputId: 'pkg-bad',
        title: 'Pkg bad',
        sourceType: 'plain-text',
        researchKind: 'historical-scene-research',
        sourceInputs: [{ sourceInputId: 'src_001', title: 'Pkg', sourceType: 'plain-text', sequence: 0 }],
        chunks: [{ chunkId: 'chunk_001', sourceInputId: 'src_001', text: 'Text', sequence: 0, chunkKind: 'source-note', tags: [] }]
      },
      extractArtifact: {
        inputId: 'pkg-bad',
        claims: [],
        conceptCandidates: [],
        evidence: [],
        openQuestions: [],
        warnings: []
      },
      classifyArtifact: {
        inputId: 'pkg-bad',
        collections: {
          sourceMapChunkIds: [],
          claimsAndEvidenceClaimIds: [],
          conceptClusterBuckets: []
        }
      },
      synthesizeArtifact: {
        inputId: 'pkg-bad',
        promptFragments: []
      },
      mutationArtifact: null,
      mutationReviewArtifact: null,
      scoreArtifact: {
        inputId: 'pkg-bad',
        corroboratedConceptIds: [],
        disputedConceptIds: [],
        confidenceSummary: {
          overall: 'low',
          extraction: 'low',
          normalization: 'low',
          provenance: 'medium',
          rights: 'low'
        },
        ambiguityFlags: []
      },
      reviewArtifact: {
        inputId: 'pkg-bad',
        unresolvedAmbiguities: [],
        corroboratedConceptIds: [],
        overlapWarnings: [],
        contradictionFlags: [],
        missingProvenance: [],
        weakConceptIds: [],
        recommendedActions: []
      },
      sourceMapPsg: {
        version: '',
        name: 'Bad Source Map',
        nodes: [],
        edges: []
      },
      conceptClustersPsg: {
        version: '1.0.0',
        name: 'Concept Clusters',
        nodes: [],
        edges: []
      },
      promptSynthesisPsg: {
        version: '1.0.0',
        name: 'Prompt Synthesis',
        nodes: [],
        edges: []
      },
      promptMutationsPsg: null,
      researchPackageManifest: {
        packageId: 'pkg-bad_research_package',
        packageType: 'research-package',
        title: 'Pkg bad',
        parserVersion: '0.1.0',
        strategyVersion: 'epic1-story5',
        contributorId: 'local-metagrinder-mvp',
        sourceInputs: ['src_001'],
        sourceInputIds: ['src_001'],
        collections: [],
        lineage: { sourceInputIds: ['src_001'] },
        confidenceSummary: {
          overall: 'low',
          extraction: 'low',
          normalization: 'low',
          provenance: 'medium',
          rights: 'low'
        },
        reviewStatus: 'draft'
      }
    })).toThrow('source-map.psg is missing a string version.');
  });

  test('upgrades package manifest and collection metadata for multi-document input', () => {
    const broadwayText = readTextFixture('research-input-broadway.txt');
    const costumeText = readTextFixture('research-input-costume-notes.txt');
    const ingestArtifact = buildMultiInputIngestArtifact({
      sourceFiles: [
        {
          path: 'research-input-broadway.txt',
          rawText: broadwayText,
          title: '1950s New York Broadway audience on a cold evening',
          sourceInputId: 'research-input-broadway'
        },
        {
          path: 'research-input-costume-notes.txt',
          rawText: costumeText,
          title: 'Costume note sheet for Broadway street crowd',
          sourceInputId: 'research-input-costume-notes'
        }
      ],
      inputId: 'multi-research-input-broadway',
      title: 'Broadway dossier',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({
      ingestArtifact
    });
    const classifyArtifact = buildClassifyArtifact({
      ingestArtifact,
      extractArtifact
    });
    const synthesizeArtifact = buildSynthesizeArtifact({
      ingestArtifact,
      extractArtifact
    });
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact,
      synthesizeArtifact
    });
    const sourceMapPsg = buildSourceMapPsg({
      ingestArtifact
    });
    const conceptClustersPsg = buildConceptClustersPsg({
      ingestArtifact,
      extractArtifact,
      classifyArtifact
    });
    const promptSynthesisPsg = buildPromptSynthesisPsg({
      ingestArtifact,
      synthesizeArtifact
    });
    const promptMutationsPsg = buildPromptMutationsPsg({
      ingestArtifact,
      mutationArtifact
    });
    const researchPackageManifest = buildResearchPackageManifest({
      ingestArtifact,
      scoreArtifact,
      mutationArtifact
    });

    expect(researchPackageManifest.sourceInputs).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(researchPackageManifest.sourceInputIds).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(researchPackageManifest.lineage.sourceInputIds).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(researchPackageManifest.strategyVersion).toBe('epic3-story4');
    expect(sourceMapPsg.metadata.sourceInputIds).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(conceptClustersPsg.metadata.sourceInputIds).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(promptSynthesisPsg.metadata.sourceInputIds).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(promptMutationsPsg.metadata.sourceInputIds).toEqual([
      'research-input-broadway',
      'research-input-costume-notes'
    ]);
    expect(
      researchPackageManifest.collections.some(collection => collection.type === 'prompt-mutations')
    ).toBe(true);
  });

  test('runner throws on missing input files', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-missing-'));

    expect(() =>
      runMetagrinderMvp({
        inputPath: 'does-not-exist.txt',
        outputDir
      })
    ).toThrow('Missing input file: does-not-exist.txt');
  });

  test('runner writes mutation artifacts and mutation PSG into the output package', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-mutation-package-'));
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-broadway.txt'
    );

    const result = runMetagrinderMvp({
      inputPath,
      outputDir
    });

    expect(fs.existsSync(path.join(outputDir, 'mutate.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'category-hypothesis.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'assumption-review.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'augmentation-plan.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'mode-detection.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'mutation-review.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'prompt-mutations.psg'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'agent-runs.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'scene-grammar.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'research-gaps.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'research-query-plan.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'web-research-results.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'sample-prompts.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'scene-grammar-evaluation.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'plausibility-review.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'scene-grammar.psg'))).toBe(true);
    expect(
      result.researchPackageManifest.collections.some(collection => collection.type === 'prompt-mutations')
    ).toBe(true);
    expect(result.promptMutationsPsg.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.augmentationPlanArtifact.verificationTargets.length).toBeGreaterThanOrEqual(0);
    expect(result.assumptionReviewArtifact.decisionOptions).toContain('adjust-priorities');
    expect(result.modeDetectionArtifact.researchKind).toBeDefined();
    expect(result.categoryHypothesisArtifact.recommendedFocus.length).toBeGreaterThan(0);
  });

  test('parses scene grammar loop one artifact schemas', () => {
    const agentRuns = MetagrinderAgentRunArtifactSchema.parse({
      inputId: 'scene',
      runs: [
        {
          runId: 'run_001',
          passName: 'scene-grammar',
          mode: 'deterministic',
          strategyVersion: 'scene-grammar-checkpoint',
          inputArtifactIds: ['ingest.json'],
          outputArtifactIds: ['scene-grammar.json']
        }
      ]
    });
    const sceneGrammar = MetagrinderSceneGrammarArtifactSchema.parse({
      inputId: 'scene',
      sceneContext: {
        contextId: 'scene_context',
        title: 'Scene',
        researchKind: 'historical-scene-research',
        summary: 'Compiled scene grammar.',
        sourceInputIds: ['src'],
        sourceChunkIds: ['chunk']
      },
      populationModel: {
        modelId: 'population',
        label: 'Population',
        baselineWeights: [
          {
            label: 'participant',
            min: 50,
            max: 60,
            unit: 'percent',
            confidence: 'medium',
            sourceInputIds: ['src'],
            sourceChunkIds: ['chunk']
          }
        ]
      }
    });
    const gaps = MetagrinderResearchGapArtifactSchema.parse({
      inputId: 'scene',
      gaps: [
        {
          gapId: 'gap_001',
          gapType: 'under-supported-distribution',
          severity: 'medium',
          question: 'What supports this distribution?'
        }
      ]
    });
    const queryPlan = MetagrinderResearchQueryPlanSchema.parse({
      inputId: 'scene',
      queries: [
        {
          queryId: 'query_001',
          gapId: 'gap_001',
          query: 'archive crowd photographs',
          priority: 'medium'
        }
      ]
    });
    const webResults = MetagrinderWebResearchResultsSchema.parse({
      inputId: 'scene',
      adapterMode: 'mock',
      results: []
    });
    const sourceRegistry = MetagrinderSourceRegistryArtifactSchema.parse({
      inputId: 'scene',
      sources: [
        {
          sourceId: 'source_loc_001',
          sourceKind: 'web-result',
          title: 'Archive crowd photograph',
          url: 'https://archive.example/source',
          canonicalUrl: 'https://archive.example/source',
          domain: 'archive.example',
          sourceType: 'archive',
          sourceQuality: 'medium',
          rightsProfile: 'reference-only',
          limitations: ['Comparable scene, not event-specific.'],
          dedupeKey: 'archive.example/source',
          mergedFromResultIds: ['result_001'],
          reviewStatus: 'needs_review'
        }
      ]
    });
    const sourceClaims = MetagrinderSourceClaimsArtifactSchema.parse({
      inputId: 'scene',
      claims: [
        {
          sourceClaimId: 'source_claim_001',
          sourceId: 'source_loc_001',
          gapId: 'gap_001',
          claim: 'Comparable crowd source supports the distribution.',
          claimType: 'demographic-distribution',
          supportsGrammarRefs: ['archetypes.participant.weightRange'],
          attributionMode: 'web-retrieved',
          confidence: 'medium',
          evidenceText: 'Comparable crowd source supports the distribution.',
          evidenceLocator: {
            url: 'https://archive.example/source',
            page: null,
            selector: null,
            accessDate: '2026-05-02'
          },
          limitations: ['Comparable scene, not event-specific.'],
          reviewStatus: 'needs_review'
        }
      ]
    });
    const grammarRevisions = MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: 'scene',
      revisions: [
        {
          revisionId: 'revision_001',
          gapId: 'gap_001',
          changeType: 'adjust-weight-range',
          targetGrammarRef: 'archetypes.participant.weightRange',
          before: 'first-pass range',
          after: 'accepted support note',
          reason: 'Supported by source claim.',
          sourceClaimIds: ['source_claim_001'],
          confidence: 'medium',
          reviewStatus: 'needs_review'
        }
      ]
    });
    const samples = MetagrinderSamplePromptsArtifactSchema.parse({
      inputId: 'scene',
      samples: [
        {
          sampleId: 'sample_001',
          sampleMode: 'global-baseline',
          selectedArchetypeIds: ['participant'],
          generatedPrompt: 'source-supported participant',
          grammarRefs: ['archetypes.participant'],
          sourceChunkIds: ['chunk']
        }
      ]
    });
    const evaluation = MetagrinderSceneGrammarEvaluationSchema.parse({
      inputId: 'scene',
      distributionTests: [
        {
          testId: 'dist_001',
          sampleCount: 1,
          expected: { participant: '50-60%' },
          observed: { participant: '100%' },
          verdict: 'pass'
        }
      ]
    });
    const plausibility = MetagrinderPlausibilityReviewArtifactSchema.parse({
      inputId: 'scene',
      reviews: [
        {
          sampleId: 'sample_001',
          generatedPrompt: 'source-supported participant',
          scores: {
            periodAccuracy: 0.9,
            eventAttendancePlausibility: 0.9,
            wardrobeCompatibility: 0.9,
            locationCompatibility: 0.9,
            ethicalConstraintCompliance: 1
          },
          verdict: 'plausible',
          reasoningSummary: 'Within constraints.'
        }
      ]
    });

    expect(agentRuns.runs[0].passName).toBe('scene-grammar');
    expect(sceneGrammar.populationModel.baselineWeights[0].label).toBe('participant');
    expect(gaps.gaps[0].gapType).toBe('under-supported-distribution');
    expect(queryPlan.webResearchMode).toBe('gaps-only');
    expect(webResults.adapterMode).toBe('mock');
    expect(sourceRegistry.sources[0].dedupeKey).toBe('archive.example/source');
    expect(sourceClaims.claims[0].sourceId).toBe('source_loc_001');
    expect(grammarRevisions.revisions[0].sourceClaimIds).toContain('source_claim_001');
    expect(samples.samples[0].grammarRefs).toContain('archetypes.participant');
    expect(evaluation.distributionTests[0].verdict).toBe('pass');
    expect(plausibility.reviews[0].verdict).toBe('plausible');
  });


  test('builds structured brief artifacts from scene and non-scene research briefs', () => {
    const cases = [
      ['research-input-historical-crowd-grammar.txt', 'historical-crowd-structured-brief'],
      ['research-input-medieval-market-scene-grammar.txt', 'medieval-market-structured-brief'],
      ['research-input-greenhouse-operations-structured-brief.txt', 'greenhouse-ops-structured-brief'],
      ['research-input-technical-design-structured-brief.txt', 'api-migration-structured-brief']
    ];

    cases.forEach(([fixtureName, inputId]) => {
      const ingestArtifact = buildIngestArtifact({
        inputPath: fixtureName,
        rawText: readTextFixture(fixtureName),
        inputId,
        title: inputId,
        createdAt: '2026-05-02T12:00:00.000Z'
      });
      const structuredBriefArtifact = buildStructuredBriefArtifact({ ingestArtifact });

      expect(() => MetagrinderStructuredBriefArtifactSchema.parse(structuredBriefArtifact)).not.toThrow();
      expect(structuredBriefArtifact.entities.length).toBeGreaterThan(0);
      expect(structuredBriefArtifact.weightedGroups.length).toBeGreaterThan(0);
      expect(structuredBriefArtifact.constraints.length).toBeGreaterThan(0);
      expect(structuredBriefArtifact.coverage.every((entry: any) => entry.status)).toBe(true);
      [...structuredBriefArtifact.entities, ...structuredBriefArtifact.weightedGroups, ...structuredBriefArtifact.constraints]
        .forEach((record: any) => {
          expect(record.sourceInputIds.length).toBeGreaterThan(0);
          expect(record.sourceChunkIds.length).toBeGreaterThan(0);
          expect(record.excerptText.length).toBeGreaterThan(0);
          expect(record.attributionMode).toBe('paraphrased');
          expect(record.confidence).toBeTruthy();
        });
    });
  });

  test('emits Codex semantic parse handoff artifacts and seed-only brief analysis', () => {
    const rawText = readTextFixture('research-input-greenhouse-operations-structured-brief.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'greenhouse-operations.txt',
      rawText,
      inputId: 'greenhouse-operations',
      title: 'Greenhouse Operations Brief',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const structuredBriefSeedArtifact = buildStructuredBriefArtifact({ ingestArtifact });
    const request = buildCodexParseRequestArtifact({
      ingestArtifact,
      structuredBriefSeedArtifact
    });
    const outputSchema = buildCodexParseOutputSchemaArtifact({ inputId: ingestArtifact.inputId });
    const briefAnalysis = buildBriefAnalysisFromSeed({
      ingestArtifact,
      structuredBriefSeedArtifact
    });

    expect(() => MetagrinderCodexParseRequestArtifactSchema.parse(request)).not.toThrow();
    expect(() => MetagrinderCodexParseOutputSchemaArtifactSchema.parse(outputSchema)).not.toThrow();
    expect(() => MetagrinderBriefAnalysisArtifactSchema.parse(briefAnalysis)).not.toThrow();
    expect(request.expectedOutputPath).toBe('codex-parse-result.json');
    expect(request.instructions.join(' ')).toMatch(/main subject/i);
    expect(briefAnalysis.analysisMode).toBe('seed-only');
    expect(briefAnalysis.mainSubject.label).toBe('Greenhouse Operations Brief');
    expect(briefAnalysis.coverage.some((entry: any) =>
      entry.category === 'codexSemanticValidation' && entry.status === 'not_found'
    )).toBe(true);
  });

  test('imported Codex parse result drives scene projection without fixture-prefilled labels', () => {
    const rawText = [
      '# Aquatic Archive Handling Brief',
      '',
      'The main subject is a conservation workbench for wet archive specimens.',
      'Laminar Tray Handler appears frequently, around 45-55%.',
      'Seal Log Reviewer appears less often, around 15-25%.',
      'If context is Wet Intake Bench, increase Laminar Tray Handler and avoid dry cotton gloves.',
      'Do not allow unsealed sample jars.',
      '[a]: https://example.org/archive-handling'
    ].join('\n');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'aquatic-archive.txt',
      rawText,
      inputId: 'aquatic-archive',
      title: 'Aquatic Archive Handling Brief',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const structuredBriefSeedArtifact = buildStructuredBriefArtifact({ ingestArtifact });
    const codexResult = normalizeCodexParseResult({
      ingestArtifact,
      codexParseResult: {
        inputId: 'aquatic-archive',
        analysisMode: 'codex-semantic',
        sourceInputIds: ['aquatic-archive'],
        mainSubject: {
          subjectId: 'aquatic_archive_main_subject',
          label: 'wet archive specimen handling workbench',
          subjectType: 'operations-brief',
          summary: 'A local operations brief for handling wet archive specimens.',
          sourceInputIds: ['aquatic-archive'],
          sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
          excerptText: ingestArtifact.chunks[0].text,
          attributionMode: 'paraphrased',
          confidence: 'high',
          validationStatus: 'supported'
        },
        subjectType: 'operations-brief',
        subcategoryCandidates: [
          {
            subcategoryId: 'laminar_tray_handler',
            label: 'Laminar Tray Handler',
            parentSubjectId: 'aquatic_archive_main_subject',
            supportStatus: 'supported',
            evidenceSummary: 'The text explicitly states this role appears frequently.',
            sourceInputIds: ['aquatic-archive'],
            sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
            excerptText: 'Laminar Tray Handler appears frequently, around 45-55%.',
            attributionMode: 'quoted',
            confidence: 'high',
            validationStatus: 'supported'
          },
          {
            subcategoryId: 'seal_log_reviewer',
            label: 'Seal Log Reviewer',
            parentSubjectId: 'aquatic_archive_main_subject',
            supportStatus: 'supported',
            evidenceSummary: 'The text explicitly names the reviewer role.',
            sourceInputIds: ['aquatic-archive'],
            sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
            excerptText: 'Seal Log Reviewer appears less often, around 15-25%.',
            attributionMode: 'quoted',
            confidence: 'high',
            validationStatus: 'supported'
          },
          {
            subcategoryId: 'unsupported_gallery_guide',
            label: 'Gallery Guide',
            parentSubjectId: 'aquatic_archive_main_subject',
            supportStatus: 'contradicted',
            evidenceSummary: 'No gallery guide role is present in the source text.',
            sourceInputIds: ['aquatic-archive'],
            sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
            excerptText: 'No supporting excerpt.',
            attributionMode: 'inferred',
            confidence: 'low',
            validationStatus: 'contradicted'
          }
        ],
        subcategoryEvidenceChecks: [],
        subcategoryCharacteristics: [
          {
            characteristicId: 'laminar_tools',
            subcategoryId: 'laminar_tray_handler',
            label: 'wet tray handling tools',
            characteristicType: 'wardrobe-or-attribute',
            values: ['laminar tray', 'sealed jar tag'],
            sourceInputIds: ['aquatic-archive'],
            sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
            excerptText: 'wet archive specimens',
            attributionMode: 'paraphrased',
            confidence: 'medium',
            validationStatus: 'supported'
          }
        ],
        weightedGroups: [
          {
            weightId: 'laminar_weight',
            label: 'Laminar Tray Handler',
            min: 45,
            max: 55,
            unit: 'percent',
            appliesTo: 'Laminar Tray Handler',
            sourceInputIds: ['aquatic-archive'],
            sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
            excerptText: 'Laminar Tray Handler appears frequently, around 45-55%.',
            attributionMode: 'quoted',
            confidence: 'high',
            validationStatus: 'supported'
          }
        ],
        rules: [],
        constraints: [],
        examples: [],
        implementationFields: [],
        citations: [{
          citationId: 'citation_a',
          label: 'a',
          url: 'https://example.org/archive-handling',
          citationText: 'Pasted reference',
          verificationStatus: 'unverified-pasted-citation',
          sourceInputIds: ['aquatic-archive'],
          sourceChunkIds: [ingestArtifact.chunks[0].chunkId],
          excerptText: '[a]: https://example.org/archive-handling',
          attributionMode: 'quoted',
          confidence: 'low',
          validationStatus: 'needs_review'
        }],
        researchGaps: [],
        graphAssemblyPlan: {
          readiness: 'ready',
          nodes: [{
            nodeId: 'laminar_tray_handler',
            label: 'Laminar Tray Handler',
            nodeType: 'weighted-choice',
            sourceRecordIds: ['laminar_tray_handler'],
            reviewStatus: 'needs_review'
          }],
          edges: [],
          notes: []
        },
        coverage: []
      }
    });
    const structuredBriefArtifact = buildProjectionStructuredBriefFromAnalysis({
      structuredBriefSeedArtifact,
      briefAnalysisArtifact: codexResult
    });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact,
      structuredBriefArtifact
    });

    expect(() => MetagrinderCodexParseResultArtifactSchema.parse(codexResult)).not.toThrow();
    expect(codexResult.analysisMode).toBe('codex-semantic');
    expect(codexResult.coverage.some((entry: any) => entry.category === 'codexSemanticValidation')).toBe(true);
    expect(sceneGrammarArtifact.reviewFlags).toContain('codex-semantic-projection');
    expect(sceneGrammarArtifact.archetypes.map((entry: any) => entry.label)).toEqual(expect.arrayContaining([
      'Laminar Tray Handler',
      'Seal Log Reviewer'
    ]));
    expect(sceneGrammarArtifact.archetypes.map((entry: any) => entry.label)).not.toContain('Gallery Guide');
    expect(sceneGrammarArtifact.archetypes.map((entry: any) => entry.label)).not.toContain('Middle-class spectator');
    expect(sceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.label === 'Laminar Tray Handler'
    ).weightRange).toMatchObject({ min: 45, max: 55 });
    expect(codexResult.citations[0].verificationStatus).toBe('unverified-pasted-citation');
    const semanticChoiceGraphArtifact = buildSemanticChoiceGraphArtifact({
      briefAnalysisArtifact: codexResult,
      sceneGrammarArtifact
    });
    expect(() => MetagrinderSemanticChoiceGraphArtifactSchema.parse(semanticChoiceGraphArtifact)).not.toThrow();
    expect(semanticChoiceGraphArtifact.analysisMode).toBe('codex-semantic');
    expect(semanticChoiceGraphArtifact.sourceArtifacts).toEqual(expect.arrayContaining([
      'brief-analysis.json',
      'scene-grammar.json'
    ]));
    const semanticPsg = buildSceneGrammarPsg({
      sceneGrammarArtifact,
      semanticChoiceGraphArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    expect(semanticPsg.metadata.semanticProjection.choiceGraphPath).toBe('semantic-choice-graph.json');
    const labels = semanticPsg.nodes.map((node: any) => node.name);
    expect(labels).toEqual(expect.arrayContaining([
      'Age Choice',
      'Sex Choice',
      'Male Role / Type',
      'Male Hat / Hair',
      'Male Top',
      'Male Bottom',
      'Male Footwear',
      'Male Accessories',
      'Male Condition / Behavior',
      'Female Role / Type',
      'Female Hat / Hair',
      'Female Top',
      'Female Bottom',
      'Female Footwear',
      'Female Accessories',
      'Female Condition / Behavior'
    ]));
    expect(semanticPsg.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'age-choice', target: 'sex-choice' }),
      expect.objectContaining({ source: 'sex-choice', sourceHandle: 'branch-0', target: 'male-role-choice' }),
      expect.objectContaining({ source: 'sex-choice', sourceHandle: 'branch-1', target: 'female-role-choice' }),
      expect.objectContaining({ source: 'male-modifier-choice', target: 'male-prompt-output' }),
      expect.objectContaining({ source: 'female-modifier-choice', target: 'female-prompt-output' })
    ]));
    expect(semanticPsg.nodes.some((node: any) => node.id === 'scene-context')).toBe(false);
    expect(semanticPsg.nodes.filter((node: any) => node.type === 'TextBlock').length).toBe(0);
    expect(semanticPsg.nodes.some((node: any) => node.type === 'Concat')).toBe(false);
    expect(semanticPsg.edges.some((edge: any) => edge.targetHandle === 'input1' || edge.targetHandle === 'input2')).toBe(false);
    expect(semanticPsg.edges.some((edge: any) =>
      edge.source === 'male-role-choice' && edge.target === 'female-prompt-output'
    )).toBe(false);
    const roleChoice = semanticPsg.nodes.find((node: any) => node.id === 'male-role-choice');
    expect(roleChoice.options.length).toBeLessThanOrEqual(6);
    expect(roleChoice.options.every((option: any) => option.text.length <= 72)).toBe(true);
    expect(semanticPsg.nodes.filter((node: any) => /^role-detail-/.test(node.id)).length).toBe(0);
    expectPromptSpaghettiPsg(semanticPsg);
  });

  test('keeps semantic PSG weighted choices in coherent attribute buckets', () => {
    const sceneGrammarArtifact = {
      inputId: 'semantic-bucket-regression',
      sceneContext: {
        title: 'Semantic Bucket Regression',
        summary: 'A test scene grammar with deliberately mixed wardrobe notes.'
      },
      reviewFlags: ['codex-semantic-projection'],
      archetypes: [
        {
          archetypeId: 'adult_male_spectator',
          label: 'Adult male spectator baseline',
          promptText: 'Adult male spectator baseline.',
          weightRange: { min: 80, max: 90, unit: 'percent' }
        },
        {
          archetypeId: 'adult_female_spectator',
          label: 'Adult female spectator baseline',
          promptText: 'Adult female spectator in shirtwaist blouse and long skirt.',
          weightRange: { min: 8, max: 12, unit: 'percent' }
        },
        {
          archetypeId: 'trackside_rail_zone',
          label: 'Trackside rail / fence',
          promptText: 'A location zone, not a role.',
          weightRange: { min: 1, max: 1, unit: 'percent' }
        },
        {
          archetypeId: 'male_spectator_wardrobe',
          label: 'Male Spectator Wardrobe',
          promptText: 'A wardrobe section heading, not a role.',
          weightRange: { min: 1, max: 1, unit: 'percent' }
        }
      ],
      wardrobeSystem: [
        {
          label: 'Male Spectator Wardrobe',
          items: [
            'Headwear: straw boater hat with dark band - flat cap',
            'Upper Body: white shirt with suspenders + dark sack suit jacket',
            'Lower Body: straight cuffed trousers - dark trousers - long skirt',
            'Footwear: leather oxford shoes - lace-up boots - spats or gaiters',
            'Accessories/Shoes: Starched collars, ties, and sturdy boots or oxfords.'
          ]
        },
        {
          label: 'Female Spectator Wardrobe',
          items: [
            'Headwear: large wide-brimmed picture hat - smaller ornate hat or toque with veil',
            'Upper Body: white shirtwaist blouse + tailored jacket or bolero - full Edwardian day dress',
            'Lower Body: long dark skirt - hobble skirt - matching suit skirt',
            'Footwear: practical laced shoes with lower heels',
            'Accessories: parasol - gloves - small handbag or fan'
          ]
        },
        {
          label: 'Palette Constraints',
          items: ['muted', 'dusty', 'outdoor-appropriate', 'mostly dark suits + white shirts']
        },
        {
          label: 'Environmental Modifiers',
          items: ['dust accumulation', 'sweat / heat fatigue', 'fabric wear']
        },
        {
          label: 'Behavioral Modifiers',
          items: ['leaning on rail', 'watching track', 'walking group']
        }
      ],
      propsAndAccessories: [],
      behaviorStates: [],
      environmentalModifiers: []
    };
    const semanticChoiceGraphArtifact = buildSemanticChoiceGraphArtifact({
      briefAnalysisArtifact: {
        inputId: 'semantic-bucket-regression',
        analysisMode: 'codex-semantic',
        mainSubject: {
          subjectId: 'semantic_bucket_regression',
          label: 'semantic bucket regression',
          subjectType: 'scene',
          summary: 'A test semantic bucket regression.',
          sourceInputIds: [],
          sourceChunkIds: [],
          excerptText: '',
          attributionMode: 'inferred',
          confidence: 'medium',
          validationStatus: 'supported'
        },
        subjectType: 'scene',
        graphAssemblyPlan: {
          readiness: 'ready',
          nodes: [],
          edges: [],
          notes: []
        },
        coverage: []
      },
      sceneGrammarArtifact
    });
    expect(() => MetagrinderSemanticChoiceGraphArtifactSchema.parse(semanticChoiceGraphArtifact)).not.toThrow();
    const axisOptionsFor = (axisId: string) => semanticChoiceGraphArtifact.axes
      .find((axis: any) => axis.axisId === axisId)
      .choices
      .map((option: any) => option.text)
      .join(' | ');
    expect(axisOptionsFor('male_top')).toMatch(/shirt|suspenders|suit jacket/i);
    expect(axisOptionsFor('male_top')).not.toMatch(/blouse|bolero|day dress|skirt|parasol/i);
    expect(axisOptionsFor('female_bottom')).toMatch(/skirt/i);
    expect(axisOptionsFor('female_bottom')).not.toMatch(/trouser|suspenders/i);
    const semanticPsg = buildSceneGrammarPsg({
      sceneGrammarArtifact,
      semanticChoiceGraphArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    const optionsFor = (id: string) => semanticPsg.nodes
      .find((node: any) => node.id === id)
      .options
      .map((option: any) => option.text)
      .join(' | ');

    expect(semanticPsg.nodes.some((node: any) => node.id === 'scene-context')).toBe(false);
    expect(semanticPsg.nodes.filter((node: any) => node.type === 'TextBlock').length).toBe(0);
    expect(optionsFor('male-role-choice')).toMatch(/who is a .*spectator/i);
    expect(optionsFor('male-role-choice')).not.toMatch(/female|rail|wardrobe/i);
    expect(optionsFor('female-role-choice')).toMatch(/who is a .*spectator/i);
    expect(optionsFor('female-role-choice')).not.toMatch(/\bmale\b|rail|wardrobe/i);
    expect(optionsFor('age-choice')).toMatch(/an adult/i);
    expect(optionsFor('age-choice')).not.toMatch(/if supported|when supported|needs reviewed/i);
    expect(optionsFor('male-role-choice')).toMatch(/who is a .*spectator/i);
    expect(optionsFor('male-headwear-choice')).toMatch(/straw boater|flat cap/i);
    expect(optionsFor('male-headwear-choice')).toMatch(/with .*straw boater|bareheaded/i);
    expect(optionsFor('male-headwear-choice')).not.toMatch(/shirt|trouser|boot|tie|dust|picture hat|toque|veil/i);
    expect(optionsFor('female-headwear-choice')).toMatch(/picture hat|toque|veil/i);
    expect(optionsFor('female-headwear-choice')).not.toMatch(/flat cap|trouser|boot|tie|dust/i);
    expect(optionsFor('male-upper-body-choice')).toMatch(/shirt|suspenders|suit jacket/i);
    expect(optionsFor('male-upper-body-choice')).toMatch(/wearing/i);
    expect(optionsFor('male-upper-body-choice')).not.toMatch(/blouse|bolero|day dress|skirt|parasol|dust/i);
    expect(optionsFor('female-upper-body-choice')).toMatch(/shirtwaist blouse|tailored jacket|bolero|day dress/i);
    expect(optionsFor('female-upper-body-choice')).not.toMatch(/suspenders|waistcoat|trouser|oxford|starched collar|tie|dust/i);
    expect(optionsFor('male-lower-body-choice')).toMatch(/trouser/i);
    expect(optionsFor('male-lower-body-choice')).toMatch(/with/i);
    expect(optionsFor('male-lower-body-choice')).not.toMatch(/skirt|hobble|shirt|boot|tie|dust/i);
    expect(optionsFor('female-lower-body-choice')).toMatch(/skirt/i);
    expect(optionsFor('female-lower-body-choice')).not.toMatch(/trouser|suspenders|hat|shirt|boot|tie|dust/i);
    expect(optionsFor('male-footwear-choice')).toMatch(/oxford|boot|spats|gaiters/i);
    expect(optionsFor('male-footwear-choice')).not.toMatch(/hat|shirt|trouser|tie|dust|heels/i);
    expect(optionsFor('female-footwear-choice')).toMatch(/laced shoes|heels/i);
    expect(optionsFor('female-footwear-choice')).not.toMatch(/trouser|suspenders|tie|dust/i);
    expect(optionsFor('male-accessories-choice')).toMatch(/starched collars|ties/i);
    expect(optionsFor('male-accessories-choice')).not.toMatch(/boot|oxford|shirt|trouser|dust|parasol|handbag/i);
    expect(optionsFor('female-accessories-choice')).toMatch(/parasol|gloves|handbag|fan/i);
    expect(optionsFor('female-accessories-choice')).not.toMatch(/trouser|suspenders|boot|oxford|dust/i);
    expect(optionsFor('male-modifier-choice')).toMatch(/dust accumulation|sweat|leaning|watching|walking/i);
    expect(optionsFor('male-modifier-choice')).toMatch(/showing dust|showing sweat|leaning|watching|walking/i);
    expect(optionsFor('female-modifier-choice')).toMatch(/dust accumulation|sweat|leaning|watching|walking/i);
    expect(optionsFor('male-modifier-choice')).not.toMatch(/starched collar|tie|hat|shirt|boot/i);
    expect(optionsFor('female-modifier-choice')).not.toMatch(/starched collar|tie|hat|shirt|boot/i);
    semanticPsg.nodes
      .filter((node: any) => node.type === 'WeightedChoice')
      .flatMap((node: any) => node.options)
      .forEach((option: any) => {
        expect(option.text).not.toMatch(/\b(if|when)\s+supported\b|needs reviewed/i);
      });
    expect(semanticPsg.nodes.some((node: any) => node.type === 'Concat')).toBe(false);
    expect(semanticPsg.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'sex-choice', sourceHandle: 'branch-0', target: 'male-role-choice' }),
      expect.objectContaining({ source: 'sex-choice', sourceHandle: 'branch-1', target: 'female-role-choice' }),
      expect.objectContaining({ source: 'male-modifier-choice', target: 'male-prompt-output' }),
      expect.objectContaining({ source: 'female-modifier-choice', target: 'female-prompt-output' })
    ]));
    expect(semanticPsg.edges.some((edge: any) =>
      edge.target === 'male-prompt-output' && edge.source !== 'male-modifier-choice'
    )).toBe(false);
    expect(semanticPsg.edges.some((edge: any) =>
      edge.target === 'female-prompt-output' && edge.source !== 'female-modifier-choice'
    )).toBe(false);
    expectPromptSpaghettiPsg(semanticPsg);
  });

  test('generates deterministic PSG readability flights from semantic choices', () => {
    const semanticChoiceGraphArtifact = testSemanticChoiceGraph();
    const psgArtifact = {
      fileType: 'psg',
      formatVersion: '2.0.0',
      metadata: {},
      graph: { nodes: [], edges: [] }
    };
    const first = buildPsgOutputFlightArtifact({
      inputId: semanticChoiceGraphArtifact.inputId,
      graphPath: 'scene-grammar.psg',
      psgArtifact,
      semanticChoiceGraphArtifact,
      sampleCount: 20,
      createdAt: '2026-05-06T00:00:00.000Z'
    });
    const second = buildPsgOutputFlightArtifact({
      inputId: semanticChoiceGraphArtifact.inputId,
      graphPath: 'scene-grammar.psg',
      psgArtifact,
      semanticChoiceGraphArtifact,
      sampleCount: 20,
      createdAt: '2026-05-06T00:00:00.000Z'
    });

    expect(() => MetagrinderPsgOutputFlightArtifactSchema.parse(first)).not.toThrow();
    expect(first.samples).toHaveLength(20);
    expect(first).toEqual(second);
    expect(first.samples[0].selectedChoices.map((choice: any) => choice.choiceId)).toEqual(
      expect.arrayContaining(['age_adult', 'sex_male'])
    );
    first.samples.forEach((sample: any) => {
      expect(sample.outputText).toMatch(/\b(adult|Child if supported)\b/);
      expect(sample.selectedChoices.length).toBeGreaterThan(1);
    });
  });

  test('flags readability issues and applies only text-only choice rewrites', () => {
    const semanticChoiceGraphArtifact = testSemanticChoiceGraph();
    const psgArtifact = {
      fileType: 'psg',
      formatVersion: '2.0.0',
      metadata: {},
      graph: { nodes: [], edges: [] }
    };
    const outputFlight = buildPsgOutputFlightArtifact({
      inputId: semanticChoiceGraphArtifact.inputId,
      graphPath: 'scene-grammar.psg',
      psgArtifact,
      semanticChoiceGraphArtifact,
      sampleCount: 20,
      createdAt: '2026-05-06T00:00:00.000Z'
    });
    const review = buildPsgReadabilityReviewArtifact({
      inputId: semanticChoiceGraphArtifact.inputId,
      flightArtifact: outputFlight,
      semanticChoiceGraphArtifact,
      createdAt: '2026-05-06T00:00:00.000Z'
    });

    expect(() => MetagrinderPsgReadabilityReviewArtifactSchema.parse(review)).not.toThrow();
    expect(review.findings.map((finding: any) => finding.findingType)).toEqual(expect.arrayContaining([
      'scaffold-phrase',
      'missing-phrase-lead'
    ]));

    const resultArtifact = MetagrinderCodexSweetenResultArtifactSchema.parse({
      inputId: semanticChoiceGraphArtifact.inputId,
      rewrites: [
        {
          choiceId: 'age_child_if_supported',
          beforeText: 'Child if supported',
          afterText: 'a child spectator when the source material supports children',
          reason: 'Make the age fragment read as a sentence phrase.'
        },
        {
          choiceId: 'male_dust',
          beforeText: 'dust accumulation',
          afterText: 'showing dust on clothing and shoes',
          reason: 'Turn the condition label into a prompt phrase.'
        }
      ]
    });
    const rewrites = validateSweetenResult({
      semanticChoiceGraphArtifact,
      resultArtifact
    });
    const nextGraphResult = applySweetenRewrites({
      semanticChoiceGraphArtifact,
      rewrites
    });
    const nextGraph = nextGraphResult.semanticChoiceGraphArtifact;
    const ageChoice = nextGraph.axes.find((axis: any) => axis.axisId === 'age').choices
      .find((choice: any) => choice.choiceId === 'age_child_if_supported');
    const dustChoice = nextGraph.axes.find((axis: any) => axis.axisId === 'male_condition_behavior').choices
      .find((choice: any) => choice.choiceId === 'male_dust');

    expect(ageChoice.text).toBe('a child spectator when the source material supports children');
    expect(ageChoice.weight).toBe(15);
    expect(dustChoice.text).toBe('showing dust on clothing and shoes');
    expect(nextGraph.axes.map((axis: any) => axis.axisId)).toEqual(semanticChoiceGraphArtifact.axes.map((axis: any) => axis.axisId));
    expect(nextGraph.edges).toEqual(semanticChoiceGraphArtifact.edges);
    expect(() => validateSweetenResult({
      semanticChoiceGraphArtifact,
      resultArtifact: {
        inputId: semanticChoiceGraphArtifact.inputId,
        rewrites: [{
          choiceId: 'unknown_choice',
          beforeText: 'nope',
          afterText: 'new text',
          reason: 'bad'
        }]
      }
    })).toThrow(/unknown choiceId/i);
    expect(() => validateSweetenResult({
      semanticChoiceGraphArtifact,
      resultArtifact: {
        inputId: semanticChoiceGraphArtifact.inputId,
        rewrites: [{
          choiceId: 'male_dust',
          beforeText: 'wrong text',
          afterText: 'showing dust on clothing and shoes',
          reason: 'bad'
        }]
      }
    })).toThrow(/beforeText mismatch/);
  });

  test('projects scene grammar from generic structured records without known fixture labels', () => {
    const rawText = [
      '# Greenhouse Canopy Specimen Brief',
      '',
      '## Canopy Surveyor Agent',
      'Canopy Surveyor Agent: 40-50%.',
      '- copper visor',
      '- field notebook',
      '- clipped sampling tags',
      '',
      '## Mist Calibrator Role',
      'Mist Calibrator Role: 20-30%.',
      '- brass nozzle key',
      '- damp apron',
      '- timing card',
      '',
      '## Deck Platform Zone',
      'Deck Platform Zone: worker group 60-70%.',
      'If context is Deck Platform Zone: increase Canopy Surveyor Agent, force clipped sampling tags, avoid bare hands.',
      '',
      '## Lower Pump Aisle Zone',
      'Rare but critical maintenance context.',
      'If context is Lower Pump Aisle Zone: increase Mist Calibrator Role and decrease visitors.',
      '',
      'Constraints:',
      '- Do not include plastic safety cones.',
      '- Must not mix visitor clothing with calibrated work aprons.',
      '',
      'Implementation fields:',
      '{',
      '  "role": "surveyor | calibrator",',
      '  "context": "deck_platform | lower_pump_aisle",',
      '  "conditionState": "dry | misted | overflow"',
      '}',
      '',
      'Example specimen prompt: "full body greenhouse canopy surveyor, neutral stance, copper visor, field notebook, controlled studio lighting."',
      '',
      '[1]: https://example.org/greenhouse-canopy'
    ].join('\n');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'greenhouse-canopy-brief.txt',
      rawText,
      inputId: 'greenhouse-canopy-brief',
      title: 'Greenhouse Canopy Brief',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const structuredBriefArtifact = buildStructuredBriefArtifact({ ingestArtifact });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact,
      structuredBriefArtifact
    });

    expect(structuredBriefArtifact.weightedGroups.some((weight: any) =>
      weight.label === 'Canopy Surveyor Agent' && weight.min === 40 && weight.max === 50
    )).toBe(true);
    expect(structuredBriefArtifact.rules.length).toBeGreaterThanOrEqual(2);
    expect(structuredBriefArtifact.constraints.some((constraint: any) => /plastic safety cones/i.test(constraint.text))).toBe(true);
    expect(structuredBriefArtifact.implementationFields.some((field: any) => field.name === 'role')).toBe(true);
    expect(structuredBriefArtifact.citations[0]).toMatchObject({
      url: 'https://example.org/greenhouse-canopy',
      verificationStatus: 'unverified-pasted-citation'
    });

    const archetypeLabels = sceneGrammarArtifact.archetypes.map((archetype: any) => archetype.label);
    expect(archetypeLabels).toEqual(expect.arrayContaining(['Canopy Surveyor Agent', 'Mist Calibrator Role']));
    const canopy = sceneGrammarArtifact.archetypes.find((archetype: any) => archetype.label === 'Canopy Surveyor Agent');
    expect(canopy.weightRange).toMatchObject({ min: 40, max: 50, unit: 'percent' });
    expect(sceneGrammarArtifact.locationZones.some((zone: any) => zone.label === 'Deck Platform Zone')).toBe(true);
    expect(sceneGrammarArtifact.compatibilityRules.some((rule: any) =>
      /Deck Platform Zone/i.test(rule.condition?.value) && rule.effects.some((effect: any) => /canopy_surveyor/i.test(effect.target))
    )).toBe(true);
    expect(sceneGrammarArtifact.negativeConstraints.some((constraint: any) => /plastic safety cones/i.test(constraint.text))).toBe(true);
    expect(sceneGrammarArtifact.reviewFlags).toContain('structured-brief-projection');
  });


  test('structured brief extraction is input-driven and not fixture-prefilled', () => {
    const buildProjected = (labelA: string, weightA: string, labelB: string, weightB: string) => {
      const slug = labelA.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const rawText = [
        '# Synthetic Operations Brief',
        '',
        '## ' + labelA,
        labelA + ': ' + weightA + '.',
        '- amber checklist',
        '- numbered wrist tags',
        '',
        '## ' + labelB,
        labelB + ': ' + weightB + '.',
        '- blue routing ledger',
        '- sealed sample case',
        '',
        '## North Service Deck Zone',
        'If context is North Service Deck Zone: increase ' + labelA + ', force amber checklist, avoid untagged cases.',
        '',
        'Constraints:',
        '- Do not include visitor badges.',
        '- Must not mix blue routing ledgers with amber checklists.',
        '',
        'Implementation fields:',
        '{',
        '  "role": "string",',
        '  "zone": "north_service_deck | sample_lockup"',
        '}'
      ].join('\n');
      const ingestArtifact = buildIngestArtifact({
        inputPath: slug + '.txt',
        rawText,
        inputId: slug + '-input',
        title: labelA,
        createdAt: '2026-05-02T12:00:00.000Z'
      });
      const extractArtifact = buildExtractArtifact({ ingestArtifact });
      const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
      const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
      const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
      const structuredBriefArtifact = buildStructuredBriefArtifact({ ingestArtifact });
      const sceneGrammarArtifact = buildSceneGrammarArtifact({
        ingestArtifact,
        extractArtifact,
        classifyArtifact,
        synthesizeArtifact,
        sourceModeArtifact,
        structuredBriefArtifact
      });
      return { structuredBriefArtifact, sceneGrammarArtifact };
    };

    const first = buildProjected('Quartz Archivist Role', '31-37%', 'Cedar Relay Operator', '12-18%');
    const second = buildProjected('Mica Dispatch Steward', '44-49%', 'Harbor Sample Runner', '7-11%');

    expect(first.structuredBriefArtifact.weightedGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Quartz Archivist Role', min: 31, max: 37 }),
      expect.objectContaining({ label: 'Cedar Relay Operator', min: 12, max: 18 })
    ]));
    expect(second.structuredBriefArtifact.weightedGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Mica Dispatch Steward', min: 44, max: 49 }),
      expect.objectContaining({ label: 'Harbor Sample Runner', min: 7, max: 11 })
    ]));

    const firstLabels = first.sceneGrammarArtifact.archetypes.map((archetype: any) => archetype.label);
    const secondLabels = second.sceneGrammarArtifact.archetypes.map((archetype: any) => archetype.label);
    expect(firstLabels).toEqual(expect.arrayContaining(['Quartz Archivist Role', 'Cedar Relay Operator']));
    expect(secondLabels).toEqual(expect.arrayContaining(['Mica Dispatch Steward', 'Harbor Sample Runner']));
    expect(firstLabels).not.toEqual(expect.arrayContaining(['Mica Dispatch Steward', 'Harbor Sample Runner']));
    expect(secondLabels).not.toEqual(expect.arrayContaining(['Quartz Archivist Role', 'Cedar Relay Operator']));
    expect([...firstLabels, ...secondLabels].some((label: string) => /middle-class spectator|heat-adjusted spectator|working-class trackside/i.test(label))).toBe(false);

    const firstQuartz = first.sceneGrammarArtifact.archetypes.find((archetype: any) => archetype.label === 'Quartz Archivist Role');
    const secondMica = second.sceneGrammarArtifact.archetypes.find((archetype: any) => archetype.label === 'Mica Dispatch Steward');
    expect(firstQuartz.weightRange).toMatchObject({ min: 31, max: 37 });
    expect(secondMica.weightRange).toMatchObject({ min: 44, max: 49 });
  });

  test('builds generic scene grammar artifacts from historical crowd fixture', () => {
    const rawText = readTextFixture('research-input-historical-crowd-grammar.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-historical-crowd-grammar.txt',
      rawText,
      inputId: 'research-input-historical-crowd-grammar',
      title: 'Early twentieth-century public spectacle crowd scene grammar notes',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact
    });
    const researchGapArtifact = buildResearchGapArtifact({ sceneGrammarArtifact });
    const researchQueryPlan = buildResearchQueryPlan({ researchGapArtifact });
    const webResearchResults = buildWebResearchResults({
      researchQueryPlan,
      researchGapArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    const sourceRegistryArtifact = buildSourceRegistryArtifact({
      ingestArtifact,
      webResearchResults
    });
    const sourceClaimsArtifact = buildSourceClaimsArtifact({
      sourceRegistryArtifact,
      webResearchResults,
      researchGapArtifact
    });
    const grammarRevisionArtifact = buildGrammarRevisionArtifact({
      sceneGrammarArtifact,
      researchGapArtifact,
      webResearchResults,
      sourceClaimsArtifact
    });
    const samplePromptsArtifact = buildSamplePromptsArtifact({ sceneGrammarArtifact });
    const sceneGrammarEvaluation = buildSceneGrammarEvaluation({
      sceneGrammarArtifact,
      samplePromptsArtifact,
      grammarRevisionArtifact
    });
    const plausibilityReviewArtifact = buildPlausibilityReviewArtifact({
      sceneGrammarArtifact,
      samplePromptsArtifact
    });
    const sceneGrammarPsg = buildSceneGrammarPsg({
      sceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    const branchGraphPsgs = buildBranchSceneGrammarPsgs({
      sceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });

    expect(sourceModeArtifact.chunkModes.some((entry: any) => entry.modes.includes('ethical-constraint'))).toBe(true);
    expect(sceneGrammarArtifact.archetypes.length).toBeGreaterThanOrEqual(5);
    expect(sceneGrammarArtifact.populationModel.baselineWeights.length).toBeGreaterThanOrEqual(5);
    expect(sceneGrammarArtifact.locationZones.length).toBeGreaterThanOrEqual(3);
    expect(sceneGrammarArtifact.compatibilityRules.length).toBeGreaterThanOrEqual(4);
    expect(sceneGrammarArtifact.negativeConstraints.length).toBeGreaterThanOrEqual(5);
    expect(sceneGrammarArtifact.environmentalModifiers.length).toBeGreaterThanOrEqual(2);
    expect(sceneGrammarArtifact.visualReferenceSets.length).toBeGreaterThanOrEqual(1);
    expect(new Set(sceneGrammarArtifact.archetypes.map((archetype: any) =>
      `${archetype.weightRange?.min}-${archetype.weightRange?.max}`
    )).size).toBeGreaterThan(1);
    expect(sceneGrammarArtifact.archetypes.some((archetype: any) =>
      archetype.archetypeId === 'middle_class_spectator' &&
        archetype.dominantAttributes.includes('straw boater')
    )).toBe(true);
    expect(
      sceneGrammarArtifact.negativeConstraints.some(
        (constraint: any) => constraint.constraintType.includes('ethical') &&
          constraint.enforcedByRuleIds.includes('ethical_representation_not_worker_only')
      )
    ).toBe(true);
    expect(sceneGrammarArtifact.archetypes.every((archetype: any) => archetype.sourceChunkIds.length > 0)).toBe(true);

    expect(researchGapArtifact.gaps.some((gap: any) => gap.gapType === 'under-supported-distribution')).toBe(true);
    expect(researchGapArtifact.gaps.some((gap: any) => gap.gapType === 'missing-behavior-model')).toBe(true);
    expect(researchGapArtifact.gaps.some((gap: any) => gap.gapType === 'missing-location-distribution')).toBe(true);
    expect(researchGapArtifact.gaps.some((gap: any) => gap.gapType === 'negative-constraint-not-enforced')).toBe(true);
    expect(researchQueryPlan.queries.length).toBeGreaterThan(0);
    expect(researchQueryPlan.queries.every((query: any) =>
      query.gapId && query.purpose && query.allowedSourceTypes.length > 0 && query.maxResults === 5
    )).toBe(true);
    expect(webResearchResults.adapterMode).toBe('mock');
    expect(webResearchResults.results.some((result: any) => result.sourceType === 'archival-photo')).toBe(true);
    expect(webResearchResults.results.some((result: any) => result.sourceType === 'low-quality-source')).toBe(true);
    expect(webResearchResults.results.every((result: any) =>
      result.gapId && result.claimsExtracted.length > 0 && result.limitations.length > 0
    )).toBe(true);
    expect(sourceRegistryArtifact.sources.some((source: any) => source.sourceKind === 'web-result')).toBe(true);
    expect(sourceClaimsArtifact.claims.every((claim: any) =>
      claim.sourceId && claim.evidenceText && claim.evidenceLocator.accessDate
    )).toBe(true);
    expect(grammarRevisionArtifact.revisions.length).toBeGreaterThan(0);
    expect(grammarRevisionArtifact.revisions.every((revision: any) =>
      revision.before && revision.after && revision.sourceClaimIds.length > 0
    )).toBe(true);
    expect(grammarRevisionArtifact.revisions.every((revision: any) =>
      revision.changeType !== 'flag-low-quality-source' || revision.confidence === 'low'
    )).toBe(true);

    expect(samplePromptsArtifact.samples.some((sample: any) => sample.sampleMode === 'global-baseline')).toBe(true);
    expect(samplePromptsArtifact.samples.some((sample: any) => sample.sampleMode === 'location-zone')).toBe(true);
    expect(samplePromptsArtifact.samples.some((sample: any) => sample.sampleMode === 'archetype')).toBe(true);
    expect(samplePromptsArtifact.samples.some((sample: any) => sample.sampleMode === 'invalid-test')).toBe(true);
    expect(samplePromptsArtifact.samples.some((sample: any) => sample.locationZone === 'rail' && /shirt|suspenders|rail/i.test(sample.generatedPrompt))).toBe(true);
    expect(samplePromptsArtifact.samples.some((sample: any) => sample.locationZone === 'pit' && /worker|official|mechanic|driver|press/i.test(sample.generatedPrompt))).toBe(true);
    expect(samplePromptsArtifact.samples.every((sample: any) => sample.grammarRefs.length > 0)).toBe(true);
    expect(samplePromptsArtifact.samples.every((sample: any) => !/t-?shirt|jersey|baseball cap|shorts/i.test(sample.generatedPrompt))).toBe(true);
    expect(sceneGrammarEvaluation.distributionTests[0].verdict).toBe('pass');
    expect(sceneGrammarEvaluation.distributionTests.some((test: any) => test.testId.includes('rail_branch'))).toBe(true);
    expect(sceneGrammarEvaluation.criticFlags.some((flag: any) => flag.code === 'ethical-stereotype-risk')).toBe(false);
    expect(plausibilityReviewArtifact.reviews.some((review: any) => review.verdict === 'plausible')).toBe(true);
    expect(plausibilityReviewArtifact.reviews.some((review: any) => review.verdict === 'fail')).toBe(true);
    expect(plausibilityReviewArtifact.reviews.some((review: any) =>
      review.failureReasons.some((reason: string) => reason.includes('Pit zone should force'))
    )).toBe(true);
    expectPromptSpaghettiPsg(sceneGrammarPsg);
    expect(sceneGrammarPsg.nodes.some((node: any) => node.type === 'WeightedChoice')).toBe(true);
    expect(sceneGrammarPsg.nodes.some((node: any) => node.type === 'Concat')).toBe(false);
    expect(Object.keys(branchGraphPsgs)).toEqual(expect.arrayContaining([
      'scene-global-baseline.psg',
      'scene-grandstand-branch.psg',
      'scene-rail-branch.psg',
      'scene-pit-branch.psg',
      'scene-negative-constraints.psg',
      'scene-specimen-reference-router.psg'
    ]));
    Object.values(branchGraphPsgs).forEach((graph: any) => {
      expectPromptSpaghettiPsg(graph);
      expect(graph.nodes.some((node: any) => node.type === 'Concat')).toBe(false);
    });
    const pitChoice = branchGraphPsgs['scene-pit-branch.psg'].nodes.find((node: any) => node.type === 'WeightedChoice');
    expect(pitChoice.options.every((choice: any) => /worker|official|mechanic|driver|press/i.test(choice.text))).toBe(true);
  });

  test('extracts generic scene grammar from medieval market fixture', () => {
    const rawText = readTextFixture('research-input-medieval-market-scene-grammar.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-medieval-market-scene-grammar.txt',
      rawText,
      inputId: 'research-input-medieval-market-scene-grammar',
      title: 'Medieval Market Scene Grammar',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact
    });
    const researchGapArtifact = buildResearchGapArtifact({ sceneGrammarArtifact });
    const samplePromptsArtifact = buildSamplePromptsArtifact({ sceneGrammarArtifact });
    const sceneGrammarPsg = buildSceneGrammarPsg({
      sceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    const branchGraphPsgs = buildBranchSceneGrammarPsgs({
      sceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });

    expect(sceneGrammarArtifact.archetypes.length).toBeGreaterThanOrEqual(3);
    expect(sceneGrammarArtifact.locationZones.length).toBeGreaterThanOrEqual(2);
    expect(sceneGrammarArtifact.compatibilityRules.length).toBeGreaterThanOrEqual(2);
    expect(sceneGrammarArtifact.negativeConstraints.length).toBeGreaterThanOrEqual(2);
    expect(sceneGrammarArtifact.visualReferenceSets.length).toBeGreaterThanOrEqual(1);
    expect(researchGapArtifact.gaps.length).toBeGreaterThan(0);
    expect(samplePromptsArtifact.samples.length).toBeGreaterThan(0);
    expectPromptSpaghettiPsg(sceneGrammarPsg);
    Object.values(branchGraphPsgs).forEach((graph: any) => {
      expectPromptSpaghettiPsg(graph);
      graph.nodes
        .filter((node: any) => node.type === 'WeightedChoice')
        .forEach((node: any) => {
          expect(node.options.every((choice: any) =>
            typeof choice.text === 'string' && typeof choice.weight === 'number'
          )).toBe(true);
        });
    });
  });

  test('extracts historical crowd constraints from perturbed wording', () => {
    const rawText = `
# Perturbed historical crowd grammar

Middle-class spectator: adult male baseline, dark suit, white shirt, tie, leather shoes, straw boater or bowler. This group makes up roughly half to three-fifths of the visible crowd.

Heat-adjusted spectator: adult male with straw boater, white shirt, suspenders visible, jacket removed or carried, sleeves rolled, dark trousers, dusty shoes. This group is about one-fifth to one-third of the visible crowd.

Female middle-class spectator: adult woman in shirtwaist blouse, long skirt, large hat, gloves, parasol, or structured handbag. Female spectators are rare in number but visually significant and should appear more often in grandstand and social viewing zones than near the rail.

African American or otherwise underrepresented local community spectator: include middle-class and working-class spectators with the same public dress and spectator behavior as comparable attendees. Avoid reducing African American figures to labor roles only.

Location-zone logic:
Near the rail, bias the generated people toward adult men, shirtsleeves, working-class and lower-middle-class spectators, and jacket-removed heat states; reduce children and affluent women.
Grandstand seating should bias toward adult women, children, family groups, middle-class spectators, and complete outfits.
Pit or official area should force worker, official, driver, mechanic, or press roles and exclude casual viewer-only archetypes.

Wardrobe systems:
Formal daywear includes sack suits, waistcoats, stiff collars, ties, leather shoes, straw boaters, bowlers, and subdued colors.
Heat-adjusted daywear includes white shirts, suspenders, jacket removed, sleeves rolled, dusty shoes, and loosened ties.
Female public daywear includes shirtwaist blouses, long skirts, large decorated hats, gloves, scarves, parasols, and practical laced shoes.

Visual reference notes:
Visual reference caption: dense rows of male spectators in straw boaters and dark suits with high silhouette uniformity.

Negative constraints:
Avoid modern T-shirts, shorts, baseball caps, and modern sunglasses.
Ethical constraint: avoid reducing African American figures to labor roles only; allow spectator and family-member variants where spatially logical.
`;
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'perturbed-historical-crowd.txt',
      rawText,
      inputId: 'perturbed-historical-crowd',
      title: 'Perturbed Historical Crowd',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact
    });

    const middleClass = sceneGrammarArtifact.archetypes.find((archetype: any) =>
      archetype.archetypeId === 'middle_class_spectator'
    );
    expect(middleClass?.weightRange?.min).toBe(50);
    expect(middleClass?.weightRange?.max).toBe(60);
    expect(sceneGrammarArtifact.archetypes.some((archetype: any) =>
      archetype.archetypeId === 'female_middle_class_spectator' &&
        archetype.weightRange?.min === 5 &&
        archetype.weightRange?.max === 8
    )).toBe(true);
    expect(sceneGrammarArtifact.compatibilityRules.some((rule: any) =>
      rule.ruleId === 'rail_bias_rule' &&
        rule.effects.some((effect: any) => effect.target === 'shirtsleeves')
    )).toBe(true);
    expect(sceneGrammarArtifact.negativeConstraints.some((constraint: any) =>
      constraint.constraintType.includes('ethical') &&
        constraint.text.includes('underrepresented groups')
    )).toBe(true);
  });

  test('enforces sampler, evaluator, Prompt Spaghetti PSG, and mock web adapter contracts', () => {
    const rawText = readTextFixture('research-input-historical-crowd-grammar.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-historical-crowd-grammar.txt',
      rawText,
      inputId: 'research-input-historical-crowd-grammar',
      title: 'Early twentieth-century public spectacle crowd scene grammar notes',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact
    });
    const researchGapArtifact = buildResearchGapArtifact({ sceneGrammarArtifact });
    const researchQueryPlan = buildResearchQueryPlan({ researchGapArtifact });
    const webResearchResults = researchWebResearchService.createMockWebResearchAdapter({
      now: () => '2026-05-02T12:00:00.000Z'
    }).retrieve({ researchQueryPlan, researchGapArtifact });
    const sourceRegistryArtifact = buildSourceRegistryArtifact({
      ingestArtifact,
      webResearchResults
    });
    const sourceClaimsArtifact = buildSourceClaimsArtifact({
      sourceRegistryArtifact,
      webResearchResults,
      researchGapArtifact
    });
    const samplePromptsArtifact = buildSamplePromptsArtifact({ sceneGrammarArtifact });
    const grammarRevisionArtifact = buildGrammarRevisionArtifact({
      sceneGrammarArtifact,
      researchGapArtifact,
      webResearchResults,
      sourceClaimsArtifact
    });
    const sceneGrammarEvaluation = buildSceneGrammarEvaluation({
      sceneGrammarArtifact,
      samplePromptsArtifact,
      grammarRevisionArtifact
    });
    const plausibilityReviewArtifact = buildPlausibilityReviewArtifact({
      sceneGrammarArtifact,
      samplePromptsArtifact
    });
    const branchGraphPsgs = buildBranchSceneGrammarPsgs({
      sceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });

    const pitSample = samplePromptsArtifact.samples.find((sample: any) => sample.locationZone === 'pit');
    expect(pitSample.generatedPrompt).toMatch(/worker|official|driver|mechanic|press/i);
    expect(pitSample.generatedPrompt).toMatch(/not a casual viewer/i);

    const railSample = samplePromptsArtifact.samples.find((sample: any) => sample.locationZone === 'rail');
    expect(railSample.selectedArchetypeIds).not.toEqual(expect.arrayContaining(['female_middle_class_spectator', 'child_or_teen_spectator']));

    const grandstandSamples = samplePromptsArtifact.samples.filter((sample: any) => sample.locationZone === 'grandstand');
    expect(grandstandSamples.some((sample: any) =>
      /female|child|family|social viewing/i.test(sample.generatedPrompt)
    )).toBe(true);

    expect(samplePromptsArtifact.samples.some((sample: any) =>
      sample.sampleMode === 'invalid-test' &&
        /Female spectator/i.test(sample.generatedPrompt) &&
        /mechanic coat|goggles/i.test(sample.generatedPrompt)
    )).toBe(true);
    expect(plausibilityReviewArtifact.reviews.some((review: any) =>
      review.verdict === 'fail' &&
        review.failureReasons.some((reason: string) => reason.includes('Female spectator cues conflict'))
    )).toBe(true);

    const ethicalConstraint = sceneGrammarArtifact.negativeConstraints.find((constraint: any) =>
      constraint.constraintType.includes('ethical')
    );
    expect(ethicalConstraint.enforcement.allow).toEqual(expect.arrayContaining([
      'middle_class_spectator',
      'working_class_spectator',
      'worker',
      'family_member'
    ]));
    expect(sceneGrammarEvaluation.criticFlags.some((flag: any) =>
      flag.code === 'negative-constraint-detected-but-not-enforced'
    )).toBe(false);

    Object.values(branchGraphPsgs).forEach((graph: any) => {
      expectPromptSpaghettiPsg(graph);
    });

    expect(webResearchResults.adapterMode).toBe('mock');
    expect(() => researchWebResearchService.createLiveWebResearchAdapter()).toThrow(/not implemented/);
  });

  test('builds a canonical source registry and source claims from duplicated retrieval results', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'source-registry-audit.txt',
      rawText: '# Source Registry Audit\n\nOriginal crowd source notes.',
      inputId: 'source-registry-audit',
      title: 'Source Registry Audit',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const webResearchResults = MetagrinderWebResearchResultsSchema.parse({
      inputId: ingestArtifact.inputId,
      adapterMode: 'mock',
      retrievedAt: '2026-05-02T12:00:00.000Z',
      results: [
        {
          resultId: 'result_001',
          gapId: 'gap_grandstand',
          sourceType: 'archive',
          title: '1910s Baseball Crowd Grandstand Photograph',
          url: 'http://www.example.com/source?utm_source=test#caption',
          retrievedAt: '2026-05-02T12:00:00.000Z',
          relevance: 'high',
          sourceQuality: 'medium',
          claimsExtracted: [
            {
              claim: 'Women are visible in seated grandstand areas but remain a minority of the visible crowd.',
              supportsGrammarRefs: [
                'locationZones.grandstand.demographicDistribution',
                'archetypes.female_middle_class_spectator.weightRange'
              ],
              confidence: 'medium'
            }
          ],
          limitations: ['Different sport and city.']
        },
        {
          resultId: 'result_002',
          gapId: 'gap_grandstand',
          sourceType: 'museum',
          title: '1910s Baseball Crowd Grandstand Photograph',
          url: 'https://example.com/source',
          retrievedAt: '2026-05-02T12:00:00.000Z',
          relevance: 'medium',
          sourceQuality: 'high',
          claimsExtracted: [
            {
              claim: 'Grandstand viewers include family and social viewing variants.',
              supportsGrammarRefs: ['locationZones.grandstand'],
              confidence: 'high'
            }
          ],
          limitations: ['Still needs operator acceptance.']
        },
        {
          resultId: 'result_003',
          gapId: 'gap_grandstand',
          sourceType: 'low-quality-source',
          title: '1910s Baseball Crowd Grandstand Photograph',
          url: 'https://example.com/source?utm_medium=social',
          retrievedAt: '2026-05-02T12:00:00.000Z',
          relevance: 'low',
          sourceQuality: 'low',
          claimsExtracted: [
            {
              claim: 'Weak source should not upgrade confidence.',
              supportsGrammarRefs: ['locationZones.grandstand'],
              confidence: 'high'
            }
          ],
          limitations: ['Low-quality source.']
        }
      ]
    });
    const sourceRegistryArtifact = buildSourceRegistryArtifact({
      ingestArtifact,
      webResearchResults
    });
    const sourceClaimsArtifact = buildSourceClaimsArtifact({
      sourceRegistryArtifact,
      webResearchResults,
      researchGapArtifact: {
        inputId: ingestArtifact.inputId,
        gaps: [
          {
            gapId: 'gap_grandstand',
            gapType: 'under-supported-distribution',
            severity: 'medium',
            affectedGrammarRefs: ['locationZones.grandstand.demographicDistribution'],
            question: 'What supports grandstand distribution?',
            currentSupport: [],
            missingSupport: [],
            recommendedSearches: []
          }
        ]
      }
    });

    const webSources = sourceRegistryArtifact.sources.filter((source: any) =>
      source.sourceKind === 'web-result'
    );
    expect(webSources).toHaveLength(1);
    expect(webSources[0].canonicalUrl).toBe('https://example.com/source');
    expect(webSources[0].sourceQuality).toBe('high');
    expect(webSources[0].mergedFromResultIds).toEqual(expect.arrayContaining([
      'result_001',
      'result_002',
      'result_003'
    ]));
    expect(sourceClaimsArtifact.claims).toHaveLength(3);
    expect(new Set(sourceClaimsArtifact.claims.map((claim: any) => claim.sourceId)).size).toBe(1);
    expect(sourceClaimsArtifact.claims[0].supportsGrammarRefs).toEqual(expect.arrayContaining([
      'locationZones.grandstand.demographicDistribution',
      'archetypes.female_middle_class_spectator.weightRange'
    ]));
    expect(sourceClaimsArtifact.claims.find((claim: any) =>
      claim.claim.includes('Weak source')
    )?.confidence).toBe('low');
  });

  test('links grammar revisions to source claims and applies only accepted revisions', () => {
    const rawText = readTextFixture('research-input-historical-crowd-grammar.txt');
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'research-input-historical-crowd-grammar.txt',
      rawText,
      inputId: 'research-input-historical-crowd-grammar',
      title: 'Early twentieth-century public spectacle crowd scene grammar notes',
      createdAt: '2026-05-02T12:00:00.000Z'
    });
    const extractArtifact = buildExtractArtifact({ ingestArtifact });
    const classifyArtifact = buildClassifyArtifact({ ingestArtifact, extractArtifact });
    const synthesizeArtifact = buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
    const sourceModeArtifact = buildSourceModeArtifact({ ingestArtifact });
    const sceneGrammarArtifact = buildSceneGrammarArtifact({
      ingestArtifact,
      extractArtifact,
      classifyArtifact,
      synthesizeArtifact,
      sourceModeArtifact
    });
    const researchGapArtifact = buildResearchGapArtifact({ sceneGrammarArtifact });
    const researchQueryPlan = buildResearchQueryPlan({ researchGapArtifact });
    const webResearchResults = buildWebResearchResults({
      researchQueryPlan,
      researchGapArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    const sourceRegistryArtifact = buildSourceRegistryArtifact({
      ingestArtifact,
      webResearchResults
    });
    const sourceClaimsArtifact = buildSourceClaimsArtifact({
      sourceRegistryArtifact,
      webResearchResults,
      researchGapArtifact
    });
    const grammarRevisionArtifact = buildGrammarRevisionArtifact({
      sceneGrammarArtifact,
      researchGapArtifact,
      webResearchResults,
      sourceClaimsArtifact
    });
    const reviewedRevisionArtifact = {
      inputId: grammarRevisionArtifact.inputId,
      revisions: grammarRevisionArtifact.revisions.slice(0, 3).map((revision: any, index: number) => ({
        ...revision,
        reviewStatus: index === 0 ? 'accepted' : index === 1 ? 'rejected' : 'needs_review'
      }))
    };
    const { acceptedGrammarRevisionArtifact, rejectedGrammarRevisionArtifact } = splitGrammarRevisionArtifact({
      grammarRevisionArtifact: reviewedRevisionArtifact
    });
    const acceptedSceneGrammarArtifact = applyAcceptedGrammarRevisions({
      sceneGrammarArtifact,
      grammarRevisionArtifact: acceptedGrammarRevisionArtifact
    });
    const baseSceneGrammarPsg = buildSceneGrammarPsg({
      sceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });
    const acceptedSceneGrammarPsg = buildSceneGrammarPsg({
      sceneGrammarArtifact: acceptedSceneGrammarArtifact,
      now: () => '2026-05-02T12:00:00.000Z'
    });

    expect(grammarRevisionArtifact.revisions.every((revision: any) =>
      revision.sourceClaimIds.length > 0 &&
        revision.supportingResultIds.length === 0
    )).toBe(true);
    const lowOnlyRevisionArtifact = buildGrammarRevisionArtifact({
      sceneGrammarArtifact,
      researchGapArtifact: {
        inputId: researchGapArtifact.inputId,
        gaps: [researchGapArtifact.gaps[0]]
      },
      webResearchResults,
      sourceClaimsArtifact: {
        inputId: sourceClaimsArtifact.inputId,
        claims: [
          {
            ...sourceClaimsArtifact.claims.find((claim: any) =>
              claim.gapId === researchGapArtifact.gaps[0].gapId
            ),
            confidence: 'low'
          }
        ]
      }
    });
    expect(lowOnlyRevisionArtifact.revisions[0].changeType).toBe('flag-low-quality-source');
    expect(lowOnlyRevisionArtifact.revisions[0].confidence).toBe('low');
    expect(() => MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: 'bad',
      revisions: [
        {
          revisionId: 'bad_revision',
          gapId: 'gap',
          changeType: 'no-op',
          targetGrammarRef: 'sceneGrammar',
          before: 'before',
          after: 'after',
          reason: 'missing source claims',
          sourceClaimIds: [],
          confidence: 'medium',
          reviewStatus: 'needs_review'
        }
      ]
    })).toThrow();
    expect(acceptedGrammarRevisionArtifact.revisions).toHaveLength(1);
    expect(rejectedGrammarRevisionArtifact.revisions).toHaveLength(1);
    expect(acceptedSceneGrammarArtifact.reviewFlags).toContain(
      `accepted-revision:${acceptedGrammarRevisionArtifact.revisions[0].revisionId}`
    );
    expect(acceptedSceneGrammarArtifact.reviewFlags).not.toContain(
      `accepted-revision:${rejectedGrammarRevisionArtifact.revisions[0].revisionId}`
    );
    expect(acceptedSceneGrammarArtifact.populationModel.notes.length).toBeGreaterThan(
      sceneGrammarArtifact.populationModel.notes.length
    );
    expect(baseSceneGrammarPsg.name).toContain(sceneGrammarArtifact.sceneContext.title);
    expectPromptSpaghettiPsg(baseSceneGrammarPsg);
    expectPromptSpaghettiPsg(acceptedSceneGrammarPsg);
    expect(acceptedSceneGrammarPsg.nodes.length).toBe(baseSceneGrammarPsg.nodes.length);
  });

  test('parses revision state files and rejects duplicate revision entries', () => {
    const revisionState = MetagrinderRevisionStateFileSchema.parse(
      readFixture('revision-state-historical-crowd.json')
    );
    expect(revisionState.revisionStates[0].reviewStatus).toBe('accepted');
    expect(revisionState.revisionStates[1].reviewStatus).toBe('rejected');
    expect(() => MetagrinderRevisionStateFileSchema.parse({
      inputId: 'scene',
      revisionStates: [
        {
          revisionId: 'revision_001',
          reviewStatus: 'accepted'
        },
        {
          revisionId: 'revision_001',
          reviewStatus: 'rejected'
        }
      ]
    })).toThrow(/Duplicate revision state entry/);
  });

  test('applies accepted material grammar deltas and records confirmations', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-delta-unit-'));
    const baseResult = runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Material Delta Unit',
      compileGrammar: 'base'
    });
    const claimId = baseResult.sourceClaimsArtifact.claims[0].sourceClaimId;
    const ruleId = baseResult.sceneGrammarArtifact.compatibilityRules[0].ruleId;
    const constraintId = baseResult.sceneGrammarArtifact.negativeConstraints[0].constraintId;
    const distributionId = baseResult.sceneGrammarArtifact.demographicDistributions[0].distributionId;
    const referenceId = baseResult.sceneGrammarArtifact.visualReferenceSets[0].referenceId;
    const distributionBefore = baseResult.sceneGrammarArtifact.demographicDistributions[0].entries;
    const referenceSupportsBefore = baseResult.sceneGrammarArtifact.visualReferenceSets[0].supports;
    const middleClassBefore = baseResult.sceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'middle_class_spectator'
    ).weightRange;
    const heatAdjustedBefore = baseResult.sceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'heat_adjusted_spectator'
    ).weightRange;
    const rejectedBefore = baseResult.sceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'working_class_trackside'
    ).weightRange;
    const pendingBefore = baseResult.sceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'female_middle_class_spectator'
    ).weightRange;

    const grammarRevisionArtifact = MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: baseResult.sceneGrammarArtifact.inputId,
      revisions: [
        {
          revisionId: 'revision_material_weight',
          gapId: 'gap_middle_class_spectator_weight_support',
          changeType: 'adjust-weight-range',
          targetGrammarRef: 'archetypes.middle_class_spectator.weightRange',
          before: 'base range',
          after: 'source-supported range',
          reason: 'Test material weight mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'accepted'
        },
        {
          revisionId: 'revision_confirm_weight',
          gapId: 'gap_heat_adjusted_spectator_weight_support',
          changeType: 'confirm-weight-range',
          targetGrammarRef: 'archetypes.heat_adjusted_spectator.weightRange',
          before: 'base range',
          after: 'same range with corroboration',
          reason: 'Test confirmation without mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'accepted'
        },
        {
          revisionId: 'revision_rejected_weight',
          gapId: 'gap_working_class_trackside_weight_support',
          changeType: 'adjust-weight-range',
          targetGrammarRef: 'archetypes.working_class_trackside.weightRange',
          before: 'base range',
          after: 'should not apply',
          reason: 'Rejected material mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'rejected'
        },
        {
          revisionId: 'revision_pending_weight',
          gapId: 'gap_female_middle_class_spectator_weight_support',
          changeType: 'adjust-weight-range',
          targetGrammarRef: 'archetypes.female_middle_class_spectator.weightRange',
          before: 'base range',
          after: 'should not apply',
          reason: 'Pending material mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'needs_review'
        },
        {
          revisionId: 'revision_compatibility_effect',
          gapId: 'gap_rule_effect',
          changeType: 'add-compatibility-effect',
          targetGrammarRef: `compatibilityRules.${ruleId}.effects`,
          before: 'current effects',
          after: 'additional source-supported effect',
          reason: 'Test compatibility effect mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'accepted'
        },
        {
          revisionId: 'revision_tighten_constraint',
          gapId: 'gap_constraint_enforcement',
          changeType: 'tighten-negative-constraint',
          targetGrammarRef: `negativeConstraints.${constraintId}.enforcement`,
          before: 'current enforcement',
          after: 'sampler/evaluator enforcement',
          reason: 'Test negative constraint enforcement mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'accepted'
        },
        {
          revisionId: 'revision_location_distribution',
          gapId: 'gap_location_distribution',
          changeType: 'adjust-location-distribution',
          targetGrammarRef: `demographicDistributions.${distributionId}.entries`,
          before: 'current distribution entries',
          after: 'sourced distribution entries',
          reason: 'Test location distribution mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'accepted'
        },
        {
          revisionId: 'revision_visual_support',
          gapId: 'gap_visual_reference_support',
          changeType: 'add-source-support',
          targetGrammarRef: `visualReferenceSets.${referenceId}.supports`,
          before: 'current visual support refs',
          after: 'source-claim support refs',
          reason: 'Test visual reference support mutation.',
          sourceClaimIds: [claimId],
          confidence: 'medium',
          reviewStatus: 'accepted'
        }
      ]
    });

    const { acceptedSceneGrammarArtifact, acceptedGrammarDeltasArtifact } =
      applyAcceptedGrammarRevisionsWithDeltas({
        sceneGrammarArtifact: baseResult.sceneGrammarArtifact,
        grammarRevisionArtifact
      });

    const middleClassAfter = acceptedSceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'middle_class_spectator'
    ).weightRange;
    const heatAdjustedAfter = acceptedSceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'heat_adjusted_spectator'
    ).weightRange;
    const rejectedAfter = acceptedSceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'working_class_trackside'
    ).weightRange;
    const pendingAfter = acceptedSceneGrammarArtifact.archetypes.find((entry: any) =>
      entry.archetypeId === 'female_middle_class_spectator'
    ).weightRange;
    const compatibilityAfter = acceptedSceneGrammarArtifact.compatibilityRules.find((entry: any) =>
      entry.ruleId === ruleId
    );
    const constraintAfter = acceptedSceneGrammarArtifact.negativeConstraints.find((entry: any) =>
      entry.constraintId === constraintId
    );
    const distributionAfter = acceptedSceneGrammarArtifact.demographicDistributions.find((entry: any) =>
      entry.distributionId === distributionId
    ).entries;
    const referenceAfter = acceptedSceneGrammarArtifact.visualReferenceSets.find((entry: any) =>
      entry.referenceId === referenceId
    );

    expect(middleClassAfter.min).toBe(middleClassBefore.min + 2);
    expect(middleClassAfter.max).toBe(middleClassBefore.max + 2);
    expect(heatAdjustedAfter).toEqual(heatAdjustedBefore);
    expect(rejectedAfter).toEqual(rejectedBefore);
    expect(pendingAfter).toEqual(pendingBefore);
    expect(compatibilityAfter.effects.length).toBe(
      baseResult.sceneGrammarArtifact.compatibilityRules[0].effects.length + 1
    );
    expect(constraintAfter.enforcement.avoid).toContain('unsupported_exception_without_source');
    expect(distributionAfter[0].min).toBe(distributionBefore[0].min + 1);
    expect(referenceAfter.supports).toEqual([
      ...referenceSupportsBefore,
      `source-claim:${claimId}`
    ]);
    expect(acceptedGrammarDeltasArtifact.deltas).toHaveLength(6);
    expect(acceptedGrammarDeltasArtifact.deltas.find((delta: any) =>
      delta.revisionId === 'revision_material_weight'
    )).toMatchObject({
      materialChange: true,
      before: middleClassBefore,
      after: middleClassAfter,
      supportingSourceClaimIds: [claimId]
    });
    expect(acceptedGrammarDeltasArtifact.deltas.find((delta: any) =>
      delta.revisionId === 'revision_confirm_weight'
    )).toMatchObject({
      materialChange: false,
      before: heatAdjustedBefore,
      after: heatAdjustedBefore,
      supportingSourceClaimIds: [claimId]
    });
    expect(() => MetagrinderAcceptedGrammarDeltasArtifactSchema.parse(acceptedGrammarDeltasArtifact)).not.toThrow();
  });

  test('pipeline applies operator revision state and compiles base or accepted PSG targets', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const revisionStateFilePath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'revision-state-historical-crowd.json'
    );
    const baseOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-base-compile-'));
    const acceptedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-accepted-compile-'));

    const baseResult = runMetagrinderMvp({
      inputPath,
      outputDir: baseOutputDir,
      title: 'Base Grammar Checkpoint',
      compileGrammar: 'base'
    });
    const acceptedResult = runMetagrinderMvp({
      inputPath,
      outputDir: acceptedOutputDir,
      title: 'Accepted Grammar Checkpoint',
      revisionStateFilePath,
      applyAcceptedRevisions: true,
      compileGrammar: 'accepted'
    });

    expect(fs.existsSync(path.join(acceptedOutputDir, 'revision-state.applied.json'))).toBe(true);
    expect(fs.existsSync(path.join(acceptedOutputDir, 'revision-review.json'))).toBe(true);
    expect(fs.existsSync(path.join(acceptedOutputDir, 'accepted-grammar-deltas.json'))).toBe(true);
    expect(fs.existsSync(path.join(acceptedOutputDir, 'operator-review.md'))).toBe(true);
    expect(fs.existsSync(path.join(acceptedOutputDir, 'psg-compile-diff.json'))).toBe(true);
    expect(fs.existsSync(path.join(acceptedOutputDir, 'live-retrieval-readiness.json'))).toBe(true);
    expect(fs.existsSync(path.join(acceptedOutputDir, 'accepted-scene-grammar.json'))).toBe(true);
    expect(acceptedResult.revisionStateAppliedArtifact.appliedRevisionIds).toEqual([
      'research-input-historical-crowd-grammar_grammar_revision_001'
    ]);
    expect(acceptedResult.revisionStateAppliedArtifact.rejectedRevisionIds).toEqual([
      'research-input-historical-crowd-grammar_grammar_revision_002'
    ]);
    expect(acceptedResult.revisionStateAppliedArtifact.skippedRevisionIds.length).toBeGreaterThan(0);
    expect(acceptedResult.acceptedSceneGrammarArtifact.reviewFlags).toContain(
      'accepted-revision:research-input-historical-crowd-grammar_grammar_revision_001'
    );
    expect(acceptedResult.acceptedSceneGrammarArtifact.reviewFlags).not.toContain(
      'accepted-revision:research-input-historical-crowd-grammar_grammar_revision_002'
    );
    expect(acceptedResult.sceneGrammarArtifact.reviewFlags).not.toContain(
      'accepted-revision:research-input-historical-crowd-grammar_grammar_revision_001'
    );
    expect(acceptedResult.revisionReviewArtifact.acceptedCount).toBe(1);
    expect(acceptedResult.revisionReviewArtifact.rejectedCount).toBe(1);
    expect(acceptedResult.revisionReviewArtifact.compileGrammarTarget).toBe('accepted');
    expect(acceptedResult.acceptedGrammarDeltasArtifact.deltas.length).toBeGreaterThanOrEqual(1);
    expect(acceptedResult.acceptedGrammarDeltasArtifact.deltas.some((delta: any) =>
      delta.materialChange
    )).toBe(true);
    expect(acceptedResult.psgCompileDiffArtifact.materialDifference).toBe(true);
    expect(acceptedResult.psgCompileDiffArtifact.changedNodes.some((node: any) =>
      node.nodeId === 'archetype-choice' || node.nodeId === 'rail-choice'
    )).toBe(true);
    expect(acceptedResult.liveRetrievalReadinessArtifact.ready).toBe(true);
    expect(acceptedResult.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'revision-state' &&
        collection.path === 'revision-state.json'
    )).toBe(true);
    expect(acceptedResult.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'revision-state-applied' &&
        collection.path === 'revision-state.applied.json'
    )).toBe(true);
    expect(acceptedResult.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'revision-review' &&
        collection.path === 'revision-review.json'
    )).toBe(true);
    expect(acceptedResult.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'accepted-grammar-deltas' &&
        collection.path === 'accepted-grammar-deltas.json'
    )).toBe(true);
    expect(acceptedResult.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'psg-compile-diff' &&
        collection.path === 'psg-compile-diff.json'
    )).toBe(true);
    expect(acceptedResult.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'live-retrieval-readiness' &&
        collection.path === 'live-retrieval-readiness.json'
    )).toBe(true);
    expect(() => MetagrinderPsgCompileDiffArtifactSchema.parse(acceptedResult.psgCompileDiffArtifact)).not.toThrow();
    expect(() => MetagrinderLiveRetrievalReadinessArtifactSchema.parse(acceptedResult.liveRetrievalReadinessArtifact)).not.toThrow();
    expectPromptSpaghettiPsg(baseResult.sceneGrammarPsg);
    expectPromptSpaghettiPsg(acceptedResult.sceneGrammarPsg);
    Object.values(acceptedResult.branchGraphPsgs).forEach((graph: any) => {
      expectPromptSpaghettiPsg(graph);
    });
    const baseContext = baseResult.sceneGrammarPsg.nodes.find((node: any) => node.id === 'scene-context');
    const acceptedContext = acceptedResult.sceneGrammarPsg.nodes.find((node: any) => node.id === 'scene-context');
    const baseArchetypeChoice = baseResult.sceneGrammarPsg.nodes.find((node: any) => node.id === 'archetype-choice');
    const acceptedArchetypeChoice = acceptedResult.sceneGrammarPsg.nodes.find((node: any) => node.id === 'archetype-choice');
    expect(baseContext.value).not.toBe(acceptedContext.value);
    expect(acceptedContext.value).toContain('Accepted revision count: 1');
    expect(baseArchetypeChoice.options).not.toEqual(acceptedArchetypeChoice.options);
  });

  test('material-delta revision state fixture drives accepted PSG graph differences beyond summary text', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const revisionStateFilePath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'revision-state-historical-crowd-material-delta.json'
    );
    const revisionState = MetagrinderRevisionStateFileSchema.parse(
      readFixture('revision-state-historical-crowd-material-delta.json')
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-material-delta-'));

    const result = runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Accepted Grammar Material Delta Checkpoint',
      revisionStateFilePath,
      applyAcceptedRevisions: true,
      compileGrammar: 'accepted'
    });
    const materialDeltas = result.acceptedGrammarDeltasArtifact.deltas.filter((delta: any) =>
      delta.materialChange
    );
    const contextOnlyChanges = result.psgCompileDiffArtifact.changedNodes.filter((node: any) =>
      node.nodeId === 'scene-context'
    );

    expect(revisionState.revisionStates.map((entry: any) => entry.reviewStatus)).toEqual([
      'accepted',
      'accepted',
      'rejected',
      'pending'
    ]);
    expect(result.revisionStateAppliedArtifact.appliedRevisionIds).toEqual([
      'research-input-historical-crowd-grammar_grammar_revision_001',
      'research-input-historical-crowd-grammar_grammar_revision_002'
    ]);
    expect(result.revisionStateAppliedArtifact.rejectedRevisionIds).toEqual([
      'research-input-historical-crowd-grammar_grammar_revision_003'
    ]);
    expect(result.revisionStateAppliedArtifact.skippedRevisionIds).toContain(
      'research-input-historical-crowd-grammar_grammar_revision_004'
    );
    expect(materialDeltas.length).toBeGreaterThan(0);
    expect(result.acceptedGrammarDeltasArtifact.deltas.some((delta: any) =>
      delta.materialChange === false && delta.changeType === 'confirm-weight-range'
    )).toBe(true);
    expect(result.psgCompileDiffArtifact.materialDifference).toBe(true);
    expect(result.psgCompileDiffArtifact.changedNodes.length).toBeGreaterThan(0);
    expect(contextOnlyChanges).toHaveLength(0);
    expect(fs.readFileSync(path.join(outputDir, 'operator-review.md'), 'utf8')).toContain(
      'Recommended action:'
    );
  });

  test('retrieval boundary dry-run logs queries without creating source claims', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-dry-run-'));

    const result = runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Dry Run Retrieval Checkpoint',
      webResearchMode: 'dry-run',
      maxQueriesTotal: 3,
      maxResultsPerQuery: 2
    });

    expect(result.retrievalPolicyArtifact.mode).toBe('dry-run');
    expect(result.retrievalRunLogArtifact.budgetUse.queriesAllowed).toBe(3);
    expect(result.retrievalRunLogArtifact.budgetUse.queriesSkippedByBudget).toBeGreaterThan(0);
    expect(result.retrievalRunLogArtifact.queryAttempts.filter((attempt: any) =>
      attempt.wouldExecute
    )).toHaveLength(3);
    expect(result.retrievalCandidatesArtifact.candidates).toHaveLength(0);
    expect(result.sourceClaimsArtifact.claims).toHaveLength(0);
    expect(result.grammarRevisionArtifact.revisions).toHaveLength(0);
    expect(result.retrievalSafetyReportArtifact.blockedAutoPromotion).toBe(true);
    expect(() => MetagrinderRetrievalPolicySchema.parse(result.retrievalPolicyArtifact)).not.toThrow();
    expect(() => MetagrinderRetrievalRunLogSchema.parse(result.retrievalRunLogArtifact)).not.toThrow();
    expect(() => MetagrinderRetrievalCandidatesArtifactSchema.parse(result.retrievalCandidatesArtifact)).not.toThrow();
    expect(() => MetagrinderRetrievalSafetyReportSchema.parse(result.retrievalSafetyReportArtifact)).not.toThrow();
  });

  test('retrieval cache replay promotes only operator-approved candidates into source claims', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-cache-replay-'));

    const result = runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Checkpoint Cache Replay',
      webResearchMode: 'cache-replay',
      retrievalCacheDir: path.join(__dirname, 'fixtures', 'metagrinder', 'retrieval-cache-historical-crowd.json'),
      sourceIntakeApprovalFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-intake-approval-historical-crowd.json')
    });

    expect(result.retrievalPolicyArtifact.mode).toBe('cache-replay');
    expect(result.retrievalCacheManifestArtifact.cacheHit).toBe(true);
    expect(result.retrievalCandidatesArtifact.candidates).toHaveLength(3);
    expect(result.sourceIntakeApprovalArtifact.approvals.map((entry: any) => entry.approvalStatus)).toEqual([
      'approved',
      'rejected',
      'pending'
    ]);
    expect(result.approvedSourceResultsArtifact.approvedResults).toHaveLength(1);
    expect(result.sourceClaimsArtifact.claims).toHaveLength(1);
    expect(result.sourceClaimsArtifact.claims[0].sourceId).toBeDefined();
    expect(result.grammarRevisionArtifact.revisions.length).toBeGreaterThanOrEqual(1);
    expect(result.retrievalSafetyReportArtifact.approvedCandidateCount).toBe(1);
    expect(result.retrievalSafetyReportArtifact.blockedAutoPromotion).toBe(true);
    expect(() => MetagrinderRetrievalCacheManifestSchema.parse(result.retrievalCacheManifestArtifact)).not.toThrow();
    expect(() => MetagrinderSourceIntakeApprovalSchema.parse(result.sourceIntakeApprovalArtifact)).not.toThrow();
    expect(() => MetagrinderApprovedSourceResultsSchema.parse(result.approvedSourceResultsArtifact)).not.toThrow();
  });

  test('citation evidence review gates material revision application for cache replay claims', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const reviewedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-citation-reviewed-'));
    const blockedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-citation-blocked-'));
    const commonArgs = {
      inputPath,
      webResearchMode: 'cache-replay',
      retrievalCacheDir: path.join(__dirname, 'fixtures', 'metagrinder', 'retrieval-cache-historical-crowd.json'),
      sourceIntakeApprovalFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-intake-approval-historical-crowd.json'),
      applyAcceptedRevisions: true,
      compileGrammar: 'accepted'
    };

    const reviewed = runMetagrinderMvp({
      ...commonArgs,
      outputDir: reviewedOutputDir,
      title: 'Checkpoint Citation Reviewed',
      sourceClaimReviewFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-claim-review-historical-crowd.json'),
      revisionStateFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'revision-state-historical-crowd-citation-gated.json')
    });
    const blocked = runMetagrinderMvp({
      ...commonArgs,
      outputDir: blockedOutputDir,
      title: 'Checkpoint Citation Blocked',
      sourceClaimReviewFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-claim-review-historical-crowd-blocked.json'),
      revisionStateFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'revision-state-historical-crowd-citation-blocked.json')
    });
    const needsReviewBlocked = applyAcceptedGrammarRevisionsWithDeltas({
      sceneGrammarArtifact: reviewed.sceneGrammarArtifact,
      grammarRevisionArtifact: {
        inputId: reviewed.grammarRevisionArtifact.inputId,
        revisions: reviewed.grammarRevisionArtifact.revisions.map((revision: any, index: number) => ({
          ...revision,
          reviewStatus: index === 0 ? 'accepted' : revision.reviewStatus
        }))
      },
      sourceClaimsArtifact: reviewed.sourceClaimsArtifact,
      sourceClaimReviewArtifact: {
        inputId: reviewed.sourceClaimsArtifact.inputId,
        claimReviews: [
          {
            sourceClaimId: 'source_claim_001',
            evidenceIds: ['source_evidence_001'],
            citationStatus: 'needs_review',
            operatorNote: 'Citation remains under review.'
          }
        ]
      },
      requireReviewedCitations: true
    });
    const overrideAllowed = applyAcceptedGrammarRevisionsWithDeltas({
      sceneGrammarArtifact: reviewed.sceneGrammarArtifact,
      grammarRevisionArtifact: {
        inputId: reviewed.grammarRevisionArtifact.inputId,
        revisions: reviewed.grammarRevisionArtifact.revisions.map((revision: any, index: number) => ({
          ...revision,
          reviewStatus: index === 0 ? 'accepted' : revision.reviewStatus,
          operatorState: index === 0 ? { overrideCitationReview: true } : revision.operatorState
        }))
      },
      sourceClaimsArtifact: reviewed.sourceClaimsArtifact,
      sourceClaimReviewArtifact: {
        inputId: reviewed.sourceClaimsArtifact.inputId,
        claimReviews: [
          {
            sourceClaimId: 'source_claim_001',
            evidenceIds: ['source_evidence_001'],
            citationStatus: 'needs_review',
            operatorNote: 'Citation remains under review.'
          }
        ]
      },
      requireReviewedCitations: true
    });

    expect(() => MetagrinderSourceEvidenceArtifactSchema.parse(reviewed.sourceEvidenceArtifact)).not.toThrow();
    expect(() => MetagrinderSourceClaimReviewArtifactSchema.parse(reviewed.sourceClaimReviewArtifact)).not.toThrow();
    expect(reviewed.sourceEvidenceArtifact.evidence[0].locator.cacheRecordId).toBe('cache_record_001');
    expect(reviewed.retrievalCacheManifestArtifact.cacheRecords[0].payloadHash).toMatch(/^sha256:/);
    expect(reviewed.sourceClaimsArtifact.claims[0].evidenceIds).toEqual(['source_evidence_001']);
    expect(reviewed.acceptedGrammarDeltasArtifact.deltas[0]).toMatchObject({
      applied: true,
      materialChange: true,
      evidenceIds: ['source_evidence_001'],
      citationStatus: 'accepted'
    });
    expect(reviewed.acceptedGrammarDeltasArtifact.deltas[0].riskFlags).toContain('not-event-specific');
    expect(fs.readFileSync(path.join(reviewedOutputDir, 'operator-review.md'), 'utf8')).toContain('Citation status: accepted');
    expect(fs.readFileSync(path.join(reviewedOutputDir, 'operator-review.md'), 'utf8')).toContain('Evidence excerpt:');
    expect(reviewed.revisionReviewArtifact.citationStatusCounts.accepted).toBe(1);
    expect(reviewed.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'source-evidence'
    )).toBe(true);
    expect(reviewed.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'source-claim-review'
    )).toBe(true);
    expect(blocked.acceptedGrammarDeltasArtifact.deltas[0].applied).toBe(false);
    expect(blocked.acceptedGrammarDeltasArtifact.deltas[0].citationStatus).toBe('rejected');
    expect(blocked.acceptedGrammarDeltasArtifact.deltas[0].warnings[0]).toContain('blocked');
    expect(blocked.acceptedSceneGrammarArtifact.archetypes[0].weightRange).toEqual(
      blocked.sceneGrammarArtifact.archetypes[0].weightRange
    );
    expect(blocked.psgCompileDiffArtifact.materialDifference).toBe(false);
    expect(needsReviewBlocked.acceptedGrammarDeltasArtifact.deltas[0].applied).toBe(false);
    expect(needsReviewBlocked.acceptedGrammarDeltasArtifact.deltas[0].citationStatus).toBe('needs_review');
    expect(overrideAllowed.acceptedGrammarDeltasArtifact.deltas[0].applied).toBe(true);
    expect(overrideAllowed.acceptedGrammarDeltasArtifact.deltas[0].riskFlags).toContain('citation-review-override');
  });

  test('retrieval mock and live-candidate-only modes preserve source-claim safety boundaries', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const mockOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-mock-boundary-'));
    const liveOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-live-boundary-'));
    const allowlistOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-allowlist-boundary-'));

    const mockResult = runMetagrinderMvp({
      inputPath,
      outputDir: mockOutputDir,
      title: 'Checkpoint Mock',
      webResearchMode: 'mock',
      maxResultsPerQuery: 2
    });
    const liveBoundaryResult = runMetagrinderMvp({
      inputPath,
      outputDir: liveOutputDir,
      title: 'Checkpoint Live Candidate Boundary',
      webResearchMode: 'live-candidate-only'
    });
    const allowlistResult = runMetagrinderMvp({
      inputPath,
      outputDir: allowlistOutputDir,
      title: 'Checkpoint Allowlist Boundary',
      webResearchMode: 'mock',
      maxQueriesTotal: 1,
      maxResultsPerQuery: 5,
      allowedSourceTypes: ['museum']
    });

    expect(mockResult.retrievalCandidatesArtifact.candidates.length).toBeGreaterThan(0);
    expect(mockResult.sourceClaimsArtifact.claims.length).toBeGreaterThan(0);
    expect(mockResult.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
      candidate.canCreateSourceClaim === false
    )).toBe(true);
    expect(liveBoundaryResult.retrievalPolicyArtifact.mode).toBe('live-candidate-only');
    expect(liveBoundaryResult.retrievalRunLogArtifact.queryAttempts.some((attempt: any) =>
      attempt.reason.includes('preflight blocked')
    )).toBe(true);
    expect(liveBoundaryResult.sourceClaimsArtifact.claims).toHaveLength(0);
    expect(liveBoundaryResult.grammarRevisionArtifact.revisions).toHaveLength(0);
    expect(liveBoundaryResult.retrievalSafetyReportArtifact.blockedAutoPromotion).toBe(true);
    expect(liveBoundaryResult.retrievalSafetyReportArtifact.sourceClaimsCreatedFromLiveCandidates).toBe(0);
    expect(allowlistResult.retrievalCandidatesArtifact.candidates.length).toBeGreaterThan(0);
    expect(allowlistResult.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
      candidate.sourceTypeHypothesis === 'museum'
    )).toBe(true);
  });

  test('controlled live retrieval pilot is preflight-gated, candidate-only, and cache replayable', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const blockedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-live-preflight-blocked-'));
    const liveOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-live-fixture-'));
    const replayOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-live-replay-'));

    const blocked = runMetagrinderMvp({
      inputPath,
      outputDir: blockedOutputDir,
      title: 'Checkpoint Live Preflight Blocked',
      webResearchMode: 'live-candidate-only',
      maxQueriesTotal: 2,
      maxResultsPerQuery: 2
    });

    expect(() => MetagrinderLiveRetrievalPreflightSchema.parse(blocked.liveRetrievalPreflightArtifact)).not.toThrow();
    expect(() => MetagrinderLiveRetrievalRequestsSchema.parse(blocked.liveRetrievalRequestsArtifact)).not.toThrow();
    expect(() => MetagrinderLiveRetrievalCacheWriteSchema.parse(blocked.liveRetrievalCacheWriteArtifact)).not.toThrow();
    expect(blocked.liveRetrievalPreflightArtifact.verdict).toBe('blocked');
    expect(blocked.liveRetrievalPreflightArtifact.networkAllowed).toBe(false);
    expect(blocked.liveRetrievalRequestsArtifact.requests.every((request: any) => request.executed === false)).toBe(true);
    expect(blocked.retrievalCandidatesArtifact.candidates).toHaveLength(0);
    expect(blocked.sourceRegistryArtifact.sources.filter((source: any) => source.sourceKind === 'web-result')).toHaveLength(0);
    expect(blocked.sourceClaimsArtifact.claims).toHaveLength(0);
    expect(blocked.grammarRevisionArtifact.revisions).toHaveLength(0);

    const live = runMetagrinderMvp({
      inputPath,
      outputDir: liveOutputDir,
      title: 'Checkpoint Live Fixture Candidate',
      webResearchMode: 'live-candidate-only',
      enableLiveRetrieval: true,
      liveProvider: 'fixture-live',
      maxQueriesTotal: 2,
      maxResultsPerQuery: 2,
      allowedSourceTypes: ['archive']
    });

    expect(live.liveRetrievalPreflightArtifact.verdict).toBe('allowed');
    expect(live.liveRetrievalPreflightArtifact.enabledByCli).toBe(true);
    expect(live.liveRetrievalPreflightArtifact.enabledByEnv).toBe(false);
    expect(live.retrievalCandidatesArtifact.candidates.length).toBeGreaterThan(0);
    expect(live.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
      candidate.canCreateSourceClaim === false
    )).toBe(true);
    expect(live.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
      candidate.sourceTypeHypothesis === 'archive'
    )).toBe(true);
    expect(live.sourceClaimsArtifact.claims).toHaveLength(0);
    expect(live.grammarRevisionArtifact.revisions).toHaveLength(0);
    expect(live.liveRetrievalRequestsArtifact.requests.some((request: any) => request.executed)).toBe(true);
    expect(live.liveRetrievalCacheWriteArtifact.cacheWrites.length).toBe(live.retrievalCandidatesArtifact.candidates.length);
    expect(live.liveRetrievalCacheWriteArtifact.cacheWrites[0].payloadHash).toMatch(/^sha256:/);
    expect(live.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'live-retrieval-preflight'
    )).toBe(true);

    const replay = runMetagrinderMvp({
      inputPath,
      outputDir: replayOutputDir,
      title: 'Checkpoint Live Cache Replay',
      webResearchMode: 'cache-replay',
      retrievalCacheDir: path.join(liveOutputDir, 'retrieval-cache-manifest.json'),
      sourceIntakeApprovalFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-intake-approval-historical-crowd-live.json'),
      sourceClaimReviewFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-claim-review-historical-crowd.json'),
      revisionStateFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'revision-state-historical-crowd-citation-gated.json'),
      applyAcceptedRevisions: true,
      compileGrammar: 'accepted',
      maxQueriesTotal: 2,
      maxResultsPerQuery: 2
    });

    expect(replay.retrievalCacheManifestArtifact.cacheHit).toBe(true);
    expect(replay.retrievalRunLogArtifact.queryAttempts.every((attempt: any) => attempt.executed === false)).toBe(true);
    expect(replay.retrievalCacheManifestArtifact.cacheRecords[0].payloadHash).toBe(
      live.liveRetrievalCacheWriteArtifact.cacheWrites[0].payloadHash
    );
    expect(replay.approvedSourceResultsArtifact.approvedResults).toHaveLength(1);
    expect(replay.sourceEvidenceArtifact.evidence).toHaveLength(1);
    expect(replay.sourceClaimsArtifact.claims).toHaveLength(1);
    expect(replay.sourceClaimsArtifact.claims[0].evidenceIds).toEqual(['source_evidence_001']);
    expect(replay.acceptedGrammarDeltasArtifact.deltas[0]).toMatchObject({
      applied: true,
      citationStatus: 'accepted'
    });
  });

  test('real provider contract preflight logs request shapes, source typing, policy blocks, and provider errors', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const blockedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-provider-blocked-'));
    const typingOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-provider-typing-'));
    const policyOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-provider-policy-'));

    const blocked = runMetagrinderMvp({
      inputPath,
      outputDir: blockedOutputDir,
      title: 'Checkpoint Provider Blocked',
      webResearchMode: 'live-candidate-only',
      enableLiveRetrieval: true,
      liveProvider: 'generic-search',
      maxQueriesTotal: 2,
      maxResultsPerQuery: 2
    });

    expect(() => MetagrinderLiveProviderContractSchema.parse(blocked.liveProviderContractArtifact)).not.toThrow();
    expect(() => MetagrinderProviderPreflightReportSchema.parse(blocked.providerPreflightReportArtifact)).not.toThrow();
    expect(() => MetagrinderProviderRequestShapesSchema.parse(blocked.providerRequestShapesArtifact)).not.toThrow();
    expect(() => MetagrinderProviderErrorReportSchema.parse(blocked.providerErrorReportArtifact)).not.toThrow();
    expect(blocked.liveProviderContractArtifact.providers.find((provider: any) =>
      provider.providerId === 'generic-search'
    ).status).toBe('unavailable');
    expect(blocked.providerPreflightReportArtifact.verdict).toBe('blocked');
    expect(blocked.providerRequestShapesArtifact.requests[0]).toMatchObject({
      providerId: 'generic-search',
      wouldExecute: false,
      reason: 'provider-preflight-blocked'
    });
    expect(blocked.providerErrorReportArtifact.errors.some((error: any) =>
      error.errorType === 'provider-unavailable' && error.fatal === false
    )).toBe(true);
    expect(blocked.retrievalCandidatesArtifact.candidates).toHaveLength(0);
    expect(blocked.sourceClaimsArtifact.claims).toHaveLength(0);
    expect(blocked.grammarRevisionArtifact.revisions).toHaveLength(0);

    const typing = runMetagrinderMvp({
      inputPath,
      outputDir: typingOutputDir,
      title: 'Checkpoint Fixture Typing',
      webResearchMode: 'live-candidate-only',
      enableLiveRetrieval: true,
      liveProvider: 'fixture-live',
      maxQueriesTotal: 1,
      maxResultsPerQuery: 4,
      allowedSourceTypes: ['archive', 'museum', 'stock-photo', 'unknown']
    });

    expect(() => MetagrinderSourceTypingReportSchema.parse(typing.sourceTypingReportArtifact)).not.toThrow();
    expect(typing.sourceTypingReportArtifact.candidateClassifications.map((entry: any) =>
      entry.sourceTypeHypothesis
    )).toEqual(expect.arrayContaining(['archive', 'museum', 'stock-photo', 'unknown']));
    expect(typing.sourceTypingReportArtifact.candidateClassifications.find((entry: any) =>
      entry.sourceTypeHypothesis === 'stock-photo'
    )).toMatchObject({
      sourceQualityHypothesis: 'low',
      promotionRecommendation: 'block'
    });
    expect(typing.sourceTypingReportArtifact.candidateClassifications.find((entry: any) =>
      entry.sourceTypeHypothesis === 'unknown'
    )).toMatchObject({
      sourceQualityHypothesis: 'low',
      promotionRecommendation: 'block'
    });
    expect(typing.retrievalCacheManifestArtifact.cacheRecords[0]).toHaveProperty('rawCandidatePayload');
    expect(typing.retrievalCacheManifestArtifact.cacheRecords[0]).toHaveProperty('normalizedCandidatePayload');
    expect(typing.researchPackageManifest.collections.some((collection: any) =>
      collection.type === 'source-typing-report'
    )).toBe(true);

    const policyBlocked = runMetagrinderMvp({
      inputPath,
      outputDir: policyOutputDir,
      title: 'Checkpoint Policy Blocking',
      webResearchMode: 'live-candidate-only',
      enableLiveRetrieval: true,
      liveProvider: 'fixture-live',
      blockedDomains: ['archive.example.org'],
      blockedSourceTypes: ['stock-photo'],
      allowedSourceTypes: ['archive', 'museum'],
      maxQueriesTotal: 1,
      maxResultsPerQuery: 4
    });

    expect(policyBlocked.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
      candidate.domain !== 'archive.example.org' && candidate.sourceTypeHypothesis !== 'stock-photo'
    )).toBe(true);
    expect(policyBlocked.retrievalCandidatesArtifact.candidates.map((candidate: any) =>
      candidate.sourceTypeHypothesis
    )).toEqual(['museum']);
    expect(policyBlocked.retrievalRunLogArtifact.warnings.some((warning: string) =>
      warning.includes('domain/source-type policy')
    )).toBe(true);
  });

  test('generic-http-search adapter is guarded, injectable, cached, redacted, and candidate-only', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const previousEnvGuard = process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
    const previousEndpoint = process.env.METAGRINDER_SEARCH_ENDPOINT;
    const previousApiKey = process.env.METAGRINDER_SEARCH_API_KEY;
    delete process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
    delete process.env.METAGRINDER_SEARCH_ENDPOINT;
    delete process.env.METAGRINDER_SEARCH_API_KEY;

    try {
      const blockedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-env-blocked-'));
      const blocked = runMetagrinderMvp({
        inputPath,
        outputDir: blockedOutputDir,
        title: 'Checkpoint Env Blocked',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        maxQueriesTotal: 2,
        maxResultsPerQuery: 2
      });

      expect(blocked.liveProviderContractArtifact.providers.find((provider: any) =>
        provider.providerId === 'generic-http-search'
      )).toMatchObject({
        status: 'available',
        candidateOnly: true,
        autoPromotionAllowed: false
      });
      expect(() => MetagrinderProviderConfigAppliedSchema.parse(blocked.providerConfigAppliedArtifact)).not.toThrow();
      expect(() => MetagrinderProviderResponseLogSchema.parse(blocked.providerResponseLogArtifact)).not.toThrow();
      expect(blocked.providerPreflightReportArtifact.verdict).toBe('blocked');
      expect(blocked.providerPreflightReportArtifact.networkAllowed).toBe(false);
      expect(blocked.providerResponseLogArtifact.responses.every((response: any) =>
        response.status === 'blocked'
      )).toBe(true);
      expect(blocked.retrievalCandidatesArtifact.candidates).toHaveLength(0);
      expect(blocked.sourceClaimsArtifact.claims).toHaveLength(0);
      expect(blocked.grammarRevisionArtifact.revisions).toHaveLength(0);

      process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL = '1';
      const missingEndpointOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-missing-endpoint-'));
      const missingEndpoint = runMetagrinderMvp({
        inputPath,
        outputDir: missingEndpointOutputDir,
        title: 'Checkpoint Missing Endpoint',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        maxQueriesTotal: 1,
        maxResultsPerQuery: 1
      });
      expect(missingEndpoint.providerPreflightReportArtifact.verdict).toBe('blocked');
      expect(missingEndpoint.providerErrorReportArtifact.errors.some((error: any) =>
        error.message.includes('endpoint')
      )).toBe(true);

      const fakeConfigPath = path.join(
        __dirname,
        'fixtures',
        'metagrinder',
        'provider-config-generic-http-search-fake.json'
      );
      const fakeOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-fake-'));
      const fake = runMetagrinderMvp({
        inputPath,
        outputDir: fakeOutputDir,
        title: 'Checkpoint Fake Provider',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        providerConfigFilePath: fakeConfigPath,
        maxQueriesTotal: 2,
        maxResultsPerQuery: 2
      });

      expect(fake.providerPreflightReportArtifact.verdict).toBe('allowed');
      expect(fake.providerPreflightReportArtifact.networkAllowed).toBe(true);
      expect(fake.providerResponseLogArtifact.responses).toHaveLength(2);
      expect(fake.providerResponseLogArtifact.responses.every((response: any) =>
        response.status === 'success'
      )).toBe(true);
      expect(fake.retrievalCandidatesArtifact.candidates).toHaveLength(4);
      expect(fake.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
        candidate.canCreateSourceClaim === false
      )).toBe(true);
      expect(fake.liveRetrievalCacheWriteArtifact.cacheWrites).toHaveLength(4);
      expect(fake.liveRetrievalCacheWriteArtifact.cacheWrites[0]).toHaveProperty('providerResponseId');
      expect(fake.retrievalCacheManifestArtifact.cacheRecords[0]).toHaveProperty('providerResponseId');
      expect(fake.sourceTypingReportArtifact.candidateClassifications.map((entry: any) =>
        entry.sourceTypeHypothesis
      )).toEqual(expect.arrayContaining(['library', 'museum']));
      expect(fake.sourceClaimsArtifact.claims).toHaveLength(0);
      expect(fake.grammarRevisionArtifact.revisions).toHaveLength(0);
      expect(fake.researchPackageManifest.collections.some((collection: any) =>
        collection.type === 'provider-config-applied'
      )).toBe(true);
      expect(fake.researchPackageManifest.collections.some((collection: any) =>
        collection.type === 'provider-response-log'
      )).toBe(true);

      const serializedArtifacts = [
        fake.providerConfigAppliedArtifact,
        fake.liveRetrievalRequestsArtifact,
        fake.providerRequestShapesArtifact,
        fake.providerResponseLogArtifact,
        fake.providerErrorReportArtifact,
        fake.retrievalCacheManifestArtifact,
        fake.liveRetrievalCacheWriteArtifact
      ].map((artifact) => JSON.stringify(artifact)).join('\n');
      expect(serializedArtifacts).not.toContain('metagrinder-fake-secret-do-not-log');

      const replayOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-replay-'));
      const replay = runMetagrinderMvp({
        inputPath,
        outputDir: replayOutputDir,
        title: 'Checkpoint Provider Cache Replay',
        webResearchMode: 'cache-replay',
        retrievalCacheDir: path.join(fakeOutputDir, 'retrieval-cache-manifest.json'),
        sourceIntakeApprovalFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-intake-approval-historical-crowd-live.json'),
        sourceClaimReviewFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-claim-review-historical-crowd.json'),
        revisionStateFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'revision-state-historical-crowd-citation-gated.json'),
        applyAcceptedRevisions: true,
        compileGrammar: 'accepted'
      });
      expect(replay.retrievalCacheManifestArtifact.cacheHit).toBe(true);
      expect(replay.approvedSourceResultsArtifact.approvedResults).toHaveLength(1);
      expect(replay.sourceEvidenceArtifact.evidence).toHaveLength(1);
      expect(replay.sourceClaimsArtifact.claims).toHaveLength(1);
      expect(replay.acceptedGrammarDeltasArtifact.deltas[0]).toMatchObject({
        applied: true,
        citationStatus: 'accepted'
      });

      const errorCases = [
        {
          name: 'timeout',
          client: () => {
            throw new Error('timeout after 5ms');
          },
          expectedStatus: 'timeout'
        },
        {
          name: 'rate-limit',
          client: () => ({ status: 429, json: { results: [] }, durationMs: 12 }),
          expectedStatus: 'rate-limited'
        },
        {
          name: 'parse-error',
          client: () => ({ status: 200, json: { unexpected: [] }, durationMs: 3 }),
          expectedStatus: 'parse-error'
        }
      ];
      errorCases.forEach((errorCase) => {
        const errorConfigPath = path.join(os.tmpdir(), `metagrinder-${errorCase.name}-config.json`);
        fs.writeFileSync(errorConfigPath, JSON.stringify({
          providerId: 'generic-http-search',
          endpoint: 'https://example.invalid/search',
          requiresApiKey: false
        }), 'utf8');
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `metagrinder-http-${errorCase.name}-`));
        const result = runMetagrinderMvp({
          inputPath,
          outputDir,
          title: `Checkpoint ${errorCase.name}`,
          webResearchMode: 'live-candidate-only',
          enableLiveRetrieval: true,
          liveProvider: 'generic-http-search',
          providerConfigFilePath: errorConfigPath,
          providerHttpClient: errorCase.client,
          maxQueriesTotal: 1,
          maxResultsPerQuery: 1
        });
        expect(result.providerResponseLogArtifact.responses[0].status).toBe(errorCase.expectedStatus);
        expect(result.providerErrorReportArtifact.errors.some((error: any) =>
          error.errorType === errorCase.expectedStatus && error.fatal === false
        )).toBe(true);
        expect(result.sourceClaimsArtifact.claims).toHaveLength(0);
      });
    } finally {
      if (previousEnvGuard === undefined) delete process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
      else process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL = previousEnvGuard;
      if (previousEndpoint === undefined) delete process.env.METAGRINDER_SEARCH_ENDPOINT;
      else process.env.METAGRINDER_SEARCH_ENDPOINT = previousEndpoint;
      if (previousApiKey === undefined) delete process.env.METAGRINDER_SEARCH_API_KEY;
      else process.env.METAGRINDER_SEARCH_API_KEY = previousApiKey;
    }
  });

  test('one-query no-auth generic-http pilot is cache-write only and safely replayable', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const previousEnvGuard = process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
    process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL = '1';

    try {
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-noauth-'));
      const result = runMetagrinderMvp({
        inputPath,
        outputDir,
        title: 'Checkpoint No Auth Fake Provider',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        providerConfigFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'provider-config-generic-http-search-noauth-fake.json'),
        retrievalPolicyFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'retrieval-policy-live-one-query.json'),
        maxQueriesTotal: 1,
        maxResultsPerQuery: 2
      });

      expect(() => MetagrinderLiveProviderPilotReportSchema.parse(result.liveProviderPilotReportArtifact)).not.toThrow();
      expect(result.providerConfigAppliedArtifact).toMatchObject({
        providerId: 'generic-http-search',
        endpointConfigured: true,
        apiKeyConfigured: true
      });
      expect(result.providerConfigAppliedArtifact.sanitizedConfig.requiresApiKey).toBe(false);
      expect(result.providerPreflightReportArtifact.verdict).toBe('allowed');
      expect(result.providerRequestShapesArtifact.requests).toHaveLength(1);
      expect(result.providerResponseLogArtifact.responses).toHaveLength(1);
      expect(result.retrievalCandidatesArtifact.candidates).toHaveLength(2);
      expect(result.retrievalCandidatesArtifact.candidates.every((candidate: any) =>
        candidate.canCreateSourceClaim === false
      )).toBe(true);
      expect(result.liveRetrievalCacheWriteArtifact.cacheWrites).toHaveLength(2);
      expect(result.sourceClaimsArtifact.claims).toHaveLength(0);
      expect(result.grammarRevisionArtifact.revisions).toHaveLength(0);
      expect(result.liveProviderPilotReportArtifact).toMatchObject({
        networkAttempted: true,
        networkSucceeded: true,
        candidateCount: 2,
        sourceClaimsCreated: 0,
        grammarRevisionsCreated: 0,
        cacheWriteCount: 2,
        verdict: 'safe'
      });
      expect(result.providerResponseLogArtifact.responses[0]).toMatchObject({
        status: 'success',
        rawResultCount: 2,
        normalizedCandidateCount: 2
      });
      expect(result.retrievalCandidatesArtifact.candidates[0]).toMatchObject({
        title: 'Public library record for early spectator scene',
        domain: 'library.example.org',
        sourceTypeHypothesis: 'library'
      });
      expect(result.sourceTypingReportArtifact.candidateClassifications.map((entry: any) =>
        entry.sourceTypeHypothesis
      )).toEqual(['library', 'newspaper']);
      expect(JSON.stringify(result.providerConfigAppliedArtifact)).not.toContain('Bearer');

      const failedOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-noauth-failed-'));
      const failedConfigPath = path.join(os.tmpdir(), 'metagrinder-noauth-failed-config.json');
      fs.writeFileSync(failedConfigPath, JSON.stringify({
        providerId: 'generic-http-search',
        endpoint: 'https://example.invalid/search',
        requiresApiKey: false,
        fakeError: 'timeout'
      }), 'utf8');
      const failed = runMetagrinderMvp({
        inputPath,
        outputDir: failedOutputDir,
        title: 'Checkpoint Failed Provider',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        providerConfigFilePath: failedConfigPath,
        maxQueriesTotal: 1,
        maxResultsPerQuery: 2
      });
      expect(failed.liveProviderPilotReportArtifact).toMatchObject({
        networkAttempted: true,
        networkSucceeded: false,
        candidateCount: 0,
        sourceClaimsCreated: 0,
        grammarRevisionsCreated: 0,
        verdict: 'safe-failed-provider'
      });

      const replayOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-http-noauth-replay-'));
      const replay = runMetagrinderMvp({
        inputPath,
        outputDir: replayOutputDir,
        title: 'Checkpoint Pilot Cache Replay',
        webResearchMode: 'cache-replay',
        retrievalCacheDir: path.join(outputDir, 'retrieval-cache-manifest.json'),
        sourceIntakeApprovalFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-intake-approval-historical-crowd-live.json'),
        sourceClaimReviewFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-claim-review-historical-crowd.json'),
        revisionStateFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'revision-state-historical-crowd-citation-gated.json'),
        applyAcceptedRevisions: true,
        compileGrammar: 'accepted'
      });
      expect(replay.retrievalCacheManifestArtifact.cacheHit).toBe(true);
      expect(replay.approvedSourceResultsArtifact.approvedResults).toHaveLength(1);
      expect(replay.sourceEvidenceArtifact.evidence).toHaveLength(1);
      expect(replay.sourceClaimsArtifact.claims).toHaveLength(1);
      expect(replay.acceptedGrammarDeltasArtifact.deltas[0]).toMatchObject({
        applied: true,
        citationStatus: 'accepted'
      });
    } finally {
      if (previousEnvGuard === undefined) delete process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
      else process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL = previousEnvGuard;
    }
  });

  test('real endpoint proof skips missing local config and supports selector approval after inspection', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const previousEnvGuard = process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
    process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL = '1';

    try {
      const missingOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-real-missing-'));
      const missing = runMetagrinderMvp({
        inputPath,
        outputDir: missingOutputDir,
        title: 'Checkpoint Real Config Missing',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        providerConfigFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'provider-config-generic-http-search-real.local.json'),
        maxQueriesTotal: 1,
        maxQueriesPerGap: 1,
        maxResultsPerQuery: 2
      });
      expect(() => MetagrinderRealEndpointProofReportSchema.parse(missing.realEndpointProofReportArtifact)).not.toThrow();
      expect(missing.realEndpointProofReportArtifact).toMatchObject({
        configPresent: false,
        networkAttempted: false,
        networkSucceeded: false,
        candidateCount: 0,
        sourceClaimsCreated: 0,
        grammarRevisionsCreated: 0,
        verdict: 'skipped-no-provider-config'
      });
      expect(missing.retrievalSafetyReportArtifact.verdict).toBe('safe');
      expect(missing.sourceClaimsArtifact.claims).toHaveLength(0);
      expect(missing.grammarRevisionArtifact.revisions).toHaveLength(0);

      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-real-inspection-'));
      const inspected = runMetagrinderMvp({
        inputPath,
        outputDir,
        title: 'Checkpoint Candidate Inspection',
        webResearchMode: 'live-candidate-only',
        enableLiveRetrieval: true,
        liveProvider: 'generic-http-search',
        providerConfigFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'provider-config-generic-http-search-noauth-fake.json'),
        maxQueriesTotal: 1,
        maxQueriesPerGap: 1,
        maxResultsPerQuery: 2
      });
      expect(() => MetagrinderCandidateInspectionArtifactSchema.parse(inspected.candidateInspectionArtifact)).not.toThrow();
      expect(inspected.candidateInspectionArtifact.candidates).toHaveLength(2);
      expect(inspected.candidateInspectionArtifact.candidates[0]).toMatchObject({
        candidateId: 'retrieval_candidate_live_001',
        sourceTypeHypothesis: 'library',
        sourceQualityHypothesis: 'medium',
        canCreateSourceClaim: false
      });
      expect(inspected.candidateInspectionArtifact.candidates[0].payloadHash).toMatch(/^sha256:/);
      expect(fs.readFileSync(path.join(outputDir, 'candidate-inspection.md'), 'utf8')).toContain('Recommended action:');
      expect(inspected.researchPackageManifest.collections.some((collection: any) =>
        collection.type === 'candidate-inspection'
      )).toBe(true);
      expect(inspected.researchPackageManifest.collections.some((collection: any) =>
        collection.type === 'real-endpoint-proof-report'
      )).toBe(true);

      const replayOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-real-selector-replay-'));
      const replay = runMetagrinderMvp({
        inputPath,
        outputDir: replayOutputDir,
        title: 'Checkpoint Cache Replay Review',
        webResearchMode: 'cache-replay',
        retrievalCacheDir: path.join(outputDir, 'retrieval-cache-manifest.json'),
        sourceIntakeApprovalFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-intake-approval-historical-crowd-selector.json'),
        sourceClaimReviewFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'source-claim-review-historical-crowd.json'),
        revisionStateFilePath: path.join(__dirname, 'fixtures', 'metagrinder', 'revision-state-historical-crowd-citation-gated.json'),
        applyAcceptedRevisions: true,
        compileGrammar: 'accepted'
      });
      expect(replay.approvedSourceResultsArtifact.approvedResults).toHaveLength(1);
      expect(replay.approvedSourceResultsArtifact.approvedResults[0]).toMatchObject({
        candidateId: 'retrieval_candidate_live_001',
        approvalMatchMode: 'canonicalUrl'
      });
      expect(replay.sourceEvidenceArtifact.evidence).toHaveLength(1);
      expect(replay.sourceClaimsArtifact.claims).toHaveLength(1);
      expect(replay.acceptedGrammarDeltasArtifact.deltas[0]).toMatchObject({
        applied: true,
        citationStatus: 'accepted'
      });

      const ambiguousApproval = {
        inputId: 'research-input-historical-crowd-grammar',
        approvals: [
          {
            candidateSelector: { queryId: 'gap_middle_class_spectator_weight_support_query_01' },
            approvalStatus: 'approved',
            operatorNote: 'Intentionally ambiguous selector.'
          }
        ]
      };
      const ambiguous = buildApprovedSourceResultsArtifact({
        retrievalCandidatesArtifact: inspected.retrievalCandidatesArtifact,
        sourceIntakeApprovalArtifact: ambiguousApproval
      });
      expect(ambiguous.approvedResults).toHaveLength(0);
      expect(ambiguous.warnings[0]).toContain('matched 2 candidates');
    } finally {
      if (previousEnvGuard === undefined) delete process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL;
      else process.env.METAGRINDER_ENABLE_LIVE_RETRIEVAL = previousEnvGuard;
    }
  });

  test('metagrinder workbench loads artifact folders, protects generated grammar, and imports Codex results', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-historical-crowd-grammar.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-'));
    runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Workbench Artifact Test',
      webResearchMode: 'mock'
    });

    const folder = metagrinderWorkbenchService.loadWorkbenchFolder(outputDir);
    expect(folder.packagePresent).toBe(true);
    expect(folder.collections.some((collection: any) =>
      collection.path === 'research-package.json' && collection.present
    )).toBe(true);
    expect(folder.collections.some((collection: any) =>
      collection.path === 'codex-parse-request.md' && collection.present
    )).toBe(true);
    expect(folder.collections.some((collection: any) =>
      collection.path === 'brief-analysis.json' && collection.present
    )).toBe(true);
    expect(folder.collections.some((collection: any) =>
      collection.type === 'branch-graph' && collection.present
    )).toBe(true);
    expect(folder.stateDrafts['source-intake-approval.json'].approvals.length).toBeGreaterThan(0);
    expect(folder.stateDrafts['source-claim-review.json'].claimReviews.length).toBeGreaterThan(0);
    expect(folder.stateDrafts['revision-state.json'].revisionStates.length).toBeGreaterThan(0);

    const writeResult = metagrinderWorkbenchService.writeOperatorStateFile({
      outputDir,
      fileName: 'revision-state.json',
      data: {
        inputId: folder.inputId,
        revisionStates: []
      }
    });
    expect(writeResult.fileName).toBe('revision-state.json');
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'revision-state.json'), 'utf8'))).toEqual({
      inputId: folder.inputId,
      revisionStates: []
    });
    expect(() => metagrinderWorkbenchService.writeOperatorStateFile({
      outputDir,
      fileName: 'accepted-scene-grammar.json',
      data: {}
    })).toThrow(/operator state files/);

    const codexWrite = metagrinderWorkbenchService.writeCodexParseResultFile({
      outputDir,
      data: {
        inputId: folder.inputId,
        analysisMode: 'codex-semantic',
        sourceInputIds: [folder.inputId],
        mainSubject: {
          subjectId: 'subject',
          label: 'reviewed subject',
          subjectType: 'brief',
          summary: 'Reviewed by Codex.',
          sourceInputIds: [folder.inputId],
          sourceChunkIds: ['chunk'],
          excerptText: 'Reviewed by Codex.',
          attributionMode: 'paraphrased',
          confidence: 'medium',
          validationStatus: 'supported'
        },
        subjectType: 'brief',
        subcategoryCandidates: [],
        subcategoryEvidenceChecks: [],
        subcategoryCharacteristics: [],
        weightedGroups: [],
        rules: [],
        constraints: [],
        examples: [],
        implementationFields: [],
        citations: [],
        researchGaps: [],
        graphAssemblyPlan: { readiness: 'not_ready', nodes: [], edges: [], notes: [] },
        coverage: []
      }
    });
    expect(codexWrite.fileName).toBe('codex-parse-result.json');
  });


  test('metagrinder workbench prepares pasted article runs and invokes the pipeline boundary', async () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-paste-'));
    const prepared = metagrinderWorkbenchService.preparePastedArticleRun({
      title: 'Deep Research Article: 1910 Crowd',
      articleText: 'A deep research article about period crowd structure.',
      outputRoot,
      now: new Date('2026-05-04T12:34:56.000Z')
    });

    expect(path.basename(prepared.outputDir)).toBe('deep-research-article-1910-crowd-2026-05-04T12-34-56-000Z');
    expect(prepared.inputPath).toBe(path.join(prepared.outputDir, 'source-input.txt'));
    expect(fs.readFileSync(prepared.inputPath, 'utf8')).toBe('A deep research article about period crowd structure.\n');
    expect(() => metagrinderWorkbenchService.preparePastedArticleRun({
      articleText: '   ',
      outputRoot
    })).toThrow(/Paste article text/);

    const calls: any[] = [];
    const runResult = await metagrinderWorkbenchServer.runPastedArticle({
      title: 'Deep Research Article',
      articleText: 'Another article body.',
      outputRoot,
      pipelineRunner: async (args: any) => {
        calls.push(args);
        return {
          code: 0,
          stdout: 'ok',
          stderr: '',
          args: ['node', 'run-metagrinder-mvp.js']
        };
      }
    });

    expect(runResult.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      inputPath: runResult.inputPath,
      outputDir: runResult.outputDir,
      title: 'Deep Research Article',
      compileGrammar: 'accepted'
    });
    expect(fs.existsSync(runResult.inputPath)).toBe(true);
  });

  test('copies multiple workbench research inputs into a new run folder', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-multi-'));
    const fileInput = path.join(outputRoot, 'external-note.txt');
    fs.writeFileSync(fileInput, 'External research note.\n', 'utf8');
    const prepared = metagrinderWorkbenchService.prepareResearchInputRun({
      title: 'Multi Source Research',
      outputRoot,
      now: new Date('2026-05-04T12:00:00.000Z'),
      inputs: [
        { kind: 'paste', title: 'Pasted Observation', text: 'Pasted article body.' },
        { kind: 'file', path: fileInput }
      ]
    });

    expect(prepared.inputPaths).toHaveLength(2);
    expect(prepared.inputPath).toBe(prepared.inputPaths[0]);
    expect(path.basename(prepared.outputDir)).toBe('multi-source-research-2026-05-04T12-00-00-000Z');
    expect(path.basename(prepared.inputPaths[0])).toBe('01-pasted-observation.txt');
    expect(path.basename(prepared.inputPaths[1])).toBe('02-external-note.txt');
    expect(fs.readFileSync(prepared.inputPaths[0], 'utf8')).toBe('Pasted article body.\n');
    expect(fs.readFileSync(prepared.inputPaths[1], 'utf8')).toBe('External research note.\n');
  });

  test('workbench lists recent local runs and ignores folders without packages', () => {
    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-recent-'));
    const validDir = path.join(outputRoot, 'valid-run');
    const ignoredDir = path.join(outputRoot, 'not-a-run');
    fs.mkdirSync(ignoredDir, { recursive: true });
    fs.writeFileSync(path.join(ignoredDir, 'note.txt'), 'not a package\n', 'utf8');
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    runMetagrinderMvp({
      inputPath,
      outputDir: validDir,
      title: 'Recent Run Listing Test',
      webResearchMode: 'mock'
    });

    const recent = metagrinderWorkbenchService.listRecentWorkbenchRuns({
      root: outputRoot,
      limit: 10
    });

    expect(recent.root).toBe(path.resolve(outputRoot));
    expect(recent.runs).toHaveLength(1);
    expect(recent.runs[0]).toMatchObject({
      outputDir: validDir,
      title: 'Recent Run Listing Test',
      packagePresent: true,
      analysisMode: 'seed-only',
      codexParseResultPresent: false
    });
  });

  test('workbench rebuilds from an existing Codex result without invoking Codex', async () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-reuse-codex-'));
    runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Workbench Reuse Existing Codex Result',
      webResearchMode: 'mock'
    });
    const folder = metagrinderWorkbenchService.loadWorkbenchFolder(outputDir);
    const chunkId = JSON.parse(fs.readFileSync(path.join(outputDir, 'ingest.json'), 'utf8')).chunks[0].chunkId;
    metagrinderWorkbenchService.writeCodexParseResultFile({
      outputDir,
      data: {
        inputId: folder.inputId,
        analysisMode: 'codex-semantic',
        sourceInputIds: [folder.inputId],
        mainSubject: {
          subjectId: 'reuse_subject',
          label: 'greenhouse reuse subject',
          subjectType: 'operations-brief',
          summary: 'Codex result already exists and should be reused.',
          sourceInputIds: [folder.inputId],
          sourceChunkIds: [chunkId],
          excerptText: 'Greenhouse operations planning brief.',
          attributionMode: 'paraphrased',
          confidence: 'high',
          validationStatus: 'supported'
        },
        subjectType: 'operations-brief',
        subcategoryCandidates: [{
          subcategoryId: 'reuse_operator',
          label: 'Reuse Operator',
          parentSubjectId: 'reuse_subject',
          supportStatus: 'supported',
          evidenceSummary: 'The existing Codex result supports this role.',
          sourceInputIds: [folder.inputId],
          sourceChunkIds: [chunkId],
          excerptText: 'Reuse Operator appears around 30-40%.',
          attributionMode: 'paraphrased',
          confidence: 'high',
          validationStatus: 'supported'
        }],
        subcategoryEvidenceChecks: [],
        subcategoryCharacteristics: [],
        weightedGroups: [{
          weightId: 'reuse_operator_weight',
          label: 'Reuse Operator',
          min: 30,
          max: 40,
          unit: 'percent',
          appliesTo: 'Reuse Operator',
          sourceInputIds: [folder.inputId],
          sourceChunkIds: [chunkId],
          excerptText: 'Reuse Operator appears around 30-40%.',
          attributionMode: 'paraphrased',
          confidence: 'high',
          validationStatus: 'supported'
        }],
        rules: [],
        constraints: [],
        examples: [],
        implementationFields: [],
        citations: [],
        researchGaps: [],
        graphAssemblyPlan: { readiness: 'ready', nodes: [], edges: [], notes: [] },
        coverage: []
      }
    });
    const calls: any[] = [];
    const result = await metagrinderWorkbenchServer.rebuildFromExistingCodexResult({
      outputDir,
      pipelineRunner: async (args: any) => {
        calls.push(args);
        runMetagrinderMvp({
          inputPath: args.inputPaths[0],
          outputDir: args.outputDir,
          title: 'Workbench Reuse Existing Codex Result',
          webResearchMode: 'mock'
        });
        return {
          code: 0,
          stdout: 'rebuilt from existing codex',
          stderr: '',
          args: ['node', 'run-metagrinder-mvp.js']
        };
      }
    });

    expect(calls).toHaveLength(1);
    expect(result.reusedCodexParseResult).toBe(true);
    expect(result.analysisMode).toBe('codex-semantic');
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'brief-analysis.json'), 'utf8')).mainSubject.label).toBe('greenhouse reuse subject');
    expect(metagrinderWorkbenchService.loadWorkbenchFolder(outputDir).semanticStatus.codexParseResultPresent).toBe(true);
  });

  test('workbench labels seed-only runs and rejects malformed Codex parse results', () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-seed-'));
    runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Workbench Seed Only Test',
      webResearchMode: 'mock'
    });

    const folder = metagrinderWorkbenchService.loadWorkbenchFolder(outputDir);
    expect(folder.semanticStatus.analysisMode).toBe('seed-only');
    expect(folder.semanticStatus.codexParseResultPresent).toBe(false);
    expect(() => metagrinderWorkbenchService.writeCodexParseResultFile({
      outputDir,
      data: {
        inputId: folder.inputId,
        analysisMode: 'codex-semantic'
      }
    })).toThrow();
  });

  test('local Codex semantic runner imports final-message JSON, logs status, and rebuilds projection', async () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-codex-'));
    runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Workbench Codex Runner Test',
      webResearchMode: 'mock'
    });
    const folder = metagrinderWorkbenchService.loadWorkbenchFolder(outputDir);
    const codexResult = {
      inputId: folder.inputId,
      analysisMode: 'codex-semantic',
      sourceInputIds: [folder.inputId],
      mainSubject: {
        subjectId: 'greenhouse_main_subject',
        label: 'greenhouse operations brief',
        subjectType: 'operations-brief',
        summary: 'Codex identified a greenhouse operations planning brief.',
        sourceInputIds: [folder.inputId],
        sourceChunkIds: [`${folder.inputId}_chunk_001`],
        excerptText: 'Greenhouse operations planning brief.',
        attributionMode: 'paraphrased',
        confidence: 'high',
        validationStatus: 'supported'
      },
      subjectType: 'operations-brief',
      subcategoryCandidates: [
        {
          subcategoryId: 'irrigation_coordinator',
          label: 'Irrigation Coordinator',
          parentSubjectId: 'greenhouse_main_subject',
          supportStatus: 'supported',
          evidenceSummary: 'The brief discusses irrigation coordination as a supported component.',
          sourceInputIds: [folder.inputId],
          sourceChunkIds: [`${folder.inputId}_chunk_001`],
          excerptText: 'Irrigation Coordinator appears around 40-50%.',
          attributionMode: 'paraphrased',
          confidence: 'high',
          validationStatus: 'supported'
        }
      ],
      subcategoryEvidenceChecks: [],
      subcategoryCharacteristics: [],
      weightedGroups: [
        {
          weightId: 'irrigation_coordinator_weight',
          label: 'Irrigation Coordinator',
          min: 40,
          max: 50,
          unit: 'percent',
          appliesTo: 'Irrigation Coordinator',
          sourceInputIds: [folder.inputId],
          sourceChunkIds: [`${folder.inputId}_chunk_001`],
          excerptText: 'Irrigation Coordinator appears around 40-50%.',
          attributionMode: 'paraphrased',
          confidence: 'high',
          validationStatus: 'supported'
        }
      ],
      rules: [],
      constraints: [],
      examples: [],
      implementationFields: [],
      citations: [],
      researchGaps: [],
      graphAssemblyPlan: {
        readiness: 'ready',
        nodes: [
          {
            nodeId: 'irrigation_coordinator',
            label: 'Irrigation Coordinator',
            nodeType: 'candidate-subcategory',
            sourceRecordIds: ['irrigation_coordinator'],
            reviewStatus: 'supported'
          }
        ],
        edges: [],
        notes: ['Use the supported Codex component as a prompt graph choice.']
      },
      coverage: []
    };

    const result = await metagrinderWorkbenchServer.runCodexSemanticParse({
      outputDir,
      command: 'fake-codex',
      args: ['exec'],
      commandRunner: async () => {
        fs.writeFileSync(
          path.join(outputDir, 'codex-last-message.txt'),
          `${JSON.stringify(codexResult, null, 2)}\n`,
          'utf8'
        );
        return { code: 0, stdout: 'codex ok', stderr: '' };
      },
      pipelineRunner: async (args: any) => {
        runMetagrinderMvp({
          inputPath: args.inputPaths[0],
          outputDir: args.outputDir,
          title: 'Workbench Codex Runner Test',
          webResearchMode: 'mock'
        });
        return {
          code: 0,
          stdout: 'rebuilt',
          stderr: '',
          args: ['node', 'run-metagrinder-mvp.js']
        };
      }
    });

    expect(result.status).toBe('complete');
    expect(result.analysisMode).toBe('codex-semantic');
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'codex-parse-result.json'), 'utf8')).mainSubject.label).toBe('greenhouse operations brief');
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'brief-analysis.json'), 'utf8')).analysisMode).toBe('codex-semantic');
    expect(fs.existsSync(path.join(outputDir, 'codex-run-log.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'codex-run-status.json'), 'utf8')).status).toBe('complete');
  });

  test('local Codex semantic runner restores protected artifacts on direct mutation', async () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-protected-'));
    runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Workbench Protected Artifact Test',
      webResearchMode: 'mock'
    });
    const acceptedBefore = fs.readFileSync(path.join(outputDir, 'accepted-scene-grammar.json'), 'utf8');

    const result = await metagrinderWorkbenchServer.runCodexSemanticParse({
      outputDir,
      command: 'fake-codex',
      args: ['exec'],
      commandRunner: async () => {
        fs.writeFileSync(path.join(outputDir, 'accepted-scene-grammar.json'), '{"mutated":true}\n', 'utf8');
        fs.writeFileSync(
          path.join(outputDir, 'codex-parse-result.json'),
          `${JSON.stringify({
            inputId: 'bad',
            analysisMode: 'codex-semantic',
            sourceInputIds: ['bad'],
            mainSubject: {
              subjectId: 'bad_subject',
              label: 'bad',
              subjectType: 'brief',
              summary: 'bad',
              sourceInputIds: ['bad'],
              sourceChunkIds: ['bad_chunk'],
              excerptText: 'bad',
              attributionMode: 'paraphrased',
              confidence: 'low',
              validationStatus: 'weak'
            },
            subjectType: 'brief',
            subcategoryCandidates: [],
            subcategoryEvidenceChecks: [],
            subcategoryCharacteristics: [],
            weightedGroups: [],
            rules: [],
            constraints: [],
            examples: [],
            implementationFields: [],
            citations: [],
            researchGaps: [],
            graphAssemblyPlan: { readiness: 'not_ready', nodes: [], edges: [], notes: [] },
            coverage: []
          }, null, 2)}\n`,
          'utf8'
        );
        return { code: 0, stdout: '', stderr: '' };
      },
      pipelineRunner: async () => {
        throw new Error('Pipeline should not rebuild after protected mutation.');
      }
    });

    expect(result.status).toBe('failed');
    expect(result.warnings.join(' ')).toMatch(/protected artifacts/);
    expect(fs.readFileSync(path.join(outputDir, 'accepted-scene-grammar.json'), 'utf8')).toBe(acceptedBefore);
  });

  test('workbench readability sweetening rewrites only existing choice text and rebuilds PSG', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-readability-'));
    const semanticChoiceGraphArtifact = testSemanticChoiceGraph();
    const sceneGrammarArtifact = {
      inputId: semanticChoiceGraphArtifact.inputId,
      sceneContext: {
        title: 'Readability Test',
        summary: 'A prompt graph readability test.'
      },
      reviewFlags: ['codex-semantic-projection'],
      archetypes: [],
      locationZones: [],
      wardrobeSystem: [],
      propsAndAccessories: [],
      behaviorStates: [],
      environmentalModifiers: []
    };
    const psgArtifact = buildSceneGrammarPsg({
      sceneGrammarArtifact,
      semanticChoiceGraphArtifact,
      now: () => '2026-05-06T00:00:00.000Z'
    });
    fs.writeFileSync(path.join(outputDir, 'semantic-choice-graph.json'), `${JSON.stringify(semanticChoiceGraphArtifact, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'scene-grammar.json'), `${JSON.stringify(sceneGrammarArtifact, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'scene-grammar.psg'), `${JSON.stringify(psgArtifact, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'accepted-scene-grammar.json'), '{"protected":true}\n', 'utf8');
    const acceptedBefore = fs.readFileSync(path.join(outputDir, 'accepted-scene-grammar.json'), 'utf8');

    const result = await metagrinderWorkbenchServer.runCodexReadabilitySweeten({
      outputDir,
      command: 'fake-codex',
      args: ['exec'],
      commandRunner: async () => ({
        code: 0,
        status: 'exited',
        stdout: JSON.stringify({
          inputId: semanticChoiceGraphArtifact.inputId,
          rewrites: [
            {
              choiceId: 'age_child_if_supported',
              beforeText: 'Child if supported',
              afterText: 'a child spectator when children are supported by the source',
              reason: 'Make the age choice read like a prompt phrase.'
            }
          ]
        }),
        stderr: ''
      })
    });

    const nextGraph = JSON.parse(fs.readFileSync(path.join(outputDir, 'semantic-choice-graph.json'), 'utf8'));
    const nextPsg = JSON.parse(fs.readFileSync(path.join(outputDir, 'scene-grammar.psg'), 'utf8'));
    expect(result.status).toBe('complete');
    expect(result.appliedRewriteCount).toBe(1);
    expect(nextGraph.axes.find((axis: any) => axis.axisId === 'age').choices
      .find((choice: any) => choice.choiceId === 'age_child_if_supported').text)
      .toBe('a child spectator when children are supported by the source');
    expect(nextGraph.axes.find((axis: any) => axis.axisId === 'age').choices
      .find((choice: any) => choice.choiceId === 'age_child_if_supported').weight)
      .toBe(15);
    expect(fs.readFileSync(path.join(outputDir, 'accepted-scene-grammar.json'), 'utf8')).toBe(acceptedBefore);
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'codex-sweeten-run-status.json'), 'utf8')).status).toBe('complete');
    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'psg-output-flight.json'), 'utf8')).samples).toHaveLength(20);
    expectPromptSpaghettiPsg(nextPsg);
  });

  test('workbench Codex runner uses shell launch on Windows', () => {
    const invocation = metagrinderWorkbenchServer.codexSpawnInvocation({
      command: 'codex.cmd',
      args: ['exec', '-C', 'H:\\Other computers\\My Computer\\Documents\\Cascade Projects\\metagrinder', '-']
    });
    if (process.platform === 'win32') {
      expect(path.basename(invocation.command).toLowerCase()).toBe(path.basename(process.execPath).toLowerCase());
      expect(invocation.args[0]).toMatch(/@openai[\\/]codex[\\/]bin[\\/]codex\.js$/);
      expect(invocation.args).toContain('H:\\Other computers\\My Computer\\Documents\\Cascade Projects\\metagrinder');
    } else {
      expect(invocation.command).toBe('codex.cmd');
    }
    expect(metagrinderWorkbenchService.normalizeCodexRunStatus({
      status: 'running',
      startedAt: '2026-05-05T00:00:00.000Z',
      completedAt: null
    }, new Date('2026-05-05T00:20:00.000Z')).status).toBe('stale');
    const previousArgs = process.env.METAGRINDER_CODEX_ARGS;
    delete process.env.METAGRINDER_CODEX_ARGS;
    try {
      const args = metagrinderWorkbenchServer.defaultCodexArgs('output folder');
      expect(args).toEqual(expect.arrayContaining(['-m', process.env.METAGRINDER_CODEX_MODEL || 'gpt-5.2']));
      expect(args).toEqual(expect.arrayContaining(['--sandbox', 'read-only', '--output-schema']));
      expect(args[args.indexOf('--output-schema') + 1]).toMatch(/codex-parse-result\.schema\.json$/);
    } finally {
      if (previousArgs === undefined) delete process.env.METAGRINDER_CODEX_ARGS;
      else process.env.METAGRINDER_CODEX_ARGS = previousArgs;
    }
  });

  test('workbench Codex runner records spawn failures and stale running status', async () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-spawn-fail-'));
    runMetagrinderMvp({
      inputPath,
      outputDir,
      title: 'Workbench Spawn Failure Test',
      webResearchMode: 'mock'
    });
    fs.writeFileSync(path.join(outputDir, 'codex-run-status.json'), `${JSON.stringify({
      inputId: 'stale',
      status: 'running',
      startedAt: '2026-05-05T00:00:00.000Z',
      completedAt: null,
      message: 'old run'
    }, null, 2)}\n`, 'utf8');

    const result = await metagrinderWorkbenchServer.runCodexSemanticParse({
      outputDir,
      command: 'fake-codex',
      args: ['exec'],
      commandRunner: async () => {
        throw new Error('spawn EINVAL');
      },
      pipelineRunner: async () => {
        throw new Error('Pipeline should not rebuild after spawn failure.');
      }
    });

    const status = JSON.parse(fs.readFileSync(path.join(outputDir, 'codex-run-status.json'), 'utf8'));
    const logArtifact = JSON.parse(fs.readFileSync(path.join(outputDir, 'codex-run-log.json'), 'utf8'));
    expect(result.status).toBe('failed');
    expect(status.status).toBe('failed');
    expect(status.warnings.join(' ')).toMatch(/Previous Codex semantic parse/);
    expect(logArtifact.stderr).toMatch(/spawn EINVAL/);
    expect(fs.existsSync(path.join(outputDir, 'codex-parse-result.json'))).toBe(false);
  });

  test('workbench Codex runner logs missing parse output and timeout results', async () => {
    const inputPath = path.join(
      __dirname,
      'fixtures',
      'metagrinder',
      'research-input-greenhouse-operations-structured-brief.txt'
    );
    const missingOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-missing-result-'));
    runMetagrinderMvp({
      inputPath,
      outputDir: missingOutputDir,
      title: 'Workbench Missing Result Test',
      webResearchMode: 'mock'
    });

    const missingResult = await metagrinderWorkbenchServer.runCodexSemanticParse({
      outputDir: missingOutputDir,
      command: 'fake-codex',
      args: ['exec'],
      commandRunner: async () => ({ code: 0, status: 'exited', stdout: 'No JSON result.', stderr: '' }),
      pipelineRunner: async () => {
        throw new Error('Pipeline should not rebuild without codex-parse-result.json.');
      }
    });
    const missingStatus = JSON.parse(fs.readFileSync(path.join(missingOutputDir, 'codex-run-status.json'), 'utf8'));
    expect(missingResult.status).toBe('failed');
    expect(missingStatus.status).toBe('failed');
    expect(missingStatus.warnings.join(' ')).toMatch(/did not return a usable semantic parse JSON result/);

    const timeoutOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-workbench-timeout-'));
    runMetagrinderMvp({
      inputPath,
      outputDir: timeoutOutputDir,
      title: 'Workbench Timeout Test',
      webResearchMode: 'mock'
    });
    const timeoutResult = await metagrinderWorkbenchServer.runCodexSemanticParse({
      outputDir: timeoutOutputDir,
      command: 'fake-codex',
      args: ['exec'],
      timeoutMs: 25,
      commandRunner: async ({ timeoutMs }: any) => ({
        code: 124,
        status: 'timeout',
        stdout: '',
        stderr: `Codex runner timed out after ${timeoutMs} ms.`
      }),
      pipelineRunner: async () => {
        throw new Error('Pipeline should not rebuild after timeout.');
      }
    });
    const timeoutStatus = JSON.parse(fs.readFileSync(path.join(timeoutOutputDir, 'codex-run-status.json'), 'utf8'));
    expect(timeoutResult.status).toBe('timeout');
    expect(timeoutStatus.status).toBe('timeout');
    expect(JSON.parse(fs.readFileSync(path.join(timeoutOutputDir, 'codex-run-log.json'), 'utf8')).timeoutMs).toBe(25);
  });
  test('revision state application reports unknown ids and missing operator notes', () => {
    const grammarRevisionArtifact = MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: 'scene',
      revisions: [
        {
          revisionId: 'revision_001',
          gapId: 'gap_001',
          changeType: 'no-op',
          targetGrammarRef: 'sceneGrammar',
          before: 'before',
          after: 'after',
          reason: 'reviewable',
          sourceClaimIds: ['source_claim_001'],
          confidence: 'low',
          reviewStatus: 'needs_review'
        }
      ]
    });
    const { grammarRevisionArtifact: reviewed, revisionStateAppliedArtifact } = applyRevisionStateFile({
      grammarRevisionArtifact,
      revisionStateFile: {
        inputId: 'scene',
        revisionStates: [
          {
            revisionId: 'revision_001',
            reviewStatus: 'accepted'
          },
          {
            revisionId: 'revision_unknown',
            reviewStatus: 'rejected',
            operatorNote: 'No matching proposed revision.'
          }
        ]
      },
      revisionStateFilePath: 'revision-state.json',
      sourceClaimsArtifact: {
        inputId: 'scene',
        claims: [
          {
            sourceClaimId: 'source_claim_001',
            sourceId: 'source_loc_001',
            gapId: 'gap_001',
            claim: 'Weak support.',
            claimType: 'source-support',
            supportsGrammarRefs: ['sceneGrammar'],
            attributionMode: 'web-retrieved',
            confidence: 'low',
            evidenceText: 'Weak support.',
            evidenceLocator: {
              url: 'mock://source',
              page: null,
              selector: null,
              accessDate: '2026-05-02'
            },
            limitations: [],
            reviewStatus: 'needs_review'
          }
        ]
      }
    });

    expect(reviewed.revisions[0].reviewStatus).toBe('accepted');
    expect(revisionStateAppliedArtifact.appliedRevisionIds).toContain('revision_001');
    expect(revisionStateAppliedArtifact.unknownRevisionIds).toContain('revision_unknown');
    expect(revisionStateAppliedArtifact.warnings).toEqual(expect.arrayContaining([
      'Revision state revision_001 is missing operatorNote.',
      'Accepted revision revision_001 is supported only by low-quality source claims.'
    ]));
    expect(() => MetagrinderRevisionStateAppliedSchema.parse(revisionStateAppliedArtifact)).not.toThrow();
  });

  test('keeps mutation collection in the manifest even when no variants are generated', () => {
    const ingestArtifact = buildIngestArtifact({
      inputPath: 'single-family.txt',
      rawText: '# Notes\n\nLamp glow on wet stone.\n\nMarquee spill on dark glass.',
      inputId: 'single-family',
      title: 'Single family fragments',
      createdAt: '2026-03-07T12:00:00.000Z'
    });
    const scoreArtifact = buildScoreArtifact({
      ingestArtifact,
      extractArtifact: {
        inputId: 'single-family',
        claims: [],
        conceptCandidates: [],
        evidence: [],
        openQuestions: [],
        warnings: []
      },
      synthesizeArtifact: {
        inputId: 'single-family',
        promptFragments: []
      }
    });
    const mutationArtifact = buildMutationArtifact({
      synthesizeArtifact: {
        inputId: 'single-family',
        promptFragments: [
          {
            fragmentId: 'fragment_001',
            family: 'lighting',
            text: 'lamp glow on wet stone',
            conceptIds: ['concept_001'],
            sourceInputIds: ['single-family'],
            sourceChunkIds: ['single-family_chunk_001']
          },
          {
            fragmentId: 'fragment_002',
            family: 'lighting',
            text: 'marquee spill on dark glass',
            conceptIds: ['concept_002'],
            sourceInputIds: ['single-family'],
            sourceChunkIds: ['single-family_chunk_002']
          }
        ]
      }
    });
    const researchPackageManifest = buildResearchPackageManifest({
      ingestArtifact,
      scoreArtifact,
      mutationArtifact
    });

    expect(mutationArtifact.variants).toHaveLength(0);
    expect(researchPackageManifest.strategyVersion).toBe('epic3-story4');
    expect(
      researchPackageManifest.collections.some(collection => collection.type === 'prompt-mutations')
    ).toBe(true);
  });

  test('parses utdg submission fixture', () => {
    const fixture = readFixture('utdg-submission.json');
    const result = UtdgSubmissionManifestSchema.parse(fixture);

    expect(result.packageType).toBe('utdg-submission');
    expect(result.reviewStatus).toBe('staged');
  });

  test('parses utdg candidates fixture', () => {
    const fixture = readFixture('utdg-candidates.json');
    const result = UtdgCandidatesFileSchema.parse(fixture);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].proposedRightsProfile).toBe('reference-only');
  });

  test('parses world semantic field fixture', () => {
    const fixture = readFixture('world-semantic-field.json');
    const result = WorldSemanticFieldSchema.parse(fixture);

    expect(result.coordinateSpace).toBe('world');
    expect(result.records).toHaveLength(2);
    expect(result.records[0].recordType).toBe('SemanticPoint');
    expect(result.records[1].recordType).toBe('SemanticRegion');
  });

  test('parses render text packet fixture', () => {
    const fixture = readFixture('render-text-packet.json');
    const result = RenderTextPacketSchema.parse(fixture);

    expect(result.hero_details).toHaveLength(1);
    expect(result.environmental_conditions[0]).toContain('rain');
  });

  test('parses spicy metaball fixture', () => {
    const fixture = readFixture('spicy-metaball.json');
    const result = MetaballManifestSchema.parse(fixture);

    expect(result.packageType).toBe('metaball-manifest');
    expect(result.worldSemanticField?.fieldId).toBe('wsf_demo_001');
    expect(result.renderTextPackets).toHaveLength(1);
    expect(result.promptGraphs).toHaveLength(1);
    expect(result.semanticScenePackages).toHaveLength(1);
    expect(result.witnessRenders).toHaveLength(2);
  });

  test('parses camera pass manifest fixture', () => {
    const fixture = readFixture('camera-pass-manifest.json');
    const result = CameraPassManifestSchema.parse(fixture);

    expect(result.taskMode).toBe('image-modify-prep');
    expect(result.queryConfig.maxPacketEntries).toBe(16);
  });

  test('parses model conditioning payload fixture', () => {
    const fixture = readFixture('model-conditioning-payload.json');
    const result = ModelConditioningPayloadSchema.parse(fixture);

    expect(result.taskMode).toBe('material-refinement');
    expect(result.conditioningAssets.witnessRender).toBe(
      'preview-control-image.png'
    );
  });

  test('parses luma adapter contract fixture', () => {
    const fixture = readFixture('luma-adapter-contract.json');
    const result = LumaAdapterContractSchema.parse(fixture);

    expect(result.provider).toBe('luma');
    expect(result.mode).toBe('image-modify');
  });

  test('parses semantic scene package fixture', () => {
    const fixture = readFixture('semantic-scene-package.json');
    const result = SemanticScenePackageSchema.parse(fixture);

    expect(result.packageType).toBe('semantic-scene-package');
    expect(result.sceneRegions).toHaveLength(1);
    expect(result.promptAlignment[0].status).toBe('present');
  });

  test('parses patch proposal fixture', () => {
    const fixture = readFixture('patch-proposal.json');
    const result = PatchProposalSchema.parse(fixture);

    expect(result.targetType).toBe('wall-continuation');
    expect(result.reviewStatus).toBe('draft');
  });

  test('parses prompt graph fixture', () => {
    const fixture = readFixture('prompt-graph.json');
    const result = PromptGraphManifestSchema.parse(fixture);

    expect(result.nodes).toHaveLength(6);
    expect(result.nodes[0].textVariants.lod2[0]).toContain('left side of the alley');
  });

  test('parses packet attribution fixture', () => {
    const fixture = readFixture('packet-attribution.json');
    const result = PacketAttributionManifestSchema.parse(fixture);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].source).toBe('prompt-graph');
  });

  test('parses graph match report fixture', () => {
    const fixture = readFixture('graph-match-report.json');
    const result = GraphMatchReportSchema.parse(fixture);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].matchType).toBe('semantic');
  });

  test('parses suppressed graph nodes report fixture', () => {
    const fixture = readFixture('suppressed-graph-nodes-report.json');
    const result = SuppressedGraphNodesReportSchema.parse(fixture);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].suppressionReason).toBe('bucket-budget');
  });

  test('parses witness render manifest fixture', () => {
    const fixture = readFixture('witness-render-manifest.json');
    const result = WitnessRenderManifestSchema.parse(fixture);

    expect(result.mode).toBe('proxy-reprojection');
    expect(result.cameraId).toBe('cam_alley_alt_01');
  });

  test('parses alternate witness render manifest fixture', () => {
    const fixture = readFixture('witness-render-manifest-alt.json');
    const result = WitnessRenderManifestSchema.parse(fixture);

    expect(result.mode).toBe('projected-texture-preview');
    expect(result.cameraId).toBe('cam_alley_master');
  });

  test('rejects candidate missing rights fields', () => {
    const fixture = readFixture('utdg-candidates.json');
    delete fixture.candidates[0].sourceRights;

    expect(() => UtdgCandidatesFileSchema.parse(fixture)).toThrow();
  });

  test('rejects invalid semantic record type', () => {
    const fixture = readFixture('world-semantic-field.json');
    fixture.records[0].recordType = 'SemanticBlob';

    expect(() => WorldSemanticFieldSchema.parse(fixture)).toThrow();
  });

  test('camera query contract applies defaults', () => {
    const result = CameraQueryContractSchema.parse({
      cameraId: 'cam_01',
      resolution: {
        width: 1920,
        height: 1080
      }
    });

    expect(result.useOcclusion).toBe(true);
    expect(result.maxRecords).toBe(64);
    expect(result.maxPacketEntries).toBe(16);
  });

  test('canonical utdg record requires rights metadata', () => {
    const validRecord = {
      id: 'utdg:archetype:rain-darkened-brick-wall',
      entityType: 'Archetype',
      label: 'rain-darkened brick wall',
      summary: 'A brick wall archetype with darkened wet response and directional streaking.',
      externalIds: {
        institutionRecordId: 'museum:brick:001'
      },
      provenanceRefs: ['utdg:evidence:ev_brick_01'],
      evidenceRefs: ['utdg:evidence:ev_brick_01'],
      rightsProfile: 'reference-only',
      sourceRights: 'Institution Terms',
      contributionTerms: 'platform-community-commons',
      rightsConfidence: 'medium',
      commercialAllowed: false,
      reviewStatus: 'approved',
      createdFromSubmissionId: 'usub_demo_001'
    };

    expect(() => CanonicalUtdgRecordSchema.parse(validRecord)).not.toThrow();

    delete (validRecord as { sourceRights?: string }).sourceRights;
    expect(() => CanonicalUtdgRecordSchema.parse(validRecord)).toThrow();
  });
});

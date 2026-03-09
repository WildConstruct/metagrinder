import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  CameraQueryContractSchema,
  CameraPassManifestSchema,
  CanonicalUtdgRecordSchema,
  LumaAdapterContractSchema,
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
    expect(
      result.researchPackageManifest.collections.some(collection => collection.type === 'prompt-mutations')
    ).toBe(true);
    expect(result.promptMutationsPsg.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.augmentationPlanArtifact.verificationTargets.length).toBeGreaterThanOrEqual(0);
    expect(result.assumptionReviewArtifact.decisionOptions).toContain('adjust-priorities');
    expect(result.modeDetectionArtifact.researchKind).toBeDefined();
    expect(result.categoryHypothesisArtifact.recommendedFocus.length).toBeGreaterThan(0);
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

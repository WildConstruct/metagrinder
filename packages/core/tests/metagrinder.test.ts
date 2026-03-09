import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  CameraQueryContractSchema,
  CameraPassManifestSchema,
  CanonicalUtdgRecordSchema,
  LumaAdapterContractSchema,
  MetagrinderClassifyArtifactSchema,
    MetagrinderExtractArtifactSchema,
    MetagrinderIngestArtifactSchema,
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
      buildClassifyArtifact,
      buildConceptClustersPsg,
      buildExtractArtifact,
      buildIngestArtifact,
      buildMutationArtifact,
      buildMutationReviewArtifact,
      buildMultiInputIngestArtifact,
      buildPromptMutationsPsg,
      buildPromptSynthesisPsg,
      buildResearchPackageManifest,
    buildReviewArtifact,
    buildScoreArtifact,
    buildSourceMapPsg,
    buildSynthesizeArtifact,
    runMetagrinderMvp
  } = require('../scripts/lib/metagrinder-mvp.js');

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
    expect(mutationReviewArtifact.incompatibilityWarnings.length).toBeGreaterThanOrEqual(1);
    expect(
      mutationReviewArtifact.recommendedActions.some(action => action.includes('flagged mutation variants'))
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
    expect(researchPackageManifest.strategyVersion).toBe('epic2-story6');
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
    expect(fs.existsSync(path.join(outputDir, 'mutation-review.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'prompt-mutations.psg'))).toBe(true);
    expect(
      result.researchPackageManifest.collections.some(collection => collection.type === 'prompt-mutations')
    ).toBe(true);
    expect(result.promptMutationsPsg.nodes.length).toBeGreaterThanOrEqual(1);
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

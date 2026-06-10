import {
  CampaignSchema,
  ChoiceGraphSchema,
  ContentPlansSchema,
  ExtractionSchema,
  GapRegistrySchema,
  ImportReceiptSchema,
  ProvenanceSchema,
  ResearchPackageManifestSchema,
  RetrievalSchema,
  RevisionsSchema,
  RunManifestSchema,
  SceneGrammarSchema,
  SourceLifecycleSchema,
  SourcePackageSchema,
  UtdgCandidatesSchema
} from './index';

const NOW = '2026-06-10T12:00:00.000Z';
const envelope = (artifact: string) => ({
  artifact,
  runId: 'run_test_001',
  inputId: 'input_test',
  createdAt: NOW
});

const provenance = {
  sourceInputIds: ['src_a'],
  sourceChunkIds: ['chunk_1'],
  attributionMode: 'quoted' as const
};

describe('schema core', () => {
  test('[AC-1.1a] provenance defaults to unverified and low confidence', () => {
    const p = ProvenanceSchema.parse(provenance);
    expect(p.verification).toBe('unverified');
    expect(p.confidence).toBe('low');
    expect(p.evidenceBasis).toBe('inferred');
  });

  test('source-package round-trips and rejects bad spans', () => {
    const pkg = SourcePackageSchema.parse({
      ...envelope('source-package'),
      title: 'Test brief',
      sourceInputs: [{ sourceInputId: 'src_a', title: 'A', sequence: 0 }],
      chunks: [{
        chunkId: 'chunk_1',
        sourceInputId: 'src_a',
        text: 'Some text.',
        span: { start: 0, end: 10 },
        sequence: 0
      }]
    });
    expect(pkg.chunks[0]!.chunkKind).toBe('unknown');

    expect(() => SourcePackageSchema.parse({
      ...envelope('source-package'),
      title: 'Bad',
      sourceInputs: [{ sourceInputId: 'src_a', title: 'A', sequence: 0 }],
      chunks: []
    })).toThrow();
  });

  test('extraction accepts open category labels (no fixture enum)', () => {
    const extraction = ExtractionSchema.parse({
      ...envelope('extraction'),
      analysisMode: 'llm-semantic',
      claims: [{
        claimId: 'claim_1',
        text: 'Pit crews wore canvas coveralls.',
        category: 'motorsport-workwear',
        confidence: 'medium',
        provenance
      }]
    });
    expect(extraction.claims[0]!.category).toBe('motorsport-workwear');
  });

  test('scene-grammar requires explicit grammarTarget', () => {
    const base = {
      ...envelope('scene-grammar'),
      analysisMode: 'llm-semantic',
      sceneContext: {
        contextId: 'ctx_1',
        title: 'Test scene',
        researchKind: 'historical-scene-research',
        summary: 'A scene.',
        provenance
      }
    };
    expect(() => SceneGrammarSchema.parse(base)).toThrow();
    expect(SceneGrammarSchema.parse({ ...base, grammarTarget: 'base' }).grammarTarget).toBe('base');
  });

  test('weighted range rejects max < min via scene grammar archetype', () => {
    expect(() => SceneGrammarSchema.parse({
      ...envelope('scene-grammar'),
      analysisMode: 'llm-semantic',
      grammarTarget: 'base',
      sceneContext: {
        contextId: 'ctx_1', title: 'T', researchKind: 'unknown', summary: 's', provenance
      },
      archetypes: [{
        archetypeId: 'a1', label: 'A', summary: 's', role: 'spectator',
        promptText: 'p', confidence: 'low', provenance,
        weightRange: { label: 'w', min: 60, max: 50 }
      }]
    })).toThrow(/max must be >= min/);
  });

  test('source-lifecycle: registered source records approval and retraction', () => {
    const lifecycle = SourceLifecycleSchema.parse({
      ...envelope('source-lifecycle'),
      sources: [{
        sourceId: 'utdg_src_1',
        title: 'Sears Catalog 1909',
        sourceFamily: 'commercial_print',
        rightsProfile: 'public-domain',
        approvedBy: 'operator',
        approvedAt: NOW
      }]
    });
    expect(lifecycle.sources[0]!.retracted).toBe(false);
    expect(lifecycle.gates.rightsGate).toBe('pending');
  });

  test('revisions: decision states are closed enum, override defaults false', () => {
    const revisions = RevisionsSchema.parse({
      ...envelope('revisions'),
      revisions: [{
        revisionId: 'rev_1',
        targetRef: 'archetypes.a1.weightRange',
        revisionKind: 'material',
        proposedValue: { min: 40, max: 50 },
        rationale: 'New evidence.',
        sourceClaimIds: ['claim_1'],
        confidence: 'medium'
      }],
      decisions: [{
        revisionId: 'rev_1', state: 'accepted', decidedBy: 'operator', decidedAt: NOW
      }]
    });
    expect(revisions.decisions[0]!.citationOverride).toBe(false);
  });

  test('retrieval candidates default to unchecked hypothesis match', () => {
    const retrieval = RetrievalSchema.parse({
      ...envelope('retrieval'),
      policy: { mode: 'dry-run' },
      candidates: [{
        candidateId: 'cand_1',
        queryText: '1909 Indianapolis spectators',
        title: 'Bain News Service photo',
        sourceFamily: 'photography_collection',
        providerId: 'loc',
        retrievedAt: NOW
      }]
    });
    expect(retrieval.candidates[0]!.hypothesisMatch).toBe('unchecked');
    expect(retrieval.candidates[0]!.rightsProfileGuess).toBe('unknown');
  });

  test('gap-registry, campaign, and closure lineage shapes parse', () => {
    const gaps = GapRegistrySchema.parse({
      ...envelope('gap-registry'),
      cellId: 'cell_1909_indianapolis_speedway',
      gaps: [{
        gapId: 'gap_1',
        gapType: 'under-supported-distribution',
        severity: 'high',
        question: 'What share of spectators wore straw boaters?'
      }]
    });
    expect(gaps.gaps[0]!.status).toBe('open');

    const campaign = CampaignSchema.parse({
      ...envelope('research-campaign'),
      campaignId: 'camp_1',
      cellId: 'cell_1909_indianapolis_speedway',
      goal: 'Close wardrobe gaps for the roadshow cell',
      coverageTarget: 'all high-severity wardrobe gaps closed or exhausted',
      targetGapIds: ['gap_1'],
      hypotheses: [{
        hypothesisId: 'hyp_1',
        sourceFamily: 'newspaper',
        description: 'Indianapolis Star, May-June 1909, clothier advertising',
        rationale: 'Localizes the brand ladder to the city and season.',
        expectedEvidenceType: 'text_supported wardrobe claims',
        targetsGapIds: ['gap_1']
      }]
    });
    expect(campaign.hypotheses[0]!.status).toBe('hypothesized');
    expect(campaign.status).toBe('planned');
  });

  test('content plans: realization faithfulness gates default pending', () => {
    const plans = ContentPlansSchema.parse({
      ...envelope('content-plans'),
      grammarTarget: 'accepted',
      plans: [{
        planId: 'plan_1',
        seed: 42,
        grammarTarget: 'accepted',
        slots: [{ slotId: 's1', slotKind: 'subject', value: 'adult spectator' }]
      }],
      realized: [{
        promptId: 'prompt_1',
        planId: 'plan_1',
        realizationProfile: 'caption-prose-flux',
        text: 'An adult spectator stands at the rail.',
        faithfulness: {}
      }]
    });
    expect(plans.realized[0]!.faithfulness.slotCoverage).toBe('pending');
  });

  test('choice-graph axes require at least one choice', () => {
    expect(() => ChoiceGraphSchema.parse({
      ...envelope('semantic-choice-graph'),
      analysisMode: 'llm-semantic',
      grammarTarget: 'base',
      axes: [{ axisId: 'ax1', label: 'Age/Sex', sequence: 0, choices: [] }]
    })).toThrow();
  });

  test('utdg candidates: staged-only review status and id convention enforced', () => {
    const valid = {
      ...envelope('utdg-candidates'),
      candidates: [{
        id: 'utdg:archetype:grandstand_spectator_1909',
        entityType: 'Archetype',
        prefLabel: 'grandstand spectator, 1909',
        confidence: 'medium',
        reviewStatus: 'staged'
      }]
    };
    expect(UtdgCandidatesSchema.parse(valid).candidates[0]!.isEvidence).toBe(false);

    expect(() => UtdgCandidatesSchema.parse({
      ...valid,
      candidates: [{ ...valid.candidates[0], reviewStatus: 'approved' }]
    })).toThrow(/staged/);

    expect(() => UtdgCandidatesSchema.parse({
      ...valid,
      candidates: [{ ...valid.candidates[0], id: 'not-a-utdg-id' }]
    })).toThrow();
  });

  test('run manifest stage and model records parse', () => {
    const manifest = RunManifestSchema.parse({
      artifact: 'run-manifest',
      runId: 'run_test_001',
      inputId: 'input_test',
      createdAt: NOW,
      updatedAt: NOW,
      parserVersion: '0.1.0',
      stages: [{ stage: 'extract', state: 'blocked_on_gate', gate: 'source-intake-approval' }],
      models: [{ stage: 'extract', providerId: 'codex-cli', modelId: 'gpt-5.2' }]
    });
    expect(manifest.stages[0]!.state).toBe('blocked_on_gate');
  });

  test('package manifest only accepts collapsed families', () => {
    expect(() => ResearchPackageManifestSchema.parse({
      artifact: 'research-package',
      packageId: 'pkg_1',
      runId: 'run_test_001',
      inputId: 'input_test',
      title: 'T',
      createdAt: NOW,
      parserVersion: '0.1.0',
      collections: [{ id: 'c1', family: 'provider-preflight-report', path: 'x.json' }]
    })).toThrow();
  });

  test('import receipt parses', () => {
    const receipt = ImportReceiptSchema.parse({
      artifact: 'import-receipt',
      receiptId: 'rcpt_1',
      packageId: 'pkg_1',
      contentSha256: 'abc123',
      consumer: 'eracrowd',
      status: 'imported',
      receivedAt: NOW
    });
    expect(receipt.status).toBe('imported');
  });
});

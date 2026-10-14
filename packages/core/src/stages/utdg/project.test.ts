import {
  SourceLifecycleSchema,
  SourcePackageSchema,
  type Extraction,
  type SourceLifecycle,
  type SourcePackage
} from '../../schemas';
import { historicalCrowdGrammar } from '../../compile/__fixtures__/historical-crowd-grammar';
import { toUtdgId, slugifyLocalId } from './ids';
import { defaultResearchParseRights, resolveRights } from './rights';
import { projectUtdgCandidates } from './project';

const NOW = '2026-07-14T12:00:00.000Z';
const SRC = 'research-input-historical-crowd-grammar';

function sourcePackageForCrowd(): SourcePackage {
  const text = 'Historical crowd scene notes for early twentieth-century public spectacle.';
  return SourcePackageSchema.parse({
    artifact: 'source-package',
    runId: 'run_historical_crowd',
    inputId: SRC,
    createdAt: NOW,
    title: 'Early twentieth-century public spectacle crowd scene grammar notes',
    researchKind: 'historical-scene-research',
    sourceInputs: [{
      sourceInputId: SRC,
      title: 'Historical crowd grammar notes',
      sourceType: 'research-brief',
      path: 'fixtures/historical-crowd.txt',
      sequence: 0
    }],
    chunks: Array.from({ length: 8 }, (_, i) => {
      const chunkId = `${SRC}_chunk_${String(i + 1).padStart(3, '0')}`;
      return {
        chunkId,
        sourceInputId: SRC,
        text,
        span: { start: 0, end: text.length },
        sequence: i,
        chunkKind: 'source-note' as const
      };
    })
  });
}

function sampleExtraction(source: SourcePackage): Extraction {
  const chunk0 = source.chunks[0]!.chunkId;
  const prov = {
    sourceInputIds: [SRC],
    sourceChunkIds: [chunk0],
    spans: [],
    attributionMode: 'paraphrased' as const,
    evidenceBasis: 'text_supported' as const,
    confidence: 'medium' as const,
    verification: 'unverified' as const
  };
  return {
    artifact: 'extraction',
    schemaVersion: '0.1.0',
    runId: 'run_historical_crowd',
    inputId: SRC,
    createdAt: NOW,
    analysisMode: 'human-authored',
    claims: [],
    concepts: [{
      conceptId: 'straw_boater',
      label: 'straw boater hat',
      category: 'wardrobe_headwear',
      summary: 'Period straw boater common in grandstand rows',
      confidence: 'medium',
      provenance: prov
    }],
    evidence: [{
      evidenceId: 'ev_boater_rows',
      text: 'Dense rows of male spectators in straw boaters and dark suits.',
      provenance: prov
    }],
    uncertaintySpans: [],
    openQuestions: [{
      questionId: 'q1',
      text: 'What share of the crowd wore boaters vs soft caps?'
    }],
    warnings: [],
    categories: []
  };
}

function currentLifecycle(source: SourcePackage): SourceLifecycle {
  return SourceLifecycleSchema.parse({
    artifact: 'source-lifecycle',
    runId: source.runId,
    inputId: source.inputId,
    createdAt: NOW,
    sources: source.sourceInputs.map((input) => ({
      sourceId: toUtdgId('source', input.sourceInputId),
      title: input.title,
      rightsProfile: 'unrestricted',
      rightsStatement: 'CC0',
      approvedBy: 'reviewer',
      approvedAt: NOW
    })),
    evidence: source.chunks.map((chunk) => ({
      evidenceId: chunk.chunkId,
      sourceId: toUtdgId('source', chunk.sourceInputId),
      excerptText: chunk.text,
      confidence: 'medium',
      provenance: {
        sourceInputIds: [chunk.sourceInputId], sourceChunkIds: [chunk.chunkId],
        attributionMode: 'quoted', evidenceBasis: 'text_supported',
        confidence: 'medium', verification: 'verified'
      }
    })),
    gates: { rightsGate: 'pass' }
  });
}

describe('utdg ids', () => {
  test('mints stable utdg:* ids and slugifies local ids', () => {
    expect(toUtdgId('archetype', 'Middle Class Spectator')).toBe('utdg:archetype:middle-class-spectator');
    expect(toUtdgId('rule', 'avoid_modern_artifacts')).toBe('utdg:rule:avoid_modern_artifacts');
    expect(slugifyLocalId('  Foo//Bar  ')).toBe('foo-bar');
  });
});

describe('utdg rights ladder', () => {
  test('unknown research parse is restrictive and non-commercial', () => {
    const r = defaultResearchParseRights();
    expect(r.rightsProfile).toBe('unknown');
    expect(r.commercialAllowed).toBe(false);
    expect(r.reviewStatus).toBe('needs_review');
    expect(r.sourceRights).toBe('Unknown');
  });

  test('CC0 and attribution may be commercial; fixtures stay reference-only', () => {
    expect(resolveRights({ sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }).commercialAllowed).toBe(true);
    expect(resolveRights({ sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }).rightsProfile).toBe('unrestricted');
    expect(resolveRights({ sourceRights: 'CC BY 4.0', contributionTerms: 'platform-attribution' }).rightsProfile).toBe('attribution-required');
    expect(resolveRights({ sourceRights: 'Local test fixture' }).rightsProfile).toBe('reference-only');
    expect(resolveRights({ sourceRights: 'Local test fixture' }).commercialAllowed).toBe(false);
  });

  test.each(['CC0', 'CC BY 4.0', 'Public domain'])(
    'source license %s never widens private contributor permission',
    (sourceRights) => {
      for (const ctx of [{ sourceRights }, { sourceRights, contributionTerms: 'private-only' as const }]) {
        const resolved = resolveRights(ctx);
        expect(resolved.sourceRights).toBe(sourceRights);
        expect(resolved.contributionTerms).toBe('private-only');
        expect(resolved.commercialAllowed).toBe(false);
        expect(resolved.reviewStatus).toBe('needs_review');
      }
    }
  );
});

describe('projectUtdgCandidates (Slice A)', () => {
  test('projects historical-crowd grammar into staged candidates with valid ids', () => {
    const source = sourcePackageForCrowd();
    const grammar = historicalCrowdGrammar(NOW);
    const out = projectUtdgCandidates({
      sourcePackage: source,
      grammar,
      now: NOW,
      rights: { sourceRights: 'Local research fixture' }
    });

    expect(out.artifact).toBe('utdg-candidates');
    expect(out.candidates.length).toBeGreaterThan(0);

    const byType = (t: string) => out.candidates.filter((c) => c.entityType === t);
    expect(byType('SourceRecordReference').length).toBe(1);
    expect(byType('Archetype').length).toBe(grammar.archetypes.length);
    expect(byType('Concept').filter((c) => c.conceptType === 'location_zone').length).toBe(grammar.locationZones.length);
    expect(byType('CompatibilityRule').length).toBe(
      grammar.compatibilityRules.length + grammar.negativeConstraints.length
    );
    expect(byType('ImageReference').length).toBe(grammar.visualReferences.length);

    for (const c of out.candidates) {
      expect(c.id).toMatch(/^utdg:[a-z-]+:/);
      expect(['draft', 'staged', 'needs_review']).toContain(c.reviewStatus);
      expect(c.commercialAllowed).toBe(false);
      expect(c.rightsProfile).toBe('reference-only');
    }

    const middle = out.candidates.find((c) => c.id === 'utdg:archetype:middle_class_spectator');
    expect(middle?.prefLabel).toBe('Middle-class spectator');
    expect(middle?.usageContexts.some((u) => u.startsWith('role:'))).toBe(true);

    const modern = out.candidates.find((c) => c.id === 'utdg:rule:avoid_modern_artifacts');
    expect(modern?.summary).toContain('ruleType=incompatibleWith');
    expect(modern?.summary).toContain('constraintType=modern-artifact-risk');
  });

  test('includes extraction concepts/evidence and never exports open questions', () => {
    const source = sourcePackageForCrowd();
    const grammar = historicalCrowdGrammar(NOW);
    const extraction = sampleExtraction(source);
    const out = projectUtdgCandidates({
      sourcePackage: source,
      grammar,
      extraction,
      now: NOW,
      cellId: 'cell_test_crowd',
      rights: { sourceRights: 'Unknown' }
    });

    expect(out.cellId).toBe('cell_test_crowd');
    expect(out.candidates.some((c) => c.id === 'utdg:concept:straw_boater')).toBe(true);
    expect(out.candidates.some((c) => c.id === 'utdg:evidence:ev_boater_rows' && c.isEvidence)).toBe(true);
    expect(out.candidates.some((c) => c.prefLabel.includes('What share of the crowd'))).toBe(false);

    // Unknown package rights → never commercial; non-image rows need review.
    // ImageReference rows stay reference-only/staged from their own rightsProfile.
    expect(out.candidates.every((c) => c.commercialAllowed === false)).toBe(true);
    const nonImage = out.candidates.filter((c) => c.entityType !== 'ImageReference');
    expect(nonImage.length).toBeGreaterThan(0);
    expect(nonImage.every((c) => c.reviewStatus === 'needs_review')).toBe(true);
  });

  test('never emits approved/merged/canonical review statuses', () => {
    const out = projectUtdgCandidates({
      sourcePackage: sourcePackageForCrowd(),
      grammar: historicalCrowdGrammar(NOW),
      now: NOW,
      rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }
    });
    // Export never promotes to approved — staged is the ceiling here.
    expect(out.candidates.every((c) => c.reviewStatus === 'staged' || c.reviewStatus === 'needs_review')).toBe(true);
    expect(out.candidates.every((c) => c.reviewStatus !== 'approved')).toBe(true);

    // An aggregate license alone cannot validate current export permissions.
    const textish = out.candidates.filter((c) => c.entityType !== 'ImageReference');
    expect(textish.every((c) => c.commercialAllowed === false)).toBe(true);
    expect(out.candidates.every((c) => c.exportEligibility?.status === 'unverified')).toBe(true);
    const images = out.candidates.filter((c) => c.entityType === 'ImageReference');
    expect(images.every((c) => c.commercialAllowed === false)).toBe(true);
    expect(images.every((c) => c.rightsProfile === 'reference-only')).toBe(true);
  });

  test('current lifecycle enables only permission-checked staged export and retraction blocks it on rerun', () => {
    const source = sourcePackageForCrowd();
    const lifecycle = currentLifecycle(source);
    const args = {
      sourcePackage: source,
      grammar: historicalCrowdGrammar(NOW),
      sourceLifecycle: lifecycle,
      now: NOW,
      rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' as const }
    };
    const before = projectUtdgCandidates(args);
    const subjectId = 'utdg:archetype:middle_class_spectator';
    const subject = before.candidates.find((c) => c.id === subjectId)!;
    expect(subject.commercialAllowed).toBe(true);
    expect(subject.exportEligibility).toEqual({
      status: 'eligible', checkedAt: NOW,
      sourceIds: [lifecycle.sources[0]!.sourceId], reasons: []
    });
    expect(subject.reviewStatus).toBe('staged');

    lifecycle.sources[0]!.retracted = true;
    lifecycle.sources[0]!.retractionReason = 'Source attribution withdrawn';
    const after = projectUtdgCandidates(args).candidates.find((c) => c.id === subjectId)!;
    expect(after.commercialAllowed).toBe(false);
    expect(after.reviewStatus).toBe('needs_review');
    expect(after.exportEligibility?.status).toBe('blocked');
    expect(after.exportEligibility?.reasons).toContain(`source-retracted:${lifecycle.sources[0]!.sourceId}`);
    expect(after.prefLabel).toBe(subject.prefLabel);
  });

  test('intersects every contributing source without restricting unrelated records', () => {
    const source = sourcePackageForCrowd();
    const second = 'restricted-input';
    const secondChunk = `${second}-chunk`;
    source.sourceInputs.push({ sourceInputId: second, title: 'Restricted notes', sourceType: 'plain-text', sequence: 1 });
    source.chunks.push({
      chunkId: secondChunk, sourceInputId: second, text: 'Restricted source material.',
      span: { start: 0, end: 27 }, sequence: 8, chunkKind: 'source-note', tags: []
    });
    const grammar = historicalCrowdGrammar(NOW);
    grammar.archetypes[0]!.provenance.sourceInputIds.push(second);
    grammar.archetypes[0]!.provenance.sourceChunkIds.push(secondChunk);
    const lifecycle = currentLifecycle(source);
    lifecycle.sources[1]!.rightsProfile = 'restricted';
    lifecycle.sources[1]!.rightsStatement = 'Private collection, no redistribution';

    const out = projectUtdgCandidates({
      sourcePackage: source, grammar, sourceLifecycle: lifecycle, now: NOW,
      rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }
    });
    const mixed = out.candidates.find((c) => c.id === toUtdgId('archetype', grammar.archetypes[0]!.archetypeId))!;
    const unrelated = out.candidates.find((c) => c.id === toUtdgId('archetype', grammar.archetypes[1]!.archetypeId))!;
    expect(mixed.rightsProfile).toBe('restricted');
    expect(mixed.commercialAllowed).toBe(false);
    expect(mixed.exportEligibility?.status).toBe('blocked');
    expect(mixed.exportEligibility?.sourceIds).toHaveLength(2);
    expect(unrelated.exportEligibility?.status).toBe('eligible');
    expect(unrelated.commercialAllowed).toBe(true);
  });

  test('missing current source mapping is visibly unverified and cannot claim commercial permission', () => {
    const source = sourcePackageForCrowd();
    const lifecycle = currentLifecycle(source);
    lifecycle.sources[0]!.sourceId = 'registered-external-source';
    lifecycle.evidence = [];
    const args = {
      sourcePackage: source, grammar: historicalCrowdGrammar(NOW), sourceLifecycle: lifecycle, now: NOW,
      extraction: sampleExtraction(source),
      rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' as const }
    };
    const unlinked = projectUtdgCandidates(args).candidates.find((c) => c.entityType === 'Archetype')!;
    expect(unlinked.exportEligibility?.status).toBe('unverified');
    expect(unlinked.commercialAllowed).toBe(false);
    expect(unlinked.reviewStatus).toBe('needs_review');
    expect(unlinked.exportEligibility?.reasons).toContain(`source-lifecycle-unmapped:${SRC}`);

    const linked = projectUtdgCandidates({
      ...args, sourceIdsByInputId: { [SRC]: ['registered-external-source'] }
    }).candidates.find((c) => c.entityType === 'Archetype')!;
    expect(linked.exportEligibility?.status).toBe('eligible');
    expect(linked.commercialAllowed).toBe(true);
  });

  test('current source restrictions and contributor permission are independent intersections', () => {
    const source = sourcePackageForCrowd();
    const lifecycle = currentLifecycle(source);
    lifecycle.sources[0]!.rightsProfile = 'non-commercial';
    const args = {
      sourcePackage: source, grammar: historicalCrowdGrammar(NOW), sourceLifecycle: lifecycle, now: NOW
    };
    const nc = projectUtdgCandidates({
      ...args, rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }
    }).candidates.find((c) => c.entityType === 'Archetype')!;
    expect(nc.rightsProfile).toBe('non-commercial');
    expect(nc.commercialAllowed).toBe(false);

    lifecycle.sources[0]!.rightsProfile = 'unrestricted';
    const privateContribution = projectUtdgCandidates({
      ...args, rights: { sourceRights: 'CC0', contributionTerms: 'private-only' }
    }).candidates.find((c) => c.entityType === 'Archetype')!;
    expect(privateContribution.contributionTerms).toBe('private-only');
    expect(privateContribution.commercialAllowed).toBe(false);
    expect(privateContribution.exportEligibility?.status).toBe('blocked');
    expect(privateContribution.exportEligibility?.reasons).toContain('contribution-private-only');
  });

  test('an explicit input mapping cannot hide a restricted source already linked by lifecycle evidence', () => {
    const source = sourcePackageForCrowd();
    const lifecycle = currentLifecycle(source);
    const permittedId = lifecycle.sources[0]!.sourceId;
    lifecycle.sources.push({
      ...lifecycle.sources[0]!, sourceId: 'restricted-evidence-source',
      rightsProfile: 'restricted', rightsStatement: 'No redistribution'
    });
    lifecycle.evidence.push({
      evidenceId: 'restricted-evidence', sourceId: 'restricted-evidence-source',
      excerptText: 'Source support with restricted permissions.', confidence: 'medium',
      provenance: sampleExtraction(source).evidence[0]!.provenance
    });
    const candidate = projectUtdgCandidates({
      sourcePackage: source, grammar: historicalCrowdGrammar(NOW), sourceLifecycle: lifecycle,
      sourceIdsByInputId: { [SRC]: [permittedId] }, now: NOW,
      rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }
    }).candidates.find((c) => c.entityType === 'Archetype')!;
    expect(candidate.exportEligibility?.sourceIds).toContain('restricted-evidence-source');
    expect(candidate.exportEligibility?.status).toBe('blocked');
    expect(candidate.commercialAllowed).toBe(false);
  });

  test.each(['evidence', 'concept'] as const)(
    'an unresolved %s dependency cannot grant permission even with known source and chunk mappings',
    (dependencyKind) => {
      const source = sourcePackageForCrowd();
      const lifecycle = currentLifecycle(source);
      const grammar = historicalCrowdGrammar(NOW);
      let missingRef: string;
      if (dependencyKind === 'evidence') {
        const chunkId = grammar.archetypes[0]!.provenance.sourceChunkIds[0]!;
        lifecycle.evidence = lifecycle.evidence.filter((evidence) => evidence.evidenceId !== chunkId);
        missingRef = toUtdgId('evidence', chunkId);
      } else {
        grammar.archetypes[0]!.wardrobeRefs.push('external-support');
        missingRef = toUtdgId('concept', 'external-support');
      }
      const candidate = projectUtdgCandidates({
        sourcePackage: source, grammar, sourceLifecycle: lifecycle, now: NOW,
        rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }
      }).candidates.find((c) => c.id === toUtdgId('archetype', grammar.archetypes[0]!.archetypeId))!;
      expect(candidate.exportEligibility?.reasons).toContain(`dependency-reference-unmapped:${missingRef}`);
      expect(candidate.exportEligibility?.status).toBe('unverified');
      expect(candidate.commercialAllowed).toBe(false);
      expect(candidate.reviewStatus).toBe('needs_review');
    }
  );

  test('missing input and chunk mappings remain visible alongside unresolved dependencies', () => {
    const source = sourcePackageForCrowd();
    const grammar = historicalCrowdGrammar(NOW);
    grammar.archetypes[0]!.provenance.sourceInputIds.push('missing-input');
    grammar.archetypes[0]!.provenance.sourceChunkIds.push('missing-chunk');
    const candidate = projectUtdgCandidates({
      sourcePackage: source, grammar, sourceLifecycle: currentLifecycle(source), now: NOW,
      rights: { sourceRights: 'CC0', contributionTerms: 'platform-community-commons' }
    }).candidates.find((c) => c.entityType === 'Archetype')!;
    expect(candidate.exportEligibility?.status).toBe('unverified');
    expect(candidate.exportEligibility?.reasons).toContain('source-input-not-found:missing-input');
    expect(candidate.exportEligibility?.reasons).toContain('source-chunk-not-found:missing-chunk');
    expect(candidate.commercialAllowed).toBe(false);
  });
});

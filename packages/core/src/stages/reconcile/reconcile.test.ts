import type { UtdgCandidate } from '../../schemas';
import {
  applyReconcile,
  normalizeReconcileLabel,
  proposeReconcile,
  reconcileIntoCell,
  tokenJaccard
} from './index';

const NOW = '2026-07-14T21:00:00.000Z';

function cand(partial: Partial<UtdgCandidate> & Pick<UtdgCandidate, 'id' | 'entityType' | 'prefLabel'>): UtdgCandidate {
  return {
    altLabels: [],
    sourceConceptRefs: [],
    evidenceRefs: [],
    sourceRefs: [],
    texturalQualities: [],
    usageContexts: [],
    isEvidence: false,
    confidence: 'medium',
    rightsProfile: 'reference-only',
    sourceRights: 'Local test fixture',
    contributionTerms: 'private-only',
    rightsConfidence: 'low',
    commercialAllowed: false,
    reviewStatus: 'staged',
    ...partial
  };
}

describe('reconcile helpers', () => {
  test('normalize and token jaccard', () => {
    expect(normalizeReconcileLabel('1909 Indianapolis Race Official')).toBe(
      '1909 indianapolis race official'
    );
    expect(tokenJaccard('straw boater hat', 'straw boater hat')).toBe(1);
    expect(tokenJaccard('straw boater hat', 'modern sneakers')).toBeLessThan(0.2);
    expect(tokenJaccard('1909 race official', '1909 Indianapolis race official')).toBeGreaterThan(0.45);
  });

  test('normalization preserves Unicode letters and combining marks', () => {
    expect(normalizeReconcileLabel('CAFÉ — 帽子')).toBe('café 帽子');
    expect(normalizeReconcileLabel('Cafe\u0301')).toBe('café');
    expect(normalizeReconcileLabel('देवनागरी')).toBe('देवनागरी');
    expect(normalizeReconcileLabel('帽子')).not.toBe(normalizeReconcileLabel('靴'));
    expect(tokenJaccard('帽子', '靴')).toBe(0);
  });
});

describe('proposeReconcile', () => {
  test('identical id and content auto-accept, but normalized labels require human confirmation', () => {
    const existing = [
      cand({ id: 'utdg:archetype:race-official', entityType: 'Archetype', prefLabel: '1909 Indianapolis race official' }),
      cand({ id: 'utdg:concept:straw-boater', entityType: 'Concept', prefLabel: 'straw boater hat' })
    ];
    const incoming = [
      cand({ id: 'utdg:archetype:race-official', entityType: 'Archetype', prefLabel: '1909 Indianapolis race official' }),
      cand({ id: 'utdg:concept:straw_boater_v2', entityType: 'Concept', prefLabel: 'Straw Boater Hat' })
    ];
    const props = proposeReconcile({ existing, incoming });
    expect(props).toHaveLength(2);
    expect(props.every((p) => p.relation === 'same-as')).toBe(true);
    expect(props.map((p) => p.status)).toEqual(['auto-accepted', 'proposed']);
    expect(props.map((p) => p.method).sort()).toEqual(['exact-id', 'normalized-label'].sort());
  });

  test('partial overlap → variantOf proposed (not auto)', () => {
    const existing = [
      cand({ id: 'utdg:archetype:race-official', entityType: 'Archetype', prefLabel: '1909 Indianapolis race official' })
    ];
    const incoming = [
      cand({
        id: 'utdg:archetype:race-official-dust-coat',
        entityType: 'Archetype',
        prefLabel: '1909 Indianapolis race official dust coat variant'
      })
    ];
    expect(tokenJaccard(
      '1909 Indianapolis race official',
      '1909 Indianapolis race official dust coat variant'
    )).toBeGreaterThanOrEqual(0.45);
    expect(tokenJaccard(
      '1909 Indianapolis race official',
      '1909 Indianapolis race official dust coat variant'
    )).toBeLessThan(0.85);
    const props = proposeReconcile({ existing, incoming });
    expect(props).toHaveLength(1);
    expect(props[0]!.relation).toBe('variantOf');
    expect(props[0]!.status).toBe('proposed');
    expect(props[0]!.method).toBe('token-similarity');
  });

  test('unrelated → distinct', () => {
    const existing = [
      cand({ id: 'utdg:concept:straw-boater', entityType: 'Concept', prefLabel: 'straw boater hat' })
    ];
    const incoming = [
      cand({ id: 'utdg:concept:modern-logo', entityType: 'Concept', prefLabel: 'modern logo' })
    ];
    const props = proposeReconcile({ existing, incoming });
    expect(props[0]!.relation).toBe('distinct');
  });

  test('external id match proposes same-as for human confirmation', () => {
    const existing = [
      cand({
        id: 'utdg:concept:linen-a',
        entityType: 'Concept',
        prefLabel: 'linen fabric',
        externalIds: { gettyAatId: 'aat_123' }
      })
    ];
    const incoming = [
      cand({
        id: 'utdg:concept:linen-b',
        entityType: 'Concept',
        prefLabel: 'flax linen cloth',
        externalIds: { gettyAatId: 'aat_123' }
      })
    ];
    const props = proposeReconcile({ existing, incoming });
    expect(props[0]!.relation).toBe('same-as');
    expect(props[0]!.method).toBe('external-id');
    expect(props[0]!.status).toBe('proposed');
  });

  test('an existing id with changed content requires a human decision', () => {
    const existing = [cand({
      id: 'utdg:archetype:vendor', entityType: 'Archetype', prefLabel: 'market vendor',
      definition: '1909 Indianapolis produce seller'
    })];
    const incoming = [{ ...existing[0]!, definition: '1960s London clothing seller' }];
    const proposals = proposeReconcile({ existing, incoming });
    expect(proposals[0]!.method).toBe('exact-id');
    expect(proposals[0]!.status).toBe('proposed');
    const out = applyReconcile({ existing, incoming, proposals });
    expect(out.pendingProposals).toHaveLength(1);
    expect(out.mergedInto).toHaveLength(0);
    expect(out.cellCandidates[0]!.definition).toBe(existing[0]!.definition);
  });

  test('proposal ids bind candidate content and remain stable across list and object-key order', () => {
    const linen = cand({ id: 'utdg:concept:linen', entityType: 'Concept', prefLabel: 'linen fabric' });
    const wool = cand({ id: 'utdg:concept:wool', entityType: 'Concept', prefLabel: 'wool fabric' });
    const incoming = [
      { ...linen, id: 'utdg:concept:linen-new', prefLabel: 'Linen Fabric' },
      { ...wool, id: 'utdg:concept:wool-new', prefLabel: 'Wool Fabric' }
    ];
    const original = proposeReconcile({ existing: [linen, wool], incoming });
    const reorderKeys = (value: UtdgCandidate): UtdgCandidate => Object.fromEntries(
      Object.entries(value).reverse()
    ) as UtdgCandidate;
    const reordered = proposeReconcile({
      existing: [reorderKeys(wool), reorderKeys(linen)],
      incoming: [...incoming].reverse().map(reorderKeys)
    });
    const ids = (proposals: ReturnType<typeof proposeReconcile>) => Object.fromEntries(
      proposals.map((p) => [p.rightId, p.proposalId])
    );
    expect(ids(reordered)).toEqual(ids(original));
    const changed = proposeReconcile({
      existing: [linen, wool],
      incoming: [{ ...incoming[0]!, definition: 'a revised meaning' }, incoming[1]!]
    });
    expect(changed[0]!.proposalId).not.toBe(original[0]!.proposalId);
    expect(changed[1]!.proposalId).toBe(original[1]!.proposalId);
  });
});

describe('applyReconcile / AC-5.3a', () => {
  test('[S-R1b] merging new lineage invalidates previous permission eligibility', () => {
    const existing = [cand({
      id: 'utdg:concept:linen', entityType: 'Concept', prefLabel: 'linen fabric',
      commercialAllowed: true,
      exportEligibility: { status: 'eligible', checkedAt: NOW, sourceIds: ['old-source'], reasons: [] }
    })];
    const incoming = [cand({
      id: 'utdg:concept:linen-new', entityType: 'Concept', prefLabel: 'Linen Fabric',
      sourceRefs: ['new-source'], commercialAllowed: true
    })];
    const proposals = proposeReconcile({ existing, incoming });
    const out = applyReconcile({ existing, incoming, proposals, decisions: [{
      proposalId: proposals[0]!.proposalId, decision: 'accepted', decidedBy: 'operator', decidedAt: NOW
    }] });
    expect(out.cellCandidates[0]!.commercialAllowed).toBe(false);
    expect(out.cellCandidates[0]!.exportEligibility?.status).not.toBe('eligible');
    expect(out.cellCandidates[0]!.reviewStatus).toBe('needs_review');
  });

  test('[AC-5.3a] re-running identical overlapping candidates does not double cell records', () => {
    const candidates = [
      cand({ id: 'utdg:archetype:official', entityType: 'Archetype', prefLabel: 'race official' }),
      cand({ id: 'utdg:concept:linen', entityType: 'Concept', prefLabel: 'linen fabric' })
    ];
    const replay = JSON.parse(JSON.stringify(candidates)) as UtdgCandidate[];

    const first = applyReconcile({
      existing: [],
      incoming: candidates
    });
    expect(first.cellCandidates.length).toBe(candidates.length);
    expect(first.addedIds.length).toBe(candidates.length);

    const second = applyReconcile({
      existing: first.cellCandidates,
      incoming: replay
    });

    // Identical stable identities and content produce no growth.
    expect(second.cellCandidates.length).toBe(first.cellCandidates.length);
    expect(second.addedIds).toHaveLength(0);
    expect(second.mergedInto.length).toBeGreaterThan(0);
    // Every incoming id either merged or already present
    const cellIds = new Set(second.cellCandidates.map((c) => c.id));
    for (const c of replay) {
      const merged = second.mergedInto.some((m) => m.absorbedId === c.id);
      expect(merged || cellIds.has(c.id)).toBe(true);
    }
  });

  test('human-confirmed same-as merge unions evidence and source refs', () => {
    const existing = [
      cand({
        id: 'utdg:concept:boater',
        entityType: 'Concept',
        prefLabel: 'straw boater hat',
        evidenceRefs: ['utdg:evidence:a'],
        sourceRefs: ['utdg:source:one']
      })
    ];
    const incoming = [
      cand({
        id: 'utdg:concept:boater-2',
        entityType: 'Concept',
        prefLabel: 'straw boater hat',
        evidenceRefs: ['utdg:evidence:b'],
        sourceRefs: ['utdg:source:two']
      })
    ];
    const proposals = proposeReconcile({ existing, incoming });
    const out = applyReconcile({
      existing,
      incoming,
      proposals,
      decisions: [{ proposalId: proposals[0]!.proposalId, decision: 'accepted', decidedBy: 'operator', decidedAt: NOW }]
    });
    expect(out.cellCandidates).toHaveLength(1);
    const kept = out.cellCandidates[0]!;
    expect(kept.id).toBe('utdg:concept:boater');
    expect(kept.evidenceRefs.sort()).toEqual(['utdg:evidence:a', 'utdg:evidence:b']);
    expect(kept.sourceRefs.sort()).toEqual(['utdg:source:one', 'utdg:source:two']);
  });

  test('matching labels with different contexts stay pending and do not combine provenance', () => {
    const existing = [cand({
      id: 'utdg:archetype:vendor-indy', entityType: 'Archetype', prefLabel: 'market vendor',
      definition: '1909 Indianapolis produce seller', sourceRefs: ['utdg:source:indy']
    })];
    const incoming = [cand({
      id: 'utdg:archetype:vendor-london', entityType: 'Archetype', prefLabel: 'market vendor',
      definition: '1960s London clothing seller', sourceRefs: ['utdg:source:london']
    })];
    const out = applyReconcile({ existing, incoming });
    expect(out.pendingProposals).toHaveLength(1);
    expect(out.mergedInto).toHaveLength(0);
    expect(out.cellCandidates).toEqual(existing);
  });

  test('caller-supplied proposal statuses cannot bypass identity proof or human decisions', () => {
    const existing = [cand({ id: 'utdg:concept:one', entityType: 'Concept', prefLabel: 'linen' })];
    const incoming = [cand({ id: 'utdg:concept:two', entityType: 'Concept', prefLabel: 'Linen' })];
    const proposed = proposeReconcile({ existing, incoming });
    for (const status of ['auto-accepted', 'accepted'] as const) {
      const out = applyReconcile({ existing, incoming, proposals: proposed.map((p) => ({ ...p, status })) });
      expect(out.pendingProposals).toHaveLength(1);
      expect(out.mergedInto).toHaveLength(0);
      expect(out.cellCandidates).toEqual(existing);
    }
  });

  test('a prior label-match decision cannot approve changed candidate meaning', () => {
    const existing = [cand({
      id: 'utdg:archetype:vendor-indy', entityType: 'Archetype', prefLabel: 'market vendor',
      definition: '1909 Indianapolis produce seller', sourceRefs: ['utdg:source:indy']
    })];
    const incoming = [cand({
      id: 'utdg:archetype:vendor-new', entityType: 'Archetype', prefLabel: 'market vendor',
      definition: '1909 Indianapolis produce seller', sourceRefs: ['utdg:source:second-indy']
    })];
    const reviewedProposals = proposeReconcile({ existing, incoming });
    const decisions = [{
      proposalId: reviewedProposals[0]!.proposalId, decision: 'accepted' as const,
      decidedBy: 'operator', decidedAt: NOW
    }];
    expect(applyReconcile({ existing, incoming, proposals: reviewedProposals, decisions }).mergedInto)
      .toHaveLength(1);

    const changedIncoming = [{
      ...incoming[0]!, definition: '1960s London clothing seller', sourceRefs: ['utdg:source:london']
    }];
    const changedExisting = [{ ...existing[0]!, definition: 'a different canonical archetype' }];
    const cases = [
      { existing, incoming: changedIncoming, decisions },
      { existing, incoming: changedIncoming, proposals: reviewedProposals, decisions },
      { existing: changedExisting, incoming, proposals: reviewedProposals, decisions },
      { existing, incoming, proposals: reviewedProposals.map((p) => ({ ...p, relation: 'variantOf' as const })), decisions }
    ];
    for (const args of cases) {
      const out = applyReconcile(args);
      expect(out.mergedInto).toHaveLength(0);
      expect(out.addedIds).toHaveLength(0);
      expect(out.pendingProposals).toHaveLength(1);
      expect(out.cellCandidates).toEqual(args.existing);
    }
  });

  test('a human rejection takes precedence over automatic idempotency', () => {
    const existing = [cand({ id: 'utdg:concept:one', entityType: 'Concept', prefLabel: 'linen' })];
    const incoming = [{ ...existing[0]! }];
    const proposals = proposeReconcile({ existing, incoming });
    const out = applyReconcile({
      existing, incoming, proposals,
      decisions: [{ proposalId: proposals[0]!.proposalId, decision: 'rejected', decidedBy: 'operator', decidedAt: NOW }]
    });
    expect(out.rejectedProposals).toHaveLength(1);
    expect(out.mergedInto).toHaveLength(0);
  });

  test('fuzzy same-as stays pending and does not add a double', () => {
    // Force token-similarity same-as via near-identical multi-token labels
    const existing = [
      cand({
        id: 'utdg:archetype:official-a',
        entityType: 'Archetype',
        prefLabel: 'early motorsport track race official worker'
      })
    ];
    const incoming = [
      cand({
        id: 'utdg:archetype:official-b',
        entityType: 'Archetype',
        // high overlap but not exact normalized equality
        prefLabel: 'early motorsport track race official attendant'
      })
    ];
    const proposals = proposeReconcile({ existing, incoming });
    // Depending on jaccard may be same-as or variantOf — both must not auto-double
    expect(proposals[0]!.status).toBe('proposed');
    const out = applyReconcile({ existing, incoming, proposals });
    expect(out.cellCandidates).toHaveLength(1);
    expect(out.pendingProposals).toHaveLength(1);
    expect(out.addedIds).toHaveLength(0);
  });

  test('human-accepted variantOf adds linked record', () => {
    const existing = [
      cand({ id: 'utdg:archetype:race-official', entityType: 'Archetype', prefLabel: '1909 Indianapolis race official' })
    ];
    const incoming = [
      cand({
        id: 'utdg:archetype:race-official-coat',
        entityType: 'Archetype',
        prefLabel: '1909 Indianapolis race official dust coat variant',
        commercialAllowed: true,
        exportEligibility: { status: 'eligible', checkedAt: NOW, sourceIds: ['old-source'], reasons: [] }
      })
    ];
    const proposals = proposeReconcile({ existing, incoming });
    expect(proposals[0]!.relation).toBe('variantOf');
    const out = applyReconcile({
      existing,
      incoming,
      proposals,
      decisions: [{
        proposalId: proposals[0]!.proposalId,
        decision: 'accepted',
        decidedBy: 'operator',
        decidedAt: NOW
      }]
    });
    expect(out.cellCandidates).toHaveLength(2);
    const added = out.cellCandidates.find((c) => c.id === 'utdg:archetype:race-official-coat')!;
    expect(added.sourceConceptRefs).toContain('utdg:archetype:race-official');
    expect(added.commercialAllowed).toBe(false);
    expect(added.exportEligibility?.status).not.toBe('eligible');
    expect(added.reviewStatus).toBe('needs_review');
  });

  test('distinct new record grows the cell by one', () => {
    const existing = [
      cand({ id: 'utdg:concept:straw-boater', entityType: 'Concept', prefLabel: 'straw boater hat' })
    ];
    const incoming = [
      cand({ id: 'utdg:concept:modern-logo', entityType: 'Concept', prefLabel: 'modern logo' })
    ];
    const out = applyReconcile({ existing, incoming });
    expect(out.cellCandidates).toHaveLength(2);
    expect(out.addedIds).toEqual(['utdg:concept:modern-logo']);
  });

  test('reconcileIntoCell emits a valid reconciliation artifact', () => {
    const cellId = 'test-cell';
    const candidates = [cand({ id: 'utdg:concept:linen', entityType: 'Concept', prefLabel: 'linen fabric' })];
    const art = reconcileIntoCell({
      cellId,
      existing: [],
      incoming: candidates,
      now: NOW
    });
    expect(art.artifact).toBe('reconciliation');
    expect(art.cellId).toBe(cellId);
    expect(art.cellCandidates.length).toBe(candidates.length);
    expect(art.proposals.length).toBe(candidates.length);
  });
});

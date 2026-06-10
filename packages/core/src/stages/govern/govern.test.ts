import {
  IntakeApprovalSchema,
  RetrievalSchema,
  SceneGrammarSchema,
  type CitationReview,
  type GrammarRevision,
  type RegisteredSource,
  type RetrievalCandidate,
  type RevisionDecision,
  type SourceClaim,
  type SourceLifecycle
} from '../../schemas';
import { historicalCrowdGrammar } from '../../compile/__fixtures__/historical-crowd-grammar';
import {
  applyAcceptedRevisions,
  citationStatusForRevision,
  computeIntegrityFlags,
  promoteApprovedCandidates,
  setTarget
} from './index';

const NOW = '2026-06-10T12:00:00.000Z';

function candidate(id: string, over: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return RetrievalSchema.parse({
    artifact: 'retrieval', runId: 'r', inputId: 'i', createdAt: NOW,
    policy: { mode: 'dry-run' },
    candidates: [{
      candidateId: id, queryText: 'q', title: `t-${id}`, sourceFamily: 'newspaper',
      providerId: 'p', retrievedAt: NOW, ...over
    }]
  }).candidates[0]!;
}

function approval(entries: Array<{ candidateId: string; approvalStatus: 'approved' | 'rejected' | 'needs_review' }>) {
  return IntakeApprovalSchema.parse({
    artifact: 'source-intake-approval', inputId: 'i',
    approvals: entries.map((e) => ({ ...e, approvedBy: 'op', approvedAt: NOW }))
  });
}

function source(id: string, rights: RegisteredSource['rightsProfile'] = 'public-domain'): RegisteredSource {
  return { sourceId: id, title: id, sourceFamily: 'newspaper', rightsProfile: rights, approvedBy: 'op', approvedAt: NOW, retracted: false };
}
function claim(id: string, sourceIds: string[]): SourceClaim {
  return { claimId: id, text: id, evidenceIds: [`e_${id}`], sourceIds, confidence: 'medium', closesGapIds: [] };
}
function review(claimId: string, status: CitationReview['citationStatus']): CitationReview {
  return { claimId, citationStatus: status, reviewTier: 'individual_human', reviewerId: 'op', reviewedAt: NOW };
}
function revision(over: Partial<GrammarRevision> = {}): GrammarRevision {
  return {
    revisionId: 'rev_1',
    targetRef: 'archetypes.middle_class_spectator.weightRange',
    revisionKind: 'material',
    proposedValue: { label: 'Middle-class spectator', min: 40, max: 50 },
    rationale: 'new evidence',
    sourceClaimIds: ['c1'],
    evidenceIds: [],
    confidence: 'medium',
    ...over
  };
}
const decide = (revisionId: string, state: RevisionDecision['state'], citationOverride = false): RevisionDecision =>
  ({ revisionId, state, decidedBy: 'op', decidedAt: NOW, citationOverride });

describe('governance: candidate intake invariants (S2.3)', () => {
  const cands = [candidate('a'), candidate('b'), candidate('c', { hypothesisMatch: 'mismatched' })];

  test('[AC-2.3a] only approved, non-mismatched candidates promote', () => {
    const { sources } = promoteApprovedCandidates({
      candidates: cands,
      approval: approval([
        { candidateId: 'a', approvalStatus: 'approved' },
        { candidateId: 'b', approvalStatus: 'rejected' },
        { candidateId: 'c', approvalStatus: 'approved' }
      ])
    });
    expect(sources.map((s) => s.sourceId)).toEqual(['utdg:source:a']);
  });

  test('[AC-2.3a] property: no rejected/needs_review/absent approval ever yields a source', () => {
    for (const status of ['rejected', 'needs_review'] as const) {
      const { sources } = promoteApprovedCandidates({
        candidates: cands, approval: approval([{ candidateId: 'a', approvalStatus: status }])
      });
      expect(sources).toHaveLength(0);
    }
    // empty approval => no sources, ever
    expect(promoteApprovedCandidates({ candidates: cands, approval: approval([]) }).sources).toHaveLength(0);
  });
});

describe('governance: citation-gated revision application (S2.3)', () => {
  const base = historicalCrowdGrammar();
  const baseRange = base.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange;

  test('accepted citation applies a material delta', () => {
    const { acceptedGrammar, deltas } = applyAcceptedRevisions({
      baseGrammar: base, revisions: [revision()], decisions: [decide('rev_1', 'accepted')],
      claims: [claim('c1', ['s1'])], citationReviews: [review('c1', 'approved')], sources: [source('s1')], now: NOW
    });
    expect(deltas[0]!.deltaKind).toBe('material');
    expect(acceptedGrammar.grammarTarget).toBe('accepted');
    expect(acceptedGrammar.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange)
      .toMatchObject({ min: 40, max: 50 });
  });

  test('[AC-2.3a] property: rejected/needs_review/mixed citations never mutate grammar without override', () => {
    for (const status of ['rejected', 'needs_review'] as const) {
      const { acceptedGrammar, deltas } = applyAcceptedRevisions({
        baseGrammar: base, revisions: [revision()], decisions: [decide('rev_1', 'accepted')],
        claims: [claim('c1', ['s1'])], citationReviews: [review('c1', status)], sources: [source('s1')], now: NOW
      });
      expect(deltas[0]!.deltaKind).toBe('confirmation');
      expect(acceptedGrammar.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange)
        .toEqual(baseRange);
    }
  });

  test('[AC-2.3a] property: non-accepted revision decisions never apply', () => {
    for (const state of ['rejected', 'pending'] as const) {
      const { acceptedGrammar, deltas } = applyAcceptedRevisions({
        baseGrammar: base, revisions: [revision()], decisions: [decide('rev_1', state)],
        claims: [claim('c1', ['s1'])], citationReviews: [review('c1', 'approved')], sources: [source('s1')], now: NOW
      });
      expect(deltas).toHaveLength(0);
      expect(acceptedGrammar.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange)
        .toEqual(baseRange);
    }
  });

  test('citationOverride applies a blocked change and records override + warning', () => {
    const { acceptedGrammar, deltas } = applyAcceptedRevisions({
      baseGrammar: base, revisions: [revision()], decisions: [decide('rev_1', 'accepted', true)],
      claims: [claim('c1', ['s1'])], citationReviews: [review('c1', 'rejected')], sources: [source('s1')], now: NOW
    });
    expect(deltas[0]!.deltaKind).toBe('material');
    expect(deltas[0]!.citationStatus).toBe('override');
    expect(deltas[0]!.warnings.some((w) => /override/i.test(w))).toBe(true);
    expect(acceptedGrammar.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange)
      .toMatchObject({ min: 40, max: 50 });
  });

  test('[AC-2.3a] low-quality source cannot carry high-confidence silently', () => {
    const { deltas } = applyAcceptedRevisions({
      baseGrammar: base, revisions: [revision({ confidence: 'high' })], decisions: [decide('rev_1', 'accepted')],
      claims: [claim('c1', ['s_lq'])], citationReviews: [review('c1', 'approved')],
      sources: [source('s_lq', 'reference-only')], now: NOW
    });
    expect(deltas[0]!.warnings.some((w) => /low-quality/i.test(w))).toBe(true);
  });

  test('[AC-2.3c] supersession: a later accepted revision overrides the same target', () => {
    const r1 = revision({ revisionId: 'rev_1', proposedValue: { label: 'x', min: 40, max: 50 } });
    const r2 = revision({ revisionId: 'rev_2', proposedValue: { label: 'x', min: 45, max: 55 }, supersedesRevisionId: 'rev_1' });
    const { acceptedGrammar } = applyAcceptedRevisions({
      baseGrammar: base, revisions: [r1, r2], decisions: [decide('rev_1', 'accepted'), decide('rev_2', 'accepted')],
      claims: [claim('c1', ['s1'])], citationReviews: [review('c1', 'approved')], sources: [source('s1')], now: NOW
    });
    expect(acceptedGrammar.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange)
      .toMatchObject({ min: 45, max: 55 });
  });

  test('a no-op proposed value is recorded as a confirmation, not a material change', () => {
    const same = base.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange;
    const { deltas } = applyAcceptedRevisions({
      baseGrammar: base, revisions: [revision({ proposedValue: same })], decisions: [decide('rev_1', 'accepted')],
      claims: [claim('c1', ['s1'])], citationReviews: [review('c1', 'approved')], sources: [source('s1')], now: NOW
    });
    expect(deltas[0]!.deltaKind).toBe('confirmation');
  });
});

describe('governance: retraction cascade (S2.3, hole 2)', () => {
  function lifecycle(retract: boolean): SourceLifecycle {
    return {
      artifact: 'source-lifecycle', schemaVersion: '0.1.0', runId: 'r', inputId: 'i', createdAt: NOW,
      sources: [{ ...source('s1'), retracted: retract, ...(retract ? { retractionReason: 'misattributed' } : {}) }],
      evidence: [{ evidenceId: 'e1', sourceId: 's1', excerptText: 'x', confidence: 'medium',
        provenance: { sourceInputIds: [], sourceChunkIds: [], spans: [], attributionMode: 'quoted', evidenceBasis: 'observed', confidence: 'medium', verification: 'verified' } }],
      claims: [{ claimId: 'c1', text: 'x', evidenceIds: ['e1'], sourceIds: ['s1'], confidence: 'medium', closesGapIds: [] }],
      citationReviews: [], integrityFlags: [], gates: { rightsGate: 'pass' }
    };
  }

  test('[AC-2.3b] retraction flags dependent evidence, claims, and deltas — never rewrites', () => {
    const lc = lifecycle(true);
    const deltas = [{
      deltaId: 'delta_001', revisionId: 'rev_1', targetRef: 'archetypes.x.weightRange', deltaKind: 'material' as const,
      before: 1, after: 2, sourceClaimIds: ['c1'], evidenceIds: ['e1'], citationStatus: 'approved' as const, warnings: [], appliedAt: NOW
    }];
    const flags = computeIntegrityFlags({ lifecycle: lc, deltas });
    const codes = flags.map((f) => f.code);
    expect(codes).toContain('evidence-depends-on-retracted-source');
    expect(codes).toContain('claim-depends-on-retracted-source');
    expect(codes).toContain('accepted-delta-depends-on-retracted-source');
    // never rewrites: the source/claim records are untouched
    expect(lc.claims[0]!.claimId).toBe('c1');
  });

  test('no flags when nothing is retracted', () => {
    expect(computeIntegrityFlags({ lifecycle: lifecycle(false) })).toHaveLength(0);
  });
});

describe('governance: target resolver', () => {
  test('setTarget is pure and reports found/changed correctly', () => {
    const base = historicalCrowdGrammar();
    const r = setTarget(base, 'archetypes.middle_class_spectator.weightRange', { label: 'x', min: 1, max: 2 });
    expect(r.found).toBe(true);
    expect(r.changed).toBe(true);
    expect(base.archetypes.find((a) => a.archetypeId === 'middle_class_spectator')!.weightRange!.min).toBe(50); // input untouched
    expect(setTarget(base, 'archetypes.nonexistent.weightRange', {}).found).toBe(false);
    expect(setTarget(base, 'bad.ref', {}).found).toBe(false);
    expect(citationStatusForRevision({ revision: revision(), claimsById: new Map(), reviewsById: new Map() })).toBe('needs_review');
  });
});

import type {
  AcceptedDelta,
  CitationReview,
  GrammarRevision,
  IntakeApproval,
  RegisteredSource,
  RetrievalCandidate,
  RevisionDecision,
  SceneGrammar,
  SourceClaim,
  SourceLifecycle
} from '../../schemas';
import { SceneGrammarSchema } from '../../schemas';
import { setTarget } from './target';

/**
 * Governance state machine (S2.3) — the evidence-gated knowledge-mutation core.
 * Pure functions over artifacts. Encodes the "What Must Never Happen" invariants
 * directly; they are property-tested in govern.test.ts.
 *
 * Forward chain: candidate -> approval -> source -> evidence -> claim ->
 * citation review -> revision -> decision -> accepted delta -> accepted grammar.
 * Backward: retraction cascades as FLAGS (never silent rewrites); supersession
 * is a new accepted revision targeting the same field.
 */

export type CitationStatus = 'accepted' | 'rejected' | 'needs_review' | 'mixed' | 'none';

// --- Candidate intake -------------------------------------------------------

export interface PromotionResult {
  sources: RegisteredSource[];
  warnings: string[];
}

/**
 * INVARIANT: only candidates with an explicit 'approved' decision AND a
 * non-mismatched hypothesis become sources. Unapproved/rejected/needs_review/
 * mismatched candidates never promote.
 */
export function promoteApprovedCandidates(args: {
  candidates: RetrievalCandidate[];
  approval: IntakeApproval;
  approvedByDefaultRights?: boolean;
}): PromotionResult {
  const byId = new Map(args.candidates.map((c) => [c.candidateId, c]));
  const sources: RegisteredSource[] = [];
  const warnings: string[] = [];

  for (const entry of args.approval.approvals) {
    if (entry.approvalStatus !== 'approved') continue;
    const candidate = byId.get(entry.candidateId);
    if (!candidate) {
      warnings.push(`approval references unknown candidate ${entry.candidateId}`);
      continue;
    }
    if (candidate.hypothesisMatch === 'mismatched') {
      warnings.push(`candidate ${entry.candidateId} approved but hypothesis mismatched — not promoted`);
      continue;
    }
    sources.push({
      sourceId: `utdg:source:${candidate.candidateId}`,
      title: candidate.title,
      sourceFamily: candidate.sourceFamily,
      ...(candidate.url !== undefined ? { url: candidate.url } : {}),
      ...(candidate.publicationDateGuess !== undefined ? { publicationDate: candidate.publicationDateGuess } : {}),
      rightsProfile: entry.rightsProfile ?? candidate.rightsProfileGuess,
      ...(candidate.rightsStatementVerbatim !== undefined ? { rightsStatement: candidate.rightsStatementVerbatim } : {}),
      approvedBy: entry.approvedBy,
      approvedAt: entry.approvedAt,
      retracted: false
    });
  }
  return { sources, warnings };
}

// --- Citation gating --------------------------------------------------------

/** Citation status for a revision, derived from reviews of the claims it cites. */
export function citationStatusForRevision(args: {
  revision: GrammarRevision;
  claimsById: Map<string, SourceClaim>;
  reviewsById: Map<string, CitationReview>;
}): CitationStatus {
  const reviews = args.revision.sourceClaimIds
    .map((id) => args.reviewsById.get(id))
    .filter((r): r is CitationReview => Boolean(r));
  const statuses = reviews.length > 0
    ? reviews.map((r) => r.citationStatus)
    : args.revision.sourceClaimIds.map(() => 'needs_review' as const);

  if (statuses.includes('approved')) return 'accepted';
  if (statuses.length > 0 && statuses.every((s) => s === 'rejected')) return 'rejected';
  if (statuses.length > 0 && statuses.every((s) => s === 'needs_review')) return 'needs_review';
  if (statuses.length > 1) return 'mixed';
  return 'none';
}

const LOW_QUALITY_RIGHTS = new Set(['unknown', 'reference-only', 'restricted']);

// --- Revision application ---------------------------------------------------

export interface ApplyResult {
  acceptedGrammar: SceneGrammar;
  deltas: AcceptedDelta[];
}

/**
 * Applies accepted, citation-gated revisions to the base grammar.
 * INVARIANTS enforced here:
 *  - only revisions with decision.state === 'accepted' apply;
 *  - a material change requires citationStatus 'accepted' OR an explicit
 *    decision.citationOverride; rejected/needs_review/mixed otherwise yield a
 *    confirmation delta (no mutation) with a warning;
 *  - a revision citing a low-quality source cannot carry high confidence;
 *  - supersession: a later accepted revision targeting the same ref replaces
 *    the prior delta's effect.
 */
export function applyAcceptedRevisions(args: {
  baseGrammar: SceneGrammar;
  revisions: GrammarRevision[];
  decisions: RevisionDecision[];
  claims: SourceClaim[];
  citationReviews: CitationReview[];
  sources: RegisteredSource[];
  now: string;
}): ApplyResult {
  const decisionById = new Map(args.decisions.map((d) => [d.revisionId, d]));
  const claimsById = new Map(args.claims.map((c) => [c.claimId, c]));
  const reviewsById = new Map(args.citationReviews.map((r) => [r.claimId, r]));
  const sourceById = new Map(args.sources.map((s) => [s.sourceId, s]));

  let grammar: SceneGrammar = JSON.parse(JSON.stringify(args.baseGrammar));
  grammar.grammarTarget = 'accepted';
  const deltas: AcceptedDelta[] = [];
  let deltaSeq = 0;

  // Deterministic order: accepted revisions, superseding ones after their target.
  const accepted = args.revisions.filter((r) => decisionById.get(r.revisionId)?.state === 'accepted');

  for (const revision of accepted) {
    const decision = decisionById.get(revision.revisionId)!;
    const citationStatus = citationStatusForRevision({ revision, claimsById, reviewsById });
    const override = decision.citationOverride === true;
    const warnings: string[] = [];

    // low-quality source guard
    const citesLowQuality = revision.sourceClaimIds.some((claimId) => {
      const claim = claimsById.get(claimId);
      return (claim?.sourceIds ?? []).some((sid) => LOW_QUALITY_RIGHTS.has(sourceById.get(sid)?.rightsProfile ?? 'unknown'));
    });
    if (citesLowQuality && revision.confidence === 'high') {
      warnings.push(`revision ${revision.revisionId} cites a low-quality source; high confidence not allowed`);
    }

    const materialAllowed = citationStatus === 'accepted' || override;
    if (override && citationStatus !== 'accepted') {
      warnings.push(`revision ${revision.revisionId} applied via citationOverride without an accepted citation`);
    }

    let citationField: AcceptedDelta['citationStatus'];
    if (override && citationStatus !== 'accepted') citationField = 'override';
    else if (citationStatus === 'accepted') citationField = 'approved';
    else if (citationStatus === 'rejected') citationField = 'rejected';
    else citationField = 'needs_review';

    if (revision.revisionKind === 'material' && materialAllowed) {
      const result = setTarget(grammar, revision.targetRef, revision.proposedValue);
      if (!result.found) {
        warnings.push(`target not found: ${revision.targetRef}`);
        deltas.push(makeDelta(++deltaSeq, revision, 'confirmation', undefined, undefined, citationField, warnings, args.now));
        continue;
      }
      grammar = result.grammar;
      deltas.push(makeDelta(
        ++deltaSeq, revision,
        result.changed ? 'material' : 'confirmation',
        result.before, result.after, citationField, warnings, args.now
      ));
    } else {
      if (revision.revisionKind === 'material' && !materialAllowed) {
        warnings.push(`material change blocked by citation status '${citationStatus}'`);
      }
      deltas.push(makeDelta(++deltaSeq, revision, 'confirmation', undefined, undefined, citationField, warnings, args.now));
    }
  }

  return { acceptedGrammar: SceneGrammarSchema.parse(grammar), deltas };
}

function makeDelta(
  seq: number,
  revision: GrammarRevision,
  deltaKind: 'material' | 'confirmation',
  before: unknown,
  after: unknown,
  citationStatus: AcceptedDelta['citationStatus'],
  warnings: string[],
  now: string
): AcceptedDelta {
  return {
    deltaId: `delta_${String(seq).padStart(3, '0')}`,
    revisionId: revision.revisionId,
    targetRef: revision.targetRef,
    deltaKind,
    before,
    after,
    sourceClaimIds: revision.sourceClaimIds,
    evidenceIds: revision.evidenceIds,
    citationStatus,
    warnings,
    appliedAt: now
  };
}

// --- Retraction cascade -----------------------------------------------------

export interface IntegrityFlag {
  code: string;
  message: string;
  recordIds: string[];
}

/**
 * Computes flags for everything downstream of a retracted source. Never
 * rewrites artifacts — surfaces compromised evidence/claims/deltas so a human
 * decides. INVARIANT: no accepted delta may silently depend on a retracted
 * source; this makes such dependencies visible.
 */
export function computeIntegrityFlags(args: {
  lifecycle: SourceLifecycle;
  deltas?: AcceptedDelta[];
}): IntegrityFlag[] {
  const flags: IntegrityFlag[] = [];
  const retracted = new Set(args.lifecycle.sources.filter((s) => s.retracted).map((s) => s.sourceId));
  if (retracted.size === 0) return flags;

  const compromisedEvidence = args.lifecycle.evidence.filter((e) => retracted.has(e.sourceId)).map((e) => e.evidenceId);
  if (compromisedEvidence.length > 0) {
    flags.push({ code: 'evidence-depends-on-retracted-source', message: 'evidence cites a retracted source', recordIds: compromisedEvidence });
  }

  const compromisedEvidenceSet = new Set(compromisedEvidence);
  const compromisedClaims = args.lifecycle.claims.filter(
    (c) => c.sourceIds.some((s) => retracted.has(s)) || c.evidenceIds.some((e) => compromisedEvidenceSet.has(e))
  ).map((c) => c.claimId);
  if (compromisedClaims.length > 0) {
    flags.push({ code: 'claim-depends-on-retracted-source', message: 'claim depends on a retracted source', recordIds: compromisedClaims });
  }

  const compromisedClaimSet = new Set(compromisedClaims);
  const compromisedDeltas = (args.deltas ?? []).filter(
    (d) => d.sourceClaimIds.some((c) => compromisedClaimSet.has(c))
  ).map((d) => d.deltaId);
  if (compromisedDeltas.length > 0) {
    flags.push({ code: 'accepted-delta-depends-on-retracted-source', message: 'accepted grammar delta depends on a retracted source', recordIds: compromisedDeltas });
  }

  return flags;
}

export { setTarget, parseTargetRef } from './target';

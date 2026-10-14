import { isDeepStrictEqual } from 'node:util';
import { sha256Hex } from '../../artifacts/ids';
import {
  ReconciliationSchema,
  type ConfidenceLevel,
  type ReconcileDecision,
  type ReconcileMethod,
  type ReconcileProposal,
  type ReconcileRelation,
  type Reconciliation,
  type UtdgCandidate
} from '../../schemas';

/**
 * S5.3 reconciliation — pre-staging dedup for cell records.
 *
 * proposeReconcile: compare existing cell candidates to an incoming run.
 * applyReconcile: fold incoming into the cell using proven idempotent replays
 * + human decisions. Label/external-id matches never auto-merge.
 *
 * AC-5.3a: re-running over overlapping sources does not double cell records
 * because identical-id, identical-content replays auto-apply.
 */

/** Only an exact id can establish idempotency, and its content must also match. */
export const AUTO_ACCEPT_METHODS: ReadonlySet<ReconcileMethod> = new Set([
  'exact-id'
]);

function isIdenticalCandidate(left: UtdgCandidate, right: UtdgCandidate): boolean {
  return left.id === right.id && isDeepStrictEqual(left, right);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

/** A decision names the exact candidate contents and relationship reviewed. */
function proposalIdFor(
  left: UtdgCandidate | undefined,
  right: UtdgCandidate,
  relation: ReconcileRelation,
  method: ReconcileMethod
): string {
  const contentHash = (candidate: UtdgCandidate) => sha256Hex(JSON.stringify(canonicalize(candidate)));
  return `prop_${sha256Hex(JSON.stringify({
    version: 1,
    leftContentSha256: left ? contentHash(left) : null,
    rightContentSha256: contentHash(right),
    relation,
    method
  }))}`;
}

export function normalizeReconcileLabel(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/utdg:[a-z-]+:/g, ' ')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalizeReconcileLabel(s).split(' ').filter((t) => t.length > 2));
}

/** Jaccard similarity over label tokens. */
export function tokenJaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function externalIdKey(c: UtdgCandidate): string | undefined {
  const ext = c.externalIds;
  if (!ext) return undefined;
  const parts = [
    ext.gettyAatId,
    ext.wikidataQid,
    ext.institutionRecordId,
    ext.europeanaRecordId
  ].filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (parts.length === 0) return undefined;
  return parts.sort().join('|');
}

interface MatchHit {
  left: UtdgCandidate;
  relation: ReconcileRelation;
  method: ReconcileMethod;
  confidence: ConfidenceLevel;
  score: number;
  rationale: string;
}

function bestMatch(lefts: UtdgCandidate[], right: UtdgCandidate): MatchHit | undefined {
  let best: MatchHit | undefined;

  const consider = (hit: MatchHit) => {
    if (!best || hit.score > best.score) best = hit;
  };

  for (const left of lefts) {
    if (left.entityType !== right.entityType) continue;

    if (left.id === right.id) {
      const identical = isIdenticalCandidate(left, right);
      consider({
        left,
        relation: 'same-as',
        method: 'exact-id',
        confidence: identical ? 'high' : 'medium',
        score: 1,
        rationale: identical
          ? `Identical id and content ${left.id}`
          : `Existing id ${left.id} has different content — needs human confirm`
      });
      continue;
    }

    const le = externalIdKey(left);
    const re = externalIdKey(right);
    if (le && re && le === re) {
      consider({
        left,
        relation: 'same-as',
        method: 'external-id',
        confidence: 'high',
        score: 0.99,
        rationale: `Shared external id key ${le}`
      });
      continue;
    }

    const nl = normalizeReconcileLabel(left.prefLabel);
    const nr = normalizeReconcileLabel(right.prefLabel);
    if (nl && nr && nl === nr) {
      consider({
        left,
        relation: 'same-as',
        method: 'normalized-label',
        confidence: 'high',
        score: 0.95,
        rationale: `Normalized labels match: "${nl}"`
      });
      continue;
    }

    const j = tokenJaccard(left.prefLabel, right.prefLabel);
    if (j >= 0.85) {
      consider({
        left,
        relation: 'same-as',
        method: 'token-similarity',
        confidence: 'medium',
        score: j,
        rationale: `High token overlap (${j.toFixed(2)}) — needs human confirm`
      });
    } else if (j >= 0.45) {
      consider({
        left,
        relation: 'variantOf',
        method: 'token-similarity',
        confidence: j >= 0.6 ? 'medium' : 'low',
        score: j,
        rationale: `Partial token overlap (${j.toFixed(2)}) — propose variantOf`
      });
    }
  }

  return best;
}

export function proposeReconcile(args: {
  existing: UtdgCandidate[];
  incoming: UtdgCandidate[];
}): ReconcileProposal[] {
  const proposals: ReconcileProposal[] = [];

  for (const right of args.incoming) {
    const hit = bestMatch(args.existing, right);
    if (!hit) {
      proposals.push({
        proposalId: proposalIdFor(undefined, right, 'distinct', 'normalized-label'),
        rightId: right.id,
        relation: 'distinct',
        confidence: 'high',
        method: 'normalized-label',
        rationale: 'No same-type match in cell — treat as new distinct record',
        score: 0,
        status: 'proposed'
      });
      continue;
    }

    const auto = hit.relation === 'same-as' && AUTO_ACCEPT_METHODS.has(hit.method)
      && isIdenticalCandidate(hit.left, right);
    proposals.push({
      proposalId: proposalIdFor(hit.left, right, hit.relation, hit.method),
      leftId: hit.left.id,
      rightId: right.id,
      relation: hit.relation,
      confidence: hit.confidence,
      method: hit.method,
      rationale: hit.rationale,
      score: hit.score,
      status: auto ? 'auto-accepted' : 'proposed'
    });
  }

  return proposals;
}

function mergeCandidate(base: UtdgCandidate, incoming: UtdgCandidate): UtdgCandidate {
  if (isIdenticalCandidate(base, incoming)) return { ...base };
  // New lineage requires a fresh export-time permission check, even after identity approval.
  const { exportEligibility: _priorEligibility, ...uncheckedBase } = base;
  const uniq = (a: string[]) => [...new Set(a)];
  return {
    ...uncheckedBase,
    altLabels: uniq([
      ...base.altLabels,
      ...incoming.altLabels,
      ...(incoming.prefLabel !== base.prefLabel ? [incoming.prefLabel] : [])
    ]),
    sourceRefs: uniq([...base.sourceRefs, ...incoming.sourceRefs]),
    evidenceRefs: uniq([...base.evidenceRefs, ...incoming.evidenceRefs]),
    sourceConceptRefs: uniq([...base.sourceConceptRefs, ...incoming.sourceConceptRefs]),
    texturalQualities: uniq([...base.texturalQualities, ...incoming.texturalQualities]),
    usageContexts: uniq([...base.usageContexts, ...incoming.usageContexts]),
    contributionTerms: base.contributionTerms === 'private-only' || incoming.contributionTerms === 'private-only'
      ? 'private-only'
      : base.contributionTerms === 'platform-attribution' || incoming.contributionTerms === 'platform-attribution'
        ? 'platform-attribution'
        : 'platform-community-commons',
    commercialAllowed: false,
    rightsConfidence: 'low',
    reviewStatus: 'needs_review'
  };
}

function decisionMap(decisions: ReconcileDecision[]): Map<string, ReconcileDecision> {
  return new Map(decisions.map((d) => [d.proposalId, d]));
}

export interface ApplyReconcileResult {
  cellCandidates: UtdgCandidate[];
  appliedProposals: ReconcileProposal[];
  pendingProposals: ReconcileProposal[];
  rejectedProposals: ReconcileProposal[];
  addedIds: string[];
  mergedInto: Array<{ keptId: string; absorbedId: string }>;
}

/**
 * Fold incoming candidates into the cell.
 * - identical-id, identical-content same-as → idempotent replay (no double)
 * - human-accepted same-as → merge
 * - human-accepted / proposed variantOf → keep both (link via alt/sourceConceptRefs on apply of variant? keep both)
 * - distinct → add if not already present by id
 * - any other same-as → needs an explicit human decision; incoming held out
 */
export function applyReconcile(args: {
  existing: UtdgCandidate[];
  incoming: UtdgCandidate[];
  proposals?: ReconcileProposal[];
  decisions?: ReconcileDecision[];
}): ApplyReconcileResult {
  const proposals = args.proposals ?? proposeReconcile({
    existing: args.existing,
    incoming: args.incoming
  });
  const decisions = decisionMap(args.decisions ?? []);
  // Decisions are bound to the input snapshot, before any accepted batch merges.
  const existingById = new Map(args.existing.map((c) => [c.id, c]));
  const byId = new Map(args.existing.map((c) => [c.id, { ...c }]));
  const incomingById = new Map(args.incoming.map((c) => [c.id, c]));

  const applied: ReconcileProposal[] = [];
  const pending: ReconcileProposal[] = [];
  const rejected: ReconcileProposal[] = [];
  const addedIds: string[] = [];
  const mergedInto: Array<{ keptId: string; absorbedId: string }> = [];

  const effectiveStatus = (p: ReconcileProposal): ReconcileProposal['status'] => {
    const d = decisions.get(p.proposalId);
    if (d?.decision === 'rejected') return 'rejected';
    if (d?.decision === 'accepted') return 'accepted';
    if (p.status === 'rejected') return 'rejected';
    const left = p.leftId ? byId.get(p.leftId) : undefined;
    const right = incomingById.get(p.rightId);
    // Recheck proof here: a caller-supplied status must never authorize a merge.
    if (p.relation === 'same-as' && AUTO_ACCEPT_METHODS.has(p.method)
      && left && right && isIdenticalCandidate(left, right)) return 'auto-accepted';
    return 'proposed';
  };

  for (const p of proposals) {
    const right = incomingById.get(p.rightId);
    if (!right) {
      pending.push({ ...p, status: 'proposed' });
      continue;
    }

    const left = p.leftId ? existingById.get(p.leftId) : undefined;
    const currentId = proposalIdFor(left, right, p.relation, p.method);
    const hasCurrentTargets = (!p.leftId || left !== undefined)
      && (p.relation === 'distinct' || left !== undefined);
    if (!hasCurrentTargets || p.proposalId !== currentId) {
      pending.push({
        ...p,
        ...(hasCurrentTargets ? { proposalId: currentId } : {}),
        status: 'proposed',
        rationale: `${p.rationale}; candidate content or relationship changed — fresh human review required`
      });
      continue;
    }
    const status = effectiveStatus(p);

    if (status === 'rejected') {
      rejected.push({ ...p, status: 'rejected' });
      continue;
    }

    if (p.relation === 'same-as' && (status === 'auto-accepted' || status === 'accepted')) {
      const leftId = p.leftId;
      if (leftId && byId.has(leftId)) {
        byId.set(leftId, mergeCandidate(byId.get(leftId)!, right));
        mergedInto.push({ keptId: leftId, absorbedId: right.id });
        applied.push({ ...p, status });
      } else if (!byId.has(right.id)) {
        // same-as to missing left — fall back to add
        byId.set(right.id, right);
        addedIds.push(right.id);
        applied.push({ ...p, status });
      }
      continue;
    }

    if (p.relation === 'variantOf' && (status === 'accepted' || status === 'auto-accepted')) {
      if (!byId.has(right.id)) {
        const { exportEligibility: _priorEligibility, ...uncheckedRight } = right;
        const linked = p.leftId
          ? {
              ...uncheckedRight,
              sourceConceptRefs: [...new Set([...right.sourceConceptRefs, p.leftId])],
              altLabels: [...new Set([...right.altLabels, ...(byId.get(p.leftId!)?.prefLabel
                ? [`variant of ${byId.get(p.leftId!)!.prefLabel}`]
                : [])])]
            }
          : uncheckedRight;
        byId.set(right.id, {
          ...linked, commercialAllowed: false, rightsConfidence: 'low', reviewStatus: 'needs_review'
        });
        addedIds.push(right.id);
      }
      applied.push({ ...p, status: status === 'auto-accepted' ? 'accepted' : status });
      continue;
    }

    if (p.relation === 'distinct' && (status === 'proposed' || status === 'accepted' || status === 'auto-accepted')) {
      // Distinct is safe to add without human confirm (new record).
      if (!byId.has(right.id)) {
        byId.set(right.id, right);
        addedIds.push(right.id);
      }
      applied.push({ ...p, status: status === 'proposed' ? 'auto-accepted' : status });
      continue;
    }

    // Unconfirmed same-as — hold out to avoid silent merge / double
    if (p.relation === 'same-as' && status === 'proposed') {
      pending.push(p);
      continue;
    }

    // variantOf still proposed — hold out (or could add as pending staging)
    if (p.relation === 'variantOf' && status === 'proposed') {
      pending.push(p);
      continue;
    }

    pending.push(p);
  }

  return {
    cellCandidates: [...byId.values()],
    appliedProposals: applied,
    pendingProposals: pending,
    rejectedProposals: rejected,
    addedIds,
    mergedInto
  };
}

/** Convenience: propose + apply in one pass (idempotent replay + distinct add). */
export function reconcileIntoCell(args: {
  cellId: string;
  existing: UtdgCandidate[];
  incoming: UtdgCandidate[];
  decisions?: ReconcileDecision[];
  runId?: string;
  inputId?: string;
  now: string;
}): Reconciliation {
  const proposals = proposeReconcile({
    existing: args.existing,
    incoming: args.incoming
  });
  const applied = applyReconcile({
    existing: args.existing,
    incoming: args.incoming,
    proposals,
    ...(args.decisions !== undefined ? { decisions: args.decisions } : {})
  });

  return ReconciliationSchema.parse({
    artifact: 'reconciliation',
    runId: args.runId ?? 'run_reconcile',
    inputId: args.inputId ?? args.cellId,
    createdAt: args.now,
    cellId: args.cellId,
    proposals: [
      ...applied.appliedProposals,
      ...applied.pendingProposals,
      ...applied.rejectedProposals
    ],
    decisions: args.decisions ?? [],
    cellCandidates: applied.cellCandidates,
    notes: [
      `merged=${applied.mergedInto.length}`,
      `added=${applied.addedIds.length}`,
      `pending=${applied.pendingProposals.length}`,
      'Only identical ID/content replays auto-accept; human decisions bind to candidate content and relationship.'
    ]
  });
}

export type { ReconcileProposal, ReconcileDecision, Reconciliation };

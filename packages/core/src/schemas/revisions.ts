import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { ConfidenceLevelSchema } from './vocabulary';

/**
 * revisions: grammar revisions + operator revision state + accepted deltas,
 * in ONE artifact. Collapses legacy grammar-revisions / revision-state /
 * accepted-grammar-deltas. Invariants (enforced by the state machine):
 * only accepted revisions apply; rejected/needs_review citations block
 * material deltas absent an explicit override; supersession = a new revision
 * targeting the same field.
 */

export const GrammarRevisionSchema = z.object({
  revisionId: z.string(),
  /** Dotted path into the scene grammar, e.g. archetypes.middle_class_spectator.weightRange */
  targetRef: z.string(),
  revisionKind: z.enum(['material', 'confirmation']),
  proposedValue: z.unknown(),
  rationale: z.string(),
  sourceClaimIds: z.array(z.string()).min(1),
  evidenceIds: z.array(z.string()).default([]),
  confidence: ConfidenceLevelSchema,
  /** Set when this revision supersedes an earlier accepted revision on the same target. */
  supersedesRevisionId: z.string().optional()
});
export type GrammarRevision = z.infer<typeof GrammarRevisionSchema>;

export const RevisionDecisionSchema = z.object({
  revisionId: z.string(),
  state: z.enum(['accepted', 'rejected', 'pending']),
  decidedBy: z.string(),
  decidedAt: z.string().datetime(),
  rationale: z.string().optional(),
  citationOverride: z.boolean().default(false)
});
export type RevisionDecision = z.infer<typeof RevisionDecisionSchema>;

export const AcceptedDeltaSchema = z.object({
  deltaId: z.string(),
  revisionId: z.string(),
  targetRef: z.string(),
  deltaKind: z.enum(['material', 'confirmation']),
  before: z.unknown(),
  after: z.unknown(),
  sourceClaimIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  citationStatus: z.enum(['approved', 'rejected', 'needs_review', 'override']),
  warnings: z.array(z.string()).default([]),
  appliedAt: z.string().datetime()
});
export type AcceptedDelta = z.infer<typeof AcceptedDeltaSchema>;

export const RevisionsSchema = artifactEnvelope('revisions').extend({
  revisions: z.array(GrammarRevisionSchema).default([]),
  decisions: z.array(RevisionDecisionSchema).default([]),
  acceptedDeltas: z.array(AcceptedDeltaSchema).default([])
});
export type Revisions = z.infer<typeof RevisionsSchema>;

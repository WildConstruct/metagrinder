import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { ConfidenceLevelSchema } from './vocabulary';
import { UtdgCandidateSchema } from './utdg';

/**
 * reconciliation: pre-staging dedup proposals for a cell (S5.3).
 * Only identical-id/content replays may auto-apply. Other identity proposals
 * require a human decision bound to the current candidates and relationship.
 */

export const ReconcileRelationSchema = z.enum(['same-as', 'variantOf', 'distinct']);
export type ReconcileRelation = z.infer<typeof ReconcileRelationSchema>;

export const ReconcileMethodSchema = z.enum([
  'exact-id',
  'normalized-label',
  'external-id',
  'token-similarity',
  'embedding',
  'llm',
  'human'
]);
export type ReconcileMethod = z.infer<typeof ReconcileMethodSchema>;

export const ReconcileProposalSchema = z.object({
  /** Deterministic content hash binding both candidates, relation, and method. */
  proposalId: z.string(),
  /** Existing cell record id (empty when incoming is unmatched / pure distinct). */
  leftId: z.string().optional(),
  /** Incoming run record id. */
  rightId: z.string(),
  relation: ReconcileRelationSchema,
  confidence: ConfidenceLevelSchema,
  method: ReconcileMethodSchema,
  rationale: z.string(),
  /** Similarity score in [0,1] when method uses tokens/embeddings. */
  score: z.number().min(0).max(1).optional(),
  status: z.enum(['proposed', 'accepted', 'rejected', 'auto-accepted']).default('proposed')
});
export type ReconcileProposal = z.infer<typeof ReconcileProposalSchema>;

export const ReconcileDecisionSchema = z.object({
  proposalId: z.string(),
  decision: z.enum(['accepted', 'rejected']),
  decidedBy: z.string(),
  decidedAt: z.string().datetime(),
  rationale: z.string().optional()
});
export type ReconcileDecision = z.infer<typeof ReconcileDecisionSchema>;

/**
 * Optional artifact shape for a reconcile pass. Not yet a package-manifest
 * family (cell store can live outside a single run); validated when written.
 */
export const ReconciliationSchema = artifactEnvelope('reconciliation').extend({
  cellId: z.string(),
  proposals: z.array(ReconcileProposalSchema).default([]),
  decisions: z.array(ReconcileDecisionSchema).default([]),
  /** Deduped cell candidate set after apply. */
  cellCandidates: z.array(UtdgCandidateSchema).default([]),
  notes: z.array(z.string()).default([])
});
export type Reconciliation = z.infer<typeof ReconciliationSchema>;

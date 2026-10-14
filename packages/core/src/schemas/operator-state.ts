import { z } from 'zod';
import { RightsProfileSchema } from './vocabulary';

/**
 * Operator-state files — written by humans (the Workbench), read by the
 * governance state machine. These are the ONLY inputs that can promote a
 * candidate or accept a revision; nothing automated may stand in for them.
 *
 * S4.2 write boundary: workbench server may only create/update these shapes
 * under operator-state/ (or the legacy root source-intake-approval.json path).
 */

/**
 * S4.3 reviewer provenance — required on complete gate decisions.
 * Image_Prep pattern: id/role, date, rationale on every human gate.
 */
export const ReviewerProvenanceSchema = z.object({
  reviewerId: z.string().min(1),
  reviewerRole: z.string().min(1),
  decidedAt: z.string().datetime(),
  rationale: z.string().min(1)
});
export type ReviewerProvenance = z.infer<typeof ReviewerProvenanceSchema>;

export const IntakeApprovalEntrySchema = z.object({
  candidateId: z.string(),
  approvalStatus: z.enum(['approved', 'rejected', 'needs_review']),
  approvedBy: z.string(),
  approvedAt: z.string().datetime(),
  /** Preferred: structured provenance (S4.3). Falls back to approvedBy/note when absent. */
  reviewer: ReviewerProvenanceSchema.optional(),
  rightsProfile: RightsProfileSchema.optional(),
  note: z.string().optional()
});
export type IntakeApprovalEntry = z.infer<typeof IntakeApprovalEntrySchema>;

export const IntakeApprovalSchema = z.object({
  artifact: z.literal('source-intake-approval'),
  schemaVersion: z.string().default('0.1.0'),
  inputId: z.string(),
  approvals: z.array(IntakeApprovalEntrySchema).default([])
});
export type IntakeApproval = z.infer<typeof IntakeApprovalSchema>;

/** Operator revision decisions — applied by govern; not a generated revisions dump. */
export const OperatorRevisionDecisionSchema = z.object({
  revisionId: z.string(),
  state: z.enum(['accepted', 'rejected', 'pending']),
  decidedBy: z.string(),
  decidedAt: z.string().datetime(),
  reviewer: ReviewerProvenanceSchema.optional(),
  rationale: z.string().optional(),
  citationOverride: z.boolean().default(false)
});
export type OperatorRevisionDecision = z.infer<typeof OperatorRevisionDecisionSchema>;

export const OperatorRevisionDecisionsSchema = z.object({
  artifact: z.literal('operator-revision-decisions'),
  schemaVersion: z.string().default('0.1.0'),
  runId: z.string(),
  inputId: z.string(),
  decisions: z.array(OperatorRevisionDecisionSchema).default([]),
  updatedAt: z.string().datetime()
});
export type OperatorRevisionDecisions = z.infer<typeof OperatorRevisionDecisionsSchema>;

export const OperatorNotesSchema = z.object({
  artifact: z.literal('operator-notes'),
  schemaVersion: z.string().default('0.1.0'),
  runId: z.string(),
  notes: z.string().default(''),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().optional()
});
export type OperatorNotes = z.infer<typeof OperatorNotesSchema>;

/** Allowed operator-state file kinds the thin workbench may write. */
export const OperatorWritableKindSchema = z.enum([
  'source-intake-approval',
  'operator-revision-decisions',
  'operator-notes',
  'review-selection'
]);
export type OperatorWritableKind = z.infer<typeof OperatorWritableKindSchema>;

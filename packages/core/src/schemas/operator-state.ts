import { z } from 'zod';
import { RightsProfileSchema } from './vocabulary';

/**
 * Operator-state files — written by humans (the Workbench), read by the
 * governance state machine. These are the ONLY inputs that can promote a
 * candidate or accept a revision; nothing automated may stand in for them.
 */

export const IntakeApprovalEntrySchema = z.object({
  candidateId: z.string(),
  approvalStatus: z.enum(['approved', 'rejected', 'needs_review']),
  approvedBy: z.string(),
  approvedAt: z.string().datetime(),
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

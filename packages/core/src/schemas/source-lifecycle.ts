import { z } from 'zod';
import { ProvenanceSchema, artifactEnvelope } from './provenance';
import {
  ConfidenceLevelSchema,
  GateStatusSchema,
  ReviewTierSchema,
  RightsProfileSchema,
  SourceFamilySchema
} from './vocabulary';

/**
 * source-lifecycle: the approved-source chain in ONE artifact —
 * registry -> evidence -> claims -> citation review.
 * Collapses legacy source-registry / source-evidence / source-claims /
 * source-claim-review files. The chain invariants live in the governance
 * state machine; this schema only encodes the shapes.
 *
 * `retracted` on a source cascades as FLAGS downstream (never silent rewrites).
 */

export const RegisteredSourceSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  sourceFamily: SourceFamilySchema.default('other'),
  url: z.string().optional(),
  sourceSystem: z.string().optional(),
  sourceRecordId: z.string().optional(),
  publicationDate: z.string().optional(),
  rightsProfile: RightsProfileSchema.default('unknown'),
  /** Verbatim rights statement from the provider (e.g. LOC "no known restrictions"). */
  rightsStatement: z.string().optional(),
  retrievedAt: z.string().datetime().optional(),
  approvedBy: z.string(),
  approvedAt: z.string().datetime(),
  retracted: z.boolean().default(false),
  retractionReason: z.string().optional()
});
export type RegisteredSource = z.infer<typeof RegisteredSourceSchema>;

export const SourceEvidenceSchema = z.object({
  evidenceId: z.string(),
  sourceId: z.string(),
  excerptText: z.string().min(1),
  locator: z.string().optional(),
  confidence: ConfidenceLevelSchema,
  provenance: ProvenanceSchema
});
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;

export const SourceClaimSchema = z.object({
  claimId: z.string(),
  text: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
  sourceIds: z.array(z.string()).min(1),
  confidence: ConfidenceLevelSchema,
  /** Gaps this claim closes (gap-registry lineage). */
  closesGapIds: z.array(z.string()).default([])
});
export type SourceClaim = z.infer<typeof SourceClaimSchema>;

export const CitationReviewSchema = z.object({
  claimId: z.string(),
  citationStatus: z.enum(['approved', 'rejected', 'needs_review']),
  reviewTier: ReviewTierSchema,
  reviewerId: z.string(),
  reviewerRole: z.string().optional(),
  reviewedAt: z.string().datetime(),
  rationale: z.string().optional()
});
export type CitationReview = z.infer<typeof CitationReviewSchema>;

export const SourceLifecycleSchema = artifactEnvelope('source-lifecycle').extend({
  sources: z.array(RegisteredSourceSchema).default([]),
  evidence: z.array(SourceEvidenceSchema).default([]),
  claims: z.array(SourceClaimSchema).default([]),
  citationReviews: z.array(CitationReviewSchema).default([]),
  /** Computed by the state machine: flags raised by retractions or broken refs. */
  integrityFlags: z.array(z.object({
    code: z.string(),
    message: z.string(),
    recordIds: z.array(z.string()).default([])
  })).default([]),
  gates: z.object({
    rightsGate: GateStatusSchema.default('pending')
  }).default({ rightsGate: 'pending' })
});
export type SourceLifecycle = z.infer<typeof SourceLifecycleSchema>;

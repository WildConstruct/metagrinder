import { z } from 'zod';
import { ExternalIdsSchema, ProvenanceSchema, artifactEnvelope } from './provenance';
import {
  ConfidenceLevelSchema,
  CoOccurrenceBasisSchema,
  ReviewStatusSchema,
  RightsProfileSchema,
  UtdgEntityTypeSchema
} from './vocabulary';

/**
 * utdg-candidates: staged UTDG export in application-profile-v1 shapes.
 * Staged or needs_review ONLY — canonical promotion happens elsewhere, never here.
 * Generated assets export as ImageReference with isEvidence=false.
 *
 * Rights fields (S5.2 decision #2): platform profile + source/contribution layers.
 * commercialAllowed defaults false and must only be set true by deterministic
 * rights policy — never by an LLM proposer.
 */

export const ContributionTermsSchema = z.enum([
  'platform-community-commons',
  'platform-attribution',
  'private-only'
]);
export type ContributionTerms = z.infer<typeof ContributionTermsSchema>;

/** Current-source permission check only; never canonical/content-review approval. */
export const ExportEligibilitySchema = z.object({
  status: z.enum(['eligible', 'blocked', 'unverified']),
  checkedAt: z.string().datetime(),
  sourceIds: z.array(z.string()),
  reasons: z.array(z.string())
});

export const UtdgCandidateSchema = z.object({
  /** Application-profile ID convention: utdg:concept:* | utdg:archetype:* | utdg:evidence:* | utdg:rule:* | utdg:source:* */
  id: z.string().regex(/^utdg:[a-z-]+:/),
  entityType: UtdgEntityTypeSchema,
  prefLabel: z.string(),
  altLabels: z.array(z.string()).default([]),
  definition: z.string().optional(),
  summary: z.string().optional(),
  conceptType: z.string().optional(),
  externalIds: ExternalIdsSchema.optional(),
  sourceConceptRefs: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  sourceRefs: z.array(z.string()).default([]),
  texturalQualities: z.array(z.string()).default([]),
  usageContexts: z.array(z.string()).default([]),
  /** For CompatibilityRule candidates: layout adjacency is not styling evidence. */
  coOccurrenceBasis: CoOccurrenceBasisSchema.optional(),
  isEvidence: z.boolean().default(false),
  confidence: ConfidenceLevelSchema,
  rightsProfile: RightsProfileSchema.default('unknown'),
  /** Upstream license/label (CC0, Institution Terms, Unknown, …). */
  sourceRights: z.string().default('Unknown'),
  contributionTerms: ContributionTermsSchema.default('private-only'),
  rightsConfidence: ConfidenceLevelSchema.default('low'),
  /** Derived by rights policy only. Never true by default. */
  commercialAllowed: z.boolean().default(false),
  /** Recomputed at export; absent on older staged records. */
  exportEligibility: ExportEligibilitySchema.optional(),
  reviewStatus: ReviewStatusSchema.refine(
    (s) => s === 'staged' || s === 'needs_review' || s === 'draft',
    { message: 'utdg candidates may only export as draft, staged, or needs_review' }
  ),
  provenance: ProvenanceSchema.optional()
});
export type UtdgCandidate = z.infer<typeof UtdgCandidateSchema>;

export const UtdgCandidatesSchema = artifactEnvelope('utdg-candidates').extend({
  cellId: z.string().optional(),
  candidates: z.array(UtdgCandidateSchema).default([])
});
export type UtdgCandidates = z.infer<typeof UtdgCandidatesSchema>;

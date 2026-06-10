import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { SourceFamilySchema } from './vocabulary';

/**
 * research-campaign: a time-bounded engagement that turns gaps into evidence.
 * gap -> hypothesis -> discovery -> approval -> evidence -> claim -> closed gap.
 * Negative results persist with a shelf life so future campaigns do not
 * re-propose exhausted hypotheses.
 */

export const SourceHypothesisSchema = z.object({
  hypothesisId: z.string(),
  sourceFamily: SourceFamilySchema,
  familyNote: z.string().optional(),
  /** e.g. "Sears Roebuck catalog, Spring 1909" / "Bain News Service, 1909 Indianapolis races" */
  description: z.string().min(1),
  rationale: z.string(),
  expectedEvidenceType: z.string(),
  targetsGapIds: z.array(z.string()).min(1),
  status: z.enum(['hypothesized', 'searching', 'located', 'approved', 'exhausted', 'withdrawn'])
    .default('hypothesized'),
  locatedCandidateIds: z.array(z.string()).default([])
});
export type SourceHypothesis = z.infer<typeof SourceHypothesisSchema>;

export const NegativeResultSchema = z.object({
  hypothesisId: z.string(),
  searchedWhere: z.string(),
  searchedWhen: z.string().datetime(),
  finding: z.string(),
  /** Re-check after this date; archives keep digitizing. */
  staleAfter: z.string().datetime().optional()
});
export type NegativeResult = z.infer<typeof NegativeResultSchema>;

export const CampaignSchema = artifactEnvelope('research-campaign').extend({
  campaignId: z.string(),
  cellId: z.string(),
  goal: z.string(),
  coverageTarget: z.string(),
  targetGapIds: z.array(z.string()).min(1),
  hypotheses: z.array(SourceHypothesisSchema).default([]),
  negativeResults: z.array(NegativeResultSchema).default([]),
  status: z.enum(['planned', 'active', 'blocked_on_human', 'complete', 'halted']).default('planned'),
  /** Closure accounting: filled as approved claims land. */
  gapsClosed: z.array(z.object({
    gapId: z.string(),
    closedByClaimIds: z.array(z.string()).min(1)
  })).default([]),
  haltReason: z.string().optional()
});
export type Campaign = z.infer<typeof CampaignSchema>;

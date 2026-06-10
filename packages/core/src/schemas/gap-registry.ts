import { z } from 'zod';
import { artifactEnvelope } from './provenance';

/**
 * gap-registry: persistent, cross-run memory of evidence holes for a cell.
 * Collapses legacy research-gaps + query-plan and adds closure lineage.
 * Lives at the cell level (copied into runs, merged back), not per-run only.
 */

export const ResearchGapSchema = z.object({
  gapId: z.string(),
  cellId: z.string().optional(),
  gapType: z.enum([
    'under-supported-distribution',
    'missing-behavior-model',
    'missing-location-distribution',
    'visual-reference-without-support',
    'negative-constraint-not-enforced',
    'unsupported-weight',
    'missing-material-record',
    'unknown-signature-slot',
    'sampling-risk'
  ]),
  severity: z.enum(['low', 'medium', 'high']),
  affectedGrammarRefs: z.array(z.string()).default([]),
  question: z.string(),
  currentSupport: z.array(z.string()).default([]),
  missingSupport: z.array(z.string()).default([]),
  /** What evidence would close this gap — drives campaign hypothesis planning. */
  closureCriteria: z.string().optional(),
  recommendedSearches: z.array(z.string()).default([]),
  status: z.enum(['open', 'in_campaign', 'closed', 'wont_fix']).default('open'),
  closedByClaimIds: z.array(z.string()).default([]),
  firstSeenRunId: z.string().optional(),
  lastSeenRunId: z.string().optional()
});
export type ResearchGap = z.infer<typeof ResearchGapSchema>;

export const GapRegistrySchema = artifactEnvelope('gap-registry').extend({
  cellId: z.string().optional(),
  gaps: z.array(ResearchGapSchema).default([])
});
export type GapRegistry = z.infer<typeof GapRegistrySchema>;

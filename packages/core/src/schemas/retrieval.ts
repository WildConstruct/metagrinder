import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { RightsProfileSchema, SourceFamilySchema } from './vocabulary';

/**
 * retrieval: policy + candidates + ONE retrieval log.
 * Collapses the legacy eleven-artifact provider apparatus (preflight, request
 * shapes, response log, pilot report, proof report, error report, cache write,
 * readiness, safety report, contract, config-applied) into `RetrievalLogEntry`
 * with a `mode`/`event` pair. Reliability tooling returns only after a real
 * provider run exists (loop rule A4.5).
 *
 * Candidates are candidate-only: they cannot create sources, evidence, claims,
 * or revisions without the intake-approval gate.
 */

export const RetrievalPolicySchema = z.object({
  mode: z.enum(['off', 'dry-run', 'mock', 'cache-replay', 'fixture-live', 'live-one-query']).default('off'),
  maxQueries: z.number().int().positive().default(1),
  maxResultsPerQuery: z.number().int().positive().default(5),
  allowedDomains: z.array(z.string()).default([]),
  blockedDomains: z.array(z.string()).default([]),
  allowedSourceFamilies: z.array(SourceFamilySchema).default([])
});
export type RetrievalPolicy = z.infer<typeof RetrievalPolicySchema>;

export const RetrievalCandidateSchema = z.object({
  candidateId: z.string(),
  queryText: z.string(),
  gapIds: z.array(z.string()).default([]),
  hypothesisId: z.string().optional(),
  title: z.string(),
  url: z.string().optional(),
  snippet: z.string().optional(),
  sourceFamily: SourceFamilySchema.default('other'),
  sourceTypeGuess: z.string().optional(),
  publicationDateGuess: z.string().optional(),
  rightsProfileGuess: RightsProfileSchema.default('unknown'),
  rightsStatementVerbatim: z.string().optional(),
  providerId: z.string(),
  retrievedAt: z.string().datetime(),
  /** Deterministic check that the located item matches its hypothesis. */
  hypothesisMatch: z.enum(['unchecked', 'matched', 'mismatched']).default('unchecked')
});
export type RetrievalCandidate = z.infer<typeof RetrievalCandidateSchema>;

export const RetrievalLogEntrySchema = z.object({
  at: z.string().datetime(),
  mode: RetrievalPolicySchema.shape.mode,
  event: z.enum(['query', 'response', 'cache-read', 'cache-write', 'error', 'skipped']),
  providerId: z.string(),
  detail: z.string(),
  /** Secrets must be redacted before persistence; verified by test. */
  redacted: z.boolean().default(true)
});
export type RetrievalLogEntry = z.infer<typeof RetrievalLogEntrySchema>;

export const RetrievalSchema = artifactEnvelope('retrieval').extend({
  policy: RetrievalPolicySchema,
  candidates: z.array(RetrievalCandidateSchema).default([]),
  log: z.array(RetrievalLogEntrySchema).default([])
});
export type Retrieval = z.infer<typeof RetrievalSchema>;

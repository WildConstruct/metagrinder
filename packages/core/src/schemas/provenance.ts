import { z } from 'zod';
import {
  AttributionModeSchema,
  ConfidenceLevelSchema,
  EvidenceBasisSchema,
  ProvenanceVerificationSchema
} from './vocabulary';

/** Byte span into a source chunk's raw text: [start, end). */
export const TextSpanSchema = z.object({
  chunkId: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative()
}).refine((s) => s.end >= s.start, { message: 'span end must be >= start' });
export type TextSpan = z.infer<typeof TextSpanSchema>;

/**
 * The one provenance shape every derived record carries.
 * `verification` is set only by the deterministic verifier, never by the proposer:
 * quoted -> exact substring; paraphrased -> entailment; inferred -> reasoning note.
 */
export const ProvenanceSchema = z.object({
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([]),
  spans: z.array(TextSpanSchema).default([]),
  excerptText: z.string().optional(),
  attributionMode: AttributionModeSchema,
  evidenceBasis: EvidenceBasisSchema.default('inferred'),
  confidence: ConfidenceLevelSchema.default('low'),
  verification: ProvenanceVerificationSchema.default('unverified'),
  reasoningNote: z.string().optional()
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const WeightedRangeSchema = z.object({
  label: z.string(),
  min: z.number().min(0),
  max: z.number().min(0),
  unit: z.enum(['percent', 'weight']).default('percent'),
  confidence: ConfidenceLevelSchema.default('medium'),
  sourceInputIds: z.array(z.string()).default([]),
  sourceChunkIds: z.array(z.string()).default([])
}).refine((v) => v.max >= v.min, { message: 'weighted range max must be >= min' });
export type WeightedRange = z.infer<typeof WeightedRangeSchema>;

export const ExternalIdsSchema = z.object({
  gettyAatId: z.string().nullable().optional(),
  wikidataQid: z.string().nullable().optional(),
  institutionRecordId: z.string().nullable().optional(),
  europeanaRecordId: z.string().nullable().optional()
});
export type ExternalIds = z.infer<typeof ExternalIdsSchema>;

export const ConfidenceSummarySchema = z.object({
  overall: ConfidenceLevelSchema,
  extraction: ConfidenceLevelSchema.optional(),
  normalization: ConfidenceLevelSchema.optional(),
  provenance: ConfidenceLevelSchema.optional(),
  rights: ConfidenceLevelSchema.optional()
});
export type ConfidenceSummary = z.infer<typeof ConfidenceSummarySchema>;

/** Common envelope fields for every artifact file. */
export const artifactEnvelope = <T extends string>(family: T) =>
  z.object({
    artifact: z.literal(family),
    schemaVersion: z.string().default('0.1.0'),
    runId: z.string(),
    inputId: z.string(),
    createdAt: z.string().datetime()
  });

import { z } from 'zod';
import { ProvenanceSchema, artifactEnvelope } from './provenance';
import { AnalysisModeSchema, ConfidenceLevelSchema } from './vocabulary';

/**
 * extraction: claims, concepts, evidence excerpts, open questions, uncertainty spans.
 * Collapses legacy extract + classify + the review-stage mode/category artifacts.
 * `category` is an OPEN label from the source domain — the legacy closed enum of
 * Broadway-fixture categories is intentionally gone. Proposed taxonomies live in
 * `categories[]` so the reviewer can see the LLM's domain framing.
 */

export const ExtractedClaimSchema = z.object({
  claimId: z.string(),
  text: z.string().min(1),
  claimType: z.string().optional(),
  category: z.string(),
  confidence: ConfidenceLevelSchema,
  provenance: ProvenanceSchema
});
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const ConceptCandidateSchema = z.object({
  conceptId: z.string(),
  label: z.string().min(1),
  category: z.string(),
  summary: z.string().optional(),
  confidence: ConfidenceLevelSchema,
  provenance: ProvenanceSchema
});
export type ConceptCandidate = z.infer<typeof ConceptCandidateSchema>;

export const EvidenceExcerptSchema = z.object({
  evidenceId: z.string(),
  text: z.string().min(1),
  provenance: ProvenanceSchema
});
export type EvidenceExcerpt = z.infer<typeof EvidenceExcerptSchema>;

/** Hedge/speculation span detected in source text (cue + scope). */
export const UncertaintySpanSchema = z.object({
  uncertaintyId: z.string(),
  cue: z.string(),
  scopeText: z.string(),
  provenance: ProvenanceSchema
});
export type UncertaintySpan = z.infer<typeof UncertaintySpanSchema>;

export const OpenQuestionSchema = z.object({
  questionId: z.string(),
  text: z.string().min(1),
  provenance: ProvenanceSchema.optional()
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const ExtractionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  recordIds: z.array(z.string()).default([])
});
export type ExtractionWarning = z.infer<typeof ExtractionWarningSchema>;

export const ExtractionCategorySchema = z.object({
  category: z.string(),
  rationale: z.string().optional()
});

/**
 * What the LLM returns — semantic content only. The stage owns the envelope
 * (artifact/runId/createdAt) and analysisMode, so the model never invents them.
 */
export const ExtractionPayloadSchema = z.object({
  detectedResearchKind: z.string().optional(),
  categories: z.array(ExtractionCategorySchema).default([]),
  claims: z.array(ExtractedClaimSchema).default([]),
  concepts: z.array(ConceptCandidateSchema).default([]),
  evidence: z.array(EvidenceExcerptSchema).default([]),
  uncertaintySpans: z.array(UncertaintySpanSchema).default([]),
  openQuestions: z.array(OpenQuestionSchema).default([])
});
export type ExtractionPayload = z.infer<typeof ExtractionPayloadSchema>;

export const ExtractionSchema = artifactEnvelope('extraction').extend({
  analysisMode: AnalysisModeSchema,
  detectedResearchKind: z.string().optional(),
  categories: z.array(ExtractionCategorySchema).default([]),
  claims: z.array(ExtractedClaimSchema).default([]),
  concepts: z.array(ConceptCandidateSchema).default([]),
  evidence: z.array(EvidenceExcerptSchema).default([]),
  uncertaintySpans: z.array(UncertaintySpanSchema).default([]),
  openQuestions: z.array(OpenQuestionSchema).default([]),
  warnings: z.array(ExtractionWarningSchema).default([])
});
export type Extraction = z.infer<typeof ExtractionSchema>;

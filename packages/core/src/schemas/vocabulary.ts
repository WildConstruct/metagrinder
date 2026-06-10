import { z } from 'zod';

/**
 * Shared controlled vocabulary for every Metagrinder artifact.
 * Single source of truth (loop rule: no enum declared twice).
 * Aligned with Image_Prep_Research evidence-basis/gate/review vocabulary
 * and the UTDG application profile v1.
 */

export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const EvidenceBasisSchema = z.enum([
  'observed',
  'text_supported',
  'external_research',
  'proxy_analysis',
  'inferred',
  'generated'
]);
export type EvidenceBasis = z.infer<typeof EvidenceBasisSchema>;

export const AttributionModeSchema = z.enum([
  'quoted',
  'paraphrased',
  'inferred',
  'web_retrieved'
]);
export type AttributionMode = z.infer<typeof AttributionModeSchema>;

/** Result of deterministic per-mode attribution verification (AIS operationalized). */
export const ProvenanceVerificationSchema = z.enum([
  'unverified',
  'verified',
  'downgraded',
  'rejected'
]);
export type ProvenanceVerification = z.infer<typeof ProvenanceVerificationSchema>;

export const ReviewStatusSchema = z.enum([
  'draft',
  'private',
  'team',
  'staged',
  'needs_review',
  'approved',
  'merged',
  'rejected',
  'restricted'
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewTierSchema = z.enum([
  'none',
  'automated_internal',
  'batch_contact_sheet',
  'individual_human'
]);
export type ReviewTier = z.infer<typeof ReviewTierSchema>;

export const RightsProfileSchema = z.enum([
  'unknown',
  'public-domain',
  'unrestricted',
  'attribution-required',
  'non-commercial',
  'reference-only',
  'restricted'
]);
export type RightsProfile = z.infer<typeof RightsProfileSchema>;

/** Hard gates short-circuit; they are never averaged into scored confidence. */
export const GateStatusSchema = z.enum(['pending', 'pass', 'fail']);
export type GateStatus = z.infer<typeof GateStatusSchema>;

export const StageStateSchema = z.enum([
  'pending',
  'running',
  'blocked_on_gate',
  'failed',
  'complete'
]);
export type StageState = z.infer<typeof StageStateSchema>;

/** How an artifact's semantic content was produced. Degraded modes must be visible. */
export const AnalysisModeSchema = z.enum([
  'llm-semantic',
  'replayed-llm-semantic',
  'deterministic',
  'degraded-keyword',
  'human-authored'
]);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

export const ResearchKindSchema = z.enum([
  'historical-scene-research',
  'character-framework',
  'material-reference',
  'environment-observation',
  'style-analysis',
  'procedural-guide',
  'mixed',
  'unknown'
]);
export type ResearchKind = z.infer<typeof ResearchKindSchema>;

export const SourceTypeSchema = z.enum([
  'plain-text',
  'notes-bundle',
  'research-brief',
  'photo-reference'
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ChunkKindSchema = z.enum([
  'source-note',
  'observation',
  'photo-observation',
  'color-hypothesis',
  'wardrobe-observation',
  'concept-list',
  'generation-rule',
  'generation-palette',
  'template',
  'uncertainty',
  'reference-table',
  'visual-reference-caption',
  'negative-constraint',
  'ethical-constraint',
  'sample-output',
  'unknown'
]);
export type ChunkKind = z.infer<typeof ChunkKindSchema>;

/** Campaign source families. Open via 'other' + freeform familyNote on the hypothesis. */
export const SourceFamilySchema = z.enum([
  'commercial_print',
  'photography_collection',
  'newspaper',
  'institutional_collection',
  'other'
]);
export type SourceFamily = z.infer<typeof SourceFamilySchema>;

/** Co-occurrence basis for compatibility evidence (from the garment-graph roadmap). */
export const CoOccurrenceBasisSchema = z.enum([
  'worn_together_in_photo',
  'same_page_layout',
  'same_product_set',
  'text_stated',
  'curator_inferred',
  'not_applicable'
]);
export type CoOccurrenceBasis = z.infer<typeof CoOccurrenceBasisSchema>;

/** UTDG entity types staged for export (application profile v1 + v1.1 extension). */
export const UtdgEntityTypeSchema = z.enum([
  'Concept',
  'Archetype',
  'SourceRecordReference',
  'ColorHypothesis',
  'EvidenceAssertion',
  'CompatibilityRule',
  'Material',
  'Pattern',
  'Style',
  'ImageReference'
]);
export type UtdgEntityType = z.infer<typeof UtdgEntityTypeSchema>;

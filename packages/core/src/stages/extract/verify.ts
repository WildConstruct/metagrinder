import type { ConfidenceLevel, Provenance, SourceChunk, SourcePackage } from '../../schemas';

/**
 * Deterministic provenance verification (S3.2) — AIS ("attributable to
 * identified sources") operationalized. The LLM proposes; this checks. Nothing
 * is trusted on the model's say-so:
 *   - every cited chunkId must exist (else the record is REJECTED/dropped);
 *   - 'quoted' must be an exact substring of a cited chunk (else DOWNGRADED);
 *   - 'paraphrased' must be lexically grounded in a cited chunk (overlap proxy
 *     for NLI; weak grounding -> DOWNGRADED). A model-based entailment check is
 *     a future upgrade behind this same seam;
 *   - 'inferred' is never source-verified: it requires a reasoning note and is
 *     capped at low confidence.
 *
 * Returns a NEW provenance plus the record disposition. Pure.
 */

export type Disposition = 'verified' | 'downgraded' | 'rejected' | 'unverified';

export interface VerifyOutcome {
  provenance: Provenance;
  confidence: ConfidenceLevel;
  disposition: Disposition;
  warnings: string[];
}

const PARAPHRASE_OVERLAP_THRESHOLD = 0.6;

const normalizeWs = (s: string): string => s.replace(/\s+/g, ' ').trim();
const tokenize = (s: string): string[] => normalizeWs(s.toLowerCase()).split(/[^a-z0-9]+/).filter(Boolean);

function containmentOverlap(excerpt: string, chunkText: string): number {
  const exTokens = tokenize(excerpt);
  if (exTokens.length === 0) return 0;
  const chunkSet = new Set(tokenize(chunkText));
  const present = exTokens.filter((t) => chunkSet.has(t)).length;
  return present / exTokens.length;
}

const lower = (level: ConfidenceLevel): ConfidenceLevel => (level === 'high' ? 'medium' : 'low');

export function verifyProvenance(
  provenance: Provenance,
  declaredConfidence: ConfidenceLevel,
  excerptText: string,
  chunkById: Map<string, SourceChunk>
): VerifyOutcome {
  const warnings: string[] = [];
  const citedIds = provenance.sourceChunkIds;

  // 1. chunk-id existence
  const missing = citedIds.filter((id) => !chunkById.has(id));
  if (citedIds.length === 0 || missing.length > 0) {
    return {
      provenance: { ...provenance, verification: 'rejected' },
      confidence: 'low',
      disposition: 'rejected',
      warnings: [citedIds.length === 0 ? 'record cites no chunk' : `cites nonexistent chunk(s): ${missing.join(', ')}`]
    };
  }

  const citedTexts = citedIds.map((id) => chunkById.get(id)!.text);
  const excerpt = excerptText || provenance.excerptText || '';

  // 2. per-mode attribution check
  if (provenance.attributionMode === 'quoted') {
    const exNorm = normalizeWs(excerpt);
    const isSubstring = exNorm.length > 0 && citedTexts.some(
      (t) => t.includes(excerpt) || normalizeWs(t).includes(exNorm)
    );
    if (isSubstring) {
      return { provenance: { ...provenance, verification: 'verified' }, confidence: declaredConfidence, disposition: 'verified', warnings };
    }
    warnings.push('quoted excerpt is not a verbatim substring of any cited chunk — downgraded');
    return { provenance: { ...provenance, verification: 'downgraded', attributionMode: 'paraphrased' }, confidence: 'low', disposition: 'downgraded', warnings };
  }

  if (provenance.attributionMode === 'paraphrased' || provenance.attributionMode === 'web_retrieved') {
    const best = Math.max(0, ...citedTexts.map((t) => containmentOverlap(excerpt, t)));
    if (best >= PARAPHRASE_OVERLAP_THRESHOLD) {
      return { provenance: { ...provenance, verification: 'verified' }, confidence: declaredConfidence, disposition: 'verified', warnings };
    }
    warnings.push(`paraphrase weakly grounded in source (overlap ${best.toFixed(2)} < ${PARAPHRASE_OVERLAP_THRESHOLD}) — downgraded`);
    return { provenance: { ...provenance, verification: 'downgraded' }, confidence: lower(declaredConfidence), disposition: 'downgraded', warnings };
  }

  // 3. inferred: never source-verified; needs a reasoning note; capped low
  const conf: ConfidenceLevel = declaredConfidence === 'high' ? 'low' : declaredConfidence === 'medium' ? 'low' : declaredConfidence;
  if (!provenance.reasoningNote || provenance.reasoningNote.trim().length === 0) {
    warnings.push('inferred record without a reasoning note');
  }
  if (declaredConfidence === 'high') warnings.push('inferred record cannot be high confidence — capped to low');
  return { provenance: { ...provenance, verification: 'unverified' }, confidence: conf, disposition: 'unverified', warnings };
}

export function buildChunkIndex(sourcePackage: SourcePackage): Map<string, SourceChunk> {
  return new Map(sourcePackage.chunks.map((c) => [c.chunkId, c]));
}

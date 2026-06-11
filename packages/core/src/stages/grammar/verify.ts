import type { Provenance, SceneGrammarPayload, SourceChunk, SourcePackage } from '../../schemas';
import { buildChunkIndex } from '../extract/verify';

/**
 * Grammar draft verification (S3.3). Like extract, the LLM proposes a grammar
 * and this checks it before trust:
 *   - every record's provenance must cite existing chunks (else the record is
 *     dropped — an archetype with no real source has no place in the grammar);
 *   - arithmetic sanity: weight ranges are bounded and ordered; the archetype
 *     weight mass is sane (warn if midpoints sum far from 100%).
 *
 * Pure. Returns a cleaned payload, warnings, and a report. Contains NO domain
 * vocabulary — archetype/zone identities come only from the model (the
 * anti-regression guarantee verified by grammar-source-clean.test.ts).
 */

export interface GrammarReport {
  archetypesIn: number;
  archetypesKept: number;
  recordsDropped: number;
  warnings: string[];
}

function provenanceVerified(provenance: Provenance, chunkById: Map<string, SourceChunk>): { ok: boolean; missing: string[] } {
  const ids = provenance.sourceChunkIds;
  const missing = ids.filter((id) => !chunkById.has(id));
  return { ok: ids.length > 0 && missing.length === 0, missing };
}

const markVerified = (p: Provenance, ok: boolean): Provenance => ({ ...p, verification: ok ? 'verified' : 'rejected' });

export function verifyGrammarPayload(
  payload: SceneGrammarPayload,
  sourcePackage: SourcePackage
): { payload: SceneGrammarPayload; report: GrammarReport } {
  const chunkById = buildChunkIndex(sourcePackage);
  const warnings: string[] = [];
  let dropped = 0;

  // archetypes: provenance-gated; arithmetic-checked
  const archetypes = payload.archetypes.flatMap((a) => {
    const { ok, missing } = provenanceVerified(a.provenance, chunkById);
    if (!ok) {
      dropped++;
      warnings.push(`archetype ${a.archetypeId} dropped: provenance cites ${missing.length > 0 ? `nonexistent chunk(s) ${missing.join(', ')}` : 'no chunk'}`);
      return [];
    }
    if (a.weightRange && (a.weightRange.min < 0 || a.weightRange.max < a.weightRange.min)) {
      warnings.push(`archetype ${a.archetypeId} has an invalid weight range`);
    }
    return [{ ...a, provenance: markVerified(a.provenance, true) }];
  });

  const keepWithProv = <T extends { provenance: Provenance }>(items: T[], label: (t: T) => string): T[] =>
    items.flatMap((item) => {
      const { ok } = provenanceVerified(item.provenance, chunkById);
      if (!ok) { dropped++; warnings.push(`${label(item)} dropped: unverifiable provenance`); return []; }
      return [{ ...item, provenance: markVerified(item.provenance, true) }];
    });

  const locationZones = keepWithProv(payload.locationZones, (z) => `zone ${z.zoneId}`);
  const environmentalModifiers = keepWithProv(payload.environmentalModifiers, (m) => `modifier ${m.modifierId}`);
  const compatibilityRules = keepWithProv(payload.compatibilityRules, (r) => `rule ${r.ruleId}`);
  const negativeConstraints = keepWithProv(payload.negativeConstraints, (c) => `constraint ${c.constraintId}`);

  // arithmetic: archetype weight mass sanity (midpoints, percent)
  const massPct = archetypes.reduce((s, a) => s + (a.weightRange ? (a.weightRange.min + a.weightRange.max) / 2 : 0), 0);
  if (archetypes.length > 0 && (massPct < 40 || massPct > 200)) {
    warnings.push(`archetype weight mass is ${massPct.toFixed(0)}% — outside the sane 40–200% band`);
  }

  return {
    payload: { ...payload, archetypes, locationZones, environmentalModifiers, compatibilityRules, negativeConstraints },
    report: { archetypesIn: payload.archetypes.length, archetypesKept: archetypes.length, recordsDropped: dropped, warnings }
  };
}

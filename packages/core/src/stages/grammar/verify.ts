import { SceneGrammarPayloadSchema, type ConfidenceLevel, type Provenance, type SceneGrammarPayload, type SourceChunk, type SourcePackage } from '../../schemas';
import { buildChunkIndex, verifyProvenance, type VerifyOutcome } from '../extract/verify';

/**
 * Grammar draft verification (S3.3). Like extract, the LLM proposes a grammar
 * and this checks it before trust:
 *   - every family is checked against its cited chunks, including the required
 *     scene context (invalid context citations reject the draft);
 *   - quoted evidence and actual record text must both be attributable to the
 *     source. A genuine excerpt cannot certify unrelated grammar content;
 *   - lexical overlap cannot establish entailment for paraphrases. These and
 *     interpreted structures remain low-confidence and require source review;
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

function conservativeConfidence(left: ConfidenceLevel, right: ConfidenceLevel): ConfidenceLevel {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[left] <= rank[right] ? left : right;
}

type CitationIds = Pick<Provenance, 'sourceInputIds' | 'sourceChunkIds'>;

function identityWarnings(
  citations: CitationIds, sourceInputIds: Set<string>, chunkById: Map<string, SourceChunk>, required: boolean
): string[] {
  if (!required && citations.sourceInputIds.length === 0 && citations.sourceChunkIds.length === 0) return [];
  const warnings: string[] = [];
  const declaredInputs = new Set(citations.sourceInputIds);
  if (declaredInputs.size === 0) warnings.push('record declares no source input');
  for (const inputId of declaredInputs) {
    if (!sourceInputIds.has(inputId)) warnings.push(`declares nonexistent source input ${inputId}`);
  }
  for (const chunkId of citations.sourceChunkIds) {
    const chunk = chunkById.get(chunkId);
    if (!chunk) warnings.push(`cites nonexistent chunk ${chunkId}`);
    else if (!declaredInputs.has(chunk.sourceInputId)) {
      warnings.push(`cited chunk ${chunkId} belongs to undeclared source input ${chunk.sourceInputId}`);
    }
  }
  return warnings;
}

function verifyRecordContent(
  provenance: Provenance,
  confidence: ConfidenceLevel,
  content: Array<string | undefined>,
  chunkById: Map<string, SourceChunk>,
  interpretedStructure: boolean
): VerifyOutcome {
  const text = content.filter((value): value is string => value !== undefined && value.trim().length > 0);
  const declaredConfidence = conservativeConfidence(confidence, provenance.confidence);
  const evidence = verifyProvenance(provenance, declaredConfidence, provenance.excerptText ?? text[0] ?? '', chunkById);
  if (evidence.disposition === 'rejected' || provenance.attributionMode === 'inferred') return evidence;

  const contentChecks = text.map((value) => verifyProvenance(provenance, declaredConfidence, value, chunkById));
  const warnings = [...new Set([evidence, ...contentChecks].flatMap((check) => check.warnings))];
  const directlyQuoted = provenance.attributionMode === 'quoted'
    && evidence.disposition === 'verified'
    && text.length > 0
    && contentChecks.every((check) => check.disposition === 'verified')
    && !interpretedStructure;
  if (directlyQuoted) return { ...evidence, warnings };

  warnings.push(provenance.attributionMode === 'quoted' && !interpretedStructure
    ? 'grammar content is not fully attributable as quoted source text — source review required'
    : 'lexical overlap does not establish entailment for interpreted grammar content — source review required');
  return {
    provenance: {
      ...provenance,
      confidence: 'low',
      verification: 'downgraded',
      attributionMode: provenance.attributionMode === 'quoted' ? 'paraphrased' : provenance.attributionMode
    },
    confidence: 'low',
    disposition: 'downgraded',
    warnings
  };
}

export function verifyGrammarPayload(
  payload: SceneGrammarPayload,
  sourcePackage: SourcePackage
): { payload: SceneGrammarPayload; report: GrammarReport } {
  payload = SceneGrammarPayloadSchema.parse(payload);
  const chunkById = buildChunkIndex(sourcePackage);
  const sourceInputIds = new Set(sourcePackage.sourceInputs.map((source) => source.sourceInputId));
  const warnings: string[] = [];
  const reviewFlags = new Set(payload.reviewFlags);
  let dropped = 0;

  const checkRecord = <T extends { provenance: Provenance; confidence?: ConfidenceLevel }>(
    record: T, label: string, content: Array<string | undefined>, interpretedStructure = false,
    additionalCitations: CitationIds[] = []
  ): T | undefined => {
    const invalidIdentity = [
      ...identityWarnings(record.provenance, sourceInputIds, chunkById, true),
      ...additionalCitations.flatMap((citations) => identityWarnings(citations, sourceInputIds, chunkById, false))
    ];
    if (invalidIdentity.length > 0) {
      invalidIdentity.forEach((warning) => warnings.push(`${label}: ${warning}`));
      dropped++;
      return undefined;
    }
    const check = verifyRecordContent(record.provenance, record.confidence ?? record.provenance.confidence, content, chunkById, interpretedStructure);
    check.warnings.forEach((warning) => warnings.push(`${label}: ${warning}`));
    if (check.disposition === 'rejected') {
      dropped++;
      return undefined;
    }
    if (check.disposition !== 'verified') reviewFlags.add(`provenance-review:${label}`);
    return {
      ...record,
      provenance: check.provenance,
      ...('confidence' in record ? { confidence: check.confidence } : {})
    };
  };

  const keepRecords = <T extends { provenance: Provenance; confidence?: ConfidenceLevel }>(
    items: T[], label: (record: T) => string, content: (record: T) => Array<string | undefined>,
    interpretedStructure: (record: T) => boolean = () => false,
    additionalCitations: (record: T) => CitationIds[] = () => []
  ): T[] => items.flatMap((record) => {
      const verified = checkRecord(record, label(record), content(record), interpretedStructure(record), additionalCitations(record));
      return verified === undefined ? [] : [verified];
    });

  const sceneContext = checkRecord(payload.sceneContext, `scene context ${payload.sceneContext.contextId}`,
    [payload.sceneContext.title, payload.sceneContext.summary]);
  if (sceneContext === undefined) throw new Error('scene context rejected: invalid identified-source provenance');

  const archetypes = keepRecords(payload.archetypes, (a) => `archetype ${a.archetypeId}`,
    (a) => [a.label, a.summary, a.role, a.genderPresentation, a.classBand, a.raceEthnicityContext,
      a.promptText, ...a.dominantAttributes, ...a.optionalAttributes], (a) => a.weightRange !== undefined,
    (a) => a.weightRange ? [a.weightRange] : [])
    .map((a) => ({ ...a, ...(a.weightRange ? { weightRange: { ...a.weightRange,
      confidence: conservativeConfidence(a.weightRange.confidence, a.confidence) } } : {}) }));
  const demographicDistributions = keepRecords(payload.demographicDistributions, (d) => `distribution ${d.distributionId}`,
    (d) => [d.label, ...d.entries.map((entry) => entry.label)], (d) => d.entries.length > 0, (d) => d.entries)
    .map((d) => ({ ...d, entries: d.entries.map((entry) => ({ ...entry,
      confidence: conservativeConfidence(entry.confidence, d.provenance.confidence) })) }));
  const itemSystems = keepRecords(payload.itemSystems, (s) => `item system ${s.systemId}`,
    (s) => [s.label, ...s.items, ...s.avoidItems], (s) => s.avoidItems.length > 0);
  const locationZones = keepRecords(payload.locationZones, (z) => `zone ${z.zoneId}`,
    (z) => [z.label, z.promptText], (z) => z.archetypeBiases.length > 0, (z) => z.archetypeBiases)
    .map((z) => ({ ...z, archetypeBiases: z.archetypeBiases.map((bias) => ({ ...bias,
      confidence: conservativeConfidence(bias.confidence, z.provenance.confidence) })) }));
  const behaviorStates = keepRecords(payload.behaviorStates, (b) => `behavior ${b.behaviorId}`, (b) => [b.label, b.promptText]);
  const environmentalModifiers = keepRecords(payload.environmentalModifiers, (m) => `modifier ${m.modifierId}`, (m) => [m.label, m.promptText]);
  const visualReferences = keepRecords(payload.visualReferences, (v) => `visual reference ${v.referenceId}`,
    (v) => [v.caption, ...v.supports], (v) => v.supports.length > 0);
  const compatibilityRules = keepRecords(payload.compatibilityRules, (r) => `rule ${r.ruleId}`,
    (r) => [r.label, r.condition.value, ...r.effects.map((effect) => effect.target)], () => true);
  const negativeConstraints = keepRecords(payload.negativeConstraints, (c) => `constraint ${c.constraintId}`,
    (c) => [c.label, c.text, ...(c.enforcement ? [...c.enforcement.avoid, ...c.enforcement.allow,
      ...c.enforcement.force, ...c.enforcement.exclude] : [])],
    (c) => c.enforcement !== undefined || c.appliesTo.length > 0);

  // arithmetic: archetype weight mass sanity (midpoints, percent)
  const massPct = archetypes.reduce((s, a) => s + (a.weightRange ? (a.weightRange.min + a.weightRange.max) / 2 : 0), 0);
  if (archetypes.length > 0 && (massPct < 40 || massPct > 200)) {
    warnings.push(`archetype weight mass is ${massPct.toFixed(0)}% — outside the sane 40–200% band`);
  }

  return {
    payload: { ...payload, sceneContext, archetypes, demographicDistributions, itemSystems, locationZones,
      behaviorStates, environmentalModifiers, visualReferences, compatibilityRules, negativeConstraints,
      reviewFlags: [...reviewFlags] },
    report: { archetypesIn: payload.archetypes.length, archetypesKept: archetypes.length, recordsDropped: dropped, warnings }
  };
}

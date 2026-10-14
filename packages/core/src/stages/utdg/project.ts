import {
  UtdgCandidatesSchema,
  type Extraction,
  type Provenance,
  type SceneGrammar,
  type SourceLifecycle,
  type SourcePackage,
  type UtdgCandidate,
  type UtdgCandidates
} from '../../schemas';
import { toUtdgId } from './ids';
import {
  defaultResearchParseRights,
  intersectRightsProfiles,
  permitsCommercialUse,
  resolveRights,
  type RightsContext,
  type ResolvedRights
} from './rights';

/**
 * Pure projection: run artifacts → staged utdg-candidates (S5.2 Slice A).
 * No LLM. No canonical promotion. openQuestions stay out (gap-registry territory).
 *
 * Mapping (see stages/utdg/DECISIONS.md):
 *   source inputs          → SourceRecordReference
 *   extraction.evidence    → EvidenceAssertion (isEvidence)
 *   extraction.concepts    → Concept
 *   grammar.archetypes     → Archetype
 *   grammar.locationZones  → Concept (location_zone)
 *   grammar.itemSystems    → Concept (wardrobe/props items)
 *   grammar.compat rules   → CompatibilityRule (meta in summary)
 *   grammar.neg constraints→ CompatibilityRule (meta in summary)
 *   grammar.visual refs    → ImageReference (isEvidence=false)
 */

export interface ProjectUtdgArgs {
  sourcePackage: SourcePackage;
  grammar: SceneGrammar;
  extraction?: Extraction;
  /** Optional cell id (e.g. cell_1909_indianapolis_speedway). */
  cellId?: string;
  /** Shared rights context when the whole package has one license posture. */
  rights?: RightsContext;
  /** Current lifecycle is checked at export time; an aggregate license is insufficient. */
  sourceLifecycle?: SourceLifecycle;
  /** Explicit lineage bridge where content-hash input IDs differ from registered source IDs. */
  sourceIdsByInputId?: Readonly<Record<string, readonly string[]>>;
  runId?: string;
  inputId?: string;
  now: string;
}

function rightsFields(r: ResolvedRights): Pick<
  UtdgCandidate,
  'rightsProfile' | 'sourceRights' | 'contributionTerms' | 'rightsConfidence' | 'commercialAllowed' | 'reviewStatus'
> {
  return {
    rightsProfile: r.rightsProfile,
    sourceRights: r.sourceRights,
    contributionTerms: r.contributionTerms,
    rightsConfidence: r.rightsConfidence,
    commercialAllowed: r.commercialAllowed,
    reviewStatus: r.reviewStatus
  };
}

function chunkToSourceRef(sourcePackage: SourcePackage, chunkIds: string[]): string[] {
  const byChunk = new Map(sourcePackage.chunks.map((c) => [c.chunkId, c.sourceInputId]));
  const refs = new Set<string>();
  for (const id of chunkIds) {
    const inputId = byChunk.get(id);
    if (inputId) refs.add(toUtdgId('source', inputId));
  }
  return [...refs];
}

function evidenceIdsFromProvenance(p: Provenance, extraction: Extraction | undefined): string[] {
  // Prefer explicit extraction evidence ids when chunk-linked; else keep chunk ids as soft refs.
  if (!extraction) return p.sourceChunkIds.map((c) => toUtdgId('evidence', c));
  const fromChunks = new Set(p.sourceChunkIds);
  const matched = extraction.evidence
    .filter((e) => e.provenance.sourceChunkIds.some((c) => fromChunks.has(c)))
    .map((e) => toUtdgId('evidence', e.evidenceId));
  if (matched.length > 0) return matched;
  return p.sourceChunkIds.map((c) => toUtdgId('evidence', c));
}

function projectSources(sourcePackage: SourcePackage, rights: ResolvedRights): UtdgCandidate[] {
  return sourcePackage.sourceInputs.map((input) => ({
    id: toUtdgId('source', input.sourceInputId),
    entityType: 'SourceRecordReference' as const,
    prefLabel: input.title,
    summary: [
      `sourceType=${input.sourceType}`,
      input.path ? `path=${input.path}` : undefined
    ].filter(Boolean).join('; '),
    sourceRefs: [],
    evidenceRefs: [],
    sourceConceptRefs: [],
    altLabels: [],
    texturalQualities: [],
    usageContexts: [],
    isEvidence: false,
    confidence: 'medium' as const,
    ...rightsFields(rights)
  }));
}

function projectEvidence(extraction: Extraction, sourcePackage: SourcePackage, rights: ResolvedRights): UtdgCandidate[] {
  return extraction.evidence.map((ev) => ({
    id: toUtdgId('evidence', ev.evidenceId),
    entityType: 'EvidenceAssertion' as const,
    prefLabel: ev.text.length > 120 ? `${ev.text.slice(0, 117)}...` : ev.text,
    summary: ev.text,
    sourceRefs: chunkToSourceRef(sourcePackage, ev.provenance.sourceChunkIds),
    evidenceRefs: [],
    sourceConceptRefs: [],
    altLabels: [],
    texturalQualities: [],
    usageContexts: [],
    isEvidence: true,
    confidence: ev.provenance.confidence,
    provenance: ev.provenance,
    ...rightsFields(rights)
  }));
}

function projectConcepts(extraction: Extraction, sourcePackage: SourcePackage, rights: ResolvedRights): UtdgCandidate[] {
  return extraction.concepts.map((c) => ({
    id: toUtdgId('concept', c.conceptId),
    entityType: 'Concept' as const,
    prefLabel: c.label,
    conceptType: c.category,
    ...(c.summary !== undefined ? { summary: c.summary } : {}),
    sourceRefs: chunkToSourceRef(sourcePackage, c.provenance.sourceChunkIds),
    evidenceRefs: evidenceIdsFromProvenance(c.provenance, extraction),
    sourceConceptRefs: [],
    altLabels: [],
    texturalQualities: [],
    usageContexts: [],
    isEvidence: false,
    confidence: c.confidence,
    provenance: c.provenance,
    ...rightsFields(rights)
  }));
}

function projectArchetypes(
  grammar: SceneGrammar,
  sourcePackage: SourcePackage,
  extraction: Extraction | undefined,
  rights: ResolvedRights
): UtdgCandidate[] {
  return grammar.archetypes.map((a) => {
    const usage = [
      a.role ? `role:${a.role}` : undefined,
      a.genderPresentation ? `gender:${a.genderPresentation}` : undefined,
      a.classBand ? `class:${a.classBand}` : undefined,
      ...a.locationZoneRefs.map((z) => `zone:${z}`)
    ].filter((x): x is string => Boolean(x));

    return {
      id: toUtdgId('archetype', a.archetypeId),
      entityType: 'Archetype' as const,
      prefLabel: a.label,
      summary: a.summary,
      definition: a.promptText,
      sourceRefs: chunkToSourceRef(sourcePackage, a.provenance.sourceChunkIds),
      evidenceRefs: evidenceIdsFromProvenance(a.provenance, extraction),
      sourceConceptRefs: a.wardrobeRefs.map((w) => toUtdgId('concept', w)),
      altLabels: [],
      texturalQualities: [...a.dominantAttributes],
      usageContexts: usage,
      isEvidence: false,
      confidence: a.confidence,
      provenance: a.provenance,
      ...rightsFields(rights)
    };
  });
}

function projectZones(grammar: SceneGrammar, sourcePackage: SourcePackage, rights: ResolvedRights): UtdgCandidate[] {
  return grammar.locationZones.map((z) => ({
    id: toUtdgId('concept', `zone-${z.zoneId}`),
    entityType: 'Concept' as const,
    prefLabel: z.label,
    conceptType: 'location_zone',
    summary: z.promptText,
    sourceRefs: chunkToSourceRef(sourcePackage, z.provenance.sourceChunkIds),
    evidenceRefs: z.provenance.sourceChunkIds.map((c) => toUtdgId('evidence', c)),
    sourceConceptRefs: [],
    altLabels: [],
    texturalQualities: [],
    usageContexts: [`zone:${z.zoneId}`],
    isEvidence: false,
    confidence: 'medium' as const,
    provenance: z.provenance,
    ...rightsFields(rights)
  }));
}

/** Environmental modifiers → concepts so plan modifier slots have candidate targets. */
function projectModifiers(grammar: SceneGrammar, sourcePackage: SourcePackage, rights: ResolvedRights): UtdgCandidate[] {
  return grammar.environmentalModifiers.map((m) => ({
    id: toUtdgId('concept', `mod-${m.modifierId}`),
    entityType: 'Concept' as const,
    prefLabel: m.label,
    conceptType: 'environmental_modifier',
    summary: m.promptText,
    sourceRefs: chunkToSourceRef(sourcePackage, m.provenance.sourceChunkIds),
    evidenceRefs: m.provenance.sourceChunkIds.map((c) => toUtdgId('evidence', c)),
    sourceConceptRefs: [],
    altLabels: [],
    texturalQualities: [],
    usageContexts: [`modifier:${m.modifierId}`],
    isEvidence: false,
    confidence: 'medium' as const,
    provenance: m.provenance,
    ...rightsFields(rights)
  }));
}

function projectItemSystems(grammar: SceneGrammar, sourcePackage: SourcePackage, rights: ResolvedRights): UtdgCandidate[] {
  const out: UtdgCandidate[] = [];
  for (const sys of grammar.itemSystems) {
    for (const item of sys.items) {
      out.push({
        id: toUtdgId('concept', `${sys.systemId}-${item}`),
        entityType: 'Concept',
        prefLabel: item,
        conceptType: sys.kind,
        summary: `${sys.label}: ${item}`,
        sourceRefs: chunkToSourceRef(sourcePackage, sys.provenance.sourceChunkIds),
        evidenceRefs: sys.provenance.sourceChunkIds.map((c) => toUtdgId('evidence', c)),
        sourceConceptRefs: [],
        altLabels: [],
        texturalQualities: [],
        usageContexts: [`item-system:${sys.systemId}`, `kind:${sys.kind}`],
        isEvidence: false,
        confidence: 'medium',
        provenance: sys.provenance,
        ...rightsFields(rights)
      });
    }
  }
  return out;
}

/** v0.1: ruleType/subject/object/context encoded in summary (decision #3). */
function projectCompatibilityRules(
  grammar: SceneGrammar,
  sourcePackage: SourcePackage,
  rights: ResolvedRights
): UtdgCandidate[] {
  return grammar.compatibilityRules.map((r) => {
    const effectSummary = r.effects.map((e) => `${e.action}:${e.target}`).join(', ');
    const summary = [
      `ruleType=${r.effects[0]?.action ?? 'rule'}`,
      `subject=${r.condition.field}:${r.condition.operator}:${r.condition.value}`,
      `effects=${effectSummary}`,
      `label=${r.label}`
    ].join('; ');

    return {
      id: toUtdgId('rule', r.ruleId),
      entityType: 'CompatibilityRule' as const,
      prefLabel: r.label,
      summary,
      sourceRefs: chunkToSourceRef(sourcePackage, r.provenance.sourceChunkIds),
      evidenceRefs: r.provenance.sourceChunkIds.map((c) => toUtdgId('evidence', c)),
      sourceConceptRefs: [],
      altLabels: [],
      texturalQualities: [],
      usageContexts: [],
      coOccurrenceBasis: r.provenance.evidenceBasis === 'observed' ? 'worn_together_in_photo' as const
        : r.provenance.attributionMode === 'inferred' ? 'curator_inferred' as const
          : 'text_stated' as const,
      isEvidence: false,
      confidence: r.confidence,
      provenance: r.provenance,
      ...rightsFields(rights)
    };
  });
}

function projectNegativeConstraints(
  grammar: SceneGrammar,
  sourcePackage: SourcePackage,
  rights: ResolvedRights
): UtdgCandidate[] {
  return grammar.negativeConstraints.map((constraint) => {
    const avoid = constraint.enforcement?.avoid ?? [];
    const exclude = constraint.enforcement?.exclude ?? [];
    const summary = [
      `ruleType=incompatibleWith`,
      `constraintType=${constraint.constraintType}`,
      `subject=scene`,
      `object=${constraint.constraintId}`,
      avoid.length ? `avoid=${avoid.join('|')}` : undefined,
      exclude.length ? `exclude=${exclude.join('|')}` : undefined,
      constraint.text
    ].filter(Boolean).join('; ');

    return {
      id: toUtdgId('rule', constraint.constraintId),
      entityType: 'CompatibilityRule' as const,
      prefLabel: constraint.label,
      summary,
      definition: constraint.text,
      sourceRefs: chunkToSourceRef(sourcePackage, constraint.provenance.sourceChunkIds),
      evidenceRefs: constraint.provenance.sourceChunkIds.map((chunkId) => toUtdgId('evidence', chunkId)),
      sourceConceptRefs: [],
      altLabels: [],
      texturalQualities: [],
      usageContexts: [
        `constraint:${constraint.constraintType}`,
        ...constraint.appliesTo.map((a) => `appliesTo:${a}`)
      ],
      coOccurrenceBasis: 'not_applicable' as const,
      isEvidence: false,
      confidence: constraint.confidence,
      provenance: constraint.provenance,
      ...rightsFields(rights)
    };
  });
}

function projectVisualReferences(
  grammar: SceneGrammar,
  sourcePackage: SourcePackage,
  rights: ResolvedRights
): UtdgCandidate[] {
  return grammar.visualReferences.map((v) => {
    const refRights: ResolvedRights = {
      ...rights,
      rightsProfile: intersectRightsProfiles([rights.rightsProfile, v.rightsProfile]),
      sourceRights: v.rightsProfile === 'reference-only' ? 'reference-only' : rights.sourceRights,
      commercialAllowed: rights.commercialAllowed && permitsCommercialUse(v.rightsProfile)
    };
    return {
      id: toUtdgId('image', v.referenceId),
      entityType: 'ImageReference' as const,
      prefLabel: v.caption.length > 80 ? `${v.caption.slice(0, 77)}...` : v.caption,
      summary: v.caption,
      definition: v.path,
      sourceRefs: chunkToSourceRef(sourcePackage, v.provenance.sourceChunkIds),
      evidenceRefs: [],
      sourceConceptRefs: v.linkedArchetypeIds.map((a) => toUtdgId('archetype', a)),
      altLabels: [],
      texturalQualities: [],
      usageContexts: v.supports.map((s) => `supports:${s}`),
      isEvidence: false,
      confidence: 'medium' as const,
      provenance: v.provenance,
      ...rightsFields(refRights)
    };
  });
}

function dedupeById(candidates: UtdgCandidate[]): UtdgCandidate[] {
  const seen = new Map<string, UtdgCandidate>();
  for (const c of candidates) {
    if (!seen.has(c.id)) seen.set(c.id, c);
  }
  return [...seen.values()];
}

/** Recompute permission eligibility from current contributing sources on every export. */
function checkCurrentRights(candidates: UtdgCandidate[], args: ProjectUtdgArgs): UtdgCandidate[] {
  const inputIds = new Set(args.sourcePackage.sourceInputs.map((input) => input.sourceInputId));
  const inputByRef = new Map(args.sourcePackage.sourceInputs.map((input) => [
    toUtdgId('source', input.sourceInputId), input.sourceInputId
  ]));
  const inputByChunk = new Map(args.sourcePackage.chunks.map((chunk) => [chunk.chunkId, chunk.sourceInputId]));
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const lifecycle = args.sourceLifecycle;
  const sourcesById = new Map((lifecycle?.sources ?? []).map((source) => [source.sourceId, source]));

  return candidates.map((candidate) => {
    const contributingInputs = new Set<string>();
    const sourceIds = new Set<string>();
    const reasons = new Set<string>();
    const visited = new Set<string>();
    let unverified = false;
    let blocked = false;

    function collect(record: UtdgCandidate): void {
      if (visited.has(record.id)) return;
      visited.add(record.id);
      const ownInput = inputByRef.get(record.id);
      if (ownInput) contributingInputs.add(ownInput);
      for (const ref of record.sourceRefs) {
        const input = inputByRef.get(ref);
        if (input) contributingInputs.add(input);
        else if (sourcesById.has(ref)) sourceIds.add(ref);
        else {
          reasons.add(`source-reference-unmapped:${ref}`);
          unverified = true;
        }
      }
      for (const input of record.provenance?.sourceInputIds ?? []) contributingInputs.add(input);
      for (const chunkId of record.provenance?.sourceChunkIds ?? []) {
        const input = inputByChunk.get(chunkId);
        if (input) contributingInputs.add(input);
        else {
          reasons.add(`source-chunk-not-found:${chunkId}`);
          unverified = true;
        }
      }
      for (const ref of [...record.evidenceRefs, ...record.sourceConceptRefs]) {
        const dependency = candidateById.get(ref);
        let resolved = dependency !== undefined;
        if (dependency) collect(dependency);
        for (const evidence of lifecycle?.evidence ?? []) {
          if (ref === evidence.evidenceId || ref === toUtdgId('evidence', evidence.evidenceId)) {
            sourceIds.add(evidence.sourceId);
            resolved = true;
          }
        }
        if (!resolved) {
          reasons.add(`dependency-reference-unmapped:${ref}`);
          unverified = true;
        }
      }
    }
    collect(candidate);

    for (const inputId of contributingInputs) {
      if (!inputIds.has(inputId)) {
        reasons.add(`source-input-not-found:${inputId}`);
        unverified = true;
      }
      const explicitIds = args.sourceIdsByInputId?.[inputId];
      const mapped = new Set(explicitIds ?? []);
      // An explicit bridge supplements known lineage; it cannot erase restrictions.
      for (const id of [inputId, toUtdgId('source', inputId)]) {
        if (sourcesById.has(id)) mapped.add(id);
      }
      for (const evidence of lifecycle?.evidence ?? []) {
        if (evidence.provenance.sourceInputIds.includes(inputId)
          || evidence.provenance.sourceChunkIds.some((chunkId) => inputByChunk.get(chunkId) === inputId)) {
          mapped.add(evidence.sourceId);
        }
      }
      if (mapped.size === 0) {
        reasons.add(`source-lifecycle-unmapped:${inputId}`);
        unverified = true;
      }
      for (const sourceId of mapped) sourceIds.add(sourceId);
    }

    if (!lifecycle) {
      reasons.add('source-lifecycle-not-provided');
      unverified = true;
    } else {
      if (lifecycle.gates.rightsGate === 'fail') {
        reasons.add('source-lifecycle-rights-gate-failed');
        blocked = true;
      } else if (lifecycle.gates.rightsGate !== 'pass') {
        reasons.add('source-lifecycle-rights-gate-pending');
        unverified = true;
      }
      if (sourceIds.size === 0) {
        reasons.add('source-lineage-empty');
        unverified = true;
      }
      if (candidate.contributionTerms === 'private-only') {
        reasons.add('contribution-private-only');
        blocked = true;
      }
    }

    const currentSources = [];
    for (const sourceId of [...sourceIds].sort()) {
      const source = sourcesById.get(sourceId);
      if (!source) {
        reasons.add(`source-lifecycle-source-not-found:${sourceId}`);
        unverified = true;
        continue;
      }
      currentSources.push(source);
      if (source.retracted) {
        reasons.add(`source-retracted:${source.sourceId}`);
        blocked = true;
      }
      if (source.rightsProfile === 'restricted' || source.rightsProfile === 'reference-only') {
        reasons.add(`source-rights-${source.rightsProfile}:${source.sourceId}`);
        blocked = true;
      } else if (source.rightsProfile === 'unknown') {
        reasons.add(`source-rights-unknown:${source.sourceId}`);
        unverified = true;
      }
    }
    const rightsProfile = intersectRightsProfiles([
      candidate.rightsProfile,
      ...currentSources.map((source) => source.rightsProfile)
    ]);
    if (lifecycle && (candidate.rightsProfile === 'restricted' || candidate.rightsProfile === 'reference-only')) {
      reasons.add(`candidate-rights-${candidate.rightsProfile}`);
      blocked = true;
    } else if (candidate.rightsProfile === 'unknown') {
      reasons.add('candidate-rights-unknown');
      unverified = true;
    }
    const status = !lifecycle ? 'unverified' : blocked ? 'blocked' : unverified ? 'unverified' : 'eligible';
    return {
      ...candidate,
      rightsProfile,
      sourceRights: currentSources.length > 0
        ? currentSources.map((source) => `${source.sourceId}: ${source.rightsStatement ?? source.rightsProfile}`).join('; ')
        : candidate.sourceRights,
      rightsConfidence: unverified ? 'low' : candidate.rightsConfidence,
      commercialAllowed: status === 'eligible' && candidate.commercialAllowed && permitsCommercialUse(rightsProfile),
      reviewStatus: status === 'eligible' ? candidate.reviewStatus : 'needs_review',
      exportEligibility: {
        status, checkedAt: args.now, sourceIds: [...sourceIds].sort(), reasons: [...reasons].sort()
      }
    };
  });
}

export function projectUtdgCandidates(args: ProjectUtdgArgs): UtdgCandidates {
  const rights = args.rights ? resolveRights(args.rights) : defaultResearchParseRights();
  const { sourcePackage, grammar, extraction } = args;

  const candidates = dedupeById([
    ...projectSources(sourcePackage, rights),
    ...(extraction ? projectEvidence(extraction, sourcePackage, rights) : []),
    ...(extraction ? projectConcepts(extraction, sourcePackage, rights) : []),
    ...projectArchetypes(grammar, sourcePackage, extraction, rights),
    ...projectZones(grammar, sourcePackage, rights),
    ...projectModifiers(grammar, sourcePackage, rights),
    ...projectItemSystems(grammar, sourcePackage, rights),
    ...projectCompatibilityRules(grammar, sourcePackage, rights),
    ...projectNegativeConstraints(grammar, sourcePackage, rights),
    ...projectVisualReferences(grammar, sourcePackage, rights)
  ]);

  return UtdgCandidatesSchema.parse({
    artifact: 'utdg-candidates',
    runId: args.runId ?? grammar.runId,
    inputId: args.inputId ?? grammar.inputId,
    createdAt: args.now,
    ...(args.cellId !== undefined ? { cellId: args.cellId } : {}),
    candidates: checkCurrentRights(candidates, args)
  });
}

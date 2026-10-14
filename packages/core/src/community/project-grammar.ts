import type { Provenance, SceneGrammar, SourcePackage } from '../schemas';
import { SceneGrammarSchema } from '../schemas';
import type { CommunityJob } from '../schemas/community-job';

/**
 * Deterministic L0 grammar draft from a community job + ingested brief chunks.
 * analysisMode is always 'deterministic' — not LLM-semantic and not human-accepted.
 * Labels/prompts come only from job-authored fields (no fixture vocab tables).
 */

function slugPart(text: string, fallback: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return s.length > 0 ? s : fallback;
}

/** Structural list split on commas / semicolons / "and" — not a keyword taxonomy. */
export function splitSituationList(text: string): string[] {
  return text
    .split(/[,;]|\band\b/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function provenanceFromPackage(
  sourcePackage: SourcePackage,
  reasoningNote: string
): Provenance {
  const chunkIds = sourcePackage.chunks.map((c) => c.chunkId);
  const sourceInputIds = sourcePackage.sourceInputs.map((s) => s.sourceInputId);
  return {
    sourceInputIds,
    sourceChunkIds: chunkIds.slice(0, 8),
    spans: [],
    attributionMode: 'inferred',
    evidenceBasis: 'inferred',
    confidence: 'low',
    verification: 'unverified',
    reasoningNote
  };
}

export function projectCommunityJobToGrammar(args: {
  job: CommunityJob;
  sourcePackage: SourcePackage;
  runId: string;
  inputId: string;
  createdAt: string;
}): SceneGrammar {
  const { job, sourcePackage } = args;
  const prov = (note: string) => provenanceFromPackage(sourcePackage, note);

  const whoParts = splitSituationList(job.situation.who);
  const archetypeLabels =
    whoParts.length > 0
      ? whoParts
      : job.traits.length > 0
        ? job.traits.map((t) => t.label)
        : [`Participant in ${job.title}`];

  const n = archetypeLabels.length;
  const base = Math.max(5, Math.floor(80 / n));
  const archetypes = archetypeLabels.map((label, i) => {
    const archetypeId = `arch_${slugPart(label, String(i))}`;
    const traitHints = job.traits
      .filter((t) => t.targetSlots.includes('archetypes') || t.targetSlots.includes('item_wardrobe'))
      .map((t) => t.label);
    const promptBits = [
      label,
      job.situation.what,
      traitHints.slice(0, 2).join('; ')
    ].filter((b) => b.length > 0);
    return {
      archetypeId,
      label,
      summary: `${label} in ${job.situation.where}`,
      role: 'participant',
      weightRange: {
        label,
        min: base,
        max: base + 10,
        unit: 'percent' as const,
        confidence: 'low' as const
      },
      dominantAttributes: traitHints.slice(0, 4),
      optionalAttributes: [],
      wardrobeRefs: [],
      behaviorRefs: [],
      locationZoneRefs: [],
      promptText: promptBits.join(' — '),
      confidence: 'low' as const,
      provenance: prov(`L0 deterministic archetype from situation.who / traits (${label})`)
    };
  });

  const whereParts = splitSituationList(job.situation.where);
  const zoneLabels = whereParts.length > 0 ? whereParts : [job.situation.where];
  const locationZones = zoneLabels.map((label, i) => ({
    zoneId: `zone_${slugPart(label, String(i))}`,
    label,
    promptText: `${label}; ${job.situation.when}`,
    archetypeBiases: [],
    provenance: prov(`L0 deterministic zone from situation.where (${label})`)
  }));

  const howParts = splitSituationList(job.situation.how);
  const behaviorStates = (howParts.length > 0 ? howParts : [job.situation.how]).map((label, i) => ({
    behaviorId: `beh_${slugPart(label, String(i))}`,
    label,
    promptText: label,
    provenance: prov(`L0 deterministic behavior from situation.how (${label})`)
  }));

  const environmentalModifiers = [
    {
      modifierId: `mod_when_${slugPart(job.situation.when, 'era')}`,
      label: job.situation.when,
      promptText: job.situation.when,
      provenance: prov('L0 deterministic modifier from situation.when')
    },
    {
      modifierId: `mod_why_${slugPart(job.situation.why, 'purpose')}`,
      label: job.situation.why,
      promptText: job.situation.why,
      provenance: prov('L0 deterministic modifier from situation.why')
    }
  ];

  const wardrobeItems = job.traits
    .filter((t) => t.targetSlots.includes('item_wardrobe') || t.targetSlots.length === 0)
    .map((t) => t.label);
  const propItems = job.traits
    .filter((t) => t.targetSlots.includes('item_props_accessories'))
    .map((t) => t.label);

  const itemSystems = [
    {
      systemId: 'items_wardrobe',
      label: 'Wardrobe (L0 seed)',
      kind: 'wardrobe' as const,
      items: wardrobeItems,
      avoidItems: [],
      provenance: prov('L0 item system from traits targeting wardrobe')
    },
    {
      systemId: 'items_props',
      label: 'Props and accessories (L0 seed)',
      kind: 'props-and-accessories' as const,
      items: propItems,
      avoidItems: [],
      provenance: prov('L0 item system from traits targeting props')
    }
  ];

  type Neg = {
    constraintId: string;
    label: string;
    text: string;
    constraintType: 'negative' | 'ethical-historical' | 'ethical-historical-representation' | 'modern-artifact-risk' | 'compatibility';
    appliesTo: string[];
    enforcedByRuleIds: string[];
    confidence: 'low' | 'medium' | 'high';
    provenance: Provenance;
  };

  const negativeConstraints: Neg[] = job.hardConstraints.map((text, i) => ({
    constraintId: `neg_${i}_${slugPart(text, 'constraint')}`,
    label: text.slice(0, 80),
    text,
    constraintType: text.toLowerCase().includes('ethic') || text.toLowerCase().includes('portray')
      ? 'ethical-historical'
      : text.toLowerCase().includes('modern') || text.toLowerCase().includes('sci-fi')
        ? 'modern-artifact-risk'
        : 'negative',
    appliesTo: [],
    enforcedByRuleIds: [],
    confidence: 'medium',
    provenance: prov('L0 negative from job.hardConstraints')
  }));

  if (job.successCriteria.requireNegatives && negativeConstraints.length === 0) {
    negativeConstraints.push({
      constraintId: 'neg_placeholder_require_research',
      label: 'Block ungrounded cliché until research fills negatives',
      text: 'Do not invent period-incorrect or cliché visuals; research must supply real negatives.',
      constraintType: 'negative',
      appliesTo: [],
      enforcedByRuleIds: [],
      confidence: 'low',
      provenance: prov('L0 placeholder negative because requireNegatives and hardConstraints empty')
    });
  }

  const uncertainties = [
    'L0 deterministic draft: weights, roles, and prompts are job-seeded hypotheses, not verified claims.',
    ...job.coverageSeed
      .filter((s) => s.status === 'empty' || s.status === 'thin')
      .slice(0, 6)
      .map((s) => `Coverage weak: ${s.slot}${s.notes ? ` (${s.notes})` : ''}`)
  ];

  return SceneGrammarSchema.parse({
    artifact: 'scene-grammar',
    runId: args.runId,
    inputId: args.inputId,
    createdAt: args.createdAt,
    analysisMode: 'deterministic',
    grammarTarget: 'base',
    sceneContext: {
      contextId: `ctx_${job.jobId}`,
      title: job.title,
      researchKind: job.researchKind,
      summary: [
        job.situation.what,
        job.situation.where,
        job.situation.when,
        job.situation.why
      ].join(' | '),
      provenance: prov('L0 sceneContext from situation card')
    },
    archetypes,
    demographicDistributions: [],
    itemSystems,
    locationZones,
    behaviorStates,
    environmentalModifiers,
    visualReferences: [],
    compatibilityRules: [],
    negativeConstraints,
    uncertainties,
    reviewFlags: [
      'l0-deterministic-draft',
      'not-production-trusted',
      'requires-human-review-before-acceptance'
    ]
  });
}

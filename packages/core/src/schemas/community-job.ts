import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { ConfidenceLevelSchema, ResearchKindSchema } from './vocabulary';

/**
 * community-job: L0 agent-harness contract for grounded-realism community packages.
 * See docs/research/metagrinder-community-scaffold-v0.md
 */

export const CommunityStanceSchema = z.enum([
  /** Period/place/role-plausible generative description (v0 default). */
  'grounded_realism',
  /** Deferred: same scaffold, different rubric — not default. */
  'cultural_criticism'
]);
export type CommunityStance = z.infer<typeof CommunityStanceSchema>;

export const AgentTrustLevelSchema = z.enum([
  /** Research + draft only; cannot finalize approvals. */
  'L0_researcher',
  'L1_proposer',
  'L2_bounded_reviewer',
  'L3_trusted_operator'
]);
export type AgentTrustLevel = z.infer<typeof AgentTrustLevelSchema>;

export const SituationCardSchema = z.object({
  who: z.string().min(1),
  what: z.string().min(1),
  where: z.string().min(1),
  when: z.string().min(1),
  why: z.string().min(1),
  /** Norms / process / co-presence rules — drives compatibility + negatives. */
  how: z.string().min(1)
});
export type SituationCard = z.infer<typeof SituationCardSchema>;

/** Skeleton slots every community package should eventually cover. */
export const SkeletonSlotSchema = z.enum([
  'archetypes',
  'demographic_mix',
  'zones',
  'item_wardrobe',
  'item_grooming_hair',
  'item_props_accessories',
  'behaviors',
  'compatibility_rules',
  'negatives',
  'lod_far',
  'lod_mid',
  'lod_near',
  'environment_atmosphere'
]);
export type SkeletonSlot = z.infer<typeof SkeletonSlotSchema>;

export const TraitChannelSchema = z.enum([
  'identity',
  'silhouette',
  'material',
  'colorPattern',
  'spatialAttach',
  'coOccurrence',
  'exclusion',
  'frequency',
  'evidenceBasis',
  'promptRegister'
]);
export type TraitChannel = z.infer<typeof TraitChannelSchema>;

export const ChannelFillSchema = z.object({
  channel: TraitChannelSchema,
  status: z.enum(['empty', 'thin', 'filled', 'blocked']),
  summary: z.string().optional(),
  confidence: ConfidenceLevelSchema.optional()
});
export type ChannelFill = z.infer<typeof ChannelFillSchema>;

export const TraitRecordSchema = z.object({
  traitId: z.string(),
  label: z.string().min(1),
  /** Skeleton slots this trait primarily serves. */
  targetSlots: z.array(SkeletonSlotSchema).default([]),
  channels: z.array(ChannelFillSchema).default([]),
  evidenceBasis: z.enum([
    'observed',
    'text_supported',
    'external_research',
    'proxy_analysis',
    'inferred',
    'generated',
    'unknown'
  ]).default('unknown'),
  confidence: ConfidenceLevelSchema.default('low'),
  notes: z.string().optional()
});
export type TraitRecord = z.infer<typeof TraitRecordSchema>;

export const SlotCoverageStatusSchema = z.enum([
  'empty',
  'thin',
  'adequate',
  'strong',
  'not_applicable'
]);
export type SlotCoverageStatus = z.infer<typeof SlotCoverageStatusSchema>;

export const SlotCoverageEntrySchema = z.object({
  slot: SkeletonSlotSchema,
  status: SlotCoverageStatusSchema,
  /** 0–1 operator/agent priority for this job (1 = must research). */
  priority: z.number().min(0).max(1).default(0.5),
  notes: z.string().optional()
});
export type SlotCoverageEntry = z.infer<typeof SlotCoverageEntrySchema>;

export const ResearchTaskSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1),
  /** Why this research, in generative terms. */
  rationale: z.string().min(1),
  targetSlots: z.array(SkeletonSlotSchema).default([]),
  targetChannels: z.array(TraitChannelSchema).default([]),
  targetTraitIds: z.array(z.string()).default([]),
  suggestedSources: z.array(z.string()).default([]),
  /** Scored later by usefulness module; optional on authoring. */
  expectedValue: z.number().min(0).optional(),
  estimatedCost: z.number().min(0).optional(),
  score: z.number().optional(),
  status: z.enum(['proposed', 'active', 'done', 'deferred', 'exhausted']).default('proposed')
});
export type ResearchTask = z.infer<typeof ResearchTaskSchema>;

export const CommunityJobGoalsSchema = z.object({
  researchPackage: z.boolean().default(true),
  sceneGrammar: z.boolean().default(true),
  contentPlans: z.boolean().default(true),
  reviewHtml: z.boolean().default(true),
  utdgCandidates: z.boolean().default(false),
  nestedPsg: z.boolean().default(false)
});
export type CommunityJobGoals = z.infer<typeof CommunityJobGoalsSchema>;

/**
 * Authoring-time job definition (fixture or agent-emitted).
 * Not the same as a completed run package.
 */
export const CommunityJobSchema = z.object({
  artifact: z.literal('community-job'),
  schemaVersion: z.string().default('0.1.0'),
  jobId: z.string().min(1),
  title: z.string().min(1),
  stance: CommunityStanceSchema.default('grounded_realism'),
  trustLevel: AgentTrustLevelSchema.default('L0_researcher'),
  researchKind: ResearchKindSchema.default('historical-scene-research'),
  situation: SituationCardSchema,
  /** Hard constraints: rights, portrayal, branding (human-authored). */
  hardConstraints: z.array(z.string()).default([]),
  goals: CommunityJobGoalsSchema.default({}),
  /** Initial slot priorities / coverage hypotheses before any extract. */
  coverageSeed: z.array(SlotCoverageEntrySchema).default([]),
  /** Optional seed traits (may be empty at job authoring). */
  traits: z.array(TraitRecordSchema).default([]),
  /** Seed research tasks; usefulness module can re-rank / extend. */
  researchTasks: z.array(ResearchTaskSchema).default([]),
  successCriteria: z.object({
    /** Product bar: authentic + useful imagery (or prompts that enable it). */
    imageryBar: z.string().default(
      'Historically/situationally believable imagery that is production-useful (clear extras, authentic variety, clichés blocked).'
    ),
    minArchetypeFamilies: z.number().int().nonnegative().default(3),
    requireNegatives: z.boolean().default(true),
    requireProvenanceOnHighWeightTraits: z.boolean().default(true)
  }).default({}),
  notes: z.string().optional()
});
export type CommunityJob = z.infer<typeof CommunityJobSchema>;

/**
 * Runtime coverage + next-research snapshot produced by the harness (L0).
 */
export const CommunityCoverageReportSchema = artifactEnvelope('community-coverage-report').extend({
  jobId: z.string(),
  cellId: z.string().optional(),
  stance: CommunityStanceSchema.default('grounded_realism'),
  trustLevel: AgentTrustLevelSchema.default('L0_researcher'),
  coverage: z.array(SlotCoverageEntrySchema).default([]),
  traits: z.array(TraitRecordSchema).default([]),
  rankedResearchTasks: z.array(ResearchTaskSchema).default([]),
  /** Machine-readable next step for agents. */
  nextAction: z.object({
    kind: z.enum([
      'research_task',
      'ingest_more',
      'draft_grammar',
      'blocked_on_human',
      'draft_complete'
    ]),
    detail: z.string(),
    taskId: z.string().optional()
  }),
  /** L0: never claims production-trusted imagery. */
  productionTrusted: z.literal(false).default(false)
});
export type CommunityCoverageReport = z.infer<typeof CommunityCoverageReportSchema>;

import {
  CommunityCoverageReportSchema,
  type ChannelFill,
  type CommunityJob,
  type SlotCoverageEntry,
  type SkeletonSlot,
  type TraitRecord
} from '../schemas/community-job';

/**
 * Coverage matrix over community skeleton slots + trait channels (L0).
 */

const ALL_SLOTS: SkeletonSlot[] = [
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
];

const ALL_CHANNELS = [
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
] as const;

export function defaultChannelFills(
  overrides?: Partial<Record<(typeof ALL_CHANNELS)[number], ChannelFill['status']>>
): ChannelFill[] {
  return ALL_CHANNELS.map((channel) => ({
    channel,
    status: overrides?.[channel] ?? 'empty'
  }));
}

/** Merge job.coverageSeed with full skeleton; seed wins on status/priority. */
export function buildCoverageMatrix(job: CommunityJob): SlotCoverageEntry[] {
  const bySlot = new Map(job.coverageSeed.map((e) => [e.slot, e]));
  return ALL_SLOTS.map((slot) => {
    const seed = bySlot.get(slot);
    if (seed) return seed;
    return {
      slot,
      status: 'empty' as const,
      priority: defaultPriorityForSlot(slot),
      notes: 'No seed coverage; treat as research-open.'
    };
  });
}

function defaultPriorityForSlot(slot: SkeletonSlot): number {
  switch (slot) {
    case 'archetypes':
    case 'zones':
    case 'item_wardrobe':
    case 'negatives':
    case 'behaviors':
      return 0.9;
    case 'demographic_mix':
    case 'compatibility_rules':
    case 'environment_atmosphere':
    case 'lod_mid':
      return 0.7;
    case 'item_grooming_hair':
    case 'item_props_accessories':
    case 'lod_near':
      return 0.55;
    case 'lod_far':
      return 0.4;
    default:
      return 0.5;
  }
}

/** Empty + thin high-priority slots the agent should care about. */
export function weakSlots(coverage: SlotCoverageEntry[], minPriority = 0.5): SlotCoverageEntry[] {
  return coverage.filter(
    (e) =>
      e.priority >= minPriority
      && (e.status === 'empty' || e.status === 'thin')
  );
}

/** Channels still empty/thin on a trait. */
export function weakChannels(trait: TraitRecord): ChannelFill[] {
  const filled = new Map(trait.channels.map((c) => [c.channel, c]));
  return ALL_CHANNELS.map((channel) => {
    const existing = filled.get(channel);
    if (existing) return existing;
    return { channel, status: 'empty' as const };
  }).filter((c) => c.status === 'empty' || c.status === 'thin');
}

export function emptyChannelPressure(trait: TraitRecord): number {
  const weak = weakChannels(trait);
  // identity + frequency + coOccurrence + exclusion weigh more for imagery
  const weights: Record<string, number> = {
    identity: 1.2,
    silhouette: 1.1,
    material: 0.9,
    colorPattern: 0.8,
    spatialAttach: 0.7,
    coOccurrence: 1.2,
    exclusion: 1.3,
    frequency: 1.1,
    evidenceBasis: 1.0,
    promptRegister: 0.6
  };
  if (weak.length === 0) return 0;
  const sum = weak.reduce((s, c) => s + (weights[c.channel] ?? 1), 0);
  const max = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.min(1, sum / max);
}

export function buildL0CoverageReport(args: {
  job: CommunityJob;
  runId: string;
  now: string;
  cellId?: string;
  rankedResearchTasks: CommunityJob['researchTasks'];
}): ReturnType<typeof CommunityCoverageReportSchema.parse> {
  const coverage = buildCoverageMatrix(args.job);
  const weak = weakSlots(coverage);
  const topTask = args.rankedResearchTasks.find((t) => t.status === 'proposed' || t.status === 'active');

  let nextAction: {
    kind: 'research_task' | 'ingest_more' | 'draft_grammar' | 'blocked_on_human' | 'draft_complete';
    detail: string;
    taskId?: string;
  };

  if (args.job.trustLevel !== 'L0_researcher') {
    nextAction = {
      kind: 'blocked_on_human',
      detail: 'v0 harness only authorizes L0_researcher trust level.'
    };
  } else if (topTask && weak.length > 0) {
    nextAction = {
      kind: 'research_task',
      detail: `Highest-EV open task: ${topTask.title}`,
      taskId: topTask.taskId
    };
  } else if (weak.length === 0 && args.job.traits.length > 0) {
    nextAction = {
      kind: 'draft_grammar',
      detail: 'High-priority slots no longer empty/thin — draft grammar/axes from current traits (L0 draft only).'
    };
  } else if (args.job.traits.length === 0) {
    nextAction = {
      kind: 'ingest_more',
      detail: 'No traits yet — ingest deep-research notes or seed observations before expanding channels.'
    };
  } else {
    nextAction = {
      kind: 'draft_complete',
      detail: 'L0 draft coverage pass complete; production-trusted imagery still requires human review / gen QA.'
    };
  }

  return CommunityCoverageReportSchema.parse({
    artifact: 'community-coverage-report',
    runId: args.runId,
    inputId: args.job.jobId,
    createdAt: args.now,
    jobId: args.job.jobId,
    ...(args.cellId !== undefined ? { cellId: args.cellId } : {}),
    stance: args.job.stance,
    trustLevel: 'L0_researcher',
    coverage,
    traits: args.job.traits,
    rankedResearchTasks: args.rankedResearchTasks,
    nextAction,
    productionTrusted: false
  });
}

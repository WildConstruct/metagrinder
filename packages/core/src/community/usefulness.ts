import type {
  CommunityJob,
  ResearchTask,
  SlotCoverageEntry,
  TraitRecord
} from '../schemas/community-job';
import { emptyChannelPressure, weakSlots } from './coverage';

/**
 * Research-task usefulness scoring for L0 community jobs.
 * Research is useful when it fills empty generative channels/slots that improve
 * grounded-realism, production-useful imagery — not essay completeness.
 */

export interface UsefulnessBreakdown {
  slotPriority: number;
  emptyChannelPressure: number;
  authenticityImpact: number;
  imageryUtility: number;
  fillability: number;
  expectedValue: number;
  estimatedCost: number;
  score: number;
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Priority of target slots from coverage matrix (default 0.5). */
export function slotPriorityForTask(
  task: ResearchTask,
  coverage: SlotCoverageEntry[]
): number {
  if (task.targetSlots.length === 0) return 0.4;
  const bySlot = new Map(coverage.map((c) => [c.slot, c]));
  const prios = task.targetSlots.map((s) => {
    const entry = bySlot.get(s);
    if (!entry) return 0.5;
    // Empty high-priority slots boost more than filled ones
    const emptiness =
      entry.status === 'empty' ? 1 : entry.status === 'thin' ? 0.7 : entry.status === 'adequate' ? 0.25 : 0.1;
    return entry.priority * emptiness;
  });
  return clamp01(Math.max(...prios));
}

/**
 * Authenticity impact: tasks that mention cliché/block/period/rights language score higher.
 * Lightweight lexical prior for L0; replace with learned model later.
 */
export function authenticityImpactHeuristic(task: ResearchTask): number {
  const text = `${task.title} ${task.rationale} ${task.suggestedSources.join(' ')}`.toLowerCase();
  let score = 0.45;
  const boosts = [
    'period', 'era', 'anachron', 'cliché', 'cliche', 'authentic', 'archive',
    'catalog', 'photograph', 'uniform', 'regulation', 'regional', '196', '197', '199',
    'apollo', 'nasa', 'midwest', 'texas', 'festival'
  ];
  for (const b of boosts) {
    if (text.includes(b)) score += 0.05;
  }
  return clamp01(score);
}

/** Imagery utility: silhouettes, wardrobe, props, zones beat abstract sociology. */
export function imageryUtilityHeuristic(task: ResearchTask): number {
  const text = `${task.title} ${task.rationale}`.toLowerCase();
  let score = 0.4;
  const visual = [
    'wardrobe', 'clothing', 'hair', 'shoe', 'uniform', 'silhouette', 'color',
    'badge', 'headset', 'booth', 'stands', 'console', 'tee', 'denim', 'polyester',
    'accessory', 'prop', 'material', 'dress'
  ];
  for (const v of visual) {
    if (text.includes(v)) score += 0.06;
  }
  const abstract = ['sociology', 'theology', 'market analysis', 'abstract'];
  for (const a of abstract) {
    if (text.includes(a)) score -= 0.1;
  }
  return clamp01(score);
}

/** Fillability: suggested sources + concrete archives. */
export function fillabilityHeuristic(task: ResearchTask): number {
  if (task.suggestedSources.length === 0) return 0.35;
  const text = task.suggestedSources.join(' ').toLowerCase();
  let score = 0.5 + Math.min(0.3, task.suggestedSources.length * 0.08);
  if (text.includes('archive') || text.includes('loc') || text.includes('catalog') || text.includes('photo')) {
    score += 0.15;
  }
  return clamp01(score);
}

export function channelPressureForTask(task: ResearchTask, traits: TraitRecord[]): number {
  if (task.targetTraitIds.length === 0) {
    // No trait linkage — use weak global pressure if channels requested
    if (task.targetChannels.length === 0) return 0.5;
    return 0.65;
  }
  const pressures = task.targetTraitIds.map((id) => {
    const trait = traits.find((t) => t.traitId === id);
    if (!trait) return 0.5;
    return emptyChannelPressure(trait);
  });
  return clamp01(Math.max(...pressures));
}

export function scoreResearchTask(args: {
  task: ResearchTask;
  coverage: SlotCoverageEntry[];
  traits: TraitRecord[];
  /** Override cost; default from sources length. */
  estimatedCost?: number;
}): UsefulnessBreakdown {
  const slotPriority = slotPriorityForTask(args.task, args.coverage);
  const emptyChannelPressure = channelPressureForTask(args.task, args.traits);
  const authenticityImpact = authenticityImpactHeuristic(args.task);
  const imageryUtility = imageryUtilityHeuristic(args.task);
  const fillability = fillabilityHeuristic(args.task);
  const expectedValue =
    slotPriority
    * (0.35 + 0.65 * emptyChannelPressure)
    * authenticityImpact
    * imageryUtility
    * (0.5 + 0.5 * fillability);
  const estimatedCost = args.estimatedCost
    ?? Math.max(1, 1 + args.task.suggestedSources.length * 0.5);
  const score = expectedValue / estimatedCost;
  return {
    slotPriority,
    emptyChannelPressure,
    authenticityImpact,
    imageryUtility,
    fillability,
    expectedValue,
    estimatedCost,
    score
  };
}

/** Rank proposed/active tasks; annotate score fields. */
export function rankResearchTasks(job: CommunityJob, coverage: SlotCoverageEntry[]): ResearchTask[] {
  const open = job.researchTasks.filter(
    (t) => t.status === 'proposed' || t.status === 'active'
  );
  const scored = open.map((task) => {
    const breakdown = scoreResearchTask({
      task,
      coverage,
      traits: job.traits,
      ...(task.estimatedCost !== undefined ? { estimatedCost: task.estimatedCost } : {})
    });
    return {
      ...task,
      expectedValue: breakdown.expectedValue,
      estimatedCost: breakdown.estimatedCost,
      score: breakdown.score
    };
  });
  return scored.sort((a, b) => {
    const ds = (b.score ?? 0) - (a.score ?? 0);
    if (ds !== 0) return ds;
    return a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0;
  });
}

/** Suggest synthetic tasks for still-weak high-priority slots (L0 helper). */
export function suggestTasksForWeakSlots(
  coverage: SlotCoverageEntry[],
  existing: ResearchTask[]
): ResearchTask[] {
  const existingSlots = new Set(existing.flatMap((t) => t.targetSlots));
  const weak = weakSlots(coverage, 0.55).filter((s) => !existingSlots.has(s.slot));
  return weak.slice(0, 5).map((s, i) => ({
    taskId: `auto_slot_${s.slot}_${i}`,
    title: `Grounded-realism fill: ${s.slot}`,
    rationale: `Slot ${s.slot} is ${s.status} at priority ${s.priority}; fill descriptive channels for production-useful extras.`,
    targetSlots: [s.slot],
    targetChannels: [],
    targetTraitIds: [],
    suggestedSources: [],
    status: 'proposed' as const
  }));
}

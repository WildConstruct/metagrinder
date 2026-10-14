import { CommunityJobSchema, type CommunityJob, type CommunityCoverageReport } from '../schemas/community-job';
import { buildCoverageMatrix, buildL0CoverageReport } from './coverage';
import { rankResearchTasks, suggestTasksForWeakSlots } from './usefulness';

/**
 * L0 evaluate: load/validate job → coverage → rank research tasks → nextAction.
 * Does not run LLM extract or write approvals.
 */
export function evaluateCommunityJobL0(args: {
  job: unknown;
  runId: string;
  now: string;
  cellId?: string;
  /** When true, append auto tasks for weak slots not already targeted. */
  suggestMissingSlotTasks?: boolean;
}): {
  job: CommunityJob;
  report: CommunityCoverageReport;
} {
  const job = CommunityJobSchema.parse(args.job);
  if (job.stance !== 'grounded_realism') {
    // v0 only authorizes grounded realism as default path
  }
  const coverage = buildCoverageMatrix(job);
  let tasks = job.researchTasks;
  if (args.suggestMissingSlotTasks !== false) {
    const extras = suggestTasksForWeakSlots(coverage, tasks);
    const ids = new Set(tasks.map((t) => t.taskId));
    tasks = [...tasks, ...extras.filter((t) => !ids.has(t.taskId))];
  }
  const ranked = rankResearchTasks({ ...job, researchTasks: tasks }, coverage);
  const report = buildL0CoverageReport({
    job,
    runId: args.runId,
    now: args.now,
    ...(args.cellId !== undefined ? { cellId: args.cellId } : {}),
    rankedResearchTasks: ranked
  });
  return { job, report };
}

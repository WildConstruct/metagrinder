/**
 * Community scaffold (L0 agent harness).
 * Grounded-realism jobs, coverage matrix, research usefulness scoring, job runner.
 */

export {
  buildCoverageMatrix,
  buildL0CoverageReport,
  defaultChannelFills,
  weakSlots,
  weakChannels,
  emptyChannelPressure
} from './coverage';

export {
  scoreResearchTask,
  rankResearchTasks,
  suggestTasksForWeakSlots,
  slotPriorityForTask,
  authenticityImpactHeuristic,
  imageryUtilityHeuristic,
  fillabilityHeuristic,
  type UsefulnessBreakdown
} from './usefulness';

export { evaluateCommunityJobL0 } from './evaluate';

export { buildCommunityJobBriefText } from './brief';

export {
  projectCommunityJobToGrammar,
  splitSituationList
} from './project-grammar';

export {
  runCommunityJobL0,
  COMMUNITY_JOB_FILE,
  COMMUNITY_REPORT_FILE,
  PARSER_VERSION,
  type CommunityJobRunResult
} from './runner';

export {
  DEFAULT_FIXTURES_DIR,
  REPORT_FILE_NAME,
  argValue,
  argValues,
  hasFlag,
  normalizeArgv,
  listCommunityFixtures,
  resolveJobPath,
  loadCommunityJobJson,
  writeCoverageReport,
  evaluateJobToDisk,
  runCommunityCli
} from './cli';

import { evaluateCommunityJobL0 } from '../../../community/evaluate';
import type { CommunityJob, ResearchTask } from '../../../schemas/community-job';
import type { ResearchQuestionScenario } from '../../../schemas/research-question-scenario';

/**
 * Deterministic asker: scenario → synthetic community-job → L0 evaluate rank.
 */
export function scenarioToCommunityJob(scenario: ResearchQuestionScenario): CommunityJob {
  return {
    artifact: 'community-job',
    schemaVersion: '0.1.0',
    jobId: scenario.scenarioId,
    title: scenario.title,
    stance: 'grounded_realism',
    trustLevel: 'L0_researcher',
    researchKind: 'historical-scene-research',
    situation: scenario.situation,
    hardConstraints: scenario.hardConstraints,
    goals: {
      researchPackage: true,
      sceneGrammar: true,
      contentPlans: true,
      reviewHtml: false,
      utdgCandidates: false,
      nestedPsg: false
    },
    coverageSeed: scenario.coverageSeed,
    traits: scenario.traits,
    researchTasks: scenario.researchTasksSeed,
    successCriteria: {
      imageryBar: scenario.productionRequirements.join('; ') || scenario.characteristicFailure,
      minArchetypeFamilies: 3,
      requireNegatives: true,
      requireProvenanceOnHighWeightTraits: true
    },
    ...(scenario.notes !== undefined ? { notes: scenario.notes } : {})
  };
}

export function askDeterministic(args: {
  scenario: ResearchQuestionScenario;
  now?: string;
  suggestMissingSlotTasks?: boolean;
}): ResearchTask[] {
  const job = scenarioToCommunityJob(args.scenario);
  const { report } = evaluateCommunityJobL0({
    job,
    runId: `qe_${args.scenario.scenarioId}`,
    now: args.now ?? new Date().toISOString(),
    suggestMissingSlotTasks: args.suggestMissingSlotTasks !== false
  });
  return report.rankedResearchTasks;
}

export const DETERMINISTIC_ASKER_ID = 'deterministic-l0-usefulness';

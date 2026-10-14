import { z } from 'zod';
import type { LlmProvider } from '../../../providers';
import { ResearchTaskSchema, type ResearchTask } from '../../../schemas/community-job';
import type { ResearchQuestionScenario } from '../../../schemas/research-question-scenario';
import { buildCoverageMatrix } from '../../../community/coverage';
import { scenarioToCommunityJob } from './deterministic';

const LlmTasksPayloadSchema = z.object({
  tasks: z.array(ResearchTaskSchema).default([])
});

export function buildQuestionAskerPrompt(scenario: ResearchQuestionScenario): string {
  const job = scenarioToCommunityJob(scenario);
  const coverage = buildCoverageMatrix(job);
  const covLines = coverage
    .map((c) => `- ${c.slot}: ${c.status} (priority ${c.priority})${c.notes ? ` — ${c.notes}` : ''}`)
    .join('\n');
  return [
    'You are an L0 research-task proposer for grounded-realism crowd/production imagery.',
    'Propose the highest-EV research tasks only (not essays).',
    `Return at most ${scenario.k} tasks as JSON { "tasks": [ ... ] }.`,
    'Each task needs: taskId, title, rationale, targetSlots, targetChannels, suggestedSources, status="proposed".',
    'Prefer wardrobe, zones, props, negatives, LOD, plateable sources. Avoid living-person IDs, brand lockups, narrative-only sociology.',
    '',
    `SCENARIO: ${scenario.title}`,
    `WHO: ${scenario.situation.who}`,
    `WHAT: ${scenario.situation.what}`,
    `WHERE: ${scenario.situation.where}`,
    `WHEN: ${scenario.situation.when}`,
    `WHY: ${scenario.situation.why}`,
    `HOW: ${scenario.situation.how}`,
    '',
    'HARD CONSTRAINTS:',
    ...scenario.hardConstraints.map((c) => `- ${c}`),
    '',
    'PRODUCTION REQUIREMENTS:',
    ...scenario.productionRequirements.map((c) => `- ${c}`),
    '',
    'COVERAGE:',
    covLines,
    '',
    'Characteristic failure to avoid:',
    scenario.characteristicFailure
  ].join('\n');
}

export async function askWithLlm(args: {
  scenario: ResearchQuestionScenario;
  provider: LlmProvider;
}): Promise<ResearchTask[]> {
  const result = await args.provider.complete({
    stage: 'question-asker',
    prompt: buildQuestionAskerPrompt(args.scenario),
    schema: LlmTasksPayloadSchema,
    schemaName: 'research-tasks'
  });
  const tasks = result.data.tasks.map((t) => ({
    ...t,
    status: t.status === 'done' || t.status === 'deferred' || t.status === 'exhausted'
      ? 'proposed' as const
      : t.status
  }));
  return tasks.slice(0, args.scenario.k);
}

export function llmAskerId(providerId: string, model: string): string {
  return `llm:${providerId}:${model}`;
}

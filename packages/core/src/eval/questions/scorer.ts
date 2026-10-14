import type { ResearchTask } from '../../schemas/community-job';
import type {
  AntiQuestion,
  GoldGap,
  ResearchQuestionScenario
} from '../../schemas/research-question-scenario';
import type { QuestionScenarioScores } from '../../schemas/question-eval-report';

function clamp01(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function openTasks(tasks: ResearchTask[]): ResearchTask[] {
  return tasks.filter((t) => t.status === 'proposed' || t.status === 'active');
}

function taskHitsGap(task: ResearchTask, gap: GoldGap): boolean {
  if (!task.targetSlots.includes(gap.slot)) return false;
  if (gap.channels.length === 0) return true;
  if (task.targetChannels.length === 0) return true; // slot-level task OK
  return gap.channels.some((c) => task.targetChannels.includes(c));
}

function taskText(task: ResearchTask): string {
  return `${task.title} ${task.rationale} ${task.suggestedSources.join(' ')}`.toLowerCase();
}

/** Lightweight anti match: description/hints tokens in task text, plus kind-specific cues. */
export function taskMatchesAnti(task: ResearchTask, anti: AntiQuestion): boolean {
  const text = taskText(task);
  const hints = [
    ...anti.matchHints,
    ...anti.description.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 4)
  ].map((h) => h.toLowerCase());
  const hintHit = hints.some((h) => h.length > 3 && text.includes(h));

  const kindCues: Record<string, string[]> = {
    cliche_substitution: ['cliche', 'cliché', 'generic', 'stereotype', 'costume store'],
    decade_drift: ['modern', 'contemporary default', '2020', '2010s', 'smartphone'],
    cross_regional_conflation: ['wrong region', 'wrong country', 'conflate'],
    brand_dependence: ['trademark', 'logo lockup', 'branded merch as spine', 'mcdonald', 'nike'],
    living_person_id: ['named individual', 'celebrity face', 'private person', 'doxx', 'identify living'],
    political_flattening: ['propaganda only', 'single narrative', 'political flattening'],
    unfillable_source: ['everything online', 'impossible archive', 'all sources'],
    narrative_not_visual: ['essay', 'sociology only', 'narrative meaning', 'theme of', 'symbolism of'],
    named_venue_or_ip: ['named venue brand', 'franchise wordmark', 'copyrighted cabinet']
  };
  const cues = kindCues[anti.kind] ?? [];
  const kindHit = cues.some((c) => text.includes(c));

  // Strong: explicit living-person ask patterns
  if (anti.kind === 'living_person_id') {
    if (/\b(identify|name of|who is|portrait of)\b/.test(text) && /\b(person|individual|celebrity|player)\b/.test(text)) {
      return true;
    }
  }
  if (anti.kind === 'narrative_not_visual') {
    if (/\b(symbolism|ideology essay|cultural meaning only)\b/.test(text) && !/\b(wardrobe|silhouette|zone|prop|signage)\b/.test(text)) {
      return true;
    }
  }

  return hintHit || kindHit;
}

function rightsFail(task: ResearchTask, antis: AntiQuestion[]): boolean {
  const text = taskText(task);
  if (/\b(private (face|individual)|doxx|identify attendees by name)\b/.test(text)) return true;
  if (antis.some((a) => a.kind === 'living_person_id' && taskMatchesAnti(task, a))) return true;
  if (antis.some((a) => a.kind === 'brand_dependence' && taskMatchesAnti(task, a))) return true;
  if (antis.some((a) => a.kind === 'named_venue_or_ip' && taskMatchesAnti(task, a))) return true;
  return false;
}

function fillabilityFail(task: ResearchTask, scenario: ResearchQuestionScenario): boolean {
  const text = taskText(task);
  const scarce =
    scenario.hardConstraints.some((c) => /scarce|scarci|limited archive|fragmented|non-english|non english/i.test(c))
    || scenario.antiQuestions.some((a) => a.kind === 'unfillable_source');
  if (!scarce) return false;
  // Vague mega-search without source class discipline
  const vague = task.suggestedSources.length === 0 && /\b(everything|all archives|google everything)\b/.test(text);
  const antiFill = scenario.antiQuestions
    .filter((a) => a.kind === 'unfillable_source')
    .some((a) => taskMatchesAnti(task, a));
  return vague || antiFill;
}

export function computeComposite(s: Omit<QuestionScenarioScores, 'composite'>): number {
  const raw =
    0.35 * s.recallAtK
    + 0.25 * s.precisionAtK
    + 0.2 * (1 - s.antiRate)
    + 0.1 * (1 - s.fillabilityFailRate)
    + 0.1 * (1 - s.rightsFailRate)
    - s.scopePenalty;
  return clamp01(raw);
}

export function scoreQuestionProposals(args: {
  scenario: ResearchQuestionScenario;
  tasks: ResearchTask[];
  k?: number;
}): {
  scores: QuestionScenarioScores;
  topTaskIds: string[];
  goldHits: string[];
  antiHits: string[];
  notes: string[];
} {
  const k = args.k ?? args.scenario.k ?? 5;
  const open = openTasks(args.tasks);
  // Prefer pre-ranked order if scores present; else keep input order
  const ranked = [...open].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = ranked.slice(0, k);
  const topTaskIds = top.map((t) => t.taskId);
  const notes: string[] = [];

  const mustGaps = args.scenario.goldGaps.filter((g) => g.mustHitInTopK);
  const goldPool = mustGaps.length > 0 ? mustGaps : args.scenario.goldGaps;
  const hitGaps = goldPool.filter((g) => top.some((t) => taskHitsGap(t, g)));
  const goldHits = hitGaps.map((g) => g.slot);
  const recallAtK = goldPool.length === 0 ? 1 : hitGaps.length / goldPool.length;

  const precise = top.filter((t) => args.scenario.goldGaps.some((g) => taskHitsGap(t, g)));
  const precisionAtK = top.length === 0 ? 0 : precise.length / top.length;

  const antiHits: string[] = [];
  for (const t of top) {
    for (const a of args.scenario.antiQuestions) {
      if (taskMatchesAnti(t, a)) antiHits.push(`${t.taskId}:${a.id}`);
    }
  }
  const antiTaskCount = top.filter((t) =>
    args.scenario.antiQuestions.some((a) => taskMatchesAnti(t, a))
  ).length;
  const antiRate = top.length === 0 ? 0 : antiTaskCount / top.length;

  const fillFails = top.filter((t) => fillabilityFail(t, args.scenario)).length;
  const fillabilityFailRate = top.length === 0 ? 0 : fillFails / top.length;

  const rightsFails = top.filter((t) => rightsFail(t, args.scenario.antiQuestions)).length;
  const rightsFailRate = top.length === 0 ? 0 : rightsFails / top.length;

  const overflow = Math.max(0, open.length - 2 * k);
  const scopePenalty = clamp01(overflow / Math.max(1, 2 * k));
  if (overflow > 0) notes.push(`scope: ${open.length} open tasks > 2k=${2 * k}`);

  const partial = {
    recallAtK,
    precisionAtK,
    antiRate,
    fillabilityFailRate,
    rightsFailRate,
    scopePenalty
  };
  const scores: QuestionScenarioScores = {
    ...partial,
    composite: computeComposite(partial)
  };

  return { scores, topTaskIds, goldHits, antiHits, notes };
}

export function aggregateScores(list: QuestionScenarioScores[]): QuestionScenarioScores {
  if (list.length === 0) {
    return {
      recallAtK: 0,
      precisionAtK: 0,
      antiRate: 0,
      fillabilityFailRate: 0,
      rightsFailRate: 0,
      scopePenalty: 0,
      composite: 0
    };
  }
  const mean = (pick: (s: QuestionScenarioScores) => number) =>
    list.reduce((a, s) => a + pick(s), 0) / list.length;
  const partial = {
    recallAtK: mean((s) => s.recallAtK),
    precisionAtK: mean((s) => s.precisionAtK),
    antiRate: mean((s) => s.antiRate),
    fillabilityFailRate: mean((s) => s.fillabilityFailRate),
    rightsFailRate: mean((s) => s.rightsFailRate),
    scopePenalty: mean((s) => s.scopePenalty)
  };
  return { ...partial, composite: computeComposite(partial) };
}

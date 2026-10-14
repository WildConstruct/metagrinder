import type { CommunityJob } from '../schemas/community-job';

/**
 * Build a research-brief text from a community job (+ optional notes).
 * Deterministic assembly of author-supplied fields — not LLM extract.
 */
export function buildCommunityJobBriefText(args: {
  job: CommunityJob;
  extraNotes?: string[];
}): string {
  const { job } = args;
  const lines: string[] = [
    `# ${job.title}`,
    '',
    `Job id: ${job.jobId}`,
    `Stance: ${job.stance}`,
    `Trust level: ${job.trustLevel} (L0 runner does not auto-approve).`,
    `Research kind: ${job.researchKind}`,
    '',
    '## Situation (5W + How)',
    `Who: ${job.situation.who}`,
    `What: ${job.situation.what}`,
    `Where: ${job.situation.where}`,
    `When: ${job.situation.when}`,
    `Why: ${job.situation.why}`,
    `How: ${job.situation.how}`,
    '',
    '## Hard constraints',
    ...(job.hardConstraints.length > 0
      ? job.hardConstraints.map((c) => `- ${c}`)
      : ['- (none listed)']),
    '',
    '## Success criteria',
    job.successCriteria.imageryBar,
    `Min archetype families: ${job.successCriteria.minArchetypeFamilies}`,
    `Require negatives: ${job.successCriteria.requireNegatives}`,
    '',
    '## Traits (seed)',
  ];

  if (job.traits.length === 0) {
    lines.push('- (none yet)');
  } else {
    for (const t of job.traits) {
      lines.push(`### ${t.label} (${t.traitId})`);
      lines.push(`Evidence basis: ${t.evidenceBasis}; confidence: ${t.confidence}`);
      if (t.targetSlots.length > 0) {
        lines.push(`Target slots: ${t.targetSlots.join(', ')}`);
      }
      for (const ch of t.channels) {
        const summary = ch.summary ? ` — ${ch.summary}` : '';
        lines.push(`- channel ${ch.channel}: ${ch.status}${summary}`);
      }
      if (t.notes) lines.push(t.notes);
      lines.push('');
    }
  }

  lines.push('## Coverage seed');
  if (job.coverageSeed.length === 0) {
    lines.push('- (empty seed; runner fills matrix defaults)');
  } else {
    for (const s of job.coverageSeed) {
      const notes = s.notes ? ` — ${s.notes}` : '';
      lines.push(`- ${s.slot}: ${s.status} (priority ${s.priority})${notes}`);
    }
  }

  lines.push('', '## Research tasks (seed / ranked later)');
  if (job.researchTasks.length === 0) {
    lines.push('- (none)');
  } else {
    for (const t of job.researchTasks) {
      lines.push(`### ${t.title} (${t.taskId})`);
      lines.push(t.rationale);
      if (t.targetSlots.length > 0) lines.push(`Slots: ${t.targetSlots.join(', ')}`);
      if (t.targetChannels.length > 0) lines.push(`Channels: ${t.targetChannels.join(', ')}`);
      if (t.suggestedSources.length > 0) {
        lines.push('Suggested sources:');
        for (const s of t.suggestedSources) lines.push(`- ${s}`);
      }
      lines.push('');
    }
  }

  if (job.notes) {
    lines.push('## Job notes', job.notes, '');
  }

  const extras = (args.extraNotes ?? []).map((n) => n.trim()).filter(Boolean);
  if (extras.length > 0) {
    lines.push('## Additional research notes');
    for (const n of extras) {
      lines.push(n, '');
    }
  }

  lines.push(
    '## Runner note',
    'This brief is assembled from the community-job artifact for ingest.',
    'LLM extract is optional and blocked without a provider; L0 grammar draft is a deterministic projection of the job fields only.'
  );

  return `${lines.join('\n')}\n`;
}

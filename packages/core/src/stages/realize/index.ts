import { z } from 'zod';
import {
  type ContentPlan,
  type PlanSlot,
  type RealizedPrompt
} from '../../schemas';
import type { LlmProvider } from '../../providers';
import { faithfulnessGate } from './gate';

/**
 * Realization stage (S3.4): content plan → prose. Plans are canonical; prose is
 * derived and per-model. Every realization — deterministic template OR LLM
 * caption — passes through the same faithfulness gate. utdgRefs/evidenceRefs are
 * inherited from the plan slots so consumers never rejoin against the plan.
 */

export type RealizationProfile = 'caption-prose' | 'keyword-stack' | 'tag-stream';

const SLOT_ORDER: Record<string, number> = { subject: 0, role: 1, zone: 2, condition: 3, modifier: 4 };

function orderedSlots(plan: ContentPlan): PlanSlot[] {
  return [...plan.slots].sort((a, b) => (SLOT_ORDER[a.slotKind] ?? 9) - (SLOT_ORDER[b.slotKind] ?? 9));
}

function renderTemplate(plan: ContentPlan, profile: RealizationProfile): string {
  const slots = orderedSlots(plan);
  const values = slots.map((s) => s.value.trim()).filter(Boolean);
  if (profile === 'keyword-stack') return values.join(', ');
  if (profile === 'tag-stream') return values.map((v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).join(' ');
  // caption-prose: subject sentence, environment/zone as trailing clauses
  const [subject, ...rest] = values;
  return rest.length > 0 ? `${subject}, ${rest.join(', ')}.` : `${subject}.`;
}

function inheritedRefs(plan: ContentPlan): { utdgRefs: string[]; evidenceRefs: string[] } {
  return {
    utdgRefs: [...new Set(plan.slots.flatMap((s) => s.utdgRefs))],
    evidenceRefs: [...new Set(plan.slots.flatMap((s) => s.evidenceRefs))]
  };
}

function assemble(plan: ContentPlan, profile: RealizationProfile, text: string, modelFamilyHint?: string): RealizedPrompt {
  const gate = faithfulnessGate(plan, text);
  const refs = inheritedRefs(plan);
  return {
    promptId: `${plan.planId}__${profile}`,
    planId: plan.planId,
    realizationProfile: profile,
    text,
    faithfulness: { slotCoverage: gate.slotCoverage, unsupportedContent: gate.unsupportedContent, notes: gate.notes },
    utdgRefs: refs.utdgRefs,
    evidenceRefs: refs.evidenceRefs,
    ...(modelFamilyHint !== undefined ? { modelFamilyHint } : {})
  };
}

/** Deterministic template realization. Coverage is guaranteed by construction. */
export function realizeTemplate(plan: ContentPlan, profile: RealizationProfile): RealizedPrompt {
  return assemble(plan, profile, renderTemplate(plan, profile));
}

const CaptionSchema = z.object({ text: z.string().min(1) });

/**
 * LLM caption realization (fluent prose for LLM-encoder models). The model is
 * UNTRUSTED — its output runs through the same gate, so an LLM that drops a slot
 * or invents content produces a failing realization, not a silent one.
 */
export async function realizeWithProvider(args: {
  provider: LlmProvider;
  plan: ContentPlan;
  modelFamilyHint?: string;
}): Promise<RealizedPrompt> {
  const slotLines = orderedSlots(args.plan).map((s) => `- ${s.slotKind}: ${s.value}`).join('\n');
  const prompt = [
    'Write one fluent, natural image caption that includes every element below and adds nothing not listed.',
    'Return JSON: {"text": "..."}.',
    '',
    slotLines
  ].join('\n');
  const result = await args.provider.complete({ stage: 'realize', prompt, schema: CaptionSchema, schemaName: 'caption' });
  return assemble(args.plan, 'caption-prose', result.data.text, args.modelFamilyHint);
}

export { faithfulnessGate, gatePassed } from './gate';

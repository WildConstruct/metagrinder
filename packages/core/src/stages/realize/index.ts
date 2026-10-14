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

function orderedSlots(slots: PlanSlot[]): PlanSlot[] {
  return [...slots].sort((a, b) => (SLOT_ORDER[a.slotKind] ?? 9) - (SLOT_ORDER[b.slotKind] ?? 9));
}

function renderTemplate(inputSlots: PlanSlot[], profile: RealizationProfile): string {
  const slots = orderedSlots(inputSlots);
  const values = slots.map((s) => s.value.trim()).filter(Boolean);
  if (values.length === 0) return '';
  if (profile === 'keyword-stack') return values.join(', ');
  if (profile === 'tag-stream') return values.map((v) => v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')).join(' ');
  // caption-prose: subject sentence, environment/zone as trailing clauses
  const [subject, ...rest] = values;
  return rest.length > 0 ? `${subject}, ${rest.join(', ')}.` : `${subject}.`;
}

function inheritedRefs(plan: ContentPlan): { utdgRefs: string[]; evidenceRefs: string[] } {
  const slots = [...plan.slots, ...plan.negativeSlots];
  return {
    utdgRefs: [...new Set(slots.flatMap((s) => s.utdgRefs))],
    evidenceRefs: [...new Set(slots.flatMap((s) => s.evidenceRefs))]
  };
}

function assemble(plan: ContentPlan, profile: RealizationProfile, text: string, modelFamilyHint?: string): RealizedPrompt {
  const noteSlots = plan.negativeSlots.filter((slot) => slot.slotKind === 'constraint-note' || slot.slotKind === 'constraint-review');
  const constraintNotes = noteSlots.map((slot) => slot.value);
  const negativeText = renderTemplate(plan.negativeSlots.filter((slot) => !noteSlots.includes(slot)), profile);
  const gate = faithfulnessGate(plan, text, negativeText, constraintNotes);
  const refs = inheritedRefs(plan);
  return {
    promptId: `${plan.planId}__${profile}`,
    planId: plan.planId,
    realizationProfile: profile,
    text,
    ...(negativeText.length > 0 ? { negativeText } : {}),
    constraintNotes,
    faithfulness: { slotCoverage: gate.slotCoverage, unsupportedContent: gate.unsupportedContent, notes: gate.notes },
    utdgRefs: refs.utdgRefs,
    evidenceRefs: refs.evidenceRefs,
    ...(modelFamilyHint !== undefined ? { modelFamilyHint } : {})
  };
}

/** Deterministic literal slot realization; unstructured constraints still require review. */
export function realizeTemplate(plan: ContentPlan, profile: RealizationProfile): RealizedPrompt {
  return assemble(plan, profile, renderTemplate(plan.slots, profile));
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
  const slotLines = orderedSlots(args.plan.slots).map((s) => `- ${s.slotKind}: ${s.value}`).join('\n');
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

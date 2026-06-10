import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { GateStatusSchema } from './vocabulary';

/**
 * content-plans + realized-prompts: the plan-then-realize split.
 * Plans are canonical, deterministic (grammar + seed -> identical plan).
 * Realized prose is derived, per-model, and faithfulness-gated.
 * Mutation/rotation operate on plans, never on prose.
 */

export const PlanSlotSchema = z.object({
  slotId: z.string(),
  /** e.g. subject, age_sex, role, headwear, upper_body, lower_body, footwear, accessories, condition, zone, modifier, style */
  slotKind: z.string(),
  value: z.string(),
  weight: z.number().optional(),
  grammarRefs: z.array(z.string()).default([]),
  utdgRefs: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([])
});
export type PlanSlot = z.infer<typeof PlanSlotSchema>;

export const ContentPlanSchema = z.object({
  planId: z.string(),
  seed: z.number().int(),
  grammarTarget: z.enum(['base', 'accepted']),
  slots: z.array(PlanSlotSchema).min(1),
  negativeSlots: z.array(PlanSlotSchema).default([]),
  /** Rules checked at sampling time; plans violating hard rules are never emitted. */
  rulesApplied: z.array(z.string()).default([])
});
export type ContentPlan = z.infer<typeof ContentPlanSchema>;

export const RealizedPromptSchema = z.object({
  promptId: z.string(),
  planId: z.string(),
  /** e.g. caption-prose-flux, keyword-stack-sd15, tag-stream-danbooru */
  realizationProfile: z.string(),
  text: z.string().min(1),
  negativeText: z.string().optional(),
  faithfulness: z.object({
    slotCoverage: GateStatusSchema.default('pending'),
    unsupportedContent: GateStatusSchema.default('pending'),
    notes: z.array(z.string()).default([])
  }),
  modelFamilyHint: z.string().optional()
});
export type RealizedPrompt = z.infer<typeof RealizedPromptSchema>;

export const ContentPlansSchema = artifactEnvelope('content-plans').extend({
  grammarTarget: z.enum(['base', 'accepted']),
  plans: z.array(ContentPlanSchema).default([]),
  realized: z.array(RealizedPromptSchema).default([])
});
export type ContentPlans = z.infer<typeof ContentPlansSchema>;

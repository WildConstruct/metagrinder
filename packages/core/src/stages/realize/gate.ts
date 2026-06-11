import type { ContentPlan, GateStatus } from '../../schemas';

/**
 * Faithfulness gate (S3.4). The data-to-text literature's core finding is that
 * neural realization reliably injects unsupported content; this gate is the
 * standard mitigation, applied to ANY realization (template or LLM):
 *   - slot coverage: every plan slot's content must surface in the prose;
 *   - unsupported content: prose must not be dominated by content absent from
 *     the plan (a lexical proxy for NLI — a model-based entailment check is a
 *     future upgrade behind this same seam).
 *
 * Pure. Returns gate statuses + human-readable notes.
 */

export interface GateResult {
  slotCoverage: GateStatus;
  unsupportedContent: GateStatus;
  notes: string[];
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'with', 'to', 'for', 'is', 'are',
  'was', 'were', 'as', 'by', 'from', 'over', 'near', 'into', 'their', 'they', 'this', 'that',
  'who', 'which', 'while', 'amid', 'among', 'wearing', 'wears', 'wore', 'stands', 'standing'
]);

const tokenize = (s: string): string[] =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0 && !STOPWORDS.has(t));

const SLOT_COVERAGE_MIN = 0.5;
const UNSUPPORTED_MAX = 0.4;

export function faithfulnessGate(plan: ContentPlan, text: string): GateResult {
  const notes: string[] = [];
  const textTokens = tokenize(text);
  const textSet = new Set(textTokens);

  // 1. slot coverage — each slot's content tokens should appear in the prose
  let uncovered = 0;
  for (const slot of plan.slots) {
    const slotTokens = tokenize(slot.value);
    if (slotTokens.length === 0) continue;
    const present = slotTokens.filter((t) => textSet.has(t)).length;
    if (present / slotTokens.length < SLOT_COVERAGE_MIN) {
      uncovered++;
      notes.push(`slot ${slot.slotId} (${slot.slotKind}) under-covered in realization`);
    }
  }
  const slotCoverage: GateStatus = uncovered === 0 ? 'pass' : 'fail';

  // 2. unsupported content — tokens in the prose grounded in no slot
  const slotVocab = new Set(plan.slots.flatMap((s) => tokenize(s.value)));
  const contentTokens = textTokens;
  const unsupported = contentTokens.filter((t) => !slotVocab.has(t));
  const unsupportedFraction = contentTokens.length > 0 ? unsupported.length / contentTokens.length : 0;
  const unsupportedContent: GateStatus = unsupportedFraction <= UNSUPPORTED_MAX ? 'pass' : 'fail';
  if (unsupportedContent === 'fail') {
    notes.push(`realization adds unsupported content (${(unsupportedFraction * 100).toFixed(0)}% of tokens not in any slot)`);
  }

  return { slotCoverage, unsupportedContent, notes };
}

export function gatePassed(g: GateResult): boolean {
  return g.slotCoverage === 'pass' && g.unsupportedContent === 'pass';
}

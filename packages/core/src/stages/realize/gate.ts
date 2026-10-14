import type { ContentPlan, GateStatus } from '../../schemas';

/**
 * Faithfulness gate (S3.4). The data-to-text literature's core finding is that
 * neural realization can inject unsupported content; this gate is
 * applied to ANY realization (template or LLM). This bounded gate requires
 * literal content sequences, rejects any unplanned content token, and checks
 * negative targets and note carry-through separately. It does not establish
 * semantic entailment; unknown constraint meaning remains pending for review.
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
  'who', 'which', 'while', 'amid', 'among'
]);

const tokenize = (s: string): string[] =>
  (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => !STOPWORDS.has(token));

function containsSequence(haystack: string[], needle: string[]): boolean {
  return needle.length > 0 && haystack.some((_, start) => needle.every((token, offset) => haystack[start + offset] === token));
}

export function faithfulnessGate(plan: ContentPlan, text: string, negativeText?: string, constraintNotes: string[] = []): GateResult {
  const notes: string[] = ['Literal lexical checks only; passing does not establish semantic entailment.'];
  const textTokens = tokenize(text);
  const negativeTokens = tokenize(negativeText ?? '');
  const noteSlots = plan.negativeSlots.filter((slot) => slot.slotKind === 'constraint-note' || slot.slotKind === 'constraint-review');
  const negativeSlots = plan.negativeSlots.filter((slot) => !noteSlots.includes(slot));

  // 1. Each content sequence must remain intact; a token bag permits attribute swaps.
  let uncovered = 0;
  for (const slot of [...plan.slots, ...negativeSlots]) {
    const slotTokens = tokenize(slot.value);
    const surface = plan.slots.includes(slot) ? textTokens : negativeTokens;
    if (!containsSequence(surface, slotTokens)) {
      uncovered++;
      notes.push(`slot ${slot.slotId} (${slot.slotKind}) under-covered in realization`);
    }
  }
  if (JSON.stringify(constraintNotes) !== JSON.stringify(noteSlots.map((slot) => slot.value))) {
    uncovered++;
    notes.push('constraint notes were missing, reordered, or altered in realization');
  }
  const slotCoverage: GateStatus = uncovered === 0 ? 'pass' : 'fail';

  // 2. Positive and negative vocabularies never justify content on the other surface.
  const slotVocab = new Set(plan.slots.flatMap((s) => tokenize(s.value)));
  const negativeVocab = new Set(negativeSlots.flatMap((slot) => tokenize(slot.value)));
  const unsupported = [...textTokens.filter((token) => !slotVocab.has(token)),
    ...negativeTokens.filter((token) => !negativeVocab.has(token))];
  const contradictions = negativeSlots.filter((slot) => containsSequence(textTokens, tokenize(slot.value)));
  let unsupportedContent: GateStatus = unsupported.length === 0 && contradictions.length === 0 ? 'pass' : 'fail';
  if (unsupported.length > 0) notes.push(`realization adds unsupported content: ${[...new Set(unsupported)].join(', ')}`);
  for (const slot of contradictions) notes.push(`realization includes prohibited negative target ${slot.slotId}`);
  if (plan.negativeSlots.some((slot) => slot.slotKind === 'constraint-review')) {
    notes.push('unstructured constraint enforcement requires human review; note preservation is not enforcement');
    if (unsupportedContent === 'pass') unsupportedContent = 'pending';
  }

  return { slotCoverage, unsupportedContent, notes };
}

export function gatePassed(g: GateResult): boolean {
  return g.slotCoverage === 'pass' && g.unsupportedContent === 'pass';
}

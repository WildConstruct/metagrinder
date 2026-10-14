import { ContentPlanSchema, type ContentPlan } from '../../schemas';
import type { LlmProvider } from '../../providers';
import { faithfulnessGate, gatePassed, realizeTemplate, realizeWithProvider } from './index';

function plan(values = ['red wool coat'], negatives: Array<{ value: string; slotKind?: string }> = []): ContentPlan {
  return ContentPlanSchema.parse({ planId: 'literal-plan', seed: 1, grammarTarget: 'base',
    slots: values.map((value, index) => ({ slotId: `positive_${index}`, slotKind: 'subject', value })),
    negativeSlots: negatives.map((negative, index) => ({ slotId: `negative_${index}`,
      slotKind: negative.slotKind ?? 'negative', value: negative.value,
      grammarRefs: ['negativeConstraints.exclusion'], utdgRefs: ['utdg:rule:exclusion'], evidenceRefs: ['negative-source'] })),
    rulesApplied: [] });
}

describe('S-R3 conservative literal faithfulness', () => {
  test('substituting an attribute cannot pass by preserving the remaining tokens', () => {
    const gate = faithfulnessGate(plan(), 'blue wool coat');
    expect(gate.slotCoverage).toBe('fail');
    expect(gate.unsupportedContent).toBe('fail');
  });

  test('a single unsupported object is rejected rather than averaged away', () => {
    expect(faithfulnessGate(plan(), 'red wool coat pistol').unsupportedContent).toBe('fail');
  });

  test('swapping attributes between slots fails even when the bag of words is unchanged', () => {
    expect(faithfulnessGate(plan(['red coat', 'blue hat']), 'blue coat, red hat').slotCoverage).toBe('fail');
  });

  test('literal preservation with function words and punctuation passes without claiming entailment', () => {
    const gate = faithfulnessGate(plan(), 'A red wool coat.');
    expect(gatePassed(gate)).toBe(true);
    expect(gate.notes.some((note) => /lexical|literal/.test(note) && /entailment|semantic/.test(note))).toBe(true);
  });

  test('an empty slot cannot silently satisfy coverage', () => {
    expect(faithfulnessGate(plan([' ']), '.').slotCoverage).toBe('fail');
  });

  test('missing negative output fails coverage', () => {
    expect(faithfulnessGate(plan(['red wool coat'], [{ value: 'laser pistols' }]), 'red wool coat').slotCoverage).toBe('fail');
  });

  test('negative surfaces reject unsupported details and positive/negative contradictions', () => {
    const p = plan(['red wool coat'], [{ value: 'laser pistols' }]);
    expect(faithfulnessGate(p, 'red wool coat', 'laser pistols, helicopters').unsupportedContent).toBe('fail');
    const conflict = plan(['red wool coat and laser pistols'], [{ value: 'laser pistols' }]);
    expect(faithfulnessGate(conflict, 'red wool coat and laser pistols', 'laser pistols').unsupportedContent).toBe('fail');
  });

  test.each(['caption-prose', 'keyword-stack', 'tag-stream'] as const)('%s renders every negative slot and inherits its refs', (profile) => {
    const p = plan(['red wool coat'], [{ value: 'laser pistols' }, { value: 'Avoid laser pistols.', slotKind: 'constraint-note' }]);
    const rendered = realizeTemplate(p, profile);
    expect(rendered.negativeText).toBeDefined();
    expect(rendered.negativeText!.toLowerCase().replace(/_/g, ' ')).toContain('laser pistols');
    expect(rendered.negativeText!.toLowerCase().replace(/_/g, ' ')).not.toContain('avoid laser pistols');
    expect(rendered.constraintNotes).toEqual(['Avoid laser pistols.']);
    expect(rendered.faithfulness.slotCoverage).toBe('pass');
    expect(rendered.faithfulness.unsupportedContent).toBe('pass');
    expect(rendered.utdgRefs).toContain('utdg:rule:exclusion');
    expect(rendered.evidenceRefs).toContain('negative-source');
  });

  test('unstructured constraints remain notes requiring review rather than becoming exclusions', () => {
    const p = plan(['red wool coat'], [{ value: 'A wool coat must remain present.', slotKind: 'constraint-review' }]);
    const rendered = realizeTemplate(p, 'keyword-stack');
    expect(rendered.negativeText).toBeUndefined();
    expect(rendered.constraintNotes).toEqual(['A wool coat must remain present.']);
    expect(rendered.faithfulness.unsupportedContent).toBe('pending');
    expect(rendered.faithfulness.notes.some((note) => /review/.test(note))).toBe(true);
  });

  test('missing or altered constraint notes fail note coverage', () => {
    const p = plan(['red wool coat'], [{ value: 'Keep a supported rule visible.', slotKind: 'constraint-note' }]);
    expect(faithfulnessGate(p, 'red wool coat', undefined, []).slotCoverage).toBe('fail');
    expect(faithfulnessGate(p, 'red wool coat', undefined, ['A different note.']).slotCoverage).toBe('fail');
  });

  test('tag output preserves non-ASCII source content', () => {
    const rendered = realizeTemplate(plan(['着物と帽子']), 'tag-stream');
    expect(rendered.text).toContain('着物と帽子');
    expect(rendered.faithfulness.slotCoverage).toBe('pass');
  });

  test('the local LLM seam inherits deterministic negative text and gates contradictory captions', async () => {
    let caption = 'red wool coat';
    const provider: LlmProvider = { id: 'test-local', model: 'local',
      async complete(request) {
        const raw = JSON.stringify({ text: caption });
        return { data: request.schema.parse({ text: caption }), raw, cacheKey: 'test', provider: 'test-local', model: 'local', replayed: true };
      } };
    const p = plan(['red wool coat'], [{ value: 'laser pistols' }]);
    const rendered = await realizeWithProvider({ provider, plan: p });
    expect(rendered.negativeText).toContain('laser pistols');
    expect(rendered.faithfulness.slotCoverage).toBe('pass');
    caption = 'blue wool coat with laser pistols';
    const unfaithful = await realizeWithProvider({ provider, plan: p });
    expect(unfaithful.faithfulness.slotCoverage).toBe('fail');
    expect(unfaithful.faithfulness.unsupportedContent).toBe('fail');
  });
});

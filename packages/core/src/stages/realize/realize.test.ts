import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ContentPlan } from '../../schemas';
import { createCachingProvider, type Transport } from '../../providers';
import { faithfulnessGate, gatePassed, realizeTemplate, realizeWithProvider } from './index';

const NOW = () => '2026-06-10T12:00:00.000Z';

function plan(): ContentPlan {
  return {
    planId: 'plan_1', seed: 1, grammarTarget: 'base',
    slots: [
      { slotId: 'plan_1_subject', slotKind: 'subject', value: 'adult spectator in a wool overcoat', grammarRefs: ['archetypes.a'], utdgRefs: ['utdg:archetype:a'], evidenceRefs: ['chunk_1'] },
      { slotId: 'plan_1_zone', slotKind: 'zone', value: 'at the crowded grandstand rail', grammarRefs: ['locationZones.rail'], utdgRefs: ['utdg:concept:rail'], evidenceRefs: ['chunk_2'] }
    ],
    negativeSlots: [], rulesApplied: []
  };
}

describe('faithfulness gate (S3.4)', () => {
  const p = plan();

  test('[AC-3.4a] passes a faithful realization', () => {
    const g = faithfulnessGate(p, 'adult spectator in a wool overcoat, at the crowded grandstand rail.');
    expect(gatePassed(g)).toBe(true);
  });

  test('[AC-3.4a] fails when a plan slot is missing from the prose', () => {
    const g = faithfulnessGate(p, 'adult spectator in a wool overcoat.'); // zone dropped
    expect(g.slotCoverage).toBe('fail');
    expect(g.notes.some((n) => /zone/.test(n))).toBe(true);
  });

  test('[AC-3.4a] fails when the prose adds unsupported content', () => {
    const g = faithfulnessGate(p, 'adult spectator wool overcoat grandstand rail brandishing a neon laser sword beside chromium hovercars and holographic billboards downtown');
    expect(g.unsupportedContent).toBe('fail');
    expect(g.notes.some((n) => /unsupported content/.test(n))).toBe(true);
  });
});

describe('template realization (S3.4)', () => {
  const p = plan();

  test('three profiles render and all pass the gate by construction', () => {
    for (const profile of ['caption-prose', 'keyword-stack', 'tag-stream'] as const) {
      const r = realizeTemplate(p, profile);
      expect(r.realizationProfile).toBe(profile);
      expect(r.faithfulness.slotCoverage).toBe('pass');
      expect(r.faithfulness.unsupportedContent).toBe('pass');
    }
  });

  test('profiles differ in surface form', () => {
    expect(realizeTemplate(p, 'keyword-stack').text).toContain(',');
    expect(realizeTemplate(p, 'tag-stream').text).toMatch(/_/);
    expect(realizeTemplate(p, 'caption-prose').text).toMatch(/\.$/);
  });

  test('[AC-3.4b] utdgRefs and evidenceRefs are inherited from plan slots', () => {
    const r = realizeTemplate(p, 'caption-prose');
    expect(r.utdgRefs.sort()).toEqual(['utdg:archetype:a', 'utdg:concept:rail']);
    expect(r.evidenceRefs.sort()).toEqual(['chunk_1', 'chunk_2']);
    expect(r.planId).toBe('plan_1');
  });
});

describe('LLM caption realization is gated (S3.4)', () => {
  function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-realize-')); }

  test('a faithful model caption passes the gate', async () => {
    const transport: Transport = async () => ({ rawText: '{"text":"An adult spectator in a wool overcoat at the crowded grandstand rail."}' });
    const provider = createCachingProvider({ runDir: tmp(), transport, providerId: 'fake', model: 'm', mode: 'record', now: NOW });
    const r = await realizeWithProvider({ provider, plan: plan() });
    expect(r.faithfulness.slotCoverage).toBe('pass');
    expect(r.faithfulness.unsupportedContent).toBe('pass');
    expect(r.utdgRefs).toContain('utdg:archetype:a');
  });

  test('an unfaithful model caption is flagged, not trusted', async () => {
    const transport: Transport = async () => ({ rawText: '{"text":"A futuristic android pilots a neon spacecraft through chromium skyscrapers."}' });
    const provider = createCachingProvider({ runDir: tmp(), transport, providerId: 'fake', model: 'm', mode: 'record', now: NOW });
    const r = await realizeWithProvider({ provider, plan: plan() });
    expect(r.faithfulness.slotCoverage === 'fail' || r.faithfulness.unsupportedContent === 'fail').toBe(true);
  });
});

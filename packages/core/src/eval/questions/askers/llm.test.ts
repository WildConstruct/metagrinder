import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createCachingProvider, type Transport } from '../../../providers';
import { loadDevScenarios } from '../load';
import { askWithLlm, buildQuestionAskerPrompt } from './llm';

const NOW = () => '2026-07-16T01:30:00.000Z';

describe('llm question asker', () => {
  test('prompt includes coverage and constraints', () => {
    const scenario = loadDevScenarios()[0]!;
    const prompt = buildQuestionAskerPrompt(scenario);
    expect(prompt).toContain(scenario.title);
    expect(prompt).toContain('COVERAGE');
    expect(prompt).toMatch(/HARD CONSTRAINTS/i);
  });

  test('askWithLlm validates tasks via provider schema', async () => {
    const scenario = loadDevScenarios().find((s) => s.scenarioId.includes('punk'))!;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qe-llm-'));
    try {
      const transport: Transport = async () => ({
        rawText: JSON.stringify({
          tasks: [
            {
              taskId: 't1',
              title: '1981 LES DIY jacket and patch silhouettes',
              rationale: 'Wardrobe for mid LOD extras',
              targetSlots: ['item_wardrobe'],
              targetChannels: ['silhouette', 'material'],
              targetTraitIds: [],
              suggestedSources: ['period vernacular photos'],
              status: 'proposed'
            }
          ]
        })
      });
      const provider = createCachingProvider({
        runDir: tmp,
        transport,
        providerId: 'fake',
        model: 'm',
        mode: 'record',
        now: NOW
      });
      const tasks = await askWithLlm({ scenario, provider });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.targetSlots).toContain('item_wardrobe');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

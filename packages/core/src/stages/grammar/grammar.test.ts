import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Provenance, SceneGrammarPayload } from '../../schemas';
import { ingestText } from '../ingest';
import { assembleGrammar, verifyGrammarPayload } from './index';
import { deriveChoiceGraph } from '../choices';
import { historicalCrowdGrammar } from '../../compile/__fixtures__/historical-crowd-grammar';

const NOW = '2026-06-10T12:00:00.000Z';

function ingestFixture(name: string) {
  const p = path.resolve(__dirname, `../../../tests/fixtures/metagrinder/${name}`);
  const rawText = fs.readFileSync(p, 'utf8');
  return ingestText({ runId: 'r', inputId: 'i', createdAt: NOW, sources: [{ rawText }] });
}

function prov(chunkId: string): Provenance {
  return { sourceInputIds: ['i'], sourceChunkIds: [chunkId], spans: [], attributionMode: 'paraphrased', evidenceBasis: 'text_supported', confidence: 'medium', verification: 'unverified' };
}

function payloadCiting(chunkId: string, archetypeIds: string[]): SceneGrammarPayload {
  return {
    sceneContext: { contextId: 'ctx', title: 'T', researchKind: 'historical-scene-research', summary: 's', provenance: prov(chunkId) },
    archetypes: archetypeIds.map((id, i) => ({
      archetypeId: id, label: id, summary: id, role: 'role', promptText: `prompt ${id}`,
      weightRange: { label: id, min: 10 + i, max: 20 + i }, confidence: 'medium', provenance: prov(chunkId)
    })),
    demographicDistributions: [], itemSystems: [], locationZones: [], behaviorStates: [],
    environmentalModifiers: [], visualReferences: [], compatibilityRules: [], negativeConstraints: [],
    uncertainties: [], reviewFlags: []
  };
}

describe('grammar draft verification (S3.3)', () => {
  test('[AC-3.3b] historical-crowd: archetypes citing real chunks all verify', () => {
    const pkg = ingestFixture('research-input-historical-crowd-grammar.txt');
    const realChunk = pkg.chunks[0]!.chunkId;
    const { grammar, report } = assembleGrammar({
      payload: payloadCiting(realChunk, ['arch_a', 'arch_b']),
      sourcePackage: pkg, runId: 'r', inputId: 'i', createdAt: NOW, analysisMode: 'replayed-llm-semantic'
    });
    expect(report.archetypesKept).toBe(2);
    expect(report.recordsDropped).toBe(0);
    expect(grammar.archetypes.every((a) => a.provenance.verification === 'verified')).toBe(true);
    expect(grammar.grammarTarget).toBe('base');
  });

  test('[AC-3.3b] medieval-market: same path produces a valid, provenance-verified grammar', () => {
    const pkg = ingestFixture('research-input-medieval-market-scene-grammar.txt');
    const realChunk = pkg.chunks[0]!.chunkId;
    const { grammar, report } = assembleGrammar({
      payload: payloadCiting(realChunk, ['stall_keeper']),
      sourcePackage: pkg, runId: 'r', inputId: 'i', createdAt: NOW, analysisMode: 'replayed-llm-semantic'
    });
    expect(report.archetypesKept).toBe(1);
    expect(grammar.archetypes[0]!.provenance.verification).toBe('verified');
  });

  test('an archetype citing a nonexistent chunk is dropped', () => {
    const pkg = ingestFixture('research-input-historical-crowd-grammar.txt');
    const { report } = verifyGrammarPayload(payloadCiting('chunk_fabricated', ['ghost']), pkg);
    expect(report.archetypesKept).toBe(0);
    expect(report.recordsDropped).toBe(1);
    expect(report.warnings.some((w) => /nonexistent chunk/.test(w))).toBe(true);
  });

  test('weight mass outside the sane band is warned', () => {
    const pkg = ingestFixture('research-input-historical-crowd-grammar.txt');
    const realChunk = pkg.chunks[0]!.chunkId;
    const payload = payloadCiting(realChunk, ['a']);
    payload.archetypes[0]!.weightRange = { label: 'a', min: 1, max: 3 }; // ~2% mass
    const { report } = verifyGrammarPayload(payload, pkg);
    expect(report.warnings.some((w) => /weight mass/.test(w))).toBe(true);
  });
});

describe('grammar/choices source carries no domain vocabulary (S3.3, AC-3.3a)', () => {
  test('no fixture archetype vocabulary is hardcoded in stage source', () => {
    const files = [
      path.resolve(__dirname, 'index.ts'),
      path.resolve(__dirname, 'verify.ts'),
      path.resolve(__dirname, '../choices/index.ts')
    ];
    const forbidden = ['middle_class', 'heat_adjusted', 'straw boater', 'grandstand', 'spectator', 'peasant', 'medieval', 'overcoat'];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8').toLowerCase();
      for (const token of forbidden) {
        expect(text).not.toContain(token);
      }
    }
  });
});

describe('semantic choice-graph derivation (S3.3)', () => {
  test('projects grammar into archetype/zone/environment axes with refs and provenance', () => {
    const cg = deriveChoiceGraph({ grammar: historicalCrowdGrammar(), createdAt: NOW });
    expect(cg.axes.map((a) => a.axisId)).toEqual(['archetype', 'zone', 'environment']);
    expect(cg.axes[0]!.sequence).toBe(0);
    expect(cg.edges).toEqual([
      { fromAxisId: 'archetype', toAxisId: 'zone', kind: 'sequence' },
      { fromAxisId: 'zone', toAxisId: 'environment', kind: 'sequence' }
    ]);
    const firstChoice = cg.axes[0]!.choices[0]!;
    expect(firstChoice.grammarRefs[0]).toMatch(/^archetypes\./);
    expect(firstChoice.provenance).toBeDefined();
    expect(cg.analysisMode).toBe('deterministic');
  });

  test('empty grammar yields no axes and a warning', () => {
    const empty = JSON.parse(JSON.stringify(historicalCrowdGrammar()));
    empty.archetypes = []; empty.locationZones = []; empty.environmentalModifiers = [];
    const cg = deriveChoiceGraph({ grammar: empty, createdAt: NOW });
    expect(cg.axes).toHaveLength(0);
    expect(cg.warnings[0]!.code).toBe('empty-grammar');
  });
});

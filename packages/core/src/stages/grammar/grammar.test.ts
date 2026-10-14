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

function prov(chunkId: string, sourceInputId: string): Provenance {
  return { sourceInputIds: [sourceInputId], sourceChunkIds: [chunkId], spans: [], attributionMode: 'paraphrased', evidenceBasis: 'text_supported', confidence: 'medium', verification: 'unverified' };
}

function payloadCiting(chunkId: string, archetypeIds: string[], sourceInputId: string): SceneGrammarPayload {
  return {
    sceneContext: { contextId: 'ctx', title: 'T', researchKind: 'historical-scene-research', summary: 's', provenance: prov(chunkId, sourceInputId) },
    archetypes: archetypeIds.map((id, i) => ({
      archetypeId: id, label: id, summary: id, role: 'role', promptText: `prompt ${id}`,
      weightRange: { label: id, min: 10 + i, max: 20 + i }, confidence: 'medium', provenance: prov(chunkId, sourceInputId)
    })),
    demographicDistributions: [], itemSystems: [], locationZones: [], behaviorStates: [],
    environmentalModifiers: [], visualReferences: [], compatibilityRules: [], negativeConstraints: [],
    uncertainties: [], reviewFlags: []
  };
}

describe('grammar draft verification (S3.3)', () => {
  test('[AC-3.3b] historical-crowd: real citations retain proposals without certifying invented content', () => {
    const pkg = ingestFixture('research-input-historical-crowd-grammar.txt');
    const realChunk = pkg.chunks[0]!.chunkId;
    const { grammar, report } = assembleGrammar({
      payload: payloadCiting(realChunk, ['arch_a', 'arch_b'], pkg.chunks[0]!.sourceInputId),
      sourcePackage: pkg, runId: 'r', inputId: 'i', createdAt: NOW, analysisMode: 'replayed-llm-semantic'
    });
    expect(report.archetypesKept).toBe(2);
    expect(report.recordsDropped).toBe(0);
    expect(grammar.archetypes.every((a) => a.provenance.verification === 'downgraded')).toBe(true);
    expect(grammar.grammarTarget).toBe('base');
  });

  test('[AC-3.3b] medieval-market: valid grammar keeps unsupported paraphrases available for review', () => {
    const pkg = ingestFixture('research-input-medieval-market-scene-grammar.txt');
    const realChunk = pkg.chunks[0]!.chunkId;
    const { grammar, report } = assembleGrammar({
      payload: payloadCiting(realChunk, ['stall_keeper'], pkg.chunks[0]!.sourceInputId),
      sourcePackage: pkg, runId: 'r', inputId: 'i', createdAt: NOW, analysisMode: 'replayed-llm-semantic'
    });
    expect(report.archetypesKept).toBe(1);
    expect(grammar.archetypes[0]!.provenance.verification).toBe('downgraded');
  });

  test('an archetype citing a nonexistent chunk is dropped', () => {
    const pkg = ingestFixture('research-input-historical-crowd-grammar.txt');
    const payload = payloadCiting('chunk_fabricated', ['ghost'], pkg.chunks[0]!.sourceInputId);
    payload.sceneContext.provenance = prov(pkg.chunks[0]!.chunkId, pkg.chunks[0]!.sourceInputId);
    const { report } = verifyGrammarPayload(payload, pkg);
    expect(report.archetypesKept).toBe(0);
    expect(report.recordsDropped).toBe(1);
    expect(report.warnings.some((w) => /nonexistent chunk/.test(w))).toBe(true);
  });

  test('weight mass outside the sane band is warned', () => {
    const pkg = ingestFixture('research-input-historical-crowd-grammar.txt');
    const realChunk = pkg.chunks[0]!.chunkId;
    const payload = payloadCiting(realChunk, ['a'], pkg.chunks[0]!.sourceInputId);
    payload.archetypes[0]!.weightRange = { label: 'a', min: 1, max: 3 }; // ~2% mass
    const { report } = verifyGrammarPayload(payload, pkg);
    expect(report.warnings.some((w) => /weight mass/.test(w))).toBe(true);
  });
});

describe('grammar attribution boundaries (audit repair)', () => {
  const sourceText = 'Market vendors wear plain linen coats. Fog hangs over the stone arcade.';
  const pkg = ingestText({ runId: 'r', inputId: 'i', createdAt: NOW, sources: [{ rawText: sourceText }] });
  const chunkId = pkg.chunks[0]!.chunkId;
  const quote = (citedId = chunkId): Provenance => ({
    sourceInputIds: [pkg.chunks[0]!.sourceInputId], sourceChunkIds: [citedId], spans: [],
    attributionMode: 'quoted', evidenceBasis: 'text_supported', confidence: 'high',
    verification: 'verified', excerptText: sourceText
  });
  const quotedPayload = (): SceneGrammarPayload => ({
    sceneContext: {
      contextId: 'ctx', title: 'Market vendors', researchKind: 'historical-scene-research',
      summary: sourceText, provenance: quote()
    },
    archetypes: [{
      archetypeId: 'vendor', label: 'Market vendors', summary: 'Market vendors wear plain linen coats.',
      role: 'vendors', promptText: 'Market vendors wear plain linen coats.', confidence: 'high', provenance: quote()
    }],
    demographicDistributions: [{ distributionId: 'mix', label: 'Market vendors', entries: [], appliesToRefs: [], provenance: quote() }],
    itemSystems: [{ systemId: 'coats', label: 'plain linen coats', kind: 'wardrobe', items: ['plain linen coats'], avoidItems: [], provenance: quote() }],
    locationZones: [{ zoneId: 'arcade', label: 'stone arcade', promptText: 'stone arcade', archetypeBiases: [], provenance: quote() }],
    behaviorStates: [{ behaviorId: 'wear', label: 'Market vendors', promptText: 'Market vendors wear plain linen coats.', provenance: quote() }],
    environmentalModifiers: [{ modifierId: 'fog', label: 'Fog', promptText: 'Fog hangs over the stone arcade.', provenance: quote() }],
    visualReferences: [{ referenceId: 'view', kind: 'image-reference', caption: sourceText, supports: [], linkedArchetypeIds: [], rightsProfile: 'reference-only', provenance: quote() }],
    compatibilityRules: [{ ruleId: 'coats', label: 'Market vendors wear plain linen coats.',
      condition: { field: 'archetype', operator: 'equals', value: 'vendor' },
      effects: [{ action: 'requires', target: 'coats' }], confidence: 'high', provenance: quote() }],
    negativeConstraints: [{ constraintId: 'fog', label: 'Fog', text: 'Fog hangs over the stone arcade.',
      constraintType: 'negative', appliesTo: [], enforcedByRuleIds: [], confidence: 'high', provenance: quote() }],
    uncertainties: [], reviewFlags: []
  });

  test('a genuine quote verifies only when the grammar content is also source-grounded', () => {
    const { payload, report } = verifyGrammarPayload(quotedPayload(), pkg);
    expect(report.recordsDropped).toBe(0);
    expect(payload.archetypes[0]!.provenance.verification).toBe('verified');
    expect(payload.itemSystems[0]!.provenance.verification).toBe('verified');
  });

  test.each([{ sourceInputIds: [] }, { sourceInputIds: ['forged-input'] }])('invalid input identifiers reject direct-quote records: %j', ({ sourceInputIds }) => {
    const payload = quotedPayload();
    payload.archetypes[0]!.provenance.sourceInputIds = sourceInputIds;
    const { payload: verified, report } = verifyGrammarPayload(payload, pkg);
    expect(verified.archetypes).toHaveLength(0);
    expect(report.recordsDropped).toBe(1);
    expect(report.warnings.some((warning) => /input/i.test(warning))).toBe(true);
  });

  test('every declared source input must exist even when the actual chunk owner is also declared', () => {
    const payload = quotedPayload();
    payload.archetypes[0]!.provenance.sourceInputIds.push('forged-input');
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    expect(verified.archetypes).toHaveLength(0);
  });

  test('nested weight lineage cannot preserve a forged source input', () => {
    const payload = quotedPayload();
    payload.archetypes[0]!.weightRange = { label: 'Market vendors', min: 70, max: 90, unit: 'percent',
      confidence: 'high', sourceInputIds: ['forged-input'], sourceChunkIds: [chunkId] };
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    expect(verified.archetypes).toHaveLength(0);
  });

  test('a real input cannot substitute for the cited chunk owner', () => {
    const multiSource = ingestText({ runId: 'r', inputId: 'i', createdAt: NOW,
      sources: [{ rawText: sourceText }, { rawText: 'A separate workshop uses iron tools.' }] });
    const payload = quotedPayload();
    payload.archetypes[0]!.provenance.sourceInputIds = [multiSource.sourceInputs[1]!.sourceInputId];
    const { payload: verified } = verifyGrammarPayload(payload, multiSource);
    expect(verified.archetypes).toHaveLength(0);
  });

  test.each([{ sourceInputIds: [] }, { sourceInputIds: ['forged-input'] }])('invalid required context inputs reject the draft: %j', ({ sourceInputIds }) => {
    const payload = quotedPayload();
    payload.sceneContext.provenance.sourceInputIds = sourceInputIds;
    expect(() => verifyGrammarPayload(payload, pkg)).toThrow(/scene context.*reject/i);
  });

  test('a real cited excerpt cannot certify invented archetype prose', () => {
    const payload = quotedPayload();
    payload.archetypes[0]!.promptText = 'Robots carry laser pistols through a neon city.';
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    expect(verified.archetypes[0]!.provenance.verification).toBe('downgraded');
    expect(verified.archetypes[0]!.confidence).toBe('low');
    expect(verified.archetypes[0]!.provenance.confidence).toBe('low');
  });

  test('fabricated quoted excerpts cannot be verified even when the grammar text exists in the source', () => {
    const payload = quotedPayload();
    payload.archetypes[0]!.provenance.excerptText = 'This quotation does not exist.';
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    expect(verified.archetypes[0]!.provenance.verification).toBe('downgraded');
    expect(verified.archetypes[0]!.confidence).toBe('low');
  });

  test.each([
    ['sceneContext', 'summary'], ['demographicDistributions', 'label'],
    ['itemSystems', 'items'], ['behaviorStates', 'promptText'], ['visualReferences', 'caption']
  ] as const)('a sourced excerpt cannot certify invented %s content', (family, field) => {
    const payload = quotedPayload();
    const record = family === 'sceneContext' ? payload.sceneContext : payload[family][0]!;
    const invented = 'Robots carry laser pistols through a neon city.';
    Object.assign(record, { [field]: field === 'items' ? [invented] : invented });
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    const verifiedRecord = family === 'sceneContext' ? verified.sceneContext : verified[family][0]!;
    expect(verifiedRecord.provenance.verification).toBe('downgraded');
    expect(verifiedRecord.provenance.confidence).toBe('low');
  });

  test.each(['demographicDistributions', 'itemSystems', 'locationZones', 'behaviorStates', 'environmentalModifiers', 'visualReferences', 'compatibilityRules', 'negativeConstraints'] as const)(
    'missing citations reject %s records rather than trusting model verification', (family) => {
      const payload = quotedPayload();
      payload[family][0]!.provenance = quote('missing-chunk');
      const { payload: verified, report } = verifyGrammarPayload(payload, pkg);
      expect(verified[family]).toHaveLength(0);
      expect(report.recordsDropped).toBe(1);
    }
  );

  test('invalid required scene-context provenance rejects the draft', () => {
    const payload = quotedPayload();
    payload.sceneContext.provenance = quote('missing-chunk');
    expect(() => verifyGrammarPayload(payload, pkg)).toThrow(/scene context.*reject/i);
  });

  test('inferred records stay low and unverified throughout every grammar family', () => {
    const payload = quotedPayload();
    const records = [payload.sceneContext, ...payload.archetypes, ...payload.demographicDistributions,
      ...payload.itemSystems, ...payload.locationZones, ...payload.behaviorStates,
      ...payload.environmentalModifiers, ...payload.visualReferences, ...payload.compatibilityRules, ...payload.negativeConstraints];
    for (const record of records) record.provenance = { ...quote(), attributionMode: 'inferred', reasoningNote: 'A proposed adjacent scene possibility.' };
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    const verifiedRecords = [verified.sceneContext, ...verified.archetypes, ...verified.demographicDistributions,
      ...verified.itemSystems, ...verified.locationZones, ...verified.behaviorStates,
      ...verified.environmentalModifiers, ...verified.visualReferences, ...verified.compatibilityRules, ...verified.negativeConstraints];
    for (const record of verifiedRecords) {
      expect(record.provenance.verification).toBe('unverified');
      expect(record.provenance.confidence).toBe('low');
    }
    expect(verified.archetypes[0]!.confidence).toBe('low');
    expect(verified.compatibilityRules[0]!.confidence).toBe('low');
    expect(verified.negativeConstraints[0]!.confidence).toBe('low');
  });

  test('lexical overlap on paraphrases requests review instead of claiming entailment', () => {
    const payload = quotedPayload();
    payload.archetypes[0]!.provenance = { ...quote(), attributionMode: 'paraphrased' };
    const { payload: verified, report } = verifyGrammarPayload(payload, pkg);
    expect(verified.archetypes[0]!.provenance.verification).toBe('downgraded');
    expect(verified.archetypes[0]!.confidence).toBe('low');
    expect(report.warnings.some((warning) => /entailment|review/.test(warning))).toBe(true);
  });

  test('interpreted weights require review and inherit the conservative record confidence', () => {
    const payload = quotedPayload();
    payload.archetypes[0]!.weightRange = { label: 'Market vendors', min: 70, max: 90, unit: 'percent',
      confidence: 'high', sourceInputIds: [pkg.chunks[0]!.sourceInputId], sourceChunkIds: [chunkId] };
    const { payload: verified } = verifyGrammarPayload(payload, pkg);
    const record = verified.archetypes[0]!;
    expect(record.provenance.verification).toBe('downgraded');
    expect(record.confidence).toBe('low');
    expect(record.weightRange!.confidence).toBe('low');
    expect(verified.reviewFlags).toContain('provenance-review:archetype vendor');
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

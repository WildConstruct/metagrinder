import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { historicalCrowdGrammar } from '../compile/__fixtures__/historical-crowd-grammar';
import { RunStore } from '../artifacts/store';
import { SceneGrammarSchema, type PlanSlot } from '../schemas';
import { ingestText } from '../stages/ingest';
import { sampleContentPlans } from '../stages/sample';
import { realizeTemplate } from '../stages/realize';
import { analyzeExpressiveRange, compareExpressiveRanges } from './era';
import { loadCorpus } from './corpus';
import { evaluateRun } from './run';
import { scoreExtractionRun, scoreLegacyRun, scoreObservation } from './scorer';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const LEGACY_RUNS = path.join(REPO_ROOT, 'experiments/epic4-autoresearch/runs');

describe('S3.5 promoted semantic evaluator', () => {
  test.each<{ grammarRef: string; slotKind: PlanSlot['slotKind']; negative: boolean }>([
    { grammarRef: 'locationZones.missing', slotKind: 'zone', negative: false },
    { grammarRef: 'environmentalModifiers.missing', slotKind: 'modifier', negative: false },
    { grammarRef: 'negativeConstraints.missing', slotKind: 'negative', negative: true }
  ])('[S-R3d] downstream diagnostics reject dangling $grammarRef', ({ grammarRef, slotKind, negative }) => {
    const loaded = loadCorpus();
    const brief = loaded.briefs[0]!;
    const corpus = { ...loaded, briefs: [brief] };
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-eval-reference-'));
    const now = '2026-10-14T12:00:00.000Z';
    const store = RunStore.create({ baseDir: root, runId: brief.id, inputId: brief.id, parserVersion: '0.1.0' });
    const source = ingestText({ runId: brief.id, inputId: brief.id, title: brief.id, createdAt: now,
      sources: [{ title: brief.id, rawText: brief.text }] });
    const fixture = historicalCrowdGrammar(now);
    const grammar = SceneGrammarSchema.parse({ ...fixture, runId: brief.id, inputId: brief.id,
      archetypes: [{ ...fixture.archetypes[0]!, archetypeId: 'person', label: 'Person',
        promptText: 'person', role: 'person' }], demographicDistributions: [], itemSystems: [],
      locationZones: [], behaviorStates: [], environmentalModifiers: [], visualReferences: [],
      compatibilityRules: [], negativeConstraints: [] });
    const content = sampleContentPlans({ grammar, seed: 1, count: 1, now });
    const danglingSlot: PlanSlot = { slotId: 'dangling-reference', slotKind,
      value: negative ? 'modern' : 'spaceship', grammarRefs: [grammarRef], utdgRefs: [], evidenceRefs: [] };
    (negative ? content.plans[0]!.negativeSlots : content.plans[0]!.slots).push(danglingSlot);
    content.realized = content.plans.map((plan) => realizeTemplate(plan, 'caption-prose'));
    expect(content.realized[0]!.faithfulness).toMatchObject({ slotCoverage: 'pass', unsupportedContent: 'pass' });
    store.writeArtifact('source-package', 'source-package.json', source);
    store.writeArtifact('extraction', 'extraction.json', {
      artifact: 'extraction', runId: brief.id, inputId: brief.id, createdAt: now,
      analysisMode: 'replayed-llm-semantic', detectedResearchKind: 'historical-scene-research'
    });
    store.writeArtifact('scene-grammar', 'scene-grammar.json', grammar);
    store.writeArtifact('semantic-choice-graph', 'semantic-choice-graph.json', {
      artifact: 'semantic-choice-graph', runId: brief.id, inputId: brief.id, createdAt: now,
      analysisMode: 'human-authored', grammarTarget: 'base'
    });
    store.writeArtifact('content-plans', 'content-plans.json', content);
    const outputPath = path.join(root, 'eval-report.json');
    try {
      expect(() => evaluateRun({ corpus, extractionRunDir: root, baseGrammar: grammar,
        outputPath, now, sampleCount: 2 })).toThrow(/downstream diagnostic gates/);
      const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      expect(report.pipelineDiagnostics[0].issues.some((issue: string) => issue.includes(grammarRef))).toBe(true);
    } finally {
      const relativeRoot = path.relative(os.tmpdir(), root);
      if (!relativeRoot || relativeRoot.startsWith('..') || path.isAbsolute(relativeRoot)) {
        throw new Error('evaluation temp cleanup escaped its root');
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('[S-R3d] scoring and diagnostics reject a changed verified extraction snapshot', () => {
    const loaded = loadCorpus();
    const brief = loaded.briefs[0]!;
    const corpus = { ...loaded, briefs: [brief] };
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-eval-snapshot-'));
    const now = '2026-10-14T12:00:00.000Z';
    const store = RunStore.create({ baseDir: root, runId: brief.id, inputId: brief.id, parserVersion: '0.1.0' });
    const source = ingestText({ runId: brief.id, inputId: brief.id, title: brief.id, createdAt: now,
      sources: [{ title: brief.id, rawText: brief.text }] });
    const fixture = historicalCrowdGrammar(now);
    const grammar = SceneGrammarSchema.parse({ ...fixture, runId: brief.id, inputId: brief.id,
      archetypes: [{ ...fixture.archetypes[0]!, archetypeId: 'person', label: 'Person',
        promptText: 'person', role: 'person' }], demographicDistributions: [], itemSystems: [],
      locationZones: [], behaviorStates: [], environmentalModifiers: [], visualReferences: [],
      compatibilityRules: [], negativeConstraints: [] });
    const extraction = { artifact: 'extraction', runId: brief.id, inputId: brief.id, createdAt: now,
      analysisMode: 'replayed-llm-semantic', detectedResearchKind: 'old-extraction-mode' };
    const content = sampleContentPlans({ grammar, seed: 1, count: 1, now });
    content.realized = content.plans.map((plan) => realizeTemplate(plan, 'caption-prose'));
    store.writeArtifact('source-package', 'source-package.json', source);
    store.writeArtifact('extraction', 'extraction.json', extraction);
    store.writeArtifact('scene-grammar', 'scene-grammar.json', grammar);
    store.writeArtifact('semantic-choice-graph', 'semantic-choice-graph.json', {
      artifact: 'semantic-choice-graph', runId: brief.id, inputId: brief.id, createdAt: now,
      analysisMode: 'human-authored', grammarTarget: 'base'
    });
    store.writeArtifact('content-plans', 'content-plans.json', content);
    const originalRead = RunStore.prototype.readArtifact;
    let replaced = false;
    const read = jest.spyOn(RunStore.prototype, 'readArtifact').mockImplementation(function (
      this: RunStore, family: string, fileName: string
    ) {
      const result = originalRead.call(this, family, fileName);
      if (!replaced && family === 'extraction') {
        replaced = true;
        store.writeArtifact('extraction', 'extraction.json', {
          ...extraction, detectedResearchKind: 'new-extraction-mode'
        });
      }
      return result;
    });
    try {
      expect(() => evaluateRun({ corpus, extractionRunDir: root, baseGrammar: grammar,
        outputPath: path.join(root, 'eval-report.json'), now, sampleCount: 2 }))
        .toThrow(/run changed during evaluation/);
    } finally {
      read.mockRestore();
      const relativeRoot = path.relative(os.tmpdir(), root);
      if (!relativeRoot || relativeRoot.startsWith('..') || path.isAbsolute(relativeRoot)) {
        throw new Error('evaluation temp cleanup escaped its root');
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('[S-R3d] duplicate focus labels cannot earn additional rubric points', () => {
    const corpus = loadCorpus();
    const brief = corpus.briefs[0]!;
    const label = brief.judgment.expected_focus_any[0]!;
    const observation = { mode: null, focus: [label], rationales: [], confidence: null,
      warnings: [], candidateScores: [] };
    expect(scoreObservation(brief, { ...observation, focus: [label, label, label] }, corpus.scoring).score)
      .toBe(scoreObservation(brief, observation, corpus.scoring).score);
  });

  test('[S-R3d] evaluation labels metadata scores and single-grammar ERA honestly', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-eval-scope-'));
    const grammar = historicalCrowdGrammar();
    const report = evaluateRun({ corpus: loadCorpus(), legacyRunDir: path.join(LEGACY_RUNS, 'semantic-baseline'),
      baseGrammar: grammar, outputPath: path.join(root, 'eval-report.json'), now: '2026-10-13T12:00:00.000Z' });
    expect(report).toMatchObject({ evaluationScope: {
      scoredSignals: 'extraction-metadata', factualAccuracy: 'not-evaluated', downstreamSemantics: 'not-evaluated',
      eraInput: { scope: 'single-grammar', runId: grammar.runId, inputId: grammar.inputId }
    } });
  });

  test('[S-R3d] a below-baseline evaluation writes its failed report and rejects', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-eval-baseline-'));
    const outputPath = path.join(root, 'eval-report.json');
    const options = { corpus: loadCorpus(), legacyRunDir: path.join(LEGACY_RUNS, 'heuristic-baseline'),
      baseGrammar: historicalCrowdGrammar(), outputPath, now: '2026-10-13T12:00:00.000Z', minimumScore: 107 };
    expect(() => evaluateRun(options)).toThrow(/below.*baseline/);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8')).baseline.passed).toBe(false);
  });
  test('[AC-3.5a] committed Epic 4 baselines reproduce 106 heuristic and 114 semantic', () => {
    const corpus = loadCorpus();
    const heuristic = scoreLegacyRun(corpus, path.join(LEGACY_RUNS, 'heuristic-baseline'));
    const semantic = scoreLegacyRun(corpus, path.join(LEGACY_RUNS, 'semantic-baseline'));
    expect(heuristic.totalScore).toBe(106);
    expect(semantic.totalScore).toBe(114);
    expect(semantic.totalMax).toBe(120);
  });

  test('[AC-3.5b] accepted grammar produces a nonzero explained generative shift', () => {
    const base = historicalCrowdGrammar();
    const accepted = SceneGrammarSchema.parse(JSON.parse(JSON.stringify(base)));
    accepted.grammarTarget = 'accepted';
    accepted.archetypes[0]!.weightRange = {
      label: accepted.archetypes[0]!.label,
      min: 5,
      max: 10
    };

    const baseEra = analyzeExpressiveRange(base, { seed: 73, sampleCount: 1000 });
    const acceptedEra = analyzeExpressiveRange(accepted, { seed: 73, sampleCount: 1000 });
    const shift = compareExpressiveRanges(baseEra, acceptedEra);

    expect(baseEra.constraintViolationRate).toBe(0);
    expect(shift.totalVariationDistance).toBeGreaterThan(0);
    expect(shift.explanations.length).toBeGreaterThan(0);
  });

  test('[AC-3.5a] one evaluation call writes corpus, ERA, and shift into one report', () => {
    const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-eval-')), 'eval-report.json');
    const base = historicalCrowdGrammar();
    const accepted = SceneGrammarSchema.parse({ ...base, grammarTarget: 'accepted' });
    accepted.archetypes[0]!.weightRange = {
      label: accepted.archetypes[0]!.label,
      min: 25,
      max: 35
    };

    const report = evaluateRun({
      corpus: loadCorpus(),
      legacyRunDir: path.join(LEGACY_RUNS, 'semantic-baseline'),
      baseGrammar: base,
      acceptedGrammar: accepted,
      outputPath,
      now: '2026-07-12T12:00:00.000Z',
      sampleCount: 250
    });

    expect(report.corpus.totalScore).toBe(114);
    expect(report.era.base.sampleCountEmitted).toBeGreaterThan(0);
    expect(report.era.shift?.totalVariationDistance).toBeGreaterThan(0);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toMatchObject({ artifact: 'eval-report' });
  });

  test('rebuilt corpus adapter refuses live output and scores replay-stamped extraction', () => {
    const loaded = loadCorpus();
    const corpus = { ...loaded, briefs: [loaded.briefs[0]!] };
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-replay-eval-'));
    const briefDir = path.join(runDir, 'broadway');
    const store = RunStore.create({ baseDir: runDir, runId: 'broadway', inputId: 'broadway', parserVersion: '0.1.0' });
    const extraction = {
      artifact: 'extraction', runId: 'broadway', inputId: 'broadway', createdAt: '2026-07-12T12:00:00.000Z',
      analysisMode: 'llm-semantic', detectedResearchKind: 'historical-scene-research',
      categories: [
        { category: 'wardrobe', rationale: 'Broadway theater audience wardrobe' },
        { category: 'people-and-crowd', rationale: 'Crowd behavior' }
      ],
      claims: [{
        claimId: 'c1', text: 'Audience wardrobe', category: 'wardrobe', confidence: 'high',
        provenance: {
          sourceInputIds: ['i'], sourceChunkIds: ['ch'], spans: [], attributionMode: 'paraphrased',
          evidenceBasis: 'text_supported', confidence: 'high', verification: 'verified'
        }
      }]
    };
    const extractionPath = path.join(briefDir, 'extraction.json');
    store.writeArtifact('extraction', 'extraction.json', extraction);
    expect(() => scoreExtractionRun(corpus, runDir)).toThrow(/not replay-stamped/);
    extraction.analysisMode = 'replayed-llm-semantic';
    store.writeArtifact('extraction', 'extraction.json', extraction);
    expect(scoreExtractionRun(corpus, runDir).totalScore).toBeGreaterThan(0);
    fs.writeFileSync(extractionPath, JSON.stringify({ ...extraction, detectedResearchKind: 'tampered' }), 'utf8');
    expect(() => scoreExtractionRun(corpus, runDir)).toThrow(/hash mismatch/);
    store.writeArtifact('extraction', 'extraction.json', { ...extraction, inputId: 'other-input' });
    expect(() => scoreExtractionRun(corpus, runDir)).toThrow(/identity mismatch/);
  });
});

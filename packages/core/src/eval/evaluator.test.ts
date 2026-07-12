import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { historicalCrowdGrammar } from '../compile/__fixtures__/historical-crowd-grammar';
import { SceneGrammarSchema } from '../schemas';
import { analyzeExpressiveRange, compareExpressiveRanges } from './era';
import { loadCorpus } from './corpus';
import { evaluateRun } from './run';
import { scoreExtractionRun, scoreLegacyRun } from './scorer';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const LEGACY_RUNS = path.join(REPO_ROOT, 'experiments/epic4-autoresearch/runs');

describe('S3.5 promoted semantic evaluator', () => {
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
    fs.mkdirSync(briefDir, { recursive: true });
    const extraction = {
      artifact: 'extraction', runId: 'r', inputId: 'broadway', createdAt: '2026-07-12T12:00:00.000Z',
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
    fs.writeFileSync(extractionPath, JSON.stringify(extraction), 'utf8');
    expect(() => scoreExtractionRun(corpus, runDir)).toThrow(/not replay-stamped/);
    extraction.analysisMode = 'replayed-llm-semantic';
    fs.writeFileSync(extractionPath, JSON.stringify(extraction), 'utf8');
    expect(scoreExtractionRun(corpus, runDir).totalScore).toBeGreaterThan(0);
  });
});

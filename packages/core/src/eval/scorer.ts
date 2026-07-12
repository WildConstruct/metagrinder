import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { ExtractionSchema, type Extraction } from '../schemas';
import {
  CorpusEvalReportSchema,
  type CorpusEvalReport,
  type EvalBriefResult
} from '../schemas/eval';
import type { Corpus, CorpusBrief } from './corpus';

export interface EvalObservation {
  mode: string | null;
  focus: string[];
  rationales: string[];
  confidence: string | null;
  warnings: string[];
  candidateScores: number[];
}

const LegacyModeSchema = z.object({
  researchKind: z.string(),
  reasons: z.array(z.string()).default([]),
  confidence: z.string().optional(),
  candidateKinds: z.array(z.object({ score: z.number() })).default([])
});

const LegacyCategoriesSchema = z.object({
  recommendedFocus: z.array(z.string()).default([]),
  categories: z.array(z.object({ rationale: z.string().optional() })).default([])
});

const LegacyAssumptionsSchema = z.object({ warnings: z.array(z.string()).default([]) });

function readOptionalJson(filePath: string): unknown | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function observationFromLegacyRun(runDir: string, briefId: string): EvalObservation {
  const briefDir = path.join(runDir, briefId);
  const modeRaw = readOptionalJson(path.join(briefDir, 'mode-detection.json'));
  const categoryRaw = readOptionalJson(path.join(briefDir, 'category-hypothesis.json'));
  const assumptionRaw = readOptionalJson(path.join(briefDir, 'assumption-review.json'));
  const mode = modeRaw === undefined ? undefined : LegacyModeSchema.parse(modeRaw);
  const categories = categoryRaw === undefined ? undefined : LegacyCategoriesSchema.parse(categoryRaw);
  const assumptions = assumptionRaw === undefined ? undefined : LegacyAssumptionsSchema.parse(assumptionRaw);
  return {
    mode: mode?.researchKind ?? null,
    focus: categories?.recommendedFocus ?? [],
    rationales: [
      ...(mode?.reasons ?? []),
      ...(categories?.categories.flatMap((entry) => entry.rationale ? [entry.rationale] : []) ?? [])
    ],
    confidence: mode?.confidence ?? null,
    warnings: assumptions?.warnings ?? [],
    candidateScores: mode?.candidateKinds.map((candidate) => candidate.score) ?? []
  };
}

function representativeConfidence(extraction: Extraction): string | null {
  const levels = [
    ...extraction.claims.map((record) => record.confidence),
    ...extraction.concepts.map((record) => record.confidence),
    ...extraction.evidence.map((record) => record.provenance.confidence)
  ];
  if (levels.length === 0) return null;
  const counts = new Map<string, number>();
  for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1);
  const conservativeOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  return [...counts.entries()].sort((left, right) =>
    right[1] - left[1] || (conservativeOrder[left[0]] ?? 99) - (conservativeOrder[right[0]] ?? 99)
  )[0]![0];
}

export function observationFromExtraction(extraction: Extraction): EvalObservation {
  return {
    mode: extraction.detectedResearchKind ?? null,
    focus: extraction.categories.map((category) => category.category),
    rationales: extraction.categories.flatMap((category) => category.rationale ? [category.rationale] : []),
    confidence: representativeConfidence(extraction),
    warnings: extraction.warnings.map((warning) => warning.message),
    candidateScores: []
  };
}

const joinText = (values: string[]): string => values.map((value) => value.toLowerCase()).join('\n');

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export function scoreObservation(brief: CorpusBrief, observation: EvalObservation, scoring: Corpus['scoring']): EvalBriefResult {
  const problems: string[] = [];
  const breakdown = { mode: 0, focus: 0, rationale: 0, warnings: 0 };
  let score = 0;

  if (observation.mode === brief.judgment.expected_mode) {
    score += scoring.mode_correct;
    breakdown.mode += scoring.mode_correct;
  } else if (observation.mode !== null && brief.judgment.acceptable_modes.includes(observation.mode)) {
    score += scoring.mode_acceptable;
    breakdown.mode += scoring.mode_acceptable;
    problems.push(`accepted alternate mode: ${observation.mode}`);
  } else {
    problems.push(`unexpected mode: ${observation.mode ?? 'missing'}`);
  }

  const expectedFocus = new Set(brief.judgment.expected_focus_any);
  const focusHits = observation.focus.filter((label) => expectedFocus.has(label)).length;
  const focusScore = Math.min(focusHits, scoring.focus_hit_cap);
  score += focusScore;
  breakdown.focus += focusScore;
  if (focusHits === 0) problems.push('no expected focus labels surfaced');
  if (observation.focus.slice(0, 2).some((label) => brief.judgment.expected_focus_primary.includes(label))) {
    score += scoring.focus_primary_bonus;
    breakdown.focus += scoring.focus_primary_bonus;
  } else {
    problems.push('top focus ordering missed expected primary labels');
  }

  if (observation.rationales.some((rationale) => rationale.trim().length > 0)) {
    score += scoring.rationale_nonempty;
    breakdown.rationale += scoring.rationale_nonempty;
  } else {
    problems.push('missing usable rationale');
  }
  if (includesAny(joinText(observation.rationales), brief.judgment.expected_rationale_any)) {
    score += scoring.rationale_specificity_bonus;
    breakdown.rationale += scoring.rationale_specificity_bonus;
  } else {
    problems.push('rationale did not surface expected evidence signals');
  }

  if (observation.confidence !== null && brief.judgment.expected_confidence_any.includes(observation.confidence)) {
    score += scoring.confidence_calibrated;
    breakdown.rationale += scoring.confidence_calibrated;
  } else {
    problems.push(`confidence was not in expected range: ${observation.confidence ?? 'missing'}`);
  }
  const [top, second] = observation.candidateScores;
  if (observation.confidence === 'high' && top !== undefined && second !== undefined && top > 0 && second >= top * 0.8) {
    score -= scoring.candidate_gap_penalty;
    breakdown.rationale -= scoring.candidate_gap_penalty;
    problems.push('confidence was too strong relative to a close secondary candidate');
  }

  if (brief.judgment.expected_warning_any.length > 0) {
    if (observation.warnings.length > 0 && includesAny(joinText(observation.warnings), brief.judgment.expected_warning_any)) {
      score += scoring.warning_expected_hit;
      breakdown.warnings += scoring.warning_expected_hit;
    } else {
      problems.push('expected warning signals were missing');
    }
  }
  if (brief.judgment.warning_tolerance === 'low' && observation.warnings.length > 1) {
    score -= scoring.warning_overflow_penalty;
    breakdown.warnings -= scoring.warning_overflow_penalty;
    problems.push('warning precision too low for a low-warning brief');
  }

  return {
    id: brief.id,
    expectedMode: brief.judgment.expected_mode,
    actualMode: observation.mode,
    recommendedFocus: observation.focus,
    warningCount: observation.warnings.length,
    breakdown,
    score,
    maxScore: scoring.max_per_brief,
    problems
  };
}

export function scoreCorpus(
  corpus: Corpus,
  sourceKind: CorpusEvalReport['sourceKind'],
  loadObservation: (brief: CorpusBrief) => EvalObservation
): CorpusEvalReport {
  const results = corpus.briefs.map((brief) => scoreObservation(brief, loadObservation(brief), corpus.scoring));
  return CorpusEvalReportSchema.parse({
    corpusVersion: corpus.version,
    sourceKind,
    totalScore: results.reduce((sum, result) => sum + result.score, 0),
    totalMax: results.reduce((sum, result) => sum + result.maxScore, 0),
    results
  });
}

export function scoreLegacyRun(corpus: Corpus, runDir: string): CorpusEvalReport {
  return scoreCorpus(corpus, 'legacy-bootstrap', (brief) => observationFromLegacyRun(runDir, brief.id));
}

export function scoreExtractionRun(
  corpus: Corpus,
  runDir: string,
  sourceKind: 'replayed-extraction' | 'holdout-extraction' = 'replayed-extraction'
): CorpusEvalReport {
  return scoreCorpus(corpus, sourceKind, (brief) => {
    const extractionPath = path.join(runDir, brief.id, 'extraction.json');
    const extraction = ExtractionSchema.parse(JSON.parse(fs.readFileSync(extractionPath, 'utf8')));
    if (sourceKind === 'replayed-extraction' && extraction.analysisMode !== 'replayed-llm-semantic') {
      throw new Error(`committed corpus extraction is not replay-stamped: ${brief.id}`);
    }
    return observationFromExtraction(extraction);
  });
}

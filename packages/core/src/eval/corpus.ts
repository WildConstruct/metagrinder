import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

/**
 * Eval corpus loader (S1.5). The corpus is the COMMITTED brief set — replay
 * evals run against it in CI. Held-out briefs live outside the repo (S0.3)
 * and are loaded by the holdout runner (S3.5) via METAGRINDER_HOLDOUT_DIR.
 *
 * judgments.json is the verbatim epic4 port — its byte identity with the
 * original is asserted by test. Judgment edits ship in their own
 * `eval-corpus:` flagged commits (loop rule A4.2).
 *
 * Briefs are stored as briefs/<id>.<ext>; the loader joins by id and ignores
 * the legacy repo-relative `path` field rather than editing it.
 */

export const JudgmentSchema = z.object({
  id: z.string(),
  path: z.string(),
  expected_mode: z.string(),
  acceptable_modes: z.array(z.string()).default([]),
  expected_focus_any: z.array(z.string()).default([]),
  expected_focus_primary: z.array(z.string()).default([]),
  expected_confidence_any: z.array(z.string()).default([]),
  expected_rationale_any: z.array(z.string()).default([]),
  expected_warning_any: z.array(z.string()).default([]),
  /** A tolerance LEVEL, not a count — observed values 'low' | 'medium' in the epic4 file. */
  warning_tolerance: z.enum(['low', 'medium', 'high']).default('low'),
  notes: z.string().optional()
});
export type Judgment = z.infer<typeof JudgmentSchema>;

export const ScoringRubricSchema = z.object({
  mode_correct: z.number(),
  mode_acceptable: z.number(),
  focus_hit_cap: z.number(),
  focus_primary_bonus: z.number(),
  rationale_nonempty: z.number(),
  rationale_specificity_bonus: z.number(),
  confidence_calibrated: z.number(),
  candidate_gap_penalty: z.number(),
  warning_expected_hit: z.number(),
  warning_overflow_penalty: z.number(),
  max_per_brief: z.number()
});
export type ScoringRubric = z.infer<typeof ScoringRubricSchema>;

export const JudgmentsFileSchema = z.object({
  version: z.union([z.string(), z.number()]),
  briefs: z.array(JudgmentSchema).min(1),
  scoring: ScoringRubricSchema
});

export interface CorpusBrief {
  id: string;
  text: string;
  briefPath: string;
  judgment: Judgment;
}

export interface Corpus {
  version: string;
  scoring: ScoringRubric;
  briefs: CorpusBrief[];
}

const CORPUS_DIR = path.resolve(__dirname, 'corpus');

export function loadCorpus(corpusDir: string = CORPUS_DIR): Corpus {
  const judgmentsRaw = fs.readFileSync(path.join(corpusDir, 'judgments.json'), 'utf8');
  const judgments = JudgmentsFileSchema.parse(JSON.parse(judgmentsRaw));

  const briefsDir = path.join(corpusDir, 'briefs');
  const briefFiles = fs.readdirSync(briefsDir);

  const briefs = judgments.briefs.map((judgment) => {
    const fileName = briefFiles.find((f) => path.parse(f).name === judgment.id);
    if (!fileName) {
      throw new Error(`corpus brief file missing for judgment id: ${judgment.id}`);
    }
    const briefPath = path.join(briefsDir, fileName);
    const text = fs.readFileSync(briefPath, 'utf8');
    if (!text.trim()) {
      throw new Error(`corpus brief is empty: ${fileName}`);
    }
    return { id: judgment.id, text, briefPath, judgment };
  });

  const orphans = briefFiles.filter(
    (f) => !judgments.briefs.some((j) => j.id === path.parse(f).name)
  );
  if (orphans.length > 0) {
    throw new Error(`corpus briefs without judgments: ${orphans.join(', ')}`);
  }

  return { version: String(judgments.version), scoring: judgments.scoring, briefs };
}

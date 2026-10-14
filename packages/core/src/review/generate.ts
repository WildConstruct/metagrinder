import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RunStore } from '../artifacts/store';
import type {
  ContentPlans,
  RealizedPrompt,
  RunManifest
} from '../schemas';
import { selectPlansByCoveringArray } from './covering-array';
import {
  generateReviewHtml,
  type ReviewPlanRow,
  type ReviewRealizedRow,
  type ReviewSnapshot
} from './html';

/**
 * Build a ReviewSnapshot from run artifacts and emit review.html (S4.1).
 */

export interface GenerateReviewOptions {
  runId: string;
  inputId: string;
  now: string;
  parserVersion?: string;
  manifest?: RunManifest;
  contentPlans?: ContentPlans;
  /** When plans have no realized[], optional external list. */
  realized?: RealizedPrompt[];
  notes?: string[];
  coveringSeed?: number;
  coveringMaxRows?: number;
}

export function buildReviewSnapshot(opts: GenerateReviewOptions): ReviewSnapshot {
  const plans = opts.contentPlans?.plans ?? [];
  const realizedList =
    opts.realized
    ?? opts.contentPlans?.realized
    ?? [];

  const { covering, selectedPlanIds, planToRow } = selectPlansByCoveringArray({
    plans: plans.map((p) => ({
      planId: p.planId,
      slots: p.slots.map((s) => ({ slotKind: s.slotKind, value: s.value }))
    })),
    ...(opts.coveringSeed !== undefined ? { seed: opts.coveringSeed } : {}),
    ...(opts.coveringMaxRows !== undefined ? { maxRows: opts.coveringMaxRows } : {})
  });

  const selected = new Set(selectedPlanIds);

  const planRows: ReviewPlanRow[] = plans.map((p) => ({
    planId: p.planId,
    seed: p.seed,
    grammarTarget: p.grammarTarget,
    selectedForReview: selected.has(p.planId),
    ...(planToRow[p.planId] !== undefined ? { coveringRowId: planToRow[p.planId] } : {}),
    slots: p.slots.map((s) => ({
      slotKind: s.slotKind,
      value: s.value,
      grammarRefs: s.grammarRefs,
      utdgRefs: s.utdgRefs,
      evidenceRefs: s.evidenceRefs
    }))
  }));

  const realizedRows: ReviewRealizedRow[] = realizedList.map((r) => ({
    promptId: r.promptId,
    planId: r.planId,
    realizationProfile: r.realizationProfile,
    text: r.text,
    slotCoverage: r.faithfulness.slotCoverage,
    unsupportedContent: r.faithfulness.unsupportedContent,
    faithfulnessNotes: r.faithfulness.notes,
    utdgRefs: r.utdgRefs,
    evidenceRefs: r.evidenceRefs
  }));

  const manifest = opts.manifest;

  return {
    runId: opts.runId,
    inputId: opts.inputId,
    generatedAt: opts.now,
    ...(opts.parserVersion !== undefined ? { parserVersion: opts.parserVersion } : {}),
    stages: (manifest?.stages ?? []).map((s) => ({
      stage: s.stage,
      state: s.state,
      ...(s.gate !== undefined ? { gate: s.gate } : {}),
      ...(s.error !== undefined ? { error: s.error } : {})
    })),
    artifacts: (manifest?.artifacts ?? []).map((a) => ({
      family: a.family,
      path: a.path,
      contentSha256: a.contentSha256
    })),
    models: (manifest?.models ?? []).map((m) => ({
      stage: m.stage,
      providerId: m.providerId,
      modelId: m.modelId
    })),
    plans: planRows,
    realized: realizedRows,
    covering,
    ...(opts.notes !== undefined ? { notes: opts.notes } : {})
  };
}

export function renderReviewHtml(opts: GenerateReviewOptions): string {
  return generateReviewHtml(buildReviewSnapshot(opts));
}

/** Write review.html into a directory (typically the run folder). Returns absolute path. */
export function writeReviewHtmlFile(args: {
  outDir: string;
  fileName?: string;
  options: GenerateReviewOptions;
}): string {
  const html = renderReviewHtml(args.options);
  const fileName = args.fileName ?? 'review.html';
  fs.mkdirSync(args.outDir, { recursive: true });
  const outPath = path.join(args.outDir, fileName);
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

/** Convenience: snapshot from RunStore + content-plans artifact if present. */
export function writeReviewHtmlForRun(args: {
  store: RunStore;
  contentPlans?: ContentPlans;
  now: string;
  notes?: string[];
}): string {
  const manifest = args.store.getManifest();
  let plans = args.contentPlans;
  if (!plans) {
    const rec = manifest.artifacts.find((a) => a.family === 'content-plans');
    if (rec) {
      try {
        plans = args.store.readArtifact<ContentPlans>('content-plans', rec.path);
      } catch {
        plans = undefined;
      }
    }
  }
  return writeReviewHtmlFile({
    outDir: args.store.runDir,
    options: {
      runId: manifest.runId,
      inputId: manifest.inputId,
      now: args.now,
      parserVersion: manifest.parserVersion,
      manifest,
      ...(plans !== undefined ? { contentPlans: plans } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {})
    }
  });
}

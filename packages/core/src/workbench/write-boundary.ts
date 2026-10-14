import * as path from 'node:path';
import type { OperatorWritableKind } from '../schemas/operator-state';

/**
 * S4.2 write boundary: the thin workbench may only write operator-state files.
 * Generated pipeline artifacts (extraction, grammar, plans, utdg, …) are forbidden.
 */

/** Artifact families / basenames the server must never write. */
export const GENERATED_ARTIFACT_BASENAMES = new Set([
  'source-package.json',
  'extraction.json',
  'scene-grammar.json',
  'accepted-scene-grammar.json',
  'semantic-choice-graph.json',
  'content-plans.json',
  'utdg-candidates.json',
  'revisions.json',
  'retrieval.json',
  'gap-registry.json',
  'research-campaign.json',
  'research-package.json',
  'run-manifest.json',
  'eval-report.json',
  'generation-qa-report.json',
  'psg-compile-diff.json',
  'community-job.json',
  'community-coverage-report.json',
  'review.html',
  'llm-cache'
]);

export const OPERATOR_STATE_DIR = 'operator-state';

const KIND_TO_RELATIVE: Record<OperatorWritableKind, string> = {
  'source-intake-approval': `${OPERATOR_STATE_DIR}/source-intake-approval.json`,
  'operator-revision-decisions': `${OPERATOR_STATE_DIR}/revision-decisions.json`,
  'operator-notes': `${OPERATOR_STATE_DIR}/notes.json`,
  'review-selection': `${OPERATOR_STATE_DIR}/review-selection.tsv`
};

export function operatorStateRelativePath(kind: OperatorWritableKind): string {
  if (!Object.prototype.hasOwnProperty.call(KIND_TO_RELATIVE, kind)) {
    throw new WriteBoundaryError('unknown operator-state kind');
  }
  return KIND_TO_RELATIVE[kind];
}

export class WriteBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteBoundaryError';
  }
}

function normalizeRel(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Resolve a relative path inside runDir and ensure it is an allowed operator write.
 * Returns absolute path. Throws WriteBoundaryError otherwise.
 */
export function resolveOperatorWritePath(runDir: string, relativePath: string): string {
  const rel = normalizeRel(relativePath);
  if (!rel || rel.includes('\0')) {
    throw new WriteBoundaryError('empty or invalid relative path');
  }
  if (rel.split('/').some((p) => p === '..')) {
    throw new WriteBoundaryError(`path escapes run folder: ${relativePath}`);
  }

  const resolvedRoot = path.resolve(runDir);
  const resolved = path.resolve(resolvedRoot, rel);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new WriteBoundaryError(`path escapes run folder: ${relativePath}`);
  }

  const posixRel = relative.split(path.sep).join('/');
  const base = path.posix.basename(posixRel);

  // Forbidden generated artifact basenames anywhere
  if (GENERATED_ARTIFACT_BASENAMES.has(base)) {
    throw new WriteBoundaryError(`refusing to write generated artifact: ${posixRel}`);
  }
  if (posixRel.startsWith('llm-cache/') || posixRel === 'llm-cache') {
    throw new WriteBoundaryError(`refusing to write llm-cache: ${posixRel}`);
  }
  if (posixRel.endsWith('.psg') || posixRel.includes('/psg/')) {
    throw new WriteBoundaryError(`refusing to write PSG output: ${posixRel}`);
  }

  // Only operator-state/* (or legacy root intake name remapped)
  const allowedExact = new Set(Object.values(KIND_TO_RELATIVE));
  // Also allow the kind paths only
  if (!posixRel.startsWith(`${OPERATOR_STATE_DIR}/`)) {
    throw new WriteBoundaryError(
      `workbench may only write under ${OPERATOR_STATE_DIR}/ (got ${posixRel})`
    );
  }

  // Disallow nested surprises beyond known files unless review-selection pattern
  const allowedBases = new Set(
    [...allowedExact].map((p) => path.posix.basename(p))
  );
  if (!allowedBases.has(base)) {
    throw new WriteBoundaryError(
      `not an allowlisted operator-state file: ${posixRel}`
    );
  }

  // Double-check kind mapping invert
  const isKnown = [...allowedExact].some((p) => p === posixRel);
  if (!isKnown) {
    throw new WriteBoundaryError(`path not on operator allowlist: ${posixRel}`);
  }

  return resolved;
}

export function isOperatorWritableRelativePath(relativePath: string): boolean {
  try {
    resolveOperatorWritePath(path.resolve('/tmp/fake-run'), relativePath);
    return true;
  } catch {
    return false;
  }
}

/** Property helper: generated artifact paths must all be rejected. */
export function assertRejectsGeneratedWrites(
  runDir: string,
  candidates: string[]
): { rejected: string[]; leaked: string[] } {
  const rejected: string[] = [];
  const leaked: string[] = [];
  for (const c of candidates) {
    try {
      resolveOperatorWritePath(runDir, c);
      leaked.push(c);
    } catch {
      rejected.push(c);
    }
  }
  return { rejected, leaked };
}

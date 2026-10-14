/**
 * Costed-parse reuse policy (S4.2).
 * Existing semantic parse artifacts are reused by default; rerun is explicit.
 */

export interface ParseReuseDecision {
  reuse: boolean;
  reason: string;
  action: 'reuse' | 'run' | 'blocked';
}

export function decideParseReuse(args: {
  /** True when a completed extraction (or equivalent) already exists for this input. */
  hasExistingParse: boolean;
  /** Operator explicitly requested a paid/live reparse. */
  forceRerun?: boolean;
  /** Optional: existing parse is stale vs current model pin. */
  parseStale?: boolean;
}): ParseReuseDecision {
  if (args.forceRerun === true) {
    return {
      reuse: false,
      reason: 'Operator set forceRerun — costed parse will run.',
      action: 'run'
    };
  }
  if (args.hasExistingParse && args.parseStale !== true) {
    return {
      reuse: true,
      reason: 'Existing parse found — reusing by default (no live cost).',
      action: 'reuse'
    };
  }
  if (args.hasExistingParse && args.parseStale === true) {
    return {
      reuse: false,
      reason: 'Existing parse is stale vs model pin — rerun required.',
      action: 'run'
    };
  }
  return {
    reuse: false,
    reason: 'No existing parse — initial run required.',
    action: 'run'
  };
}

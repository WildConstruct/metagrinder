/**
 * Pairwise covering-array construction for review sampling (S4.1).
 * Ensures every pair of (axis_i=value_a, axis_j=value_b) appears in at least
 * one review row — standard software-testing result for interaction coverage
 * without full factorial cost.
 */

export interface CoveringAxis {
  axisId: string;
  /** Choice ids or labels (stable identifiers). */
  values: string[];
}

export interface CoveringRow {
  rowId: string;
  /** axisId → chosen value */
  assignments: Record<string, string>;
}

export interface CoveringArrayResult {
  axes: CoveringAxis[];
  rows: CoveringRow[];
  /** Total distinct pairwise combinations that must appear. */
  pairUniverseSize: number;
  /** Distinct pairs covered by rows (should equal universe when complete). */
  pairsCovered: number;
  complete: boolean;
}

type PairKey = string;

function pairKey(aId: string, aVal: string, bId: string, bVal: string): PairKey {
  // Canonical order of axis ids so (A,B) == (B,A)
  if (aId < bId) return `${aId}=${aVal}|${bId}=${bVal}`;
  return `${bId}=${bVal}|${aId}=${aVal}`;
}

function allPairKeys(axes: CoveringAxis[]): Set<PairKey> {
  const keys = new Set<PairKey>();
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const A = axes[i]!;
      const B = axes[j]!;
      for (const av of A.values) {
        for (const bv of B.values) {
          keys.add(pairKey(A.axisId, av, B.axisId, bv));
        }
      }
    }
  }
  return keys;
}

function pairsCoveredBy(row: Record<string, string>, axes: CoveringAxis[]): Set<PairKey> {
  const covered = new Set<PairKey>();
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const A = axes[i]!;
      const B = axes[j]!;
      const av = row[A.axisId];
      const bv = row[B.axisId];
      if (av !== undefined && bv !== undefined) {
        covered.add(pairKey(A.axisId, av, B.axisId, bv));
      }
    }
  }
  return covered;
}

/**
 * Greedy pairwise covering array.
 * - 0 axes → empty
 * - 1 axis → one row per value
 * - 2+ axes → greedy rows until all pairs covered (or maxRows safety cap)
 */
export function buildPairwiseCoveringArray(
  axes: CoveringAxis[],
  options?: { maxRows?: number; seed?: number }
): CoveringArrayResult {
  const cleaned = axes
    .map((a) => ({
      axisId: a.axisId,
      values: [...new Set(a.values.filter((v) => v.length > 0))]
    }))
    .filter((a) => a.values.length > 0);

  if (cleaned.length === 0) {
    return { axes: [], rows: [], pairUniverseSize: 0, pairsCovered: 0, complete: true };
  }

  if (cleaned.length === 1) {
    const axis = cleaned[0]!;
    const rows = axis.values.map((v, i) => ({
      rowId: `cover_${i}`,
      assignments: { [axis.axisId]: v }
    }));
    return {
      axes: cleaned,
      rows,
      pairUniverseSize: 0,
      pairsCovered: 0,
      complete: true
    };
  }

  const universe = allPairKeys(cleaned);
  const uncovered = new Set(universe);
  const rows: CoveringRow[] = [];
  const maxRows = options?.maxRows ?? Math.max(universe.size, 64);

  // Deterministic "random" for tie-breaking via mulberry32-ish from seed
  let state = (options?.seed ?? 0x9e3779b1) >>> 0;
  const nextRand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  while (uncovered.size > 0 && rows.length < maxRows) {
    // Candidate: for each uncovered pair, build a full row filling remaining axes
    let best: Record<string, string> | undefined;
    let bestGain = -1;

    const uncoveredList = [...uncovered];
    // Sample up to 40 uncovered pairs as seeds for candidate rows (keeps large axes tractable)
    const sampleN = Math.min(40, uncoveredList.length);
    for (let s = 0; s < sampleN; s++) {
      const idx = Math.floor(nextRand() * uncoveredList.length);
      const seedPair = uncoveredList[idx]!;
      // parse seed pair: axis=val|axis=val
      const [left, right] = seedPair.split('|');
      const [aId, aVal] = left!.split('=');
      const [bId, bVal] = right!.split('=');
      const row: Record<string, string> = {
        [aId!]: aVal!,
        [bId!]: bVal!
      };
      for (const axis of cleaned) {
        if (row[axis.axisId] !== undefined) continue;
        // Prefer a value that covers most remaining pairs with already-fixed axes
        let pick = axis.values[0]!;
        let pickScore = -1;
        for (const v of axis.values) {
          let score = 0;
          for (const [oid, ov] of Object.entries(row)) {
            const k = pairKey(axis.axisId, v, oid, ov);
            if (uncovered.has(k)) score += 1;
          }
          // slight deterministic jitter
          score += nextRand() * 0.01;
          if (score > pickScore) {
            pickScore = score;
            pick = v;
          }
        }
        row[axis.axisId] = pick;
      }

      const gain = [...pairsCoveredBy(row, cleaned)].filter((k) => uncovered.has(k)).length;
      if (gain > bestGain) {
        bestGain = gain;
        best = row;
      }
    }

    if (!best || bestGain <= 0) {
      // Fallback: assign first value of each axis for one remaining pair
      const leftover = uncoveredList[0];
      if (!leftover) break;
      const [left, right] = leftover.split('|');
      const [aId, aVal] = left!.split('=');
      const [bId, bVal] = right!.split('=');
      best = { [aId!]: aVal!, [bId!]: bVal! };
      for (const axis of cleaned) {
        if (best[axis.axisId] === undefined) best[axis.axisId] = axis.values[0]!;
      }
      bestGain = [...pairsCoveredBy(best, cleaned)].filter((k) => uncovered.has(k)).length;
      if (bestGain <= 0) break;
    }

    rows.push({
      rowId: `cover_${rows.length}`,
      assignments: best
    });
    for (const k of pairsCoveredBy(best, cleaned)) {
      uncovered.delete(k);
    }
  }

  const pairsCovered = universe.size - uncovered.size;
  return {
    axes: cleaned,
    rows,
    pairUniverseSize: universe.size,
    pairsCovered,
    complete: uncovered.size === 0
  };
}

/**
 * Select plan ids that best cover pairwise axis combinations derived from
 * plan slots (slotKind → value as axis assignment).
 */
export function selectPlansByCoveringArray(args: {
  plans: Array<{ planId: string; slots: Array<{ slotKind: string; value: string }> }>;
  /** Slot kinds to treat as covering axes (default: subject, zone, modifier). */
  axisKinds?: string[];
  maxRows?: number;
  seed?: number;
}): {
  covering: CoveringArrayResult;
  selectedPlanIds: string[];
  /** planId → covering row it satisfies (if any) */
  planToRow: Record<string, string>;
} {
  const kinds = args.axisKinds ?? ['subject', 'zone', 'modifier'];
  const valueSets = new Map<string, Set<string>>();
  for (const k of kinds) valueSets.set(k, new Set());

  const planAssignments = new Map<string, Record<string, string>>();
  for (const plan of args.plans) {
    const assign: Record<string, string> = {};
    for (const slot of plan.slots) {
      if (!kinds.includes(slot.slotKind)) continue;
      // For modifiers, allow multiple by joining sorted unique values under kind
      if (slot.slotKind === 'modifier') {
        const prev = assign.modifier;
        assign.modifier = prev ? [prev, slot.value].sort().join(' + ') : slot.value;
      } else {
        assign[slot.slotKind] = slot.value;
      }
      valueSets.get(slot.slotKind)?.add(assign[slot.slotKind]!);
    }
    if (Object.keys(assign).length > 0) {
      planAssignments.set(plan.planId, assign);
    }
  }

  const axes: CoveringAxis[] = [...valueSets.entries()]
    .filter(([, set]) => set.size > 0)
    .map(([axisId, set]) => ({ axisId, values: [...set].sort() }));

  const covering = buildPairwiseCoveringArray(axes, {
    ...(args.maxRows !== undefined ? { maxRows: args.maxRows } : {}),
    ...(args.seed !== undefined ? { seed: args.seed } : {})
  });

  // Match each covering row to a real plan that agrees on all assigned axes
  const selected: string[] = [];
  const planToRow: Record<string, string> = {};
  const usedPlans = new Set<string>();

  for (const row of covering.rows) {
    let bestPlan: string | undefined;
    let bestScore = -1;
    for (const [planId, assign] of planAssignments) {
      if (usedPlans.has(planId)) continue;
      let score = 0;
      let ok = true;
      for (const [axisId, val] of Object.entries(row.assignments)) {
        if (assign[axisId] === val) score += 1;
        else if (assign[axisId] !== undefined) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (score > bestScore) {
        bestScore = score;
        bestPlan = planId;
      }
    }
    if (bestPlan) {
      usedPlans.add(bestPlan);
      selected.push(bestPlan);
      planToRow[bestPlan] = row.rowId;
    }
  }

  return { covering, selectedPlanIds: selected, planToRow };
}

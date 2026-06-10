/**
 * Seeded deterministic PRNG (mulberry32). Same seed -> same sequence, so a
 * (grammar, seed) pair always yields identical content plans (AC-2.4a).
 * Math.random is never used in sampling.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted pick from parallel items/weights arrays using rng in [0,1). */
export function weightedPick<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return items[0]!;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]!);
    if (r < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

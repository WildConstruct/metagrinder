import type { ExpressiveRangeReport, GenerativeShiftReport } from '../schemas/eval';
import { analyzeExpressiveRange, compareExpressiveRanges } from '../eval/era';
import type { SceneGrammar } from '../schemas';

/**
 * Base-vs-accepted generative shift for the grammar-revision screen (S4.2).
 * Returns structured shift + a self-contained SVG (no charting library).
 */

export interface EraShiftView {
  base: ExpressiveRangeReport;
  accepted: ExpressiveRangeReport;
  shift: GenerativeShiftReport;
  svg: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Horizontal bar chart of archetype share deltas (accepted − base). */
export function svgArchetypeShareDelta(
  shift: GenerativeShiftReport,
  options?: { width?: number; barHeight?: number }
): string {
  const width = options?.width ?? 480;
  const barHeight = options?.barHeight ?? 18;
  const entries = Object.entries(shift.archetypeShareDelta)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 12);
  if (entries.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" role="img" aria-label="No archetype shift">
      <text x="8" y="24" fill="#8b9aab" font-size="12" font-family="system-ui,sans-serif">No archetype share delta</text>
    </svg>`;
  }
  const maxAbs = Math.max(...entries.map(([, d]) => Math.abs(d)), 0.01);
  const mid = width / 2;
  const labelW = 140;
  const height = 28 + entries.length * (barHeight + 6);
  const bars = entries.map(([id, delta], i) => {
    const y = 24 + i * (barHeight + 6);
    const mag = (Math.abs(delta) / maxAbs) * (mid - labelW - 16);
    const x = delta >= 0 ? mid : mid - mag;
    const color = delta >= 0 ? '#3dd68c' : '#f07178';
    const label = id.length > 22 ? `${id.slice(0, 20)}…` : id;
    const pct = `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}pp`;
    return `
      <text x="4" y="${y + barHeight - 5}" fill="#c5d0db" font-size="11" font-family="ui-monospace,monospace">${esc(label)}</text>
      <rect x="${x}" y="${y}" width="${Math.max(mag, 1)}" height="${barHeight}" fill="${color}" rx="3"/>
      <text x="${delta >= 0 ? mid + mag + 4 : x - 4}" y="${y + barHeight - 5}"
        fill="#8b9aab" font-size="10" font-family="system-ui,sans-serif"
        text-anchor="${delta >= 0 ? 'start' : 'end'}">${pct}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img"
    aria-label="Archetype share delta base vs accepted">
    <rect width="100%" height="100%" fill="#121920"/>
    <line x1="${mid}" y1="18" x2="${mid}" y2="${height - 4}" stroke="#2c3845" stroke-dasharray="3 3"/>
    <text x="${mid}" y="14" fill="#59c2ff" font-size="11" font-family="system-ui,sans-serif" text-anchor="middle">
      base ← → accepted (TVD ${(shift.totalVariationDistance * 100).toFixed(1)}%)
    </text>
    ${bars}
  </svg>`;
}

export function computeEraShiftView(args: {
  baseGrammar: SceneGrammar;
  acceptedGrammar: SceneGrammar;
  seed?: number;
  sampleCount?: number;
}): EraShiftView {
  const seed = args.seed ?? 42;
  const sampleCount = args.sampleCount ?? 200;
  const base = analyzeExpressiveRange(args.baseGrammar, { seed, sampleCount });
  const accepted = analyzeExpressiveRange(args.acceptedGrammar, { seed, sampleCount });
  const shift = compareExpressiveRanges(base, accepted);
  return {
    base,
    accepted,
    shift,
    svg: svgArchetypeShareDelta(shift)
  };
}

/**
 * Deterministic structural chunker (S2.1).
 *
 * Splits a document into paragraph chunks that carry EXACT byte spans into the
 * canonical (newline-normalized) source text, so provenance can later be
 * verified by substring match (`canonical.slice(start, end) === chunk.text`).
 *
 * What it deliberately does NOT do: classify chunk *kind* or research domain.
 * The legacy ingest folded keyword/taxonomy heuristics (wardrobe, atmosphere,
 * "contradiction avoidance") in here; that is semantic work and moves to the
 * extract stage. This module only does structure: paragraph boundaries and
 * structurally-marked section headings.
 */

export interface RawChunk {
  text: string;
  start: number;
  end: number;
  sectionLabel?: string;
}

/** Universal newlines: spans index into this canonical form. */
export function normalizeNewlines(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Blank line (optionally whitespace-only) separating paragraphs. */
const PARAGRAPH_SEPARATOR = /\n[ \t]*(?:\n[ \t]*)+/g;

const isWhitespace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

/** Structural heading detection on a chunk's first line. Vocabulary-free. */
export function detectSectionLabel(text: string): string | undefined {
  const firstLine = (text.split('\n')[0] ?? '').trim();
  if (/^#{1,6}\s+/.test(firstLine)) {
    return firstLine.replace(/^#{1,6}\s+/, '').trim();
  }
  if (/^[IVXLC]+\.\s+[A-Z]/.test(firstLine)) {
    return firstLine;
  }
  if (/^[A-Z]\.\s+The\s+/.test(firstLine)) {
    return firstLine;
  }
  if (/^[A-Z][A-Za-z0-9 /'(),-]{2,80}:$/.test(firstLine)) {
    return firstLine.replace(/:$/, '').trim();
  }
  return undefined;
}

function isHeadingOnly(text: string, label: string | undefined): boolean {
  if (!label) return false;
  const normalized = text.replace(/^#{1,6}\s*/, '').replace(/:$/, '').trim();
  return normalized === label;
}

/**
 * Returns paragraph chunks with verbatim text and exact [start, end) offsets
 * into `canonical`. A heading on its own paragraph updates the active section
 * label and emits no chunk; a heading that leads a multi-line paragraph stays
 * verbatim in the chunk text (so the span invariant holds) and sets the label.
 */
export function chunkText(canonical: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  let activeSection: string | undefined;

  const pushSegment = (segStart: number, segEnd: number): void => {
    let start = segStart;
    let end = segEnd;
    while (start < end && isWhitespace(canonical[start])) start++;
    while (end > start && isWhitespace(canonical[end - 1])) end--;
    if (end <= start) return;

    const text = canonical.slice(start, end);
    const label = detectSectionLabel(text);
    if (label) activeSection = label;
    if (isHeadingOnly(text, label)) return;

    chunks.push(
      activeSection === undefined
        ? { text, start, end }
        : { text, start, end, sectionLabel: activeSection }
    );
  };

  PARAGRAPH_SEPARATOR.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = PARAGRAPH_SEPARATOR.exec(canonical)) !== null) {
    pushSegment(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  pushSegment(cursor, canonical.length);
  return chunks;
}

/** Deterministic title: first markdown heading, else first non-empty line. */
export function deriveTitle(canonical: string, fallback: string): string {
  const lines = canonical.split('\n').map((l) => l.trim()).filter(Boolean);
  const heading = lines.find((l) => /^#{1,6}\s+/.test(l));
  if (heading) return heading.replace(/^#{1,6}\s+/, '').trim();
  if (lines.length > 0) return lines[0]!.slice(0, 96);
  return fallback;
}

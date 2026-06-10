import * as fs from 'node:fs';
import * as path from 'node:path';
import { SourcePackageSchema, type SourcePackage } from '../../schemas';
import { normalizeNewlines } from './chunk';
import { ingestPhotoObservations, ingestText } from './index';

const NOW = '2026-06-10T12:00:00.000Z';
const base = { runId: 'run_ingest', inputId: 'input_ingest', createdAt: NOW };

/** The core invariant: every chunk's span slices back to its exact text. */
function assertSpanInvariant(pkg: SourcePackage, canonicalByInput: Map<string, string>): void {
  for (const chunk of pkg.chunks) {
    const canonical = canonicalByInput.get(chunk.sourceInputId);
    expect(canonical).toBeDefined();
    expect(canonical!.slice(chunk.span.start, chunk.span.end)).toBe(chunk.text);
  }
}

describe('ingest: text mode (S2.1)', () => {
  test('[AC-2.1a] every chunk span slices back to its exact text', () => {
    const rawText = [
      '# Street Scene',
      '',
      '## Wardrobe Notes',
      '',
      'Spectators wore wool overcoats.',
      'Most carried umbrellas.',
      '',
      'The marquee glowed over the damp pavement.'
    ].join('\n');

    const pkg = ingestText({ ...base, sources: [{ title: 'Scene', rawText }] });
    const canonical = new Map([[pkg.sourceInputs[0]!.sourceInputId, normalizeNewlines(rawText)]]);
    assertSpanInvariant(pkg, canonical);
  });

  test('span invariant holds with CRLF and mixed newlines', () => {
    const rawText = 'First paragraph line one.\r\nstill paragraph one.\r\n\r\nSecond paragraph.';
    const pkg = ingestText({ ...base, sources: [{ rawText }] });
    const canonical = new Map([[pkg.sourceInputs[0]!.sourceInputId, normalizeNewlines(rawText)]]);
    assertSpanInvariant(pkg, canonical);
    // CRLF normalized: internal newline preserved verbatim inside the first chunk
    expect(pkg.chunks[0]!.text).toBe('First paragraph line one.\nstill paragraph one.');
    expect(pkg.chunks).toHaveLength(2);
  });

  test('heading-only paragraph sets section label but emits no chunk', () => {
    const rawText = '## Wardrobe Notes\n\nSpectators wore wool overcoats.';
    const pkg = ingestText({ ...base, sources: [{ rawText }] });
    expect(pkg.chunks).toHaveLength(1);
    expect(pkg.chunks[0]!.text).toBe('Spectators wore wool overcoats.');
    expect(pkg.chunks[0]!.sectionLabel).toBe('Wardrobe Notes');
  });

  test('chunkKind is left unknown — no semantic classification in ingest', () => {
    const rawText = 'If the crowd is dense, increase overcoat probability weighting.';
    const pkg = ingestText({ ...base, sources: [{ rawText }] });
    expect(pkg.chunks[0]!.chunkKind).toBe('unknown');
  });

  test('content-hash chunk ids are stable and span-independent', () => {
    const a = ingestText({ ...base, sources: [{ rawText: 'Alpha para.\n\nBeta para.' }] });
    // same paragraphs, extra leading blank lines shift offsets but not identity
    const b = ingestText({ ...base, sources: [{ rawText: '\n\nAlpha para.\n\nBeta para.' }] });
    expect(a.chunks.map((c) => c.chunkId)).toEqual(b.chunks.map((c) => c.chunkId));
    expect(a.chunks[0]!.span.start).not.toBe(b.chunks[0]!.span.start);
  });

  test('derives title from first heading; multi-source titling', () => {
    const single = ingestText({ ...base, sources: [{ rawText: '# Broadway Crowd\n\nText here.' }] });
    expect(single.title).toBe('Broadway Crowd');
    const multi = ingestText({
      ...base,
      sources: [
        { title: 'A', rawText: 'alpha.' },
        { title: 'B', rawText: 'beta.' }
      ]
    });
    expect(multi.title).toBe('A and 1 more sources');
    expect(multi.sourceInputs).toHaveLength(2);
  });

  test('empty input throws rather than emitting an invalid package', () => {
    expect(() => ingestText({ ...base, sources: [{ rawText: '   \n\n  ' }] })).toThrow(/no chunks/);
  });

  test('real corpus brief ingests and satisfies the span invariant', () => {
    const briefPath = path.resolve(__dirname, '../../eval/corpus/briefs/broadway.txt');
    const rawText = fs.readFileSync(briefPath, 'utf8');
    const pkg = ingestText({ ...base, title: 'broadway', sources: [{ path: briefPath, rawText }] });
    expect(pkg.chunks.length).toBeGreaterThan(0);
    const canonical = new Map([[pkg.sourceInputs[0]!.sourceInputId, normalizeNewlines(rawText)]]);
    assertSpanInvariant(pkg, canonical);
    // re-validates through the schema
    expect(() => SourcePackageSchema.parse(pkg)).not.toThrow();
  });
});

describe('ingest: photo-observation mode (S2.1)', () => {
  test('[AC-2.1b] photo records produce span-valid chunks with structural kinds', () => {
    const pkg = ingestPhotoObservations({
      ...base,
      records: [{
        recordId: 'indy_1909_grandstand_a',
        caption: '1909 Indianapolis grandstand, section A',
        observations: [
          { text: 'Dense crowd of seated spectators in straw boaters and light suits.', kind: 'photo-observation' },
          { text: 'Black-and-white plate; color of hatbands not determinable.', kind: 'color-hypothesis' }
        ]
      }]
    });
    expect(pkg.sourceInputs[0]!.sourceType).toBe('photo-reference');
    expect(pkg.chunks).toHaveLength(2);
    expect(pkg.chunks[0]!.chunkKind).toBe('photo-observation');
    expect(pkg.chunks[1]!.chunkKind).toBe('color-hypothesis');

    const canonicalByInput = new Map(
      pkg.sourceInputs.map((si) => [
        si.sourceInputId,
        pkg.chunks.filter((c) => c.sourceInputId === si.sourceInputId).map((c) => c.text).join('\n\n')
      ])
    );
    for (const chunk of pkg.chunks) {
      const canonical = canonicalByInput.get(chunk.sourceInputId)!;
      expect(canonical.slice(chunk.span.start, chunk.span.end)).toBe(chunk.text);
    }
  });

  test('photo and text modes yield the same SourceChunk shape', () => {
    const photo = ingestPhotoObservations({
      ...base,
      records: [{ recordId: 'r1', observations: [{ text: 'A worn combination of vest and shirtsleeves.' }] }]
    });
    const textPkg = ingestText({ ...base, sources: [{ rawText: 'A worn combination of vest and shirtsleeves.' }] });
    const keysOf = (o: object) => Object.keys(o).sort();
    expect(keysOf(photo.chunks[0]!)).toEqual(keysOf(textPkg.chunks[0]!));
    expect(photo.chunks[0]!.chunkKind).toBe('photo-observation'); // adapter knows what it rendered
    expect(textPkg.chunks[0]!.chunkKind).toBe('unknown'); // text classification deferred
  });
});

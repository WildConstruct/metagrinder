import {
  SourcePackageSchema,
  type ChunkKind,
  type SourceChunk,
  type SourceInput,
  type SourcePackage
} from '../../schemas';
import { deriveChunkIds, deriveSourceInputId, sha256Hex } from '../../artifacts/ids';
import { chunkText, deriveTitle, normalizeNewlines } from './chunk';

/**
 * Ingest stage (S2.1): raw input -> validated SourcePackage with span-indexed,
 * content-hash-identified chunks. Input-mode-agnostic downstream: text briefs
 * and photo-observation packets both produce the same SourceChunk shape, so
 * later stages never branch on input mode.
 *
 * Invariant (AC-2.1a): for every chunk, the [start,end) slice of its source
 * input's canonical text equals chunk.text exactly.
 */

export interface TextSourceInput {
  title?: string;
  path?: string;
  rawText: string;
}

export interface PhotoObservation {
  text: string;
  kind?: ChunkKind;
  sectionLabel?: string;
}

export interface PhotoRecordInput {
  recordId: string;
  caption?: string;
  path?: string;
  observations: PhotoObservation[];
}

interface BuiltSource {
  sourceInput: SourceInput;
  canonicalText: string;
  chunks: SourceChunk[];
}

function envelope(opts: { runId: string; inputId: string; createdAt: string }) {
  return {
    artifact: 'source-package' as const,
    runId: opts.runId,
    inputId: opts.inputId,
    createdAt: opts.createdAt
  };
}

function buildTextSource(source: TextSourceInput, sequence: number): BuiltSource {
  const canonicalText = normalizeNewlines(source.rawText);
  const sourceInputId = deriveSourceInputId(canonicalText);
  const raw = chunkText(canonicalText);
  if (raw.length === 0) {
    throw new Error(`ingest: source produced no chunks (empty or whitespace-only input): ${source.path ?? source.title ?? sourceInputId}`);
  }
  const chunkIds = deriveChunkIds(sourceInputId, raw.map((c) => c.text));
  const chunks: SourceChunk[] = raw.map((c, i) => ({
    chunkId: chunkIds[i]!,
    sourceInputId,
    text: c.text,
    span: { start: c.start, end: c.end },
    ...(c.sectionLabel !== undefined ? { sectionLabel: c.sectionLabel } : {}),
    chunkKind: 'unknown' as const,
    sequence: i,
    tags: []
  }));
  return {
    sourceInput: {
      sourceInputId,
      title: source.title ?? deriveTitle(canonicalText, source.path ?? sourceInputId),
      sourceType: 'plain-text',
      ...(source.path !== undefined ? { path: source.path } : {}),
      contentSha256: sha256Hex(canonicalText),
      sequence
    },
    canonicalText,
    chunks
  };
}

function buildPhotoSource(record: PhotoRecordInput, sequence: number): BuiltSource {
  if (record.observations.length === 0) {
    throw new Error(`ingest: photo record has no observations: ${record.recordId}`);
  }
  // Assemble a canonical text so the span invariant holds uniformly with text mode.
  const SEP = '\n\n';
  let cursor = 0;
  const placed = record.observations.map((obs, i) => {
    const start = cursor;
    const end = start + obs.text.length;
    cursor = end + (i < record.observations.length - 1 ? SEP.length : 0);
    return { obs, start, end };
  });
  const canonicalText = record.observations.map((o) => o.text).join(SEP);
  const sourceInputId = deriveSourceInputId(`photo:${record.recordId}\n${canonicalText}`);
  const chunkIds = deriveChunkIds(sourceInputId, placed.map((p) => p.obs.text));
  const chunks: SourceChunk[] = placed.map((p, i) => ({
    chunkId: chunkIds[i]!,
    sourceInputId,
    text: p.obs.text,
    span: { start: p.start, end: p.end },
    ...(p.obs.sectionLabel !== undefined ? { sectionLabel: p.obs.sectionLabel } : {}),
    chunkKind: p.obs.kind ?? 'photo-observation',
    sequence: i,
    tags: []
  }));
  return {
    sourceInput: {
      sourceInputId,
      title: record.caption ?? record.recordId,
      sourceType: 'photo-reference',
      ...(record.path !== undefined ? { path: record.path } : {}),
      contentSha256: sha256Hex(canonicalText),
      sequence
    },
    canonicalText,
    chunks
  };
}

function assemble(
  opts: { runId: string; inputId: string; title?: string; createdAt: string },
  built: BuiltSource[],
  fallbackTitleSource: string
): SourcePackage {
  const title = opts.title
    ?? (built.length === 1 ? built[0]!.sourceInput.title : `${built[0]!.sourceInput.title} and ${built.length - 1} more sources`);
  return SourcePackageSchema.parse({
    ...envelope(opts),
    title: title || fallbackTitleSource,
    researchKind: 'unknown',
    sourceInputs: built.map((b) => b.sourceInput),
    chunks: built.flatMap((b) => b.chunks)
  });
}

/** Canonical text for a source input (for span verification by callers/tests). */
export function ingestText(opts: {
  runId: string;
  inputId: string;
  title?: string;
  createdAt: string;
  sources: TextSourceInput[];
}): SourcePackage {
  if (opts.sources.length === 0) throw new Error('ingest: no sources provided');
  const built = opts.sources.map((s, i) => buildTextSource(s, i));
  return assemble(opts, built, opts.inputId);
}

export function ingestPhotoObservations(opts: {
  runId: string;
  inputId: string;
  title?: string;
  createdAt: string;
  records: PhotoRecordInput[];
}): SourcePackage {
  if (opts.records.length === 0) throw new Error('ingest: no photo records provided');
  const built = opts.records.map((r, i) => buildPhotoSource(r, i));
  return assemble(opts, built, opts.inputId);
}

export { chunkText, deriveTitle, normalizeNewlines } from './chunk';

import { z } from 'zod';
import { artifactEnvelope } from './provenance';
import { ChunkKindSchema, ResearchKindSchema, SourceTypeSchema } from './vocabulary';

/**
 * source-package: what the user supplied and how it was segmented.
 * Collapses legacy ingest + photo-observation ingest into one input-mode-aware artifact.
 * Chunk IDs are content-derived (S1.4); `span` locates the chunk inside its source input.
 */

export const SourceInputSchema = z.object({
  sourceInputId: z.string(),
  title: z.string(),
  sourceType: SourceTypeSchema.default('plain-text'),
  path: z.string().optional(),
  contentSha256: z.string().optional(),
  sequence: z.number().int().nonnegative()
});
export type SourceInput = z.infer<typeof SourceInputSchema>;

export const SourceChunkSchema = z.object({
  chunkId: z.string(),
  sourceInputId: z.string(),
  text: z.string().min(1),
  /** [start, end) byte offsets of `text` within the raw source input. */
  span: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative()
  }),
  sectionLabel: z.string().optional(),
  chunkKind: ChunkKindSchema.default('unknown'),
  sequence: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([])
});
export type SourceChunk = z.infer<typeof SourceChunkSchema>;

export const SourcePackageSchema = artifactEnvelope('source-package').extend({
  title: z.string(),
  researchKind: ResearchKindSchema.default('unknown'),
  sourceInputs: z.array(SourceInputSchema).min(1),
  chunks: z.array(SourceChunkSchema).min(1)
});
export type SourcePackage = z.infer<typeof SourcePackageSchema>;

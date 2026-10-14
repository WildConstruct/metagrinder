import { z } from 'zod';
import { ConfidenceSummarySchema } from './provenance';
import { ReviewStatusSchema } from './vocabulary';

/**
 * research-package.json: the manifest over a run's emitted collections.
 * Families are the collapsed set; see COLLAPSE-MAP.md for legacy mapping.
 */

export const ArtifactFamilySchema = z.enum([
  'source-package',
  'extraction',
  'scene-grammar',
  'semantic-choice-graph',
  'gap-registry',
  'research-campaign',
  'retrieval',
  'source-lifecycle',
  'revisions',
  'accepted-scene-grammar',
  'content-plans',
  'psg',
  'psg-compile-diff',
  'utdg-candidates',
  'import-receipt',
  'review-report',
  'eval-report',
  'run-manifest'
]);
export type ArtifactFamily = z.infer<typeof ArtifactFamilySchema>;

export const PackageCollectionSchema = z.object({
  id: z.string(),
  family: ArtifactFamilySchema,
  path: z.string(),
  /** Required by handoff sealing; optional only to read older draft manifests. */
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/).optional()
});

export const ResearchPackageManifestSchema = z.object({
  artifact: z.literal('research-package'),
  schemaVersion: z.string().default('0.1.0'),
  packageId: z.string(),
  runId: z.string(),
  inputId: z.string(),
  title: z.string(),
  createdAt: z.string().datetime(),
  parserVersion: z.string(),
  strategyVersion: z.string().optional(),
  sourceInputIds: z.array(z.string()).default([]),
  collections: z.array(PackageCollectionSchema).default([]),
  confidenceSummary: ConfidenceSummarySchema.optional(),
  reviewStatus: ReviewStatusSchema.default('draft')
});
export type ResearchPackageManifest = z.infer<typeof ResearchPackageManifestSchema>;

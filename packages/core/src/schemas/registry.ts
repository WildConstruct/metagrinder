import type { z } from 'zod';
import { CampaignSchema } from './campaign';
import { ChoiceGraphSchema } from './choice-graph';
import { ContentPlansSchema } from './content-plan';
import { ExtractionSchema } from './extraction';
import { GapRegistrySchema } from './gap-registry';
import { ResearchPackageManifestSchema } from './package-manifest';
import { ImportReceiptSchema } from './receipts';
import { RetrievalSchema } from './retrieval';
import { RevisionsSchema } from './revisions';
import { RunManifestSchema } from './run-manifest';
import { SceneGrammarSchema } from './scene-grammar';
import { SourceLifecycleSchema } from './source-lifecycle';
import { SourcePackageSchema } from './source-package';
import { UtdgCandidatesSchema } from './utdg';

/**
 * The one family -> schema map. Used by the artifact store (validation at the
 * write/read boundary) and the JSON Schema emitter. Families without a schema
 * yet (psg, psg-compile-diff, eval-report, review-report, accepted-scene-grammar
 * alias) are added by their owning stories.
 */
export const ARTIFACT_SCHEMAS = {
  'source-package': SourcePackageSchema,
  'extraction': ExtractionSchema,
  'scene-grammar': SceneGrammarSchema,
  'accepted-scene-grammar': SceneGrammarSchema,
  'semantic-choice-graph': ChoiceGraphSchema,
  'source-lifecycle': SourceLifecycleSchema,
  'revisions': RevisionsSchema,
  'retrieval': RetrievalSchema,
  'gap-registry': GapRegistrySchema,
  'research-campaign': CampaignSchema,
  'content-plans': ContentPlansSchema,
  'run-manifest': RunManifestSchema,
  'research-package': ResearchPackageManifestSchema,
  'utdg-candidates': UtdgCandidatesSchema,
  'import-receipt': ImportReceiptSchema
} satisfies Record<string, z.ZodTypeAny>;

export type StoredArtifactFamily = keyof typeof ARTIFACT_SCHEMAS;

export function schemaFor(family: string): z.ZodTypeAny | undefined {
  return (ARTIFACT_SCHEMAS as Record<string, z.ZodTypeAny>)[family];
}

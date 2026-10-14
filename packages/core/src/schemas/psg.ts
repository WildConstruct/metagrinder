import { z } from 'zod';
import { artifactEnvelope } from './provenance';

const NonemptyString = z.string().min(1).regex(/\S/, 'must not be blank');
const ContentHash = z.string().regex(/^[a-f0-9]{64}$/, 'must be a lowercase SHA-256 hash');

export const PsgOptionSchema = z.object({
  text: z.string(),
  weight: z.number().finite().nonnegative()
});
export type PsgOption = z.infer<typeof PsgOptionSchema>;

/** Keep the existing builder API; validate the type-specific payload at runtime. */
export const PsgNodeSchema = z.object({
  id: NonemptyString,
  type: z.enum(['TextBlock', 'WeightedChoice', 'Output']),
  x: z.number().finite(),
  y: z.number().finite(),
  name: z.string(),
  value: z.string().optional(),
  options: z.array(PsgOptionSchema).min(1).optional(),
  template: NonemptyString.optional()
}).superRefine((node, context) => {
  const required = node.type === 'TextBlock' ? 'value' : node.type === 'WeightedChoice' ? 'options' : 'template';
  for (const payload of ['value', 'options', 'template'] as const) {
    if ((payload === required) !== (node[payload] !== undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [payload], message: `${node.type} requires only its ${required} payload` });
    }
  }
});
export type PsgNode = z.infer<typeof PsgNodeSchema>;

export const PsgEdgeSchema = z.object({
  id: NonemptyString,
  source: NonemptyString,
  target: NonemptyString,
  sourceHandle: z.string().optional()
});
export type PsgEdge = z.infer<typeof PsgEdgeSchema>;

export const PsgRegionSchema = z.object({
  id: NonemptyString,
  name: z.string(),
  color: z.string(),
  nodes: z.array(NonemptyString),
  description: z.string().optional()
});
export type PsgRegion = z.infer<typeof PsgRegionSchema>;

const NativeMetadataSchema = z.object({
  type: z.string(),
  source: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string()
}).passthrough();

const NativeFileShape = z.object({
  version: z.literal('1.0.0'),
  name: z.string(),
  description: z.string(),
  metadata: NativeMetadataSchema,
  nodes: z.array(PsgNodeSchema),
  edges: z.array(PsgEdgeSchema),
  regions: z.array(PsgRegionSchema)
});

function validateGraph(graph: z.infer<typeof NativeFileShape>, context: z.RefinementCtx): void {
  for (const collection of ['nodes', 'edges', 'regions'] as const) {
    const ids = new Set<string>();
    graph[collection].forEach((record, index) => {
      if (ids.has(record.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [collection, index, 'id'], message: `duplicate ${collection} ID: ${record.id}` });
      }
      ids.add(record.id);
    });
  }
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  graph.edges.forEach((edge, index) => {
    for (const endpoint of ['source', 'target'] as const) {
      if (!nodeIds.has(edge[endpoint])) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['edges', index, endpoint], message: `edge ${endpoint} does not resolve: ${edge[endpoint]}` });
      }
    }
  });
  graph.regions.forEach((region, index) => {
    const members = new Set<string>();
    region.nodes.forEach((nodeId, member) => {
      if (!nodeIds.has(nodeId) || members.has(nodeId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['regions', index, 'nodes', member], message: 'region membership must be unique and resolve to a node' });
      }
      members.add(nodeId);
    });
  });
}

/** Native flat PSG document: no Metagrinder root envelope is added. */
export const PsgFileSchema = NativeFileShape.superRefine(validateGraph);
export type PsgFile = z.infer<typeof PsgFileSchema>;

export const PsgSourceGrammarReferenceSchema = z.object({
  family: z.enum(['scene-grammar', 'accepted-scene-grammar']),
  path: NonemptyString,
  contentSha256: ContentHash
});
export type PsgSourceGrammarReference = z.infer<typeof PsgSourceGrammarReferenceSchema>;

export const PsgCompilerBindingSchema = z.object({
  runId: NonemptyString,
  inputId: NonemptyString,
  grammarTarget: z.enum(['base', 'accepted']),
  compilerVersion: NonemptyString,
  sourceGrammar: PsgSourceGrammarReferenceSchema,
  reviewFlags: z.array(z.string()),
  limitations: z.array(z.string())
}).superRefine((binding, context) => {
  const expectedFamily = binding.grammarTarget === 'base' ? 'scene-grammar' : 'accepted-scene-grammar';
  if (binding.sourceGrammar.family !== expectedFamily) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceGrammar', 'family'], message: 'source grammar family must match grammarTarget' });
  }
});
export type PsgCompilerBinding = z.infer<typeof PsgCompilerBindingSchema>;

/** Stored PSG extends native metadata, preserving any other native metadata. */
export const PsgArtifactSchema = NativeFileShape.extend({
  metadata: NativeMetadataSchema.extend({
    type: z.literal('ASSET_FRAGMENT'),
    source: z.literal('metagrinder'),
    metagrinder: PsgCompilerBindingSchema
  }).passthrough()
}).superRefine(validateGraph);
export type PsgArtifact = z.infer<typeof PsgArtifactSchema>;

const PsgGraphReferenceSchema = z.object({
  graphKey: NonemptyString,
  path: NonemptyString,
  contentSha256: ContentHash
});

export const PsgCompileDiffSchema = artifactEnvelope('psg-compile-diff').extend({
  compilerVersion: NonemptyString,
  comparisonScope: z.literal('compiled-structure-only'),
  sourceGrammars: z.object({
    base: PsgSourceGrammarReferenceSchema.extend({ family: z.literal('scene-grammar') }),
    accepted: PsgSourceGrammarReferenceSchema.extend({ family: z.literal('accepted-scene-grammar') })
  }),
  baseGraphs: z.array(PsgGraphReferenceSchema),
  acceptedGraphs: z.array(PsgGraphReferenceSchema),
  changes: z.array(z.object({
    graphKey: NonemptyString,
    section: z.enum(['graph', 'node', 'edge', 'region']),
    recordId: NonemptyString.optional(),
    changeType: z.enum(['added', 'removed', 'changed']),
    before: z.unknown().optional(),
    after: z.unknown().optional()
  })),
  materialDifference: z.boolean(),
  notes: z.array(z.string())
}).refine((diff) => diff.materialDifference === (diff.changes.length > 0), {
  path: ['materialDifference'], message: 'materialDifference must agree with whether compiled changes exist'
});
export type PsgCompileDiff = z.infer<typeof PsgCompileDiffSchema>;

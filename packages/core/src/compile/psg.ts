import { z } from 'zod';

/**
 * Flat Prompt Spaghetti fragment file — the compiler's output contract.
 * Validation-only: node/edge/region builders construct objects in an EXACT
 * key order to preserve byte-identity with captured golden output, so the
 * compiler serializes its hand-built objects rather than reparsed ones.
 */

export const PsgOptionSchema = z.object({
  text: z.string(),
  weight: z.number()
});
export type PsgOption = z.infer<typeof PsgOptionSchema>;

export const PsgNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['TextBlock', 'WeightedChoice', 'Output']),
  x: z.number(),
  y: z.number(),
  name: z.string(),
  value: z.string().optional(),
  options: z.array(PsgOptionSchema).optional(),
  template: z.string().optional()
});
export type PsgNode = z.infer<typeof PsgNodeSchema>;

export const PsgEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional()
});
export type PsgEdge = z.infer<typeof PsgEdgeSchema>;

export const PsgRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  nodes: z.array(z.string()),
  description: z.string().optional()
});

export const PsgFileSchema = z.object({
  version: z.literal('1.0.0'),
  name: z.string(),
  description: z.string(),
  metadata: z.object({
    type: z.string(),
    source: z.string(),
    tags: z.array(z.string()),
    createdAt: z.string()
  }).passthrough(),
  nodes: z.array(PsgNodeSchema),
  edges: z.array(PsgEdgeSchema),
  regions: z.array(PsgRegionSchema)
});
export type PsgFile = z.infer<typeof PsgFileSchema>;

const MAX_OPTION_TEXT_LENGTH = 72;
const MAX_TEXT_BLOCK_LENGTH = 240;
const MAX_OPTIONS_PER_CHOICE_NODE = 6;

export interface ChoiceInput {
  id?: string;
  text: string;
  weight?: number;
}

/** Ported verbatim from the legacy compiler (compactText). */
export function compactText(value: string, maxLength = MAX_OPTION_TEXT_LENGTH): string {
  const text = String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`.slice(0, maxLength);
}

export function choiceWeightFromRange(range?: { min: number; max: number }): number {
  return range ? Math.max(1, Number(((range.min + range.max) / 2).toFixed(2))) : 1;
}

function psgOptions(choices: ChoiceInput[], maxOptions = MAX_OPTIONS_PER_CHOICE_NODE): PsgOption[] {
  return choices.slice(0, maxOptions).map((choice, index) => {
    const text = compactText(choice.text || '', MAX_OPTION_TEXT_LENGTH) || 'review needed';
    const weight = Number.isFinite(Number(choice.weight)) ? Number(choice.weight) : 1;
    // exact key order: text, weight
    void (choice.id ?? `choice_${index + 1}`);
    return { text, weight };
  });
}

// Node builders emit keys in the golden order: id, type, x, y, name, <payload>.
export function textNode(o: { id: string; name: string; value: string; x: number; y: number }): PsgNode {
  return { id: o.id, type: 'TextBlock', x: o.x, y: o.y, name: o.name, value: compactText(o.value, MAX_TEXT_BLOCK_LENGTH) };
}

export function weightedChoiceNode(o: {
  id: string; name: string; choices: ChoiceInput[]; x: number; y: number; maxOptions?: number;
}): PsgNode {
  const safe = o.choices.length > 0 ? o.choices : [{ text: `${o.name} needs reviewed choices`, weight: 1 }];
  return { id: o.id, type: 'WeightedChoice', x: o.x, y: o.y, name: o.name, options: psgOptions(safe, o.maxOptions) };
}

export function outputNode(o: { id: string; name: string; x: number; y: number }): PsgNode {
  return { id: o.id, type: 'Output', x: o.x, y: o.y, name: o.name, template: '{prompt}' };
}

export function directLinearEdges(nodeIds: string[]): PsgEdge[] {
  return nodeIds.slice(0, -1).map((source, index) => ({
    id: `edge-${source}-${nodeIds[index + 1]}`,
    source,
    target: nodeIds[index + 1]!
  }));
}

export function flatPsgFile(o: {
  name: string;
  description: string;
  createdAt: string;
  nodes: PsgNode[];
  edges: PsgEdge[];
  regions?: PsgFile['regions'];
  metadata?: Record<string, unknown>;
}): PsgFile {
  const file: PsgFile = {
    version: '1.0.0',
    name: o.name,
    description: o.description,
    metadata: {
      type: 'ASSET_FRAGMENT',
      source: 'metagrinder',
      tags: ['metagrinder', 'scene-grammar'],
      createdAt: o.createdAt,
      ...(o.metadata ?? {})
    },
    nodes: o.nodes,
    edges: o.edges,
    regions: o.regions ?? []
  };
  PsgFileSchema.parse(file); // validate shape; serialize the hand-built object for byte-identity
  return file;
}

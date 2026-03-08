/**
 * PSGLib File Format Implementation
 * Version 1.0.0 with PM requirements for analytics and future-proofing
 */

import { z } from 'zod';

// PSGLib metadata schema with PM requirements
export const PSGLibMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
  version: z.string(),
  tags: z.array(z.string()),
  nodeTypes: z.array(z.string()),
  thumbnail: z.string().optional(),
  lastModified: z.string(),

  // PM Requirement: Future-proofing for marketplace
  license: z
    .enum(['MIT', 'CC-BY', 'CC-BY-SA', 'CC0', 'proprietary', 'custom'])
    .default('MIT'),

  // PM Requirement: Analytics tracking
  usageStats: z
    .object({
      timesUsed: z.number().default(0),
      lastUsed: z.string().nullable().default(null),
      popularity: z.number().default(0)
    })
    .default({
      timesUsed: 0,
      lastUsed: null,
      popularity: 0
    }),

  // PM Requirement: Reserved for future marketplace
  marketplace: z
    .object({
      price: z.number().nullable().default(null),
      rating: z.number().nullable().default(null),
      downloads: z.number().default(0)
    })
    .optional()
});

// Node schema (matching PSG format)
export const PSGLibNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: z.record(z.any()),
  size: z
    .object({
      width: z.number(),
      height: z.number()
    })
    .optional(),
  style: z.record(z.any()).optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional()
});

// Edge schema (matching PSG format)
export const PSGLibEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  data: z.record(z.any()).optional()
});

// Complete PSGLib file schema
export const PSGLibFileSchema = z.object({
  fileType: z.literal('psglib'),
  formatVersion: z.string().regex(/^\d+\.\d+\.\d+$/), // Semantic versioning
  metadata: PSGLibMetadataSchema,
  graph: z.object({
    nodes: z.array(PSGLibNodeSchema),
    edges: z.array(PSGLibEdgeSchema),
    settings: z.record(z.any()).optional()
  })
});

export type PSGLibFile = z.infer<typeof PSGLibFileSchema>;
export type PSGLibMetadata = z.infer<typeof PSGLibMetadataSchema>;
export type PSGLibNode = z.infer<typeof PSGLibNodeSchema>;
export type PSGLibEdge = z.infer<typeof PSGLibEdgeSchema>;

// Error types for better error handling
export enum PSGLibErrorType {
  INVALID_JSON = 'INVALID_JSON',
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  VERSION_INCOMPATIBLE = 'VERSION_INCOMPATIBLE',
  CORRUPTED_DATA = 'CORRUPTED_DATA',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY'
}

export class PSGLibError extends Error {
  constructor(
    public type: PSGLibErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PSGLibError';
  }
}

/**
 * Parse a PSGLib file from JSON string
 */
export function parsePSGLib(jsonString: string): PSGLibFile {
  try {
    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      throw new PSGLibError(
        PSGLibErrorType.INVALID_JSON,
        'Invalid JSON format',
        e
      );
    }

    // Validate schema
    const result = PSGLibFileSchema.safeParse(data);
    if (!result.success) {
      throw new PSGLibError(
        PSGLibErrorType.INVALID_SCHEMA,
        'Invalid PSGLib schema',
        result.error.errors
      );
    }

    // Check version compatibility (1.x.x is compatible)
    const version = result.data.formatVersion;
    const majorVersion = parseInt(version.split('.')[0]);
    if (majorVersion !== 1) {
      throw new PSGLibError(
        PSGLibErrorType.VERSION_INCOMPATIBLE,
        `Incompatible version ${version}. Expected 1.x.x`,
        { version }
      );
    }

    // Validate no circular dependencies
    validateNoCycles(result.data.graph.nodes, result.data.graph.edges);

    return result.data;
  } catch (error) {
    if (error instanceof PSGLibError) {
      throw error;
    }
    throw new PSGLibError(
      PSGLibErrorType.CORRUPTED_DATA,
      'Failed to parse PSGLib file',
      error
    );
  }
}

/**
 * Serialize a PSGLib file to JSON string
 */
export function serializePSGLib(psglib: PSGLibFile, pretty = true): string {
  try {
    // Validate before serialization
    const result = PSGLibFileSchema.safeParse(psglib);
    if (!result.success) {
      throw new PSGLibError(
        PSGLibErrorType.INVALID_SCHEMA,
        'Invalid PSGLib data',
        result.error.errors
      );
    }

    // Update lastModified
    result.data.metadata.lastModified = new Date().toISOString();

    return JSON.stringify(result.data, null, pretty ? 2 : 0);
  } catch (error) {
    if (error instanceof PSGLibError) {
      throw error;
    }
    throw new PSGLibError(
      PSGLibErrorType.CORRUPTED_DATA,
      'Failed to serialize PSGLib file',
      error
    );
  }
}

/**
 * Create a new PSGLib file from nodes and edges
 */
export function createPSGLib(
  nodes: PSGLibNode[],
  edges: PSGLibEdge[],
  metadata: Partial<PSGLibMetadata>
): PSGLibFile {
  const now = new Date().toISOString();

  // Generate unique ID if not provided
  const id =
    metadata.id ||
    `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Extract node types from nodes
  const nodeTypes = [...new Set(nodes.map(n => n.type))];

  const fullMetadata: PSGLibMetadata = {
    id,
    name: metadata.name || 'Untitled Preset',
    description: metadata.description || '',
    author: metadata.author || 'Unknown',
    version: metadata.version || '1.0.0',
    tags: metadata.tags || [],
    nodeTypes,
    thumbnail: metadata.thumbnail,
    lastModified: now,
    license: metadata.license || 'MIT',
    usageStats: metadata.usageStats || {
      timesUsed: 0,
      lastUsed: null,
      popularity: 0
    },
    marketplace: metadata.marketplace
  };

  return {
    fileType: 'psglib',
    formatVersion: '1.0.0',
    metadata: fullMetadata,
    graph: {
      nodes,
      edges,
      settings: {}
    }
  };
}

/**
 * Validate that the graph has no circular dependencies
 */
function validateNoCycles(nodes: PSGLibNode[], edges: PSGLibEdge[]): void {
  const nodeIds = new Set(nodes.map(n => n.id));
  const adjacency = new Map<string, Set<string>>();

  // Build adjacency list
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new PSGLibError(
        PSGLibErrorType.CORRUPTED_DATA,
        'Edge references non-existent node',
        { edge }
      );
    }

    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    adjacency.get(edge.source)!.add(edge.target);
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        throw new PSGLibError(
          PSGLibErrorType.CIRCULAR_DEPENDENCY,
          'Graph contains circular dependencies',
          { nodeId }
        );
      }
    }
  }
}

/**
 * Track preset usage for analytics (PM requirement)
 */
export function trackPresetUsage(
  preset: PSGLibFile,
  action: 'import' | 'export' | 'use'
): void {
  // Update usage stats
  preset.metadata.usageStats.timesUsed++;
  preset.metadata.usageStats.lastUsed = new Date().toISOString();

  // Send analytics event (integrate with analytics service)
  if (typeof window !== 'undefined' && (window as any).analytics) {
    (window as any).analytics.track('preset_usage', {
      preset_id: preset.metadata.id,
      preset_name: preset.metadata.name,
      action,
      timestamp: new Date().toISOString(),
      node_count: preset.graph.nodes.length,
      tags: preset.metadata.tags
    });
  }
}

/**
 * Regenerate node IDs to avoid conflicts on import
 */
export function regenerateNodeIds(
  nodes: PSGLibNode[],
  edges: PSGLibEdge[]
): { nodes: PSGLibNode[]; edges: PSGLibEdge[] } {
  const idMap = new Map<string, string>();
  // Use high-resolution timestamp with crypto for better uniqueness
  const timestamp =
    typeof performance !== 'undefined'
      ? Math.floor(performance.now() * 1000000)
      : Date.now() * 1000;
  const random = Math.random().toString(36).substring(2, 15);
  const processId = Math.random().toString(36).substring(2, 8);

  // Add a small delay counter to guarantee uniqueness even in tight loops
  let delayCounter = 0;

  // Generate new IDs for nodes with guaranteed uniqueness
  const newNodesWithOldIds = nodes.map((node, index) => {
    // Create a unique ID with multiple entropy sources
    delayCounter++;
    const newId = `node-${timestamp}-${processId}-${random}-${delayCounter}-${index}`;
    idMap.set(node.id, newId);
    return { ...node, id: newId };
  });

  // Remap parentNode relationships to new IDs (preserve container parenting)
  const newNodes = newNodesWithOldIds.map((node) => {
    const parent = (node as any).parentNode as string | undefined;
    if (parent) {
      const mapped = idMap.get(parent) || parent;
      if (mapped !== (node as any).parentNode) {
        return { ...(node as any), parentNode: mapped } as PSGLibNode;
      }
    }
    return node;
  });

  // Reset counter for edges
  delayCounter = 0;

  // Update edge references with unique IDs
  const newEdges = edges.map((edge, index) => {
    delayCounter++;
    return {
      ...edge,
      id: `edge-${timestamp}-${processId}-${random}-${delayCounter}-${index}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target
    };
  });

  return { nodes: newNodes, edges: newEdges };
}

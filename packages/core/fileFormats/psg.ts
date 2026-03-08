/**
 * PSG File Format Parser
 * Handles .psg fragment files which have a different structure than .psglib
 */

import { z } from 'zod';
import {
  normalizeLegacyFlatPsgShape,
  normalizeImportedEdges,
  normalizeLibraryImportEdges
} from '../runtime/importGraphNormalization';

let didFallbackNodeTypeMapping = false;

// PSG file schema for fragments
export const PSGNodeOptionSchema = z.object({
  text: z.string(),
  weight: z.number(),
  meta: z.record(z.any()).optional()
});

export const PSGNodeSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    x: z.number(),
    y: z.number(),
    options: z.array(PSGNodeOptionSchema).optional(),
    template: z.string().optional(),
    value: z.any().optional(),
    data: z.record(z.any()).optional()
  })
  .catchall(z.any()); // Allow additional fields

export const PSGEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional()
});

export const PSGRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  color_comment: z.string().optional(),
  nodes: z.array(z.string()),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  ports: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.string().optional(),
        direction: z.enum(['input', 'output']),
        position: z.number().optional(),
        color: z.string().optional()
      })
    )
    .optional()
});

export const PSGFileSchema = z.object({
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  nodes: z.array(PSGNodeSchema),
  edges: z.array(PSGEdgeSchema),
  regions: z.array(PSGRegionSchema).optional()
});

export type PSGFile = z.infer<typeof PSGFileSchema>;
export type PSGNode = z.infer<typeof PSGNodeSchema>;
export type PSGEdge = z.infer<typeof PSGEdgeSchema>;
export type PSGRegion = z.infer<typeof PSGRegionSchema>;

type EditorLikeNode = {
  id: string;
  type?: string;
  position?: { x?: number; y?: number };
  width?: number;
  height?: number;
  parentNode?: string;
  data?: Record<string, any>;
};

type EditorLikeEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

type ExportGraphToPSGOptions = {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

const EDITOR_TO_PSG_NODE_TYPE: Record<string, string> = {
  weightedChoice: 'WeightedChoice',
  output: 'Output',
  concat: 'Concat',
  textBlock: 'TextBlock',
  variable: 'Variable',
  setVariable: 'SetVariable',
  getVariable: 'GetVariable',
  include: 'Include'
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;

const toFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const canonicalizeEditorNodeType = (type: unknown): string => {
  if (typeof type !== 'string' || type.length === 0) {
    return 'TextBlock';
  }
  return EDITOR_TO_PSG_NODE_TYPE[type] || type;
};

const getAbsoluteNodePosition = (
  node: EditorLikeNode,
  nodesById: Map<string, EditorLikeNode>
): { x: number; y: number } => {
  const baseX = toFiniteNumber(node.position?.x, 0);
  const baseY = toFiniteNumber(node.position?.y, 0);

  if (!node.parentNode) {
    return { x: baseX, y: baseY };
  }

  const parent = nodesById.get(node.parentNode);
  if (!parent) {
    return { x: baseX, y: baseY };
  }

  const parentPos: { x: number; y: number } = getAbsoluteNodePosition(
    parent,
    nodesById
  );
  return {
    x: parentPos.x + baseX,
    y: parentPos.y + baseY
  };
};

const sanitizeNodeDataForPSG = (
  nodeType: string,
  data: Record<string, any>
) => {
  const sanitized = { ...data };
  delete sanitized.nodeType;
  delete sanitized.fragmentRegionIds;
  delete sanitized.fragmentImported;
  delete sanitized.fragmentSource;
  delete sanitized.fragmentRegions;
  delete sanitized.regionCount;
  delete sanitized.nodeCount;
  delete sanitized.width;
  delete sanitized.height;
  delete sanitized.isCollapsed;
  delete sanitized.locked;
  delete sanitized.ports;
  delete sanitized.backgroundColor;
  delete sanitized.opacity;
  delete sanitized.borderColor;
  delete sanitized.borderStyle;
  delete sanitized.borderWidth;
  delete sanitized.title;
  delete sanitized.description;

  if (nodeType === 'WeightedChoice') {
    return undefined;
  }

  if (nodeType === 'TextBlock') {
    return undefined;
  }

  if (nodeType === 'Output') {
    return undefined;
  }

  if (nodeType === 'Concat') {
    const separator =
      typeof sanitized.separator === 'string'
        ? sanitized.separator
        : typeof sanitized.value === 'string'
          ? sanitized.value
          : undefined;
    return separator !== undefined ? { separator } : undefined;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const normalizeExportEdgeHandle = (
  nodeType: string,
  handle: string | undefined,
  direction: 'source' | 'target'
) => {
  if (!handle) {
    return undefined;
  }

  if (direction === 'source') {
    if (nodeType === 'Output') {
      return undefined;
    }
    if (handle === 'source') {
      return undefined;
    }
    return handle;
  }

  if (nodeType === 'Output') {
    return undefined;
  }

  if (nodeType === 'Concat') {
    return handle === 'input1' || handle === 'input2' ? handle : undefined;
  }

  if (handle === 'target') {
    return undefined;
  }

  return handle;
};

export function exportGraphToPSG(
  nodes: EditorLikeNode[],
  edges: EditorLikeEdge[],
  options: ExportGraphToPSGOptions = {}
): PSGFile {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const importedWrapperIds = new Set(
    nodes
      .filter(
        node =>
          node.type === 'enhancedBoundingBox' &&
          node.data?.fragmentImported === true
      )
      .map(node => node.id)
  );

  const contentNodes = nodes.filter(node => !importedWrapperIds.has(node.id));

  const exportedNodes: PSGNode[] = contentNodes.map(node => {
    const nodeType = canonicalizeEditorNodeType(
      node.type || node.data?.nodeType
    );
    const absolutePosition = getAbsoluteNodePosition(node, nodesById);
    const nodeData = node.data || {};

    const exportedNode: PSGNode = {
      id: node.id,
      type: nodeType,
      x: absolutePosition.x,
      y: absolutePosition.y
    };

    const label =
      typeof nodeData.label === 'string' && nodeData.label.trim().length > 0
        ? nodeData.label.trim()
        : undefined;
    if (label) {
      exportedNode.name = label;
    }

    if (nodeType === 'WeightedChoice') {
      const rawOptions = Array.isArray(nodeData.options)
        ? nodeData.options
        : Array.isArray(nodeData.value)
          ? nodeData.value
          : [];
      exportedNode.options = rawOptions.map((option: any) =>
        stripUndefined({
          text:
            typeof option?.text === 'string'
              ? option.text
              : typeof option?.label === 'string'
                ? option.label
                : '',
          weight: toFiniteNumber(option?.weight, 1),
          meta:
            option?.meta && typeof option.meta === 'object'
              ? option.meta
              : undefined
        })
      );
    } else if (nodeType === 'TextBlock') {
      const value =
        typeof nodeData.value === 'string'
          ? nodeData.value
          : typeof nodeData.text === 'string'
            ? nodeData.text
            : '';
      exportedNode.value = value;
    } else if (nodeType === 'Output') {
      const template =
        typeof nodeData.template === 'string'
          ? nodeData.template
          : typeof nodeData.value === 'string'
            ? nodeData.value
            : '';
      exportedNode.template = template;
    } else if (nodeType === 'Concat') {
      const separator =
        typeof nodeData.separator === 'string'
          ? nodeData.separator
          : typeof nodeData.value === 'string'
            ? nodeData.value
            : '';
      exportedNode.value = separator;
    }

    const sanitizedData = sanitizeNodeDataForPSG(nodeType, nodeData);
    if (sanitizedData) {
      exportedNode.data = sanitizedData;
    }

    return exportedNode;
  });

  const exportedRegions: PSGRegion[] = nodes
    .filter(node => node.type === 'enhancedBoundingBox')
    .map((node, index) => {
      const nodeData = node.data || {};
      const childIds = contentNodes
        .filter(candidate => candidate.parentNode === node.id)
        .map(candidate => candidate.id);

      if (
        nodeData.fragmentImported &&
        Array.isArray(nodeData.fragmentRegions)
      ) {
        return (nodeData.fragmentRegions as any[]).map((region, regionIndex) =>
          normalizeLegacyPsgRegionShape(
            {
              ...region,
              id: `${node.id}-${region?.id || `region-${regionIndex + 1}`}`,
              nodes: Array.isArray(region?.nodes)
                ? region.nodes.filter((nodeId: string) =>
                    childIds.includes(nodeId)
                  )
                : childIds
            },
            regionIndex
          )
        );
      }

      if (childIds.length === 0) {
        const boxX = toFiniteNumber(node.position?.x, 0);
        const boxY = toFiniteNumber(node.position?.y, 0);
        const boxWidth = toFiniteNumber(node.width ?? nodeData.width, 0);
        const boxHeight = toFiniteNumber(node.height ?? nodeData.height, 0);
        const inferredNodes = contentNodes
          .filter(candidate => !candidate.parentNode)
          .filter(candidate => {
            const pos = getAbsoluteNodePosition(candidate, nodesById);
            return (
              pos.x >= boxX &&
              pos.y >= boxY &&
              pos.x <= boxX + boxWidth &&
              pos.y <= boxY + boxHeight
            );
          })
          .map(candidate => candidate.id);

        if (inferredNodes.length === 0) {
          return [];
        }

        childIds.push(...inferredNodes);
      }

      return [
        normalizeLegacyPsgRegionShape(
          {
            id: node.id || `region-${index + 1}`,
            name:
              typeof nodeData.title === 'string' &&
              nodeData.title.trim().length > 0
                ? nodeData.title.trim()
                : `Region ${index + 1}`,
            color:
              typeof nodeData.borderColor === 'string'
                ? nodeData.borderColor
                : undefined,
            description:
              typeof nodeData.description === 'string'
                ? nodeData.description
                : undefined,
            nodes: Array.from(new Set(childIds))
          },
          index
        )
      ];
    })
    .flat();

  const exportedNodeIds = new Set(exportedNodes.map(node => node.id));
  const nodeTypesById = new Map(
    exportedNodes.map(node => [node.id, node.type])
  );

  const exportedEdges: PSGEdge[] = edges
    .filter(
      edge =>
        exportedNodeIds.has(edge.source) && exportedNodeIds.has(edge.target)
    )
    .map(edge =>
      stripUndefined({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: normalizeExportEdgeHandle(
          nodeTypesById.get(edge.source) || '',
          edge.sourceHandle,
          'source'
        ),
        targetHandle: normalizeExportEdgeHandle(
          nodeTypesById.get(edge.target) || '',
          edge.targetHandle,
          'target'
        )
      })
    );

  return {
    version: '1.0.0',
    name: options.name || 'Prompt Spaghetti Graph',
    description: options.description,
    metadata: options.metadata,
    nodes: exportedNodes,
    edges: exportedEdges,
    regions: exportedRegions.length > 0 ? exportedRegions : undefined
  };
}

const normalizeLegacyPsgNodeShape = (node: any, index: number) => {
  const fallbackX =
    typeof node?.position?.x === 'number' ? node.position.x : 100;
  const fallbackY =
    typeof node?.position?.y === 'number' ? node.position.y : 100 + index * 180;

  return {
    ...node,
    x: typeof node?.x === 'number' ? node.x : fallbackX,
    y: typeof node?.y === 'number' ? node.y : fallbackY
  };
};

const normalizeLegacyPsgRegionShape = (region: any, index: number) => ({
  ...region,
  id:
    typeof region?.id === 'string' && region.id.length > 0
      ? region.id
      : `region-${index + 1}`,
  name:
    typeof region?.name === 'string' && region.name.length > 0
      ? region.name
      : typeof region?.label === 'string' && region.label.length > 0
        ? region.label
        : `Region ${index + 1}`,
  nodes: Array.isArray(region?.nodes)
    ? region.nodes
    : Array.isArray(region?.nodeIds)
      ? region.nodeIds
      : []
});

function parseCanonicalPsgObject(data: unknown): PSGFile {
  const result = PSGFileSchema.safeParse(data);

  if (!result.success) {
    console.error('[PSG] Schema validation failed:', result.error);
    console.error(
      '[PSG] Full error details:',
      JSON.stringify(result.error.errors, null, 2)
    );
    throw new Error(`Invalid PSG file: ${result.error.message}`);
  }

  return result.data;
}

function parseCompatiblePsgObject(data: any): PSGFile {
  const normalized = normalizeLegacyFlatPsgShape(data);

  if (Array.isArray(normalized.nodes)) {
    normalized.nodes = normalized.nodes.map((node: any, index: number) =>
      normalizeLegacyPsgNodeShape(node, index)
    );
  }

  if (Array.isArray(normalized.regions)) {
    normalized.regions = normalized.regions.map((region: any, index: number) =>
      normalizeLegacyPsgRegionShape(region, index)
    );
  }

  // Try to parse edges separately to see what's happening
  if (normalized.edges) {
    normalized.edges.forEach((edge: any, i: number) => {
      const edgeResult = PSGEdgeSchema.safeParse(edge);
      if (!edgeResult.success) {
        console.error(
          `[PSG] Edge ${i} validation failed:`,
          edge,
          edgeResult.error
        );
      }
    });
  }

  return parseCanonicalPsgObject(normalized);
}

/**
 * Parse a strict canonical PSG file (fragment format) with no compatibility normalization.
 */
export function parseCanonicalPsg(content: string): PSGFile {
  try {
    return parseCanonicalPsgObject(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to parse PSG file');
  }
}

/**
 * Parse a PSG file with compatibility normalization for legacy flat-PSG shapes.
 */
export function parsePsgWithCompatibility(content: string): PSGFile {
  try {
    return parseCompatiblePsgObject(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to parse PSG file');
  }
}

/**
 * Transitional alias. Current behavior remains compatibility-backed until callers are split.
 */
export function parsePSG(content: string): PSGFile {
  return parsePsgWithCompatibility(content);
}

/**
 * Convert PSG format to PSGLib format.
 */
function convertParsedPsgToPSGLib(
  psg: PSGFile,
  normalizeEdges:
    | typeof normalizeImportedEdges
    | typeof normalizeLibraryImportEdges
): any {
  // Check if this is a fragment
  const regionCount = Array.isArray(psg.regions) ? psg.regions.length : 0;
  const isFragment =
    psg.metadata?.type === 'MULTI-ASPECT' ||
    psg.metadata?.type === 'ASSET_FRAGMENT' ||
    regionCount > 0;

  // Include all nodes - Output nodes are needed for preview functionality
  const nodesToImport = psg.nodes;

  // Get the IDs of nodes we're actually importing
  const importedNodeIds = new Set(nodesToImport.map(n => n.id));

  // Initialize the nodes array
  const graphNodes: any[] = [];

  const BOX_PADDING = 60;
  const HEADER_OFFSET = 80;
  const FRAGMENT_LAYER_GAP_X = 220;
  const FRAGMENT_LAYER_GAP_Y = 60;

  const getNodeDimensions = (node: any) => {
    let nodeWidth = 420;
    let nodeHeight = 180;

    if (node.type === 'WeightedChoice') {
      const optionCount = Array.isArray(node.options)
        ? node.options.length
        : Array.isArray(node.data?.options)
          ? node.data.options.length
          : 5;
      nodeHeight = Math.max(340, 170 + optionCount * 42);
    } else if (node.type === 'Output') {
      nodeHeight = 100;
    }

    return { nodeWidth, nodeHeight };
  };

  const computeFragmentLayout = (
    fragmentNodes: PSGNode[],
    fragmentEdges: PSGEdge[]
  ): Record<string, { x: number; y: number }> => {
    if (fragmentNodes.length === 0) {
      return {};
    }

    const nodeById = new Map(fragmentNodes.map(node => [node.id, node]));
    const outgoing = new Map<string, string[]>();
    const indegree = new Map<string, number>();

    fragmentNodes.forEach(node => {
      outgoing.set(node.id, []);
      indegree.set(node.id, 0);
    });

    fragmentEdges.forEach(edge => {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
        return;
      }
      outgoing.get(edge.source)?.push(edge.target);
      indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
    });

    const queue: string[] = fragmentNodes
      .filter(node => (indegree.get(node.id) || 0) === 0)
      .map(node => node.id);
    const topoOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      topoOrder.push(current);
      for (const target of outgoing.get(current) || []) {
        const nextDegree = (indegree.get(target) || 0) - 1;
        indegree.set(target, nextDegree);
        if (nextDegree === 0) {
          queue.push(target);
        }
      }
    }

    // Preserve disconnected/cyclic nodes deterministically.
    fragmentNodes.forEach(node => {
      if (!topoOrder.includes(node.id)) {
        topoOrder.push(node.id);
      }
    });

    const levelById = new Map<string, number>();
    topoOrder.forEach(nodeId => {
      const parents = fragmentEdges
        .filter(edge => edge.target === nodeId && nodeById.has(edge.source))
        .map(edge => edge.source);
      const parentLevel =
        parents.length > 0
          ? Math.max(...parents.map(parent => levelById.get(parent) ?? 0))
          : 0;
      levelById.set(nodeId, parents.length > 0 ? parentLevel + 1 : 0);
    });

    const levels = new Map<number, PSGNode[]>();
    topoOrder.forEach(nodeId => {
      const node = nodeById.get(nodeId);
      if (!node) {
        return;
      }
      const level = levelById.get(nodeId) ?? 0;
      const existing = levels.get(level) || [];
      existing.push(node);
      levels.set(level, existing);
    });

    const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
    const positions: Record<string, { x: number; y: number }> = {};
    let currentX = 0;

    sortedLevels.forEach(level => {
      const nodesAtLevel = levels.get(level) || [];
      let currentY = 0;
      let maxWidthInLevel = 0;

      nodesAtLevel.forEach(node => {
        const { nodeWidth, nodeHeight } = getNodeDimensions(node);
        positions[node.id] = {
          x: currentX,
          y: currentY
        };
        currentY += nodeHeight + FRAGMENT_LAYER_GAP_Y;
        maxWidthInLevel = Math.max(maxWidthInLevel, nodeWidth);
      });

      currentX += maxWidthInLevel + FRAGMENT_LAYER_GAP_X;
    });

    return positions;
  };

  const optimizedPositions: Record<string, { x: number; y: number }> =
    isFragment ? computeFragmentLayout(nodesToImport, psg.edges ?? []) : {};

  const getNodePosition = (node: any) =>
    optimizedPositions[node.id] || { x: node.x || 0, y: node.y || 0 };

  const calculateBounds = (nodes: any[]) => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      const pos = getNodePosition(node);
      const { nodeWidth, nodeHeight } = getNodeDimensions(node);

      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + nodeWidth);
      maxY = Math.max(maxY, pos.y + nodeHeight);
    });

    return { minX, minY, maxX, maxY };
  };

  type FragmentWrapperMeta = {
    boxId: string;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    padding: number;
    headerOffset: number;
  };

  let fragmentWrapper: FragmentWrapperMeta | null = null;

  if (isFragment) {
    const bounds = calculateBounds(nodesToImport);
    const boxWidth = bounds.maxX - bounds.minX + BOX_PADDING * 2;
    const boxHeight =
      bounds.maxY - bounds.minY + BOX_PADDING * 2 + HEADER_OFFSET;
    const boxId = `fragment-${Date.now()}`;
    const regionCount = Array.isArray(psg.regions) ? psg.regions.length : 0;
    const regionName = regionCount === 1 ? psg.regions?.[0]?.name : undefined;
    const regionPorts = (psg.regions ?? []).flatMap(
      region => region.ports ?? []
    );
    const wrapperPorts = regionPorts.length > 0 ? regionPorts : [];

    fragmentWrapper = {
      boxId,
      bounds,
      padding: BOX_PADDING,
      headerOffset: HEADER_OFFSET
    };

    graphNodes.push({
      id: boxId,
      type: 'enhancedBoundingBox',
      position: {
        x: bounds.minX - BOX_PADDING,
        y: bounds.minY - BOX_PADDING - HEADER_OFFSET
      },
      width: boxWidth,
      height: boxHeight,
      data: {
        title: regionName || psg.name || 'Asset Fragment',
        description: psg.description || '',
        backgroundColor: '#1a202c',
        opacity: 0.1,
        borderColor: psg.regions?.[0]?.color || '#22d3ee',
        borderStyle: 'solid' as const,
        borderWidth: 2,
        locked: false,
        isCollapsed: false,
        ports: wrapperPorts,
        width: boxWidth,
        height: boxHeight,
        nodeCount: nodesToImport.length,
        fragmentImported: true,
        fragmentSource: psg.metadata?.source,
        fragmentRegions: psg.regions ?? [],
        regionCount
      },
      style: {
        width: boxWidth,
        height: boxHeight
      }
    });
  }

  // Create the graph nodes using optimized or original positions
  const contentNodes = nodesToImport.map(node => {
    // Use the node registry to convert PSG type to React Flow type
    // This ensures consistent type mapping across the system
    let nodeType: string;
    try {
      // Try to import the registry dynamically to avoid circular dependencies
      const { convertNodeType } = require('../runtime/nodeRegistry');
      nodeType = convertNodeType(node.type, 'psg');
    } catch (e) {
      // Fallback to manual mapping if registry is unavailable in the browser bundle.
      if (!didFallbackNodeTypeMapping) {
        didFallbackNodeTypeMapping = true;
      }
      nodeType =
        node.type === 'WeightedChoice'
          ? 'weightedChoice'
          : node.type === 'Output'
            ? 'output'
            : node.type === 'Concat'
              ? 'concat'
              : node.type === 'TextBlock'
                ? 'textBlock'
                : node.type === 'Variable'
                  ? 'variable'
                  : node.type;
    }

    // Build proper data structure based on node type
    const existingData =
      typeof node.data === 'object' && node.data !== null ? node.data : {};
    let nodeData: any = {
      ...existingData,
      nodeType,
      label: node.name || node.id
    };

    if (node.value !== undefined && nodeData.value === undefined) {
      nodeData.value = node.value;
    }

    // Handle WeightedChoice nodes
    if (node.type === 'WeightedChoice') {
      // Convert options to the expected format
      const weightedOptions = Array.isArray(node.options)
        ? node.options
        : Array.isArray((node.data as any)?.options)
          ? (node.data as any).options
          : [];
      if (weightedOptions.length > 0) {
        nodeData.options = weightedOptions.map((opt: any, idx: number) => ({
          id: `option-${idx + 1}`,
          text: opt.text || '',
          weight: opt.weight || 1,
          hasBranch: false
        }));
        // Store the raw JSON for the editor
        nodeData.value = JSON.stringify(weightedOptions, null, 2);
      }
    }

    // Handle Output nodes
    if (node.type === 'Output') {
      const template =
        node.template ||
        (typeof (node.data as any)?.template === 'string'
          ? (node.data as any).template
          : '') ||
        (typeof (node.data as any)?.value === 'string'
          ? (node.data as any).value
          : '');
      nodeData.template = template;
      nodeData.value = template;
    }

    if (node.type === 'TextBlock') {
      const textValue =
        (typeof node.value === 'string' ? node.value : '') ||
        (typeof (node.data as any)?.text === 'string'
          ? (node.data as any).text
          : '') ||
        (typeof (node.data as any)?.value === 'string'
          ? (node.data as any).value
          : '');
      nodeData.value = textValue;
      nodeData.text = textValue;
    }

    // Build the node with proper parent relationship
    const result: any = {
      id: node.id,
      type: nodeType,
      data: nodeData
    };

    // Position nodes appropriately
    const parentBox = fragmentWrapper;

    if (parentBox) {
      const pos = getNodePosition(node);
      const regionIds = (psg.regions ?? [])
        .filter(region => region.nodes?.includes(node.id))
        .map(region => region.id);
      result.position = {
        x: pos.x - parentBox.bounds.minX + parentBox.padding,
        y:
          pos.y -
          parentBox.bounds.minY +
          parentBox.padding +
          parentBox.headerOffset
      };
      (result as any).parentNode = parentBox.boxId;
      (result as any).extent = 'parent';
      (result as any).expandParent = true;
      result.data = {
        ...result.data,
        fragmentRegionIds: regionIds
      };
    } else {
      // Standalone node, use absolute position
      result.position = {
        x: node.x || 100,
        y: node.y || 100
      };
    }

    return result;
  });

  // Add content nodes after the bounding box
  graphNodes.push(...contentNodes);

  const processedEdges = psg.edges
    ? psg.edges
        .filter(edge => {
          // Only include edges where both source and target are imported
          return (
            importedNodeIds.has(edge.source) && importedNodeIds.has(edge.target)
          );
        })
        .map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle
        }))
    : [];

  const normalizedEdges = normalizeEdges(processedEdges, contentNodes);

  return {
    fileType: 'psglib',
    formatVersion: '1.0.0',
    metadata: {
      id: psg.name.toLowerCase().replace(/\s+/g, '-'),
      name: psg.name,
      description: psg.description || '',
      author: psg.metadata?.author || 'Unknown',
      version: psg.version,
      tags: psg.metadata?.tags || [],
      nodeTypes: Array.from(new Set(nodesToImport.map(n => n.type))),
      lastModified: new Date().toISOString(),
      license: 'MIT',
      usageStats: {
        timesUsed: 0,
        lastUsed: null,
        popularity: 0
      },
      isFragment,
      regions: psg.regions
    },
    graph: {
      nodes: graphNodes,
      edges: normalizedEdges
    },
    // Store regions in metadata for preservation
    additionalData: {
      regions: psg.regions
    }
  };
}

/**
 * Convert canonical PSG input to PSGLib without legacy edge-handle repair.
 */
export function convertCanonicalPSGToPSGLib(psg: PSGFile): any {
  return convertParsedPsgToPSGLib(psg, normalizeLibraryImportEdges);
}

/**
 * Convert compatibility-normalized PSG input to PSGLib with legacy edge-handle repair.
 */
export function convertCompatiblePSGToPSGLib(psg: PSGFile): any {
  return convertParsedPsgToPSGLib(psg, normalizeImportedEdges);
}

/**
 * Convert PSG format to PSGLib format for compatibility.
 */
export function convertPSGToPSGLib(psg: PSGFile): any {
  return convertCompatiblePSGToPSGLib(psg);
}

import { TextBlockNode } from './TextBlockNode';
import { WeightedChoiceNode, WeightedOption } from './WeightedChoiceNode';
import { VariableNode } from './VariableNode';
import { OutputNode } from './OutputNode';
import { BaseInlineEditableNode } from './BaseInlineEditableNode';
import { Epic1NodeType } from './nodeTypes';
import { smartNodePositioner } from './SmartNodePositioning';
import { segmentPrompt, SegmentKind } from '../../prompting/PromptSegmentation';

/**
 * Represents a parsed segment of the prompt
 */
export interface PromptSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  suggestedNodeType: Epic1NodeType;
  confidence: number;
  metadata?: {
    reason?: string;
    alternatives?: string[];
    isListItem?: boolean;
    parentList?: string;
    segmentKind?: SegmentKind;
    variableName?: string;
  };
}

/**
 * Result of parsing a prompt
 */
export interface PromptAnalysis {
  originalText: string;
  segments: PromptSegment[];
  nodes: GeneratedNode[];
  mappings: NodeMapping[];
  edges?: Array<{ source: string; target: string }>;
}

/**
 * Generated node with metadata about its source
 */
export interface GeneratedNode {
  node: BaseInlineEditableNode;
  sourceSegments: number[]; // indices into segments array
  position?: { x: number; y: number };
}

/**
 * Mapping between source text and generated nodes
 */
export interface NodeMapping {
  nodeId: string;
  startIndex: number;
  endIndex: number;
  highlightColor?: string;
}

const HIGHLIGHT_COLORS = [
  '#FFE6E6',
  '#FFE6E6',
  '#FFE6E6',
  '#FFE6E6',
  '#FFE6E6',
  '#FFE6E6',
  '#FFE6E6',
  '#FFE6E6'
];

/**
 * Main prompt parser class
 */
export class PromptParser {
  private nodeCounter = 0;

  /**
   * Parse a prompt into semantic segments and generate nodes
   */
  parse(prompt: string): PromptAnalysis {
    this.nodeCounter = 0;

    const segmented = segmentPrompt(prompt);
    const highlightColor = (index: number) =>
      HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];

    const nodes: GeneratedNode[] = [];
    const mappings: NodeMapping[] = [];
    const analysisSegments: PromptSegment[] = [];
    const edges: Array<{ source: string; target: string }> = [];

    segmented.segments.forEach((segment, index) => {
      const nodeId = this.generateNodeId(segment.kind);
      const node = createNodeForSegment(nodeId, segment);

      nodes.push({
        node,
        sourceSegments: [index]
      });

      mappings.push({
        nodeId,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        highlightColor: highlightColor(index)
      });

      analysisSegments.push({
        text: segment.text,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        suggestedNodeType: segmentKindToNodeType(segment.kind),
        confidence: segment.kind === 'text' ? 0.7 : 0.9,
        metadata: {
          alternatives: segment.options,
          segmentKind: segment.kind,
          variableName: segment.variableName
        }
      });
    });

    // Ensure there is always an output node at the end
    const outputNode = new OutputNode(this.generateNodeId('output'));
    outputNode.lock();
    nodes.push({
      node: outputNode,
      sourceSegments: []
    });

    // Apply smart positioning to all nodes
    const positions = smartNodePositioner.calculatePositions(nodes);
    const optimizedPositions = smartNodePositioner.optimizePositions(
      positions,
      nodes
    );
    nodes.forEach((wrapper, index) => {
      wrapper.position = optimizedPositions[index];
    });

    // Sequential edges connecting the flow of nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        source: nodes[i].node.id,
        target: nodes[i + 1].node.id
      });
    }

    return {
      originalText: prompt,
      segments: analysisSegments,
      nodes,
      mappings,
      edges
    };
  }

  private generateNodeId(kind?: SegmentKind): string {
    const suffix = ++this.nodeCounter;
    const prefix = kind ?? 'node';
    return `${prefix}-${suffix}`;
  }
}

function segmentKindToNodeType(kind: SegmentKind): Epic1NodeType {
  switch (kind) {
    case 'choice':
      return Epic1NodeType.WeightedChoice;
    case 'variable':
      return Epic1NodeType.Variable;
    case 'text':
    default:
      return Epic1NodeType.TextBlock;
  }
}

function createNodeForSegment(
  nodeId: string,
  segment: {
    text: string;
    kind: SegmentKind;
    options?: string[];
    variableName?: string;
  }
): BaseInlineEditableNode {
  const trimmed = segment.text.trim();

  switch (segment.kind) {
    case 'choice': {
      const options = buildWeightedOptions(segment.options ?? [trimmed]);
      return new WeightedChoiceNode(nodeId, options);
    }
    case 'variable': {
      const name =
        segment.variableName ?? guessVariableName(trimmed) ?? `var_${nodeId}`;
      return new VariableNode(
        nodeId,
        {
          name,
          currentValue: trimmed
        },
        {
          variableType: 'any',
          mode: 'both',
          hasDataInlet: true
        }
      );
    }
    default: {
      const multiline = /\n/.test(trimmed);
      return new TextBlockNode(nodeId, trimmed, {
        multiline,
        placeholder: 'Text'
      });
    }
  }
}

function buildWeightedOptions(texts: string[]): WeightedOption[] {
  if (texts.length === 0) {
    return [
      {
        id: 'option-1',
        text: 'Option 1',
        weight: 50
      }
    ];
  }

  const weight = Math.max(1, Math.round(100 / texts.length));
  return texts.map((text, idx) => ({
    id: `option-${idx + 1}`,
    text: text.trim(),
    weight
  }));
}

function guessVariableName(text: string): string | undefined {
  const braceMatch = text.match(/\{\{([\w.-]+)\}\}/);
  if (braceMatch) {
    return braceMatch[1];
  }

  const assignment = text.match(/^\s*([\w.-]{1,32})\s*[:=\-]/);
  if (assignment) {
    return assignment[1];
  }

  const words = text.trim().split(/\s+/);
  if (words.length === 1 && /^[\w.-]+$/.test(words[0])) {
    return words[0];
  }

  return undefined;
}

export const promptParser = new PromptParser();

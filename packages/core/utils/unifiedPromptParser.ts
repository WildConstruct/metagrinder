/**
 * Unified Prompt Parser
 * A comprehensive parser that handles both simple and complex prompt structures
 * Used by both the splash screen prompt dissector and the prompt wizard
 */

export interface ParsedSegment {
  text: string;
  type: 'text' | 'choice' | 'variable' | 'connector';
  alternatives?: string[];
  weight?: number;
  startIndex: number;
  endIndex: number;
}

export interface ParsedNode {
  id: string;
  nodeType: 'Text' | 'Choice' | 'Variable' | 'Output' | 'Concat';
  content: string;
  options?: Array<{ text: string; weight: number }>;
  variableName?: string;
}

export interface ParseResult {
  segments: ParsedSegment[];
  nodes: ParsedNode[];
  edges: Array<{ source: string; target: string }>;
}

// Advanced patterns for intelligent parsing
const CHOICE_PATTERNS = [
  /\s+or\s+/gi,
  /\s*\/\s*/g, // Forward slash as alternative separator
  /\s*\|\s*/g // Pipe as alternative separator
];

const VARIABLE_PATTERN = /\$\{?(\w+)\}?/g;
const LIST_PATTERN = /\[([^\]]+)\]/g;

/**
 * Unified parser that provides consistent behavior across the app
 */
export class UnifiedPromptParser {
  private nodeIdCounter = 0;

  /**
   * Parse a prompt into segments and nodes
   */
  parse(input: string): ParseResult {
    if (!input || input.trim().length === 0) {
      return { segments: [], nodes: [], edges: [] };
    }

    const segments = this.parseSegments(input);
    const nodes = this.createNodes(segments);
    const edges = this.createEdges(nodes);

    return { segments, nodes, edges };
  }

  /**
   * Parse input into semantic segments
   */
  private parseSegments(input: string): ParsedSegment[] {
    const segments: ParsedSegment[] = [];

    // Split by commas for main segments
    const parts = input.split(',');
    let currentIndex = 0;

    parts.forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) {return;}

      const startIndex = input.indexOf(part, currentIndex);
      const endIndex = startIndex + part.length;

      // Check if this segment contains alternatives
      const alternatives = this.findAlternatives(trimmed);

      if (alternatives.length > 1) {
        segments.push({
          text: trimmed,
          type: 'choice',
          alternatives,
          startIndex,
          endIndex
        });
      } else if (VARIABLE_PATTERN.test(trimmed)) {
        segments.push({
          text: trimmed,
          type: 'variable',
          startIndex,
          endIndex
        });
      } else {
        segments.push({
          text: trimmed,
          type: 'text',
          startIndex,
          endIndex
        });
      }

      currentIndex = endIndex;
    });

    return segments;
  }

  /**
   * Find alternatives within a text segment
   */
  private findAlternatives(text: string): string[] {
    // Check for list notation first [option1, option2, option3]
    const listMatch = LIST_PATTERN.exec(text);
    if (listMatch) {
      return listMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    // Check for various alternative patterns
    for (const pattern of CHOICE_PATTERNS) {
      if (pattern.test(text)) {
        return text
          .split(pattern)
          .map(s => s.trim())
          .filter(Boolean);
      }
    }

    return [text];
  }

  /**
   * Create nodes from parsed segments
   */
  private createNodes(segments: ParsedSegment[]): ParsedNode[] {
    const nodes: ParsedNode[] = [];

    segments.forEach(segment => {
      const nodeId = this.generateNodeId(segment.text);

      switch (segment.type) {
        case 'choice':
          nodes.push({
            id: nodeId,
            nodeType: 'Choice',
            content: segment.text,
            options:
              segment.alternatives?.map(alt => ({
                text: alt,
                weight: Math.round(100 / (segment.alternatives?.length || 1))
              })) || []
          });
          break;

        case 'variable': {
          const varMatch = VARIABLE_PATTERN.exec(segment.text);
          nodes.push({
            id: nodeId,
            nodeType: 'Variable',
            content: segment.text,
            variableName: varMatch ? varMatch[1] : 'variable'
          });
          break;
        }

        default:
          nodes.push({
            id: nodeId,
            nodeType: 'Text',
            content: segment.text
          });
      }
    });

    // Always add an output node
    nodes.push({
      id: 'output',
      nodeType: 'Output',
      content: 'Output'
    });

    return nodes;
  }

  /**
   * Create edges to connect nodes in sequence
   */
  private createEdges(
    nodes: ParsedNode[]
  ): Array<{ source: string; target: string }> {
    const edges: Array<{ source: string; target: string }> = [];

    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        source: nodes[i].id,
        target: nodes[i + 1].id
      });
    }

    return edges;
  }

  /**
   * Generate a deterministic node ID
   */
  private generateNodeId(text: string): string {
    // Create a simple hash from the text
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    }
    return `node-${(hash >>> 0).toString(36)}-${this.nodeIdCounter++}`;
  }

  /**
   * Advanced parsing with grammar understanding
   */
  parseWithGrammar(input: string): ParseResult {
    // This could be extended with more sophisticated grammar rules
    // For now, it uses the same logic as parse() but could be enhanced
    const result = this.parse(input);

    // Apply grammar-based enhancements
    result.nodes = this.applyGrammarRules(result.nodes);

    return result;
  }

  /**
   * Apply grammar rules to enhance node structure
   */
  private applyGrammarRules(nodes: ParsedNode[]): ParsedNode[] {
    // Look for patterns like "a [adjective] [noun]" and structure them appropriately
    // This is where we could add more sophisticated NLP-style parsing

    return nodes.map(node => {
      if (node.nodeType === 'Text') {
        // Check for implicit choices in text
        const words = node.content.split(' ');
        const hasImplicitChoice = words.some(
          word => word.includes('/') || word.includes('|')
        );

        if (hasImplicitChoice) {
          // Convert to choice node
          const alternatives = this.findAlternatives(node.content);
          if (alternatives.length > 1) {
            return {
              ...node,
              nodeType: 'Choice',
              options: alternatives.map(alt => ({
                text: alt,
                weight: Math.round(100 / alternatives.length)
              }))
            };
          }
        }
      }

      return node;
    });
  }
}

// Export a singleton instance for consistent parsing
export const unifiedParser = new UnifiedPromptParser();

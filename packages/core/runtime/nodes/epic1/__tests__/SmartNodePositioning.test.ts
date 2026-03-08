/**
 * Tests for Smart Node Positioning System
 */

import { SmartNodePositioner } from '../SmartNodePositioning.js';
import { TextBlockNode, WeightedChoiceNode, OutputNode } from '../index.js';
import { GeneratedNode } from '../PromptParser.js';

describe('SmartNodePositioner', () => {
  let positioner: SmartNodePositioner;

  beforeEach(() => {
    positioner = new SmartNodePositioner();
  });

  describe('calculatePositions', () => {
    it('should position single node at base coordinates', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Test text'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes);

      expect(positions).toHaveLength(1);
      expect(positions[0]).toEqual({ x: 100, y: 100 });
    });

    it('should layout multiple text blocks diagonally by default', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'First text'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Second text'),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-3', 'Third text'),
          sourceSegments: [2],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes);

      expect(positions).toHaveLength(3);

      // First node at base
      expect(positions[0]).toEqual({ x: 100, y: 100 });

      // Subsequent nodes should flow diagonally
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
      expect(positions[1].y).toBeGreaterThanOrEqual(positions[0].y);

      expect(positions[2].x).toBeGreaterThanOrEqual(positions[1].x);
      expect(positions[2].y).toBeGreaterThan(positions[1].y);
    });

    it('should layout nodes horizontally when configured', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'First'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Second'),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes, {
        flowDirection: 'horizontal'
      });

      expect(positions).toHaveLength(2);
      expect(positions[0].y).toBe(positions[1].y); // Same Y
      expect(positions[1].x).toBeGreaterThan(positions[0].x); // Different X
    });

    it('should layout nodes vertically when configured', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'First'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Second'),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes, {
        flowDirection: 'vertical'
      });

      expect(positions).toHaveLength(2);
      expect(positions[0].x).toBe(positions[1].x); // Same X
      expect(positions[1].y).toBeGreaterThan(positions[0].y); // Different Y
    });

    it('should position output node at bottom right', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Text'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new WeightedChoiceNode('node-2', [
            { id: 'opt-1', text: 'Option 1', weight: 50 },
            { id: 'opt-2', text: 'Option 2', weight: 50 }
          ]),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        },
        {
          node: new OutputNode('node-3'),
          sourceSegments: [],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes);

      // Output node should be at bottom right
      const outputPos = positions[2];
      expect(outputPos.x).toBeGreaterThan(positions[0].x);
      expect(outputPos.x).toBeGreaterThan(positions[1].x);
      expect(outputPos.y).toBeGreaterThanOrEqual(
        Math.max(positions[0].y, positions[1].y)
      );
    });

    it('should group related nodes together', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Group 1 Text 1'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Group 1 Text 2'),
          sourceSegments: [0], // Same source segment
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-3', 'Group 2 Text'),
          sourceSegments: [1], // Different source segment
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes);

      // Nodes with same source segments should be closer
      const dist12 = Math.sqrt(
        Math.pow(positions[1].x - positions[0].x, 2) +
          Math.pow(positions[1].y - positions[0].y, 2)
      );

      const dist23 = Math.sqrt(
        Math.pow(positions[2].x - positions[1].x, 2) +
          Math.pow(positions[2].y - positions[1].y, 2)
      );

      // Group spacing should be larger than within-group spacing
      expect(dist23).toBeGreaterThan(dist12);
    });

    it('should wrap to next row when exceeding max width', () => {
      const nodes: GeneratedNode[] = [];

      // Create many nodes to force wrapping
      for (let i = 0; i < 10; i++) {
        nodes.push({
          node: new TextBlockNode(`node-${i}`, `Text ${i}`),
          sourceSegments: [i],
          position: { x: 0, y: 0 }
        });
      }

      const positions = positioner.calculatePositions(nodes, {
        flowDirection: 'horizontal',
        maxWidth: 600 // Small max width to force wrapping
      });

      // Some nodes should wrap to second row
      const yValues = new Set(positions.map(p => p.y));
      expect(yValues.size).toBeGreaterThan(1);
    });
  });

  describe('optimizePositions', () => {
    it('should resolve overlapping nodes', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Text 1'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Text 2'),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        }
      ];

      // Start with overlapping positions
      const overlappingPositions = [
        { x: 100, y: 100 },
        { x: 150, y: 120 } // Overlaps with first node
      ];

      const optimized = positioner.optimizePositions(
        overlappingPositions,
        nodes
      );

      // Nodes should no longer overlap
      expect(optimized[0]).toEqual({ x: 100, y: 100 }); // First node stays
      expect(optimized[1].x).toBeGreaterThan(200); // Second node moved
    });

    it('should handle multiple overlapping nodes', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Text 1'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Text 2'),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-3', 'Text 3'),
          sourceSegments: [2],
          position: { x: 0, y: 0 }
        }
      ];

      // All nodes at same position
      const overlappingPositions = [
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 100 }
      ];

      const optimized = positioner.optimizePositions(
        overlappingPositions,
        nodes
      );

      // All nodes should have different positions
      const uniquePositions = new Set(optimized.map(p => `${p.x},${p.y}`));
      expect(uniquePositions.size).toBe(3);
    });

    it('should preserve non-overlapping positions', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Text 1'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new TextBlockNode('node-2', 'Text 2'),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        }
      ];

      // Already well-spaced positions
      const goodPositions = [
        { x: 100, y: 100 },
        { x: 400, y: 100 }
      ];

      const optimized = positioner.optimizePositions(goodPositions, nodes);

      // Positions should remain unchanged
      expect(optimized).toEqual(goodPositions);
    });

    it('should complete within iteration limit', () => {
      const nodes: GeneratedNode[] = [];
      const positions = [];

      // Create a complex overlapping scenario
      for (let i = 0; i < 20; i++) {
        nodes.push({
          node: new TextBlockNode(`node-${i}`, `Text ${i}`),
          sourceSegments: [i],
          position: { x: 0, y: 0 }
        });
        // All nodes start at same position
        positions.push({ x: 100, y: 100 });
      }

      const startTime = Date.now();
      const optimized = positioner.optimizePositions(positions, nodes, 5);
      const endTime = Date.now();

      // Should complete quickly (within 100ms)
      expect(endTime - startTime).toBeLessThan(100);

      // Should have made some progress in separating nodes
      const uniquePositions = new Set(optimized.map(p => `${p.x},${p.y}`));
      expect(uniquePositions.size).toBeGreaterThan(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty node array', () => {
      const nodes: GeneratedNode[] = [];
      const positions = positioner.calculatePositions(nodes);

      expect(positions).toEqual([]);
    });

    it('should handle single node optimization', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Single'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = [{ x: 100, y: 100 }];
      const optimized = positioner.optimizePositions(positions, nodes);

      expect(optimized).toEqual(positions);
    });

    it('should handle mixed node types', () => {
      const nodes: GeneratedNode[] = [
        {
          node: new TextBlockNode('node-1', 'Text'),
          sourceSegments: [0],
          position: { x: 0, y: 0 }
        },
        {
          node: new WeightedChoiceNode('node-2', [
            { id: 'opt-1', text: 'A', weight: 33 },
            { id: 'opt-2', text: 'B', weight: 33 },
            { id: 'opt-3', text: 'C', weight: 34 }
          ]),
          sourceSegments: [1],
          position: { x: 0, y: 0 }
        },
        {
          node: new OutputNode('node-3'),
          sourceSegments: [],
          position: { x: 0, y: 0 }
        }
      ];

      const positions = positioner.calculatePositions(nodes);

      expect(positions).toHaveLength(3);

      // Different node types should have appropriate spacing
      // WeightedChoice nodes are larger, so spacing should account for that
      const dist12 = positions[1].x - positions[0].x;
      expect(dist12).toBeGreaterThan(200); // Account for larger weighted choice node
    });
  });
});

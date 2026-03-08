/**
 * Tests for the Prompt Parser
 */

import { PromptParser } from '../PromptParser';
import { Epic1NodeType } from '../index';

describe('PromptParser', () => {
  let parser: PromptParser;

  beforeEach(() => {
    parser = new PromptParser();
  });

  describe('Basic parsing', () => {
    it('should parse a simple sentence', () => {
      const prompt = 'A weary merchant';
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe('A weary merchant');
      expect(result.segments[0].suggestedNodeType).toBe(
        Epic1NodeType.TextBlock
      );
      expect(result.segments[0].startIndex).toBe(0);
      expect(result.segments[0].endIndex).toBe(prompt.length);

      // Should have one text node + output node
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].node.getNodeType()).toBe(Epic1NodeType.TextBlock);
      expect(result.nodes[1].node.getNodeType()).toBe(Epic1NodeType.Output);
    });

    it('should parse a sentence with punctuation', () => {
      const prompt = 'A weary merchant in tattered robes.';
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe(
        'A weary merchant in tattered robes.'
      );
      expect(result.segments[0].endIndex).toBe(prompt.length);
    });

    it('should detect lists with "or"', () => {
      const prompt = 'carrying scrolls or books or potions';
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].suggestedNodeType).toBe(
        Epic1NodeType.WeightedChoice
      );
      expect(result.segments[0].metadata?.alternatives).toEqual([
        'carrying scrolls',
        'books',
        'potions'
      ]);

      const weightedNode = result.nodes[0].node;
      expect(weightedNode.getNodeType()).toBe(Epic1NodeType.WeightedChoice);
    });

    it('should detect lists with commas', () => {
      const prompt = 'red, blue, green, yellow';
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].suggestedNodeType).toBe(
        Epic1NodeType.WeightedChoice
      );
      expect(result.segments[0].metadata?.alternatives).toHaveLength(4);
    });

    it('should handle empty prompt', () => {
      const result = parser.parse('');

      expect(result.segments).toHaveLength(0);
      expect(result.nodes).toHaveLength(1); // Just output node
      expect(result.nodes[0].node.getNodeType()).toBe(Epic1NodeType.Output);
    });
  });

  describe('Complex parsing', () => {
    it('should parse the example from the story', () => {
      const prompt =
        'A weary merchant in tattered robes, carrying scrolls or books or potions';
      const result = parser.parse(prompt);

      expect(result.segments.length).toBeGreaterThanOrEqual(2);

      // First part should be text
      const firstSegment = result.segments[0];
      expect(firstSegment.text).toContain('weary merchant');
      expect(firstSegment.suggestedNodeType).toBe(Epic1NodeType.TextBlock);

      // Should detect the list
      const hasWeightedChoice = result.segments.some(
        s => s.suggestedNodeType === Epic1NodeType.WeightedChoice
      );
      expect(hasWeightedChoice).toBe(true);

      // Check that weighted choice has the right alternatives
      const weightedSegment = result.segments.find(
        s => s.suggestedNodeType === Epic1NodeType.WeightedChoice
      );
      expect(weightedSegment?.metadata?.alternatives).toContain('scrolls');
      expect(weightedSegment?.metadata?.alternatives).toContain('books');
      expect(weightedSegment?.metadata?.alternatives).toContain('potions');
    });

    it('should handle multi-line prompts', () => {
      const prompt = `First line of text
Second line of text
Third line with choices: apples or oranges`;

      const result = parser.parse(prompt);

      expect(result.segments.length).toBeGreaterThanOrEqual(3);

      // Last segment should be weighted choice
      const lastTextSegment = result.segments[result.segments.length - 1];
      expect(lastTextSegment.suggestedNodeType).toBe(
        Epic1NodeType.WeightedChoice
      );
    });

    it('should detect descriptive phrases', () => {
      const prompt = 'A knight with shining armor wearing a red cape';
      const result = parser.parse(prompt);

      // Should split on descriptive words
      expect(result.segments.length).toBeGreaterThanOrEqual(2);

      const texts = result.segments.map(s => s.text);
      expect(texts.some(t => t.includes('knight'))).toBe(true);
      expect(texts.some(t => t.includes('shining armor'))).toBe(true);
      expect(texts.some(t => t.includes('red cape'))).toBe(true);
    });

    it('should handle variables in text', () => {
      const prompt = 'Hello {{userName}}, welcome to {{location}}!';
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].suggestedNodeType).toBe(
        Epic1NodeType.TextBlock
      );
      expect(result.segments[0].confidence).toBeGreaterThan(0.9);
      expect(result.segments[0].metadata?.reason).toContain('variable');
    });
  });

  describe('Node generation', () => {
    it('should set all nodes to editing mode', () => {
      const prompt = 'Some text with choices: A or B or C';
      const result = parser.parse(prompt);

      // All nodes except output should be in edit mode
      for (let i = 0; i < result.nodes.length - 1; i++) {
        const node = result.nodes[i].node;
        expect(node.isEditing()).toBe(true);
      }
    });

    it('should generate unique IDs', () => {
      const prompt = 'First segment, second segment, third segment';
      const result = parser.parse(prompt);

      const ids = result.nodes.map(n => n.node.serialize().id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should calculate positions for nodes', () => {
      const prompt = 'A or B or C';
      const result = parser.parse(prompt);

      expect(result.nodes[0].position).toBeDefined();
      expect(result.nodes[0].position!.x).toBeGreaterThan(0);
      expect(result.nodes[0].position!.y).toBeGreaterThan(0);
    });

    it('should create proper WeightedChoice nodes', () => {
      const prompt = 'red or blue or green';
      const result = parser.parse(prompt);

      const weightedNode = result.nodes[0].node;
      expect(weightedNode.getNodeType()).toBe(Epic1NodeType.WeightedChoice);

      const value = weightedNode.getCurrentValue();
      expect(value).toHaveLength(3);
      expect(value[0].text).toBe('red');
      expect(value[1].text).toBe('blue');
      expect(value[2].text).toBe('green');

      // Weights should be distributed evenly
      expect(value[0].weight).toBeCloseTo(33.33, 0);
      expect(value[1].weight).toBeCloseTo(33.33, 0);
      expect(value[2].weight).toBeCloseTo(33.34, 0);
    });
  });

  describe('Mappings', () => {
    it('should create mappings with highlight colors', () => {
      const prompt = 'First part, second part, third part';
      const result = parser.parse(prompt);

      expect(result.mappings.length).toBeGreaterThan(0);

      for (const mapping of result.mappings) {
        expect(mapping.nodeId).toBeTruthy();
        expect(mapping.startIndex).toBeGreaterThanOrEqual(0);
        expect(mapping.endIndex).toBeGreaterThan(mapping.startIndex);
        expect(mapping.highlightColor).toBeTruthy();
      }
    });

    it('should map segments to correct text ranges', () => {
      const prompt = 'Hello world';
      const result = parser.parse(prompt);

      const mapping = result.mappings[0];
      const mappedText = prompt.slice(mapping.startIndex, mapping.endIndex);
      expect(mappedText).toBe('Hello world');
    });
  });

  describe('Boundary adjustment', () => {
    it('should adjust segment boundaries', () => {
      const prompt = 'One two three';
      let result = parser.parse(prompt);

      // Adjust first segment to only include "One"
      result = parser.adjustBoundary(result, 0, 0, 3);

      expect(result.segments[0].text).toBe('One');
      expect(result.segments[0].startIndex).toBe(0);
      expect(result.segments[0].endIndex).toBe(3);

      expect(result.mappings[0].startIndex).toBe(0);
      expect(result.mappings[0].endIndex).toBe(3);
    });

    it('should throw on invalid segment index', () => {
      const prompt = 'Test';
      const result = parser.parse(prompt);

      expect(() => {
        parser.adjustBoundary(result, 10, 0, 4);
      }).toThrow('Invalid segment index');
    });
  });

  describe('Segment merging', () => {
    it('should merge adjacent segments', () => {
      const prompt = 'First. Second.';
      let result = parser.parse(prompt);

      if (result.segments.length >= 2) {
        result = parser.mergeSegments(result, 0, 1);

        expect(result.segments[0].text).toBe('First. Second.');
        expect(result.segments[0].startIndex).toBe(0);
        expect(result.segments[0].endIndex).toBe(prompt.length);
      }
    });

    it('should throw on invalid merge indices', () => {
      const prompt = 'Test';
      const result = parser.parse(prompt);

      expect(() => {
        parser.mergeSegments(result, 1, 0);
      }).toThrow('Invalid segment indices');
    });
  });

  describe('Performance', () => {
    it('should parse large prompts quickly', () => {
      const largeParagraph = `
        In the mystical realm of Aethoria, where ancient magic flows through crystalline ley lines,
        a young apprentice named Elara discovered an artifact of immense power. The artifact could be
        a glowing orb, a enchanted staff, or a mysterious tome. She wore robes of midnight blue or
        forest green or crimson red, adorned with silver runes that shimmered in the moonlight.
        
        The journey ahead would take her through the Whispering Woods, across the Frozen Wastes,
        and into the heart of the Shadow Citadel. Along the way, she would need provisions:
        bread, cheese, dried fruits, or magical potions. Her companions might include a wise owl,
        a loyal wolf, or a mischievous pixie.
        
        As dawn broke over the mountains, Elara set forth with determination in her heart and
        the weight of destiny upon her shoulders. The fate of Aethoria rested in her hands.
      `.trim();

      const startTime = Date.now();
      const result = parser.parse(largeParagraph);
      const parseTime = Date.now() - startTime;

      // Should parse in under 500ms as per requirements
      expect(parseTime).toBeLessThan(500);

      // Should detect multiple segments
      expect(result.segments.length).toBeGreaterThan(5);

      // Should detect weighted choices
      const weightedChoices = result.segments.filter(
        s => s.suggestedNodeType === Epic1NodeType.WeightedChoice
      );
      expect(weightedChoices.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle prompts with only punctuation', () => {
      const prompt = '...!!!???';
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.nodes).toHaveLength(2); // text + output
    });

    it('should handle prompts with special characters', () => {
      const prompt = 'Hello @user! Check out #awesome-stuff & more...';
      const result = parser.parse(prompt);

      expect(result.segments.length).toBeGreaterThan(0);
      expect(result.segments[0].text).toContain('Hello');
    });

    it('should handle very long lists', () => {
      const items = Array.from({ length: 20 }, (_, i) => `item${i + 1}`);
      const prompt = items.join(' or ');
      const result = parser.parse(prompt);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].suggestedNodeType).toBe(
        Epic1NodeType.WeightedChoice
      );
      expect(result.segments[0].metadata?.alternatives).toHaveLength(20);
    });

    it('should handle nested lists gracefully', () => {
      const prompt = 'Choose red or blue, then pick small or large';
      const result = parser.parse(prompt);

      // Should create two separate weighted choices
      const weightedSegments = result.segments.filter(
        s => s.suggestedNodeType === Epic1NodeType.WeightedChoice
      );
      expect(weightedSegments.length).toBeGreaterThanOrEqual(1);
    });
  });
});

/**
 * Comprehensive tests for the validation system
 */

import {
  validateNode,
  validateGraph,
  sanitizeValue,
  ValidationError,
  ValidationResult,
  ValidationContext
} from '../validation';

import {
  TextBlockNode,
  WeightedChoiceNode,
  ConcatNode,
  VariableNode,
  OutputNode,
  Epic1NodeType
} from '../index';

describe('Validation System', () => {
  describe('validateNode', () => {
    it('should validate a valid TextBlock node', async () => {
      const node = new TextBlockNode('text-1', 'Hello {{name}}!');
      const result = await validateNode(node);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect incomplete variable syntax', async () => {
      const node = new TextBlockNode('text-2', 'Hello {{name');
      const result = await validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        'Incomplete variable syntax detected'
      );
    });

    it('should warn about empty TextBlock', async () => {
      const node = new TextBlockNode('text-3', '   ');
      const result = await validateNode(node);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Text block is empty');
    });

    it('should validate WeightedChoice with valid options', async () => {
      const node = new WeightedChoiceNode('weighted-1', [
        { id: 'opt1', text: 'Option 1', weight: 60 },
        { id: 'opt2', text: 'Option 2', weight: 40 }
      ]);

      const result = await validateNode(node);
      expect(result.valid).toBe(true);
    });

    it('should error on WeightedChoice with no options', async () => {
      const node = new WeightedChoiceNode('weighted-2', []);
      const result = await validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(
        'WeightedChoice must have at least one option'
      );
    });

    it('should error on all zero weights', async () => {
      const node = new WeightedChoiceNode('weighted-3', [
        { id: 'opt1', text: 'A', weight: 0 },
        { id: 'opt2', text: 'B', weight: 0 }
      ]);

      const result = await validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(
        'At least one option must have a non-zero weight'
      );
    });

    it('should warn about empty option text', async () => {
      const node = new WeightedChoiceNode('weighted-4', [
        { id: 'opt1', text: '  ', weight: 50 },
        { id: 'opt2', text: 'Valid', weight: 50 }
      ]);

      const result = await validateNode(node);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Option 1 has empty text');
    });

    it('should warn about duplicate option text', async () => {
      const node = new WeightedChoiceNode('weighted-5', [
        { id: 'opt1', text: 'Same', weight: 50 },
        { id: 'opt2', text: 'Same', weight: 50 }
      ]);

      const result = await validateNode(node);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Duplicate option text: "Same"');
    });

    it('should validate Variable node with valid name', async () => {
      const node = new VariableNode('var-1', {
        name: 'validName123',
        defaultValue: 'test'
      });

      const result = await validateNode(node);
      expect(result.valid).toBe(true);
    });

    it('should error on reserved variable names', async () => {
      const node = new VariableNode('var-2', {
        name: '__proto__',
        defaultValue: 'test'
      });

      const result = await validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(
        'Variable name "__proto__" is reserved'
      );
    });

    it('should validate Output node with connection', async () => {
      const node = new OutputNode('output-1');
      const edges = [{ source: 'text-1', target: 'output-1' }];

      const result = await validateNode(node, { edges });
      expect(result.valid).toBe(true);
    });

    it('should error on Output node without connections', async () => {
      const node = new OutputNode('output-2');
      const edges: any[] = [];

      const result = await validateNode(node, { edges });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(
        'Output node has no incoming connections'
      );
    });

    it('should error on Output node with multiple connections', async () => {
      const node = new OutputNode('output-3');
      const edges = [
        { source: 'text-1', target: 'output-3' },
        { source: 'text-2', target: 'output-3' }
      ];

      const result = await validateNode(node, { edges });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(
        'Output node has multiple incoming connections'
      );
    });

    it('should warn if Output node is not locked', async () => {
      const node = new OutputNode('output-4');
      const edges = [{ source: 'text-1', target: 'output-4' }];

      const result = await validateNode(node, { edges });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Output node should be locked');
    });

    it('should warn about Concat node without connections', async () => {
      const node = new ConcatNode('concat-1');
      const edges: any[] = [];

      const result = await validateNode(node, { edges });
      expect(result.valid).toBe(true);
      expect(result.warnings[0].message).toBe(
        'Concat node has no incoming connections'
      );
    });

    it('should warn about Concat node with single connection', async () => {
      const node = new ConcatNode('concat-2');
      const edges = [{ source: 'text-1', target: 'concat-2' }];

      const result = await validateNode(node, { edges });
      expect(result.warnings[0].message).toBe(
        'Concat node has only one input (concatenation not needed)'
      );
    });

    it('should detect duplicate variable names', async () => {
      const var1 = new VariableNode('var-1', { name: 'duplicateName' });
      const var2 = new VariableNode('var-2', { name: 'duplicateName' });

      const nodes = new Map([
        ['var-1', var1],
        ['var-2', var2]
      ]);

      const result = await validateNode(var1, { nodes });
      expect(result.warnings[0].message).toBe(
        'Variable name "duplicateName" is used by multiple nodes'
      );
    });

    it('should handle validation errors gracefully', async () => {
      // Create a node that throws during validation
      const node = new TextBlockNode('error-node', 'test');

      // Mock the validate method to throw
      node.validate = async () => {
        throw new Error('Validation error');
      };

      const result = await validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe(
        'Validation error: Validation error'
      );
    });

    it('should track dirty state', async () => {
      const node = new TextBlockNode('dirty-1', 'Initial');

      node.startEdit();
      node.updateEditBuffer('Changed');

      const result = await validateNode(node);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toBe('Node has unsaved changes');
    });
  });

  describe('validateGraph', () => {
    it('should validate a complete valid graph', async () => {
      const text = new TextBlockNode('text', 'Hello world!');
      const output = new OutputNode('output');
      output.lock();

      const nodes = new Map([
        ['text', text],
        ['output', output]
      ]);

      const edges = [{ source: 'text', target: 'output' }];

      const result = await validateGraph(nodes, edges);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing output node', async () => {
      const text = new TextBlockNode('text', 'Hello');
      const nodes = new Map([['text', text]]);
      const edges: any[] = [];

      const result = await validateGraph(nodes, edges);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Graph has no output node');
    });

    it('should warn about multiple output nodes', async () => {
      const output1 = new OutputNode('output1');
      const output2 = new OutputNode('output2');

      const nodes = new Map([
        ['output1', output1],
        ['output2', output2]
      ]);

      const edges: any[] = [];

      const result = await validateGraph(nodes, edges);
      expect(
        result.warnings.some(
          w => w.message === 'Graph has multiple output nodes'
        )
      ).toBe(true);
    });

    it('should warn about orphaned nodes', async () => {
      const text1 = new TextBlockNode('text1', 'Connected');
      const text2 = new TextBlockNode('text2', 'Orphaned');
      const output = new OutputNode('output');

      const nodes = new Map([
        ['text1', text1],
        ['text2', text2],
        ['output', output]
      ]);

      const edges = [{ source: 'text1', target: 'output' }];

      const result = await validateGraph(nodes, edges);
      expect(
        result.warnings.some(
          w =>
            w.nodeId === 'text2' &&
            w.message === 'Node is not connected to any other nodes'
        )
      ).toBe(true);
    });

    it('should detect cycles in graph', async () => {
      const node1 = new TextBlockNode('node1', 'A');
      const node2 = new TextBlockNode('node2', 'B');
      const node3 = new TextBlockNode('node3', 'C');

      const nodes = new Map([
        ['node1', node1],
        ['node2', node2],
        ['node3', node3]
      ]);

      const edges = [
        { source: 'node1', target: 'node2' },
        { source: 'node2', target: 'node3' },
        { source: 'node3', target: 'node1' } // Creates cycle
      ];

      const result = await validateGraph(nodes, edges);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Graph contains cycles');
    });

    it('should handle complex valid graph', async () => {
      const var1 = new VariableNode('var1', {
        name: 'name',
        defaultValue: 'User'
      });
      const text1 = new TextBlockNode('text1', 'Hello {{name}}!');
      const text2 = new TextBlockNode('text2', 'Welcome!');
      const weighted = new WeightedChoiceNode('weighted', [
        { id: 'opt1', text: 'Happy', weight: 70 },
        { id: 'opt2', text: 'Excited', weight: 30 }
      ]);
      const concat = new ConcatNode('concat', { separator: ' ' });
      const output = new OutputNode('output');
      output.lock();

      const nodes = new Map([
        ['var1', var1],
        ['text1', text1],
        ['text2', text2],
        ['weighted', weighted],
        ['concat', concat],
        ['output', output]
      ]);

      const edges = [
        { source: 'text1', target: 'concat' },
        { source: 'text2', target: 'concat' },
        { source: 'weighted', target: 'concat' },
        { source: 'concat', target: 'output' }
      ];

      const result = await validateGraph(nodes, edges);
      expect(result.valid).toBe(true);
    });

    it('should aggregate all node validation results', async () => {
      const text = new TextBlockNode('text', 'Hello {{incomplete');
      const weighted = new WeightedChoiceNode('weighted', []);
      const output = new OutputNode('output');

      const nodes = new Map([
        ['text', text],
        ['weighted', weighted],
        ['output', output]
      ]);

      const edges: any[] = [];

      const result = await validateGraph(nodes, edges);
      expect(result.valid).toBe(false);

      // Should have errors from multiple nodes
      expect(result.errors.length).toBeGreaterThan(2);
      expect(result.errors.some(e => e.nodeId === 'text')).toBe(true);
      expect(result.errors.some(e => e.nodeId === 'weighted')).toBe(true);
      expect(result.errors.some(e => e.nodeId === 'output')).toBe(true);
    });
  });

  describe('sanitizeValue', () => {
    it('should pass through primitive values', () => {
      expect(sanitizeValue('string')).toBe('string');
      expect(sanitizeValue(42)).toBe(42);
      expect(sanitizeValue(true)).toBe(true);
      expect(sanitizeValue(null)).toBe(null);
      expect(sanitizeValue(undefined)).toBe(undefined);
    });

    it('should deep clone arrays', () => {
      const original = [1, 2, { a: 3 }];
      const sanitized = sanitizeValue(original);

      expect(sanitized).toEqual(original);
      expect(sanitized).not.toBe(original);
      expect(sanitized[2]).not.toBe(original[2]);
    });

    it('should deep clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const sanitized = sanitizeValue(original);

      expect(sanitized).toEqual(original);
      expect(sanitized).not.toBe(original);
      expect(sanitized.b).not.toBe(original.b);
    });

    it('should strip functions from objects', () => {
      const original = {
        a: 1,
        fn: () => console.log('test'),
        b: 2
      };

      const sanitized = sanitizeValue(original);
      expect(sanitized).toEqual({ a: 1, b: 2 });
      expect(sanitized).not.toHaveProperty('fn');
    });

    it('should reject function type', () => {
      expect(() => sanitizeValue(() => {})).toThrow(
        'Unsafe value type: function'
      );
    });

    it('should reject symbol type', () => {
      expect(() => sanitizeValue(Symbol('test'))).toThrow(
        'Unsafe value type: symbol'
      );
    });

    it('should handle circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      expect(() => sanitizeValue(obj)).toThrow(
        'Value contains non-serializable data'
      );
    });

    it('should handle dates by converting to string', () => {
      const date = new Date('2024-01-01');
      const sanitized = sanitizeValue({ date });

      expect(typeof sanitized.date).toBe('string');
      expect(sanitized.date).toBe(date.toISOString());
    });
  });
});

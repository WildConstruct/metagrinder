/**
 * Comprehensive tests for ConcatNode
 */

import { ConcatNode } from '../ConcatNode';
import { Epic1NodeType } from '../index';

describe('ConcatNode', () => {
  describe('Basic functionality', () => {
    it('should create with default configuration', () => {
      const node = new ConcatNode('test-1');

      expect(node.getNodeType()).toBe(Epic1NodeType.Concat);
      expect(node.getData().configuration?.separator).toBe(' ');
      expect(node.getData().configuration?.trimInputs).toBe(true);
    });

    it('should create with custom configuration', () => {
      const node = new ConcatNode('test-2', {
        separator: ', ',
        trimInputs: false
      });

      expect(node.getData().configuration?.separator).toBe(', ');
      expect(node.getData().configuration?.trimInputs).toBe(false);
    });
  });

  describe('Configuration management', () => {
    it('should update separator', () => {
      const node = new ConcatNode('test-3');

      node.setSeparator(' - ');
      expect(node.getData().configuration?.separator).toBe(' - ');

      // Test presets
      node.setSeparator('newline');
      expect(node.getData().configuration?.separator).toBe('\n');

      node.setSeparator('comma');
      expect(node.getData().configuration?.separator).toBe(', ');

      node.setSeparator('pipe');
      expect(node.getData().configuration?.separator).toBe(' | ');
    });

    it('should update trim setting', () => {
      const node = new ConcatNode('test-4');

      node.setTrimInputs(false);
      expect(node.getData().configuration?.trimInputs).toBe(false);

      node.setTrimInputs(true);
      expect(node.getData().configuration?.trimInputs).toBe(true);
    });
  });

  describe('Preview functionality', () => {
    it('should preview concatenation', () => {
      const node = new ConcatNode('test-5', { separator: ' + ' });

      const result = node.preview(['Hello', 'World']);
      expect(result).toBe('Hello + World');
    });

    it('should handle trimming in preview', () => {
      const node = new ConcatNode('test-6', {
        separator: ',',
        trimInputs: true
      });

      const result = node.preview(['  Hello  ', '  World  ']);
      expect(result).toBe('Hello,World');
    });

    it('should handle empty inputs in preview', () => {
      const node = new ConcatNode('test-7');

      const result = node.preview(['Hello', '', 'World', null, undefined]);
      expect(result).toBe('Hello World');
    });

    it('should handle no inputs', () => {
      const node = new ConcatNode('test-8');

      expect(node.preview([])).toBe('');
      expect(node.preview([null, undefined, ''])).toBe('');
    });
  });

  describe('Inline editing', () => {
    it('should handle configuration editing', async () => {
      const node = new ConcatNode('test-9');

      node.startEdit();
      node.updateEditBuffer({ separator: ' | ', trimInputs: false });
      await node.commitEdit();

      expect(node.getData().configuration?.separator).toBe(' | ');
      expect(node.getData().configuration?.trimInputs).toBe(false);
    });

    it('should validate separator', async () => {
      const node = new ConcatNode('test-10');

      node.startEdit();
      node.updateEditBuffer({ separator: '', trimInputs: true });

      // Empty separator should be valid
      await node.commitEdit();
      expect(node.getData().configuration?.separator).toBe('');
    });
  });

  describe('Separator presets', () => {
    it('should handle all preset types', () => {
      const node = new ConcatNode('test-11');

      const presets = [
        { name: 'space', expected: ' ' },
        { name: 'comma', expected: ', ' },
        { name: 'newline', expected: '\n' },
        { name: 'tab', expected: '\t' },
        { name: 'pipe', expected: ' | ' },
        { name: 'dash', expected: ' - ' },
        { name: 'none', expected: '' }
      ];

      presets.forEach(preset => {
        node.setSeparator(preset.name);
        expect(node.getData().configuration?.separator).toBe(preset.expected);
      });
    });

    it('should handle custom separators', () => {
      const node = new ConcatNode('test-12');

      const customSeparators = [' ### ', '::', ' and ', '\n\n', '👉'];

      customSeparators.forEach(sep => {
        node.setSeparator(sep);
        expect(node.getData().configuration?.separator).toBe(sep);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very long separators', () => {
      const node = new ConcatNode('test-13');
      const longSep = '-'.repeat(100);

      node.setSeparator(longSep);
      expect(node.getData().configuration?.separator).toBe(longSep);

      const result = node.preview(['A', 'B']);
      expect(result).toBe(`A${longSep}B`);
    });

    it('should handle special characters in separator', () => {
      const node = new ConcatNode('test-14');

      const specialSeps = ['\n\r', '\u0000', '\\', '"', "'", '${}'];

      specialSeps.forEach(sep => {
        node.setSeparator(sep);
        const result = node.preview(['A', 'B']);
        expect(result).toBe(`A${sep}B`);
      });
    });

    it('should handle numeric inputs', () => {
      const node = new ConcatNode('test-15');

      const result = node.preview([1, 2.5, -3, 0]);
      expect(result).toBe('1 2.5 -3 0');
    });

    it('should handle mixed type inputs', () => {
      const node = new ConcatNode('test-16', { separator: ', ' });

      const result = node.preview(['Text', 123, true, false, null, undefined]);
      expect(result).toBe('Text, 123, true, false');
    });
  });

  describe('Validation', () => {
    it('should always be valid', async () => {
      const node = new ConcatNode('test-17');

      // ConcatNode has no validation rules
      const isValid = await node.validate();
      expect(isValid).toBe(true);
      expect(node.getValidationErrors()).toHaveLength(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize and restore correctly', () => {
      const node = new ConcatNode('test-18', {
        separator: ' || ',
        trimInputs: false
      });

      const serialized = node.serialize();
      expect(serialized).toEqual({
        id: 'test-18',
        type: Epic1NodeType.Concat,
        data: expect.objectContaining({
          value: expect.any(Object),
          configuration: {
            separator: ' || ',
            trimInputs: false
          }
        }),
        metadata: expect.any(Object)
      });

      const restored = new ConcatNode('test-18');
      restored.setData(serialized.data);

      expect(restored.getData().configuration?.separator).toBe(' || ');
      expect(restored.getData().configuration?.trimInputs).toBe(false);
    });
  });

  describe('Trimming behavior', () => {
    it('should trim each input when enabled', () => {
      const node = new ConcatNode('test-19', {
        separator: ',',
        trimInputs: true
      });

      const inputs = [
        '  leading spaces',
        'trailing spaces  ',
        '  both sides  ',
        'no spaces',
        '   ' // Only spaces
      ];

      const result = node.preview(inputs);
      expect(result).toBe(
        'leading spaces,trailing spaces,both sides,no spaces'
      );
    });

    it('should preserve spaces when trimming disabled', () => {
      const node = new ConcatNode('test-20', {
        separator: '|',
        trimInputs: false
      });

      const inputs = ['  A  ', '  B  '];
      const result = node.preview(inputs);
      expect(result).toBe('  A  |  B  ');
    });
  });

  describe('Empty handling', () => {
    it('should filter empty strings after trimming', () => {
      const node = new ConcatNode('test-21', {
        separator: ', ',
        trimInputs: true
      });

      const inputs = ['A', '   ', '', 'B', '  ', 'C'];
      const result = node.preview(inputs);
      expect(result).toBe('A, B, C');
    });

    it('should keep empty strings when not trimming', () => {
      const node = new ConcatNode('test-22', {
        separator: '|',
        trimInputs: false
      });

      const inputs = ['A', '', 'B'];
      const result = node.preview(inputs);
      expect(result).toBe('A||B');
    });
  });
});

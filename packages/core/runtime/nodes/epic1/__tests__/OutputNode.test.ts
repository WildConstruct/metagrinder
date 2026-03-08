/**
 * Comprehensive tests for OutputNode
 */

import { OutputNode } from '../OutputNode';
import { Epic1NodeType } from '../index';

describe('OutputNode', () => {
  describe('Basic functionality', () => {
    it('should create with default state', () => {
      const node = new OutputNode('test-1');

      expect(node.getNodeType()).toBe(Epic1NodeType.Output);
      expect(node.getCurrentValue()).toBe('');
      expect(node.isLocked()).toBe(false);
      expect(node.getData().configuration?.previewMode).toBe('live');
    });

    it('should create with initial value', () => {
      const node = new OutputNode('test-2', 'Initial output');

      expect(node.getCurrentValue()).toBe('Initial output');
    });
  });

  describe('Input management', () => {
    it('should set input value', () => {
      const node = new OutputNode('test-3');

      node.setInput('Test output');
      expect(node.getCurrentValue()).toBe('Test output');

      node.setInput('Updated output');
      expect(node.getCurrentValue()).toBe('Updated output');
    });

    it('should handle different input types', () => {
      const node = new OutputNode('test-4');

      // String
      node.setInput('text');
      expect(node.getCurrentValue()).toBe('text');

      // Number
      node.setInput(42);
      expect(node.getCurrentValue()).toBe('42');

      // Boolean
      node.setInput(true);
      expect(node.getCurrentValue()).toBe('true');

      // Array
      node.setInput([1, 2, 3]);
      expect(node.getCurrentValue()).toBe('1,2,3');

      // Object (JSON)
      node.setInput({ key: 'value' });
      expect(node.getCurrentValue()).toBe('{"key":"value"}');

      // Null/undefined
      node.setInput(null);
      expect(node.getCurrentValue()).toBe('');

      node.setInput(undefined);
      expect(node.getCurrentValue()).toBe('');
    });
  });

  describe('Statistics', () => {
    it('should calculate stats for text', () => {
      const node = new OutputNode('test-5');

      node.setInput('Hello world!\nThis is a test.');
      const stats = node.getStats();

      expect(stats.isEmpty).toBe(false);
      expect(stats.length).toBe(28);
      expect(stats.wordCount).toBe(6);
      expect(stats.lineCount).toBe(2);
    });

    it('should handle empty output', () => {
      const node = new OutputNode('test-6');

      const stats = node.getStats();
      expect(stats.isEmpty).toBe(true);
      expect(stats.length).toBe(0);
      expect(stats.wordCount).toBe(0);
      expect(stats.lineCount).toBe(0);
    });

    it('should count words correctly', () => {
      const node = new OutputNode('test-7');

      // Various word separators
      node.setInput('one two\tthree\nfour     five');
      expect(node.getStats().wordCount).toBe(5);

      // Punctuation
      node.setInput('Hello, world! How are you?');
      expect(node.getStats().wordCount).toBe(5);

      // Numbers
      node.setInput('I have 2 cats and 3 dogs');
      expect(node.getStats().wordCount).toBe(7);
    });

    it('should count lines correctly', () => {
      const node = new OutputNode('test-8');

      // Single line
      node.setInput('Single line');
      expect(node.getStats().lineCount).toBe(1);

      // Multiple lines
      node.setInput('Line 1\nLine 2\nLine 3');
      expect(node.getStats().lineCount).toBe(3);

      // Empty lines
      node.setInput('Line 1\n\nLine 3');
      expect(node.getStats().lineCount).toBe(3);

      // Trailing newline
      node.setInput('Line 1\n');
      expect(node.getStats().lineCount).toBe(1);
    });
  });

  describe('Format detection', () => {
    it('should detect JSON format', () => {
      const node = new OutputNode('test-9');

      node.setInput('{"key": "value", "number": 42}');
      expect(node.detectFormat()).toBe('json');

      node.setInput('[1, 2, 3]');
      expect(node.detectFormat()).toBe('json');
    });

    it('should detect Markdown format', () => {
      const node = new OutputNode('test-10');

      node.setInput('# Heading\n\nSome **bold** text');
      expect(node.detectFormat()).toBe('markdown');

      node.setInput('- Item 1\n- Item 2\n- Item 3');
      expect(node.detectFormat()).toBe('markdown');

      node.setInput('[Link](https://example.com)');
      expect(node.detectFormat()).toBe('markdown');
    });

    it('should detect code format', () => {
      const node = new OutputNode('test-11');

      node.setInput('function test() {\n  return true;\n}');
      expect(node.detectFormat()).toBe('code');

      node.setInput('const x = 42;\nif (x > 0) {\n  console.log(x);\n}');
      expect(node.detectFormat()).toBe('code');
    });

    it('should default to text format', () => {
      const node = new OutputNode('test-12');

      node.setInput('Plain text without special formatting');
      expect(node.detectFormat()).toBe('text');

      node.setInput('');
      expect(node.detectFormat()).toBe('text');
    });
  });

  describe('Preview generation', () => {
    it('should generate preview for short text', () => {
      const node = new OutputNode('test-13');

      node.setInput('Short text');
      expect(node.getPreview()).toBe('Short text');
    });

    it('should truncate long text', () => {
      const node = new OutputNode('test-14');

      const longText = 'a'.repeat(200);
      node.setInput(longText);

      const preview = node.getPreview(50);
      expect(preview).toBe('a'.repeat(50) + '...');
      expect(preview.length).toBe(53); // 50 + '...'
    });

    it('should handle multiline preview', () => {
      const node = new OutputNode('test-15');

      node.setInput('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
      const preview = node.getPreview(20);

      expect(preview.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(preview.endsWith('...')).toBe(true);
    });
  });

  describe('Locking behavior', () => {
    it('should handle locking', () => {
      const node = new OutputNode('test-16');

      node.lock('Output nodes should be read-only');
      expect(node.isLocked()).toBe(true);

      // Should prevent editing
      expect(() => node.startEdit()).toThrow('Cannot edit locked node');

      // But should still allow setting input
      node.setInput('New value'); // Should not throw
      expect(node.getCurrentValue()).toBe('New value');
    });

    it('should be lockable and unlockable', () => {
      const node = new OutputNode('test-17');

      node.lock();
      expect(node.isLocked()).toBe(true);

      node.unlock();
      expect(node.isLocked()).toBe(false);

      // Should be editable after unlock
      node.startEdit(); // Should not throw
      expect(node.isEditing()).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should always be valid', async () => {
      const node = new OutputNode('test-18');

      // Empty
      expect(await node.validate()).toBe(true);

      // With content
      node.setInput('Any content');
      expect(await node.validate()).toBe(true);

      // Very long content
      node.setInput('x'.repeat(10000));
      expect(await node.validate()).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize and restore correctly', () => {
      const node = new OutputNode('test-19', 'Test output');
      node.lock('Read-only');

      const serialized = node.serialize();
      expect(serialized).toEqual({
        id: 'test-19',
        type: Epic1NodeType.Output,
        data: expect.objectContaining({
          value: 'Test output',
          isLocked: true,
          lockReason: 'Read-only',
          configuration: {
            previewMode: 'live'
          }
        }),
        metadata: expect.any(Object)
      });

      const restored = new OutputNode('test-19');
      restored.setData(serialized.data);

      expect(restored.getCurrentValue()).toBe('Test output');
      expect(restored.isLocked()).toBe(true);
      expect(restored.getData().lockReason).toBe('Read-only');
    });
  });

  describe('Edge cases', () => {
    it('should handle very large outputs', () => {
      const node = new OutputNode('test-20');

      const largeOutput = 'x'.repeat(1000000); // 1MB
      node.setInput(largeOutput);

      expect(node.getCurrentValue().length).toBe(1000000);
      expect(node.getStats().length).toBe(1000000);

      // Preview should truncate
      const preview = node.getPreview(100);
      expect(preview.length).toBe(103); // 100 + '...'
    });

    it('should handle special characters', () => {
      const node = new OutputNode('test-21');

      const special = '\0\n\r\t\u0000\u001F';
      node.setInput(special);

      expect(node.getCurrentValue()).toBe(special);
    });

    it('should handle circular object references', () => {
      const node = new OutputNode('test-22');

      const obj: any = { a: 1 };
      obj.self = obj;

      // Should handle gracefully
      node.setInput(obj);

      // Should show [Circular] or similar
      const output = node.getCurrentValue();
      expect(output).toContain('Circular');
    });

    it('should handle arrays with mixed types', () => {
      const node = new OutputNode('test-23');

      const mixed = [1, 'two', true, null, undefined, { key: 'value' }];
      node.setInput(mixed);

      const output = node.getCurrentValue();
      expect(output).toBe('1,two,true,,,{"key":"value"}');
    });
  });

  describe('Display formatting', () => {
    it('should format JSON nicely', () => {
      const node = new OutputNode('test-24');

      const obj = {
        name: 'Test',
        value: 42,
        nested: {
          array: [1, 2, 3]
        }
      };

      node.setInput(obj);

      const output = node.getCurrentValue();
      expect(output).toBe(JSON.stringify(obj));
      expect(node.detectFormat()).toBe('json');
    });

    it('should preserve whitespace in text', () => {
      const node = new OutputNode('test-25');

      const formatted = '  Indented\n    More indented\n  Back';
      node.setInput(formatted);

      expect(node.getCurrentValue()).toBe(formatted);
    });
  });
});

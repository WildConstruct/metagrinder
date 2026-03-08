/**
 * Comprehensive tests for TextBlockNode
 */

import { TextBlockNode } from '../TextBlockNode';
import { Epic1NodeType } from '../index';

describe('TextBlockNode', () => {
  describe('Basic functionality', () => {
    it('should create with default configuration', () => {
      const node = new TextBlockNode('test-1', 'Hello world');

      expect(node.getNodeType()).toBe(Epic1NodeType.TextBlock);
      expect(node.getCurrentValue()).toBe('Hello world');
      expect(node.isLocked()).toBe(false);
      expect(node.isEditing()).toBe(false);
    });

    it('should create with custom configuration', () => {
      const node = new TextBlockNode('test-2', 'Test text', {
        maxLength: 100,
        multiline: false,
        placeholder: 'Enter text...'
      });

      const data = node.getData();
      expect(data.configuration?.maxLength).toBe(100);
      expect(data.configuration?.multiline).toBe(false);
      expect(data.configuration?.placeholder).toBe('Enter text...');
    });
  });

  describe('Inline editing', () => {
    it('should handle edit workflow', async () => {
      const node = new TextBlockNode('test-3', 'Initial text');

      // Start editing
      node.startEdit();
      expect(node.isEditing()).toBe(true);
      expect(node.isDirty()).toBe(false);

      // Update buffer
      node.updateEditBuffer('Updated text');
      expect(node.isDirty()).toBe(true);
      expect(node.getCurrentValue()).toBe('Initial text'); // Not committed yet

      // Commit
      await node.commitEdit();
      expect(node.isEditing()).toBe(false);
      expect(node.getCurrentValue()).toBe('Updated text');
      expect(node.isDirty()).toBe(false);
    });

    it('should handle cancel edit', () => {
      const node = new TextBlockNode('test-4', 'Original text');

      node.startEdit();
      node.updateEditBuffer('Changed text');
      node.cancelEdit();

      expect(node.isEditing()).toBe(false);
      expect(node.getCurrentValue()).toBe('Original text');
      expect(node.isDirty()).toBe(false);
    });

    it('should prevent editing when locked', () => {
      const node = new TextBlockNode('test-5', 'Locked text');
      node.lock('Test lock');

      expect(() => node.startEdit()).toThrow('Cannot edit locked node');
      expect(node.isLocked()).toBe(true);

      // Unlock and try again
      node.unlock();
      node.startEdit(); // Should not throw
      expect(node.isEditing()).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate max length', async () => {
      const node = new TextBlockNode('test-6', 'Short', { maxLength: 10 });

      node.startEdit();
      node.updateEditBuffer('This is too long');

      // Should fail validation
      await expect(node.commitEdit()).rejects.toThrow('Validation failed');

      const errors = node.getValidationErrors();
      expect(errors).toContain('Text exceeds maximum length of 10 characters');
    });

    it('should validate required field', async () => {
      const node = new TextBlockNode('test-7', 'Text', { required: true });

      node.startEdit();
      node.updateEditBuffer('');

      await expect(node.commitEdit()).rejects.toThrow('Validation failed');

      const errors = node.getValidationErrors();
      expect(errors).toContain('Text is required');
    });

    it('should detect incomplete variable syntax', async () => {
      const node = new TextBlockNode('test-8', 'Hello {{name');

      const isValid = await node.validate();
      expect(isValid).toBe(false);

      const errors = node.getValidationErrors();
      expect(errors.some(e => e.includes('Incomplete variable syntax'))).toBe(
        true
      );
    });

    it('should allow valid variable syntax', async () => {
      const node = new TextBlockNode(
        'test-9',
        'Hello {{name}} and {{greeting}}!'
      );

      const isValid = await node.validate();
      expect(isValid).toBe(true);
      expect(node.getValidationErrors()).toHaveLength(0);
    });
  });

  describe('Character and word counting', () => {
    it('should count characters correctly', () => {
      const node = new TextBlockNode('test-10', 'Hello world!');

      expect(node.getCharacterCount()).toBe(12);
      expect(node.getCharacterCount(false)).toBe(12); // No spaces to exclude
    });

    it('should count characters without spaces', () => {
      const node = new TextBlockNode('test-11', 'Hello world !');

      expect(node.getCharacterCount(true)).toBe(13); // With spaces
      expect(node.getCharacterCount(false)).toBe(11); // Without spaces
    });

    it('should count words correctly', () => {
      const node = new TextBlockNode('test-12', 'Hello world, how are you?');

      expect(node.getWordCount()).toBe(5);
    });

    it('should handle empty text', () => {
      const node = new TextBlockNode('test-13', '');

      expect(node.getCharacterCount()).toBe(0);
      expect(node.getWordCount()).toBe(0);
    });

    it('should count multi-line text', () => {
      const node = new TextBlockNode(
        'test-14',
        'Line one\nLine two\nLine three'
      );

      expect(node.getWordCount()).toBe(6);
      expect(node.getCharacterCount()).toBe(28); // Including newlines
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const node = new TextBlockNode('test-15', 'Test content', {
        maxLength: 200,
        multiline: true,
        placeholder: 'Custom placeholder'
      });

      const serialized = node.serialize();

      expect(serialized).toEqual({
        id: 'test-15',
        type: Epic1NodeType.TextBlock,
        data: expect.objectContaining({
          value: 'Test content',
          configuration: {
            maxLength: 200,
            multiline: true,
            placeholder: 'Custom placeholder'
          },
          editState: expect.any(Object)
        }),
        metadata: expect.any(Object)
      });
    });

    it('should restore from serialized data', () => {
      const original = new TextBlockNode('test-16', 'Original text');
      original.lock('Test reason');

      const serialized = original.serialize();
      const restored = new TextBlockNode('test-16', '');
      restored.setData(serialized.data);

      expect(restored.getCurrentValue()).toBe('Original text');
      expect(restored.isLocked()).toBe(true);
      expect(restored.getData().lockReason).toBe('Test reason');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long text', async () => {
      const longText = 'a'.repeat(10000);
      const node = new TextBlockNode('test-17', longText);

      expect(node.getCurrentValue()).toBe(longText);
      expect(node.getCharacterCount()).toBe(10000);

      // Should validate successfully without maxLength
      const isValid = await node.validate();
      expect(isValid).toBe(true);
    });

    it('should handle special characters', async () => {
      const specialText = 'Hello\n\t"World"! & <script>alert("xss")</script>';
      const node = new TextBlockNode('test-18', specialText);

      expect(node.getCurrentValue()).toBe(specialText);

      const isValid = await node.validate();
      expect(isValid).toBe(true);
    });

    it('should handle concurrent edit attempts', () => {
      const node = new TextBlockNode('test-19', 'Text');

      node.startEdit();

      // Second edit attempt should throw
      expect(() => node.startEdit()).toThrow('Node is already being edited');
    });

    it('should handle commit without changes', async () => {
      const node = new TextBlockNode('test-20', 'Unchanged');

      node.startEdit();
      await node.commitEdit(); // No changes made

      expect(node.getCurrentValue()).toBe('Unchanged');
      expect(node.isDirty()).toBe(false);
    });
  });

  describe('Variable detection', () => {
    it('should detect variables in text', () => {
      const node = new TextBlockNode(
        'test-21',
        'Hello {{name}}, your score is {{score}}!'
      );

      const variables = node.getVariables();
      expect(variables).toEqual(['name', 'score']);
    });

    it('should handle no variables', () => {
      const node = new TextBlockNode('test-22', 'Plain text without variables');

      const variables = node.getVariables();
      expect(variables).toEqual([]);
    });

    it('should handle duplicate variables', () => {
      const node = new TextBlockNode(
        'test-23',
        '{{name}} meets {{name}} at {{place}}'
      );

      const variables = node.getVariables();
      expect(variables).toEqual(['name', 'place']); // No duplicates
    });
  });

  describe('Multiline support', () => {
    it('should reject newlines when multiline is false', async () => {
      const node = new TextBlockNode('test-24', 'Single line', {
        multiline: false
      });

      node.startEdit();
      node.updateEditBuffer('Line one\nLine two');

      await expect(node.commitEdit()).rejects.toThrow('Validation failed');

      const errors = node.getValidationErrors();
      expect(errors).toContain('Multiline text not allowed');
    });

    it('should accept newlines when multiline is true', async () => {
      const node = new TextBlockNode('test-25', 'Initial', { multiline: true });

      node.startEdit();
      node.updateEditBuffer('Line one\nLine two\nLine three');
      await node.commitEdit();

      expect(node.getCurrentValue()).toBe('Line one\nLine two\nLine three');
    });
  });
});

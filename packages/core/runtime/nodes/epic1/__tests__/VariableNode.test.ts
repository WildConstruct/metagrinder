/**
 * Comprehensive tests for VariableNode
 */

import { VariableNode, VariableMode, VariableType } from '../VariableNode';
import { Epic1NodeType } from '../index';

describe('VariableNode', () => {
  describe('Basic functionality', () => {
    it('should create with default configuration', () => {
      const node = new VariableNode('test-1', {
        name: 'myVar',
        defaultValue: 'default'
      });

      expect(node.getNodeType()).toBe(Epic1NodeType.Variable);
      expect(node.getCurrentValue()).toEqual({
        name: 'myVar',
        defaultValue: 'default'
      });

      const config = node.getData().configuration;
      expect(config?.mode).toBe('both');
      expect(config?.variableType).toBe('string');
      expect(config?.scope).toBe('local');
    });

    it('should create with custom configuration', () => {
      const node = new VariableNode(
        'test-2',
        { name: 'counter', defaultValue: 0 },
        {
          mode: 'set',
          variableType: 'number',
          scope: 'global',
          description: 'A counter variable'
        }
      );

      const config = node.getData().configuration;
      expect(config?.mode).toBe('set');
      expect(config?.variableType).toBe('number');
      expect(config?.scope).toBe('global');
      expect(config?.description).toBe('A counter variable');
    });
  });

  describe('Variable name management', () => {
    it('should update variable name', () => {
      const node = new VariableNode('test-3', { name: 'oldName' });

      node.setVariableName('newName');
      expect(node.getCurrentValue().name).toBe('newName');
    });

    it('should validate variable names', () => {
      const node = new VariableNode('test-4', { name: 'valid' });

      // Valid names
      const validNames = [
        'simple',
        'withNumbers123',
        'with_underscores',
        '_startingUnderscore',
        'camelCase',
        'UPPERCASE',
        'a', // Single character
        'a'.repeat(64) // Max length
      ];

      validNames.forEach(name => {
        node.setVariableName(name);
        expect(node.getCurrentValue().name).toBe(name);
      });

      // Invalid names should throw
      const invalidNames = [
        '123start', // Starts with number
        'with-dash',
        'with space',
        'with.dot',
        'a'.repeat(65), // Too long
        '' // Empty
      ];

      invalidNames.forEach(name => {
        expect(() => node.setVariableName(name)).toThrow();
      });
    });

    it('should reject reserved names', () => {
      const node = new VariableNode('test-5', { name: 'valid' });

      const reserved = [
        '__proto__',
        'constructor',
        'prototype',
        'hasOwnProperty'
      ];

      reserved.forEach(name => {
        expect(() => node.setVariableName(name)).toThrow(
          `Variable name "${name}" is reserved`
        );
      });
    });
  });

  describe('Default value management', () => {
    it('should update default value', () => {
      const node = new VariableNode('test-6', {
        name: 'var',
        defaultValue: 'initial'
      });

      node.setDefaultValue('updated');
      expect(node.getCurrentValue().defaultValue).toBe('updated');
    });

    it('should handle different value types', () => {
      const node = new VariableNode('test-7', { name: 'var' });

      // String
      node.setDefaultValue('text');
      expect(node.getCurrentValue().defaultValue).toBe('text');

      // Number
      node.setDefaultValue(42);
      expect(node.getCurrentValue().defaultValue).toBe(42);

      // Boolean
      node.setDefaultValue(true);
      expect(node.getCurrentValue().defaultValue).toBe(true);

      // Array
      node.setDefaultValue([1, 2, 3]);
      expect(node.getCurrentValue().defaultValue).toEqual([1, 2, 3]);

      // Object
      node.setDefaultValue({ key: 'value' });
      expect(node.getCurrentValue().defaultValue).toEqual({ key: 'value' });

      // Null/undefined
      node.setDefaultValue(null);
      expect(node.getCurrentValue().defaultValue).toBe(null);

      node.setDefaultValue(undefined);
      expect(node.getCurrentValue().defaultValue).toBe(undefined);
    });
  });

  describe('Mode configuration', () => {
    it('should update mode', () => {
      const node = new VariableNode('test-8', { name: 'var' });

      node.setMode('set');
      expect(node.getData().configuration?.mode).toBe('set');

      node.setMode('get');
      expect(node.getData().configuration?.mode).toBe('get');

      node.setMode('both');
      expect(node.getData().configuration?.mode).toBe('both');
    });
  });

  describe('Type configuration', () => {
    it('should update variable type', () => {
      const node = new VariableNode('test-9', { name: 'var' });

      const types: VariableType[] = [
        'string',
        'number',
        'boolean',
        'array',
        'object',
        'any'
      ];

      types.forEach(type => {
        node.setVariableType(type);
        expect(node.getData().configuration?.variableType).toBe(type);
      });
    });
  });

  describe('Validation', () => {
    it('should validate type consistency', async () => {
      const node = new VariableNode(
        'test-10',
        { name: 'numberVar', defaultValue: 'not a number' },
        { variableType: 'number' }
      );

      const isValid = await node.validate();
      expect(isValid).toBe(false);

      const errors = node.getValidationErrors();
      expect(errors).toContain(
        'Default value type (string) does not match variable type (number)'
      );
    });

    it('should validate array type', async () => {
      const node = new VariableNode(
        'test-11',
        { name: 'arrayVar', defaultValue: [1, 2, 3] },
        { variableType: 'array' }
      );

      const isValid = await node.validate();
      expect(isValid).toBe(true);

      // Invalid array
      node.setDefaultValue('not an array');
      const isValid2 = await node.validate();
      expect(isValid2).toBe(false);
    });

    it('should validate object type', async () => {
      const node = new VariableNode(
        'test-12',
        { name: 'objVar', defaultValue: { key: 'value' } },
        { variableType: 'object' }
      );

      const isValid = await node.validate();
      expect(isValid).toBe(true);

      // Arrays should not be valid as objects
      node.setDefaultValue([1, 2, 3]);
      const isValid2 = await node.validate();
      expect(isValid2).toBe(false);
    });

    it('should allow any type', async () => {
      const node = new VariableNode(
        'test-13',
        { name: 'anyVar', defaultValue: 'anything' },
        { variableType: 'any' }
      );

      // All types should be valid
      const values = ['string', 123, true, [1, 2], { a: 1 }, null, undefined];

      for (const value of values) {
        node.setDefaultValue(value);
        const isValid = await node.validate();
        expect(isValid).toBe(true);
      }
    });

    it('should validate variable name format', async () => {
      const node = new VariableNode('test-14', { name: 'invalid-name' });

      const isValid = await node.validate();
      expect(isValid).toBe(false);

      const errors = node.getValidationErrors();
      expect(errors).toContain('Invalid variable name format: invalid-name');
    });
  });

  describe('Inline editing', () => {
    it('should handle edit workflow', async () => {
      const node = new VariableNode('test-15', {
        name: 'original',
        defaultValue: 'value'
      });

      node.startEdit();
      node.updateEditBuffer({
        name: 'updated',
        defaultValue: 'new value'
      });

      expect(node.isDirty()).toBe(true);

      await node.commitEdit();

      expect(node.getCurrentValue()).toEqual({
        name: 'updated',
        defaultValue: 'new value'
      });
    });

    it('should validate during commit', async () => {
      const node = new VariableNode(
        'test-16',
        { name: 'var' },
        { variableType: 'number' }
      );

      node.startEdit();
      node.updateEditBuffer({
        name: 'var',
        defaultValue: 'not a number'
      });

      await expect(node.commitEdit()).rejects.toThrow('Validation failed');
    });
  });

  describe('Serialization', () => {
    it('should serialize and restore correctly', () => {
      const node = new VariableNode(
        'test-17',
        { name: 'testVar', defaultValue: [1, 2, 3] },
        {
          mode: 'get',
          variableType: 'array',
          scope: 'global',
          description: 'Test array variable'
        }
      );

      const serialized = node.serialize();
      const restored = new VariableNode('test-17', { name: 'dummy' });
      restored.setData(serialized.data);

      expect(restored.getCurrentValue()).toEqual({
        name: 'testVar',
        defaultValue: [1, 2, 3]
      });

      const config = restored.getData().configuration;
      expect(config?.mode).toBe('get');
      expect(config?.variableType).toBe('array');
      expect(config?.scope).toBe('global');
      expect(config?.description).toBe('Test array variable');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long variable names', () => {
      const node = new VariableNode('test-18', { name: 'short' });

      const maxName = 'a'.repeat(64);
      node.setVariableName(maxName);
      expect(node.getCurrentValue().name).toBe(maxName);

      const tooLong = 'a'.repeat(65);
      expect(() => node.setVariableName(tooLong)).toThrow();
    });

    it('should handle complex default values', () => {
      const node = new VariableNode('test-19', { name: 'complex' });

      const complexValue = {
        nested: {
          array: [1, 2, { deep: true }],
          string: 'value'
        },
        list: ['a', 'b', 'c']
      };

      node.setDefaultValue(complexValue);
      expect(node.getCurrentValue().defaultValue).toEqual(complexValue);
    });

    it('should handle circular references gracefully', () => {
      const node = new VariableNode('test-20', { name: 'circular' });

      const obj: any = { a: 1 };
      obj.self = obj; // Create circular reference

      // Should handle without crashing
      expect(() => node.setDefaultValue(obj)).not.toThrow();
    });

    it('should handle undefined vs null correctly', () => {
      const node = new VariableNode('test-21', { name: 'nullable' });

      // Undefined means "no default value"
      node.setDefaultValue(undefined);
      expect(node.getCurrentValue().defaultValue).toBe(undefined);
      expect(node.getCurrentValue().hasOwnProperty('defaultValue')).toBe(true);

      // Null is an explicit value
      node.setDefaultValue(null);
      expect(node.getCurrentValue().defaultValue).toBe(null);
    });
  });

  describe('Scope behavior', () => {
    it('should track scope setting', () => {
      const node = new VariableNode(
        'test-22',
        { name: 'var' },
        { scope: 'global' }
      );

      expect(node.getData().configuration?.scope).toBe('global');

      // Change to local
      node.setData({
        ...node.getData(),
        configuration: { ...node.getData().configuration, scope: 'local' }
      });

      expect(node.getData().configuration?.scope).toBe('local');
    });
  });
});

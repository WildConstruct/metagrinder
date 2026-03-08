/**
 * Integration tests for Epic 1 nodes
 * Tests complete workflows and interactions between components
 */

import {
  TextBlockNode,
  WeightedChoiceNode,
  ConcatNode,
  VariableNode,
  OutputNode,
  Epic1ExecutionEngine,
  GraphBuilder,
  validateGraph,
  createGraphFromPSG,
  generatePreview,
  executeWithSeeds
} from '../index';

describe('Epic 1 Integration Tests', () => {
  describe('Complete workflow tests', () => {
    it('should execute a simple greeting workflow', async () => {
      const builder = new GraphBuilder();

      // Build graph: Variable -> TextBlock -> Output
      const nameVar = new VariableNode(
        'nameVar',
        { name: 'userName', defaultValue: 'World' },
        { mode: 'set' }
      );

      const greeting = new TextBlockNode('greeting', 'Hello, {{userName}}!');
      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(nameVar)
        .addNode(greeting)
        .addNode(output)
        .connect('greeting', 'output')
        .build();

      // Validate
      const validation = await validateGraph(graph.nodes, graph.edges);
      expect(validation.valid).toBe(true);

      // Execute
      const engine = new Epic1ExecutionEngine(graph, 'test-seed');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('should execute weighted choice with concatenation', async () => {
      const builder = new GraphBuilder();

      // Create nodes
      const greeting = new WeightedChoiceNode('greeting', [
        { id: '1', text: 'Hi', weight: 40 },
        { id: '2', text: 'Hello', weight: 30 },
        { id: '3', text: 'Hey', weight: 30 }
      ]);

      const name = new TextBlockNode('name', 'friend');

      const punctuation = new WeightedChoiceNode('punctuation', [
        { id: '1', text: '!', weight: 70 },
        { id: '2', text: '.', weight: 30 }
      ]);

      const concat = new ConcatNode('concat', { separator: ' ' });
      const output = new OutputNode('output');
      output.lock();

      // Build graph
      const graph = builder
        .addNode(greeting)
        .addNode(name)
        .addNode(punctuation)
        .addNode(concat)
        .addNode(output)
        .connect('greeting', 'concat')
        .connect('name', 'concat')
        .connect('punctuation', 'concat')
        .connect('concat', 'output')
        .build();

      // Execute with fixed seed for deterministic result
      const engine = new Epic1ExecutionEngine(graph, 'integration-test-1');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/^(Hi|Hello|Hey) friend [!.]$/);

      // Verify determinism
      const engine2 = new Epic1ExecutionEngine(graph, 'integration-test-1');
      const result2 = await engine2.execute();
      expect(result2.output).toBe(result.output);
    });

    it('should handle complex variable workflow', async () => {
      const builder = new GraphBuilder();

      // Set multiple variables
      const firstName = new VariableNode(
        'firstName',
        { name: 'firstName', defaultValue: 'John' },
        { mode: 'set' }
      );

      const lastName = new VariableNode(
        'lastName',
        { name: 'lastName', defaultValue: 'Doe' },
        { mode: 'set' }
      );

      const age = new VariableNode(
        'age',
        { name: 'age', defaultValue: 25 },
        { mode: 'set', variableType: 'number' }
      );

      // Use variables in template
      const template = new TextBlockNode(
        'template',
        '{{firstName}} {{lastName}} is {{age}} years old.'
      );

      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(firstName)
        .addNode(lastName)
        .addNode(age)
        .addNode(template)
        .addNode(output)
        .connect('template', 'output')
        .build();

      const engine = new Epic1ExecutionEngine(graph, 'var-test');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toBe('John Doe is 25 years old.');

      // Check context variables
      const context = engine.getContext();
      expect(context.getVariable('firstName')).toBe('John');
      expect(context.getVariable('lastName')).toBe('Doe');
      expect(context.getVariable('age')).toBe(25);
    });

    it('should handle variable get/set patterns', async () => {
      const builder = new GraphBuilder();

      // Set a variable
      const setter = new VariableNode(
        'setter',
        { name: 'counter', defaultValue: 0 },
        { mode: 'set', variableType: 'number' }
      );

      // Get the variable
      const getter1 = new VariableNode(
        'getter1',
        { name: 'counter' },
        { mode: 'get' }
      );

      const getter2 = new VariableNode(
        'getter2',
        { name: 'counter' },
        { mode: 'get' }
      );

      // Use in templates
      const template1 = new TextBlockNode(
        'template1',
        'First access: {{counter}}'
      );
      const template2 = new TextBlockNode(
        'template2',
        'Second access: {{counter}}'
      );

      const concat = new ConcatNode('concat', { separator: '\n' });
      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(setter)
        .addNode(getter1)
        .addNode(getter2)
        .addNode(template1)
        .addNode(template2)
        .addNode(concat)
        .addNode(output)
        .connect('template1', 'concat')
        .connect('template2', 'concat')
        .connect('concat', 'output')
        .build();

      const engine = new Epic1ExecutionEngine(graph, 'getset-test');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toBe('First access: 0\nSecond access: 0');
    });
  });

  describe('Edit and execute workflow', () => {
    it('should handle node editing before execution', async () => {
      const builder = new GraphBuilder();

      // Create nodes
      const text = new TextBlockNode('text', 'Initial text');
      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(text)
        .addNode(output)
        .connect('text', 'output')
        .build();

      // Edit the text node
      text.startEdit();
      text.updateEditBuffer('Edited text');
      await text.commitEdit();

      // Execute
      const engine = new Epic1ExecutionEngine(graph, 'edit-test');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toBe('Edited text');
    });

    it('should validate after editing', async () => {
      const weighted = new WeightedChoiceNode('weighted', [
        { id: '1', text: 'Valid', weight: 100 }
      ]);

      // Edit to invalid state
      weighted.startEdit();
      weighted.updateEditBuffer([
        { id: '1', text: 'A', weight: 0 },
        { id: '2', text: 'B', weight: 0 }
      ]);

      // Should fail validation
      await expect(weighted.commitEdit()).rejects.toThrow('Validation failed');

      // Fix and retry
      weighted.updateEditBuffer([
        { id: '1', text: 'A', weight: 60 },
        { id: '2', text: 'B', weight: 40 }
      ]);

      await weighted.commitEdit();
      expect(weighted.getCurrentValue()).toHaveLength(2);
    });
  });

  describe('PSG format integration', () => {
    it('should load and execute PSG format', async () => {
      const psgData = {
        version: '2.0.0',
        metadata: {
          name: 'Test Graph',
          description: 'Integration test'
        },
        nodes: [
          {
            id: 'var1',
            type: 'Variable',
            data: {
              value: { name: 'greeting', defaultValue: 'Hello' },
              configuration: { mode: 'set' },
              editState: { isEditing: false }
            }
          },
          {
            id: 'text1',
            type: 'TextBlock',
            data: {
              value: '{{greeting}}, World!',
              editState: { isEditing: false }
            }
          },
          {
            id: 'output1',
            type: 'Output',
            data: {
              value: '',
              isLocked: true,
              editState: { isEditing: false }
            }
          }
        ],
        edges: [{ id: 'e1', source: 'text1', target: 'output1' }]
      };

      const graph = createGraphFromPSG(psgData);

      expect(graph.nodes.size).toBe(3);
      expect(graph.edges.length).toBe(1);

      const engine = new Epic1ExecutionEngine(graph, 'psg-test');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('should preserve node configurations from PSG', async () => {
      const psgData = {
        version: '2.0.0',
        nodes: [
          {
            id: 'weighted1',
            type: 'WeightedChoice',
            data: {
              value: [
                { id: 'opt1', text: 'Red', weight: 30, color: '#FF0000' },
                { id: 'opt2', text: 'Blue', weight: 70, color: '#0000FF' }
              ],
              configuration: {
                minOptions: 2,
                maxOptions: 5
              },
              editState: { isEditing: false }
            }
          }
        ],
        edges: []
      };

      const graph = createGraphFromPSG(psgData);
      const node = graph.nodes.get('weighted1') as WeightedChoiceNode;

      expect(node).toBeDefined();
      expect(node.getCurrentValue()).toHaveLength(2);
      expect(node.getCurrentValue()[0].color).toBe('#FF0000');
      expect(node.getData().configuration?.minOptions).toBe(2);
    });
  });

  describe('Multi-seed execution', () => {
    it('should generate different outputs with different seeds', async () => {
      const builder = new GraphBuilder();

      const choices = new WeightedChoiceNode('choices', [
        { id: '1', text: 'Option A', weight: 33 },
        { id: '2', text: 'Option B', weight: 33 },
        { id: '3', text: 'Option C', weight: 34 }
      ]);

      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(choices)
        .addNode(output)
        .connect('choices', 'output')
        .build();

      const results = await executeWithSeeds(graph, [
        'seed1',
        'seed2',
        'seed3',
        'seed4',
        'seed5'
      ]);

      const outputs = Array.from(results.values()).map(r => r.output);
      const uniqueOutputs = new Set(outputs);

      // Should have some variety
      expect(uniqueOutputs.size).toBeGreaterThan(1);

      // Each result should be one of the options
      outputs.forEach(output => {
        expect(['Option A', 'Option B', 'Option C']).toContain(output);
      });
    });

    it('should generate preview with statistics', async () => {
      const builder = new GraphBuilder();

      const template = new TextBlockNode('template', 'Test {{number}}');
      const number = new VariableNode(
        'number',
        { name: 'number', defaultValue: 42 },
        { mode: 'set' }
      );

      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(template)
        .addNode(number)
        .addNode(output)
        .connect('template', 'output')
        .build();

      const preview = await generatePreview(graph, 3, 'preview-base');

      expect(preview.seeds).toHaveLength(3);
      expect(preview.outputs).toHaveLength(3);
      expect(preview.outputs[0]).toBe('Test 42');
      expect(preview.stats.success).toBe(true);
      expect(preview.stats.min).toBeGreaterThan(0);
      expect(preview.stats.max).toBeGreaterThanOrEqual(preview.stats.min);
      expect(preview.stats.avg).toBeGreaterThan(0);
    });
  });

  describe('Error handling integration', () => {
    it('should handle missing variables gracefully', async () => {
      const builder = new GraphBuilder();

      // Template references undefined variable
      const template = new TextBlockNode('template', 'Hello {{undefinedVar}}!');
      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(template)
        .addNode(output)
        .connect('template', 'output')
        .build();

      const engine = new Epic1ExecutionEngine(graph, 'error-test');
      const result = await engine.execute();

      // Should succeed but with warning
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello {{undefinedVar}}!'); // Keeps original
      expect(
        result.stats.warnings.some(w => w.message.includes('Unknown variable'))
      ).toBe(true);
    });

    it('should handle partial execution on errors', async () => {
      const builder = new GraphBuilder();

      const text1 = new TextBlockNode('text1', 'Success 1');
      const text2 = new TextBlockNode('text2', 'Success 2');

      // This will cause an error - variable with invalid name
      const badVar = new VariableNode('badVar', { name: 'invalid-name!' });

      const concat = new ConcatNode('concat', { separator: ', ' });
      const output = new OutputNode('output');
      output.lock();

      const graph = builder
        .addNode(text1)
        .addNode(text2)
        .addNode(badVar)
        .addNode(concat)
        .addNode(output)
        .connect('text1', 'concat')
        .connect('text2', 'concat')
        .connect('badVar', 'concat')
        .connect('concat', 'output')
        .build();

      // Should fail validation
      const validation = await validateGraph(graph.nodes, graph.edges);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Performance tests', () => {
    it('should handle large graphs efficiently', async () => {
      const builder = new GraphBuilder();

      // Create a graph with many nodes
      const nodeCount = 50;
      const nodes: TextBlockNode[] = [];

      for (let i = 0; i < nodeCount; i++) {
        const node = new TextBlockNode(`text${i}`, `Node ${i}`);
        nodes.push(node);
        builder.addNode(node);
      }

      const concat = new ConcatNode('concat', { separator: ' | ' });
      const output = new OutputNode('output');
      output.lock();

      builder.addNode(concat).addNode(output);

      // Connect all text nodes to concat
      nodes.forEach(node => {
        builder.connect(node.serialize().id, 'concat');
      });

      builder.connect('concat', 'output');

      const graph = builder.build();

      const startTime = Date.now();
      const engine = new Epic1ExecutionEngine(graph, 'perf-test');
      const result = await engine.execute();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.output).toContain('Node 0');
      expect(result.output).toContain('Node 49');
      expect(result.stats.nodesExecuted).toBe(nodeCount + 2); // +concat +output

      // Should complete reasonably fast
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle deep nesting efficiently', async () => {
      const builder = new GraphBuilder();

      // Create a chain of concatenations
      let lastId = 'start';
      const start = new TextBlockNode(lastId, 'Start');
      builder.addNode(start);

      for (let i = 0; i < 20; i++) {
        const text = new TextBlockNode(`text${i}`, ` -> ${i}`);
        const concat = new ConcatNode(`concat${i}`, { separator: '' });

        builder.addNode(text).addNode(concat);
        builder.connect(lastId, concat.serialize().id);
        builder.connect(text.serialize().id, concat.serialize().id);

        lastId = concat.serialize().id;
      }

      const output = new OutputNode('output');
      output.lock();
      builder.addNode(output);
      builder.connect(lastId, 'output');

      const graph = builder.build();

      const engine = new Epic1ExecutionEngine(graph, 'deep-test');
      const result = await engine.execute();

      expect(result.success).toBe(true);
      expect(result.output).toMatch(/^Start( -> \d+)+$/);
    });
  });
});

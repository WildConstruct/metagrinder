/**
 * Determinism tests for Epic 1 execution engine
 * Ensures reproducible outputs with the same seed
 */

import {
  TextBlockNode,
  WeightedChoiceNode,
  ConcatNode,
  VariableNode,
  OutputNode,
  GraphBuilder,
  Epic1ExecutionEngine,
  executeWithSeeds,
  compareExecutionResults,
  validateDeterminism,
  createExampleGraph
} from '../index';

describe('Epic1 Execution Engine - Determinism', () => {
  it('should produce identical results with the same seed', async () => {
    const graph = createExampleGraph();
    const seed = 'test-seed-123';

    // Execute multiple times with same seed
    const result = await validateDeterminism(graph, seed, 10);

    expect(result.isDeterministic).toBe(true);
    expect(result.variations.length).toBe(1);
  });

  it('should produce different results with different seeds', async () => {
    const graph = createExampleGraph();

    // Execute with different seeds
    const results = await executeWithSeeds(graph, ['seed1', 'seed2', 'seed3']);

    const outputs = Array.from(results.values()).map(r => r.output);
    const uniqueOutputs = new Set(outputs);

    // Should have some variation (not all identical)
    expect(uniqueOutputs.size).toBeGreaterThan(1);
  });

  it('should handle weighted choices deterministically', async () => {
    const builder = new GraphBuilder();

    const weighted = new WeightedChoiceNode('weighted', [
      { id: 'a', text: 'Option A', weight: 50 },
      { id: 'b', text: 'Option B', weight: 30 },
      { id: 'c', text: 'Option C', weight: 20 }
    ]);

    const output = new OutputNode('output');
    output.lock();

    const graph = builder
      .addNode(weighted)
      .addNode(output)
      .connect('weighted', 'output')
      .build();

    // Execute multiple times with same seed
    const seed = 'weighted-test';
    const results: string[] = [];

    for (let i = 0; i < 20; i++) {
      const engine = new Epic1ExecutionEngine(graph, seed);
      const result = await engine.execute();
      results.push(result.output);
    }

    // All results should be identical
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(1);
  });

  it('should handle variable substitution deterministically', async () => {
    const builder = new GraphBuilder();

    const setName = new VariableNode(
      'setName',
      { name: 'userName', defaultValue: 'Alice' },
      { mode: 'set' }
    );

    const greeting = new TextBlockNode(
      'greeting',
      'Hello {{userName}}, welcome!'
    );
    const output = new OutputNode('output');
    output.lock();

    const graph = builder
      .addNode(setName)
      .addNode(greeting)
      .addNode(output)
      .connect('greeting', 'output')
      .build();

    const engine = new Epic1ExecutionEngine(graph, 'var-test');
    const result = await engine.execute();

    expect(result.success).toBe(true);
    expect(result.output).toBe('Hello Alice, welcome!');
  });

  it('should maintain separate node seeds', async () => {
    const builder = new GraphBuilder();

    // Create two weighted choice nodes
    const choice1 = new WeightedChoiceNode('choice1', [
      { id: 'a', text: 'A1', weight: 50 },
      { id: 'b', text: 'B1', weight: 50 }
    ]);

    const choice2 = new WeightedChoiceNode('choice2', [
      { id: 'a', text: 'A2', weight: 50 },
      { id: 'b', text: 'B2', weight: 50 }
    ]);

    const concat = new ConcatNode('concat', { separator: '-' });
    const output = new OutputNode('output');
    output.lock();

    const graph = builder
      .addNode(choice1)
      .addNode(choice2)
      .addNode(concat)
      .addNode(output)
      .connect('choice1', 'concat', undefined, 'input0')
      .connect('choice2', 'concat', undefined, 'input1')
      .connect('concat', 'output')
      .build();

    // Execute multiple times and check distribution
    const results = new Map<string, number>();
    const seed = 'node-seed-test';

    for (let i = 0; i < 100; i++) {
      const engine = new Epic1ExecutionEngine(graph, `${seed}-${i}`);
      const result = await engine.execute();

      const output = result.output as string;
      results.set(output, (results.get(output) || 0) + 1);
    }

    // Should see all 4 combinations (A1-A2, A1-B2, B1-A2, B1-B2)
    expect(results.size).toBe(4);
  });

  it('should handle complex graphs deterministically', async () => {
    const builder = new GraphBuilder();

    // Build a more complex graph
    const name = new VariableNode(
      'name',
      { name: 'name', defaultValue: 'User' },
      { mode: 'set' }
    );

    const timeOfDay = new WeightedChoiceNode('timeOfDay', [
      { id: 'morning', text: 'morning', weight: 33 },
      { id: 'afternoon', text: 'afternoon', weight: 33 },
      { id: 'evening', text: 'evening', weight: 34 }
    ]);

    const greeting = new WeightedChoiceNode('greeting', [
      { id: 'hello', text: 'Hello', weight: 40 },
      { id: 'hi', text: 'Hi', weight: 30 },
      { id: 'hey', text: 'Hey', weight: 30 }
    ]);

    const template = new TextBlockNode('template', '{{name}}, good');

    const concat1 = new ConcatNode('concat1', { separator: ' ' });
    const concat2 = new ConcatNode('concat2', { separator: ' ' });
    const concat3 = new ConcatNode('concat3', { separator: '!' });

    const output = new OutputNode('output');
    output.lock();

    const graph = builder
      .addNode(name)
      .addNode(timeOfDay)
      .addNode(greeting)
      .addNode(template)
      .addNode(concat1)
      .addNode(concat2)
      .addNode(concat3)
      .addNode(output)
      // Connect greeting and name for "Hi User"
      .connect('greeting', 'concat1', undefined, 'input0')
      .connect('template', 'concat1', undefined, 'input1')
      // Connect with time of day
      .connect('concat1', 'concat2', undefined, 'input0')
      .connect('timeOfDay', 'concat2', undefined, 'input1')
      // Add exclamation
      .connect('concat2', 'concat3', undefined, 'input0')
      .connect('concat3', 'output')
      .build();

    // Test determinism
    const result = await validateDeterminism(graph, 'complex-test', 20);

    expect(result.isDeterministic).toBe(true);
  });

  it('should compare execution results correctly', async () => {
    const graph = createExampleGraph();

    // Execute twice with same seed
    const engine1 = new Epic1ExecutionEngine(graph, 'compare-test');
    const result1 = await engine1.execute();

    const engine2 = new Epic1ExecutionEngine(graph, 'compare-test');
    const result2 = await engine2.execute();

    const comparison = compareExecutionResults(result1, result2);

    expect(comparison.identical).toBe(true);
    expect(comparison.differences).toHaveLength(0);
  });

  it('should handle empty graphs gracefully', async () => {
    const builder = new GraphBuilder();
    const output = new OutputNode('output');
    output.lock();

    const graph = builder.addNode(output).build();

    const engine = new Epic1ExecutionEngine(graph, 'empty-test');
    const result = await engine.execute();

    expect(result.success).toBe(false); // No input to output node
    expect(result.stats.errors.length).toBeGreaterThan(0);
  });

  it('should detect cycles and fail gracefully', async () => {
    const builder = new GraphBuilder();

    const node1 = new TextBlockNode('node1', 'Text 1');
    const node2 = new TextBlockNode('node2', 'Text 2');
    const node3 = new TextBlockNode('node3', 'Text 3');

    const graph = builder
      .addNode(node1)
      .addNode(node2)
      .addNode(node3)
      .connect('node1', 'node2')
      .connect('node2', 'node3')
      .connect('node3', 'node1') // Create cycle
      .build();

    const engine = new Epic1ExecutionEngine(graph, 'cycle-test');
    const result = await engine.execute();

    expect(result.success).toBe(false);
    expect(
      result.stats.errors.some(e => e.error.message.includes('validation'))
    ).toBe(true);
  });
});

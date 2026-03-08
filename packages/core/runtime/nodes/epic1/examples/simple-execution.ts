/**
 * Simple execution example for Epic 1 nodes
 * Demonstrates how to build and execute a graph programmatically
 */

import {
  TextBlockNode,
  WeightedChoiceNode,
  ConcatNode,
  VariableNode,
  OutputNode,
  GraphBuilder,
  Epic1ExecutionEngine,
  generatePreview,
  formatExecutionResult
} from '../index';

async function runExample() {
  console.log('Epic 1 Execution Engine - Simple Example\n');

  // Build a simple greeting generator graph
  const builder = new GraphBuilder();

  // Create nodes
  console.log('Creating nodes...');

  // Variable to store the user's name
  const nameVar = new VariableNode(
    'nameVar',
    { name: 'userName', defaultValue: 'Friend' },
    { mode: 'set', variableType: 'string' }
  );

  // Greeting variations
  const greeting = new WeightedChoiceNode('greeting', [
    { id: 'formal', text: 'Good day', weight: 20 },
    { id: 'casual', text: 'Hey there', weight: 50 },
    { id: 'friendly', text: 'Hello', weight: 30 }
  ]);

  // Name template
  const nameTemplate = new TextBlockNode('nameTemplate', '{{userName}}!');

  // Mood message
  const mood = new WeightedChoiceNode('mood', [
    { id: 'happy', text: "Hope you're having a wonderful day!", weight: 60 },
    { id: 'neutral', text: 'How are things going?', weight: 30 },
    { id: 'excited', text: 'Great to see you!', weight: 10 }
  ]);

  // Concatenate parts
  const concat1 = new ConcatNode('concat1', {
    separator: ' ',
    trimInputs: true
  });
  const concat2 = new ConcatNode('concat2', {
    separator: ' ',
    trimInputs: true
  });

  // Output
  const output = new OutputNode('output');
  output.lock('Output nodes should be read-only');

  // Build the graph
  console.log('Building graph...');
  const graph = builder
    .addNode(nameVar)
    .addNode(greeting)
    .addNode(nameTemplate)
    .addNode(mood)
    .addNode(concat1)
    .addNode(concat2)
    .addNode(output)
    // Connect greeting and name
    .connect('greeting', 'concat1', undefined, 'input0')
    .connect('nameTemplate', 'concat1', undefined, 'input1')
    // Connect with mood
    .connect('concat1', 'concat2', undefined, 'input0')
    .connect('mood', 'concat2', undefined, 'input1')
    // To output
    .connect('concat2', 'output')
    .build();

  console.log(
    `Graph contains ${graph.nodes.size} nodes and ${graph.edges.length} edges\n`
  );

  // Execute with a specific seed
  console.log('Executing with seed "example-123"...');
  const engine = new Epic1ExecutionEngine(graph, 'example-123');
  const result = await engine.execute();

  console.log(formatExecutionResult(result));
  console.log('');

  // Generate preview with multiple seeds
  console.log('Generating preview with 5 different seeds...\n');
  const preview = await generatePreview(graph, 5, 'preview');

  preview.outputs.forEach((output, index) => {
    console.log(`Seed ${preview.seeds[index]}: ${output}`);
  });

  console.log(`\nExecution stats:`);
  console.log(`- Average duration: ${preview.stats.avg.toFixed(2)}ms`);
  console.log(`- Min duration: ${preview.stats.min}ms`);
  console.log(`- Max duration: ${preview.stats.max}ms`);
  console.log(`- All successful: ${preview.stats.success}`);

  // Demonstrate variable usage
  console.log('\n--- Variable Example ---\n');

  // Change the name variable
  const customNameVar = new VariableNode(
    'customNameVar',
    { name: 'userName', defaultValue: 'Alice' },
    { mode: 'set' }
  );

  const customBuilder = new GraphBuilder();
  const customGreeting = new TextBlockNode(
    'customGreeting',
    'Welcome back, {{userName}}! Your last visit was {{lastVisit}}.'
  );

  const lastVisitVar = new VariableNode(
    'lastVisitVar',
    { name: 'lastVisit', defaultValue: 'yesterday' },
    { mode: 'set' }
  );

  const customOutput = new OutputNode('customOutput');
  customOutput.lock();

  const customGraph = customBuilder
    .addNode(customNameVar)
    .addNode(lastVisitVar)
    .addNode(customGreeting)
    .addNode(customOutput)
    .connect('customGreeting', 'customOutput')
    .build();

  const customEngine = new Epic1ExecutionEngine(customGraph, 'custom-seed');
  const customResult = await customEngine.execute();

  console.log('Custom greeting with variables:');
  console.log(customResult.output);

  // Show the variables that were set
  const variables = customEngine.getContext().getAllVariables();
  console.log('\nVariables in context:');
  Object.entries(variables).forEach(([name, value]) => {
    console.log(`  ${name}: ${value}`);
  });
}

// Run the example
runExample().catch(console.error);

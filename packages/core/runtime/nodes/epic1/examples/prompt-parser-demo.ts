/**
 * Demo of the Prompt Parser functionality
 * Shows how to parse prompts and generate nodes automatically
 */

import { promptParser } from '../PromptParser';
import { Epic1ExecutionEngine } from '../Epic1ExecutionEngine';
import { GraphBuilder } from '../executionUtils';

// Example prompts to demonstrate parsing capabilities
const examplePrompts = {
  medieval: `A weary merchant in tattered robes, carrying scrolls or books or potions`,

  fantasy: `The ancient wizard with a long grey beard, wearing robes of 
midnight blue or deep purple or forest green, holds a staff 
topped with a glowing crystal or orb or rune stone.`,

  scifi: `A cybernetic bounty hunter equipped with plasma rifle, neural implants, 
and tactical armor scans the neon-lit streets of Neo Tokyo or Hong Kong or Singapore.`,

  simple: `Hello {{userName}}, welcome to the magical realm!`,

  complex: `In the depths of the dungeon, you encounter a massive door made of 
iron, stone, or enchanted wood. The door is guarded by a skeleton warrior, 
zombie knight, or spectral guardian wielding a rusty sword or ancient spear.`
};

/**
 * Parse a prompt and display the results
 */
function demonstrateParser(name: string, prompt: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Example: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nOriginal prompt:`);
  console.log(`"${prompt}"`);

  // Parse the prompt
  const result = promptParser.parse(prompt);

  console.log(`\n📊 Parsing Results:`);
  console.log(`- Segments identified: ${result.segments.length}`);
  console.log(
    `- Nodes generated: ${result.nodes.length} (including output node)`
  );

  // Display segments
  console.log(`\n📝 Segments:`);
  result.segments.forEach((segment, i) => {
    console.log(`\n  [${i + 1}] "${segment.text}"`);
    console.log(`      Type: ${segment.suggestedNodeType}`);
    console.log(`      Confidence: ${(segment.confidence * 100).toFixed(0)}%`);
    console.log(`      Range: [${segment.startIndex}-${segment.endIndex}]`);
    if (segment.metadata?.reason) {
      console.log(`      Reason: ${segment.metadata.reason}`);
    }
    if (segment.metadata?.alternatives) {
      console.log(
        `      Alternatives: ${segment.metadata.alternatives.join(', ')}`
      );
    }
  });

  // Display generated nodes
  console.log(`\n🔧 Generated Nodes:`);
  result.nodes.forEach((genNode, i) => {
    const node = genNode.node;
    const serialized = node.serialize();
    console.log(`\n  [${i + 1}] ${serialized.id} (${node.getNodeType()})`);

    if (node.getNodeType() === 'TextBlock') {
      console.log(`      Text: "${node.getCurrentValue()}"`);
    } else if (node.getNodeType() === 'WeightedChoice') {
      const options = node.getCurrentValue();
      console.log(`      Options:`);
      options.forEach((opt: any) => {
        console.log(`        - "${opt.text}" (${opt.weight}%)`);
      });
    } else if (node.getNodeType() === 'Output') {
      const outputNode = node as any; // OutputNode
      console.log(
        `      Status: ${outputNode.isLocked ? outputNode.isLocked() : 'Unknown'}`
      );
    }

    console.log(`      Editing: ${node.isEditing()}`);
    if (genNode.position) {
      console.log(
        `      Position: (${genNode.position.x}, ${genNode.position.y})`
      );
    }
  });

  // Display mappings
  console.log(`\n🎨 Visual Mappings:`);
  result.mappings.forEach((mapping, i) => {
    const sourceText = prompt.slice(mapping.startIndex, mapping.endIndex);
    console.log(`  [${i + 1}] Node ${mapping.nodeId}:`);
    console.log(`      Maps to: "${sourceText}"`);
    console.log(`      Color: ${mapping.highlightColor}`);
  });
}

/**
 * Execute a parsed graph to show it works
 */
async function executeExample() {
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`Execution Example`);
  console.log(`${'='.repeat(60)}`);

  const prompt = `A brave knight in shining armor or leather armor, wielding a sword or spear or mace`;
  console.log(`\nParsing and executing: "${prompt}"`);

  // Parse the prompt
  const result = promptParser.parse(prompt);

  // Build a graph from the parsed nodes
  const builder = new GraphBuilder();

  // Add all nodes to the graph
  result.nodes.forEach(genNode => {
    builder.addNode(genNode.node);
  });

  // Connect nodes in sequence (simple linear flow)
  for (let i = 0; i < result.nodes.length - 1; i++) {
    const currentId = result.nodes[i].node.serialize().id;
    const nextId = result.nodes[i + 1].node.serialize().id;
    builder.connect(currentId, nextId);
  }

  const graph = builder.build();

  // Execute with multiple seeds
  console.log(`\n🎲 Execution Results (5 different seeds):`);

  for (let i = 1; i <= 5; i++) {
    const engine = new Epic1ExecutionEngine(graph, `seed-${i}`);
    const execResult = await engine.execute();

    if (execResult.success) {
      console.log(`  Seed ${i}: "${execResult.output}"`);
    } else {
      console.log(`  Seed ${i}: Execution failed`);
    }
  }
}

/**
 * Demonstrate boundary adjustment
 */
function demonstrateBoundaryAdjustment() {
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`Boundary Adjustment Example`);
  console.log(`${'='.repeat(60)}`);

  const prompt = `The old wizard, carrying books or scrolls`;
  console.log(`\nOriginal prompt: "${prompt}"`);

  let result = promptParser.parse(prompt);

  console.log(`\nOriginal segments:`);
  result.segments.forEach((seg, i) => {
    console.log(`  [${i}] "${seg.text}"`);
  });

  // Adjust the first segment to exclude the comma
  if (result.segments.length > 0) {
    const firstSegment = result.segments[0];
    const commaIndex = prompt.indexOf(',');

    if (commaIndex > firstSegment.startIndex) {
      console.log(`\nAdjusting first segment to end before comma...`);
      result = promptParser.adjustBoundary(
        result,
        0,
        firstSegment.startIndex,
        commaIndex
      );

      console.log(`\nAdjusted segments:`);
      result.segments.forEach((seg, i) => {
        console.log(`  [${i}] "${seg.text}"`);
      });
    }
  }
}

/**
 * Main demo function
 */
async function main() {
  console.log(`🧙 Prompt Parser Demo`);
  console.log(`${'='.repeat(60)}`);

  // Demonstrate parsing different types of prompts
  for (const [name, prompt] of Object.entries(examplePrompts)) {
    demonstrateParser(name, prompt);
  }

  // Show execution
  await executeExample();

  // Show boundary adjustment
  demonstrateBoundaryAdjustment();

  console.log(`\n\n✅ Demo complete!`);
}

// Run the demo
main().catch(console.error);

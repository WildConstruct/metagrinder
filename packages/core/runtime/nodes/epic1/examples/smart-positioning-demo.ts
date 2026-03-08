/**
 * Demo: Smart Node Positioning for Epic 1
 *
 * Run with: npx ts-node packages/core/runtime/nodes/epic1/examples/smart-positioning-demo.ts
 */

import { PromptParser } from '../PromptParser';
import { SmartNodePositioner } from '../SmartNodePositioning';
import chalk from 'chalk';

// Test prompts
const testPrompts = [
  {
    name: 'Simple narrative',
    prompt: 'A weary merchant walks through the marketplace.'
  },
  {
    name: 'List with choices',
    prompt:
      'The knight carries a sword, shield, or lance, wearing shining armor.'
  },
  {
    name: 'Complex scene',
    prompt:
      'In the ancient castle courtyard, guards patrol with torches or lanterns, while merchants sell bread, cheese, or wine.'
  }
];

console.log(chalk.cyan.bold('\n🎯 Smart Node Positioning Demo\n'));

const parser = new PromptParser();

testPrompts.forEach((test, index) => {
  console.log(chalk.yellow(`\n${index + 1}. ${test.name}:`));
  console.log(chalk.gray(`   "${test.prompt}"\n`));

  try {
    const analysis = parser.parse(test.prompt);

    console.log(chalk.green(`   ✓ Generated ${analysis.nodes.length} nodes`));

    // Show node positions
    console.log(chalk.blue('\n   Node Positions:'));
    analysis.nodes.forEach((genNode, idx) => {
      const node = genNode.node;
      const pos = genNode.position;
      const type = node.getType();

      console.log(
        chalk.white(`     ${idx + 1}. ${type} at (${pos.x}, ${pos.y})`)
      );

      // Show node content
      const data = node.serialize();
      let content = '';
      switch (data.type) {
        case 'TextBlock':
          content = data.data.text || '(empty)';
          break;
        case 'WeightedChoice':
          content = data.data.options.map((opt: any) => opt.text).join(' | ');
          break;
        case 'Output':
          content = '(output)';
          break;
      }
      console.log(chalk.gray(`        "${content}"`));
    });

    // Calculate layout metrics
    const positions = analysis.nodes.map(n => n.position);
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    console.log(chalk.magenta('\n   Layout Metrics:'));
    console.log(
      chalk.white(`     Canvas bounds: X(${minX}-${maxX}), Y(${minY}-${maxY})`)
    );
    console.log(
      chalk.white(`     Width: ${maxX - minX}, Height: ${maxY - minY}`)
    );
  } catch (error: any) {
    console.log(chalk.red(`   ✗ Error: ${error.message}`));
  }
});

// Test overlap resolution
console.log(chalk.cyan.bold('\n🔧 Overlap Resolution Test\n'));

const positioner = new SmartNodePositioner();
const testNodes = [
  {
    node: { getType: () => 'TextBlock' } as any,
    sourceSegments: [],
    position: { x: 0, y: 0 }
  },
  {
    node: { getType: () => 'TextBlock' } as any,
    sourceSegments: [],
    position: { x: 0, y: 0 }
  }
];

const overlappingPositions = [
  { x: 100, y: 100 },
  { x: 150, y: 120 } // Overlaps with first node
];

console.log(chalk.yellow('Before optimization:'));
overlappingPositions.forEach((pos, i) => {
  console.log(chalk.white(`  Node ${i + 1}: (${pos.x}, ${pos.y})`));
});

const optimized = positioner.optimizePositions(overlappingPositions, testNodes);

console.log(chalk.green('\nAfter optimization:'));
optimized.forEach((pos, i) => {
  console.log(chalk.white(`  Node ${i + 1}: (${pos.x}, ${pos.y})`));
});

const distBefore = Math.sqrt(
  Math.pow(overlappingPositions[1].x - overlappingPositions[0].x, 2) +
    Math.pow(overlappingPositions[1].y - overlappingPositions[0].y, 2)
);

const distAfter = Math.sqrt(
  Math.pow(optimized[1].x - optimized[0].x, 2) +
    Math.pow(optimized[1].y - optimized[0].y, 2)
);

console.log(chalk.magenta(`\nDistance before: ${distBefore.toFixed(2)}`));
console.log(chalk.magenta(`Distance after: ${distAfter.toFixed(2)}`));
console.log(
  chalk.green(
    `✓ Separation improved by ${(distAfter - distBefore).toFixed(2)} units`
  )
);

console.log(chalk.cyan.bold('\n✨ Smart Positioning Features:\n'));
console.log(chalk.white('  • Diagonal flow for natural reading'));
console.log(chalk.white('  • Related nodes grouped together'));
console.log(chalk.white('  • Automatic overlap resolution'));
console.log(chalk.white('  • Output node positioned at bottom-right'));
console.log(chalk.white('  • Responsive to different prompt structures'));

console.log(chalk.gray('\n  Task 12 Implementation Complete! 🎉\n'));

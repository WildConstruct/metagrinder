/**
 * Simple test runner for the prompt parser
 */

import { promptParser } from '../PromptParser';
import { Epic1NodeType } from '../index';

// Test cases
const tests = [
  {
    name: 'Simple sentence',
    prompt: 'A weary merchant',
    expectedSegments: 1,
    expectedNodeType: Epic1NodeType.TextBlock
  },
  {
    name: 'List with "or"',
    prompt: 'carrying scrolls or books or potions',
    expectedSegments: 1,
    expectedNodeType: Epic1NodeType.WeightedChoice,
    expectedAlternatives: 3
  },
  {
    name: 'Complex example',
    prompt:
      'A weary merchant in tattered robes, carrying scrolls or books or potions',
    minSegments: 2,
    hasWeightedChoice: true
  },
  {
    name: 'Empty prompt',
    prompt: '',
    expectedSegments: 0,
    expectedNodes: 1 // Just output node
  }
];

console.log('🧪 Running Prompt Parser Tests\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const result = promptParser.parse(test.prompt);
    let success = true;
    const errors: string[] = [];

    // Check segment count
    if (
      test.expectedSegments !== undefined &&
      result.segments.length !== test.expectedSegments
    ) {
      errors.push(
        `Expected ${test.expectedSegments} segments, got ${result.segments.length}`
      );
      success = false;
    }

    if (
      test.minSegments !== undefined &&
      result.segments.length < test.minSegments
    ) {
      errors.push(
        `Expected at least ${test.minSegments} segments, got ${result.segments.length}`
      );
      success = false;
    }

    // Check node type
    if (test.expectedNodeType !== undefined && result.segments.length > 0) {
      if (result.segments[0].suggestedNodeType !== test.expectedNodeType) {
        errors.push(
          `Expected node type ${test.expectedNodeType}, got ${result.segments[0].suggestedNodeType}`
        );
        success = false;
      }
    }

    // Check alternatives
    if (test.expectedAlternatives !== undefined && result.segments.length > 0) {
      const alternatives =
        result.segments[0].metadata?.alternatives?.length || 0;
      if (alternatives !== test.expectedAlternatives) {
        errors.push(
          `Expected ${test.expectedAlternatives} alternatives, got ${alternatives}`
        );
        success = false;
      }
    }

    // Check for weighted choice
    if (test.hasWeightedChoice !== undefined) {
      const hasWeighted = result.segments.some(
        s => s.suggestedNodeType === Epic1NodeType.WeightedChoice
      );
      if (hasWeighted !== test.hasWeightedChoice) {
        errors.push(
          `Expected hasWeightedChoice=${test.hasWeightedChoice}, got ${hasWeighted}`
        );
        success = false;
      }
    }

    // Check node count
    if (
      test.expectedNodes !== undefined &&
      result.nodes.length !== test.expectedNodes
    ) {
      errors.push(
        `Expected ${test.expectedNodes} nodes, got ${result.nodes.length}`
      );
      success = false;
    }

    if (success) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      errors.forEach(err => console.log(`   ${err}`));
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name}`);
    console.log(`   Error: ${error}`);
    failed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

// Run a demo
console.log('\n🎯 Demo Parse:');
const demoResult = promptParser.parse(
  'A knight with sword or spear, wearing plate armor or chainmail'
);
console.log(`Segments: ${demoResult.segments.length}`);
demoResult.segments.forEach((seg, i) => {
  console.log(`  [${i}] "${seg.text}" -> ${seg.suggestedNodeType}`);
  if (seg.metadata?.alternatives) {
    console.log(`      Alternatives: ${seg.metadata.alternatives.join(', ')}`);
  }
});

process.exit(failed > 0 ? 1 : 0);

/**
 * Terminal demo of visual range indicators
 * Shows how text-to-node mapping works with colored output
 */

import { promptParser } from '../PromptParser.js';
import type { PromptAnalysis, NodeMapping } from '../PromptParser.js';

// ANSI color codes for terminal
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Map highlight colors to terminal colors
const colorMap: Record<string, string> = {
  '#FFE6E6': COLORS.bgRed + COLORS.black, // Light red
  '#E6F3FF': COLORS.bgBlue + COLORS.black, // Light blue
  '#E6FFE6': COLORS.bgGreen + COLORS.black, // Light green
  '#FFFFE6': COLORS.bgYellow + COLORS.black, // Light yellow
  '#FFE6FF': COLORS.bgMagenta + COLORS.black, // Light pink
  '#E6FFFF': COLORS.bgCyan + COLORS.black, // Light cyan
  '#FFF0E6': COLORS.bgWhite + COLORS.black, // Light orange -> white
  '#F0E6FF': COLORS.bgMagenta + COLORS.black // Light purple -> magenta
};

/**
 * Display prompt analysis with colored terminal output
 */
function displayVisualRange(analysis: PromptAnalysis, title: string) {
  console.log(
    `\n${COLORS.bright}${COLORS.cyan}═══ ${title} ═══${COLORS.reset}`
  );
  console.log(
    `${COLORS.dim}Original text:${COLORS.reset} "${analysis.originalText}"\n`
  );

  // Build colored text output
  let coloredText = '';
  let lastEnd = 0;

  // Sort mappings by start index
  const sortedMappings = [...analysis.mappings].sort(
    (a, b) => a.startIndex - b.startIndex
  );

  sortedMappings.forEach(mapping => {
    // Add unmapped text
    if (mapping.startIndex > lastEnd) {
      coloredText += analysis.originalText.slice(lastEnd, mapping.startIndex);
    }

    // Add mapped text with color
    const color =
      colorMap[mapping.highlightColor || ''] || COLORS.bgWhite + COLORS.black;
    const text = analysis.originalText.slice(
      mapping.startIndex,
      mapping.endIndex
    );
    coloredText += `${color}${text}${COLORS.reset}`;

    lastEnd = mapping.endIndex;
  });

  // Add remaining text
  if (lastEnd < analysis.originalText.length) {
    coloredText += analysis.originalText.slice(lastEnd);
  }

  console.log(`${COLORS.bright}Highlighted Text:${COLORS.reset}`);
  console.log(coloredText);

  // Display node mapping legend
  console.log(`\n${COLORS.bright}Node Mappings:${COLORS.reset}`);
  analysis.nodes.forEach((genNode, index) => {
    const node = genNode.node;
    const nodeId = node.serialize().id;
    const mapping = analysis.mappings.find(m => m.nodeId === nodeId);

    if (mapping) {
      const color =
        colorMap[mapping.highlightColor || ''] || COLORS.bgWhite + COLORS.black;
      const mappedText = analysis.originalText.slice(
        mapping.startIndex,
        mapping.endIndex
      );

      console.log(
        `  ${color} ${COLORS.reset} ${COLORS.bright}${node.getNodeType()}${COLORS.reset} ` +
          `[${mapping.startIndex}-${mapping.endIndex}]: "${mappedText}"`
      );

      if (node.getNodeType() === 'WeightedChoice') {
        const options = node.getCurrentValue();
        options.forEach((opt: any) => {
          console.log(
            `      ${COLORS.dim}• ${opt.text} (${opt.weight}%)${COLORS.reset}`
          );
        });
      }
    }
  });

  console.log(
    `\n${COLORS.dim}Total segments: ${analysis.segments.length}, Total nodes: ${analysis.nodes.length}${COLORS.reset}`
  );
}

/**
 * Simulate hover interaction in terminal
 */
function simulateHover(analysis: PromptAnalysis, nodeIndex: number) {
  if (nodeIndex >= analysis.nodes.length) return;

  const node = analysis.nodes[nodeIndex].node;
  const nodeId = node.serialize().id;
  const mapping = analysis.mappings.find(m => m.nodeId === nodeId);

  if (!mapping) return;

  console.log(
    `\n${COLORS.bright}${COLORS.yellow}🔍 Hovering over ${node.getNodeType()} node...${COLORS.reset}`
  );

  // Show the connection
  const color =
    colorMap[mapping.highlightColor || ''] || COLORS.bgWhite + COLORS.black;
  const mappedText = analysis.originalText.slice(
    mapping.startIndex,
    mapping.endIndex
  );

  console.log(`${COLORS.dim}┌─ Source text${COLORS.reset}`);
  console.log(
    `│  ${color}${mappedText}${COLORS.reset} [${mapping.startIndex}-${mapping.endIndex}]`
  );
  console.log(
    `${COLORS.dim}└─ Maps to ───►${COLORS.reset} ${COLORS.bright}${node.getNodeType()}${COLORS.reset}`
  );

  if (node.getNodeType() === 'TextBlock') {
    console.log(`   Content: "${node.getCurrentValue()}"`);
  } else if (node.getNodeType() === 'WeightedChoice') {
    console.log(`   Options:`);
    node.getCurrentValue().forEach((opt: any) => {
      console.log(`   • ${opt.text} (${opt.weight}%)`);
    });
  }
}

/**
 * Main demo
 */
function runDemo() {
  console.log(
    `${COLORS.bright}${COLORS.green}Visual Range Indicator Terminal Demo${COLORS.reset}`
  );
  console.log(`${COLORS.dim}${'='.repeat(50)}${COLORS.reset}`);

  const examples = [
    {
      title: 'Medieval Character',
      prompt:
        'A weary merchant in tattered robes, carrying scrolls or books or potions'
    },
    {
      title: 'Fantasy Scene',
      prompt:
        'The ancient wizard with a long grey beard, wearing robes of midnight blue or deep purple or forest green.'
    },
    {
      title: 'Complex Dungeon',
      prompt:
        'In the depths of the dungeon, you encounter a massive door made of iron, stone, or enchanted wood.'
    }
  ];

  examples.forEach(example => {
    const analysis = promptParser.parse(example.prompt);
    displayVisualRange(analysis, example.title);

    // Simulate hovering over first two nodes
    if (analysis.nodes.length > 0) {
      simulateHover(analysis, 0);
    }
    if (analysis.nodes.length > 1) {
      simulateHover(analysis, 1);
    }
  });

  console.log(
    `\n${COLORS.bright}${COLORS.green}✨ Demo Complete!${COLORS.reset}`
  );
  console.log(`\n${COLORS.dim}Legend:${COLORS.reset}`);
  Object.entries(colorMap).forEach(([hex, termColor]) => {
    console.log(`  ${termColor} ${COLORS.reset} = ${hex}`);
  });
}

// Run the demo
runDemo();

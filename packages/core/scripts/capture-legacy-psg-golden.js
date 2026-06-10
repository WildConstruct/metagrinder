/**
 * One-off golden capture (S2.2). Drives the LEGACY pipeline to produce the
 * historical-crowd scene grammar, compiles base + branch PSGs with a fixed
 * clock, and writes them under src/compile/__golden__/ plus the legacy scene
 * grammar as JSON. The ported TS compiler must reproduce these bytes.
 *
 * Run once: node packages/core/scripts/capture-legacy-psg-golden.js
 * Lives in scripts/ (not src/) because it requires legacy code, which src/
 * must never do. Not part of the build; legacy is deleted at Phase 6.
 */
const fs = require('node:fs');
const path = require('node:path');

const lib = require('./lib/metagrinder-mvp.js');
const FIXED_NOW = () => '2026-05-02T12:00:00.000Z';
const FIXTURE = path.resolve(__dirname, '../tests/fixtures/metagrinder/research-input-historical-crowd-grammar.txt');
const OUT = path.resolve(__dirname, '../src/compile/__golden__');

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rawText = fs.readFileSync(FIXTURE, 'utf8');

  const ingestArtifact = lib.buildIngestArtifact({
    inputPath: 'research-input-historical-crowd-grammar.txt',
    rawText,
    inputId: 'research-input-historical-crowd-grammar',
    title: 'Early twentieth-century public spectacle crowd scene grammar notes',
    createdAt: '2026-05-02T12:00:00.000Z'
  });
  const extractArtifact = lib.buildExtractArtifact({ ingestArtifact });
  const classifyArtifact = lib.buildClassifyArtifact({ ingestArtifact, extractArtifact });
  const synthesizeArtifact = lib.buildSynthesizeArtifact({ ingestArtifact, extractArtifact });
  const sourceModeArtifact = lib.buildSourceModeArtifact({ ingestArtifact });
  const sceneGrammarArtifact = lib.buildSceneGrammarArtifact({
    ingestArtifact, extractArtifact, classifyArtifact, synthesizeArtifact, sourceModeArtifact
  });

  const sceneGrammarPsg = lib.buildSceneGrammarPsg({ sceneGrammarArtifact, now: FIXED_NOW });
  const branchGraphPsgs = lib.buildBranchSceneGrammarPsgs({ sceneGrammarArtifact, now: FIXED_NOW });

  const write = (name, obj) =>
    fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(obj, null, 2)}\n`, 'utf8');

  write('legacy-scene-grammar.json', sceneGrammarArtifact);
  write('scene-grammar.psg.json', sceneGrammarPsg);
  write('branch-graphs.json', branchGraphPsgs);

  console.log(`captured: ${sceneGrammarArtifact.archetypes.length} archetypes, ` +
    `${branchGraphPsgs.length} branch graphs, base psg ${sceneGrammarPsg.nodes.length} nodes -> ${OUT}`);
}

main();

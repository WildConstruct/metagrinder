const path = require('path');

const { runRainyAlleyPrototype } = require('./lib/rainy-alley-prototype.js');

const FIXTURE_DIR = path.resolve(__dirname, '../tests/fixtures/metagrinder');
const OUTPUT_BASE = path.resolve(__dirname, '../tests/output/metagrinder');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const close = runRainyAlleyPrototype({
    fixtureDir: FIXTURE_DIR,
    outputDir: path.join(OUTPUT_BASE, 'rainy-alley-close-assert'),
    cameraId: 'cam_alley_master',
    cameraPosition: { x: 1.6, y: 2.1, z: -2.2 }
  });

  const far = runRainyAlleyPrototype({
    fixtureDir: FIXTURE_DIR,
    outputDir: path.join(OUTPUT_BASE, 'rainy-alley-far-assert'),
    cameraId: 'cam_alley_master',
    cameraPosition: { x: 2, y: 2, z: 4.5 }
  });

  assert(close.renderTextPacket.semanticLod === 'lod2', 'Expected close shot to use lod2.');
  assert(far.renderTextPacket.semanticLod === 'lod0', 'Expected far shot to use lod0.');
  assert(
    close.renderTextPacket.hero_details.length > far.renderTextPacket.hero_details.length,
    'Expected close shot to retain more hero detail than far shot.'
  );
  assert(
    close.renderTextPacket.dominant_surfaces[0] !== far.renderTextPacket.dominant_surfaces[0],
    'Expected close and far shots to emit different dominant surface phrasing.'
  );
  assert(
    far.renderTextPacket.localized_effects.length > 0,
    'Expected far shot to preserve at least one localized effect through compaction policy.'
  );
  assert(
    far.renderTextPacket.hero_details.includes('hero semantic detail preserved under prompt-budget compaction'),
    'Expected far shot to preserve hero detail under compaction.'
  );

  console.log('Rainy alley shot-difference validation passed.');
}

main();

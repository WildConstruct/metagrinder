const path = require('path');

const { runRainyAlleyPrototype } = require('./lib/rainy-alley-prototype.js');

const FIXTURE_DIR = path.resolve(__dirname, '../tests/fixtures/metagrinder');
const OUTPUT_DIR = path.resolve(__dirname, '../tests/output/metagrinder/rainy-alley');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const result = runRainyAlleyPrototype({
    fixtureDir: FIXTURE_DIR,
    outputDir: OUTPUT_DIR
  });

  assert(result.rankedRecords.length > 0, 'Expected at least one ranked semantic record.');
  assert(
    result.renderTextPacket.dominant_surfaces.length > 0,
    'Expected at least one dominant surface in the render text packet.'
  );
  assert(
    result.renderTextPacket.localized_effects.length > 0,
    'Expected at least one localized effect in the render text packet.'
  );
  assert(
    result.renderTextPacket.environmental_conditions.length > 0,
    'Expected at least one environmental condition in the render text packet.'
  );
  assert(
    result.renderTextPacket.semanticLod,
    'Expected render text packet to include a semantic LoD tier.'
  );
  assert(
    result.lumaAdapterContract.prompt.includes('rain'),
    'Expected the Luma prompt to include rain-related context.'
  );
  assert(
    result.cameraPassManifest.outputArtifacts.includes('generated-camera-pass-manifest.json'),
    'Expected generated camera pass manifest to be referenced in output artifacts.'
  );

  console.log('Rainy alley prototype runtime validated successfully.');
}

main();

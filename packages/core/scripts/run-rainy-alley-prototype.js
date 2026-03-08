const path = require('path');

const { runRainyAlleyPrototype } = require('./lib/rainy-alley-prototype.js');

const FIXTURE_DIR = path.resolve(__dirname, '../tests/fixtures/metagrinder');
const OUTPUT_DIR = path.resolve(__dirname, '../tests/output/metagrinder/rainy-alley');

function main() {
  runRainyAlleyPrototype({
    fixtureDir: FIXTURE_DIR,
    outputDir: OUTPUT_DIR
  });

  console.log(`Generated rainy alley outputs in ${OUTPUT_DIR}`);
}

main();

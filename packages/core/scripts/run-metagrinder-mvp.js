const path = require('path');

const { runMetagrinderMvp } = require('./lib/metagrinder-mvp.js');

function main() {
  const args = process.argv.slice(2);
  const outputDirFlagIndex = args.indexOf('--output-dir');
  const titleFlagIndex = args.indexOf('--title');
  const inputPaths = args.filter((arg, index) => {
    if (arg.startsWith('--')) {
      return false;
    }
    if (outputDirFlagIndex >= 0 && (index === outputDirFlagIndex + 1)) {
      return false;
    }
    if (titleFlagIndex >= 0 && (index === titleFlagIndex + 1)) {
      return false;
    }
    return true;
  });
  const outputDirArg = outputDirFlagIndex >= 0 ? args[outputDirFlagIndex + 1] : undefined;
  const titleArg = titleFlagIndex >= 0 ? args[titleFlagIndex + 1] : undefined;

  if (inputPaths.length === 0) {
    throw new Error(
      'Usage: node scripts/run-metagrinder-mvp.js <input-a.txt> [input-b.txt ...] [--output-dir <dir>] [--title <title>]'
    );
  }

  const outputDir = outputDirArg || path.resolve(
    __dirname,
    '../tests/output/metagrinder/mvp'
  );

  const result = runMetagrinderMvp({
    inputPath: inputPaths[0],
    inputPaths,
    outputDir,
    title: titleArg
  });

  console.log(`Generated ingest artifact for ${result.ingestArtifact.inputId} in ${result.outputDir}`);
}

main();

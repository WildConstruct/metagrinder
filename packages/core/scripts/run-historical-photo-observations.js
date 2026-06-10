const fs = require('fs');
const path = require('path');

const {
  buildHistoricalPhotoResearchPackageArtifacts
} = require('../services/researchHistoricalPhoto/index.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const inputPath = args[0] || path.join(
    __dirname,
    '..',
    'tests',
    'fixtures',
    'metagrinder',
    'historical-photo-observations.json'
  );
  const outputDir = args[1] || path.join(
    process.cwd(),
    'tmp',
    'historical-photo-observations'
  );
  const photos = readJson(inputPath);
  const artifacts = buildHistoricalPhotoResearchPackageArtifacts({
    photos,
    inputId: 'historical_photo_observations',
    title: 'Historical Photo Observations'
  });

  writeJson(path.join(outputDir, 'ingest.json'), artifacts.ingestArtifact);
  writeJson(path.join(outputDir, 'photo-observations.json'), artifacts.photoObservationArtifact);
  writeJson(path.join(outputDir, 'color-hypotheses.json'), artifacts.colorHypothesisArtifact);
  writeJson(path.join(outputDir, 'research-gaps.json'), artifacts.researchGapArtifact);
  writeJson(path.join(outputDir, 'sample-prompts.json'), artifacts.samplePromptsArtifact);
  writeJson(path.join(outputDir, 'utdg-candidates.json'), artifacts.utdgCandidatesFile);
  writeJson(path.join(outputDir, 'research-package.json'), artifacts.researchPackageManifest);

  console.log(`Historical photo package written to ${outputDir}`);
  console.log(`photos=${artifacts.photoObservationArtifact.photos.length}`);
  console.log(`colorHypotheses=${artifacts.colorHypothesisArtifact.records.length}`);
  console.log(`utdgCandidates=${artifacts.utdgCandidatesFile.candidates.length}`);
}

if (require.main === module) {
  main();
}

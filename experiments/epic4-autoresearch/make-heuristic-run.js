const fs = require('fs');
const path = require('path');

const {
  buildResearchBriefReviewArtifacts
} = require('../../packages/core/scripts/lib/metagrinder-mvp.js');

const repoRoot = path.resolve(__dirname, '..', '..');
const judgments = JSON.parse(fs.readFileSync(path.join(__dirname, 'judgments.json'), 'utf8'));
const runDir = path.join(__dirname, 'runs', 'heuristic-baseline');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

ensureDir(runDir);

for (const brief of judgments.briefs) {
  const rawText = fs.readFileSync(path.join(repoRoot, brief.path), 'utf8');
  const briefDir = path.join(runDir, brief.id);
  ensureDir(briefDir);

  const result = buildResearchBriefReviewArtifacts({
    rawText,
    title: brief.id,
    inputPath: brief.path,
    inputId: brief.id,
    createdAt: '2026-03-09T12:00:00.000Z'
  });

  writeJson(path.join(briefDir, 'mode-detection.json'), result.modeDetectionArtifact);
  writeJson(path.join(briefDir, 'category-hypothesis.json'), result.categoryHypothesisArtifact);
  writeJson(path.join(briefDir, 'assumption-review.json'), result.assumptionReviewArtifact);
  writeJson(path.join(briefDir, 'augmentation-plan.json'), result.augmentationPlanArtifact);
}

console.log(path.relative(repoRoot, runDir));

const fs = require('fs');
const path = require('path');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'research-input';
}

function resolveInputPath(inputPath, baseDir = process.cwd()) {
  const candidateInputPaths = [
    path.resolve(inputPath),
    path.resolve(baseDir, inputPath)
  ];
  return candidateInputPaths.find((candidatePath) => fs.existsSync(candidatePath));
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runPipeline({
  inputPath,
  inputPaths,
  outputDir,
  title,
  resolveInputPath,
  readTextFile,
  ensureDir,
  writeJson,
  deriveTitle,
  deriveCombinedTitle,
  slugify,
  buildIngestArtifact,
  buildMultiInputIngestArtifact,
  buildResearchBriefReviewArtifacts,
  buildExtractArtifact,
  buildClassifyArtifact,
  buildSynthesizeArtifact,
  buildMutationArtifact,
  buildMutationReviewArtifact,
  buildScoreArtifact,
  buildReviewArtifact,
  buildSourceMapPsg,
  buildConceptClustersPsg,
  buildPromptSynthesisPsg,
  buildPromptMutationsPsg,
  buildResearchPackageManifest,
  validatePackageArtifacts,
  now = () => new Date().toISOString()
}) {
  const requestedInputPaths = inputPaths && inputPaths.length > 0
    ? inputPaths
    : [inputPath];
  const resolvedInputPaths = requestedInputPaths.map((candidate) => ({
    requested: candidate,
    resolved: resolveInputPath(candidate)
  }));
  const resolvedOutputDir = path.resolve(outputDir);

  const missing = resolvedInputPaths.find((entry) => !entry.resolved);
  if (missing) {
    throw new Error(`Missing input file: ${missing.requested}`);
  }

  const sourceFiles = resolvedInputPaths.map((entry, index) => {
    const rawText = readTextFile(entry.resolved);
    const sourceTitle = deriveTitle(rawText, entry.resolved);
    const sourceInputId = slugify(
      path.basename(entry.resolved, path.extname(entry.resolved))
    );

    return {
      path: entry.resolved,
      rawText,
      title: sourceTitle,
      sourceInputId,
      sequence: index
    };
  });
  const derivedTitle = title || deriveCombinedTitle(sourceFiles);
  const inputId = requestedInputPaths.length === 1
    ? sourceFiles[0].sourceInputId
    : `multi-${slugify(sourceFiles[0].sourceInputId)}`;
  const createdAt = now();

  const ingestArtifact = sourceFiles.length === 1
    ? buildIngestArtifact({
        inputPath: sourceFiles[0].path,
        rawText: sourceFiles[0].rawText,
        inputId,
        title: derivedTitle,
        createdAt
      })
    : buildMultiInputIngestArtifact({
        sourceFiles,
        inputId,
        title: derivedTitle,
        createdAt
      });
  const {
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    assumptionReviewArtifact,
    augmentationPlanArtifact
  } = buildResearchBriefReviewArtifacts({
    ingestArtifact
  });
  const extractArtifact = buildExtractArtifact({
    ingestArtifact
  });
  const classifyArtifact = buildClassifyArtifact({
    ingestArtifact,
    extractArtifact
  });
  const synthesizeArtifact = buildSynthesizeArtifact({
    ingestArtifact,
    extractArtifact
  });
  const mutationArtifact = buildMutationArtifact({
    synthesizeArtifact
  });
  const mutationReviewArtifact = buildMutationReviewArtifact({
    mutationArtifact
  });
  const scoreArtifact = buildScoreArtifact({
    ingestArtifact,
    extractArtifact,
    synthesizeArtifact
  });
  const reviewArtifact = buildReviewArtifact({
    ingestArtifact,
    extractArtifact,
    synthesizeArtifact,
    scoreArtifact
  });
  const sourceMapPsg = buildSourceMapPsg({
    ingestArtifact
  });
  const conceptClustersPsg = buildConceptClustersPsg({
    ingestArtifact,
    extractArtifact,
    classifyArtifact
  });
  const promptSynthesisPsg = buildPromptSynthesisPsg({
    ingestArtifact,
    synthesizeArtifact
  });
  const promptMutationsPsg = buildPromptMutationsPsg({
    ingestArtifact,
    mutationArtifact
  });
  const researchPackageManifest = buildResearchPackageManifest({
    ingestArtifact,
    scoreArtifact,
    mutationArtifact
  });

  validatePackageArtifacts({
    augmentationPlanArtifact,
    assumptionReviewArtifact,
    categoryHypothesisArtifact,
    modeDetectionArtifact,
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    mutationArtifact,
    mutationReviewArtifact,
    scoreArtifact,
    reviewArtifact,
    sourceMapPsg,
    conceptClustersPsg,
    promptSynthesisPsg,
    promptMutationsPsg,
    researchPackageManifest
  });

  ensureDir(resolvedOutputDir);
  writeJson(path.join(resolvedOutputDir, 'mode-detection.json'), modeDetectionArtifact);
  writeJson(path.join(resolvedOutputDir, 'category-hypothesis.json'), categoryHypothesisArtifact);
  writeJson(path.join(resolvedOutputDir, 'assumption-review.json'), assumptionReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'augmentation-plan.json'), augmentationPlanArtifact);
  writeJson(path.join(resolvedOutputDir, 'ingest.json'), ingestArtifact);
  writeJson(path.join(resolvedOutputDir, 'extract.json'), extractArtifact);
  writeJson(path.join(resolvedOutputDir, 'classify.json'), classifyArtifact);
  writeJson(path.join(resolvedOutputDir, 'synthesize.json'), synthesizeArtifact);
  writeJson(path.join(resolvedOutputDir, 'mutate.json'), mutationArtifact);
  writeJson(path.join(resolvedOutputDir, 'mutation-review.json'), mutationReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'score.json'), scoreArtifact);
  writeJson(path.join(resolvedOutputDir, 'review.json'), reviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-map.psg'), sourceMapPsg);
  writeJson(path.join(resolvedOutputDir, 'concept-clusters.psg'), conceptClustersPsg);
  writeJson(path.join(resolvedOutputDir, 'prompt-synthesis.psg'), promptSynthesisPsg);
  writeJson(path.join(resolvedOutputDir, 'prompt-mutations.psg'), promptMutationsPsg);
  writeJson(path.join(resolvedOutputDir, 'research-package.json'), researchPackageManifest);

  return {
    inputPath: sourceFiles[0].path,
    inputPaths: sourceFiles.map((file) => file.path),
    outputDir: resolvedOutputDir,
    augmentationPlanArtifact,
    assumptionReviewArtifact,
    categoryHypothesisArtifact,
    modeDetectionArtifact,
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    mutationArtifact,
    mutationReviewArtifact,
    scoreArtifact,
    reviewArtifact,
    sourceMapPsg,
    conceptClustersPsg,
    promptSynthesisPsg,
    promptMutationsPsg,
    researchPackageManifest
  };
}

module.exports = {
  ensureDir,
  readTextFile,
  resolveInputPath,
  slugify,
  runPipeline,
  writeJson
};

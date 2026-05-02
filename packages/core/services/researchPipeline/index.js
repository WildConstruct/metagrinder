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
  buildAgentRunsArtifact,
  buildSourceModeArtifact,
  buildSceneGrammarArtifact,
  buildResearchGapArtifact,
  buildResearchQueryPlan,
  buildWebResearchResults,
  buildGrammarRevisionArtifact,
  buildSamplePromptsArtifact,
  buildSceneGrammarEvaluation,
  buildPlausibilityReviewArtifact,
  buildSceneGrammarPsg,
  buildBranchSceneGrammarPsgs,
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
  const agentRunsArtifact = buildAgentRunsArtifact({
    inputId: ingestArtifact.inputId,
    createdAt
  });
  const sourceModeArtifact = buildSourceModeArtifact({
    ingestArtifact
  });
  const sceneGrammarArtifact = buildSceneGrammarArtifact({
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    sourceModeArtifact
  });
  const researchGapArtifact = buildResearchGapArtifact({
    sceneGrammarArtifact
  });
  const researchQueryPlan = buildResearchQueryPlan({
    researchGapArtifact
  });
  const webResearchResults = buildWebResearchResults({
    researchQueryPlan,
    researchGapArtifact,
    now: () => createdAt
  });
  const grammarRevisionArtifact = buildGrammarRevisionArtifact({
    sceneGrammarArtifact,
    researchGapArtifact,
    webResearchResults
  });
  const samplePromptsArtifact = buildSamplePromptsArtifact({
    sceneGrammarArtifact
  });
  const sceneGrammarEvaluation = buildSceneGrammarEvaluation({
    sceneGrammarArtifact,
    samplePromptsArtifact,
    grammarRevisionArtifact
  });
  const plausibilityReviewArtifact = buildPlausibilityReviewArtifact({
    sceneGrammarArtifact,
    samplePromptsArtifact
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
  const sceneGrammarPsg = buildSceneGrammarPsg({
    sceneGrammarArtifact,
    now: () => createdAt
  });
  const branchGraphPsgs = buildBranchSceneGrammarPsgs({
    sceneGrammarArtifact,
    now: () => createdAt
  });
  const researchPackageManifest = buildResearchPackageManifest({
    ingestArtifact,
    scoreArtifact,
    mutationArtifact,
    sceneGrammarArtifact,
    researchGapArtifact,
    samplePromptsArtifact,
    sceneGrammarEvaluation,
    plausibilityReviewArtifact,
    sceneGrammarPsg,
    grammarRevisionArtifact,
    branchGraphPsgs
  });

  validatePackageArtifacts({
    augmentationPlanArtifact,
    assumptionReviewArtifact,
    categoryHypothesisArtifact,
    modeDetectionArtifact,
    agentRunsArtifact,
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    sourceModeArtifact,
    sceneGrammarArtifact,
    researchGapArtifact,
    researchQueryPlan,
    webResearchResults,
    grammarRevisionArtifact,
    samplePromptsArtifact,
    sceneGrammarEvaluation,
    plausibilityReviewArtifact,
    mutationArtifact,
    mutationReviewArtifact,
    scoreArtifact,
    reviewArtifact,
    sourceMapPsg,
    conceptClustersPsg,
    promptSynthesisPsg,
    promptMutationsPsg,
    sceneGrammarPsg,
    branchGraphPsgs,
    researchPackageManifest
  });

  ensureDir(resolvedOutputDir);
  writeJson(path.join(resolvedOutputDir, 'agent-runs.json'), agentRunsArtifact);
  writeJson(path.join(resolvedOutputDir, 'mode-detection.json'), modeDetectionArtifact);
  writeJson(path.join(resolvedOutputDir, 'category-hypothesis.json'), categoryHypothesisArtifact);
  writeJson(path.join(resolvedOutputDir, 'assumption-review.json'), assumptionReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'augmentation-plan.json'), augmentationPlanArtifact);
  writeJson(path.join(resolvedOutputDir, 'ingest.json'), ingestArtifact);
  writeJson(path.join(resolvedOutputDir, 'extract.json'), extractArtifact);
  writeJson(path.join(resolvedOutputDir, 'classify.json'), classifyArtifact);
  writeJson(path.join(resolvedOutputDir, 'synthesize.json'), synthesizeArtifact);
  writeJson(path.join(resolvedOutputDir, 'scene-grammar.json'), sceneGrammarArtifact);
  writeJson(path.join(resolvedOutputDir, 'research-gaps.json'), researchGapArtifact);
  writeJson(path.join(resolvedOutputDir, 'research-query-plan.json'), researchQueryPlan);
  writeJson(path.join(resolvedOutputDir, 'web-research-results.json'), webResearchResults);
  writeJson(path.join(resolvedOutputDir, 'grammar-revisions.json'), grammarRevisionArtifact);
  writeJson(path.join(resolvedOutputDir, 'sample-prompts.json'), samplePromptsArtifact);
  writeJson(path.join(resolvedOutputDir, 'scene-grammar-evaluation.json'), sceneGrammarEvaluation);
  writeJson(path.join(resolvedOutputDir, 'plausibility-review.json'), plausibilityReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'mutate.json'), mutationArtifact);
  writeJson(path.join(resolvedOutputDir, 'mutation-review.json'), mutationReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'score.json'), scoreArtifact);
  writeJson(path.join(resolvedOutputDir, 'review.json'), reviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-map.psg'), sourceMapPsg);
  writeJson(path.join(resolvedOutputDir, 'concept-clusters.psg'), conceptClustersPsg);
  writeJson(path.join(resolvedOutputDir, 'prompt-synthesis.psg'), promptSynthesisPsg);
  writeJson(path.join(resolvedOutputDir, 'prompt-mutations.psg'), promptMutationsPsg);
  writeJson(path.join(resolvedOutputDir, 'scene-grammar.psg'), sceneGrammarPsg);
  const branchGraphDir = path.join(resolvedOutputDir, 'branch-graphs');
  ensureDir(branchGraphDir);
  Object.entries(branchGraphPsgs).forEach(([fileName, graph]) => {
    writeJson(path.join(branchGraphDir, fileName), graph);
  });
  writeJson(path.join(resolvedOutputDir, 'research-package.json'), researchPackageManifest);

  return {
    inputPath: sourceFiles[0].path,
    inputPaths: sourceFiles.map((file) => file.path),
    outputDir: resolvedOutputDir,
    augmentationPlanArtifact,
    assumptionReviewArtifact,
    categoryHypothesisArtifact,
    modeDetectionArtifact,
    agentRunsArtifact,
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    sourceModeArtifact,
    sceneGrammarArtifact,
    researchGapArtifact,
    researchQueryPlan,
    webResearchResults,
    grammarRevisionArtifact,
    samplePromptsArtifact,
    sceneGrammarEvaluation,
    plausibilityReviewArtifact,
    mutationArtifact,
    mutationReviewArtifact,
    scoreArtifact,
    reviewArtifact,
    sourceMapPsg,
    conceptClustersPsg,
    promptSynthesisPsg,
    promptMutationsPsg,
    sceneGrammarPsg,
    branchGraphPsgs,
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

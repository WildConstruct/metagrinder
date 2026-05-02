const path = require('path');

const {
  preparseResearchBrief
} = require('./research-brief-preparser.js');
const researchReviewService = require('../../services/researchReview/index.js');
const researchIngestService = require('../../services/researchIngest/index.js');
const researchExtractService = require('../../services/researchExtract/index.js');
const researchClassifyService = require('../../services/researchClassify/index.js');
const researchSynthesizeService = require('../../services/researchSynthesize/index.js');
const researchMutationService = require('../../services/researchMutation/index.js');
const researchScoreService = require('../../services/researchScore/index.js');
const researchPackageService = require('../../services/researchPackage/index.js');
const researchPipelineService = require('../../services/researchPipeline/index.js');
const researchAgentRunsService = require('../../services/researchAgentRuns/index.js');
const researchSourceModeService = require('../../services/researchSourceMode/index.js');
const researchSceneGrammarService = require('../../services/researchSceneGrammar/index.js');
const researchGapAnalysisService = require('../../services/researchGapAnalysis/index.js');
const researchQueryPlanService = require('../../services/researchQueryPlan/index.js');
const researchWebResearchService = require('../../services/researchWebResearch/index.js');
const researchGrammarRevisionService = require('../../services/researchGrammarRevision/index.js');
const researchSamplerService = require('../../services/researchSampler/index.js');
const researchPlausibilityEvaluateService = require('../../services/researchPlausibilityEvaluate/index.js');
const researchPsgCompilerService = require('../../services/researchPsgCompiler/index.js');

function deriveTitle(rawText, inputPath) {
  return researchIngestService.deriveTitle(rawText, inputPath);
}

function deriveCombinedTitle(sourceInputs) {
  return researchIngestService.deriveCombinedTitle(sourceInputs);
}

function buildResearchBriefReviewArtifacts({
  ingestArtifact,
  rawText,
  title,
  inputPath = 'research-brief.txt',
  inputId,
  createdAt
}) {
  const resolvedIngestArtifact = ingestArtifact || buildIngestArtifact({
    inputPath,
    rawText,
    inputId: inputId || researchPipelineService.slugify(
      title && title.trim()
        ? title.trim()
        : deriveTitle(rawText, inputPath)
    ),
    title: title && title.trim()
      ? title.trim()
      : deriveTitle(rawText, inputPath),
    createdAt
  });
  const modeDetectionArtifact = researchReviewService.buildModeDetectionArtifact({
    inputId: resolvedIngestArtifact.inputId,
    title: resolvedIngestArtifact.title,
    chunks: resolvedIngestArtifact.chunks
  });
  const categoryHypothesisArtifact = researchReviewService.buildCategoryHypothesisArtifact({
    inputId: resolvedIngestArtifact.inputId,
    modeDetectionArtifact,
    ingestArtifact: resolvedIngestArtifact
  });
  const assumptionReviewArtifact = researchReviewService.buildAssumptionReviewArtifact({
    inputId: resolvedIngestArtifact.inputId,
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    ingestArtifact: resolvedIngestArtifact
  });
  const augmentationPlanArtifact = researchReviewService.buildAugmentationPlanArtifact({
    inputId: resolvedIngestArtifact.inputId,
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    assumptionReviewArtifact,
    ingestArtifact: resolvedIngestArtifact
  });

  return {
    ingestArtifact: resolvedIngestArtifact,
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    assumptionReviewArtifact,
    augmentationPlanArtifact
  };
}

function buildIngestArtifact({ inputPath, rawText, inputId, title, createdAt }) {
  return researchIngestService.buildIngestArtifact({
    inputPath,
    rawText,
    inputId,
    title,
    createdAt,
    preparseResearchBrief,
    buildModeDetectionArtifact: researchReviewService.buildModeDetectionArtifact
  });
}

function buildMultiInputIngestArtifact({ sourceFiles, inputId, title, createdAt }) {
  return researchIngestService.buildMultiInputIngestArtifact({
    sourceFiles,
    inputId,
    title,
    createdAt,
    preparseResearchBrief,
    buildModeDetectionArtifact: researchReviewService.buildModeDetectionArtifact
  });
}

function buildExtractArtifact({ ingestArtifact }) {
  return researchExtractService.buildExtractArtifact({
    ingestArtifact
  });
}

function buildClassifyArtifact({ ingestArtifact, extractArtifact }) {
  return researchClassifyService.buildClassifyArtifact({
    ingestArtifact,
    extractArtifact
  });
}

function buildSynthesizeArtifact({ ingestArtifact, extractArtifact }) {
  return researchSynthesizeService.buildSynthesizeArtifact({
    ingestArtifact,
    extractArtifact
  });
}

function buildPromptSynthesisPsg({ ingestArtifact, synthesizeArtifact }) {
  return researchPackageService.buildPromptSynthesisPsg({
    ingestArtifact,
    synthesizeArtifact
  });
}

function buildPromptMutationsPsg({ ingestArtifact, mutationArtifact }) {
  return researchPackageService.buildPromptMutationsPsg({
    ingestArtifact,
    mutationArtifact
  });
}

function buildMutationArtifact({ synthesizeArtifact }) {
  return researchMutationService.buildMutationArtifact({
    synthesizeArtifact
  });
}

function buildMutationReviewArtifact({ mutationArtifact }) {
  return researchMutationService.buildMutationReviewArtifact({
    mutationArtifact
  });
}

function buildScoreArtifact({ ingestArtifact, extractArtifact, synthesizeArtifact }) {
  return researchScoreService.buildScoreArtifact({
    ingestArtifact,
    extractArtifact,
    synthesizeArtifact
  });
}

function buildReviewArtifact({ ingestArtifact, extractArtifact, synthesizeArtifact, scoreArtifact }) {
  return researchScoreService.buildReviewArtifact({
    ingestArtifact,
    extractArtifact,
    synthesizeArtifact,
    scoreArtifact
  });
}

function buildSourceMapPsg({ ingestArtifact }) {
  return researchPackageService.buildSourceMapPsg({
    ingestArtifact
  });
}

function buildConceptClustersPsg({ ingestArtifact, extractArtifact, classifyArtifact }) {
  return researchPackageService.buildConceptClustersPsg({
    ingestArtifact,
    extractArtifact,
    classifyArtifact
  });
}

function buildResearchPackageManifest({
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
}) {
  return researchPackageService.buildResearchPackageManifest({
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
}

function buildAgentRunsArtifact({ inputId, createdAt }) {
  return researchAgentRunsService.buildDefaultAgentRunsArtifact({
    inputId,
    createdAt
  });
}

function buildSourceModeArtifact({ ingestArtifact }) {
  return researchSourceModeService.buildSourceModeArtifact({
    ingestArtifact
  });
}

function buildSceneGrammarArtifact({
  ingestArtifact,
  extractArtifact,
  classifyArtifact,
  synthesizeArtifact,
  sourceModeArtifact
}) {
  return researchSceneGrammarService.buildSceneGrammarArtifact({
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    sourceModeArtifact
  });
}

function buildResearchGapArtifact({ sceneGrammarArtifact }) {
  return researchGapAnalysisService.buildResearchGapArtifact({
    sceneGrammarArtifact
  });
}

function buildResearchQueryPlan({ researchGapArtifact }) {
  return researchQueryPlanService.buildResearchQueryPlan({
    researchGapArtifact
  });
}

function buildWebResearchResults({ researchQueryPlan, researchGapArtifact, now }) {
  return researchWebResearchService.buildWebResearchResults({
    researchQueryPlan,
    researchGapArtifact,
    now
  });
}

function buildGrammarRevisionArtifact({ sceneGrammarArtifact, researchGapArtifact, webResearchResults }) {
  return researchGrammarRevisionService.buildGrammarRevisionArtifact({
    sceneGrammarArtifact,
    researchGapArtifact,
    webResearchResults
  });
}

function buildSamplePromptsArtifact({ sceneGrammarArtifact }) {
  return researchSamplerService.buildSamplePromptsArtifact({
    sceneGrammarArtifact
  });
}

function buildSceneGrammarEvaluation({ sceneGrammarArtifact, samplePromptsArtifact, grammarRevisionArtifact }) {
  return researchPlausibilityEvaluateService.buildSceneGrammarEvaluation({
    sceneGrammarArtifact,
    samplePromptsArtifact,
    grammarRevisionArtifact
  });
}

function buildPlausibilityReviewArtifact({ sceneGrammarArtifact, samplePromptsArtifact }) {
  return researchPlausibilityEvaluateService.buildPlausibilityReviewArtifact({
    sceneGrammarArtifact,
    samplePromptsArtifact
  });
}

function buildSceneGrammarPsg({ sceneGrammarArtifact, now }) {
  return researchPsgCompilerService.buildSceneGrammarPsg({
    sceneGrammarArtifact,
    now
  });
}

function buildBranchSceneGrammarPsgs({ sceneGrammarArtifact, now }) {
  return researchPsgCompilerService.buildBranchSceneGrammarPsgs({
    sceneGrammarArtifact,
    now
  });
}

function validatePackageArtifacts({
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
}) {
  return researchPackageService.validatePackageArtifacts({
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
}

function runMetagrinderMvp({ inputPath, inputPaths, outputDir, title }) {
  return researchPipelineService.runPipeline({
    inputPath,
    inputPaths,
    outputDir,
    title,
    resolveInputPath: (candidatePath) => researchPipelineService.resolveInputPath(
      candidatePath,
      path.resolve(__dirname, '..', '..', '..', '..')
    ),
    readTextFile: researchPipelineService.readTextFile,
    ensureDir: researchPipelineService.ensureDir,
    writeJson: researchPipelineService.writeJson,
    deriveTitle,
    deriveCombinedTitle,
    slugify: researchPipelineService.slugify,
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
    validatePackageArtifacts
  });
}

module.exports = {
  buildAssumptionReviewArtifact: researchReviewService.buildAssumptionReviewArtifact,
  buildAugmentationPlanArtifact: researchReviewService.buildAugmentationPlanArtifact,
  buildClassifyArtifact,
  buildConceptClustersPsg,
  buildCategoryHypothesisArtifact: researchReviewService.buildCategoryHypothesisArtifact,
  buildExtractArtifact,
  buildIngestArtifact,
  buildModeDetectionArtifact: researchReviewService.buildModeDetectionArtifact,
  buildMutationArtifact,
  buildMutationReviewArtifact,
  buildMultiInputIngestArtifact,
  buildPromptMutationsPsg,
  buildPromptSynthesisPsg,
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
  preparseResearchBrief,
  buildResearchBriefReviewArtifacts,
  buildResearchPackageManifest,
  buildReviewArtifact,
  buildScoreArtifact,
  buildSourceMapPsg,
  buildSynthesizeArtifact,
  deriveTitle,
  researchPipelineService,
  researchPackageService,
  researchReviewService,
  runMetagrinderMvp
};

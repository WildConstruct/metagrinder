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
const researchSemanticChoiceGraphService = require('../../services/researchSemanticChoiceGraph/index.js');
const researchStructuredBriefService = require('../../services/researchStructuredBrief/index.js');
const researchCodexSemanticParseService = require('../../services/researchCodexSemanticParse/index.js');
const researchGapAnalysisService = require('../../services/researchGapAnalysis/index.js');
const researchQueryPlanService = require('../../services/researchQueryPlan/index.js');
const researchWebResearchService = require('../../services/researchWebResearch/index.js');
const researchRetrievalPolicyService = require('../../services/researchRetrievalPolicy/index.js');
const researchRetrievalCandidatesService = require('../../services/researchRetrievalCandidates/index.js');
const researchRetrievalCacheService = require('../../services/researchRetrievalCache/index.js');
const researchLiveRetrievalService = require('../../services/researchLiveRetrieval/index.js');
const researchLiveProviderContractService = require('../../services/researchLiveProviderContract/index.js');
const researchProviderConfigService = require('../../services/researchProviderConfig/index.js');
const researchProviderPreflightService = require('../../services/researchProviderPreflight/index.js');
const researchProviderRequestShapesService = require('../../services/researchProviderRequestShapes/index.js');
const researchProviderErrorsService = require('../../services/researchProviderErrors/index.js');
const researchProviderResponseLogService = require('../../services/researchProviderResponseLog/index.js');
const researchLiveProviderPilotReportService = require('../../services/researchLiveProviderPilotReport/index.js');
const researchCandidateInspectionService = require('../../services/researchCandidateInspection/index.js');
const researchRealEndpointProofService = require('../../services/researchRealEndpointProof/index.js');
const researchSourceTypingService = require('../../services/researchSourceTyping/index.js');
const researchSourceIntakeApprovalService = require('../../services/researchSourceIntakeApproval/index.js');
const researchSourceRegistryService = require('../../services/researchSourceRegistry/index.js');
const researchSourceClaimsService = require('../../services/researchSourceClaims/index.js');
const researchSourceEvidenceService = require('../../services/researchSourceEvidence/index.js');
const researchSourceClaimReviewService = require('../../services/researchSourceClaimReview/index.js');
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
  structuredBriefSeedArtifact,
  structuredBriefArtifact,
  briefAnalysisArtifact,
  semanticChoiceGraphArtifact,
  codexParseRequestArtifact,
  codexParseOutputSchemaArtifact,
  codexParseResultArtifact,
  sceneGrammarArtifact,
  researchGapArtifact,
  samplePromptsArtifact,
  sceneGrammarEvaluation,
  plausibilityReviewArtifact,
  sceneGrammarPsg,
  grammarRevisionArtifact,
  acceptedGrammarRevisionArtifact,
  rejectedGrammarRevisionArtifact,
  revisionStateArtifact,
  revisionStateAppliedArtifact,
  revisionReviewArtifact,
  acceptedGrammarDeltasArtifact,
  operatorReviewArtifact,
  psgCompileDiffArtifact,
  liveRetrievalReadinessArtifact,
  liveProviderContractArtifact,
  providerConfigAppliedArtifact,
  providerPreflightReportArtifact,
  providerRequestShapesArtifact,
  providerResponseLogArtifact,
  liveProviderPilotReportArtifact,
  realEndpointProofReportArtifact,
  candidateInspectionArtifact,
  sourceTypingReportArtifact,
  providerErrorReportArtifact,
  liveRetrievalPreflightArtifact,
  liveRetrievalRequestsArtifact,
  liveRetrievalCacheWriteArtifact,
  sourceRegistryArtifact,
  sourceClaimsArtifact,
  sourceEvidenceArtifact,
  sourceClaimReviewArtifact,
  retrievalPolicyArtifact,
  retrievalRunLogArtifact,
  retrievalCandidatesArtifact,
  retrievalCacheManifestArtifact,
  sourceIntakeApprovalArtifact,
  approvedSourceResultsArtifact,
  retrievalSafetyReportArtifact,
  acceptedSceneGrammarArtifact,
  branchGraphPsgs
}) {
  return researchPackageService.buildResearchPackageManifest({
    ingestArtifact,
    scoreArtifact,
    mutationArtifact,
    structuredBriefSeedArtifact,
    structuredBriefArtifact,
    briefAnalysisArtifact,
    semanticChoiceGraphArtifact,
    codexParseRequestArtifact,
    codexParseOutputSchemaArtifact,
    codexParseResultArtifact,
    sceneGrammarArtifact,
    researchGapArtifact,
    samplePromptsArtifact,
    sceneGrammarEvaluation,
    plausibilityReviewArtifact,
    sceneGrammarPsg,
    grammarRevisionArtifact,
    acceptedGrammarRevisionArtifact,
    rejectedGrammarRevisionArtifact,
    revisionStateArtifact,
    revisionStateAppliedArtifact,
    revisionReviewArtifact,
    acceptedGrammarDeltasArtifact,
    operatorReviewArtifact,
    psgCompileDiffArtifact,
    liveRetrievalReadinessArtifact,
    liveProviderContractArtifact,
    providerConfigAppliedArtifact,
    providerPreflightReportArtifact,
    providerRequestShapesArtifact,
    providerResponseLogArtifact,
    liveProviderPilotReportArtifact,
    realEndpointProofReportArtifact,
    candidateInspectionArtifact,
    sourceTypingReportArtifact,
    providerErrorReportArtifact,
    liveRetrievalPreflightArtifact,
    liveRetrievalRequestsArtifact,
    liveRetrievalCacheWriteArtifact,
    sourceRegistryArtifact,
    sourceClaimsArtifact,
    sourceEvidenceArtifact,
    sourceClaimReviewArtifact,
    retrievalPolicyArtifact,
    retrievalRunLogArtifact,
    retrievalCandidatesArtifact,
    retrievalCacheManifestArtifact,
    sourceIntakeApprovalArtifact,
    approvedSourceResultsArtifact,
    retrievalSafetyReportArtifact,
    acceptedSceneGrammarArtifact,
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

function buildStructuredBriefArtifact({ ingestArtifact }) {
  return researchStructuredBriefService.buildStructuredBriefArtifact({ ingestArtifact });
}

function buildBriefAnalysisFromSeed({ ingestArtifact, structuredBriefSeedArtifact }) {
  return researchCodexSemanticParseService.buildBriefAnalysisFromSeed({
    ingestArtifact,
    structuredBriefSeedArtifact
  });
}

function buildCodexParseOutputSchemaArtifact({ inputId }) {
  return researchCodexSemanticParseService.buildCodexParseOutputSchemaArtifact({ inputId });
}

function buildCodexParseRequestArtifact({ ingestArtifact, structuredBriefSeedArtifact }) {
  return researchCodexSemanticParseService.buildCodexParseRequestArtifact({
    ingestArtifact,
    structuredBriefSeedArtifact
  });
}

function buildCodexParseRequestMarkdown({ codexParseRequestArtifact }) {
  return researchCodexSemanticParseService.buildCodexParseRequestMarkdown({
    codexParseRequestArtifact
  });
}

function buildProjectionStructuredBriefFromAnalysis({
  structuredBriefSeedArtifact,
  briefAnalysisArtifact
}) {
  return researchCodexSemanticParseService.buildProjectionStructuredBriefFromAnalysis({
    structuredBriefSeedArtifact,
    briefAnalysisArtifact
  });
}

function normalizeCodexParseResult({ ingestArtifact, codexParseResult }) {
  return researchCodexSemanticParseService.normalizeCodexParseResult({
    ingestArtifact,
    codexParseResult
  });
}

function buildSceneGrammarArtifact({
  ingestArtifact,
  extractArtifact,
  classifyArtifact,
  synthesizeArtifact,
  sourceModeArtifact,
  structuredBriefArtifact
}) {
  return researchSceneGrammarService.buildSceneGrammarArtifact({
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    sourceModeArtifact,
    structuredBriefArtifact
  });
}

function buildSemanticChoiceGraphArtifact({
  briefAnalysisArtifact,
  sceneGrammarArtifact
}) {
  return researchSemanticChoiceGraphService.buildSemanticChoiceGraphArtifact({
    briefAnalysisArtifact,
    sceneGrammarArtifact
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

function buildApprovedWebResearchResults({ approvedSourceResultsArtifact, retrievalCandidatesArtifact, researchGapArtifact, now }) {
  return researchWebResearchService.buildApprovedWebResearchResults({
    approvedSourceResultsArtifact,
    retrievalCandidatesArtifact,
    researchGapArtifact,
    now
  });
}

function buildEmptyWebResearchResults({ inputId, adapterMode, now }) {
  return researchWebResearchService.buildEmptyWebResearchResults({
    inputId,
    adapterMode,
    now
  });
}

function buildRetrievalPolicyArtifact(args) {
  return researchRetrievalPolicyService.buildRetrievalPolicyArtifact(args);
}

function buildRetrievalRunBoundary(args) {
  return researchRetrievalCandidatesService.buildRetrievalRunBoundary(args);
}

function buildLiveRetrievalPreflight(args) {
  return researchLiveRetrievalService.buildLiveRetrievalPreflight(args);
}

function searchLiveCandidates(args) {
  return researchLiveRetrievalService.searchLiveCandidates(args);
}

function buildLiveProviderContract(args) {
  return researchLiveProviderContractService.buildLiveProviderContract(args);
}

function buildProviderConfigApplied(args) {
  return researchProviderConfigService.buildProviderConfigApplied(args);
}

function buildProviderPreflightReport(args) {
  return researchProviderPreflightService.buildProviderPreflightReport(args);
}

function buildProviderRequestShapes(args) {
  return researchProviderRequestShapesService.buildProviderRequestShapes(args);
}

function buildProviderErrorReport(args) {
  return researchProviderErrorsService.buildProviderErrorReport(args);
}

function buildEmptyProviderResponseLog(args) {
  return researchProviderResponseLogService.buildEmptyProviderResponseLog(args);
}

function buildLiveProviderPilotReport(args) {
  return researchLiveProviderPilotReportService.buildLiveProviderPilotReport(args);
}

function buildCandidateInspectionArtifact(args) {
  return researchCandidateInspectionService.buildCandidateInspectionArtifact(args);
}

function buildCandidateInspectionMarkdown(args) {
  return researchCandidateInspectionService.buildCandidateInspectionMarkdown(args);
}

function buildRealEndpointProofReport(args) {
  return researchRealEndpointProofService.buildRealEndpointProofReport(args);
}

function buildSourceTypingReport(args) {
  return researchSourceTypingService.buildSourceTypingReport(args);
}

function readRetrievalCacheArtifact(args) {
  return researchRetrievalCacheService.readRetrievalCacheArtifact(args);
}

function buildRetrievalCacheManifest(args) {
  return researchRetrievalCacheService.buildRetrievalCacheManifest(args);
}

function buildSourceIntakeApprovalArtifact(args) {
  return researchSourceIntakeApprovalService.buildSourceIntakeApprovalArtifact(args);
}

function buildApprovedSourceResultsArtifact(args) {
  return researchSourceIntakeApprovalService.buildApprovedSourceResultsArtifact(args);
}

function buildRetrievalSafetyReport(args) {
  return researchSourceIntakeApprovalService.buildRetrievalSafetyReport(args);
}

function buildSourceRegistryArtifact({ ingestArtifact, webResearchResults }) {
  return researchSourceRegistryService.buildSourceRegistryArtifact({
    ingestArtifact,
    webResearchResults
  });
}

function buildSourceClaimsArtifact({ sourceRegistryArtifact, webResearchResults, researchGapArtifact, sourceEvidenceArtifact, sourceClaimReviewArtifact }) {
  return researchSourceClaimsService.buildSourceClaimsArtifact({
    sourceRegistryArtifact,
    webResearchResults,
    researchGapArtifact,
    sourceEvidenceArtifact,
    sourceClaimReviewArtifact
  });
}

function buildSourceEvidenceArtifact(args) {
  return researchSourceEvidenceService.buildSourceEvidenceArtifact(args);
}

function buildSourceClaimReviewArtifact(args) {
  return researchSourceClaimReviewService.buildSourceClaimReviewArtifact(args);
}

function buildGrammarRevisionArtifact({ sceneGrammarArtifact, researchGapArtifact, webResearchResults, sourceClaimsArtifact }) {
  return researchGrammarRevisionService.buildGrammarRevisionArtifact({
    sceneGrammarArtifact,
    researchGapArtifact,
    webResearchResults,
    sourceClaimsArtifact
  });
}

function splitGrammarRevisionArtifact({ grammarRevisionArtifact }) {
  return researchGrammarRevisionService.splitGrammarRevisionArtifact({
    grammarRevisionArtifact
  });
}

function applyRevisionStateFile({ grammarRevisionArtifact, revisionStateFile, revisionStateFilePath, sourceClaimsArtifact }) {
  return researchGrammarRevisionService.applyRevisionStateFile({
    grammarRevisionArtifact,
    revisionStateFile,
    revisionStateFilePath,
    sourceClaimsArtifact
  });
}

function applyAcceptedGrammarRevisions({ sceneGrammarArtifact, grammarRevisionArtifact }) {
  return researchGrammarRevisionService.applyAcceptedGrammarRevisions({
    sceneGrammarArtifact,
    grammarRevisionArtifact
  });
}

function applyAcceptedGrammarRevisionsWithDeltas({ sceneGrammarArtifact, grammarRevisionArtifact, sourceClaimsArtifact, sourceClaimReviewArtifact, requireReviewedCitations }) {
  return researchGrammarRevisionService.applyAcceptedGrammarRevisionsWithDeltas({
    sceneGrammarArtifact,
    grammarRevisionArtifact,
    sourceClaimsArtifact,
    sourceClaimReviewArtifact,
    requireReviewedCitations
  });
}

function buildRevisionReviewArtifact({
  grammarRevisionArtifact,
  revisionStateAppliedArtifact,
  sourceClaimsArtifact,
  compileGrammarTarget,
  acceptedGrammarDeltasArtifact,
  psgCompileDiffArtifact
}) {
  return researchGrammarRevisionService.buildRevisionReviewArtifact({
    grammarRevisionArtifact,
    revisionStateAppliedArtifact,
    sourceClaimsArtifact,
    compileGrammarTarget,
    acceptedGrammarDeltasArtifact,
    psgCompileDiffArtifact
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

function buildSceneGrammarPsg({ sceneGrammarArtifact, semanticChoiceGraphArtifact, now }) {
  return researchPsgCompilerService.buildSceneGrammarPsg({
    sceneGrammarArtifact,
    semanticChoiceGraphArtifact,
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
  structuredBriefSeedArtifact,
  structuredBriefArtifact,
  briefAnalysisArtifact,
  codexParseRequestArtifact,
  codexParseOutputSchemaArtifact,
  codexParseResultArtifact,
  semanticChoiceGraphArtifact,
  sceneGrammarArtifact,
  researchGapArtifact,
  researchQueryPlan,
  webResearchResults,
  sourceRegistryArtifact,
  sourceClaimsArtifact,
  sourceEvidenceArtifact,
  sourceClaimReviewArtifact,
  retrievalPolicyArtifact,
  retrievalRunLogArtifact,
  retrievalCandidatesArtifact,
  retrievalCacheManifestArtifact,
  sourceIntakeApprovalArtifact,
  approvedSourceResultsArtifact,
  retrievalSafetyReportArtifact,
  grammarRevisionArtifact,
  acceptedGrammarRevisionArtifact,
  rejectedGrammarRevisionArtifact,
  revisionStateArtifact,
  revisionStateAppliedArtifact,
  revisionReviewArtifact,
  acceptedGrammarDeltasArtifact,
  psgCompileDiffArtifact,
  liveRetrievalReadinessArtifact,
  acceptedSceneGrammarArtifact,
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
    structuredBriefSeedArtifact,
    structuredBriefArtifact,
    briefAnalysisArtifact,
    codexParseRequestArtifact,
    codexParseOutputSchemaArtifact,
    codexParseResultArtifact,
    semanticChoiceGraphArtifact,
    sceneGrammarArtifact,
    researchGapArtifact,
    researchQueryPlan,
    webResearchResults,
    sourceRegistryArtifact,
    sourceClaimsArtifact,
    sourceEvidenceArtifact,
    sourceClaimReviewArtifact,
    retrievalPolicyArtifact,
    retrievalRunLogArtifact,
    retrievalCandidatesArtifact,
    retrievalCacheManifestArtifact,
    sourceIntakeApprovalArtifact,
    approvedSourceResultsArtifact,
    retrievalSafetyReportArtifact,
    grammarRevisionArtifact,
    acceptedGrammarRevisionArtifact,
    rejectedGrammarRevisionArtifact,
    revisionStateArtifact,
    revisionStateAppliedArtifact,
    revisionReviewArtifact,
    acceptedGrammarDeltasArtifact,
    psgCompileDiffArtifact,
    liveRetrievalReadinessArtifact,
    acceptedSceneGrammarArtifact,
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

function runMetagrinderMvp({
  inputPath,
  inputPaths,
  outputDir,
  title,
  revisionStateFilePath,
  applyAcceptedRevisions,
  compileGrammar,
  webResearchMode,
  retrievalPolicyFilePath,
  sourceIntakeApprovalFilePath,
  sourceClaimReviewFilePath,
  retrievalCacheDir,
  maxQueriesTotal,
  maxQueriesPerGap,
  maxResultsPerQuery,
  allowedSourceTypes,
  allowedDomains,
  blockedDomains,
  blockedSourceTypes,
  enableLiveRetrieval,
  liveProvider,
  providerConfigFilePath,
  providerTimeoutMs,
  providerMaxRetries,
  providerHttpClient
}) {
  return researchPipelineService.runPipeline({
    inputPath,
    inputPaths,
    outputDir,
    title,
    revisionStateFilePath,
    applyAcceptedRevisions,
    compileGrammar,
    webResearchMode,
    retrievalPolicyFilePath,
    sourceIntakeApprovalFilePath,
    sourceClaimReviewFilePath,
    retrievalCacheDir,
    maxQueriesTotal,
    maxQueriesPerGap,
    maxResultsPerQuery,
    allowedSourceTypes,
    allowedDomains,
    blockedDomains,
    blockedSourceTypes,
    enableLiveRetrieval,
    liveProvider,
    providerConfigFilePath,
    providerTimeoutMs,
    providerMaxRetries,
    providerHttpClient,
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
    buildStructuredBriefArtifact,
    buildBriefAnalysisFromSeed,
    buildCodexParseOutputSchemaArtifact,
    buildCodexParseRequestArtifact,
    buildCodexParseRequestMarkdown,
    buildProjectionStructuredBriefFromAnalysis,
    normalizeCodexParseResult,
    buildSceneGrammarArtifact,
    buildSemanticChoiceGraphArtifact,
    buildResearchGapArtifact,
    buildResearchQueryPlan,
    buildWebResearchResults,
    buildApprovedWebResearchResults,
    buildEmptyWebResearchResults,
    buildRetrievalPolicyArtifact,
    buildRetrievalRunBoundary,
    buildLiveRetrievalPreflight,
    searchLiveCandidates,
    buildLiveProviderContract,
    buildProviderConfigApplied,
    buildProviderPreflightReport,
    buildProviderRequestShapes,
    buildProviderErrorReport,
    buildEmptyProviderResponseLog,
    buildLiveProviderPilotReport,
    buildCandidateInspectionArtifact,
    buildCandidateInspectionMarkdown,
    buildRealEndpointProofReport,
    buildSourceTypingReport,
    readRetrievalCacheArtifact,
    buildRetrievalCacheManifest,
    buildSourceIntakeApprovalArtifact,
    buildApprovedSourceResultsArtifact,
    buildRetrievalSafetyReport,
    buildSourceRegistryArtifact,
    buildSourceEvidenceArtifact,
    buildSourceClaimReviewArtifact,
    buildSourceClaimsArtifact,
    buildGrammarRevisionArtifact,
    applyRevisionStateFile,
    splitGrammarRevisionArtifact,
    applyAcceptedGrammarRevisions,
    applyAcceptedGrammarRevisionsWithDeltas,
    buildRevisionReviewArtifact,
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
  buildStructuredBriefArtifact,
  buildBriefAnalysisFromSeed,
  buildCodexParseOutputSchemaArtifact,
  buildCodexParseRequestArtifact,
  buildCodexParseRequestMarkdown,
  buildProjectionStructuredBriefFromAnalysis,
  normalizeCodexParseResult,
  buildSceneGrammarArtifact,
  buildSemanticChoiceGraphArtifact,
  buildResearchGapArtifact,
  buildResearchQueryPlan,
  buildWebResearchResults,
  buildApprovedWebResearchResults,
  buildEmptyWebResearchResults,
  buildRetrievalPolicyArtifact,
  buildRetrievalRunBoundary,
  buildLiveRetrievalPreflight,
  searchLiveCandidates,
  buildLiveProviderContract,
  buildProviderConfigApplied,
  buildProviderPreflightReport,
  buildProviderRequestShapes,
  buildProviderErrorReport,
  buildEmptyProviderResponseLog,
  buildLiveProviderPilotReport,
  buildCandidateInspectionArtifact,
  buildCandidateInspectionMarkdown,
  buildRealEndpointProofReport,
  buildSourceTypingReport,
  readRetrievalCacheArtifact,
  buildRetrievalCacheManifest,
  buildSourceIntakeApprovalArtifact,
  buildApprovedSourceResultsArtifact,
  buildRetrievalSafetyReport,
  buildSourceRegistryArtifact,
  buildSourceEvidenceArtifact,
  buildSourceClaimReviewArtifact,
  buildSourceClaimsArtifact,
  buildGrammarRevisionArtifact,
  applyRevisionStateFile,
  splitGrammarRevisionArtifact,
  applyAcceptedGrammarRevisions,
  applyAcceptedGrammarRevisionsWithDeltas,
  buildRevisionReviewArtifact,
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

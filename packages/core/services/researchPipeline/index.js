const fs = require('fs');
const path = require('path');
const researchRetrievalPolicyService = require('../researchRetrievalPolicy/index.js');
const researchRetrievalCandidatesService = require('../researchRetrievalCandidates/index.js');
const researchRetrievalCacheService = require('../researchRetrievalCache/index.js');
const researchCodexSemanticParseService = require('../researchCodexSemanticParse/index.js');
const researchSemanticChoiceGraphService = require('../researchSemanticChoiceGraph/index.js');
const researchLiveRetrievalService = require('../researchLiveRetrieval/index.js');
const researchLiveProviderContractService = require('../researchLiveProviderContract/index.js');
const researchProviderConfigService = require('../researchProviderConfig/index.js');
const researchProviderPreflightService = require('../researchProviderPreflight/index.js');
const researchProviderRequestShapesService = require('../researchProviderRequestShapes/index.js');
const researchProviderErrorsService = require('../researchProviderErrors/index.js');
const researchProviderResponseLogService = require('../researchProviderResponseLog/index.js');
const researchLiveProviderPilotReportService = require('../researchLiveProviderPilotReport/index.js');
const researchCandidateInspectionService = require('../researchCandidateInspection/index.js');
const researchRealEndpointProofService = require('../researchRealEndpointProof/index.js');
const researchSourceTypingService = require('../researchSourceTyping/index.js');
const researchSourceIntakeApprovalService = require('../researchSourceIntakeApproval/index.js');
const researchSourceEvidenceService = require('../researchSourceEvidence/index.js');
const researchSourceClaimReviewService = require('../researchSourceClaimReview/index.js');
const researchWebResearchService = require('../researchWebResearch/index.js');

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

function normalizeChoices(node) {
  return (node?.options || []).map((choice) => ({
    text: choice.text,
    weight: choice.weight
  }));
}

function choicesDiffer(beforeChoices, afterChoices) {
  return JSON.stringify(beforeChoices) !== JSON.stringify(afterChoices);
}

function compareWeightedChoiceGraphs({ inputId, baseGraphs, acceptedGraphs }) {
  const changedNodes = [];
  Object.entries(baseGraphs).forEach(([graphPath, baseGraph]) => {
    const acceptedGraph = acceptedGraphs[graphPath];
    if (!acceptedGraph) return;
    const acceptedNodesById = new Map((acceptedGraph.nodes || []).map((node) => [node.id, node]));
    (baseGraph.nodes || [])
      .filter((node) => node.type === 'WeightedChoice')
      .forEach((baseNode) => {
        const acceptedNode = acceptedNodesById.get(baseNode.id);
        if (!acceptedNode || acceptedNode.type !== 'WeightedChoice') return;
        const beforeChoices = normalizeChoices(baseNode);
        const afterChoices = normalizeChoices(acceptedNode);
        if (choicesDiffer(beforeChoices, afterChoices)) {
          changedNodes.push({
            graphPath,
            nodeId: baseNode.id,
            changeType: 'weighted-choice-delta',
            beforeChoices,
            afterChoices
          });
        }
      });
  });

  return {
    inputId,
    baseGraphPath: 'scene-grammar.psg',
    acceptedGraphPath: 'scene-grammar.psg',
    changedNodes,
    materialDifference: changedNodes.length > 0
  };
}

function buildOperatorReviewArtifact({
  grammarRevisionArtifact,
  sourceClaimsArtifact,
  sourceRegistryArtifact,
  acceptedGrammarDeltasArtifact,
  sourceEvidenceArtifact,
  sourceClaimReviewArtifact
}) {
  const claimsById = new Map((sourceClaimsArtifact?.claims || []).map((claim) => [
    claim.sourceClaimId,
    claim
  ]));
  const sourcesById = new Map((sourceRegistryArtifact?.sources || []).map((source) => [
    source.sourceId,
    source
  ]));
  const deltasByRevisionId = new Map((acceptedGrammarDeltasArtifact?.deltas || []).map((delta) => [
    delta.revisionId,
    delta
  ]));
  const evidenceById = new Map((sourceEvidenceArtifact?.evidence || []).map((evidence) => [
    evidence.evidenceId,
    evidence
  ]));
  const claimReviewById = new Map((sourceClaimReviewArtifact?.claimReviews || []).map((review) => [
    review.sourceClaimId,
    review
  ]));
  return {
    inputId: grammarRevisionArtifact.inputId,
    revisions: grammarRevisionArtifact.revisions.map((revision) => {
      const claims = revision.sourceClaimIds.map((claimId) => claimsById.get(claimId)).filter(Boolean);
      const sourceQualities = [...new Set(claims.map((claim) =>
        sourcesById.get(claim.sourceId)?.sourceQuality || claim.confidence
      ))];
      const onlyLowQuality = sourceQualities.length > 0 && sourceQualities.every((quality) => quality === 'low');
      const delta = deltasByRevisionId.get(revision.revisionId);
      const evidenceIds = [...new Set(claims.flatMap((claim) => claim.evidenceIds || []))];
      const citationStatuses = [...new Set(revision.sourceClaimIds.map((claimId) =>
        claimReviewById.get(claimId)?.citationStatus || claims.find((claim) => claim.sourceClaimId === claimId)?.evidenceReviewStatus
      ).filter(Boolean))];
      return {
        revisionId: revision.revisionId,
        reviewStatus: revision.reviewStatus,
        recommendedAction: onlyLowQuality
          ? 'leave pending'
          : revision.changeType === 'flag-low-quality-source'
            ? 'reject'
            : 'accept',
        targetGrammarRef: revision.targetGrammarRef,
        changeType: revision.changeType,
        supportingSourceClaimIds: revision.sourceClaimIds,
        evidenceIds,
        citationStatus: citationStatuses.join(', ') || 'none',
        evidenceExcerpts: evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)?.excerptText).filter(Boolean),
        sourceQuality: sourceQualities,
        before: delta?.before || revision.before,
        proposedAfter: delta?.after || revision.after,
        reason: revision.reason,
        riskFlags: [
          ...(onlyLowQuality ? ['low-quality-only-support'] : []),
          ...(citationStatuses.includes('rejected') ? ['citation-rejected'] : []),
          ...(citationStatuses.includes('needs_review') ? ['citation-needs-review'] : []),
          ...(delta && !delta.materialChange ? ['confirmation-only'] : []),
          ...((delta?.warnings) || [])
        ]
      };
    })
  };
}

function buildOperatorReviewMarkdown(operatorReviewArtifact) {
  const lines = ['# Metagrinder Operator Review', ''];
  operatorReviewArtifact.revisions.forEach((revision) => {
    lines.push(`## Revision ${revision.revisionId}`);
    lines.push('');
    lines.push(`Status: ${revision.reviewStatus}`);
    lines.push(`Recommended action: ${revision.recommendedAction}`);
    lines.push(`Target: ${revision.targetGrammarRef}`);
    lines.push(`Change type: ${revision.changeType}`);
    lines.push(`Supporting claims: ${revision.supportingSourceClaimIds.join(', ') || 'none'}`);
    lines.push(`Evidence IDs: ${(revision.evidenceIds || []).join(', ') || 'none'}`);
    lines.push(`Citation status: ${revision.citationStatus || 'none'}`);
    lines.push(`Source quality: ${revision.sourceQuality.join(', ') || 'unknown'}`);
    lines.push(`Risk: ${revision.riskFlags.join('; ') || 'none'}`);
    lines.push('');
    lines.push('Before:');
    lines.push(`\`\`\`json\n${JSON.stringify(revision.before, null, 2)}\n\`\`\``);
    lines.push('Proposed:');
    lines.push(`\`\`\`json\n${JSON.stringify(revision.proposedAfter, null, 2)}\n\`\`\``);
    lines.push(revision.reason);
    if ((revision.evidenceExcerpts || []).length > 0) {
      lines.push('Evidence excerpt:');
      lines.push(`> ${revision.evidenceExcerpts[0]}`);
    }
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

function buildLiveRetrievalReadinessArtifact({ inputId }) {
  const checks = [
    ['query-budget-controls', 'Query budget controls', true],
    ['allowed-source-type-controls', 'Allowed source type controls', true],
    ['source-registry', 'Canonical source registry', true],
    ['source-claims', 'Separate source claims', true],
    ['source-dedupe', 'Source deduplication', true],
    ['citation-evidence-locators', 'Citation/evidence locator persistence', true],
    ['operator-review-state', 'Operator review state', true],
    ['accepted-rejected-pending-workflow', 'Accepted/rejected/pending workflow', true],
    ['revision-material-deltas', 'Revision material deltas', true],
    ['low-quality-source-warning', 'Low-quality source warning', true],
    ['no-auto-apply', 'No auto-apply behavior', true],
    ['live-adapter', 'Controlled live retrieval adapter', true]
  ].map(([id, label, exists]) => ({ id, label, exists }));
  return {
    inputId,
    ready: true,
    checks,
    missingPrerequisites: [
      'Only fixture-live candidate generation is enabled in this loop; broad live retrieval and page scraping remain blocked.'
    ]
  };
}

function runPipeline({
  inputPath,
  inputPaths,
  outputDir,
  title,
  revisionStateFilePath,
  applyAcceptedRevisions = false,
  compileGrammar,
  webResearchMode = 'mock',
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
  enableLiveRetrieval = false,
  liveProvider = 'unavailable',
  providerConfigFilePath,
  providerTimeoutMs,
  providerMaxRetries,
  providerHttpClient,
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
  const compileGrammarTarget = compileGrammar || 'accepted';
  if (!['base', 'accepted'].includes(compileGrammarTarget)) {
    throw new Error(`Invalid compile grammar target: ${compileGrammarTarget}`);
  }

  const missing = resolvedInputPaths.find((entry) => !entry.resolved);
  if (missing) {
    throw new Error(`Missing input file: ${missing.requested}`);
  }
  const resolvedRevisionStateFilePath = revisionStateFilePath
    ? resolveInputPath(revisionStateFilePath)
    : undefined;
  if (revisionStateFilePath && !resolvedRevisionStateFilePath) {
    throw new Error(`Missing revision state file: ${revisionStateFilePath}`);
  }
  const revisionStateArtifact = resolvedRevisionStateFilePath
    ? JSON.parse(readTextFile(resolvedRevisionStateFilePath))
    : undefined;
  const resolvedRetrievalPolicyFilePath = retrievalPolicyFilePath
    ? resolveInputPath(retrievalPolicyFilePath)
    : undefined;
  if (retrievalPolicyFilePath && !resolvedRetrievalPolicyFilePath) {
    throw new Error(`Missing retrieval policy file: ${retrievalPolicyFilePath}`);
  }
  const retrievalPolicyFileArtifact = resolvedRetrievalPolicyFilePath
    ? JSON.parse(readTextFile(resolvedRetrievalPolicyFilePath))
    : undefined;
  const resolvedSourceIntakeApprovalFilePath = sourceIntakeApprovalFilePath
    ? resolveInputPath(sourceIntakeApprovalFilePath)
    : undefined;
  if (sourceIntakeApprovalFilePath && !resolvedSourceIntakeApprovalFilePath) {
    throw new Error(`Missing source intake approval file: ${sourceIntakeApprovalFilePath}`);
  }
  const sourceIntakeApprovalFileArtifact = resolvedSourceIntakeApprovalFilePath
    ? JSON.parse(readTextFile(resolvedSourceIntakeApprovalFilePath))
    : undefined;
  const resolvedSourceClaimReviewFilePath = sourceClaimReviewFilePath
    ? resolveInputPath(sourceClaimReviewFilePath)
    : undefined;
  if (sourceClaimReviewFilePath && !resolvedSourceClaimReviewFilePath) {
    throw new Error(`Missing source claim review file: ${sourceClaimReviewFilePath}`);
  }
  const sourceClaimReviewFileArtifact = resolvedSourceClaimReviewFilePath
    ? JSON.parse(readTextFile(resolvedSourceClaimReviewFilePath))
    : undefined;
  const resolvedProviderConfigFilePath = providerConfigFilePath
    ? resolveInputPath(providerConfigFilePath)
    : undefined;
  const missingRealLocalProviderConfig = Boolean(
    providerConfigFilePath &&
    !resolvedProviderConfigFilePath &&
    /real\.local\.json$/i.test(providerConfigFilePath)
  );
  if (providerConfigFilePath && !resolvedProviderConfigFilePath && !missingRealLocalProviderConfig) {
    throw new Error(`Missing provider config file: ${providerConfigFilePath}`);
  }
  const providerConfigFileArtifact = resolvedProviderConfigFilePath
    ? JSON.parse(readTextFile(resolvedProviderConfigFilePath))
    : undefined;

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
  const buildSeedBriefAnalysis = buildBriefAnalysisFromSeed || researchCodexSemanticParseService.buildBriefAnalysisFromSeed;
  const buildCodexOutputSchema = buildCodexParseOutputSchemaArtifact || researchCodexSemanticParseService.buildCodexParseOutputSchemaArtifact;
  const buildCodexRequest = buildCodexParseRequestArtifact || researchCodexSemanticParseService.buildCodexParseRequestArtifact;
  const buildCodexRequestMd = buildCodexParseRequestMarkdown || researchCodexSemanticParseService.buildCodexParseRequestMarkdown;
  const buildProjectionSeed = buildProjectionStructuredBriefFromAnalysis || researchCodexSemanticParseService.buildProjectionStructuredBriefFromAnalysis;
  const normalizeCodexResult = normalizeCodexParseResult || researchCodexSemanticParseService.normalizeCodexParseResult;
  const structuredBriefSeedArtifact = buildStructuredBriefArtifact({
    ingestArtifact
  });
  const codexParseOutputSchemaArtifact = buildCodexOutputSchema({
    inputId
  });
  const codexParseRequestArtifact = buildCodexRequest({
    ingestArtifact,
    structuredBriefSeedArtifact
  });
  const codexParseRequestMarkdown = buildCodexRequestMd({
    codexParseRequestArtifact
  });
  const existingCodexParseResultPath = path.join(resolvedOutputDir, 'codex-parse-result.json');
  const codexParseResultArtifact = fs.existsSync(existingCodexParseResultPath)
    ? JSON.parse(readTextFile(existingCodexParseResultPath))
    : undefined;
  const briefAnalysisArtifact = codexParseResultArtifact
    ? normalizeCodexResult({
        ingestArtifact,
        codexParseResult: codexParseResultArtifact
      })
    : buildSeedBriefAnalysis({
        ingestArtifact,
        structuredBriefSeedArtifact
      });
  const structuredBriefArtifact = buildProjectionSeed({
    structuredBriefSeedArtifact,
    briefAnalysisArtifact
  });
  const sceneGrammarArtifact = buildSceneGrammarArtifact({
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    sourceModeArtifact,
    structuredBriefArtifact
  });
  const buildSemanticChoiceGraph = buildSemanticChoiceGraphArtifact ||
    researchSemanticChoiceGraphService.buildSemanticChoiceGraphArtifact;
  const semanticChoiceGraphArtifact = buildSemanticChoiceGraph({
    briefAnalysisArtifact,
    sceneGrammarArtifact
  });
  const researchGapArtifact = buildResearchGapArtifact({
    sceneGrammarArtifact
  });
  const researchQueryPlan = buildResearchQueryPlan({
    researchGapArtifact
  });
  const buildPolicy = buildRetrievalPolicyArtifact || researchRetrievalPolicyService.buildRetrievalPolicyArtifact;
  const buildBoundary = buildRetrievalRunBoundary || researchRetrievalCandidatesService.buildRetrievalRunBoundary;
  const readCache = readRetrievalCacheArtifact || researchRetrievalCacheService.readRetrievalCacheArtifact;
  const buildCacheManifest = buildRetrievalCacheManifest || researchRetrievalCacheService.buildRetrievalCacheManifest;
  const buildApproval = buildSourceIntakeApprovalArtifact || researchSourceIntakeApprovalService.buildSourceIntakeApprovalArtifact;
  const buildApprovedResults = buildApprovedSourceResultsArtifact || researchSourceIntakeApprovalService.buildApprovedSourceResultsArtifact;
  const buildSafety = buildRetrievalSafetyReport || researchSourceIntakeApprovalService.buildRetrievalSafetyReport;
  const buildEvidence = buildSourceEvidenceArtifact || researchSourceEvidenceService.buildSourceEvidenceArtifact;
  const buildClaimReview = buildSourceClaimReviewArtifact || researchSourceClaimReviewService.buildSourceClaimReviewArtifact;
  const buildApprovedResultsWeb = buildApprovedWebResearchResults || researchWebResearchService.buildApprovedWebResearchResults;
  const buildEmptyWebResults = buildEmptyWebResearchResults || researchWebResearchService.buildEmptyWebResearchResults;
  const buildLivePreflight = buildLiveRetrievalPreflight || researchLiveRetrievalService.buildLiveRetrievalPreflight;
  const runLiveCandidates = searchLiveCandidates || researchLiveRetrievalService.searchLiveCandidates;
  const buildProviderContract = buildLiveProviderContract || researchLiveProviderContractService.buildLiveProviderContract;
  const buildConfigApplied = buildProviderConfigApplied || researchProviderConfigService.buildProviderConfigApplied;
  const buildProviderPreflight = buildProviderPreflightReport || researchProviderPreflightService.buildProviderPreflightReport;
  const buildRequestShapes = buildProviderRequestShapes || researchProviderRequestShapesService.buildProviderRequestShapes;
  const buildProviderErrors = buildProviderErrorReport || researchProviderErrorsService.buildProviderErrorReport;
  const buildResponseLog = buildEmptyProviderResponseLog || researchProviderResponseLogService.buildEmptyProviderResponseLog;
  const buildPilotReport = buildLiveProviderPilotReport || researchLiveProviderPilotReportService.buildLiveProviderPilotReport;
  const buildInspection = buildCandidateInspectionArtifact || researchCandidateInspectionService.buildCandidateInspectionArtifact;
  const buildInspectionMarkdown = buildCandidateInspectionMarkdown || researchCandidateInspectionService.buildCandidateInspectionMarkdown;
  const buildRealProof = buildRealEndpointProofReport || researchRealEndpointProofService.buildRealEndpointProofReport;
  const buildTypingReport = buildSourceTypingReport || researchSourceTypingService.buildSourceTypingReport;
  const retrievalPolicyArtifact = buildPolicy({
    inputId,
    policyFile: retrievalPolicyFileArtifact,
    mode: webResearchMode,
    maxQueriesTotal,
    maxQueriesPerGap,
    maxResultsPerQuery,
    allowedSourceTypes,
    allowedDomains,
    blockedDomains,
    blockedSourceTypes,
    retrievalCacheDir,
    enableLiveRetrieval
  });
  const mockWebResearchResults = buildWebResearchResults({
    researchQueryPlan,
    researchGapArtifact,
    now: () => createdAt
  });
  const {
    cacheCandidatesArtifact,
    cacheHit,
    warnings: cacheWarnings
  } = readCache({
    cachePath: retrievalPolicyArtifact.mode === 'cache-replay'
      ? retrievalPolicyArtifact.cache.cacheDir
      : undefined,
    inputId
  });
  const liveRetrievalPreflightArtifact = buildLivePreflight({
    inputId,
    retrievalPolicyArtifact,
    enableLiveRetrieval,
    liveProvider,
    env: process.env
  });
  const liveProviderContractArtifact = buildProviderContract({
    inputId,
    defaultProvider: liveProvider || 'unavailable'
  });
  const {
    artifact: providerConfigAppliedArtifact,
    runtimeConfig: providerConfigRuntime
  } = buildConfigApplied({
    providerId: liveProvider || 'unavailable',
    providerConfigFile: providerConfigFileArtifact,
    providerConfigFilePath: resolvedProviderConfigFilePath,
    providerTimeoutMs,
    providerMaxRetries,
    env: process.env
  });
  const providerPreflightReportArtifact = buildProviderPreflight({
    inputId,
    providerId: liveProvider || 'unavailable',
    retrievalPolicyArtifact,
    liveRetrievalPreflightArtifact,
    liveProviderContractArtifact,
    providerConfigAppliedArtifact,
    env: process.env
  });
  if (missingRealLocalProviderConfig) {
    providerPreflightReportArtifact.checks.push({
      checkId: 'provider-config-present',
      passed: false,
      message: `Local provider config was not found: ${providerConfigFilePath}`
    });
    providerPreflightReportArtifact.status = 'blocked';
    providerPreflightReportArtifact.verdict = 'blocked';
    providerPreflightReportArtifact.networkAllowed = false;
  }
  const providerRequestShapesArtifact = buildRequestShapes({
    researchQueryPlan,
    retrievalPolicyArtifact,
    providerId: liveProvider || 'unavailable',
    providerPreflightReportArtifact
  });
  let providerErrorReportArtifact = buildProviderErrors({
    inputId,
    providerId: liveProvider || 'unavailable',
    providerPreflightReportArtifact
  });
  const {
    liveRetrievalRequestsArtifact,
    liveRetrievalCacheWriteArtifact,
    providerResponseLogArtifact = buildResponseLog({ inputId }),
    retrievalCandidatesArtifact: liveCandidatesArtifact
  } = runLiveCandidates({
    researchQueryPlan,
    retrievalPolicyArtifact,
    liveRetrievalPreflightArtifact,
    providerPreflightReportArtifact,
    providerRequestShapesArtifact,
    providerConfigRuntime,
    providerHttpClient,
    liveProvider,
    now: () => createdAt
  });
  providerErrorReportArtifact = buildProviderErrors({
    inputId,
    providerId: liveProvider || 'unavailable',
    providerPreflightReportArtifact,
    providerResponseLogArtifact
  });
  const {
    retrievalCandidatesArtifact,
    retrievalRunLogArtifact
  } = buildBoundary({
    researchQueryPlan,
    retrievalPolicyArtifact,
    mockWebResearchResults,
    cacheCandidatesArtifact,
    liveRetrievalPreflightArtifact,
    liveRetrievalRequestsArtifact,
    liveCandidatesArtifact,
    now: () => createdAt
  });
  const sourceTypingReportArtifact = buildTypingReport({
    inputId,
    retrievalCandidatesArtifact
  });
  const retrievalCacheManifestArtifact = buildCacheManifest({
    inputId,
    retrievalPolicyArtifact,
    cacheCandidatesArtifact: retrievalCandidatesArtifact,
    cacheHit,
    candidateCount: retrievalCandidatesArtifact.candidates.length,
    liveRetrievalCacheWriteArtifact,
    warnings: cacheWarnings,
    now: () => createdAt
  });
  const candidateInspectionArtifact = buildInspection({
    inputId,
    retrievalCandidatesArtifact,
    sourceTypingReportArtifact,
    retrievalCacheManifestArtifact
  });
  const sourceIntakeApprovalArtifact = buildApproval({
    inputId,
    approvalFile: sourceIntakeApprovalFileArtifact
  });
  const approvedSourceResultsArtifact = buildApprovedResults({
    retrievalCandidatesArtifact,
    sourceIntakeApprovalArtifact
  });
  const webResearchResults = retrievalPolicyArtifact.mode === 'mock'
    ? mockWebResearchResults
    : approvedSourceResultsArtifact.approvedResults.length > 0
      ? buildApprovedResultsWeb({
          approvedSourceResultsArtifact,
          retrievalCandidatesArtifact,
          researchGapArtifact,
          now: () => createdAt
        })
      : buildEmptyWebResults({
          inputId,
          adapterMode: 'off',
          now: () => createdAt
        });
  const sourceRegistryArtifact = buildSourceRegistryArtifact({
    ingestArtifact,
    webResearchResults
  });
  const sourceEvidenceArtifact = buildEvidence({
    sourceRegistryArtifact,
    webResearchResults,
    retrievalCandidatesArtifact,
    retrievalCacheManifestArtifact
  });
  const provisionalSourceClaimsArtifact = buildSourceClaimsArtifact({
    sourceRegistryArtifact,
    webResearchResults,
    researchGapArtifact,
    sourceEvidenceArtifact
  });
  const sourceClaimReviewArtifact = buildClaimReview({
    inputId,
    reviewFile: sourceClaimReviewFileArtifact,
    sourceClaimsArtifact: provisionalSourceClaimsArtifact
  });
  const sourceClaimsArtifact = buildSourceClaimsArtifact({
    sourceRegistryArtifact,
    webResearchResults,
    researchGapArtifact,
    sourceEvidenceArtifact,
    sourceClaimReviewArtifact
  });
  const retrievalSafetyReportArtifact = buildSafety({
    retrievalPolicyArtifact,
    retrievalCandidatesArtifact,
    approvedSourceResultsArtifact,
    sourceClaimsArtifact
  });
  const proposedGrammarRevisionArtifact = buildGrammarRevisionArtifact({
    structuredBriefArtifact,
    sceneGrammarArtifact,
    researchGapArtifact,
    webResearchResults,
    sourceClaimsArtifact
  });
  const {
    grammarRevisionArtifact,
    revisionStateAppliedArtifact
  } = applyRevisionStateFile({
    grammarRevisionArtifact: proposedGrammarRevisionArtifact,
    revisionStateFile: revisionStateArtifact,
    revisionStateFilePath: resolvedRevisionStateFilePath,
    sourceClaimsArtifact
  });
  const liveProviderPilotReportArtifact = buildPilotReport({
    inputId,
    providerId: liveProvider || 'unavailable',
    retrievalPolicyArtifact,
    providerPreflightReportArtifact,
    providerResponseLogArtifact,
    retrievalCandidatesArtifact,
    liveRetrievalCacheWriteArtifact,
    sourceClaimsArtifact,
    grammarRevisionArtifact
  });
  const realEndpointProofReportArtifact = buildRealProof({
    inputId,
    providerId: liveProvider || 'unavailable',
    configPath: providerConfigFilePath,
    configPresent: Boolean(resolvedProviderConfigFilePath),
    providerResponseLogArtifact,
    retrievalCandidatesArtifact,
    liveRetrievalCacheWriteArtifact,
    sourceClaimsArtifact,
    grammarRevisionArtifact,
    candidateInspectionArtifact
  });
  const {
    acceptedGrammarRevisionArtifact,
    rejectedGrammarRevisionArtifact
  } = splitGrammarRevisionArtifact({
    grammarRevisionArtifact
  });
  const {
    acceptedSceneGrammarArtifact,
    acceptedGrammarDeltasArtifact
  } = (applyAcceptedGrammarRevisionsWithDeltas || ((args) => ({
    acceptedSceneGrammarArtifact: applyAcceptedGrammarRevisions(args),
    acceptedGrammarDeltasArtifact: { inputId: args.sceneGrammarArtifact.inputId, deltas: [] }
  })))({
    sceneGrammarArtifact,
    sourceClaimsArtifact,
    sourceClaimReviewArtifact,
    requireReviewedCitations: retrievalPolicyArtifact.mode !== 'mock',
    grammarRevisionArtifact: applyAcceptedRevisions || revisionStateArtifact
      ? acceptedGrammarRevisionArtifact
      : acceptedGrammarRevisionArtifact
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
  const baseSceneGrammarPsg = buildSceneGrammarPsg({
    sceneGrammarArtifact,
    semanticChoiceGraphArtifact,
    now: () => createdAt
  });
  const baseBranchGraphPsgs = buildBranchSceneGrammarPsgs({
    sceneGrammarArtifact,
    now: () => createdAt
  });
  const acceptedSceneGrammarPsg = buildSceneGrammarPsg({
    sceneGrammarArtifact: acceptedSceneGrammarArtifact,
    semanticChoiceGraphArtifact,
    now: () => createdAt
  });
  const acceptedBranchGraphPsgs = buildBranchSceneGrammarPsgs({
    sceneGrammarArtifact: acceptedSceneGrammarArtifact,
    now: () => createdAt
  });
  const sceneGrammarPsg = compileGrammarTarget === 'accepted'
    ? acceptedSceneGrammarPsg
    : baseSceneGrammarPsg;
  const branchGraphPsgs = compileGrammarTarget === 'accepted'
    ? acceptedBranchGraphPsgs
    : baseBranchGraphPsgs;
  const psgCompileDiffArtifact = compareWeightedChoiceGraphs({
    inputId,
    baseGraphs: {
      'scene-grammar.psg': baseSceneGrammarPsg,
      ...Object.fromEntries(Object.entries(baseBranchGraphPsgs).map(([fileName, graph]) => [
        `branch-graphs/${fileName}`,
        graph
      ]))
    },
    acceptedGraphs: {
      'scene-grammar.psg': acceptedSceneGrammarPsg,
      ...Object.fromEntries(Object.entries(acceptedBranchGraphPsgs).map(([fileName, graph]) => [
        `branch-graphs/${fileName}`,
        graph
      ]))
    }
  });
  const revisionReviewArtifact = buildRevisionReviewArtifact({
    grammarRevisionArtifact,
    revisionStateAppliedArtifact,
    sourceClaimsArtifact,
    compileGrammarTarget,
    acceptedGrammarDeltasArtifact,
    psgCompileDiffArtifact
  });
  const operatorReviewArtifact = buildOperatorReviewArtifact({
    grammarRevisionArtifact,
    sourceClaimsArtifact,
    sourceRegistryArtifact,
    acceptedGrammarDeltasArtifact,
    sourceEvidenceArtifact,
    sourceClaimReviewArtifact
  });
  const liveRetrievalReadinessArtifact = buildLiveRetrievalReadinessArtifact({
    inputId
  });
  const researchPackageManifest = buildResearchPackageManifest({
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
    providerPreflightReportArtifact,
    providerConfigAppliedArtifact,
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
    structuredBriefSeedArtifact,
    structuredBriefArtifact,
    briefAnalysisArtifact,
    semanticChoiceGraphArtifact,
    codexParseRequestArtifact,
    codexParseOutputSchemaArtifact,
    codexParseResultArtifact,
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
    liveProviderContractArtifact,
    providerPreflightReportArtifact,
    providerConfigAppliedArtifact,
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
  writeJson(path.join(resolvedOutputDir, 'structured-brief.seed.json'), structuredBriefSeedArtifact);
  writeJson(path.join(resolvedOutputDir, 'structured-brief.json'), structuredBriefArtifact);
  writeJson(path.join(resolvedOutputDir, 'brief-analysis.json'), briefAnalysisArtifact);
  if (semanticChoiceGraphArtifact) {
    writeJson(path.join(resolvedOutputDir, 'semantic-choice-graph.json'), semanticChoiceGraphArtifact);
  }
  writeJson(path.join(resolvedOutputDir, 'codex-parse-request.json'), codexParseRequestArtifact);
  fs.writeFileSync(path.join(resolvedOutputDir, 'codex-parse-request.md'), codexParseRequestMarkdown, 'utf8');
  writeJson(path.join(resolvedOutputDir, 'codex-parse-output.schema.json'), codexParseOutputSchemaArtifact);
  if (codexParseResultArtifact) {
    writeJson(path.join(resolvedOutputDir, 'codex-parse-result.json'), codexParseResultArtifact);
  }
  writeJson(path.join(resolvedOutputDir, 'scene-grammar.json'), sceneGrammarArtifact);
  writeJson(path.join(resolvedOutputDir, 'research-gaps.json'), researchGapArtifact);
  writeJson(path.join(resolvedOutputDir, 'research-query-plan.json'), researchQueryPlan);
  writeJson(path.join(resolvedOutputDir, 'web-research-results.json'), webResearchResults);
  writeJson(path.join(resolvedOutputDir, 'live-provider-contract.json'), liveProviderContractArtifact);
  writeJson(path.join(resolvedOutputDir, 'provider-config.applied.json'), providerConfigAppliedArtifact);
  writeJson(path.join(resolvedOutputDir, 'provider-preflight-report.json'), providerPreflightReportArtifact);
  writeJson(path.join(resolvedOutputDir, 'provider-request-shapes.json'), providerRequestShapesArtifact);
  writeJson(path.join(resolvedOutputDir, 'provider-response-log.json'), providerResponseLogArtifact);
  writeJson(path.join(resolvedOutputDir, 'live-provider-pilot-report.json'), liveProviderPilotReportArtifact);
  writeJson(path.join(resolvedOutputDir, 'real-endpoint-proof-report.json'), realEndpointProofReportArtifact);
  writeJson(path.join(resolvedOutputDir, 'candidate-inspection.json'), candidateInspectionArtifact);
  fs.writeFileSync(path.join(resolvedOutputDir, 'candidate-inspection.md'), buildInspectionMarkdown(candidateInspectionArtifact), 'utf8');
  writeJson(path.join(resolvedOutputDir, 'source-typing-report.json'), sourceTypingReportArtifact);
  writeJson(path.join(resolvedOutputDir, 'provider-error-report.json'), providerErrorReportArtifact);
  writeJson(path.join(resolvedOutputDir, 'live-retrieval-preflight.json'), liveRetrievalPreflightArtifact);
  writeJson(path.join(resolvedOutputDir, 'live-retrieval-requests.json'), liveRetrievalRequestsArtifact);
  writeJson(path.join(resolvedOutputDir, 'live-retrieval-cache-write.json'), liveRetrievalCacheWriteArtifact);
  writeJson(path.join(resolvedOutputDir, 'retrieval-policy.json'), retrievalPolicyArtifact);
  writeJson(path.join(resolvedOutputDir, 'retrieval-run-log.json'), retrievalRunLogArtifact);
  writeJson(path.join(resolvedOutputDir, 'retrieval-candidates.json'), retrievalCandidatesArtifact);
  writeJson(path.join(resolvedOutputDir, 'retrieval-cache-manifest.json'), retrievalCacheManifestArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-intake-approval.json'), sourceIntakeApprovalArtifact);
  writeJson(path.join(resolvedOutputDir, 'approved-source-results.json'), approvedSourceResultsArtifact);
  writeJson(path.join(resolvedOutputDir, 'retrieval-safety-report.json'), retrievalSafetyReportArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-registry.json'), sourceRegistryArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-evidence.json'), sourceEvidenceArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-claim-review.json'), sourceClaimReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-claims.json'), sourceClaimsArtifact);
  writeJson(path.join(resolvedOutputDir, 'grammar-revisions.json'), grammarRevisionArtifact);
  writeJson(path.join(resolvedOutputDir, 'accepted-grammar-revisions.json'), acceptedGrammarRevisionArtifact);
  writeJson(path.join(resolvedOutputDir, 'rejected-grammar-revisions.json'), rejectedGrammarRevisionArtifact);
  if (revisionStateArtifact) {
    writeJson(path.join(resolvedOutputDir, 'revision-state.json'), revisionStateArtifact);
  }
  writeJson(path.join(resolvedOutputDir, 'revision-state.applied.json'), revisionStateAppliedArtifact);
  writeJson(path.join(resolvedOutputDir, 'revision-review.json'), revisionReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'accepted-grammar-deltas.json'), acceptedGrammarDeltasArtifact);
  writeJson(path.join(resolvedOutputDir, 'operator-review.json'), operatorReviewArtifact);
  fs.writeFileSync(path.join(resolvedOutputDir, 'operator-review.md'), buildOperatorReviewMarkdown(operatorReviewArtifact), 'utf8');
  writeJson(path.join(resolvedOutputDir, 'psg-compile-diff.json'), psgCompileDiffArtifact);
  writeJson(path.join(resolvedOutputDir, 'live-retrieval-readiness.json'), liveRetrievalReadinessArtifact);
  writeJson(path.join(resolvedOutputDir, 'accepted-scene-grammar.json'), acceptedSceneGrammarArtifact);
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
    structuredBriefSeedArtifact,
    structuredBriefArtifact,
    briefAnalysisArtifact,
    semanticChoiceGraphArtifact,
    codexParseRequestArtifact,
    codexParseOutputSchemaArtifact,
    codexParseResultArtifact,
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

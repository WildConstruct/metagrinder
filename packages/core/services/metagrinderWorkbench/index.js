const fs = require('fs');
const path = require('path');

const researchCodexSemanticParseService = require('../researchCodexSemanticParse/index.js');

const OPERATOR_STATE_FILES = Object.freeze([
  'source-intake-approval.json',
  'source-claim-review.json',
  'revision-state.json',
  'retrieval-policy.json'
]);

const KNOWN_ARTIFACT_FILES = Object.freeze([
  'research-package.json',
  'structured-brief.seed.json',
  'structured-brief.json',
  'brief-analysis.json',
  'semantic-choice-graph.json',
  'psg-output-flight.json',
  'psg-readability-review.json',
  'codex-sweeten-request.md',
  'codex-sweeten-request.json',
  'codex-sweeten-result.json',
  'codex-sweeten-run-log.json',
  'codex-sweeten-run-status.json',
  'codex-parse-request.md',
  'codex-parse-request.json',
  'codex-parse-output.schema.json',
  'codex-parse-result.json',
  'codex-run-log.json',
  'codex-run-status.json',
  'scene-grammar.json',
  'accepted-scene-grammar.json',
  'retrieval-policy.json',
  'retrieval-candidates.json',
  'candidate-inspection.json',
  'source-intake-approval.json',
  'approved-source-results.json',
  'source-registry.json',
  'source-evidence.json',
  'source-claims.json',
  'source-claim-review.json',
  'grammar-revisions.json',
  'revision-state.json',
  'revision-state.applied.json',
  'revision-review.json',
  'accepted-grammar-deltas.json',
  'psg-compile-diff.json',
  'retrieval-safety-report.json',
  'source-typing-report.json'
]);

function slugify(value) {
  return String(value || 'metagrinder-run')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'metagrinder-run';
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveOutputRoot(outputRoot = path.join('tmp', 'metagrinder-workbench-runs')) {
  return path.resolve(outputRoot);
}

function preparePastedArticleRun({
  articleText,
  title,
  outputRoot = path.join('tmp', 'metagrinder-workbench-runs'),
  now = new Date()
}) {
  if (!articleText || typeof articleText !== 'string' || articleText.trim().length === 0) {
    throw new Error('Paste article text before parsing.');
  }
  const resolvedOutputRoot = resolveOutputRoot(outputRoot);
  const runTitle = title && title.trim() ? title.trim() : 'Metagrinder Workbench Run';
  const outputDir = path.join(resolvedOutputRoot, `${slugify(runTitle)}-${timestampForPath(now)}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const inputPath = path.join(outputDir, 'source-input.txt');
  fs.writeFileSync(inputPath, `${articleText.trim()}\n`, 'utf8');
  return {
    title: runTitle,
    outputRoot: resolvedOutputRoot,
    outputDir,
    inputPath
  };
}
function sanitizeFileName(value, fallback = 'input') {
  return `${slugify(value || fallback) || fallback}.txt`;
}

function prepareResearchInputRun({
  inputs,
  articleText,
  title,
  outputRoot = path.join('tmp', 'metagrinder-workbench-runs'),
  now = new Date()
}) {
  const normalizedInputs = Array.isArray(inputs) && inputs.length > 0
    ? inputs
    : [{ kind: 'paste', title: 'source-input', text: articleText }];
  const usableInputs = normalizedInputs.filter((input) => {
    if (!input || typeof input !== 'object') return false;
    if (input.kind === 'file') return typeof input.path === 'string' && input.path.trim().length > 0;
    return typeof input.text === 'string' && input.text.trim().length > 0;
  });
  if (usableInputs.length === 0) {
    throw new Error('Add at least one pasted text input or source file before running Metagrinder.');
  }

  const resolvedOutputRoot = resolveOutputRoot(outputRoot);
  const runTitle = title && title.trim() ? title.trim() : 'Metagrinder Workbench Run';
  const outputDir = path.join(resolvedOutputRoot, `${slugify(runTitle)}-${timestampForPath(now)}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const inputPaths = usableInputs.map((input, index) => {
    const sequence = String(index + 1).padStart(2, '0');
    if (input.kind === 'file') {
      const sourcePath = path.resolve(input.path);
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
        throw new Error(`Source input file does not exist: ${sourcePath}`);
      }
      const extension = path.extname(sourcePath) || '.txt';
      const baseName = slugify(path.basename(sourcePath, extension)) || `input-${sequence}`;
      const targetPath = path.join(outputDir, `${sequence}-${baseName}${extension}`);
      fs.copyFileSync(sourcePath, targetPath);
      return targetPath;
    }
    const inputTitle = input.title && input.title.trim() ? input.title.trim() : `pasted-input-${sequence}`;
    const targetPath = path.join(outputDir, `${sequence}-${sanitizeFileName(inputTitle)}`);
    fs.writeFileSync(targetPath, `${input.text.trim()}\n`, 'utf8');
    return targetPath;
  });

  return {
    title: runTitle,
    outputRoot: resolvedOutputRoot,
    outputDir,
    inputPath: inputPaths[0],
    inputPaths
  };
}
function resolveOutputDir(outputDir) {
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('outputDir is required.');
  }
  const resolvedOutputDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedOutputDir)) {
    throw new Error(`Metagrinder output folder does not exist: ${resolvedOutputDir}`);
  }
  const stat = fs.statSync(resolvedOutputDir);
  if (!stat.isDirectory()) {
    throw new Error(`Metagrinder output path must be a directory: ${resolvedOutputDir}`);
  }
  return resolvedOutputDir;
}

function resolveArtifactPath(outputDir, artifactPath) {
  if (!artifactPath || typeof artifactPath !== 'string') {
    throw new Error('artifactPath is required.');
  }
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const normalizedArtifactPath = artifactPath.replace(/\\/g, '/');
  if (
    path.isAbsolute(normalizedArtifactPath) ||
    normalizedArtifactPath.split('/').some((part) => part === '..')
  ) {
    throw new Error(`Artifact path must stay inside the output folder: ${artifactPath}`);
  }
  const resolvedArtifactPath = path.resolve(resolvedOutputDir, normalizedArtifactPath);
  const relative = path.relative(resolvedOutputDir, resolvedArtifactPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Artifact path escapes the output folder: ${artifactPath}`);
  }
  return resolvedArtifactPath;
}

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function codexTimeoutMs() {
  const configured = Number(process.env.METAGRINDER_CODEX_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 600000;
}

function normalizeCodexRunStatus(status, now = new Date()) {
  if (!status || status.status !== 'running' || status.completedAt || !status.startedAt) {
    return status || null;
  }
  const startedAt = Date.parse(status.startedAt);
  if (!Number.isFinite(startedAt)) {
    return status;
  }
  if (now.getTime() - startedAt <= codexTimeoutMs()) {
    return status;
  }
  return {
    ...status,
    status: 'stale',
    message: 'Previous Codex semantic parse exceeded the runner timeout without writing a completion log.',
    warnings: [
      ...(status.warnings || []),
      'Stale status inferred while loading the Workbench folder.'
    ]
  };
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readIngestArtifact(outputDir) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  return readJsonIfPresent(path.join(resolvedOutputDir, 'ingest.json'));
}

function inferSourceInputPaths(outputDir) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const ingestArtifact = readIngestArtifact(resolvedOutputDir);
  const sourceInputPaths = (ingestArtifact?.sourceInputs || [])
    .map((source) => source.path)
    .filter((sourcePath) => typeof sourcePath === 'string' && sourcePath.trim().length > 0)
    .map((sourcePath) => path.resolve(sourcePath));
  const existingPaths = sourceInputPaths.filter((sourcePath) =>
    fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()
  );
  if (existingPaths.length > 0) {
    return existingPaths;
  }
  const fallbackInputs = fs.readdirSync(resolvedOutputDir)
    .filter((fileName) => /^\d{2}-.+\.txt$/i.test(fileName) || fileName === 'source-input.txt')
    .sort()
    .map((fileName) => path.join(resolvedOutputDir, fileName));
  if (fallbackInputs.length > 0) {
    return fallbackInputs;
  }
  throw new Error('Could not infer source input files for this Workbench run.');
}

function readBriefAnalysisMode(outputDir) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const briefAnalysis = readJsonIfPresent(path.join(resolvedOutputDir, 'brief-analysis.json'));
  return briefAnalysis?.analysisMode || 'missing';
}

function listRecentWorkbenchRuns({
  root = path.join('tmp', 'metagrinder-workbench-runs'),
  limit = 20
} = {}) {
  const resolvedRoot = resolveOutputRoot(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    return {
      root: resolvedRoot,
      runs: []
    };
  }
  const maxRuns = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(100, Number(limit))
    : 20;
  const runs = fs.readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const outputDir = path.join(resolvedRoot, entry.name);
      const packagePath = path.join(outputDir, 'research-package.json');
      if (!fs.existsSync(packagePath)) return null;
      const researchPackage = readJsonIfPresent(packagePath);
      const briefAnalysis = readJsonIfPresent(path.join(outputDir, 'brief-analysis.json'));
      const codexStatus = normalizeCodexRunStatus(readJsonIfPresent(path.join(outputDir, 'codex-run-status.json')));
      const stat = fs.statSync(outputDir);
      return {
        outputDir,
        folderName: entry.name,
        title: researchPackage?.title || entry.name,
        lastModifiedAt: stat.mtime.toISOString(),
        packagePresent: true,
        analysisMode: briefAnalysis?.analysisMode || 'missing',
        codexParseResultPresent: fs.existsSync(path.join(outputDir, 'codex-parse-result.json')),
        codexRunStatus: codexStatus?.status || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.lastModifiedAt) - Date.parse(a.lastModifiedAt))
    .slice(0, maxRuns);
  return {
    root: resolvedRoot,
    runs
  };
}

function readArtifact({ outputDir, artifactPath }) {
  const filePath = resolveArtifactPath(outputDir, artifactPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact does not exist: ${artifactPath}`);
  }
  return {
    path: artifactPath.replace(/\\/g, '/'),
    contentType: artifactPath.endsWith('.json') || artifactPath.endsWith('.psg')
      ? 'application/json'
      : 'text/plain',
    text: fs.readFileSync(filePath, 'utf8')
  };
}

function listBranchGraphArtifacts(outputDir) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const branchGraphDir = path.join(resolvedOutputDir, 'branch-graphs');
  if (!fs.existsSync(branchGraphDir)) {
    return [];
  }
  return fs.readdirSync(branchGraphDir)
    .filter((fileName) => fileName.endsWith('.psg'))
    .sort()
    .map((fileName) => ({
      id: `branch-graph-${fileName}`,
      type: 'branch-graph',
      path: `branch-graphs/${fileName}`,
      present: true
    }));
}

function summarizeCollection(outputDir, collection) {
  const artifactPath = collection.path;
  const filePath = resolveArtifactPath(outputDir, artifactPath);
  return {
    ...collection,
    present: fs.existsSync(filePath),
    bytes: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
    writableState: OPERATOR_STATE_FILES.includes(artifactPath)
  };
}

function buildDefaultStateDraft({ fileName, inputId = 'metagrinder-output', artifacts = {} }) {
  if (!OPERATOR_STATE_FILES.includes(fileName)) {
    throw new Error(`Unsupported operator state file: ${fileName}`);
  }

  if (fileName === 'source-intake-approval.json') {
    const candidates = artifacts['retrieval-candidates.json']?.candidates || [];
    return {
      inputId,
      approvals: candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        approvalStatus: 'pending',
        operatorNote: '',
        approvedSourceType: candidate.sourceTypeHypothesis || 'unknown',
        approvedSourceQuality: candidate.sourceQualityHypothesis || 'low',
        reviewedBy: 'local-operator',
        reviewedAt: new Date().toISOString()
      }))
    };
  }

  if (fileName === 'source-claim-review.json') {
    const claims = artifacts['source-claims.json']?.claims || [];
    return {
      inputId,
      claimReviews: claims.map((claim) => ({
        sourceClaimId: claim.sourceClaimId,
        evidenceIds: claim.evidenceIds || [],
        citationStatus: 'needs_review',
        reviewedBy: 'local-operator',
        reviewedAt: new Date().toISOString(),
        operatorNote: '',
        riskFlags: []
      }))
    };
  }

  if (fileName === 'revision-state.json') {
    const revisions = artifacts['grammar-revisions.json']?.revisions || [];
    return {
      inputId,
      revisionStates: revisions.map((revision) => ({
        revisionId: revision.revisionId,
        reviewStatus: 'needs_review',
        operatorNote: '',
        reviewedBy: 'local-operator',
        reviewedAt: new Date().toISOString()
      }))
    };
  }

  const existingPolicy = artifacts['retrieval-policy.json'];
  return existingPolicy || {
    inputId,
    mode: 'mock',
    maxQueriesTotal: 10,
    maxQueriesPerGap: 2,
    maxResultsPerQuery: 5,
    allowedSourceTypes: [
      'archive',
      'museum',
      'library',
      'scholarly',
      'newspaper',
      'high-quality-secondary'
    ],
    blockedDomains: [],
    allowedDomains: [],
    requireOperatorApprovalForSourceClaims: true,
    allowLowQualitySources: false,
    cache: {
      enabled: true,
      readFromCache: true,
      writeToCache: true,
      cacheDir: 'tmp/metagrinder-retrieval-cache'
    }
  };
}

function loadWorkbenchFolder(outputDir) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const packagePath = path.join(resolvedOutputDir, 'research-package.json');
  const researchPackage = readJsonIfPresent(packagePath);
  const inputId = researchPackage?.sourceInputs?.[0] || researchPackage?.sourceInputIds?.[0] || 'metagrinder-output';
  const artifacts = {};

  KNOWN_ARTIFACT_FILES.forEach((fileName) => {
    artifacts[fileName] = fileName.endsWith('.json') || fileName.endsWith('.psg')
      ? readJsonIfPresent(path.join(resolvedOutputDir, fileName))
      : null;
  });

  const packageCollections = Array.isArray(researchPackage?.collections)
    ? researchPackage.collections
    : [];
  const knownCollections = KNOWN_ARTIFACT_FILES.map((fileName) => ({
    id: `known-${fileName}`,
    type: fileName.replace(/\.json$/, ''),
    path: fileName
  }));
  const collectionByPath = new Map();
  [...packageCollections, ...knownCollections].forEach((collection) => {
    if (collection?.path && !collectionByPath.has(collection.path)) {
      collectionByPath.set(collection.path, collection);
    }
  });

  listBranchGraphArtifacts(resolvedOutputDir).forEach((collection) => {
    if (!collectionByPath.has(collection.path)) {
      collectionByPath.set(collection.path, collection);
    }
  });

  const collections = [...collectionByPath.values()]
    .map((collection) => summarizeCollection(resolvedOutputDir, collection));

  return {
    outputDir: resolvedOutputDir,
    inputId,
    title: researchPackage?.title || path.basename(resolvedOutputDir),
    packagePresent: Boolean(researchPackage),
    researchPackage,
    collections,
    artifacts,
    operatorStateFiles: OPERATOR_STATE_FILES,
    stateDrafts: Object.fromEntries(
      OPERATOR_STATE_FILES.map((fileName) => [
        fileName,
        buildDefaultStateDraft({ fileName, inputId, artifacts })
      ])
    ),
    semanticStatus: {
      analysisMode: artifacts['brief-analysis.json']?.analysisMode || 'missing',
      codexParseResultPresent: Boolean(artifacts['codex-parse-result.json']),
      codexRunStatus: normalizeCodexRunStatus(artifacts['codex-run-status.json'])
    },
    readabilityStatus: {
      status: artifacts['psg-readability-review.json']?.readabilityStatus ||
        (artifacts['semantic-choice-graph.json'] && artifacts['scene-grammar.psg'] ? 'flight-ready' : 'missing'),
      flightPresent: Boolean(artifacts['psg-output-flight.json']),
      reviewPresent: Boolean(artifacts['psg-readability-review.json']),
      sweetenResultPresent: Boolean(artifacts['codex-sweeten-result.json']),
      sweetenRunStatus: artifacts['codex-sweeten-run-status.json'] || null,
      findingCount: artifacts['psg-readability-review.json']?.findings?.length || 0,
      appliedRewriteCount: artifacts['psg-readability-review.json']?.appliedRewriteCount || 0
    }
  };
}

function writeOperatorStateFile({ outputDir, fileName, data }) {
  if (!OPERATOR_STATE_FILES.includes(fileName)) {
    throw new Error(`Workbench may only write operator state files: ${fileName}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Operator state data must be a JSON object.');
  }
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const targetPath = path.join(resolvedOutputDir, fileName);
  fs.writeFileSync(targetPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return {
    fileName,
    path: targetPath,
    bytes: fs.statSync(targetPath).size
  };
}

function writeCodexParseResultFile({ outputDir, data }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Codex parse result must be a JSON object.');
  }
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const ingestArtifact = readIngestArtifact(resolvedOutputDir);
  if (ingestArtifact) {
    researchCodexSemanticParseService.normalizeCodexParseResult({
      ingestArtifact,
      codexParseResult: data
    });
  }
  const targetPath = path.join(resolvedOutputDir, 'codex-parse-result.json');
  writeJsonFile(targetPath, data);
  return {
    fileName: 'codex-parse-result.json',
    path: targetPath,
    bytes: fs.statSync(targetPath).size
  };
}

function writeCodexRunStatusFile({ outputDir, status }) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const targetPath = path.join(resolvedOutputDir, 'codex-run-status.json');
  writeJsonFile(targetPath, status);
  return {
    fileName: 'codex-run-status.json',
    path: targetPath,
    bytes: fs.statSync(targetPath).size
  };
}

function writeCodexRunLogFile({ outputDir, log }) {
  const resolvedOutputDir = resolveOutputDir(outputDir);
  const targetPath = path.join(resolvedOutputDir, 'codex-run-log.json');
  writeJsonFile(targetPath, log);
  return {
    fileName: 'codex-run-log.json',
    path: targetPath,
    bytes: fs.statSync(targetPath).size
  };
}

module.exports = {
  KNOWN_ARTIFACT_FILES,
  OPERATOR_STATE_FILES,
  buildDefaultStateDraft,
  prepareResearchInputRun,
  preparePastedArticleRun,
  listBranchGraphArtifacts,
  listRecentWorkbenchRuns,
  loadWorkbenchFolder,
  inferSourceInputPaths,
  readArtifact,
  readBriefAnalysisMode,
  normalizeCodexRunStatus,
  resolveArtifactPath,
  resolveOutputDir,
  resolveOutputRoot,
  sanitizeFileName,
  slugify,
  writeCodexParseResultFile,
  writeCodexRunLogFile,
  writeCodexRunStatusFile,
  writeOperatorStateFile
};

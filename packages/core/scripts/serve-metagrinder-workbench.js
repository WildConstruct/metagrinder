const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  MetagrinderCodexSweetenRequestArtifactSchema,
  MetagrinderCodexSweetenResultArtifactSchema,
  MetagrinderPsgOutputFlightArtifactSchema,
  MetagrinderPsgReadabilityReviewArtifactSchema,
  MetagrinderSemanticChoiceGraphArtifactSchema
} = require('../types/metagrinder.runtime.js');
const {
  buildPsgOutputFlightArtifact
} = require('../services/researchPsgOutputFlight/index.js');
const {
  buildCodexSweetenRequestArtifact,
  buildCodexSweetenRequestMarkdown,
  buildPsgReadabilityReviewArtifact
} = require('../services/researchPsgReadabilityReview/index.js');
const {
  applySweetenRewrites,
  validateSweetenResult
} = require('../services/researchCodexPsgSweeten/index.js');
const {
  buildSceneGrammarPsg
} = require('../services/researchPsgCompiler/index.js');

const {
  loadWorkbenchFolder,
  prepareResearchInputRun,
  preparePastedArticleRun,
  listRecentWorkbenchRuns,
  readArtifact,
  inferSourceInputPaths,
  readBriefAnalysisMode,
  writeCodexParseResultFile,
  writeCodexRunLogFile,
  writeCodexRunStatusFile,
  writeOperatorStateFile
} = require('../services/metagrinderWorkbench/index.js');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const STATIC_ROOT = path.resolve(__dirname, '../workbench');
const AUDIT_DEPS_NODE_PATH = 'C:\\tmp\\metagrinder-audit-deps\\node_modules';
const PROTECTED_CODEX_ARTIFACTS = Object.freeze([
  'accepted-scene-grammar.json',
  'accepted-grammar-deltas.json',
  'source-claims.json',
  'grammar-revisions.json',
  'revision-state.json',
  'revision-state.applied.json'
]);

function parseArgs(argv) {
  const portIndex = argv.indexOf('--port');
  const port = portIndex >= 0 ? Number(argv[portIndex + 1]) : Number(process.env.PORT || 5174);
  return {
    port: Number.isFinite(port) ? port : 5174
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(response, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(text);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      if (!rawBody) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error(`Request body must be JSON: ${error.message}`));
      }
    });
    request.on('error', reject);
  });
}

function safeStaticPath(urlPath) {
  const requestedPath = urlPath === '/' ? '/index.html' : urlPath;
  const resolvedPath = path.resolve(STATIC_ROOT, `.${requestedPath}`);
  const relative = path.relative(STATIC_ROOT, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Static path escapes the Workbench root.');
  }
  return resolvedPath;
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function listBrowseRoots() {
  if (process.platform === 'win32') {
    const roots = [];
    for (let code = 67; code <= 90; code += 1) {
      const drive = `${String.fromCharCode(code)}:\\`;
      if (fs.existsSync(drive)) {
        roots.push({ name: drive, path: drive, kind: 'folder' });
      }
    }
    return roots;
  }
  return [{ name: '/', path: '/', kind: 'folder' }];
}

function listBrowsePath({ browsePath, kind = 'folder' }) {
  const requestedPath = browsePath && browsePath.trim() ? path.resolve(browsePath) : null;
  if (!requestedPath) {
    return {
      currentPath: null,
      parentPath: null,
      entries: listBrowseRoots()
    };
  }
  if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isDirectory()) {
    throw new Error(`Browse path must be an existing folder: ${requestedPath}`);
  }
  const entries = fs.readdirSync(requestedPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => ({
      name: entry.name,
      path: path.join(requestedPath, entry.name),
      kind: entry.isDirectory() ? 'folder' : 'file'
    }))
    .filter((entry) => entry.kind === 'folder' || kind === 'file')
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  const parentPath = path.dirname(requestedPath);
  return {
    currentPath: requestedPath,
    parentPath: parentPath === requestedPath ? null : parentPath,
    entries
  };
}
function runPipeline({ inputPath, inputPaths, outputDir, title, stateFiles = {}, compileGrammar = 'accepted' }) {
  const resolvedInputPaths = Array.isArray(inputPaths) && inputPaths.length > 0
    ? inputPaths
    : [inputPath].filter(Boolean);
  if (resolvedInputPaths.length === 0 || !outputDir) {
    throw new Error('inputPath/inputPaths and outputDir are required to rerun Metagrinder.');
  }
  const args = [
    path.join('packages', 'core', 'scripts', 'run-metagrinder-mvp.js'),
    ...resolvedInputPaths,
    '--output-dir',
    outputDir,
    '--title',
    title || 'Metagrinder Workbench Run',
    '--compile-grammar',
    compileGrammar
  ];

  if (stateFiles.revisionStateFile) {
    args.push('--revision-state-file', stateFiles.revisionStateFile, '--apply-accepted-revisions');
  }
  if (stateFiles.sourceIntakeApprovalFile) {
    args.push('--source-intake-approval-file', stateFiles.sourceIntakeApprovalFile);
  }
  if (stateFiles.sourceClaimReviewFile) {
    args.push('--source-claim-review-file', stateFiles.sourceClaimReviewFile);
  }
  if (stateFiles.retrievalPolicyFile) {
    args.push('--retrieval-policy-file', stateFiles.retrievalPolicyFile);
  }

  const childEnv = { ...process.env };
  if (!childEnv.NODE_PATH && fs.existsSync(AUDIT_DEPS_NODE_PATH)) {
    childEnv.NODE_PATH = AUDIT_DEPS_NODE_PATH;
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: childEnv,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr, args });
    });
  });
}

function readJsonFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJsonFileSafely(filePath) {
  if (!fs.existsSync(filePath)) {
    return { data: null, error: null };
  }
  try {
    return { data: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

function readTextFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function snapshotProtectedArtifacts(outputDir) {
  return Object.fromEntries(PROTECTED_CODEX_ARTIFACTS.map((fileName) => {
    const filePath = path.join(outputDir, fileName);
    return [fileName, fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null];
  }));
}

function restoreProtectedArtifacts(outputDir, snapshot) {
  const changed = [];
  Object.entries(snapshot).forEach(([fileName, before]) => {
    const filePath = path.join(outputDir, fileName);
    const after = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (after === before) return;
    changed.push(fileName);
    if (before === null) {
      fs.rmSync(filePath, { force: true });
      return;
    }
    fs.writeFileSync(filePath, before, 'utf8');
  });
  return changed;
}

function parseCommandArgs(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
  } catch {
    // Fall through to a conservative whitespace split for simple local config.
  }
  return String(value).split(/\s+/).filter(Boolean);
}

function defaultCodexCommand() {
  return process.env.METAGRINDER_CODEX_COMMAND || (process.platform === 'win32' ? 'codex.cmd' : 'codex');
}

function defaultCodexArgs(outputDir) {
  const configuredArgs = parseCommandArgs(process.env.METAGRINDER_CODEX_ARGS);
  if (configuredArgs) return configuredArgs;
  return [
    'exec',
    '-m',
    defaultCodexModel(),
    '--skip-git-repo-check',
    '-C',
    outputDir,
    '--sandbox',
    'read-only',
    '--output-schema',
    codexRunnerOutputSchemaPath(outputDir),
    '-o',
    path.join(outputDir, 'codex-last-message.txt'),
    '-'
  ];
}

function defaultCodexSweetenArgs(outputDir) {
  const configuredArgs = parseCommandArgs(process.env.METAGRINDER_CODEX_SWEETEN_ARGS);
  if (configuredArgs) return configuredArgs;
  return [
    'exec',
    '-m',
    defaultCodexModel(),
    '--skip-git-repo-check',
    '-C',
    outputDir,
    '--sandbox',
    'read-only',
    '--output-schema',
    codexSweetenOutputSchemaPath(outputDir),
    '-o',
    path.join(outputDir, 'codex-sweeten-last-message.txt'),
    '-'
  ];
}

function defaultCodexModel() {
  return process.env.METAGRINDER_CODEX_MODEL || 'gpt-5.2';
}

function defaultCodexTimeoutMs() {
  const configured = Number(process.env.METAGRINDER_CODEX_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 600000;
}

function codexSpawnOptions({ cwd, env }) {
  return {
    cwd,
    env,
    windowsHide: true
  };
}

function appendOutput(existing, message) {
  return `${existing || ''}${existing ? '\n' : ''}${message}`;
}

function quoteWindowsCommandArg(value) {
  const raw = String(value);
  if (raw.length === 0) return '""';
  if (!/[\s"&()<>^|]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function commandBasename(value) {
  return path.basename(String(value || '')).toLowerCase();
}

function isCodexShimCommand(command) {
  return ['codex', 'codex.cmd', 'codex.ps1'].includes(commandBasename(command));
}

function findWindowsCodexEntrypoint(command) {
  const candidates = [];
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  }
  if (command && /[\\/]/.test(command)) {
    candidates.push(path.join(path.dirname(command), 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  }
  (process.env.PATH || '').split(path.delimiter).forEach((entry) => {
    if (!entry) return;
    candidates.push(path.join(entry, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'));
  });
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function codexSpawnInvocation({ command, args }) {
  if (process.platform !== 'win32') {
    return { command, args };
  }
  if (isCodexShimCommand(command)) {
    const codexEntrypoint = findWindowsCodexEntrypoint(command);
    if (codexEntrypoint) {
      return {
        command: process.execPath,
        args: [codexEntrypoint, ...(args || [])]
      };
    }
  }
  const commandLine = [command, ...(args || [])]
    .map(quoteWindowsCommandArg)
    .join(' ');
  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', commandLine]
  };
}

function codexRunnerOutputSchemaPath(outputDir) {
  return path.join(outputDir, 'codex-parse-result.schema.json');
}

function codexSweetenOutputSchemaPath(outputDir) {
  return path.join(outputDir, 'codex-sweeten-result.schema.json');
}

function strictObjectSchema(properties) {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}

function stringArraySchema() {
  return { type: 'array', items: { type: 'string' } };
}

function stringEnumSchema(values) {
  return { type: 'string', enum: values };
}

function provenanceSchema(extraProperties = {}) {
  return strictObjectSchema({
    sourceInputIds: stringArraySchema(),
    sourceChunkIds: stringArraySchema(),
    excerptText: { type: 'string' },
    attributionMode: stringEnumSchema(['quoted', 'paraphrased', 'inferred', 'web-retrieved']),
    confidence: stringEnumSchema(['low', 'medium', 'high']),
    validationStatus: stringEnumSchema(['supported', 'weak', 'contradicted', 'needs_review', 'seed_unverified', 'ignored']),
    ...extraProperties
  });
}

function buildStrictCodexParseResultJsonSchema() {
  const graphNodeSchema = strictObjectSchema({
    nodeId: { type: 'string' },
    label: { type: 'string' },
    nodeType: { type: 'string' },
    sourceRecordIds: stringArraySchema(),
    reviewStatus: { type: 'string' }
  });
  const graphEdgeSchema = strictObjectSchema({
    edgeId: { type: 'string' },
    source: { type: 'string' },
    target: { type: 'string' },
    relation: { type: 'string' }
  });
  const graphAssemblyPlanSchema = strictObjectSchema({
    readiness: stringEnumSchema(['ready', 'needs_codex_review', 'not_ready']),
    nodes: { type: 'array', items: graphNodeSchema },
    edges: { type: 'array', items: graphEdgeSchema },
    notes: stringArraySchema()
  });
  const effectSchema = strictObjectSchema({
    action: { type: 'string' },
    target: { type: 'string' }
  });
  return strictObjectSchema({
    inputId: { type: 'string' },
    analysisMode: { type: 'string', const: 'codex-semantic' },
    sourceInputIds: stringArraySchema(),
    mainSubject: provenanceSchema({
      subjectId: { type: 'string' },
      label: { type: 'string' },
      subjectType: { type: 'string' },
      summary: { type: 'string' }
    }),
    subjectType: { type: 'string' },
    subcategoryCandidates: {
      type: 'array',
      items: provenanceSchema({
        subcategoryId: { type: 'string' },
        label: { type: 'string' },
        parentSubjectId: { type: 'string' },
        supportStatus: stringEnumSchema(['supported', 'weak', 'contradicted', 'inferred']),
        evidenceSummary: { type: 'string' }
      })
    },
    subcategoryEvidenceChecks: {
      type: 'array',
      items: provenanceSchema({
        checkId: { type: 'string' },
        subcategoryId: { type: 'string' },
        supportStatus: stringEnumSchema(['supported', 'weak', 'contradicted', 'inferred']),
        supportingExcerptIds: stringArraySchema(),
        contradictingExcerptIds: stringArraySchema(),
        assessment: { type: 'string' }
      })
    },
    subcategoryCharacteristics: {
      type: 'array',
      items: provenanceSchema({
        characteristicId: { type: 'string' },
        subcategoryId: { type: 'string' },
        label: { type: 'string' },
        characteristicType: { type: 'string' },
        values: stringArraySchema()
      })
    },
    weightedGroups: {
      type: 'array',
      items: provenanceSchema({
        weightId: { type: 'string' },
        label: { type: 'string' },
        min: { type: 'number' },
        max: { type: 'number' },
        unit: stringEnumSchema(['percent', 'weight']),
        appliesTo: { type: 'string' }
      })
    },
    rules: {
      type: 'array',
      items: provenanceSchema({
        ruleId: { type: 'string' },
        label: { type: 'string' },
        conditionText: { type: 'string' },
        effects: { type: 'array', items: effectSchema }
      })
    },
    constraints: {
      type: 'array',
      items: provenanceSchema({
        constraintId: { type: 'string' },
        label: { type: 'string' },
        constraintType: stringEnumSchema(['negative', 'ethical', 'compatibility', 'safety']),
        text: { type: 'string' }
      })
    },
    examples: {
      type: 'array',
      items: provenanceSchema({
        exampleId: { type: 'string' },
        label: { type: 'string' },
        exampleType: stringEnumSchema(['prompt', 'specimen', 'example']),
        text: { type: 'string' }
      })
    },
    implementationFields: {
      type: 'array',
      items: provenanceSchema({
        fieldId: { type: 'string' },
        name: { type: 'string' },
        label: { type: 'string' },
        valueHint: { type: 'string' }
      })
    },
    citations: {
      type: 'array',
      items: provenanceSchema({
        citationId: { type: 'string' },
        label: { type: 'string' },
        url: { type: 'string' },
        citationText: { type: 'string' },
        verificationStatus: stringEnumSchema(['unverified-pasted-citation', 'reviewed', 'retrieved'])
      })
    },
    researchGaps: {
      type: 'array',
      items: provenanceSchema({
        gapId: { type: 'string' },
        label: { type: 'string' },
        reason: { type: 'string' },
        recommendedAction: { type: 'string' }
      })
    },
    graphAssemblyPlan: graphAssemblyPlanSchema,
    coverage: {
      type: 'array',
      items: strictObjectSchema({
        category: { type: 'string' },
        status: stringEnumSchema(['extracted', 'partial', 'not_found', 'ignored']),
        count: { type: 'integer' },
        note: { type: 'string' }
      })
    }
  });
}

function writeCodexRunnerOutputSchemaFile(outputDir) {
  const schemaPath = codexRunnerOutputSchemaPath(outputDir);
  fs.writeFileSync(schemaPath, `${JSON.stringify(buildStrictCodexParseResultJsonSchema(), null, 2)}\n`, 'utf8');
  return schemaPath;
}

function buildStrictCodexSweetenResultJsonSchema() {
  return strictObjectSchema({
    inputId: { type: 'string' },
    rewrites: {
      type: 'array',
      items: strictObjectSchema({
        choiceId: { type: 'string' },
        beforeText: { type: 'string' },
        afterText: { type: 'string' },
        reason: { type: 'string' }
      })
    }
  });
}

function writeCodexSweetenOutputSchemaFile(outputDir) {
  const schemaPath = codexSweetenOutputSchemaPath(outputDir);
  fs.writeFileSync(schemaPath, `${JSON.stringify(buildStrictCodexSweetenResultJsonSchema(), null, 2)}\n`, 'utf8');
  return schemaPath;
}

function buildCodexRunnerPrompt(outputDir) {
  const requestPath = path.join(outputDir, 'codex-parse-request.md');
  const requestText = fs.readFileSync(requestPath, 'utf8');
  return [
    requestText,
    '',
    '## Workbench Runner Boundary',
    '',
    'For this local Workbench runner, return the required JSON object as your final answer only.',
    'Do not write files. Do not call shell commands. Do not edit the workspace.',
    'The Workbench will validate your final JSON and persist it to `codex-parse-result.json`.',
    'Do not edit accepted-scene-grammar.json, accepted-grammar-deltas.json, source-claims.json, grammar-revisions.json, revision-state.json, or revision-state.applied.json.',
    'Do not perform live retrieval, web browsing, page scraping, or source-claim creation.',
    'Set `analysisMode` to `codex-semantic` in the JSON result.',
    'Return only JSON. Do not wrap it in Markdown. Do not add prose before or after the JSON.'
  ].join('\n');
}

function extractJsonObject(text) {
  if (!text) return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  return JSON.parse(text.slice(first, last + 1));
}

function spawnCodexCommand({ command, args, cwd, env, stdin, timeoutMs = defaultCodexTimeoutMs() }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let child;
    let timeout = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(result);
    };

    try {
      const invocation = codexSpawnInvocation({ command, args });
      child = spawn(invocation.command, invocation.args, codexSpawnOptions({ cwd, env }));
    } catch (error) {
      finish({
        code: 127,
        status: 'spawn-error',
        stdout,
        stderr: error.stack || error.message
      });
      return;
    }

    timeout = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // The process may already have exited.
      }
      finish({
        code: 124,
        status: 'timeout',
        stdout,
        stderr: appendOutput(stderr, `Codex runner timed out after ${timeoutMs} ms.`)
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      finish({
        code: 127,
        status: 'spawn-error',
        stdout,
        stderr: `${stderr}${stderr ? '\n' : ''}${error.message}`,
        error
      });
    });
    child.on('close', (code) => {
      finish({ code, status: code === 0 ? 'exited' : 'failed', stdout, stderr });
    });
    try {
      child.stdin.end(stdin);
    } catch (error) {
      try {
        child.kill();
      } catch {
        // The process may already have exited.
      }
      finish({
        code: 127,
        status: 'stdin-error',
        stdout,
        stderr: appendOutput(stderr, error.stack || error.message)
      });
    }
  });
}

function buildStateFilesForOutput(outputDir) {
  return {
    revisionStateFile: fs.existsSync(path.join(outputDir, 'revision-state.json'))
      ? path.join(outputDir, 'revision-state.json')
      : undefined,
    sourceIntakeApprovalFile: fs.existsSync(path.join(outputDir, 'source-intake-approval.json'))
      ? path.join(outputDir, 'source-intake-approval.json')
      : undefined,
    sourceClaimReviewFile: fs.existsSync(path.join(outputDir, 'source-claim-review.json'))
      ? path.join(outputDir, 'source-claim-review.json')
      : undefined,
    retrievalPolicyFile: fs.existsSync(path.join(outputDir, 'retrieval-policy.json'))
      ? path.join(outputDir, 'retrieval-policy.json')
      : undefined
  };
}

async function rebuildFromBriefAnalysis({
  outputDir,
  title,
  compileGrammar = 'accepted',
  pipelineRunner = runPipeline
}) {
  const resolvedOutputDir = path.resolve(outputDir);
  const inputPaths = inferSourceInputPaths(resolvedOutputDir);
  const packageArtifact = readJsonFileIfPresent(path.join(resolvedOutputDir, 'research-package.json'));
  const result = await pipelineRunner({
    inputPaths,
    outputDir: resolvedOutputDir,
    title: title || packageArtifact?.title || 'Metagrinder Workbench Run',
    compileGrammar,
    stateFiles: buildStateFilesForOutput(resolvedOutputDir)
  });
  return {
    outputDir: resolvedOutputDir,
    inputPaths,
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    args: result.args,
    analysisMode: readBriefAnalysisMode(resolvedOutputDir)
  };
}

async function rebuildFromExistingCodexResult({
  outputDir,
  title,
  compileGrammar = 'accepted',
  pipelineRunner = runPipeline
}) {
  const resolvedOutputDir = path.resolve(outputDir || '');
  const resultPath = path.join(resolvedOutputDir, 'codex-parse-result.json');
  if (!fs.existsSync(resultPath)) {
    throw new Error('codex-parse-result.json is missing. Run Codex semantic parse first.');
  }
  const codexResult = readJsonFileIfPresent(resultPath);
  writeCodexParseResultFile({
    outputDir: resolvedOutputDir,
    data: codexResult
  });
  const rebuild = await rebuildFromBriefAnalysis({
    outputDir: resolvedOutputDir,
    title,
    compileGrammar,
    pipelineRunner
  });
  return {
    ...rebuild,
    reusedCodexParseResult: true,
    resultPath,
    analysisMode: readBriefAnalysisMode(resolvedOutputDir)
  };
}

function updateResearchPackageCollections(outputDir, collections) {
  const packagePath = path.join(outputDir, 'research-package.json');
  const packageArtifact = readJsonFileIfPresent(packagePath);
  if (!packageArtifact || !Array.isArray(packageArtifact.collections)) return null;
  const byId = new Map(packageArtifact.collections.map((collection) => [collection.id, collection]));
  collections.forEach((collection) => {
    byId.set(collection.id, collection);
  });
  const nextPackage = {
    ...packageArtifact,
    collections: Array.from(byId.values())
  };
  writeJsonFile(packagePath, nextPackage);
  return nextPackage;
}

function readabilityCollections() {
  return [
    { id: 'col_psg_output_flight', type: 'psg-output-flight', path: 'psg-output-flight.json' },
    { id: 'col_psg_readability_review', type: 'psg-readability-review', path: 'psg-readability-review.json' },
    { id: 'col_codex_sweeten_request', type: 'codex-sweeten-request', path: 'codex-sweeten-request.json' },
    { id: 'col_codex_sweeten_request_md', type: 'codex-sweeten-request-markdown', path: 'codex-sweeten-request.md' },
    { id: 'col_codex_sweeten_result', type: 'codex-sweeten-result', path: 'codex-sweeten-result.json' },
    { id: 'col_codex_sweeten_run_log', type: 'codex-sweeten-run-log', path: 'codex-sweeten-run-log.json' },
    { id: 'col_codex_sweeten_run_status', type: 'codex-sweeten-run-status', path: 'codex-sweeten-run-status.json' }
  ];
}

function readRequiredJson(outputDir, fileName) {
  const filePath = path.join(outputDir, fileName);
  const artifact = readJsonFileIfPresent(filePath);
  if (!artifact) {
    throw new Error(`${fileName} is required for readability review.`);
  }
  return artifact;
}

function buildReadabilityArtifacts({
  outputDir,
  graphPath = 'scene-grammar.psg',
  sampleCount = 20,
  createdAt = new Date().toISOString(),
  codexStatus = 'not-run',
  appliedRewriteCount = 0
}) {
  const resolvedOutputDir = path.resolve(outputDir || '');
  const semanticChoiceGraphArtifact = MetagrinderSemanticChoiceGraphArtifactSchema.parse(
    readRequiredJson(resolvedOutputDir, 'semantic-choice-graph.json')
  );
  const psgArtifact = readRequiredJson(resolvedOutputDir, graphPath);
  const outputFlight = MetagrinderPsgOutputFlightArtifactSchema.parse(buildPsgOutputFlightArtifact({
    inputId: semanticChoiceGraphArtifact.inputId,
    graphPath,
    psgArtifact,
    semanticChoiceGraphArtifact,
    sampleCount,
    createdAt
  }));
  const review = MetagrinderPsgReadabilityReviewArtifactSchema.parse(buildPsgReadabilityReviewArtifact({
    inputId: semanticChoiceGraphArtifact.inputId,
    flightArtifact: outputFlight,
    semanticChoiceGraphArtifact,
    codexStatus,
    appliedRewriteCount,
    createdAt
  }));
  const request = MetagrinderCodexSweetenRequestArtifactSchema.parse(buildCodexSweetenRequestArtifact({
    inputId: semanticChoiceGraphArtifact.inputId,
    flightArtifact: outputFlight,
    reviewArtifact: review,
    semanticChoiceGraphArtifact,
    createdAt
  }));
  writeJsonFile(path.join(resolvedOutputDir, 'psg-output-flight.json'), outputFlight);
  writeJsonFile(path.join(resolvedOutputDir, 'psg-readability-review.json'), review);
  writeJsonFile(path.join(resolvedOutputDir, 'codex-sweeten-request.json'), request);
  fs.writeFileSync(
    path.join(resolvedOutputDir, 'codex-sweeten-request.md'),
    buildCodexSweetenRequestMarkdown({ requestArtifact: request }),
    'utf8'
  );
  updateResearchPackageCollections(resolvedOutputDir, readabilityCollections());
  return {
    outputDir: resolvedOutputDir,
    outputFlight,
    review,
    request
  };
}

function getReadabilityStatus({ outputDir }) {
  const resolvedOutputDir = path.resolve(outputDir || '');
  const hasChoiceGraph = fs.existsSync(path.join(resolvedOutputDir, 'semantic-choice-graph.json'));
  const hasPsg = fs.existsSync(path.join(resolvedOutputDir, 'scene-grammar.psg'));
  const flight = readJsonFileIfPresent(path.join(resolvedOutputDir, 'psg-output-flight.json'));
  const review = readJsonFileIfPresent(path.join(resolvedOutputDir, 'psg-readability-review.json'));
  const sweetenStatus = readJsonFileIfPresent(path.join(resolvedOutputDir, 'codex-sweeten-run-status.json'));
  const sweetenResult = readJsonFileIfPresent(path.join(resolvedOutputDir, 'codex-sweeten-result.json'));
  const status = sweetenStatus?.status === 'running'
    ? 'review-running'
    : sweetenStatus?.status === 'failed' || sweetenStatus?.status === 'timeout'
      ? 'failed'
      : sweetenResult
        ? 'sweetened'
        : review?.readabilityStatus || (hasChoiceGraph && hasPsg ? 'flight-ready' : 'missing');
  return {
    outputDir: resolvedOutputDir,
    status,
    flightPresent: Boolean(flight),
    reviewPresent: Boolean(review),
    sweetenResultPresent: Boolean(sweetenResult),
    findingCount: review?.findings?.length || 0,
    appliedRewriteCount: review?.appliedRewriteCount || 0,
    sampleCount: flight?.samples?.length || 0,
    sweetenRunStatus: sweetenStatus || null
  };
}

function buildCodexSweetenRunnerPrompt(outputDir) {
  const requestText = fs.readFileSync(path.join(outputDir, 'codex-sweeten-request.md'), 'utf8');
  return [
    requestText,
    '',
    '## Workbench Runner Boundary',
    '',
    'Return the required JSON object as your final answer only.',
    'Do not write files. Do not call shell commands. Do not edit the workspace.',
    'Do not add axes, choices, weights, edges, evidence, claims, revisions, or accepted grammar changes.',
    'Only propose text rewrites for existing choiceId values where beforeText matches exactly.'
  ].join('\n');
}

function writeCodexSweetenStatusFile({ outputDir, status }) {
  writeJsonFile(path.join(outputDir, 'codex-sweeten-run-status.json'), status);
  return status;
}

function writeCodexSweetenLogFile({ outputDir, log }) {
  writeJsonFile(path.join(outputDir, 'codex-sweeten-run-log.json'), log);
  return log;
}

function rebuildPrimaryPsgFromSemanticChoiceGraph({ outputDir }) {
  const sceneGrammarArtifact = readRequiredJson(outputDir, 'scene-grammar.json');
  const semanticChoiceGraphArtifact = MetagrinderSemanticChoiceGraphArtifactSchema.parse(
    readRequiredJson(outputDir, 'semantic-choice-graph.json')
  );
  const psgArtifact = buildSceneGrammarPsg({
    sceneGrammarArtifact,
    semanticChoiceGraphArtifact,
    now: () => new Date().toISOString()
  });
  writeJsonFile(path.join(outputDir, 'scene-grammar.psg'), psgArtifact);
  return psgArtifact;
}

async function runPsgOutputFlight({ outputDir, graphPath = 'scene-grammar.psg', sampleCount = 20 }) {
  const built = buildReadabilityArtifacts({
    outputDir,
    graphPath,
    sampleCount,
    codexStatus: 'not-run'
  });
  return {
    outputDir: built.outputDir,
    status: built.review.readabilityStatus,
    flightPath: path.join(built.outputDir, 'psg-output-flight.json'),
    reviewPath: path.join(built.outputDir, 'psg-readability-review.json'),
    requestPath: path.join(built.outputDir, 'codex-sweeten-request.md'),
    sampleCount: built.outputFlight.samples.length,
    findingCount: built.review.findings.length,
    review: built.review
  };
}

async function runCodexReadabilitySweeten({
  outputDir,
  graphPath = 'scene-grammar.psg',
  sampleCount = 20,
  apply = true,
  command,
  args,
  timeoutMs,
  commandRunner = spawnCodexCommand
}) {
  const resolvedOutputDir = path.resolve(outputDir || '');
  if (!resolvedOutputDir || !fs.existsSync(resolvedOutputDir) || !fs.statSync(resolvedOutputDir).isDirectory()) {
    throw new Error(`Metagrinder output folder does not exist: ${outputDir}`);
  }
  const startedAt = new Date().toISOString();
  const initial = buildReadabilityArtifacts({
    outputDir: resolvedOutputDir,
    graphPath,
    sampleCount,
    createdAt: startedAt,
    codexStatus: 'running'
  });
  const inputId = initial.request.inputId;
  const resolvedCommand = command || defaultCodexCommand();
  const resolvedArgs = args || defaultCodexSweetenArgs(resolvedOutputDir);
  const resolvedTimeoutMs = timeoutMs || defaultCodexTimeoutMs();
  const resultPath = path.join(resolvedOutputDir, 'codex-sweeten-result.json');
  const lastMessagePath = path.join(resolvedOutputDir, 'codex-sweeten-last-message.txt');
  const requestPath = path.join(resolvedOutputDir, 'codex-sweeten-request.md');
  const schemaPath = writeCodexSweetenOutputSchemaFile(resolvedOutputDir);
  const statusBase = {
    inputId,
    status: 'running',
    requestPath,
    resultPath,
    graphPath,
    sampleCount: initial.outputFlight.samples.length,
    startedAt,
    completedAt: null,
    message: 'Codex readability sweetening is running.'
  };
  writeCodexSweetenStatusFile({ outputDir: resolvedOutputDir, status: statusBase });
  const childEnv = { ...process.env };
  if (!childEnv.NODE_PATH && fs.existsSync(AUDIT_DEPS_NODE_PATH)) {
    childEnv.NODE_PATH = AUDIT_DEPS_NODE_PATH;
  }
  const protectedSnapshot = snapshotProtectedArtifacts(resolvedOutputDir);
  let protectedArtifactChanges = [];
  let runnerResult;
  try {
    runnerResult = await commandRunner({
      command: resolvedCommand,
      args: resolvedArgs,
      cwd: REPO_ROOT,
      env: childEnv,
      stdin: buildCodexSweetenRunnerPrompt(resolvedOutputDir),
      timeoutMs: resolvedTimeoutMs
    });
  } catch (error) {
    runnerResult = {
      code: 127,
      status: 'runner-exception',
      stdout: '',
      stderr: error.stack || error.message
    };
  } finally {
    protectedArtifactChanges = restoreProtectedArtifacts(resolvedOutputDir, protectedSnapshot);
  }

  const warnings = [];
  let resultArtifact = null;
  const finalMessage = readTextFileIfPresent(lastMessagePath) || runnerResult.stdout;
  if (finalMessage) {
    try {
      resultArtifact = extractJsonObject(finalMessage);
    } catch (error) {
      runnerResult.stderr = appendOutput(runnerResult.stderr, `Could not parse Codex sweeten JSON: ${error.message}`);
      warnings.push('Codex sweeten final message was not valid JSON.');
    }
  }
  if (!resultArtifact) {
    const resultRead = readJsonFileSafely(resultPath);
    resultArtifact = resultRead.data;
    if (resultRead.error) {
      runnerResult.stderr = appendOutput(runnerResult.stderr, `Could not parse codex-sweeten-result.json: ${resultRead.error.message}`);
      warnings.push('codex-sweeten-result.json exists but is not valid JSON.');
    }
  }

  let parsedResult = null;
  let normalizedRewrites = [];
  let appliedRewriteCount = 0;
  let rebuildResult = null;
  if (resultArtifact) {
    try {
      parsedResult = MetagrinderCodexSweetenResultArtifactSchema.parse(resultArtifact);
      const semanticChoiceGraphArtifact = MetagrinderSemanticChoiceGraphArtifactSchema.parse(
        readRequiredJson(resolvedOutputDir, 'semantic-choice-graph.json')
      );
      normalizedRewrites = validateSweetenResult({
        semanticChoiceGraphArtifact,
        resultArtifact: parsedResult
      });
      parsedResult = {
        inputId: parsedResult.inputId,
        rewrites: normalizedRewrites.map(({ choiceId, beforeText, afterText, reason }) => ({
          choiceId,
          beforeText,
          afterText,
          reason
        }))
      };
      writeJsonFile(resultPath, parsedResult);
      if (apply && normalizedRewrites.length > 0) {
        const nextGraphResult = applySweetenRewrites({
          semanticChoiceGraphArtifact,
          rewrites: normalizedRewrites
        });
        const parsedGraph = MetagrinderSemanticChoiceGraphArtifactSchema.parse(nextGraphResult.semanticChoiceGraphArtifact);
        writeJsonFile(path.join(resolvedOutputDir, 'semantic-choice-graph.json'), parsedGraph);
        rebuildResult = rebuildPrimaryPsgFromSemanticChoiceGraph({ outputDir: resolvedOutputDir });
        appliedRewriteCount = nextGraphResult.appliedRewriteCount;
      }
    } catch (error) {
      runnerResult.stderr = appendOutput(runnerResult.stderr, `Codex sweeten result failed validation: ${error.message}`);
      warnings.push('Codex sweeten result did not match the text-only rewrite contract.');
      parsedResult = null;
    }
  }
  if (protectedArtifactChanges.length > 0) {
    warnings.push(`Codex attempted to mutate protected artifacts; restored: ${protectedArtifactChanges.join(', ')}`);
  }
  if (!parsedResult) {
    warnings.push('Codex did not return a usable readability sweeten result.');
  }
  const completedAt = new Date().toISOString();
  const completedSuccessfully = runnerResult.code === 0 && parsedResult && protectedArtifactChanges.length === 0;
  const status = completedSuccessfully
    ? 'complete'
    : runnerResult.status === 'timeout' || runnerResult.code === 124
      ? 'timeout'
      : 'failed';
  const finalStatus = {
    ...statusBase,
    status,
    completedAt,
    appliedRewriteCount,
    message: completedSuccessfully
      ? 'Codex readability sweetening completed.'
      : 'Codex readability sweetening failed or did not produce a usable result.',
    warnings
  };
  writeCodexSweetenStatusFile({ outputDir: resolvedOutputDir, status: finalStatus });
  const runLog = {
    inputId,
    command: resolvedCommand,
    args: resolvedArgs,
    outputDir: resolvedOutputDir,
    requestPath,
    resultPath,
    lastMessagePath,
    schemaPath,
    startedAt,
    completedAt,
    exitCode: runnerResult.code,
    status,
    timeoutMs: resolvedTimeoutMs,
    stdout: runnerResult.stdout,
    stderr: runnerResult.stderr,
    protectedArtifactChanges,
    appliedRewriteCount,
    warnings
  };
  writeCodexSweetenLogFile({ outputDir: resolvedOutputDir, log: runLog });
  buildReadabilityArtifacts({
    outputDir: resolvedOutputDir,
    graphPath,
    sampleCount,
    createdAt: completedAt,
    codexStatus: completedSuccessfully ? 'complete' : status,
    appliedRewriteCount
  });
  return {
    outputDir: resolvedOutputDir,
    status,
    exitCode: runnerResult.code,
    stdout: runnerResult.stdout,
    stderr: runnerResult.stderr,
    warnings,
    appliedRewriteCount,
    resultPath,
    rebuild: rebuildResult
  };
}

async function runCodexSemanticParse({
  outputDir,
  command,
  args,
  timeoutMs,
  commandRunner = spawnCodexCommand,
  pipelineRunner = runPipeline
}) {
  const resolvedOutputDir = path.resolve(outputDir || '');
  if (!resolvedOutputDir || !fs.existsSync(resolvedOutputDir) || !fs.statSync(resolvedOutputDir).isDirectory()) {
    throw new Error(`Metagrinder output folder does not exist: ${outputDir}`);
  }
  const startedAt = new Date().toISOString();
  const requestPath = path.join(resolvedOutputDir, 'codex-parse-request.md');
  const resultPath = path.join(resolvedOutputDir, 'codex-parse-result.json');
  const previousStatusPath = path.join(resolvedOutputDir, 'codex-run-status.json');
  const previousStatus = readJsonFileIfPresent(previousStatusPath);
  const staleWarnings = [];
  if (previousStatus?.status === 'running' && !previousStatus.completedAt) {
    staleWarnings.push('Previous Codex semantic parse was still marked running and has been replaced.');
    writeCodexRunStatusFile({
      outputDir: resolvedOutputDir,
      status: {
        ...previousStatus,
        status: 'stale',
        completedAt: startedAt,
        message: 'Previous Codex semantic parse did not complete before a new run started.',
        warnings: [
          ...(previousStatus.warnings || []),
          'Stale running status was replaced by a new Codex semantic parse run.'
        ]
      }
    });
  }
  const statusBase = {
    inputId: loadWorkbenchFolder(resolvedOutputDir).inputId,
    status: 'running',
    requestPath,
    resultPath,
    startedAt,
    completedAt: null,
    analysisModeBefore: readBriefAnalysisMode(resolvedOutputDir),
    analysisModeAfter: null,
    message: 'Codex semantic parse is running.',
    warnings: staleWarnings
  };
  writeCodexRunStatusFile({ outputDir: resolvedOutputDir, status: statusBase });

  if (!fs.existsSync(requestPath)) {
    const blocked = {
      ...statusBase,
      status: 'not-configured',
      completedAt: new Date().toISOString(),
      message: 'codex-parse-request.md is missing. Run Metagrinder first.'
    };
    writeCodexRunStatusFile({ outputDir: resolvedOutputDir, status: blocked });
    writeCodexRunLogFile({ outputDir: resolvedOutputDir, log: { ...blocked, command: null, args: [], exitCode: 1, stdout: '', stderr: blocked.message } });
    return { exitCode: 1, status: blocked.status, message: blocked.message, analysisMode: blocked.analysisModeAfter };
  }

  const resolvedCommand = command || defaultCodexCommand();
  let schemaPath = null;
  const warnings = [...staleWarnings];
  try {
    schemaPath = writeCodexRunnerOutputSchemaFile(resolvedOutputDir);
  } catch (error) {
    warnings.push(`Could not write Codex output schema for final-message validation: ${error.message}`);
  }
  const resolvedArgs = args || defaultCodexArgs(resolvedOutputDir);
  const resolvedTimeoutMs = timeoutMs || defaultCodexTimeoutMs();
  const childEnv = { ...process.env };
  if (!childEnv.NODE_PATH && fs.existsSync(AUDIT_DEPS_NODE_PATH)) {
    childEnv.NODE_PATH = AUDIT_DEPS_NODE_PATH;
  }
  const protectedSnapshot = snapshotProtectedArtifacts(resolvedOutputDir);
  const prompt = buildCodexRunnerPrompt(resolvedOutputDir);
  let runnerResult;
  let protectedArtifactChanges = [];
  try {
    runnerResult = await commandRunner({
      command: resolvedCommand,
      args: resolvedArgs,
      cwd: REPO_ROOT,
      env: childEnv,
      stdin: prompt,
      timeoutMs: resolvedTimeoutMs
    });
  } catch (error) {
    runnerResult = {
      code: 127,
      status: 'runner-exception',
      stdout: '',
      stderr: error.stack || error.message
    };
  } finally {
    protectedArtifactChanges = restoreProtectedArtifacts(resolvedOutputDir, protectedSnapshot);
  }
  const lastMessagePath = path.join(resolvedOutputDir, 'codex-last-message.txt');
  const finalMessage = readTextFileIfPresent(lastMessagePath) || runnerResult.stdout;
  let resultArtifact = null;
  if (finalMessage) {
    try {
      resultArtifact = extractJsonObject(finalMessage);
      if (resultArtifact) {
        try {
          writeCodexParseResultFile({ outputDir: resolvedOutputDir, data: resultArtifact });
        } catch (error) {
          runnerResult.stderr = appendOutput(runnerResult.stderr, `Codex final JSON failed schema validation: ${error.message}`);
          warnings.push('Codex final JSON did not match the semantic parse result contract.');
          resultArtifact = null;
        }
      }
    } catch (error) {
      runnerResult.stderr = appendOutput(runnerResult.stderr, `Could not parse Codex final JSON: ${error.message}`);
      warnings.push('Codex final message was not valid JSON.');
    }
  }
  if (!resultArtifact) {
    const resultRead = readJsonFileSafely(resultPath);
    resultArtifact = resultRead.data;
    if (resultRead.error) {
      runnerResult.stderr = appendOutput(runnerResult.stderr, `Could not parse codex-parse-result.json: ${resultRead.error.message}`);
      warnings.push('codex-parse-result.json exists but is not valid JSON.');
    }
    if (resultArtifact) {
      try {
        writeCodexParseResultFile({ outputDir: resolvedOutputDir, data: resultArtifact });
      } catch (error) {
        runnerResult.stderr = appendOutput(runnerResult.stderr, `Codex result failed schema validation: ${error.message}`);
        warnings.push('codex-parse-result.json did not match the semantic parse result contract.');
        resultArtifact = null;
      }
    }
  }

  if (protectedArtifactChanges.length > 0) {
    warnings.push(`Codex attempted to mutate protected artifacts; restored: ${protectedArtifactChanges.join(', ')}`);
  }
  if (!resultArtifact) {
    warnings.push('Codex did not return a usable semantic parse JSON result.');
  }

  let rebuildResult = null;
  let rebuildError = null;
  if (runnerResult.code === 0 && resultArtifact && protectedArtifactChanges.length === 0) {
    try {
      rebuildResult = await rebuildFromBriefAnalysis({
        outputDir: resolvedOutputDir,
        pipelineRunner
      });
      if (rebuildResult.exitCode !== 0) {
        runnerResult.stderr = appendOutput(runnerResult.stderr, rebuildResult.stderr || 'Metagrinder rebuild failed after Codex parse.');
        rebuildError = new Error('Metagrinder rebuild failed after Codex parse.');
      }
    } catch (error) {
      rebuildError = error;
      runnerResult.stderr = appendOutput(runnerResult.stderr, error.stack || error.message);
    }
  }

  const completedAt = new Date().toISOString();
  const completedSuccessfully = runnerResult.code === 0 &&
    resultArtifact &&
    protectedArtifactChanges.length === 0 &&
    !rebuildError &&
    (!rebuildResult || rebuildResult.exitCode === 0);
  const status = completedSuccessfully
    ? 'complete'
    : runnerResult.status === 'timeout' || runnerResult.code === 124
      ? 'timeout'
      : 'failed';
  const finalStatus = {
    ...statusBase,
    status,
    completedAt,
    analysisModeAfter: readBriefAnalysisMode(resolvedOutputDir),
    message: completedSuccessfully
      ? 'Codex semantic parse completed.'
      : 'Codex semantic parse failed or did not produce a usable result.',
    warnings
  };
  const runLog = {
    inputId: statusBase.inputId,
    command: resolvedCommand,
    args: resolvedArgs,
    outputDir: resolvedOutputDir,
    requestPath,
    resultPath,
    lastMessagePath,
    schemaPath,
    startedAt,
    completedAt,
    exitCode: runnerResult.code,
    status,
    timeoutMs: resolvedTimeoutMs,
    stdout: runnerResult.stdout,
    stderr: runnerResult.stderr,
    protectedArtifactChanges,
    rebuild: rebuildResult,
    warnings
  };
  writeCodexRunStatusFile({ outputDir: resolvedOutputDir, status: finalStatus });
  writeCodexRunLogFile({ outputDir: resolvedOutputDir, log: runLog });
  return {
    exitCode: runnerResult.code,
    status: finalStatus.status,
    outputDir: resolvedOutputDir,
    resultPath,
    stdout: runnerResult.stdout,
    stderr: runnerResult.stderr,
    warnings,
    analysisMode: finalStatus.analysisModeAfter,
    rebuild: rebuildResult
  };
}



async function runResearchInputs({
  title,
  inputs,
  outputRoot,
  pipelineRunner = runPipeline
}) {
  const preparedRun = prepareResearchInputRun({
    title,
    inputs,
    outputRoot
  });
  const pipelineResult = await pipelineRunner({
    inputPath: preparedRun.inputPath,
    inputPaths: preparedRun.inputPaths,
    outputDir: preparedRun.outputDir,
    title: preparedRun.title,
    compileGrammar: 'accepted'
  });
  return {
    ...preparedRun,
    exitCode: pipelineResult.code,
    stdout: pipelineResult.stdout,
    stderr: pipelineResult.stderr,
    args: pipelineResult.args
  };
}
async function runPastedArticle({
  title,
  articleText,
  outputRoot,
  pipelineRunner = runPipeline
}) {
  const preparedRun = preparePastedArticleRun({
    title,
    articleText,
    outputRoot
  });
  const pipelineResult = await pipelineRunner({
    inputPath: preparedRun.inputPath,
    outputDir: preparedRun.outputDir,
    title: preparedRun.title,
    compileGrammar: 'accepted'
  });
  return {
    ...preparedRun,
    exitCode: pipelineResult.code,
    stdout: pipelineResult.stdout,
    stderr: pipelineResult.stderr,
    args: pipelineResult.args
  };
}
async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, app: 'metagrinder-workbench' });
    return;
  }


  if (request.method === 'GET' && url.pathname === '/api/browse') {
    sendJson(response, 200, listBrowsePath({
      browsePath: url.searchParams.get('path'),
      kind: url.searchParams.get('kind') || 'folder'
    }));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/open') {
    const outputDir = url.searchParams.get('dir');
    sendJson(response, 200, loadWorkbenchFolder(outputDir));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/recent-runs') {
    sendJson(response, 200, listRecentWorkbenchRuns({
      root: url.searchParams.get('root') || undefined,
      limit: url.searchParams.get('limit') || undefined
    }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/readability-status') {
    sendJson(response, 200, getReadabilityStatus({
      outputDir: url.searchParams.get('dir')
    }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/artifact') {
    const outputDir = url.searchParams.get('dir');
    const artifactPath = url.searchParams.get('path');
    const artifact = readArtifact({ outputDir, artifactPath });
    sendText(response, 200, artifact.text, `${artifact.contentType}; charset=utf-8`);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/state') {
    const body = await readRequestBody(request);
    const result = writeOperatorStateFile({
      outputDir: body.outputDir,
      fileName: body.fileName,
      data: body.data
    });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/codex-parse-result') {
    const body = await readRequestBody(request);
    const result = writeCodexParseResultFile({
      outputDir: body.outputDir,
      data: body.data
    });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/import-codex-parse-result') {
    const body = await readRequestBody(request);
    const writeResult = writeCodexParseResultFile({
      outputDir: body.outputDir,
      data: body.data
    });
    const rebuildResult = body.rebuild === false
      ? null
      : await rebuildFromBriefAnalysis({
        outputDir: body.outputDir,
        compileGrammar: body.compileGrammar || 'accepted'
      });
    sendJson(response, 200, {
      ...writeResult,
      rebuild: rebuildResult,
      analysisMode: readBriefAnalysisMode(body.outputDir)
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/rebuild-from-brief-analysis') {
    const body = await readRequestBody(request);
    const result = await rebuildFromBriefAnalysis({
      outputDir: body.outputDir,
      title: body.title,
      compileGrammar: body.compileGrammar || 'accepted'
    });
    sendJson(response, result.exitCode === 0 ? 200 : 500, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/rebuild-from-existing-codex-result') {
    const body = await readRequestBody(request);
    const result = await rebuildFromExistingCodexResult({
      outputDir: body.outputDir,
      title: body.title,
      compileGrammar: body.compileGrammar || 'accepted'
    });
    sendJson(response, result.exitCode === 0 ? 200 : 500, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/run-psg-output-flight') {
    const body = await readRequestBody(request);
    const result = await runPsgOutputFlight({
      outputDir: body.outputDir,
      graphPath: body.graphPath || 'scene-grammar.psg',
      sampleCount: body.sampleCount || 20
    });
    sendJson(response, 200, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/run-codex-readability-sweeten') {
    const body = await readRequestBody(request);
    const result = await runCodexReadabilitySweeten({
      outputDir: body.outputDir,
      graphPath: body.graphPath || 'scene-grammar.psg',
      sampleCount: body.sampleCount || 20,
      apply: body.apply !== false
    });
    sendJson(response, result.status === 'complete' ? 200 : 500, result);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/run-codex-semantic-parse') {
    const body = await readRequestBody(request);
    const result = await runCodexSemanticParse({
      outputDir: body.outputDir
    });
    sendJson(response, result.status === 'complete' ? 200 : 500, result);
    return;
  }



  if (request.method === 'POST' && url.pathname === '/api/run-research-inputs') {
    const body = await readRequestBody(request);
    const result = await runResearchInputs(body);
    sendJson(response, result.exitCode === 0 ? 200 : 500, result);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/run-pasted-article') {
    const body = await readRequestBody(request);
    if (!body.articleText || typeof body.articleText !== 'string' || body.articleText.trim().length === 0) {
      sendJson(response, 400, { error: 'Paste article text before parsing.' });
      return;
    }
    const result = await runPastedArticle(body);
    sendJson(response, result.exitCode === 0 ? 200 : 500, result);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/rerun') {
    const body = await readRequestBody(request);
    const result = await runPipeline(body);
    sendJson(response, result.code === 0 ? 200 : 500, result);
    return;
  }

  sendJson(response, 404, { error: `Unknown API endpoint: ${url.pathname}` });
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url);
        return;
      }

      const filePath = safeStaticPath(url.pathname);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendText(response, 404, 'Not found');
        return;
      }
      sendText(response, 200, fs.readFileSync(filePath, 'utf8'), contentTypeFor(filePath));
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

function main() {
  const { port } = parseArgs(process.argv.slice(2));
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Metagrinder Workbench running at http://127.0.0.1:${port}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  createServer,
  listBrowsePath,
  runPastedArticle,
  runResearchInputs,
  runPipeline,
  rebuildFromBriefAnalysis,
  rebuildFromExistingCodexResult,
  runCodexSemanticParse,
  runPsgOutputFlight,
  runCodexReadabilitySweeten,
  getReadabilityStatus,
  spawnCodexCommand,
  codexSpawnOptions,
  codexSpawnInvocation,
  defaultCodexArgs,
  defaultCodexSweetenArgs
};

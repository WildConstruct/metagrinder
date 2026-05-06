const screens = [
  ['run', 'Run Setup'],
  ['dashboard', 'Artifact Dashboard'],
  ['semantic', 'Codex Semantic Parse'],
  ['structure', 'Seed Structure'],
  ['grammar', 'Scene Grammar Projection'],
  ['candidates', 'Candidate Review'],
  ['claims', 'Source Evidence / Claim Review'],
  ['revisions', 'Grammar Revision Review'],
  ['deltas', 'Accepted Grammar / Delta Compare'],
  ['psg', 'PSG Export / Open in Prompt Spaghetti']
];

const state = {
  outputDir: '',
  folder: null,
  approvals: null,
  claimReview: null,
  revisionState: null,
  retrievalPolicy: null,
  recentRuns: [],
  recentRunsRoot: 'tmp/metagrinder-workbench-runs',
  pathPicker: {
    targetId: null,
    kind: 'folder',
    currentPath: null,
    parentPath: null,
    onSelect: null
  },
  researchInputs: []
};

function applyTheme(theme) {
  const resolvedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = resolvedTheme;
  localStorage.setItem('metagrinder-workbench-theme', resolvedTheme);
  const toggle = $('#theme-toggle');
  if (toggle) {
    toggle.textContent = resolvedTheme === 'dark' ? 'Light' : 'Dark';
  }
}

function initializeTheme() {
  applyTheme(localStorage.getItem('metagrinder-workbench-theme') || 'dark');
}
function $(selector) {
  return document.querySelector(selector);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function getArtifact(fileName) {
  return state.folder?.artifacts?.[fileName] || null;
}

function artifactUrl(artifactPath) {
  return `/api/artifact?dir=${encodeURIComponent(state.outputDir)}&path=${encodeURIComponent(artifactPath)}`;
}

function setRunning(isRunning, message) {
  const status = $('#run-status');
  if (status) {
    status.textContent = message || (isRunning ? 'Running Metagrinder...' : 'Idle');
    status.classList.toggle('running', Boolean(isRunning));
    status.classList.toggle('complete', !isRunning && /complete/i.test(status.textContent));
    status.classList.toggle('failed', !isRunning && /failed/i.test(status.textContent));
  }
  ['#run-metagrinder-button', '#rerun-button', '#add-paste-input-button', '#add-file-input-button', '#open-folder-button', '#force-codex-button', '#run-flight-button', '#run-sweeten-button'].forEach((selector) => {
    const button = $(selector);
    if (button) button.disabled = Boolean(isRunning);
  });
  const codexButton = $('#run-codex-button');
  if (codexButton) codexButton.disabled = Boolean(isRunning) || !state.outputDir;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

function renderPsgVisualization(psg) {
  const graph = psg?.graph || psg;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes.slice(0, 48) : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (nodes.length === 0) return '';
  const width = 980;
  const height = Math.max(280, Math.ceil(nodes.length / 6) * 120);
  const nodePositions = new Map(nodes.map((node, index) => {
    const col = index % 6;
    const row = Math.floor(index / 6);
    const x = 90 + col * 160;
    const y = 70 + row * 110;
    return [node.id, { x, y, node }];
  }));
  const edgeSvg = edges
    .filter((edge) => nodePositions.has(edge.source) && nodePositions.has(edge.target))
    .slice(0, 96)
    .map((edge) => {
      const source = nodePositions.get(edge.source);
      const target = nodePositions.get(edge.target);
      return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="#355163" stroke-width="1.5" />`;
    }).join('');
  const nodeSvg = [...nodePositions.values()].map(({ x, y, node }) => {
    const label = escapeXml(node.data?.label || node.name || node.id);
    const type = escapeXml(node.type || 'node');
    const fill = node.type === 'WeightedChoice' ? '#173f3a' : '#182839';
    return `<g><rect x="${x - 58}" y="${y - 24}" width="116" height="48" rx="6" fill="${fill}" stroke="#4b6578" />` +
      `<text x="${x}" y="${y - 3}" text-anchor="middle" fill="#e6edf3" font-size="11">${label.slice(0, 20)}</text>` +
      `<text x="${x}" y="${y + 14}" text-anchor="middle" fill="#9aa7b5" font-size="10">${type}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="PSG graph preview">${edgeSvg}${nodeSvg}</svg>`;
}

function showArtifactPreview({ artifactPath, text }) {
  $('#artifact-preview-title').textContent = artifactPath === 'source-map.psg'
    ? 'Source Coverage Preview'
    : artifactPath.endsWith('.psg') ? 'PSG Preview' : 'Artifact Preview';
  $('#artifact-preview-path').textContent = artifactPath;
  $('#artifact-preview-modal-text').textContent = text;
  const visualization = $('#artifact-visualization');
  visualization.innerHTML = '';
  if (artifactPath.endsWith('.psg')) {
    try {
      visualization.innerHTML = renderPsgVisualization(JSON.parse(text));
    } catch {
      visualization.textContent = 'PSG visualization unavailable for this artifact.';
    }
  }
  if (artifactPath === 'source-map.psg') {
    const note = createElement('p', 'meta source-map-note', 'This is only a chunk/source coverage graph. It is not the semantic parse result.');
    visualization.prepend(note);
  }
  $('#artifact-preview-modal').hidden = false;
}

function closeArtifactPreview() {
  $('#artifact-preview-modal').hidden = true;
}
function log(message) {
  $('#run-log').textContent = message;
}

let toastTimer = null;

function showToast(message, kind = 'info') {
  const toast = $('#workbench-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${kind}`;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function initializeNav() {
  const nav = $('#screen-nav');
  const button = $('#screen-nav-button');
  const options = $('#screen-nav-options');
  if (!nav || !button || !options) return;

  screens.forEach(([id, label]) => {
    const option = createElement('button', 'screen-nav-option', label);
    option.type = 'button';
    option.dataset.screenId = id;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', id === 'run' ? 'true' : 'false');
    option.addEventListener('click', () => {
      closeViewMenu();
      activateScreen(id);
    });
    options.appendChild(option);
  });

  button.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      nav.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      options.querySelector('.screen-nav-option.is-active')?.focus();
    }
  });

  options.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeViewMenu();
      button.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(options.querySelectorAll('.screen-nav-option'));
    const index = items.indexOf(document.activeElement);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) closeViewMenu();
  });
}

function closeViewMenu() {
  const nav = $('#screen-nav');
  const button = $('#screen-nav-button');
  nav?.classList.remove('open');
  button?.setAttribute('aria-expanded', 'false');
}

function activateScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === `screen-${id}`);
  });
  const nav = $('#screen-nav');
  const button = $('#screen-nav-button');
  if (nav) {
    nav.dataset.value = id;
  }
  if (button) {
    button.textContent = screens.find(([screenId]) => screenId === id)?.[1] || id;
  }
  document.querySelectorAll('.screen-nav-option').forEach((option) => {
    const isActive = option.dataset.screenId === id;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

async function openFolder() {
  const outputDir = $('#output-dir').value.trim();
  if (!outputDir) {
    log('Enter a Metagrinder output folder.');
    return;
  }
  state.outputDir = outputDir;
  state.folder = await fetchJson(`/api/open?dir=${encodeURIComponent(outputDir)}`);
  state.approvals = structuredClone(state.folder.stateDrafts['source-intake-approval.json']);
  state.claimReview = structuredClone(state.folder.stateDrafts['source-claim-review.json']);
  state.revisionState = structuredClone(state.folder.stateDrafts['revision-state.json']);
  state.retrievalPolicy = structuredClone(state.folder.stateDrafts['retrieval-policy.json']);
  $('#folder-title').textContent = state.folder.title;
  log(`Loaded ${state.folder.outputDir}`);
  renderAll();
}

async function refreshOpenFolder({ render = true } = {}) {
  if (!state.outputDir) return null;
  state.folder = await fetchJson(`/api/open?dir=${encodeURIComponent(state.outputDir)}`);
  state.approvals = structuredClone(state.folder.stateDrafts['source-intake-approval.json']);
  state.claimReview = structuredClone(state.folder.stateDrafts['source-claim-review.json']);
  state.revisionState = structuredClone(state.folder.stateDrafts['revision-state.json']);
  state.retrievalPolicy = structuredClone(state.folder.stateDrafts['retrieval-policy.json']);
  const folderTitle = $('#folder-title');
  if (folderTitle) folderTitle.textContent = state.folder.title;
  if (render) renderAll();
  return state.folder;
}

function semanticModeLabel(mode) {
  if (mode === 'codex-semantic' || mode === 'codex-imported') return 'codex-semantic';
  if (mode === 'missing') return 'missing';
  return 'seed-only';
}

function semanticStatusLabel() {
  const status = state.folder?.semanticStatus;
  const runStatus = status?.codexRunStatus?.status;
  if (runStatus === 'running') return 'codex-running';
  if (runStatus === 'failed' || runStatus === 'timeout') return 'codex-failed';
  if (status?.codexParseResultPresent && status.analysisMode !== 'codex-semantic') return 'rebuild-needed';
  if (status?.analysisMode === 'codex-semantic' || status?.analysisMode === 'codex-imported') return 'codex-semantic';
  if (status?.analysisMode === 'missing') return 'missing';
  return 'seed-only';
}

function summarizeCodexRunLog(logArtifact) {
  if (!logArtifact) return '';
  const parts = [];
  if (logArtifact.status) parts.push(`status: ${logArtifact.status}`);
  if (logArtifact.exitCode !== undefined) parts.push(`exit code: ${logArtifact.exitCode}`);
  if (logArtifact.stderr) parts.push(`stderr: ${String(logArtifact.stderr).slice(0, 700)}`);
  if (!logArtifact.stderr && logArtifact.stdout) parts.push(`stdout: ${String(logArtifact.stdout).slice(0, 700)}`);
  if (Array.isArray(logArtifact.warnings) && logArtifact.warnings.length > 0) {
    parts.push(`warnings: ${logArtifact.warnings.join(' | ')}`);
  }
  return parts.join('\n');
}

function renderAll() {
  renderDashboard();
  renderSemanticParse();
  renderStructuredBrief();
  renderGrammar();
  renderCandidates();
  renderClaims();
  renderRevisions();
  renderDeltas();
  renderPsg();
  renderPolicy();
  renderRecentRuns();
}

function renderPolicy() {
  $('#policy-json').value = state.retrievalPolicy ? json(state.retrievalPolicy) : '';
}

function renderDashboard() {
  const collections = state.folder?.collections || [];
  $('#artifact-count').textContent = `${collections.filter((entry) => entry.present).length} artifacts`;
  const list = $('#artifact-list');
  list.innerHTML = '';
  collections.forEach((collection) => {
    const row = createElement('div', 'artifact-row');
    const title = createElement('div', 'artifact-title');
    title.appendChild(createElement('strong', '', collection.type));
    title.appendChild(createElement('span', '', collection.path));
    if (collection.path === 'source-map.psg') {
      title.appendChild(createElement('span', 'meta', 'Chunk/source coverage only. Use Codex Semantic Parse for actual analysis.'));
    }
    row.appendChild(title);
    row.appendChild(createElement('span', collection.present ? 'tag' : 'tag warn', collection.present ? 'present' : 'missing'));
    row.appendChild(createElement('span', 'meta', collection.present ? `${collection.bytes} bytes` : ''));
    const button = createElement('button', '', 'Preview');
    button.type = 'button';
    button.disabled = !collection.present;
    button.addEventListener('click', () => openArtifact(collection.path));
    row.appendChild(button);
    list.appendChild(row);
  });
}

function renderRecentRuns() {
  const list = $('#recent-runs-list');
  if (!list) return;
  list.innerHTML = '';
  if (!state.recentRuns || state.recentRuns.length === 0) {
    list.appendChild(createElement('p', 'meta', 'No previous Workbench runs found yet.'));
    return;
  }
  state.recentRuns.forEach((run) => {
    const row = createElement('div', 'recent-run-row');
    const title = createElement('div', 'artifact-title');
    title.appendChild(createElement('strong', '', run.title || run.folderName));
    title.appendChild(createElement('span', 'meta', run.outputDir));
    row.appendChild(title);
    row.appendChild(createElement('span', statusTag(run.analysisMode), run.analysisMode || 'missing'));
    row.appendChild(createElement('span', run.codexParseResultPresent ? 'tag' : 'tag muted', run.codexParseResultPresent ? 'Codex result' : 'seed only'));
    row.appendChild(createElement('span', 'meta', new Date(run.lastModifiedAt).toLocaleString()));
    const button = createElement('button', '', 'Open');
    button.type = 'button';
    button.addEventListener('click', () => openRecentRun(run.outputDir).catch((error) => log(error.message)));
    row.appendChild(button);
    list.appendChild(row);
  });
}


function provenanceSummary(record) {
  const chunks = record?.sourceChunkIds || [];
  const confidence = record?.confidence || 'unknown';
  const mode = record?.attributionMode || 'source-derived';
  return [mode, confidence, chunks.slice(0, 2).join(', ')].filter(Boolean).join(' | ');
}

function renderRecordList(target, records, renderRecord, emptyText) {
  target.innerHTML = '';
  if (!records || records.length === 0) {
    target.appendChild(createElement('p', 'meta', emptyText));
    return;
  }
  records.slice(0, 12).forEach((record) => {
    target.appendChild(renderRecord(record));
  });
}

function statusTag(status) {
  if (/contradicted|rejected|unsupported|failed/i.test(status || '')) return 'tag danger';
  if (/weak|needs|unverified|seed/i.test(status || '')) return 'tag warn';
  return 'tag';
}

function renderSemanticParse() {
  const analysis = getArtifact('brief-analysis.json');
  const choiceGraph = getArtifact('semantic-choice-graph.json');
  const seed = getArtifact('structured-brief.seed.json') || getArtifact('structured-brief.json');
  const summary = $('#semantic-summary');
  const subject = $('#semantic-subject');
  const subcategories = $('#semantic-subcategories');
  const characteristics = $('#semantic-characteristics');
  const gaps = $('#semantic-gaps');
  const graph = $('#semantic-graph-plan');
  const choiceGraphNode = $('#semantic-choice-graph');
  const modeBadge = $('#semantic-mode-badge');
  const statusNote = $('#semantic-status-note');
  if (!summary || !subject || !subcategories || !characteristics || !gaps || !graph || !choiceGraphNode) return;
  [summary, subject, subcategories, characteristics, gaps, graph, choiceGraphNode].forEach((node) => { node.innerHTML = ''; });
  const modeLabel = semanticStatusLabel();
  if (modeBadge) {
    modeBadge.textContent = modeLabel;
    modeBadge.className = `parse-mode-badge ${modeLabel}`;
  }
  const runCodexButton = $('#run-codex-button');
  const forceCodexButton = $('#force-codex-button');
  const codexStatus = state.folder?.semanticStatus?.codexRunStatus;
  const isRunning = codexStatus?.status === 'running';
  const hasCodexResult = Boolean(state.folder?.semanticStatus?.codexParseResultPresent);
  if (runCodexButton) {
    runCodexButton.disabled = !state.outputDir || isRunning;
    runCodexButton.textContent = isRunning
      ? 'Codex Semantic Parse Running...'
      : hasCodexResult
        ? 'Rebuild from Existing Codex Result'
        : 'Run Codex Semantic Parse';
  }
  if (forceCodexButton) {
    forceCodexButton.disabled = !state.outputDir || isRunning;
  }
  if (statusNote) {
    const runLog = getArtifact('codex-run-log.json');
    const logSummary = summarizeCodexRunLog(runLog);
    let note = 'This run is seed-only. It has chunk/evidence hints, but Codex has not performed semantic extraction yet.';
    if (modeLabel === 'codex-semantic') {
      note = 'Codex semantic analysis is active for this run. The default action reuses this result and rebuilds artifacts without spending another Codex run.';
    } else if (modeLabel === 'rebuild-needed') {
      note = 'codex-parse-result.json exists, but brief-analysis.json is not semantic yet. Rebuild from the existing Codex result instead of rerunning Codex.';
    } else if (codexStatus?.status === 'running') {
      note = 'Codex semantic parse is running. This can take several minutes.';
    } else if (codexStatus?.status === 'stale') {
      note = `Previous Codex semantic parse became stale: ${codexStatus.message || 'no completion log was written'}`;
    } else if (codexStatus?.status === 'timeout') {
      note = `Codex semantic parse timed out. ${logSummary}`;
    } else if (codexStatus?.status === 'failed') {
      note = `Codex semantic parse failed: ${codexStatus.message || 'see codex-run-log.json'}${logSummary ? `\n${logSummary}` : ''}`;
    }
    statusNote.textContent = note;
    statusNote.className = `semantic-status-note ${modeLabel} ${codexStatus?.status || ''}`;
  }

  const counts = [
    ['Analysis mode', analysis?.analysisMode || 'not loaded'],
    ['Subcategories', analysis?.subcategoryCandidates?.length || 0],
    ['Evidence checks', analysis?.subcategoryEvidenceChecks?.length || 0],
    ['Characteristics', analysis?.subcategoryCharacteristics?.length || 0],
    ['Graph nodes', analysis?.graphAssemblyPlan?.nodes?.length || 0],
    ['Choice axes', choiceGraph?.axes?.length || 0]
  ];
  counts.forEach(([label, value]) => {
    const item = createElement('div', 'summary-item');
    item.appendChild(createElement('strong', '', String(value)));
    item.appendChild(createElement('span', '', label));
    summary.appendChild(item);
  });

  if (!analysis) {
    subject.appendChild(createElement('p', 'meta', 'brief-analysis.json is not loaded. Run Metagrinder to generate a seed analysis, then import a Codex semantic parse result.'));
    return;
  }

  const mode = analysis.analysisMode === 'codex-semantic' || analysis.analysisMode === 'codex-imported'
    ? 'Codex semantic result imported'
    : 'Seed-only: deterministic parser hints, not semantic judgment';
  const subjectCard = createElement('div', 'structured-card');
  subjectCard.appendChild(createElement('h3', '', analysis.mainSubject?.label || 'Main subject not identified'));
  subjectCard.appendChild(createElement('p', 'meta', `${analysis.subjectType || 'brief'} | ${mode}`));
  subjectCard.appendChild(createElement('p', '', analysis.mainSubject?.summary || ''));
  subject.appendChild(subjectCard);

  renderRecordList(subcategories, analysis.subcategoryCandidates, (candidate) => {
    const row = createElement('div', 'structured-card');
    row.appendChild(createElement('h3', '', candidate.label));
    const tags = createElement('div', 'tag-row');
    tags.appendChild(createElement('span', statusTag(candidate.supportStatus), candidate.supportStatus));
    tags.appendChild(createElement('span', statusTag(candidate.validationStatus), candidate.validationStatus));
    tags.appendChild(createElement('span', 'tag', candidate.confidence || 'unknown'));
    row.appendChild(tags);
    row.appendChild(createElement('p', '', candidate.evidenceSummary || candidate.excerptText || ''));
    row.appendChild(createElement('p', 'meta', provenanceSummary(candidate)));
    return row;
  }, 'No subject subcategories identified.');

  renderRecordList(characteristics, analysis.subcategoryCharacteristics, (item) => {
    const row = createElement('div', 'structured-card');
    row.appendChild(createElement('h3', '', item.label));
    row.appendChild(createElement('p', 'meta', `${item.characteristicType || 'attribute'} | ${provenanceSummary(item)}`));
    row.appendChild(createElement('p', '', (item.values || []).join(', ') || item.excerptText || ''));
    return row;
  }, 'No subcategory characteristics identified.');

  renderRecordList(gaps, analysis.researchGaps, (gap) => {
    const row = createElement('div', 'structured-card');
    row.appendChild(createElement('h3', '', gap.label));
    row.appendChild(createElement('p', 'meta', `${gap.recommendedAction || 'review'} | ${provenanceSummary(gap)}`));
    row.appendChild(createElement('p', '', gap.reason || gap.excerptText || ''));
    return row;
  }, 'No research gaps identified.');

  const graphPlan = analysis.graphAssemblyPlan || {};
  const graphCard = createElement('div', 'structured-card');
  graphCard.appendChild(createElement('h3', '', `Readiness: ${graphPlan.readiness || 'unknown'}`));
  graphCard.appendChild(createElement('p', 'meta', `${graphPlan.nodes?.length || 0} nodes | ${graphPlan.edges?.length || 0} edges`));
  graphCard.appendChild(createElement('pre', 'json-pane compact-json', json({
    nodes: (graphPlan.nodes || []).slice(0, 12),
    edges: (graphPlan.edges || []).slice(0, 12),
    notes: graphPlan.notes || []
  })));
  graph.appendChild(graphCard);

  if (choiceGraph) {
    (choiceGraph.axes || []).forEach((axis) => {
      const axisCard = createElement('div', 'structured-card');
      axisCard.appendChild(createElement('h3', '', axis.label || axis.axisId));
      axisCard.appendChild(createElement('p', 'meta', `${axis.axisType || 'choice'} | ${(axis.choices || []).length} choices`));
      const tags = createElement('div', 'tag-row');
      (axis.appliesWhen || []).forEach((condition) => {
        tags.appendChild(createElement('span', 'tag', `when ${condition.text}`));
      });
      if (tags.children.length > 0) axisCard.appendChild(tags);
      const list = createElement('ul', 'compact-list');
      (axis.choices || []).slice(0, 8).forEach((choice) => {
        const item = createElement('li', '', `${choice.text} (${choice.weight})`);
        const provenance = provenanceSummary(choice);
        if (provenance) item.title = provenance;
        list.appendChild(item);
      });
      axisCard.appendChild(list);
      choiceGraphNode.appendChild(axisCard);
    });
  } else {
    choiceGraphNode.appendChild(createElement('p', 'meta', 'semantic-choice-graph.json is missing. Rebuild from the existing Codex result before exporting semantic PSG.'));
  }

  $('#codex-result-json').value = '';
  $('#codex-import-note').textContent = analysis.analysisMode === 'codex-semantic' || analysis.analysisMode === 'codex-imported'
    ? 'Codex parse result has been imported and projected into this run.'
    : `Seed index available: ${seed?.entities?.length || 0} entities, ${seed?.weightedGroups?.length || 0} weights. Run Codex or paste codex-parse-result.json below to replace seed-only analysis.`;
}

function renderStructuredBrief() {
  const structured = getArtifact('structured-brief.seed.json') || getArtifact('structured-brief.json');
  const summary = $('#structured-summary');
  const coverage = $('#structured-coverage');
  const records = $('#structured-records');
  if (!summary || !coverage || !records) return;
  summary.innerHTML = '';
  coverage.innerHTML = '';
  records.innerHTML = '';
  const counts = [
    ['Entities', structured?.entities?.length || 0],
    ['Weighted Groups', structured?.weightedGroups?.length || 0],
    ['Rules', structured?.rules?.length || 0],
    ['Constraints', structured?.constraints?.length || 0],
    ['Citations', structured?.citations?.length || 0]
  ];
  counts.forEach(([label, value]) => {
    const item = createElement('div', 'summary-item');
    item.appendChild(createElement('strong', '', String(value)));
    item.appendChild(createElement('span', '', label));
    summary.appendChild(item);
  });
  if (!structured) {
    records.appendChild(createElement('p', 'meta', 'structured-brief.json not loaded for this run.'));
    return;
  }

  (structured.coverage || []).forEach((item) => {
    const row = createElement('div', 'coverage-row');
    row.appendChild(createElement('strong', '', item.category));
    row.appendChild(createElement('span', item.status === 'extracted' ? 'tag' : item.status === 'not-found' ? 'tag warn' : 'tag muted', item.status));
    row.appendChild(createElement('span', 'meta', String(item.count || 0) + ' records'));
    row.appendChild(createElement('p', 'meta', item.note || ''));
    coverage.appendChild(row);
  });

  const combinedRecords = [
    ...(structured.implementationFields || []).map((item) => ({ kind: 'field', label: item.fieldName, text: item.description || item.excerptText, meta: item.fieldType || 'field', sourceChunkIds: item.sourceChunkIds, confidence: item.confidence, attributionMode: item.attributionMode })),
    ...(structured.examples || []).map((item) => ({ kind: 'example', label: item.exampleId, text: item.exampleText, meta: item.exampleType, sourceChunkIds: item.sourceChunkIds, confidence: item.confidence, attributionMode: item.attributionMode })),
    ...(structured.citations || []).map((item) => ({ kind: 'citation', label: item.label || item.url, text: item.url, meta: item.verificationStatus, sourceChunkIds: item.sourceChunkIds, confidence: item.confidence, attributionMode: item.attributionMode }))
  ];
  const sections = [
    ['Entities', structured.entities, (entity) => {
      const row = createElement('div', 'structured-card');
      row.appendChild(createElement('h3', '', entity.label));
      row.appendChild(createElement('p', 'meta', entity.entityKind + ' | ' + provenanceSummary(entity)));
      row.appendChild(createElement('p', '', entity.summary || entity.excerptText || ''));
      return row;
    }, 'No entities detected.'],
    ['Weighted Groups', structured.weightedGroups, (weight) => {
      const row = createElement('div', 'structured-card');
      row.appendChild(createElement('h3', '', weight.label));
      row.appendChild(createElement('p', 'meta', String(weight.min) + '-' + String(weight.max) + ' ' + weight.unit + ' | ' + provenanceSummary(weight)));
      row.appendChild(createElement('p', '', weight.excerptText || ''));
      return row;
    }, 'No weighted groups detected.'],
    ['Rules', structured.rules, (rule) => {
      const row = createElement('div', 'structured-card');
      row.appendChild(createElement('h3', '', rule.ruleId));
      row.appendChild(createElement('p', 'meta', (rule.action || 'rule') + ' | ' + provenanceSummary(rule)));
      row.appendChild(createElement('p', '', rule.ruleText || rule.excerptText || ''));
      return row;
    }, 'No conditional rules detected.'],
    ['Constraints', structured.constraints, (constraint) => {
      const row = createElement('div', 'structured-card');
      row.appendChild(createElement('h3', '', constraint.constraintId));
      row.appendChild(createElement('p', 'meta', (constraint.constraintType || 'constraint') + ' | ' + provenanceSummary(constraint)));
      row.appendChild(createElement('p', '', constraint.constraintText || constraint.excerptText || ''));
      return row;
    }, 'No constraints detected.'],
    ['Implementation Fields / Examples / Citations', combinedRecords, (item) => {
      const row = createElement('div', 'structured-card');
      row.appendChild(createElement('h3', '', item.label || item.kind));
      row.appendChild(createElement('p', 'meta', item.kind + ' | ' + (item.meta || '') + ' | ' + provenanceSummary(item)));
      row.appendChild(createElement('p', '', item.text || ''));
      return row;
    }, 'No implementation fields, examples, or citations detected.']
  ];

  sections.forEach(([title, sectionRecords, renderer, emptyText]) => {
    const section = createElement('section', 'structured-section');
    section.appendChild(createElement('h3', '', title));
    const list = createElement('div', 'structured-list');
    renderRecordList(list, sectionRecords, renderer, emptyText);
    section.appendChild(list);
    records.appendChild(section);
  });
}

function renderGrammar() {
  const grammar = getArtifact('scene-grammar.json');
  const accepted = getArtifact('accepted-scene-grammar.json');
  const summary = $('#grammar-summary');
  summary.innerHTML = '';
  const items = [
    ['Archetypes', grammar?.archetypes?.length || 0],
    ['Location Zones', grammar?.locationZones?.length || 0],
    ['Compatibility Rules', grammar?.compatibilityRules?.length || 0],
    ['Accepted Revision Evidence', accepted?.acceptedRevisionEvidence?.length || 0]
  ];
  items.forEach(([label, value]) => {
    const item = createElement('div', 'summary-item');
    item.appendChild(createElement('strong', '', String(value)));
    item.appendChild(createElement('span', '', label));
    summary.appendChild(item);
  });
  $('#grammar-json').textContent = grammar ? json(grammar) : 'scene-grammar.json not loaded';
}

function renderCandidates() {
  const candidates = getArtifact('retrieval-candidates.json')?.candidates || [];
  const inspectionById = new Map((getArtifact('candidate-inspection.json')?.candidates || [])
    .map((candidate) => [candidate.candidateId, candidate]));
  const list = $('#candidate-review');
  list.innerHTML = '';
  candidates.forEach((candidate) => {
    const review = state.approvals.approvals.find((entry) => entry.candidateId === candidate.candidateId);
    const inspection = inspectionById.get(candidate.candidateId);
    const row = createElement('div', 'review-row');
    const title = createElement('div', 'review-title');
    title.appendChild(createElement('h3', '', candidate.title || candidate.candidateId));
    title.appendChild(createElement('span', '', `${candidate.candidateId} | ${candidate.domain || 'unknown domain'}`));
    title.appendChild(createElement('p', 'meta', candidate.snippet || ''));
    const tags = createElement('div', 'tag-row');
    tags.appendChild(createElement('span', 'tag', candidate.sourceTypeHypothesis || 'unknown'));
    tags.appendChild(createElement('span', 'tag', candidate.sourceQualityHypothesis || 'low'));
    tags.appendChild(createElement('span', candidate.canCreateSourceClaim ? 'tag danger' : 'tag', `canCreateSourceClaim=${candidate.canCreateSourceClaim}`));
    if (inspection?.payloadHash) tags.appendChild(createElement('span', 'tag', inspection.payloadHash));
    title.appendChild(tags);
    row.appendChild(title);
    row.appendChild(reviewControls(review, 'approvalStatus', ['pending', 'approved', 'rejected'], 'operatorNote'));
    list.appendChild(row);
  });
}

function renderClaims() {
  const evidenceById = new Map((getArtifact('source-evidence.json')?.evidence || [])
    .map((evidence) => [evidence.evidenceId, evidence]));
  const claims = getArtifact('source-claims.json')?.claims || [];
  const list = $('#claim-review');
  list.innerHTML = '';
  claims.forEach((claim) => {
    const review = state.claimReview.claimReviews.find((entry) => entry.sourceClaimId === claim.sourceClaimId);
    const excerpts = (claim.evidenceIds || [])
      .map((id) => evidenceById.get(id)?.excerptText)
      .filter(Boolean)
      .join('\n');
    const row = createElement('div', 'review-row');
    const title = createElement('div', 'review-title');
    title.appendChild(createElement('h3', '', claim.claim || claim.sourceClaimId));
    title.appendChild(createElement('span', '', `${claim.sourceClaimId} | ${claim.confidence || 'unknown'} confidence`));
    title.appendChild(createElement('p', 'meta', excerpts || 'No evidence excerpt linked.'));
    row.appendChild(title);
    row.appendChild(reviewControls(review, 'citationStatus', ['needs_review', 'accepted', 'rejected'], 'operatorNote'));
    list.appendChild(row);
  });
}

function renderRevisions() {
  const revisions = getArtifact('grammar-revisions.json')?.revisions || [];
  const list = $('#revision-review');
  list.innerHTML = '';
  revisions.forEach((revision) => {
    const review = state.revisionState.revisionStates.find((entry) => entry.revisionId === revision.revisionId);
    const row = createElement('div', 'review-row');
    const title = createElement('div', 'review-title');
    title.appendChild(createElement('h3', '', revision.revisionId));
    title.appendChild(createElement('span', '', `${revision.changeType || 'change'} | ${(revision.targetGrammarRefs || []).join(', ')}`));
    title.appendChild(createElement('p', 'meta', revision.proposedChange || revision.rationale || ''));
    row.appendChild(title);
    row.appendChild(reviewControls(review, 'reviewStatus', ['needs_review', 'accepted', 'rejected'], 'operatorNote'));
    list.appendChild(row);
  });
}

function renderDeltas() {
  const deltas = getArtifact('accepted-grammar-deltas.json')?.deltas || [];
  const list = $('#delta-list');
  list.innerHTML = '';
  deltas.forEach((delta) => {
    const row = createElement('div', 'review-row');
    const title = createElement('div', 'review-title');
    title.appendChild(createElement('h3', '', delta.targetGrammarRef || delta.deltaId));
    title.appendChild(createElement('span', '', `${delta.changeType} | material=${delta.materialChange}`));
    title.appendChild(createElement('pre', 'json-pane', json({ before: delta.before, after: delta.after, warnings: delta.warnings || [] })));
    row.appendChild(title);
    list.appendChild(row);
  });
}

function renderPsg() {
  const psgArtifacts = (state.folder?.collections || []).filter((collection) =>
    collection.present && (collection.path.endsWith('.psg') || collection.type.includes('psg') || collection.type === 'branch-graph')
  );
  const list = $('#psg-list');
  list.innerHTML = '';
  const summary = $('#psg-export-summary');
  if (summary) {
    summary.innerHTML = '';
    const primary = psgArtifacts.find((artifact) => artifact.path === 'scene-grammar.psg');
    const branchCount = psgArtifacts.filter((artifact) => artifact.type === 'branch-graph').length;
    const card = createElement('div', 'export-card');
    card.appendChild(createElement('h3', '', 'Export Targets'));
    card.appendChild(createElement('p', 'meta', primary
      ? `Primary graph: ${primary.path}. Optional branch/reference graphs: ${branchCount}. Use the primary graph first; branch graphs are compile-time views for zones, constraints, or reference routing.`
      : `No primary scene grammar PSG is present. Branch graphs: ${branchCount}.`));
    if (primary) {
      const actions = createElement('div', 'button-row');
      const preview = createElement('button', '', 'Preview Primary PSG');
      preview.type = 'button';
      preview.addEventListener('click', () => openArtifact(primary.path));
      const download = createElement('button', '', 'Download Primary PSG');
      download.type = 'button';
      download.addEventListener('click', () => downloadArtifact(primary.path).catch((error) => {
        log(error.message);
        showToast(error.message, 'error');
      }));
      const copy = createElement('button', '', 'Copy Primary Path');
      copy.type = 'button';
      copy.addEventListener('click', () => copyTextToClipboard(artifactFullPath(primary.path), 'Primary PSG path copied.'));
      actions.append(preview, download, copy);
      card.appendChild(actions);
    }
    summary.appendChild(card);
  }
  psgArtifacts.forEach((artifact) => {
    const row = createElement('div', 'artifact-row');
    const title = createElement('div', 'artifact-title');
    const readableType = artifact.path === 'scene-grammar.psg'
      ? 'primary prompt graph'
      : artifact.type === 'branch-graph'
        ? 'optional branch/reference graph'
        : artifact.type;
    title.appendChild(createElement('strong', '', readableType));
    title.appendChild(createElement('span', '', artifact.path));
    row.appendChild(title);
    row.appendChild(createElement('span', 'tag', 'Prompt Spaghetti PSG'));
    row.appendChild(createElement('span', 'meta', `${artifact.bytes} bytes`));
    const button = createElement('button', '', 'Preview');
    button.type = 'button';
    button.addEventListener('click', () => openArtifact(artifact.path));
    row.appendChild(button);
    const download = createElement('button', '', 'Download');
    download.type = 'button';
    download.addEventListener('click', () => downloadArtifact(artifact.path).catch((error) => {
      log(error.message);
      showToast(error.message, 'error');
    }));
    row.appendChild(download);
    const copy = createElement('button', '', 'Copy Path');
    copy.type = 'button';
    copy.addEventListener('click', () => copyTextToClipboard(artifactFullPath(artifact.path), `${artifact.path} path copied.`));
    row.appendChild(copy);
    list.appendChild(row);
  });
  renderReadabilityFlight();
}

function summarizeSweetenRunLog(logArtifact) {
  if (!logArtifact) return '';
  const parts = [];
  if (logArtifact.status) parts.push(`status: ${logArtifact.status}`);
  if (logArtifact.exitCode !== undefined) parts.push(`exit code: ${logArtifact.exitCode}`);
  if (logArtifact.stderr) parts.push(`stderr: ${String(logArtifact.stderr).slice(0, 700)}`);
  if (!logArtifact.stderr && logArtifact.stdout) parts.push(`stdout: ${String(logArtifact.stdout).slice(0, 700)}`);
  if (Array.isArray(logArtifact.warnings) && logArtifact.warnings.length > 0) {
    parts.push(`warnings: ${logArtifact.warnings.join(' | ')}`);
  }
  return parts.join('\n');
}

function renderReadabilityFlight() {
  const badge = $('#readability-status-badge');
  const summary = $('#readability-summary');
  const samples = $('#readability-samples');
  const rewrites = $('#readability-rewrites');
  const runFlightButton = $('#run-flight-button');
  const runSweetenButton = $('#run-sweeten-button');
  if (!badge || !summary || !samples || !rewrites) return;

  const outputFlight = getArtifact('psg-output-flight.json');
  const review = getArtifact('psg-readability-review.json');
  const sweetenResult = getArtifact('codex-sweeten-result.json');
  const sweetenStatus = getArtifact('codex-sweeten-run-status.json');
  const sweetenLog = getArtifact('codex-sweeten-run-log.json');
  const status = sweetenStatus?.status === 'running'
    ? 'review-running'
    : sweetenStatus?.status === 'failed' || sweetenStatus?.status === 'timeout'
      ? 'failed'
      : sweetenResult
        ? 'sweetened'
        : review?.readabilityStatus || state.folder?.readabilityStatus?.status || 'missing';

  badge.textContent = status;
  badge.className = `parse-mode-badge ${status}`;
  const canRun = Boolean(state.outputDir && getArtifact('semantic-choice-graph.json') && getArtifact('scene-grammar.psg'));
  if (runFlightButton) {
    runFlightButton.disabled = !canRun || sweetenStatus?.status === 'running';
  }
  if (runSweetenButton) {
    runSweetenButton.disabled = !canRun || sweetenStatus?.status === 'running';
    runSweetenButton.textContent = sweetenStatus?.status === 'running'
      ? 'Readability Review Running...'
      : 'Run Readability Review';
  }

  let note = canRun
    ? 'Ready to sample prompt outputs from the current PSG. Normal rebuilds do not spend Codex.'
    : 'semantic-choice-graph.json and scene-grammar.psg are required before readability review.';
  if (review) {
    note = `${review.findings?.length || 0} readability findings across ${outputFlight?.samples?.length || 0} sampled outputs. Status: ${review.readabilityStatus}.`;
  }
  if (sweetenStatus?.status === 'running') {
    note = 'Codex readability sweetening is running. It can only propose text rewrites for existing choice IDs.';
  } else if (sweetenStatus?.status === 'failed' || sweetenStatus?.status === 'timeout') {
    note = `Codex readability sweetening ${sweetenStatus.status}. ${summarizeSweetenRunLog(sweetenLog)}`;
  } else if (sweetenResult) {
    note = `Applied ${review?.appliedRewriteCount || sweetenResult.rewrites?.length || 0} text-only choice rewrites.`;
  }
  summary.textContent = note;
  summary.className = `semantic-status-note ${status}`;

  samples.innerHTML = '';
  if (!outputFlight?.samples?.length) {
    samples.appendChild(createElement('p', 'meta', 'No output flight has been generated yet.'));
  } else {
    outputFlight.samples.slice(0, 20).forEach((sample) => {
      const card = createElement('div', 'sample-card');
      card.appendChild(createElement('strong', '', `Seed ${sample.seed}`));
      card.appendChild(createElement('p', '', sample.outputText));
      const choices = (sample.selectedChoices || [])
        .map((choice) => `${choice.axisLabel}: ${choice.text}`)
        .join(' | ');
      card.appendChild(createElement('p', 'meta', choices));
      samples.appendChild(card);
    });
  }

  rewrites.innerHTML = '';
  const rewriteEntries = sweetenResult?.rewrites || [];
  if (rewriteEntries.length === 0) {
    const findingCount = review?.findings?.length || 0;
    rewrites.appendChild(createElement('p', 'meta', findingCount
      ? `${findingCount} findings are available. Run Readability Review to ask Codex for text-only rewrites.`
      : 'No choice text rewrites have been applied.'));
    return;
  }
  rewriteEntries.forEach((rewrite) => {
    const row = createElement('div', 'structured-card');
    row.appendChild(createElement('h3', '', rewrite.choiceId));
    row.appendChild(createElement('p', 'meta', rewrite.reason || 'text-only readability rewrite'));
    row.appendChild(createElement('p', '', `Before: ${rewrite.beforeText}`));
    row.appendChild(createElement('p', '', `After: ${rewrite.afterText}`));
    rewrites.appendChild(row);
  });
}

function reviewControls(record, statusKey, statuses, noteKey) {
  const controls = createElement('div', 'review-controls');
  const select = createElement('select');
  statuses.forEach((status) => {
    const option = createElement('option', '', status);
    option.value = status;
    option.selected = record?.[statusKey] === status;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    record[statusKey] = select.value;
    record.reviewedAt = new Date().toISOString();
  });
  const note = createElement('textarea');
  note.placeholder = 'Operator note';
  note.value = record?.[noteKey] || '';
  note.addEventListener('input', () => {
    record[noteKey] = note.value;
    record.reviewedAt = new Date().toISOString();
  });
  controls.appendChild(select);
  controls.appendChild(note);
  return controls;
}

async function saveState(fileName, data) {
  const result = await fetchJson('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outputDir: state.outputDir,
      fileName,
      data
    })
  });
  log(`Saved ${fileName} (${result.bytes} bytes).`);
  await openFolder();
}

async function loadRecentRuns({ render = true } = {}) {
  const root = $('#output-root')?.value?.trim() || state.recentRunsRoot;
  state.recentRunsRoot = root;
  const payload = await fetchJson(`/api/recent-runs?root=${encodeURIComponent(root)}&limit=20`);
  state.recentRuns = payload.runs || [];
  if (render) renderRecentRuns();
  return payload;
}

async function openRecentRun(outputDir) {
  $('#output-dir').value = outputDir;
  state.outputDir = outputDir;
  await openFolder();
  const mode = state.folder?.semanticStatus?.analysisMode;
  activateScreen(mode === 'codex-semantic' || state.folder?.semanticStatus?.codexParseResultPresent ? 'semantic' : 'dashboard');
}

async function importCodexParseResult() {
  if (!state.outputDir) {
    log('Open or run a Metagrinder output folder before importing a Codex parse result.');
    return;
  }
  const raw = $('#codex-result-json').value.trim();
  if (!raw) {
    log('Paste codex-parse-result.json content before importing.');
    return;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    log(`Codex parse result is not valid JSON: ${error.message}`);
    return;
  }
  setRunning(true, 'Importing Codex semantic result...');
  try {
    const result = await fetchJson('/api/import-codex-parse-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputDir: state.outputDir,
        data,
        rebuild: true
      })
    });
    log(`Imported ${result.fileName} (${result.bytes} bytes). Analysis mode: ${result.analysisMode}.`);
    await openFolder();
    activateScreen('semantic');
    setRunning(false, result.analysisMode === 'codex-semantic' ? 'Codex semantic parse complete.' : 'Codex result imported.');
  } catch (error) {
    setRunning(false, 'Codex import failed.');
    throw error;
  }
}

async function runCodexSemanticParse() {
  if (!state.outputDir) {
    log('Open or run a Metagrinder output folder before running Codex semantic parse.');
    return;
  }
  if (state.folder?.semanticStatus?.codexParseResultPresent) {
    await rebuildFromExistingCodexResult();
    return;
  }
  await forceRunCodexSemanticParse();
}

async function rebuildFromExistingCodexResult() {
  if (!state.outputDir) {
    log('Open or run a Metagrinder output folder before rebuilding from Codex.');
    return;
  }
  setRunning(true, 'Rebuilding from existing Codex result...');
  log('Reusing codex-parse-result.json and rebuilding Metagrinder artifacts...');
  try {
    const result = await fetchJson('/api/rebuild-from-existing-codex-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputDir: state.outputDir,
        compileGrammar: 'accepted'
      })
    });
    log(`${result.stdout || ''}\n${result.stderr || ''}`.trim() || `Rebuilt from existing Codex result. Analysis mode: ${result.analysisMode}`);
    await openFolder();
    activateScreen('semantic');
    setRunning(false, result.analysisMode === 'codex-semantic' ? 'Semantic rebuild complete.' : 'Rebuild complete.');
  } catch (error) {
    setRunning(false, 'Semantic rebuild failed.');
    throw error;
  }
}

async function forceRunCodexSemanticParse() {
  if (!state.outputDir) {
    log('Open or run a Metagrinder output folder before running Codex semantic parse.');
    return;
  }
  setRunning(true, 'Running Codex semantic parse...');
  log('Running local Codex against codex-parse-request.md...');
  const runCodexButton = $('#run-codex-button');
  if (runCodexButton) {
    runCodexButton.disabled = true;
    runCodexButton.textContent = 'Codex Semantic Parse Running...';
  }
  let poller = null;
  const pollStatus = async () => {
    try {
      await refreshOpenFolder({ render: true });
      const codexStatus = state.folder?.semanticStatus?.codexRunStatus;
      if (codexStatus?.status === 'running') {
        setRunning(true, 'Codex semantic parse is still running...');
      }
    } catch {
      // Polling should not interrupt the long-running parse request.
    }
  };
  try {
    poller = setInterval(pollStatus, 5000);
    setTimeout(pollStatus, 1000);
    const result = await fetchJson('/api/run-codex-semantic-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputDir: state.outputDir
      })
    });
    if (poller) clearInterval(poller);
    log(`${result.stdout || ''}\n${result.stderr || ''}`.trim() || `Codex semantic parse ${result.status}. Analysis mode: ${result.analysisMode}`);
    await openFolder();
    activateScreen('semantic');
    setRunning(false, result.analysisMode === 'codex-semantic' ? 'Codex semantic parse complete.' : 'Codex parse finished.');
  } catch (error) {
    if (poller) clearInterval(poller);
    setRunning(false, 'Codex semantic parse failed.');
    await openFolder().catch(() => {});
    throw error;
  }
}

async function runPsgOutputFlight() {
  if (!state.outputDir) {
    log('Open or run a Metagrinder output folder before running a readability flight.');
    return;
  }
  setRunning(true, 'Sampling 20 PSG outputs...');
  try {
    const result = await fetchJson('/api/run-psg-output-flight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputDir: state.outputDir,
        graphPath: 'scene-grammar.psg',
        sampleCount: 20
      })
    });
    log(`Readability flight generated ${result.sampleCount} outputs with ${result.findingCount} findings.`);
    await openFolder();
    activateScreen('psg');
    setRunning(false, 'Readability flight complete.');
  } catch (error) {
    setRunning(false, 'Readability flight failed.');
    throw error;
  }
}

async function runCodexReadabilitySweeten() {
  if (!state.outputDir) {
    log('Open or run a Metagrinder output folder before running readability review.');
    return;
  }
  setRunning(true, 'Running Codex readability review...');
  log('Sampling outputs and running local Codex to sweeten existing choice text only...');
  const button = $('#run-sweeten-button');
  if (button) {
    button.disabled = true;
    button.textContent = 'Readability Review Running...';
  }
  let poller = null;
  const pollStatus = async () => {
    try {
      await refreshOpenFolder({ render: true });
      const status = getArtifact('codex-sweeten-run-status.json');
      if (status?.status === 'running') {
        setRunning(true, 'Codex readability review is still running...');
      }
    } catch {
      // Polling should not interrupt the long-running review request.
    }
  };
  try {
    poller = setInterval(pollStatus, 5000);
    setTimeout(pollStatus, 1000);
    const result = await fetchJson('/api/run-codex-readability-sweeten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputDir: state.outputDir,
        graphPath: 'scene-grammar.psg',
        sampleCount: 20,
        apply: true
      })
    });
    if (poller) clearInterval(poller);
    log(`${result.stdout || ''}\n${result.stderr || ''}`.trim() || `Readability review ${result.status}. Applied ${result.appliedRewriteCount || 0} rewrites.`);
    await openFolder();
    activateScreen('psg');
    setRunning(false, `Readability review complete. Applied ${result.appliedRewriteCount || 0} rewrites.`);
  } catch (error) {
    if (poller) clearInterval(poller);
    setRunning(false, 'Readability review failed.');
    await openFolder().catch(() => {});
    throw error;
  }
}

async function openArtifact(artifactPath) {
  if (!state.outputDir) return;
  const response = await fetch(artifactUrl(artifactPath));
  const text = await response.text();
  showArtifactPreview({ artifactPath, text });
}

async function downloadArtifact(artifactPath) {
  if (!state.outputDir) {
    showToast('No output folder loaded.', 'warn');
    return;
  }
  showToast(`Preparing ${artifactPath}...`);
  const response = await fetch(artifactUrl(artifactPath));
  if (!response.ok) {
    throw new Error(`Download failed for ${artifactPath}: ${response.status}`);
  }
  const blob = await response.blob();
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = artifactPath.split('/').pop() || 'metagrinder-artifact';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  log(`Download started: ${artifactPath}`);
  showToast(`Download started: ${artifactPath}`);
}

async function copyTextToClipboard(text, successMessage) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API unavailable.');
    }
    log(successMessage);
    showToast(successMessage);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    textarea.remove();
    if (copied) {
      log(successMessage);
      showToast(successMessage);
      return;
    }
    log(`Copy failed. Path: ${text}`);
    showToast('Copy failed. Path was written to Run details.', 'warn');
  }
}

function artifactFullPath(artifactPath) {
  const separator = state.outputDir.includes('\\') ? '\\' : '/';
  return `${state.outputDir.replace(/[\\/]+$/, '')}${separator}${artifactPath.replace(/\//g, separator)}`;
}

function addResearchInput(kind = 'paste') {
  state.researchInputs.push({
    id: `input-${Date.now()}-${state.researchInputs.length}`,
    kind,
    title: kind === 'file' ? 'Source file' : 'Pasted text',
    text: '',
    path: ''
  });
  renderResearchInputs();
}

function removeResearchInput(id) {
  state.researchInputs = state.researchInputs.filter((input) => input.id !== id);
  renderResearchInputs();
}

function renderResearchInputs() {
  const list = $('#research-input-list');
  if (!list) return;
  list.innerHTML = '';
  if (state.researchInputs.length === 0) {
    addResearchInput('paste');
    return;
  }
  state.researchInputs.forEach((input, index) => {
    const row = createElement('div', 'research-input-row');
    const head = createElement('div', 'research-input-head');
    head.appendChild(createElement('h3', '', input.kind === 'file' ? `File source ${index + 1}` : `Text source ${index + 1}`));
    const remove = createElement('button', '', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => removeResearchInput(input.id));
    head.appendChild(remove);
    row.appendChild(head);

    const titleLabel = createElement('label', '', 'Source title');
    const title = createElement('input');
    title.type = 'text';
    title.value = input.title || '';
    title.addEventListener('input', () => { input.title = title.value; });
    titleLabel.appendChild(title);
    row.appendChild(titleLabel);

    if (input.kind === 'file') {
      const pathLabel = createElement('label', '', 'Source file');
      const pathInput = createElement('div', 'path-input');
      const field = createElement('input');
      field.id = `${input.id}-path`;
      field.type = 'text';
      field.value = input.path || '';
      field.placeholder = 'Select a local research file';
      field.addEventListener('input', () => { input.path = field.value; });
      const browse = createElement('button', 'browse-button');
      browse.type = 'button';
      browse.setAttribute('aria-label', 'Select source file');
      browse.appendChild(createElement('span', 'folder-icon'));
      browse.addEventListener('click', () => openPathPicker({ targetId: field.id, kind: 'file', onSelect: (selectedPath) => { input.path = selectedPath; } }));
      pathInput.appendChild(field);
      pathInput.appendChild(browse);
      pathLabel.appendChild(pathInput);
      row.appendChild(pathLabel);
    } else {
      const textLabel = createElement('label', 'article-text-label', 'Source text');
      const text = createElement('textarea');
      text.value = input.text || '';
      text.placeholder = 'Paste research text here';
      text.addEventListener('input', () => { input.text = text.value; });
      textLabel.appendChild(text);
      row.appendChild(textLabel);
    }
    list.appendChild(row);
  });
}

function collectResearchInputs() {
  return state.researchInputs.map((input) => ({
    kind: input.kind,
    title: input.title,
    text: input.text,
    path: input.path
  }));
}
async function loadPathPicker(browsePath = '') {
  const params = new URLSearchParams({ kind: state.pathPicker.kind });
  if (browsePath) params.set('path', browsePath);
  const payload = await fetchJson(`/api/browse?${params.toString()}`);
  state.pathPicker.currentPath = payload.currentPath;
  state.pathPicker.parentPath = payload.parentPath;
  $('#path-picker-current-path').textContent = payload.currentPath || 'Available roots';
  $('#path-picker-use-current').disabled = state.pathPicker.kind === 'file' || !payload.currentPath;
  $('#path-picker-up').disabled = !payload.parentPath;
  const list = $('#path-picker-list');
  list.innerHTML = '';
  payload.entries.forEach((entry) => {
    const row = createElement('div', 'path-picker-entry');
    row.appendChild(createElement('strong', '', entry.kind));
    row.appendChild(createElement('span', '', entry.path));
    const button = createElement('button', '', entry.kind === 'folder' ? 'Open' : 'Select');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (entry.kind === 'folder') {
        loadPathPicker(entry.path).catch((error) => log(error.message));
        return;
      }
      selectPath(entry.path);
    });
    row.appendChild(button);
    if (entry.kind === 'folder' && state.pathPicker.kind === 'folder') {
      row.addEventListener('dblclick', () => selectPath(entry.path));
    }
    list.appendChild(row);
  });
}

function openPathPicker({ targetId, kind, onSelect }) {
  state.pathPicker.targetId = targetId;
  state.pathPicker.kind = kind;
  state.pathPicker.onSelect = onSelect || null;
  const currentValue = $(`#${targetId}`).value.trim();
  $('#path-picker-title').textContent = kind === 'file' ? 'Select Source Input File' : 'Select Folder';
  $('#path-picker-modal').hidden = false;
  loadPathPicker(currentValue).catch(() => loadPathPicker('').catch((error) => log(error.message)));
}

function closePathPicker() {
  $('#path-picker-modal').hidden = true;
}

function selectPath(selectedPath) {
  if (state.pathPicker.targetId) {
    $(`#${state.pathPicker.targetId}`).value = selectedPath;
  }
  if (state.pathPicker.onSelect) {
    state.pathPicker.onSelect(selectedPath);
  }
  closePathPicker();
}
async function runResearchInputs() {
  const title = $('#article-title').value.trim();
  const outputRoot = $('#output-root').value.trim() || 'tmp/metagrinder-workbench-runs';
  const inputs = collectResearchInputs();
  setRunning(true, 'Running Metagrinder...');
  log('Creating a new Metagrinder run...');
  try {
    const result = await fetchJson('/api/run-research-inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        outputRoot,
        inputs
      })
    });
    $('#output-dir').value = result.outputDir;
    $('#input-path').value = result.inputPath;
    state.outputDir = result.outputDir;
    log(`${result.stdout || ''}\n${result.stderr || ''}`.trim() || `Generated ${result.outputDir}`);
    await openFolder();
    activateScreen('semantic');
    setRunning(false, 'Run complete.');
  } catch (error) {
    setRunning(false, 'Run failed.');
    throw error;
  }
}
async function parsePastedArticle() {
  const title = $('#article-title').value.trim();
  const articleText = $('#article-text').value;
  const outputRoot = $('#output-root').value.trim() || 'tmp/metagrinder-workbench-runs';
  if (!articleText.trim()) {
    log('Paste article text before parsing.');
    return;
  }
  log('Saving pasted article and running Metagrinder...');
  const result = await fetchJson('/api/run-pasted-article', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      articleText,
      outputRoot
    })
  });
  $('#output-dir').value = result.outputDir;
  $('#input-path').value = result.inputPath;
  state.outputDir = result.outputDir;
  log(`${result.stdout || ''}\n${result.stderr || ''}`.trim() || `Generated ${result.outputDir}`);
  await openFolder();
}
async function rerunPipeline() {
  const outputDir = $('#output-dir').value.trim();
  const inputPath = $('#input-path').value.trim();
  const compileGrammar = $('#compile-grammar').value;
  const stateFiles = {
    revisionStateFile: `${outputDir}/revision-state.json`,
    sourceIntakeApprovalFile: `${outputDir}/source-intake-approval.json`,
    sourceClaimReviewFile: `${outputDir}/source-claim-review.json`,
    retrievalPolicyFile: `${outputDir}/retrieval-policy.json`
  };
  const policyText = $('#policy-json').value.trim();
  if (policyText) {
    state.retrievalPolicy = JSON.parse(policyText);
    await saveState('retrieval-policy.json', state.retrievalPolicy);
  }
  setRunning(true, 'Rerunning Metagrinder...');
  log('Running Metagrinder pipeline...');
  try {
    const result = await fetchJson('/api/rerun', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outputDir,
        inputPath,
        title: 'Metagrinder Workbench Run',
        compileGrammar,
        stateFiles
      })
    });
    log(`${result.stdout}\n${result.stderr}`.trim());
    await openFolder();
    activateScreen('dashboard');
    setRunning(false, 'Rerun complete.');
  } catch (error) {
    setRunning(false, 'Rerun failed.');
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  initializeNav();
  renderResearchInputs();
  loadRecentRuns().catch((error) => log(error.message));
  $('#open-folder-button').addEventListener('click', () => openFolder().catch((error) => log(error.message)));
  $('#refresh-button').addEventListener('click', () => openFolder().catch((error) => log(error.message)));
  $('#refresh-recent-runs-button').addEventListener('click', () => loadRecentRuns().catch((error) => log(error.message)));
  $('#rerun-button').addEventListener('click', () => rerunPipeline().catch((error) => log(error.message)));
  $('#run-metagrinder-button').addEventListener('click', () => runResearchInputs().catch((error) => log(error.message)));
  $('#run-codex-button').addEventListener('click', () => runCodexSemanticParse().catch((error) => log(error.message)));
  $('#force-codex-button').addEventListener('click', () => forceRunCodexSemanticParse().catch((error) => log(error.message)));
  $('#run-flight-button').addEventListener('click', () => runPsgOutputFlight().catch((error) => log(error.message)));
  $('#run-sweeten-button').addEventListener('click', () => runCodexReadabilitySweeten().catch((error) => log(error.message)));
  $('#copy-output-folder-button').addEventListener('click', () => {
    if (!state.outputDir) {
      log('No output folder loaded.');
      return;
    }
    copyTextToClipboard(state.outputDir, 'Output folder path copied.');
  });
  $('#add-paste-input-button').addEventListener('click', () => addResearchInput('paste'));
  $('#add-file-input-button').addEventListener('click', () => addResearchInput('file'));
  $('#theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.querySelectorAll('[data-picker-target]').forEach((button) => {
    button.addEventListener('click', () => openPathPicker({
      targetId: button.dataset.pickerTarget,
      kind: button.dataset.pickerKind || 'folder'
    }));
  });
  $('#path-picker-close').addEventListener('click', closePathPicker);
  $('#artifact-preview-close').addEventListener('click', closeArtifactPreview);
  $('#path-picker-up').addEventListener('click', () => loadPathPicker(state.pathPicker.parentPath).catch((error) => log(error.message)));
  $('#path-picker-use-current').addEventListener('click', () => selectPath(state.pathPicker.currentPath));
  $('#save-approvals-button').addEventListener('click', () => saveState('source-intake-approval.json', state.approvals).catch((error) => log(error.message)));
  $('#save-claim-review-button').addEventListener('click', () => saveState('source-claim-review.json', state.claimReview).catch((error) => log(error.message)));
  $('#save-revision-state-button').addEventListener('click', () => saveState('revision-state.json', state.revisionState).catch((error) => log(error.message)));
  $('#import-codex-result-button').addEventListener('click', () => importCodexParseResult().catch((error) => log(error.message)));
  $('#save-policy-button').addEventListener('click', () => {
    try {
      state.retrievalPolicy = JSON.parse($('#policy-json').value);
      saveState('retrieval-policy.json', state.retrievalPolicy).catch((error) => log(error.message));
    } catch (error) {
      log(`retrieval-policy.json is not valid JSON: ${error.message}`);
    }
  });
  document.querySelectorAll('[data-artifact-open]').forEach((button) => {
    button.addEventListener('click', () => openArtifact(button.dataset.artifactOpen).catch((error) => log(error.message)));
  });
});

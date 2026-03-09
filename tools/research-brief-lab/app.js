(function () {
  const api = window.MetagrinderResearchBriefPreparser;
  const rawInput = document.getElementById('raw-input');
  const normalizedOutput = document.getElementById('normalized-output');
  const diagnosticsList = document.getElementById('diagnostics-list');
  const titleInput = document.getElementById('draft-title');
  const normalizeButton = document.getElementById('normalize-button');
  const copyButton = document.getElementById('copy-button');
  const loadSampleButton = document.getElementById('load-sample-button');

  function renderDiagnostics(diagnostics) {
    diagnosticsList.innerHTML = '';
    const values = diagnostics.length > 0
      ? diagnostics
      : ['No structural repairs were detected. The draft may already be well formed.'];

    values.forEach((value) => {
      const item = document.createElement('li');
      item.textContent = value;
      diagnosticsList.appendChild(item);
    });
  }

  function buildDraft(rawText) {
    if (!rawText.trim()) {
      normalizedOutput.value = '';
      renderDiagnostics([]);
      return;
    }

    const result = api.preparseResearchBrief(rawText);
    const title = titleInput.value.trim();
    normalizedOutput.value = title
      ? `# ${title}\n\n${result.normalizedText}`
      : result.normalizedText;
    renderDiagnostics(result.diagnostics);
  }

  normalizeButton.addEventListener('click', () => {
    buildDraft(rawInput.value);
  });

  copyButton.addEventListener('click', async () => {
    if (!normalizedOutput.value.trim()) {
      buildDraft(rawInput.value);
    }
    if (!normalizedOutput.value.trim()) {
      return;
    }
    await navigator.clipboard.writeText(normalizedOutput.value);
    copyButton.textContent = 'Copied';
    setTimeout(() => {
      copyButton.textContent = 'Copy Cleaned Markdown';
    }, 1200);
  });

  loadSampleButton.addEventListener('click', async () => {
    const response = await fetch('/spaghettiwestern.md');
    const text = await response.text();
    rawInput.value = text;
    titleInput.value = 'Grindhouse Action Persona Research Brief';
    buildDraft(text);
  });

  rawInput.addEventListener('input', () => {
    if (normalizedOutput.value.trim()) {
      buildDraft(rawInput.value);
    }
  });
})();

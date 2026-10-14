/* Thin workbench client — operator-state writes only. */
(function () {
  var state = { runId: null, inputId: null, approvals: [], decisions: [], selection: 0, ready: false, savingApproval: false, savingRevision: false };

  function $(id) { return document.getElementById(id); }

  function isCurrent(runId, selection) { return state.runId === runId && state.selection === selection; }

  function updateSaveButtons() {
    $('btn-save-approval').disabled = !state.ready || state.savingApproval;
    $('btn-save-rev').disabled = !state.ready || state.savingRevision;
  }

  function upsert(entries, entry, key) {
    var records = new Map(entries.map(function (item) { return [item[key], item]; }));
    records.set(entry[key], Object.assign({}, records.get(entry[key]), entry));
    return Array.from(records.values());
  }

  function tabs() {
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-body').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var id = 'tab-' + btn.getAttribute('data-tab');
        var el = document.getElementById(id);
        if (el) el.classList.add('active');
      });
    });
  }

  async function api(path, opts) {
    var res = await fetch(path, opts);
    var text = await res.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    if (!res.ok) {
      var error = new Error((data && data.error) || res.statusText);
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async function optionalState(path) {
    try { return await api(path); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }

  async function refreshRuns() {
    var data = await api('/api/runs');
    var ul = $('run-list');
    ul.innerHTML = '';
    $('run-empty').style.display = data.runs && data.runs.length ? 'none' : 'block';
    (data.runs || []).forEach(function (r) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = r.runId + (r.updatedAt ? ' · ' + r.updatedAt.slice(0, 10) : '');
      b.addEventListener('click', function () {
        document.querySelectorAll('.run-list button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        selectRun(r.runId);
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  async function selectRun(runId) {
    var selection = ++state.selection;
    state.runId = runId;
    state.inputId = null;
    state.approvals = [];
    state.decisions = [];
    state.ready = false;
    state.savingApproval = false;
    state.savingRevision = false;
    updateSaveButtons();
    ['cand-id', 'cand-note', 'rev-id', 'rev-note'].forEach(function (id) { $(id).value = ''; });
    ['approval-out', 'rev-out', 'era-explanations', 'era-svg'].forEach(function (id) { $(id).textContent = ''; });
    $('manifest-pre').textContent = 'Loading run...';
    $('overview-meta').textContent = 'Run ' + runId;
    try {
      var base = '/api/runs/' + encodeURIComponent(runId);
      var loaded = await Promise.all([
        api(base + '/manifest'),
        optionalState(base + '/operator-state/source-intake-approval'),
        optionalState(base + '/operator-state/operator-revision-decisions')
      ]);
      if (!isCurrent(runId, selection)) return;
      var m = loaded[0], approval = loaded[1], revisions = loaded[2];
      var inputId = m.inputId || runId;
      if ((m.runId && m.runId !== runId) || (approval && approval.inputId !== inputId)
        || (revisions && (revisions.runId !== runId || revisions.inputId !== inputId))) {
        throw new Error('Saved operator state does not match selected run/input');
      }
      state.inputId = inputId;
      state.approvals = approval ? approval.approvals || [] : [];
      state.decisions = revisions ? revisions.decisions || [] : [];
      state.ready = true;
      $('manifest-pre').textContent = JSON.stringify(m, null, 2);
      $('approval-out').textContent = JSON.stringify(approval || { approvals: [] }, null, 2);
      $('rev-out').textContent = JSON.stringify(revisions || { decisions: [] }, null, 2);
      updateSaveButtons();
    } catch (e) {
      if (isCurrent(runId, selection)) $('manifest-pre').textContent = String(e.message || e);
    }
  }

  async function saveApproval() {
    if (!state.runId) return alert('Select a run');
    if (!state.ready || state.savingApproval) return;
    var runId = state.runId, selection = state.selection;
    var entry = {
      candidateId: $('cand-id').value.trim(),
      approvalStatus: $('cand-status').value,
      approvedBy: $('approver-id').value.trim() || 'operator',
      approvedAt: new Date().toISOString(),
      note: $('cand-note').value.trim() || undefined
    };
    if (!entry.candidateId) return alert('candidate id required');
    var next = upsert(state.approvals, entry, 'candidateId');
    var body = {
      kind: 'source-intake-approval',
      data: {
        artifact: 'source-intake-approval',
        inputId: state.inputId,
        approvals: [entry]
      }
    };
    state.savingApproval = true;
    updateSaveButtons();
    try {
      var out = await api('/api/runs/' + encodeURIComponent(runId) + '/operator-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!isCurrent(runId, selection)) return;
      state.approvals = out.data && out.data.approvals || next;
      $('approval-out').textContent = JSON.stringify(out.data || { approvals: state.approvals }, null, 2);
    } finally {
      if (isCurrent(runId, selection)) { state.savingApproval = false; updateSaveButtons(); }
    }
  }

  async function loadEra() {
    if (!state.runId) return alert('Select a run');
    var runId = state.runId, selection = state.selection;
    var data = await api('/api/runs/' + encodeURIComponent(runId) + '/era');
    if (!isCurrent(runId, selection)) return;
    var box = $('era-explanations');
    if (!data.available) {
      box.textContent = data.reason || 'ERA unavailable';
      $('era-svg').innerHTML = '';
      return;
    }
    box.textContent = '';
    var list = document.createElement('ul');
    (data.explanations || []).forEach(function (text) {
      var item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    });
    box.appendChild(list);
    $('era-svg').innerHTML = data.svg || '';
  }

  async function saveRev() {
    if (!state.runId) return alert('Select a run');
    if (!state.ready || state.savingRevision) return;
    var runId = state.runId, selection = state.selection;
    var decision = {
      revisionId: $('rev-id').value.trim(),
      state: $('rev-state').value,
      decidedBy: $('approver-id').value.trim() || 'operator',
      decidedAt: new Date().toISOString(),
      rationale: $('rev-note').value.trim() || undefined
    };
    if (!decision.revisionId) return alert('revision id required');
    var next = upsert(state.decisions, decision, 'revisionId');
    var body = {
      kind: 'operator-revision-decisions',
      data: {
        artifact: 'operator-revision-decisions',
        runId: runId,
        inputId: state.inputId,
        decisions: [decision],
        updatedAt: new Date().toISOString()
      }
    };
    state.savingRevision = true;
    updateSaveButtons();
    try {
      var out = await api('/api/runs/' + encodeURIComponent(runId) + '/operator-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!isCurrent(runId, selection)) return;
      state.decisions = out.data && out.data.decisions || next;
      $('rev-out').textContent = JSON.stringify(out.data || { decisions: state.decisions }, null, 2);
    } finally {
      if (isCurrent(runId, selection)) { state.savingRevision = false; updateSaveButtons(); }
    }
  }

  async function parsePolicy() {
    var out = await api('/api/parse-reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hasExistingParse: $('has-parse').checked,
        forceRerun: $('force-rerun').checked,
        parseStale: $('parse-stale').checked
      })
    });
    $('parse-out').textContent = JSON.stringify(out, null, 2);
  }

  tabs();
  updateSaveButtons();
  $('btn-refresh').addEventListener('click', function () {
    refreshRuns().catch(function (e) { alert(e.message); });
  });
  $('btn-save-approval').addEventListener('click', function () {
    saveApproval().catch(function (e) { alert(e.message); });
  });
  $('btn-load-era').addEventListener('click', function () {
    loadEra().catch(function (e) { alert(e.message); });
  });
  $('btn-save-rev').addEventListener('click', function () {
    saveRev().catch(function (e) { alert(e.message); });
  });
  $('btn-parse-policy').addEventListener('click', function () {
    parsePolicy().catch(function (e) { alert(e.message); });
  });

  api('/api/health').then(function (h) {
    console.info('workbench', h);
  }).catch(function () {});
  refreshRuns().catch(function () {});
})();

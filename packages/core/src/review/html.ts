import type { CoveringArrayResult } from './covering-array';

/**
 * Self-contained review.html renderer (S4.1 / ExtraExtra pattern).
 * No external CSS/JS, no fetch, no server — open from the filesystem.
 */

export interface ReviewStageRow {
  stage: string;
  state: string;
  gate?: string;
  error?: string;
}

export interface ReviewArtifactRow {
  family: string;
  path: string;
  contentSha256: string;
}

export interface ReviewPlanSlot {
  slotKind: string;
  value: string;
  grammarRefs: string[];
  utdgRefs: string[];
  evidenceRefs: string[];
}

export interface ReviewPlanRow {
  planId: string;
  seed: number;
  grammarTarget: string;
  selectedForReview: boolean;
  coveringRowId?: string;
  slots: ReviewPlanSlot[];
}

export interface ReviewRealizedRow {
  promptId: string;
  planId: string;
  realizationProfile: string;
  text: string;
  slotCoverage: string;
  unsupportedContent: string;
  faithfulnessNotes: string[];
  utdgRefs: string[];
  evidenceRefs: string[];
}

export interface ReviewSnapshot {
  runId: string;
  inputId: string;
  generatedAt: string;
  parserVersion?: string;
  stages: ReviewStageRow[];
  artifacts: ReviewArtifactRow[];
  models: Array<{ stage: string; providerId: string; modelId: string }>;
  plans: ReviewPlanRow[];
  realized: ReviewRealizedRow[];
  covering: CoveringArrayResult;
  notes?: string[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function badge(state: string): string {
  const s = state.toLowerCase();
  let cls = 'badge';
  if (s === 'complete' || s === 'pass' || s === 'confirmed') cls += ' ok';
  else if (s === 'failed' || s === 'fail' || s === 'rejected') cls += ' bad';
  else if (s.includes('block') || s === 'pending' || s === 'running') cls += ' warn';
  return `<span class="${cls}">${esc(state)}</span>`;
}

/**
 * Generate a single-file HTML review document.
 * AC-4.1a: no external network resources; works via file://.
 */
export function generateReviewHtml(snapshot: ReviewSnapshot): string {
  const selected = snapshot.plans.filter((p) => p.selectedForReview);
  const realizedByPlan = new Map<string, ReviewRealizedRow[]>();
  for (const r of snapshot.realized) {
    const list = realizedByPlan.get(r.planId) ?? [];
    list.push(r);
    realizedByPlan.set(r.planId, list);
  }

  const stageRows = snapshot.stages.map((s) => `
    <tr>
      <td>${esc(s.stage)}</td>
      <td>${badge(s.state)}</td>
      <td>${esc(s.gate ?? '—')}</td>
      <td class="mono dim">${esc(s.error ?? '')}</td>
    </tr>`).join('');

  const artifactRows = snapshot.artifacts.map((a) => `
    <tr>
      <td>${esc(a.family)}</td>
      <td class="mono">${esc(a.path)}</td>
      <td class="mono dim">${esc(a.contentSha256.slice(0, 12))}…</td>
    </tr>`).join('');

  const modelRows = snapshot.models.map((m) => `
    <tr>
      <td>${esc(m.stage)}</td>
      <td>${esc(m.providerId)}</td>
      <td class="mono">${esc(m.modelId)}</td>
    </tr>`).join('');

  const coveringAxisSummary = snapshot.covering.axes.map((a) =>
    `<li><strong>${esc(a.axisId)}</strong>: ${a.values.map(esc).join(', ')}</li>`
  ).join('');

  const contactCards = selected.map((plan) => {
    const realized = realizedByPlan.get(plan.planId) ?? [];
    const slots = plan.slots.map((s) => `
      <div class="slot">
        <div class="slot-kind">${esc(s.slotKind)}</div>
        <div class="slot-val">${esc(s.value)}</div>
        <div class="refs dim">
          grammar: ${s.grammarRefs.map(esc).join(', ') || '—'} ·
          utdg: ${s.utdgRefs.map(esc).join(', ') || '—'} ·
          evidence: ${s.evidenceRefs.map(esc).join(', ') || '—'}
        </div>
      </div>`).join('');
    const realizedBlocks = realized.map((r) => `
      <div class="realized">
        <div class="realized-meta">
          <span class="mono">${esc(r.promptId)}</span>
          ${badge(r.slotCoverage === 'pass' && r.unsupportedContent === 'pass' ? 'faithful' : 'gate-fail')}
          <span class="dim">${esc(r.realizationProfile)}</span>
        </div>
        <p class="prose">${esc(r.text)}</p>
        ${r.faithfulnessNotes.length
          ? `<ul class="notes">${r.faithfulnessNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
          : ''}
      </div>`).join('') || '<p class="dim">No realization for this plan.</p>';

    return `
      <article class="card" data-plan-id="${esc(plan.planId)}" data-selected="true">
        <header class="card-head">
          <h3>${esc(plan.planId)}</h3>
          <div class="card-meta">
            seed ${plan.seed} · ${esc(plan.grammarTarget)}
            ${plan.coveringRowId ? ` · cover ${esc(plan.coveringRowId)}` : ''}
          </div>
          <label class="pick"><input type="checkbox" class="select-plan" checked data-id="${esc(plan.planId)}"/> select</label>
        </header>
        <section class="slots">${slots}</section>
        <section class="realized-wrap">${realizedBlocks}</section>
        <footer class="card-foot">
          <button type="button" class="copy-btn" data-copy="${esc(plan.planId)}">Copy plan id</button>
          <span class="tag" data-tag-for="${esc(plan.planId)}">tag: none</span>
          <select class="tag-select" data-id="${esc(plan.planId)}">
            <option value="none">issue tag…</option>
            <option value="ok">ok</option>
            <option value="realization">realization</option>
            <option value="grammar">grammar</option>
            <option value="signature">signature</option>
            <option value="rights">rights</option>
          </select>
        </footer>
      </article>`;
  }).join('');

  const allPlanRows = snapshot.plans.map((p) => `
    <tr class="${p.selectedForReview ? 'selected-row' : ''}">
      <td class="mono">${esc(p.planId)}</td>
      <td>${p.seed}</td>
      <td>${p.selectedForReview ? badge('review') : '—'}</td>
      <td class="dim">${esc(p.slots.map((s) => s.slotKind).join(', '))}</td>
    </tr>`).join('');

  const notes = (snapshot.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join('');

  // Inline CSS + JS only — no external URLs
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Metagrinder review — ${esc(snapshot.runId)}</title>
<style>
  :root {
    --bg: #0f1419;
    --panel: #1a222c;
    --border: #2c3845;
    --text: #e7eef5;
    --dim: #8b9aab;
    --ok: #3dd68c;
    --bad: #f07178;
    --warn: #e6b450;
    --accent: #59c2ff;
    --card: #121920;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 14px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
  }
  header.app {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, #15202b, var(--bg));
    position: sticky; top: 0; z-index: 10;
  }
  header.app h1 { margin: 0 0 0.25rem; font-size: 1.15rem; }
  header.app .sub { color: var(--dim); font-size: 0.85rem; }
  main { padding: 1rem 1.25rem 3rem; max-width: 1200px; margin: 0 auto; }
  section.block {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  section.block h2 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--accent);
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--dim); font-weight: 600; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85em; }
  .dim { color: var(--dim); }
  .badge {
    display: inline-block;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.75rem;
    background: #243040;
    color: var(--text);
  }
  .badge.ok { background: rgba(61,214,140,0.15); color: var(--ok); }
  .badge.bad { background: rgba(240,113,120,0.15); color: var(--bad); }
  .badge.warn { background: rgba(230,180,80,0.15); color: var(--warn); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 0.85rem;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .card-head h3 { margin: 0; font-size: 0.95rem; font-family: ui-monospace, monospace; }
  .card-meta { color: var(--dim); font-size: 0.8rem; }
  .pick { float: right; font-size: 0.8rem; color: var(--dim); }
  .slot {
    border-left: 3px solid var(--border);
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.35rem;
  }
  .slot-kind { font-size: 0.7rem; text-transform: uppercase; color: var(--accent); letter-spacing: 0.04em; }
  .slot-val { font-size: 0.9rem; }
  .refs { font-size: 0.72rem; margin-top: 0.15rem; word-break: break-word; }
  .prose { margin: 0.35rem 0; white-space: pre-wrap; }
  .notes { margin: 0.25rem 0 0; padding-left: 1.1rem; color: var(--warn); font-size: 0.8rem; }
  .card-foot { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  button, select {
    background: #243040;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.3rem 0.55rem;
    font: inherit;
    cursor: pointer;
  }
  button:hover { border-color: var(--accent); }
  .tag { font-size: 0.75rem; color: var(--dim); }
  tr.selected-row td { background: rgba(89,194,255,0.06); }
  footer.export {
    position: sticky; bottom: 0;
    background: #15202b;
    border-top: 1px solid var(--border);
    padding: 0.65rem 1.25rem;
    display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;
  }
  #export-out {
    display: none;
    width: 100%;
    min-height: 6rem;
    margin-top: 0.5rem;
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    padding: 0.5rem;
  }
  ul.compact { margin: 0; padding-left: 1.1rem; }
</style>
</head>
<body>
<header class="app">
  <h1>Metagrinder run review</h1>
  <div class="sub">
    run <span class="mono">${esc(snapshot.runId)}</span>
    · input <span class="mono">${esc(snapshot.inputId)}</span>
    · generated ${esc(snapshot.generatedAt)}
    ${snapshot.parserVersion ? `· parser ${esc(snapshot.parserVersion)}` : ''}
    · <strong>read-only file:// viewer</strong>
  </div>
</header>
<main>
  <section class="block" id="stages">
    <h2>Stage / gate states</h2>
    <table>
      <thead><tr><th>Stage</th><th>State</th><th>Gate</th><th>Error</th></tr></thead>
      <tbody>${stageRows || '<tr><td colspan="4" class="dim">No stages recorded.</td></tr>'}</tbody>
    </table>
  </section>

  <section class="block" id="artifacts">
    <h2>Artifacts</h2>
    <table>
      <thead><tr><th>Family</th><th>Path</th><th>SHA256</th></tr></thead>
      <tbody>${artifactRows || '<tr><td colspan="3" class="dim">No artifacts.</td></tr>'}</tbody>
    </table>
  </section>

  <section class="block" id="models">
    <h2>Models</h2>
    <table>
      <thead><tr><th>Stage</th><th>Provider</th><th>Model</th></tr></thead>
      <tbody>${modelRows || '<tr><td colspan="3" class="dim">No models recorded.</td></tr>'}</tbody>
    </table>
  </section>

  <section class="block" id="covering">
    <h2>Covering-array review sample</h2>
    <p class="dim">
      Pairwise coverage: ${snapshot.covering.pairsCovered} / ${snapshot.covering.pairUniverseSize}
      ${snapshot.covering.complete ? badge('complete') : badge('partial')}
      · ${selected.length} plan(s) selected for contact sheet
    </p>
    <ul class="compact">${coveringAxisSummary || '<li class="dim">No choice axes derived.</li>'}</ul>
  </section>

  <section class="block" id="contact-sheet">
    <h2>Contact sheet (covering sample)</h2>
    <div class="grid">
      ${contactCards || '<p class="dim">No plans selected for review.</p>'}
    </div>
  </section>

  <section class="block" id="all-plans">
    <h2>All content plans</h2>
    <table>
      <thead><tr><th>Plan</th><th>Seed</th><th>Review</th><th>Slots</th></tr></thead>
      <tbody>${allPlanRows || '<tr><td colspan="4" class="dim">No plans.</td></tr>'}</tbody>
    </table>
  </section>

  ${notes ? `<section class="block" id="notes"><h2>Notes</h2><ul class="compact">${notes}</ul></section>` : ''}
</main>

<footer class="export">
  <button type="button" id="btn-export">Export selection TSV</button>
  <button type="button" id="btn-copy-export">Copy export</button>
  <span class="dim">Local-only: tags/selection live in this page; write operator state via Workbench (S4.2).</span>
  <textarea id="export-out" readonly></textarea>
</footer>

<script>
(function () {
  // No network: selection + tags stay in-page for copy/export only.
  var tags = {};
  document.querySelectorAll('.tag-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      var id = sel.getAttribute('data-id');
      tags[id] = sel.value;
      var label = document.querySelector('.tag[data-tag-for="' + id + '"]');
      if (label) label.textContent = 'tag: ' + sel.value;
    });
  });
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-copy') || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id);
      } else {
        var ta = document.getElementById('export-out');
        ta.style.display = 'block';
        ta.value = id;
        ta.select();
      }
    });
  });
  function buildTsv() {
    var lines = ['plan_id\\tselected\\ttag'];
    document.querySelectorAll('.card').forEach(function (card) {
      var id = card.getAttribute('data-plan-id') || '';
      var cb = card.querySelector('.select-plan');
      var selected = cb && cb.checked ? '1' : '0';
      var tag = tags[id] || 'none';
      lines.push(id + '\\t' + selected + '\\t' + tag);
    });
    return lines.join('\\n');
  }
  var out = document.getElementById('export-out');
  document.getElementById('btn-export').addEventListener('click', function () {
    out.style.display = 'block';
    out.value = buildTsv();
  });
  document.getElementById('btn-copy-export').addEventListener('click', function () {
    var tsv = buildTsv();
    out.style.display = 'block';
    out.value = tsv;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsv);
    } else {
      out.select();
    }
  });
})();
</script>
</body>
</html>
`;
}

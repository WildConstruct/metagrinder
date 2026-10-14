import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

const NOW = '2026-10-13T12:00:00.000Z';
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

class Element {
  value = '';
  textContent = '';
  disabled = false;
  checked = false;
  style = { display: '' };
  children: Element[] = [];
  classList = { add: jest.fn(), remove: jest.fn() };
  private html = '';
  private listeners = new Map<string, Array<() => unknown>>();
  get innerHTML() { return this.html; }
  set innerHTML(value: string) { this.html = value; this.children = []; }
  appendChild(child: Element) { this.children.push(child); return child; }
  addEventListener(name: string, callback: () => unknown) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), callback]);
  }
  click() { if (!this.disabled) for (const callback of this.listeners.get('click') ?? []) callback(); }
  getAttribute() { return ''; }
}

function harness() {
  const elements = new Map<string, Element>();
  const el = (id: string) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id)!;
  };
  el('approver-id').value = 'operator';
  el('cand-status').value = 'approved';
  el('rev-state').value = 'accepted';
  const approvals = new Map<string, Array<Record<string, unknown>>>([
    ['run_a', [{ candidateId: 'a_saved', approvalStatus: 'approved', approvedBy: 'op', approvedAt: NOW }]],
    ['run_b', [{ candidateId: 'b_saved', approvalStatus: 'rejected', approvedBy: 'op', approvedAt: NOW }]]
  ]);
  const decisions = new Map<string, Array<Record<string, unknown>>>([
    ['run_a', [{ revisionId: 'a_rev', state: 'accepted', decidedBy: 'op', decidedAt: NOW }]],
    ['run_b', [{ revisionId: 'b_rev', state: 'rejected', decidedBy: 'op', decidedAt: NOW }]]
  ]);
  const posts: Array<{ runId: string; kind: string; data: Record<string, unknown> }> = [];
  const overrides = new Map<string, Promise<unknown>>();
  let failNextPost = false;
  let postGate: Promise<unknown> | undefined;
  const response = (data: unknown, status = 200) => ({ ok: status < 400, status, statusText: status >= 400 ? 'error' : 'OK', text: async () => JSON.stringify(data) });
  const fetchMock = jest.fn(async (url: string, options?: { method?: string; body?: string }) => {
    if (overrides.has(url)) return response(await overrides.get(url));
    if (url === '/api/health') return response({ ok: true });
    if (url === '/api/runs') return response({ runs: [{ runId: 'run_a' }, { runId: 'run_b' }] });
    const match = url.match(/^\/api\/runs\/(run_[ab])\/(.*)$/);
    if (!match) return response({ error: 'not found' }, 404);
    const runId = match[1]!;
    const inputId = `input_${runId.slice(-1)}`;
    const rest = match[2];
    if (rest === 'manifest') return response({ runId, inputId });
    if (rest === 'operator-state/source-intake-approval') return response({ artifact: 'source-intake-approval', inputId, approvals: approvals.get(runId) });
    if (rest === 'operator-state/operator-revision-decisions') return response({ artifact: 'operator-revision-decisions', runId, inputId, decisions: decisions.get(runId), updatedAt: NOW });
    if (rest === 'era') return response({ available: false, reason: `ERA ${runId}` });
    if (rest === 'operator-state' && options?.method === 'POST') {
      const body = JSON.parse(options.body!) as { kind: string; data: Record<string, unknown> };
      posts.push({ runId, ...body });
      if (failNextPost) { failNextPost = false; return response({ error: 'simulated save failure' }, 500); }
      if (postGate) { const gate = postGate; postGate = undefined; await gate; }
      const isApproval = body.kind === 'source-intake-approval';
      const store = isApproval ? approvals : decisions;
      const key = isApproval ? 'candidateId' : 'revisionId';
      const field = isApproval ? 'approvals' : 'decisions';
      const records = new Map((store.get(runId) ?? []).map((item) => [item[key], item]));
      for (const item of body.data[field] as Array<Record<string, unknown>>) records.set(item[key], { ...records.get(item[key]), ...item });
      const saved = [...records.values()];
      store.set(runId, saved);
      return response({ ok: true, data: { ...body.data, [field]: saved } });
    }
    return response({ error: 'not found' }, 404);
  });
  const document = {
    getElementById: el,
    createElement: () => new Element(),
    querySelectorAll: (selector: string) => selector === '.run-list button'
      ? el('run-list').children.flatMap((item) => item.children) : []
  };
  const alerts: string[] = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'static', 'app.js'), 'utf8'), {
    document, fetch: fetchMock, alert: (message: string) => alerts.push(message), console: { info() {} }
  });
  return {
    el, posts, overrides, alerts,
    select: async (index: number) => { await tick(); el('run-list').children[index]!.children[0]!.click(); await tick(); },
    saveApproval: async (id: string) => { el('cand-id').value = id; el('btn-save-approval').click(); await tick(); },
    failNext: () => { failNextPost = true; },
    delayPost: (promise: Promise<unknown>) => { postGate = promise; }
  };
}

describe('workbench client durable run state', () => {
  test('selecting a run loads saved approvals and revision decisions and uses manifest input identity', async () => {
    const h = harness();
    await h.select(0);
    expect(h.el('approval-out').textContent).toContain('a_saved');
    expect(h.el('rev-out').textContent).toContain('a_rev');
    await h.saveApproval('a_new');
    expect(h.posts[0]!.data.inputId).toBe('input_a');
    expect(h.el('approval-out').textContent).toContain('a_saved');
    h.el('rev-id').value = 'a_new_rev';
    h.el('btn-save-rev').click();
    await tick();
    expect(h.posts[1]!.data.inputId).toBe('input_a');
    expect(h.el('rev-out').textContent).toContain('a_rev');
  });

  test('run changes and failed saves cannot leak approval records into another save', async () => {
    const h = harness();
    await h.select(0);
    h.failNext();
    await h.saveApproval('failed_record');
    expect(h.alerts).toContain('simulated save failure');
    expect(h.el('approval-out').textContent).not.toContain('failed_record');
    await h.saveApproval('a_new');
    expect(h.posts[1]!.data.approvals).toEqual([expect.objectContaining({ candidateId: 'a_new' })]);
    await h.select(1);
    expect(h.el('approval-out').textContent).toContain('b_saved');
    expect(h.el('approval-out').textContent).not.toContain('a_new');
    await h.saveApproval('b_new');
    expect(h.posts[2]!.runId).toBe('run_b');
    expect(h.posts[2]!.data.approvals).toEqual([expect.objectContaining({ candidateId: 'b_new' })]);
  });

  test('late manifest/state loads cannot overwrite the newly selected run', async () => {
    const h = harness();
    const old = deferred<unknown>();
    h.overrides.set('/api/runs/run_a/manifest', old.promise);
    await h.select(0);
    await h.select(1);
    old.resolve({ runId: 'run_a', inputId: 'input_a' });
    await tick();
    expect(h.el('manifest-pre').textContent).toContain('run_b');
    expect(h.el('approval-out').textContent).toContain('b_saved');
  });

  test('late save and ERA responses cannot overwrite another run review surface', async () => {
    const h = harness();
    await h.select(0);
    const oldSave = deferred<unknown>();
    const oldEra = deferred<unknown>();
    h.delayPost(oldSave.promise);
    h.overrides.set('/api/runs/run_a/era', oldEra.promise);
    await h.saveApproval('a_delayed');
    h.el('btn-load-era').click();
    await tick();
    await h.select(1);
    const before = h.el('approval-out').textContent;
    oldSave.resolve({});
    oldEra.resolve({ available: false, reason: 'stale ERA run_a' });
    await tick();
    expect(h.el('approval-out').textContent).toBe(before);
    expect(h.el('era-explanations').innerHTML).not.toContain('stale ERA run_a');
    expect(h.el('era-explanations').textContent).not.toContain('stale ERA run_a');
  });
});

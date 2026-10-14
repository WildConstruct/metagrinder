import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import type { OperatorWritableKind } from '../schemas';
import { handleReadOperatorState, handleWriteOperatorState, startWorkbenchServer } from './index';

const NOW = '2026-10-13T12:00:00.000Z';

describe('workbench durable operator state', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-persistence-'));
    fs.mkdirSync(path.join(root, 'run_a'));
    fs.writeFileSync(path.join(root, 'run_a', 'run-manifest.json'), JSON.stringify({ runId: 'run_a', inputId: 'input_a' }));
  });
  afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

  const approval = (candidateId: string, approvalStatus = 'approved') => ({ candidateId, approvalStatus, approvedBy: 'op', approvedAt: NOW });
  const decision = (revisionId: string, state = 'accepted') => ({ revisionId, state, decidedBy: 'op', decidedAt: NOW });
  const write = (kind: OperatorWritableKind, body: unknown) => handleWriteOperatorState({ config: { runsRoot: root }, runId: 'run_a', kind, body, now: NOW });
  const read = (kind: OperatorWritableKind) => handleReadOperatorState({ config: { runsRoot: root }, runId: 'run_a', kind });

  test('review-selection round-trips as TSV without JSON parsing', () => {
    expect(write('review-selection', { tsv: 'sampleId\tselected\nplan_1\ttrue' }).status).toBe(200);
    const result = read('review-selection');
    expect(result.status).toBe(200);
    expect('text' in result && result.text).toBe('sampleId\tselected\nplan_1\ttrue\n');
  });

  test('updates merge by candidate/revision id while retaining unrelated records and omitted metadata', () => {
    expect(write('source-intake-approval', { artifact: 'source-intake-approval', inputId: 'input_a', approvals: [
      { ...approval('c1'), rightsProfile: 'reference-only' }, approval('c2')
    ] }).status).toBe(200);
    expect(write('source-intake-approval', { artifact: 'source-intake-approval', inputId: 'input_a', approvals: [approval('c1', 'rejected')] }).status).toBe(200);
    const approvals = read('source-intake-approval');
    expect('json' in approvals && approvals.json).toMatchObject({ approvals: [
      { candidateId: 'c1', approvalStatus: 'rejected', rightsProfile: 'reference-only' }, { candidateId: 'c2' }
    ] });

    expect(write('operator-revision-decisions', { inputId: 'input_a', decisions: [
      { ...decision('r1'), citationOverride: true }, decision('r2')
    ] }).status).toBe(200);
    expect(write('operator-revision-decisions', { inputId: 'input_a', decisions: [decision('r1', 'rejected')] }).status).toBe(200);
    const revisions = read('operator-revision-decisions');
    expect('json' in revisions && revisions.json).toMatchObject({ decisions: [
      { revisionId: 'r1', state: 'rejected', citationOverride: true }, { revisionId: 'r2' }
    ] });
  });

  test('known input and run mismatches fail before changing durable state', () => {
    expect(write('source-intake-approval', { artifact: 'source-intake-approval', inputId: 'input_a', approvals: [approval('c1')] }).status).toBe(200);
    const file = path.join(root, 'run_a', 'operator-state', 'source-intake-approval.json');
    const before = fs.readFileSync(file, 'utf8');
    expect(write('source-intake-approval', { artifact: 'source-intake-approval', inputId: 'input_b', approvals: [approval('wrong')] }).status).toBe(400);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(write('operator-revision-decisions', { runId: 'run_b', inputId: 'input_a', decisions: [decision('wrong')] }).status).toBe(400);
    expect(write('operator-revision-decisions', { runId: 'run_a', inputId: 'input_b', decisions: [decision('wrong')] }).status).toBe(400);
  });

  test('failed atomic replacement leaves the previous state intact and removes temporary files', () => {
    expect(write('source-intake-approval', { artifact: 'source-intake-approval', inputId: 'input_a', approvals: [approval('c1')] }).status).toBe(200);
    const dir = path.join(root, 'run_a', 'operator-state');
    const file = path.join(dir, 'source-intake-approval.json');
    const before = fs.readFileSync(file, 'utf8');
    const nativeFs = require('node:fs') as typeof fs;
    jest.spyOn(nativeFs, 'renameSync').mockImplementation(() => { throw new Error('simulated rename failure'); });
    const result = write('source-intake-approval', { artifact: 'source-intake-approval', inputId: 'input_a', approvals: [approval('c2')] });
    expect(result.status).toBe(500);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(fs.readdirSync(dir)).toEqual(['source-intake-approval.json']);
  });

  async function withServer(run: (url: string, server: http.Server) => Promise<void>): Promise<void> {
    const server = startWorkbenchServer({ runsRoot: root, port: 0 });
    try {
      await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('TCP address required');
      await run(`http://127.0.0.1:${address.port}`, server);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  }

  test('actual default listener binds only to IPv4 loopback', async () => {
    await withServer(async (_, server) => {
      const address = server.address();
      expect(address && typeof address !== 'string' && address.address).toBe('127.0.0.1');
    });
  });

  test('HTTP write boundary rejects foreign origins/hosts and retains operator-state-only writes', async () => {
    await withServer(async (url) => {
      const body = JSON.stringify({ kind: 'source-intake-approval', data: { artifact: 'source-intake-approval', inputId: 'input_a', approvals: [approval('c1')] } });
      const endpoint = `${url}/api/runs/run_a/operator-state`;
      expect((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.example' }, body })).status).toBe(403);
      const foreignHostStatus = await new Promise<number>((resolve, reject) => {
        const request = http.request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'foreign.example' } }, (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode ?? 0));
        });
        request.on('error', reject);
        request.end(body);
      });
      expect(foreignHostStatus).toBe(403);
      expect(fs.existsSync(path.join(root, 'run_a', 'operator-state'))).toBe(false);
      const saved = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body });
      expect(saved.status).toBe(200);
      const loaded = await fetch(`${url}/api/runs/run_a/operator-state/source-intake-approval`);
      expect(await loaded.json()).toMatchObject({ inputId: 'input_a', approvals: [{ candidateId: 'c1' }] });
      const forbidden = await fetch(`${url}/api/runs/run_a/artifact`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify({ path: 'extraction.json', data: {} }) });
      expect(forbidden.status).toBe(403);
      expect(fs.existsSync(path.join(root, 'run_a', 'extraction.json'))).toBe(false);
    });
  });
});

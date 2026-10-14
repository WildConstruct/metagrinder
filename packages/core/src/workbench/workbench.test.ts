import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { historicalCrowdGrammar } from '../compile/__fixtures__/historical-crowd-grammar';
import { SceneGrammarSchema } from '../schemas';
import {
  assertRejectsGeneratedWrites,
  computeEraShiftView,
  decideParseReuse,
  handleForbiddenWrite,
  handleParseReuse,
  handleWriteOperatorState,
  operatorStateRelativePath,
  resolveOperatorWritePath,
  svgArchetypeShareDelta,
  WriteBoundaryError
} from './index';

const NOW = '2026-07-15T21:00:00.000Z';

describe('write boundary (AC-4.2a)', () => {
  const runDir = path.join(os.tmpdir(), 'wb-boundary-fake');

  test('operator-state paths resolve; generated artifacts are rejected', () => {
    const ok = resolveOperatorWritePath(runDir, operatorStateRelativePath('source-intake-approval'));
    expect(ok.replace(/\\/g, '/')).toContain('operator-state/source-intake-approval.json');

    const generated = [
      'extraction.json',
      'scene-grammar.json',
      'accepted-scene-grammar.json',
      'content-plans.json',
      'utdg-candidates.json',
      'revisions.json',
      'retrieval.json',
      'gap-registry.json',
      'research-campaign.json',
      'run-manifest.json',
      'review.html',
      'llm-cache/foo.json',
      'psg/out.psg',
      'nested/extraction.json',
      '../outside.json',
      'operator-state/../../extraction.json'
    ];
    const { rejected, leaked } = assertRejectsGeneratedWrites(runDir, generated);
    expect(leaked).toEqual([]);
    expect(rejected.length).toBe(generated.length);
  });

  test('property: every known generated basename is blocked', () => {
    const basenames = [
      'source-package.json',
      'extraction.json',
      'scene-grammar.json',
      'content-plans.json',
      'utdg-candidates.json',
      'semantic-choice-graph.json'
    ];
    for (const b of basenames) {
      expect(() => resolveOperatorWritePath(runDir, b)).toThrow(WriteBoundaryError);
      expect(() => resolveOperatorWritePath(runDir, `artifacts/${b}`)).toThrow(WriteBoundaryError);
    }
  });

  test('handleForbiddenWrite always 403 for generated paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-forb-'));
    try {
      const runId = 'run_x';
      fs.mkdirSync(path.join(tmp, runId));
      const res = handleForbiddenWrite({
        config: { runsRoot: tmp },
        runId,
        relativePath: 'extraction.json',
        body: { evil: true }
      });
      expect(res.status).toBe(403);
      if ('json' in res) {
        expect((res.json as { writeBoundary?: boolean }).writeBoundary).toBe(true);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('parse reuse default (S4.2)', () => {
  test('reuses existing parse unless forceRerun or stale', () => {
    expect(decideParseReuse({ hasExistingParse: true }).action).toBe('reuse');
    expect(decideParseReuse({ hasExistingParse: true, forceRerun: true }).action).toBe('run');
    expect(decideParseReuse({ hasExistingParse: true, parseStale: true }).action).toBe('run');
    expect(decideParseReuse({ hasExistingParse: false }).action).toBe('run');
  });

  test('HTTP handler exposes the same policy', () => {
    const res = handleParseReuse({ hasExistingParse: true });
    expect(res.status).toBe(200);
    if ('json' in res) {
      expect((res.json as { reuse: boolean }).reuse).toBe(true);
    }
  });
});

describe('ERA generative shift view (S4.2)', () => {
  test('base vs accepted produces SVG and explanations (not delta-only)', () => {
    const base = historicalCrowdGrammar(NOW);
    // Nudge accepted weights so mix shifts
    const acceptedRaw = JSON.parse(JSON.stringify(base));
    acceptedRaw.grammarTarget = 'accepted';
    if (acceptedRaw.archetypes[0]?.weightRange) {
      acceptedRaw.archetypes[0].weightRange = { label: 'boosted', min: 70, max: 80 };
    }
    if (acceptedRaw.archetypes[1]?.weightRange) {
      acceptedRaw.archetypes[1].weightRange = { label: 'cut', min: 5, max: 10 };
    }
    const accepted = SceneGrammarSchema.parse(acceptedRaw);

    const view = computeEraShiftView({
      baseGrammar: base,
      acceptedGrammar: accepted,
      seed: 7,
      sampleCount: 80
    });
    expect(view.base.grammarTarget).toBe('base');
    expect(view.accepted.grammarTarget).toBe('accepted');
    expect(view.shift.totalVariationDistance).toBeGreaterThanOrEqual(0);
    expect(view.svg).toContain('<svg');
    expect(view.svg).toContain('base');
    // SVG namespace URI is fine; no external script/img network deps
    expect(view.svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(view.shift.explanations.length).toBeGreaterThanOrEqual(0);
    const svg = svgArchetypeShareDelta(view.shift);
    expect(svg).toContain('svg');
  });
});

describe('operator-state write handler', () => {
  test('writes intake approval under operator-state only', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-write-'));
    try {
      const runId = 'run_ops';
      fs.mkdirSync(path.join(tmp, runId));
      const res = handleWriteOperatorState({
        config: { runsRoot: tmp },
        runId,
        kind: 'source-intake-approval',
        now: NOW,
        body: {
          artifact: 'source-intake-approval',
          inputId: 'in1',
          approvals: [{
            candidateId: 'c1',
            approvalStatus: 'approved',
            approvedBy: 'operator',
            approvedAt: NOW
          }]
        }
      });
      expect(res.status).toBe(200);
      const file = path.join(tmp, runId, 'operator-state', 'source-intake-approval.json');
      expect(fs.existsSync(file)).toBe(true);
      // Ensure extraction was not created
      expect(fs.existsSync(path.join(tmp, runId, 'extraction.json'))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('revision decisions land in operator-state/revision-decisions.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-rev-'));
    try {
      const runId = 'run_rev';
      fs.mkdirSync(path.join(tmp, runId));
      const res = handleWriteOperatorState({
        config: { runsRoot: tmp },
        runId,
        kind: 'operator-revision-decisions',
        now: NOW,
        body: {
          inputId: 'in1',
          decisions: [{
            revisionId: 'rev_1',
            state: 'accepted',
            decidedBy: 'operator',
            decidedAt: NOW,
            rationale: 'ERA shift matches intent'
          }]
        }
      });
      expect(res.status).toBe(200);
      const file = path.join(tmp, runId, 'operator-state', 'revision-decisions.json');
      expect(fs.existsSync(file)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(parsed.artifact).toBe('operator-revision-decisions');
      expect(parsed.decisions[0].revisionId).toBe('rev_1');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

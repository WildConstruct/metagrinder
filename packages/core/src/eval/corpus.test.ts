import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCorpus } from './corpus';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const canonicalPortText = (text: string): string => text.replace(/\r\n/g, '\n');

describe('eval corpus (S1.5)', () => {
  test('[AC-1.5a] loader enumerates all 12 briefs joined to judgments', () => {
    const corpus = loadCorpus();
    expect(corpus.briefs).toHaveLength(12);
    const ids = corpus.briefs.map((b) => b.id).sort();
    expect(ids).toEqual([
      'archival-costume-crowd-memo',
      'broadway',
      'canyon-foundry-surface-sheet',
      'desert-outpost',
      'greenhouse',
      'medieval-peasant-generator',
      'modular-enemy-generator-notes',
      'outlaw-press-brand-kit',
      'shipyard',
      'spaghettiwestern',
      'tabloid-naming',
      'weeklyworldnews-blueprint'
    ]);
    for (const brief of corpus.briefs) {
      expect(brief.text.trim().length).toBeGreaterThan(0);
      expect(brief.judgment.expected_mode.length).toBeGreaterThan(0);
    }
    expect(corpus.scoring.max_per_brief).toBe(10);
  });

  test('[AC-1.5a] judgments.json preserves the epic4 original except platform line endings', () => {
    const original = fs.readFileSync(
      path.join(REPO_ROOT, 'experiments/epic4-autoresearch/judgments.json')
    );
    const ported = fs.readFileSync(path.join(__dirname, 'corpus/judgments.json'));
    const hash = (b: Buffer) => createHash('sha256').update(canonicalPortText(b.toString('utf8'))).digest('hex');
    expect(hash(ported)).toBe(hash(original));
  });

  test('every committed brief preserves its source except platform line endings', () => {
    const corpus = loadCorpus();
    for (const brief of corpus.briefs) {
      // judgment.path is the legacy repo-relative location, untouched by the port
      const legacyPath = path.join(REPO_ROOT, brief.judgment.path);
      expect(canonicalPortText(fs.readFileSync(brief.briefPath, 'utf8')))
        .toBe(canonicalPortText(fs.readFileSync(legacyPath, 'utf8')));
    }
  });

  test('port comparison permits CRLF/LF differences only and still catches source/judgment drift', () => {
    expect(canonicalPortText('Source line.\r\nNext line.\r\n')).toBe(canonicalPortText('Source line.\nNext line.\n'));
    expect(canonicalPortText('Source line.\rNext line.')).not.toBe(canonicalPortText('Source line.\nNext line.'));
    expect(canonicalPortText('Source line.  \r\n')).not.toBe(canonicalPortText('Source line.\n'));
    expect(canonicalPortText('{"expected_mode":"research"}\r\n'))
      .not.toBe(canonicalPortText('{"expected_mode":"generator"}\n'));
  });
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AttributionMode, ConfidenceLevel, ExtractionPayload, Provenance } from '../../schemas';
import { ingestText } from '../ingest';
import { createCachingProvider, type Transport } from '../../providers';
import { extract, verifyExtractionPayload, verifyProvenance, buildChunkIndex } from './index';

const NOW = '2026-06-10T12:00:00.000Z';
const RAW = 'Spectators wore wool overcoats.\n\nThe marquee glowed over the damp pavement.';

function pkg() {
  return ingestText({ runId: 'r', inputId: 'i', createdAt: NOW, sources: [{ rawText: RAW }] });
}

function prov(chunkIds: string[], mode: AttributionMode, extra: Partial<Provenance> = {}): Provenance {
  return {
    sourceInputIds: ['i'], sourceChunkIds: chunkIds, spans: [],
    attributionMode: mode, evidenceBasis: mode === 'quoted' ? 'observed' : 'inferred',
    confidence: 'medium', verification: 'unverified', ...extra
  };
}

function claim(id: string, text: string, p: Provenance, confidence: ConfidenceLevel = 'medium') {
  return { claimId: id, text, category: 'wardrobe', confidence, provenance: p };
}

function runVerify(payload: Partial<ExtractionPayload>) {
  return verifyExtractionPayload({
    payload: { categories: [], claims: [], concepts: [], evidence: [], uncertaintySpans: [], openQuestions: [], ...payload } as ExtractionPayload,
    sourcePackage: pkg(), runId: 'r', inputId: 'i', createdAt: NOW, analysisMode: 'replayed-llm-semantic'
  });
}

describe('extract verification layer (S3.2)', () => {
  const p = pkg();
  const c0 = p.chunks[0]!.chunkId; // "Spectators wore wool overcoats."
  const c1 = p.chunks[1]!.chunkId;

  test('[AC-3.2a] a verbatim quote verifies', () => {
    const { extraction, report } = runVerify({ claims: [claim('cl1', 'wool overcoats', prov([c0], 'quoted'), 'high')] });
    expect(report.verified).toBe(1);
    expect(extraction.claims[0]!.provenance.verification).toBe('verified');
    expect(extraction.claims[0]!.confidence).toBe('high'); // preserved when verified
  });

  test('[AC-3.2a] a fabricated quote is downgraded, not trusted', () => {
    // excerptText is the claim text; "silk top hats" is not in any chunk
    const { extraction, report } = runVerify({ claims: [claim('cl1', 'silk top hats and canes', prov([c0], 'quoted'), 'high')] });
    expect(report.downgraded).toBe(1);
    const claimOut = extraction.claims[0]!;
    expect(claimOut.provenance.verification).toBe('downgraded');
    expect(claimOut.provenance.attributionMode).toBe('paraphrased'); // demoted from quoted
    expect(claimOut.confidence).toBe('low');
    expect(extraction.warnings.some((w) => /not a verbatim substring/.test(w.message))).toBe(true);
  });

  test('[AC-3.2a] a record citing a nonexistent chunk is rejected (dropped)', () => {
    const { extraction, report } = runVerify({ claims: [claim('cl1', 'wool overcoats', prov(['chunk_does_not_exist'], 'quoted'))] });
    expect(report.rejected).toBe(1);
    expect(extraction.claims).toHaveLength(0);
    expect(extraction.warnings.some((w) => /nonexistent chunk/.test(w.message))).toBe(true);
  });

  test('a well-grounded paraphrase verifies; a weak one is downgraded', () => {
    const strong = runVerify({ claims: [claim('cl1', 'spectators wore wool overcoats', prov([c0], 'paraphrased'))] });
    expect(strong.report.verified).toBe(1);
    const weak = runVerify({ claims: [claim('cl2', 'attendees carried leather satchels and brass lanterns', prov([c0], 'paraphrased'))] });
    expect(weak.report.downgraded).toBe(1);
    expect(weak.extraction.claims[0]!.provenance.verification).toBe('downgraded');
  });

  test('inferred records are capped low and require a reasoning note', () => {
    const noNote = runVerify({ claims: [claim('cl1', 'the scene is upscale', prov([c0], 'inferred'), 'high')] });
    expect(noNote.report.unverified).toBe(1);
    expect(noNote.extraction.claims[0]!.confidence).toBe('low');
    expect(noNote.extraction.warnings.some((w) => /reasoning note/.test(w.message))).toBe(true);
    expect(noNote.extraction.warnings.some((w) => /cannot be high confidence/.test(w.message))).toBe(true);
  });

  test('[AC-3.4a.2] inferred evidence persists its confidence downgrade in provenance', () => {
    const inferred = prov([c0], 'inferred', { confidence: 'high', reasoningNote: 'contextual inference' });
    const { extraction } = runVerify({
      evidence: [{ evidenceId: 'ev1', text: 'the scene is upscale', provenance: inferred }]
    });
    expect(extraction.evidence[0]!.provenance.confidence).toBe('low');
  });

  test('verifyProvenance is pure and returns a fresh provenance object', () => {
    const original = prov([c0], 'quoted');
    const out = verifyProvenance(original, 'medium', 'wool overcoats', buildChunkIndex(pkg()));
    expect(out.disposition).toBe('verified');
    expect(original.verification).toBe('unverified'); // input untouched
  });
});

describe('extract stage with provider (S3.2)', () => {
  function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-extract-')); }

  test('extract() validates the payload, verifies, and stamps replay provenance', async () => {
    const source = pkg();
    const c0 = source.chunks[0]!.chunkId;
    const payload: ExtractionPayload = {
      categories: [{ category: 'wardrobe' }],
      claims: [claim('cl1', 'wool overcoats', prov([c0], 'quoted'))],
      concepts: [], evidence: [], uncertaintySpans: [], openQuestions: []
    };
    const transport: Transport = async () => ({ rawText: JSON.stringify(payload) });
    const provider = createCachingProvider({ runDir: tmp(), transport, providerId: 'fake', model: 'm', mode: 'record', now: () => NOW });

    const { extraction, report, replayed } = await extract({ provider, sourcePackage: source, runId: 'r', inputId: 'i', createdAt: NOW });
    expect(replayed).toBe(false);
    expect(extraction.analysisMode).toBe('llm-semantic');
    expect(report.verified).toBe(1);
    expect(extraction.claims[0]!.provenance.verification).toBe('verified');
  });

  test('extract() rejects a payload that is not schema-valid', async () => {
    const transport: Transport = async () => ({ rawText: '{"claims":[{"claimId":"x"}]}' }); // missing required fields
    const provider = createCachingProvider({ runDir: tmp(), transport, providerId: 'fake', model: 'm', mode: 'record', now: () => NOW });
    await expect(extract({ provider, sourcePackage: pkg(), runId: 'r', inputId: 'i', createdAt: NOW })).rejects.toThrow();
  });
});

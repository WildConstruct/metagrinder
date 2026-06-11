import {
  ExtractionPayloadSchema,
  ExtractionSchema,
  type Extraction,
  type ExtractionWarning,
  type SourcePackage
} from '../../schemas';
import type { ExtractionPayload } from '../../schemas';
import type { LlmProvider } from '../../providers';
import { buildChunkIndex, verifyProvenance, type Disposition } from './verify';

/**
 * Extract stage (S3.2): LLM proposes claims/concepts/evidence/uncertainty with
 * provenance; the deterministic verifier checks every record before it is
 * trusted. Records citing nonexistent chunks are dropped; fabricated quotes are
 * downgraded; inferred records are capped low. The stage owns the artifact
 * envelope and analysisMode (honest provenance of how it was produced).
 */

export interface VerificationReport {
  verified: number;
  downgraded: number;
  rejected: number;
  unverified: number;
}

export function buildExtractPrompt(sourcePackage: SourcePackage): string {
  const chunks = sourcePackage.chunks
    .map((c) => `[${c.chunkId}]${c.sectionLabel ? ` (${c.sectionLabel})` : ''} ${c.text}`)
    .join('\n\n');
  return [
    'Extract claims, concepts, evidence excerpts, and uncertainty spans from the source chunks below.',
    'Every record must carry provenance citing one or more chunk ids from this document.',
    'Set attributionMode to "quoted" only when excerptText is a verbatim substring of a cited chunk;',
    'use "paraphrased" when restating a cited chunk; use "inferred" (with a reasoningNote) when not directly stated.',
    'Use generic category labels drawn from the source domain. Return a single JSON object.',
    '',
    'SOURCE CHUNKS:',
    chunks
  ].join('\n');
}

function applyVerification(payload: ExtractionPayload, sourcePackage: SourcePackage): { payload: ExtractionPayload; warnings: ExtractionWarning[]; report: VerificationReport } {
  const chunkById = buildChunkIndex(sourcePackage);
  const warnings: ExtractionWarning[] = [];
  const report: VerificationReport = { verified: 0, downgraded: 0, rejected: 0, unverified: 0 };

  const tally = (d: Disposition) => { report[d] += 1; };

  const claims = payload.claims.flatMap((claim) => {
    const out = verifyProvenance(claim.provenance, claim.confidence, claim.text, chunkById);
    tally(out.disposition);
    out.warnings.forEach((m) => warnings.push({ code: `claim:${out.disposition}`, message: m, recordIds: [claim.claimId] }));
    if (out.disposition === 'rejected') return [];
    return [{ ...claim, provenance: out.provenance, confidence: out.confidence }];
  });

  const concepts = payload.concepts.flatMap((concept) => {
    const out = verifyProvenance(concept.provenance, concept.confidence, concept.summary ?? concept.label, chunkById);
    tally(out.disposition);
    out.warnings.forEach((m) => warnings.push({ code: `concept:${out.disposition}`, message: m, recordIds: [concept.conceptId] }));
    if (out.disposition === 'rejected') return [];
    return [{ ...concept, provenance: out.provenance, confidence: out.confidence }];
  });

  const evidence = payload.evidence.flatMap((ev) => {
    const out = verifyProvenance(ev.provenance, ev.provenance.confidence, ev.text, chunkById);
    tally(out.disposition);
    out.warnings.forEach((m) => warnings.push({ code: `evidence:${out.disposition}`, message: m, recordIds: [ev.evidenceId] }));
    if (out.disposition === 'rejected') return [];
    return [{ ...ev, provenance: out.provenance }];
  });

  return { payload: { ...payload, claims, concepts, evidence }, warnings, report };
}

/** Verify a raw extraction payload against a source package (pure, provider-free). */
export function verifyExtractionPayload(args: {
  payload: ExtractionPayload;
  sourcePackage: SourcePackage;
  runId: string;
  inputId: string;
  createdAt: string;
  analysisMode: Extraction['analysisMode'];
}): { extraction: Extraction; report: VerificationReport } {
  const { payload, warnings, report } = applyVerification(ExtractionPayloadSchema.parse(args.payload), args.sourcePackage);
  const extraction = ExtractionSchema.parse({
    artifact: 'extraction',
    runId: args.runId,
    inputId: args.inputId,
    createdAt: args.createdAt,
    analysisMode: args.analysisMode,
    ...(payload.detectedResearchKind !== undefined ? { detectedResearchKind: payload.detectedResearchKind } : {}),
    categories: payload.categories,
    claims: payload.claims,
    concepts: payload.concepts,
    evidence: payload.evidence,
    uncertaintySpans: payload.uncertaintySpans,
    openQuestions: payload.openQuestions,
    warnings
  });
  return { extraction, report };
}

export async function extract(args: {
  provider: LlmProvider;
  sourcePackage: SourcePackage;
  runId: string;
  inputId: string;
  createdAt: string;
}): Promise<{ extraction: Extraction; report: VerificationReport; replayed: boolean }> {
  const result = await args.provider.complete({
    stage: 'extract',
    prompt: buildExtractPrompt(args.sourcePackage),
    schema: ExtractionPayloadSchema,
    schemaName: 'extraction'
  });
  const { extraction, report } = verifyExtractionPayload({
    payload: result.data,
    sourcePackage: args.sourcePackage,
    runId: args.runId,
    inputId: args.inputId,
    createdAt: args.createdAt,
    analysisMode: result.replayed ? 'replayed-llm-semantic' : 'llm-semantic'
  });
  return { extraction, report, replayed: result.replayed };
}

export { verifyProvenance, buildChunkIndex } from './verify';

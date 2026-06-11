import {
  SceneGrammarPayloadSchema,
  SceneGrammarSchema,
  type SceneGrammar,
  type SourcePackage
} from '../../schemas';
import type { LlmProvider } from '../../providers';
import { verifyGrammarPayload, type GrammarReport } from './verify';

/**
 * Grammar draft stage (S3.3): the LLM drafts scene structure; the verifier
 * gates it on arithmetic + provenance. The stage owns envelope, analysisMode,
 * and grammarTarget (always 'base' for a fresh draft — 'accepted' is only ever
 * produced by the governance state machine from accepted deltas).
 */

export function buildGrammarPrompt(sourcePackage: SourcePackage): string {
  const chunks = sourcePackage.chunks
    .map((c) => `[${c.chunkId}]${c.sectionLabel ? ` (${c.sectionLabel})` : ''} ${c.text}`)
    .join('\n\n');
  return [
    'Draft a scene grammar from the source chunks: archetypes (with weightRange, role, promptText),',
    'location zones, environmental modifiers, compatibility rules, and negative constraints.',
    'Every record must carry provenance citing chunk ids from this document. Use generic labels from',
    'the source — do not import archetypes from any other scene. Return a single JSON object.',
    '',
    'SOURCE CHUNKS:',
    chunks
  ].join('\n');
}

export function assembleGrammar(args: {
  payload: SceneGrammar | unknown;
  sourcePackage: SourcePackage;
  runId: string;
  inputId: string;
  createdAt: string;
  analysisMode: SceneGrammar['analysisMode'];
}): { grammar: SceneGrammar; report: GrammarReport } {
  const parsed = SceneGrammarPayloadSchema.parse(args.payload);
  const { payload, report } = verifyGrammarPayload(parsed, args.sourcePackage);
  const grammar = SceneGrammarSchema.parse({
    artifact: 'scene-grammar',
    runId: args.runId,
    inputId: args.inputId,
    createdAt: args.createdAt,
    analysisMode: args.analysisMode,
    grammarTarget: 'base',
    ...payload
  });
  return { grammar, report };
}

export async function draftGrammar(args: {
  provider: LlmProvider;
  sourcePackage: SourcePackage;
  runId: string;
  inputId: string;
  createdAt: string;
}): Promise<{ grammar: SceneGrammar; report: GrammarReport; replayed: boolean }> {
  const result = await args.provider.complete({
    stage: 'grammar',
    prompt: buildGrammarPrompt(args.sourcePackage),
    schema: SceneGrammarPayloadSchema,
    schemaName: 'scene-grammar'
  });
  const { grammar, report } = assembleGrammar({
    payload: result.data,
    sourcePackage: args.sourcePackage,
    runId: args.runId,
    inputId: args.inputId,
    createdAt: args.createdAt,
    analysisMode: result.replayed ? 'replayed-llm-semantic' : 'llm-semantic'
  });
  return { grammar, report, replayed: result.replayed };
}

export { verifyGrammarPayload } from './verify';

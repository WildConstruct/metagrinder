import type { z } from 'zod';

/**
 * Provider interface (S3.1). Every semantic stage talks to the model through
 * this. The output is UNTRUSTED until parsed against `schema` — the provider
 * returns validated data or throws. Live responses are cached as run artifacts
 * so a re-run in replay mode reproduces identical results (determinism of runs,
 * not of models).
 */

export interface LlmRequest<T> {
  /** Pipeline stage name — used for the cache key and model registry. */
  stage: string;
  system?: string;
  prompt: string;
  /** Zod schema the raw response must satisfy after JSON parse. Input is left
   *  open (schemas with .default() have input != output) so T binds to output. */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Stable name for the schema (part of the cache key; also a tool name hint). */
  schemaName: string;
  maxRetries?: number;
}

export interface LlmResult<T> {
  data: T;
  raw: string;
  cacheKey: string;
  provider: string;
  model: string;
  modelVersion?: string;
  replayed: boolean;
}

export interface LlmProvider {
  readonly mode?: 'record' | 'replay' | 'auto';
  readonly id: string;
  readonly model: string;
  readonly modelVersion?: string;
  complete<T>(req: LlmRequest<T>): Promise<LlmResult<T>>;
}

/** Raw text transport — the network/spawn boundary. Wrapped by record/replay. */
export type Transport = (req: {
  stage: string;
  system?: string;
  prompt: string;
  schemaName: string;
}) => Promise<{ rawText: string }>;

export class LlmValidationError extends Error {
  constructor(public readonly stage: string, public readonly issues: string, public readonly raw: string) {
    super(`llm response failed ${stage} schema validation: ${issues}`);
    this.name = 'LlmValidationError';
  }
}

export class ReplayMissError extends Error {
  constructor(public readonly cacheKey: string, public readonly stage: string) {
    super(`replay mode: no cached response for stage ${stage} (key ${cacheKey})`);
    this.name = 'ReplayMissError';
  }
}

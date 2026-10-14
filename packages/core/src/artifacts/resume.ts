import { zodToJsonSchema } from 'zod-to-json-schema';
import type { LlmProvider, LlmRequest } from '../providers/types';
import { sha256Hex } from './ids';
import { BudgetExceededError, type RunStore } from './store';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  }
  return value;
}

/** Version algorithm inputs explicitly; timestamps are not execution identity. */
export function stageInputSignature(inputs: unknown): string {
  return sha256Hex(JSON.stringify(canonical(inputs)));
}

/** Pin the actual request schema/prompt and provider, not just a stage label. */
export function semanticRequestIdentity<T>(provider: LlmProvider, request: LlmRequest<T>): unknown {
  return {
    provider: provider.id, model: provider.model, modelVersion: provider.modelVersion,
    stage: request.stage, prompt: request.prompt, system: request.system,
    schemaName: request.schemaName,
    schema: zodToJsonSchema(request.schema, { name: request.schemaName, $refStrategy: 'none' })
  };
}

export async function runResumableStage<T>(args: {
  store: RunStore;
  stage: string;
  inputs: unknown;
  outputs: Array<{ family: string; path: string }>;
  operation: () => Promise<T> | T;
  load: () => T;
  now: () => string;
  forceRerun?: boolean;
  /** Explicit replay may revalidate a cached response without reserving spend. */
  replay?: boolean;
}): Promise<T> {
  const inputSignature = stageInputSignature(args.inputs);
  const record = args.store.getManifest().stages.find((entry) => entry.stage === args.stage);
  if (!args.forceRerun && !args.replay && record?.state === 'complete'
    && record.inputSignature === inputSignature) {
    // Do not repair corruption by silently overwriting the evidence checkpoint.
    const manifest = args.store.getManifest();
    for (const output of args.outputs) {
      const data = args.store.readArtifact<Record<string, unknown>>(output.family, output.path);
      if ((data.runId !== undefined && data.runId !== manifest.runId)
        || (data.inputId !== undefined && data.inputId !== manifest.inputId)) {
        throw new Error(`resumed artifact identity mismatch: ${output.path}`);
      }
    }
    return args.load();
  }
  if (!args.replay && record?.state === 'blocked_on_gate' && record.gate === 'budget-cap') {
    throw new BudgetExceededError(args.stage, args.store.getBudgetLedgers().map((ledger) => ledger.ledgerId),
      record.error ?? `budget cap blocks ${args.stage}; change the cap before retrying`);
  }
  args.store.setStageState(args.stage, 'running', { inputSignature }, args.now);
  try {
    const result = await args.operation();
    args.store.setStageState(args.stage, 'complete', {
      inputSignature, outputArtifacts: args.outputs.map((output) => output.path)
    }, args.now);
    return result;
  } catch (error) {
    if (!(error instanceof BudgetExceededError)) {
      args.store.setStageState(args.stage, 'failed', {
        inputSignature, error: error instanceof Error ? error.message : String(error)
      }, args.now);
    }
    throw error;
  }
}

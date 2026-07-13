import { z } from 'zod';
import { StageStateSchema } from './vocabulary';

/**
 * run-manifest: durable run state. One per run folder.
 * Stage records make runs resumable; model records make baselines
 * invalidatable on provider/model change.
 */

export const StageRecordSchema = z.object({
  stage: z.string(),
  state: StageStateSchema.default('pending'),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  /** Set when state is blocked_on_gate: which operator action unblocks it. */
  gate: z.string().optional(),
  error: z.string().optional(),
  inputArtifacts: z.array(z.string()).default([]),
  outputArtifacts: z.array(z.string()).default([])
});
export type StageRecord = z.infer<typeof StageRecordSchema>;

export const ArtifactRecordSchema = z.object({
  artifactId: z.string(),
  family: z.string(),
  path: z.string(),
  contentSha256: z.string(),
  writtenAt: z.string().datetime()
});
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;

export const ModelRecordSchema = z.object({
  stage: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  modelVersion: z.string().optional()
});
export type ModelRecord = z.infer<typeof ModelRecordSchema>;

export const BudgetCapsSchema = z.object({
  maxLlmCalls: z.number().int().nonnegative().optional(),
  maxJudgeCalls: z.number().int().nonnegative().optional(),
  maxEstimatedTokens: z.number().int().nonnegative().optional()
});
export type BudgetCaps = z.infer<typeof BudgetCapsSchema>;

export const BudgetUsageSchema = z.object({
  llmCalls: z.number().int().nonnegative().default(0),
  judgeCalls: z.number().int().nonnegative().default(0),
  estimatedInputTokens: z.number().int().nonnegative().default(0),
  estimatedOutputTokens: z.number().int().nonnegative().default(0)
});
export type BudgetUsage = z.infer<typeof BudgetUsageSchema>;

export const BudgetLedgerSchema = z.object({
  ledgerId: z.string(),
  scope: z.enum(['run', 'campaign']),
  scopeId: z.string(),
  caps: BudgetCapsSchema.default({}),
  usage: BudgetUsageSchema.default({
    llmCalls: 0,
    judgeCalls: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0
  })
});
export type BudgetLedger = z.infer<typeof BudgetLedgerSchema>;

export const RunManifestSchema = z.object({
  artifact: z.literal('run-manifest'),
  schemaVersion: z.string().default('0.1.0'),
  runId: z.string(),
  inputId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  parserVersion: z.string(),
  stages: z.array(StageRecordSchema).default([]),
  artifacts: z.array(ArtifactRecordSchema).default([]),
  models: z.array(ModelRecordSchema).default([]),
  budgets: z.array(BudgetLedgerSchema).default([])
});
export type RunManifest = z.infer<typeof RunManifestSchema>;

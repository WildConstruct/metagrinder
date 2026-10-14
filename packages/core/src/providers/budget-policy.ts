import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunStore } from '../artifacts/store';
import type { BudgetCaps } from '../schemas/run-manifest';

function optionalCap(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a nonnegative safe integer`);
  return value;
}

export function budgetCapsFromEnv(env: NodeJS.ProcessEnv, prefix = 'METAGRINDER'): BudgetCaps {
  const maxLlmCalls = optionalCap(env, `${prefix}_MAX_LLM_CALLS`);
  const maxJudgeCalls = optionalCap(env, `${prefix}_MAX_JUDGE_CALLS`);
  const maxEstimatedTokens = optionalCap(env, `${prefix}_MAX_ESTIMATED_TOKENS`);
  return {
    ...(maxLlmCalls !== undefined ? { maxLlmCalls } : {}),
    ...(maxJudgeCalls !== undefined ? { maxJudgeCalls } : {}),
    ...(maxEstimatedTokens !== undefined ? { maxEstimatedTokens } : {})
  };
}

export interface ProviderBudgetPolicy {
  env?: NodeJS.ProcessEnv;
  runBudgetCaps?: BudgetCaps;
  campaignBudget?: { campaignId: string; caps: BudgetCaps; baseDir: string };
}

export function configureProviderBudgets(store: RunStore, policy: ProviderBudgetPolicy = {}): void {
  const env = policy.env ?? process.env;
  const manifest = store.getManifest();
  store.configureBudget({
    ledgerId: `run:${manifest.runId}`, scope: 'run', scopeId: manifest.runId,
    caps: policy.runBudgetCaps ?? budgetCapsFromEnv(env)
  });
  const campaign = policy.campaignBudget ?? (env.METAGRINDER_CAMPAIGN_ID ? {
    campaignId: env.METAGRINDER_CAMPAIGN_ID,
    caps: budgetCapsFromEnv(env, 'METAGRINDER_CAMPAIGN'),
    baseDir: env.METAGRINDER_CAMPAIGN_BUDGET_DIR ?? path.dirname(store.runDir)
  } : undefined);
  for (const ledger of manifest.budgets) {
    if (ledger.scope === 'campaign' && ledger.scopeId !== campaign?.campaignId) {
      store.configureBudget({ ledgerId: ledger.ledgerId, scope: 'campaign', scopeId: ledger.scopeId, caps: {} });
    }
  }
  if (campaign) {
    store.configureBudget({
      ledgerId: `campaign:${campaign.campaignId}`, scope: 'campaign', scopeId: campaign.campaignId,
      caps: campaign.caps, sharedBaseDir: campaign.baseDir
    });
  }
}

/** The low-level live wrapper also accounts spend when a caller omits its store. */
export function openProviderBudgetStore(runDir: string, policy: ProviderBudgetPolicy = {}): RunStore {
  const resolved = path.resolve(runDir);
  const store = fs.existsSync(path.join(resolved, 'run-manifest.json'))
    ? RunStore.open(resolved)
    : RunStore.create({
      baseDir: path.dirname(resolved), runId: path.basename(resolved),
      inputId: 'provider-budget', parserVersion: '0.1.0'
    });
  configureProviderBudgets(store, policy);
  return store;
}

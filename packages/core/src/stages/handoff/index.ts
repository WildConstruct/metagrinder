import * as fs from 'node:fs';
import * as path from 'node:path';
import { sha256Hex } from '../../artifacts/ids';
import type { RunStore } from '../../artifacts/store';
import {
  ImportReceiptSchema,
  ResearchPackageManifestSchema,
  type ImportReceipt,
  type ResearchPackageManifest
} from '../../schemas';

/**
 * S5.6 handoff receipts.
 * Consumers write import-receipt into the *producing* run folder. Lineage
 * queries traverse receipts; anything offered without a receipt is unconfirmed.
 */

export type HandoffConfirmStatus =
  | 'confirmed'
  | 'partial'
  | 'rejected'
  | 'unconfirmed'
  | 'hash_mismatch';

export interface HandoffLineageEntry {
  packageId: string;
  consumer: string;
  status: HandoffConfirmStatus;
  receipt?: ImportReceipt;
  expectedContentSha256: string;
  notes: string[];
}

export interface HandoffLineageReport {
  packageId: string;
  packageContentSha256: string;
  entries: HandoffLineageEntry[];
  /** True only when every expected consumer has a confirmed (imported) receipt with matching hash. */
  allConfirmed: boolean;
  /** Consumers still missing a successful receipt. */
  unconfirmedConsumers: string[];
}

export function receiptFileName(receiptId: string): string {
  // No path separators or ".." segments — basename only, safe for run-folder write.
  const safe = receiptId
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'receipt';
  return path.posix.join('receipts', `import-receipt-${safe}.json`);
}

/** Sort object keys recursively while preserving arrays and all nested values. */
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => [key, canonicalValue(entry)]));
  }
  return value;
}

/** Package identity includes every nested collection descriptor and content hash. */
export function packageContentSha256(manifest: ResearchPackageManifest): string {
  const parsed = ResearchPackageManifestSchema.parse(manifest);
  if (parsed.collections.length === 0 || parsed.collections.some((collection) => !collection.contentSha256)) {
    throw new Error('package content hash requires sealed, nonempty collections with content hashes');
  }
  const canonical = JSON.stringify(canonicalValue(parsed));
  return sha256Hex(canonical);
}

/** Bind an offered package to schema-validated, hash-verified bytes in this run. */
export function sealPackageManifest(
  store: RunStore,
  manifest: ResearchPackageManifest
): ResearchPackageManifest {
  const parsed = ResearchPackageManifestSchema.parse(manifest);
  const run = store.getManifest();
  if (parsed.runId !== run.runId || parsed.inputId !== run.inputId) {
    throw new Error('package manifest must identify the producing run and input');
  }
  const seenIds = new Set<string>();
  const collections = parsed.collections.map((collection) => {
    if (seenIds.has(collection.id)) throw new Error(`duplicate package collection id: ${collection.id}`);
    seenIds.add(collection.id);
    store.readArtifact(collection.family, collection.path);
    const record = run.artifacts.find((artifact) =>
      artifact.family === collection.family && artifact.path === collection.path);
    if (!record) throw new Error(`package collection is not recorded: ${collection.path}`);
    return { ...collection, contentSha256: record.contentSha256 };
  });
  const sealed = ResearchPackageManifestSchema.parse({ ...parsed, collections });
  packageContentSha256(sealed);
  return sealed;
}

export function createImportReceipt(args: {
  receiptId: string;
  packageId: string;
  contentSha256: string;
  consumer: string;
  status: ImportReceipt['status'];
  receivedAt: string;
  consumerRef?: string;
  notes?: string;
}): ImportReceipt {
  return ImportReceiptSchema.parse({
    artifact: 'import-receipt',
    receiptId: args.receiptId,
    packageId: args.packageId,
    contentSha256: args.contentSha256,
    consumer: args.consumer,
    status: args.status,
    receivedAt: args.receivedAt,
    ...(args.consumerRef !== undefined ? { consumerRef: args.consumerRef } : {}),
    ...(args.notes !== undefined ? { notes: args.notes } : {})
  });
}

/**
 * Consumer-side write: validate receipt and store under the producing run.
 * RunStore enforces schema + path containment + manifest hash record.
 */
export function writeImportReceipt(
  store: RunStore,
  receipt: ImportReceipt,
  now?: () => string
): string {
  const parsed = ImportReceiptSchema.parse(receipt);
  return store.writeArtifact('import-receipt', receiptFileName(parsed.receiptId), parsed, now);
}

/** List all import-receipt artifacts recorded on a run manifest. */
export function listImportReceipts(store: RunStore): ImportReceipt[] {
  const manifest = store.getManifest();
  const out: ImportReceipt[] = [];
  for (const a of manifest.artifacts) {
    if (a.family !== 'import-receipt') continue;
    out.push(store.readArtifact<ImportReceipt>('import-receipt', a.path));
  }
  return out;
}

/**
 * Load receipts from a run directory without requiring full RunStore open
 * (useful when only the receipts/ tree is available).
 */
export function loadReceiptsFromDir(runDir: string): ImportReceipt[] {
  const dir = path.join(runDir, 'receipts');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out: ImportReceipt[] = [];
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const parsed = ImportReceiptSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function entryForConsumer(args: {
  packageId: string;
  consumer: string;
  expectedContentSha256: string;
  receipts: ImportReceipt[];
}): HandoffLineageEntry {
  const forConsumer = args.receipts.filter(
    (r) => r.packageId === args.packageId && r.consumer === args.consumer
  );

  if (forConsumer.length === 0) {
    return {
      packageId: args.packageId,
      consumer: args.consumer,
      status: 'unconfirmed',
      expectedContentSha256: args.expectedContentSha256,
      notes: ['No import-receipt written by this consumer into the producing run.']
    };
  }

  // Prefer the latest receipt by receivedAt
  const receipt = [...forConsumer].sort((a, b) =>
    a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : 0
  )[0]!;

  if (receipt.contentSha256 !== args.expectedContentSha256) {
    return {
      packageId: args.packageId,
      consumer: args.consumer,
      status: 'hash_mismatch',
      receipt,
      expectedContentSha256: args.expectedContentSha256,
      notes: [
        `Receipt hash ${receipt.contentSha256} does not match package ${args.expectedContentSha256}.`
      ]
    };
  }

  if (receipt.status === 'rejected') {
    return {
      packageId: args.packageId,
      consumer: args.consumer,
      status: 'rejected',
      receipt,
      expectedContentSha256: args.expectedContentSha256,
      notes: [receipt.notes ?? 'Consumer rejected the handoff.']
    };
  }

  if (receipt.status === 'partially_imported') {
    return {
      packageId: args.packageId,
      consumer: args.consumer,
      status: 'partial',
      receipt,
      expectedContentSha256: args.expectedContentSha256,
      notes: [receipt.notes ?? 'Consumer reported partial import.']
    };
  }

  return {
    packageId: args.packageId,
    consumer: args.consumer,
    status: 'confirmed',
    receipt,
    expectedContentSha256: args.expectedContentSha256,
    notes: [`Imported at ${receipt.receivedAt}${receipt.consumerRef ? ` ref=${receipt.consumerRef}` : ''}.`]
  };
}

/**
 * Lineage query over expected consumers + receipts.
 * AC-5.6a: missing receipt → status `unconfirmed`.
 */
export function queryHandoffLineage(args: {
  packageId: string;
  packageContentSha256: string;
  expectedConsumers: string[];
  receipts: ImportReceipt[];
}): HandoffLineageReport {
  const entries = args.expectedConsumers.map((consumer) =>
    entryForConsumer({
      packageId: args.packageId,
      consumer,
      expectedContentSha256: args.packageContentSha256,
      receipts: args.receipts
    })
  );

  const unconfirmedConsumers = entries
    .filter((e) => e.status === 'unconfirmed' || e.status === 'hash_mismatch' || e.status === 'rejected' || e.status === 'partial')
    .map((e) => e.consumer);

  // allConfirmed only when every expected consumer is fully confirmed
  const allConfirmed =
    args.expectedConsumers.length > 0
    && entries.every((e) => e.status === 'confirmed');

  return {
    packageId: args.packageId,
    packageContentSha256: args.packageContentSha256,
    entries,
    allConfirmed,
    unconfirmedConsumers: entries
      .filter((e) => e.status !== 'confirmed')
      .map((e) => e.consumer)
  };
}

/** Convenience: lineage from an open RunStore. */
export function queryRunHandoffLineage(args: {
  store: RunStore;
  manifest: ResearchPackageManifest;
  expectedConsumers: string[];
}): HandoffLineageReport {
  const current = sealPackageManifest(args.store, args.manifest);
  return queryHandoffLineage({
    packageId: current.packageId,
    packageContentSha256: packageContentSha256(current),
    expectedConsumers: args.expectedConsumers,
    receipts: listImportReceipts(args.store)
  });
}

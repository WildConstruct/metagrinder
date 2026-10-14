import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RunStore } from '../../artifacts/store';
import { ResearchPackageManifestSchema, type ResearchPackageManifest } from '../../schemas';
import {
  createImportReceipt,
  listImportReceipts,
  loadReceiptsFromDir,
  packageContentSha256,
  queryHandoffLineage,
  queryRunHandoffLineage,
  receiptFileName,
  sealPackageManifest,
  writeImportReceipt
} from './index';

const NOW = '2026-07-15T15:00:00.000Z';
const LATER = '2026-07-15T16:00:00.000Z';

function samplePackage(): ResearchPackageManifest {
  return ResearchPackageManifestSchema.parse({
    artifact: 'research-package',
    packageId: 'pkg_1909_indy_roadshow_v0',
    runId: 'run_handoff_1',
    inputId: 'cell_1909_indianapolis_speedway',
    title: '1909 Indy mini-cell research package',
    createdAt: NOW,
    parserVersion: '0.1.0',
    sourceInputIds: ['eracrowd-1909-external-manifest'],
    collections: [
      { id: 'utdg', family: 'utdg-candidates', path: 'utdg-candidates.json', contentSha256: 'a'.repeat(64) },
      { id: 'plans', family: 'content-plans', path: 'content-plans.json', contentSha256: 'b'.repeat(64) }
    ],
    reviewStatus: 'staged'
  });
}

describe('import receipt helpers (S5.6)', () => {
  test('receipt file names stay under receipts/', () => {
    expect(receiptFileName('rcpt_eracrowd_1')).toBe('receipts/import-receipt-rcpt_eracrowd_1.json');
    expect(receiptFileName('weird/../id')).toContain('receipts/');
    expect(receiptFileName('weird/../id')).not.toContain('..');
  });

  test('package content hash is stable for the same manifest', () => {
    const pkg = samplePackage();
    expect(packageContentSha256(pkg)).toBe(packageContentSha256(pkg));
    expect(packageContentSha256(pkg)).toMatch(/^[a-f0-9]{64}$/);
  });

  test.each(['id', 'family', 'path'])('[S-R1e] hash covers nested collection %s', (field) => {
    const pkg = samplePackage();
    const changed = JSON.parse(JSON.stringify(pkg)) as ResearchPackageManifest;
    Object.assign(changed.collections[0]!, {
      [field]: field === 'family' ? 'extraction' : 'different'
    });
    expect(packageContentSha256(changed)).not.toBe(packageContentSha256(pkg));
  });

  test('[S-R1e] unsealed collections cannot identify an acknowledged package', () => {
    const pkg = samplePackage();
    const unsealed = ResearchPackageManifestSchema.parse({
      ...pkg,
      collections: pkg.collections.map(({ id, family, path }) => ({ id, family, path }))
    });
    expect(() => packageContentSha256(unsealed)).toThrow(/content hash/i);
  });

  test('[S-R1e] canonicalization preserves nested content and ignores key insertion order', () => {
    const pkg = samplePackage();
    const reversed = {
      ...pkg,
      collections: pkg.collections.map((collection) => Object.fromEntries(Object.entries(collection).reverse()))
    } as ResearchPackageManifest;
    expect(packageContentSha256(reversed)).toBe(packageContentSha256(pkg));
    const changed = JSON.parse(JSON.stringify(pkg)) as ResearchPackageManifest;
    changed.collections[0]!.contentSha256 = 'c'.repeat(64);
    expect(packageContentSha256(changed)).not.toBe(packageContentSha256(pkg));
  });
});

describe('queryHandoffLineage (AC-5.6a)', () => {
  const pkg = samplePackage();
  const hash = packageContentSha256(pkg);

  test('[AC-5.6a] unreceipted handoff shows as unconfirmed', () => {
    const report = queryHandoffLineage({
      packageId: pkg.packageId,
      packageContentSha256: hash,
      expectedConsumers: ['eracrowd', 'image_prep', 'extraextra'],
      receipts: []
    });

    expect(report.entries).toHaveLength(3);
    expect(report.entries.every((e) => e.status === 'unconfirmed')).toBe(true);
    expect(report.allConfirmed).toBe(false);
    expect(report.unconfirmedConsumers.sort()).toEqual(['eracrowd', 'extraextra', 'image_prep'].sort());
    expect(report.entries[0]!.notes[0]).toMatch(/No import-receipt/);
  });

  test('partial receipts: one confirmed, others unconfirmed', () => {
    const receipt = createImportReceipt({
      receiptId: 'rcpt_eracrowd_1',
      packageId: pkg.packageId,
      contentSha256: hash,
      consumer: 'eracrowd',
      status: 'imported',
      receivedAt: NOW,
      consumerRef: 'eracrowd://packs/1909_indy'
    });

    const report = queryHandoffLineage({
      packageId: pkg.packageId,
      packageContentSha256: hash,
      expectedConsumers: ['eracrowd', 'image_prep'],
      receipts: [receipt]
    });

    const byConsumer = Object.fromEntries(report.entries.map((e) => [e.consumer, e]));
    expect(byConsumer.eracrowd!.status).toBe('confirmed');
    expect(byConsumer.image_prep!.status).toBe('unconfirmed');
    expect(report.allConfirmed).toBe(false);
    expect(report.unconfirmedConsumers).toEqual(['image_prep']);
  });

  test('rejected and partial import statuses surface correctly', () => {
    const receipts = [
      createImportReceipt({
        receiptId: 'rcpt_a',
        packageId: pkg.packageId,
        contentSha256: hash,
        consumer: 'eracrowd',
        status: 'rejected',
        receivedAt: NOW,
        notes: 'rights blocked'
      }),
      createImportReceipt({
        receiptId: 'rcpt_b',
        packageId: pkg.packageId,
        contentSha256: hash,
        consumer: 'image_prep',
        status: 'partially_imported',
        receivedAt: NOW,
        notes: 'photos only'
      })
    ];
    const report = queryHandoffLineage({
      packageId: pkg.packageId,
      packageContentSha256: hash,
      expectedConsumers: ['eracrowd', 'image_prep'],
      receipts
    });
    expect(report.entries.find((e) => e.consumer === 'eracrowd')!.status).toBe('rejected');
    expect(report.entries.find((e) => e.consumer === 'image_prep')!.status).toBe('partial');
    expect(report.allConfirmed).toBe(false);
  });

  test('hash mismatch when consumer receipt does not match package', () => {
    const receipt = createImportReceipt({
      receiptId: 'rcpt_stale',
      packageId: pkg.packageId,
      contentSha256: '0'.repeat(64),
      consumer: 'eracrowd',
      status: 'imported',
      receivedAt: NOW
    });
    const report = queryHandoffLineage({
      packageId: pkg.packageId,
      packageContentSha256: hash,
      expectedConsumers: ['eracrowd'],
      receipts: [receipt]
    });
    expect(report.entries[0]!.status).toBe('hash_mismatch');
    expect(report.unconfirmedConsumers).toContain('eracrowd');
  });

  test('all expected consumers confirmed → allConfirmed', () => {
    const receipts = ['eracrowd', 'image_prep'].map((consumer, i) =>
      createImportReceipt({
        receiptId: `rcpt_${i}`,
        packageId: pkg.packageId,
        contentSha256: hash,
        consumer,
        status: 'imported',
        receivedAt: NOW
      })
    );
    const report = queryHandoffLineage({
      packageId: pkg.packageId,
      packageContentSha256: hash,
      expectedConsumers: ['eracrowd', 'image_prep'],
      receipts
    });
    expect(report.allConfirmed).toBe(true);
    expect(report.unconfirmedConsumers).toHaveLength(0);
    expect(report.entries.every((e) => e.status === 'confirmed')).toBe(true);
  });

  test('latest receipt per consumer wins', () => {
    const receipts = [
      createImportReceipt({
        receiptId: 'rcpt_old',
        packageId: pkg.packageId,
        contentSha256: hash,
        consumer: 'eracrowd',
        status: 'rejected',
        receivedAt: NOW
      }),
      createImportReceipt({
        receiptId: 'rcpt_new',
        packageId: pkg.packageId,
        contentSha256: hash,
        consumer: 'eracrowd',
        status: 'imported',
        receivedAt: LATER
      })
    ];
    const report = queryHandoffLineage({
      packageId: pkg.packageId,
      packageContentSha256: hash,
      expectedConsumers: ['eracrowd'],
      receipts
    });
    expect(report.entries[0]!.status).toBe('confirmed');
    expect(report.entries[0]!.receipt?.receiptId).toBe('rcpt_new');
  });
});

describe('RunStore receipt write (S5.6)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-handoff-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('consumer writes receipt into producing run; lineage reads it back', () => {
    const pkg = samplePackage();
    const store = RunStore.create({
      baseDir: tmp,
      runId: pkg.runId,
      inputId: pkg.inputId,
      parserVersion: '0.1.0',
      now: () => NOW
    });

    writeCollections(store, pkg);
    const sealed = sealPackageManifest(store, pkg);
    const hash = packageContentSha256(sealed);

    // Handoff offered to two consumers; only EraCrowd writes a receipt
    const reportBefore = queryRunHandoffLineage({
      store,
      manifest: sealed,
      expectedConsumers: ['eracrowd', 'extraextra']
    });
    expect(reportBefore.entries.every((e) => e.status === 'unconfirmed')).toBe(true);

    const receipt = createImportReceipt({
      receiptId: 'rcpt_eracrowd_run1',
      packageId: pkg.packageId,
      contentSha256: hash,
      consumer: 'eracrowd',
      status: 'imported',
      receivedAt: LATER,
      consumerRef: 'LookBundle/1909_indy_v0'
    });
    const written = writeImportReceipt(store, receipt, () => LATER);
    expect(fs.existsSync(written)).toBe(true);
    expect(written.replace(/\\/g, '/')).toContain('receipts/import-receipt-rcpt_eracrowd_run1.json');

    const listed = listImportReceipts(store);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.consumer).toBe('eracrowd');

    // Also loadable from disk path
    const fromDir = loadReceiptsFromDir(store.runDir);
    expect(fromDir).toHaveLength(1);

    const reportAfter = queryRunHandoffLineage({
      store,
      manifest: sealed,
      expectedConsumers: ['eracrowd', 'extraextra']
    });
    expect(reportAfter.entries.find((e) => e.consumer === 'eracrowd')!.status).toBe('confirmed');
    expect(reportAfter.entries.find((e) => e.consumer === 'extraextra')!.status).toBe('unconfirmed');
    expect(reportAfter.allConfirmed).toBe(false);
    expect(reportAfter.unconfirmedConsumers).toEqual(['extraextra']);
  });

  test('[S-R1e] a changed offered artifact invalidates the previous receipt', () => {
    const pkg = samplePackage();
    const store = RunStore.create({ baseDir: tmp, runId: pkg.runId, inputId: pkg.inputId, parserVersion: '0.1.0' });
    writeCollections(store, pkg);
    const sealed = sealPackageManifest(store, pkg);
    const receipt = createImportReceipt({
      receiptId: 'old', packageId: pkg.packageId,
      contentSha256: packageContentSha256(sealed), consumer: 'eracrowd', status: 'imported', receivedAt: NOW
    });
    writeImportReceipt(store, receipt);
    const current = store.readArtifact<Record<string, unknown>>('utdg-candidates', 'utdg-candidates.json');
    store.writeArtifact('utdg-candidates', 'utdg-candidates.json', { ...current, cellId: 'changed-cell' });
    const report = queryRunHandoffLineage({ store, manifest: sealed, expectedConsumers: ['eracrowd'] });
    expect(report.entries[0]!.status).toBe('hash_mismatch');
    expect(report.allConfirmed).toBe(false);
  });

  test('[S-R1e] sealing rejects unrecorded, tampered, and foreign-run artifacts', () => {
    const pkg = samplePackage();
    const store = RunStore.create({ baseDir: tmp, runId: pkg.runId, inputId: pkg.inputId, parserVersion: '0.1.0' });
    expect(() => sealPackageManifest(store, pkg)).toThrow();
    writeCollections(store, pkg);
    expect(() => sealPackageManifest(store, { ...pkg, runId: 'another-run' })).toThrow(/run/i);
    const file = path.join(store.runDir, 'utdg-candidates.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...data, cellId: 'tampered' }), 'utf8');
    expect(() => sealPackageManifest(store, pkg)).toThrow(/hash mismatch/i);
  });
});

function writeCollections(store: RunStore, pkg: ResearchPackageManifest): void {
  const envelope = { runId: pkg.runId, inputId: pkg.inputId, createdAt: NOW };
  store.writeArtifact('utdg-candidates', 'utdg-candidates.json', {
    artifact: 'utdg-candidates', ...envelope, candidates: []
  });
  store.writeArtifact('content-plans', 'content-plans.json', {
    artifact: 'content-plans', ...envelope, grammarTarget: 'base', seed: 1, plans: [], realized: []
  });
}

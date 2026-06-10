import { z } from 'zod';

/**
 * import-receipt: written BY the consumer INTO the producing run's folder.
 * The only proof that a cross-repo handoff landed. Lineage queries traverse
 * receipts; an unreceipted handoff reports as `unconfirmed`.
 */

export const ImportReceiptSchema = z.object({
  artifact: z.literal('import-receipt'),
  schemaVersion: z.string().default('0.1.0'),
  receiptId: z.string(),
  packageId: z.string(),
  contentSha256: z.string(),
  consumer: z.string(),
  consumerRef: z.string().optional(),
  status: z.enum(['imported', 'partially_imported', 'rejected']),
  notes: z.string().optional(),
  receivedAt: z.string().datetime()
});
export type ImportReceipt = z.infer<typeof ImportReceiptSchema>;

import { createHash } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import type { Receipt, Trip } from '@prisma/client';
import { recordAuditEvent } from './audit';
import { DATA_DIR, RECEIPTS_DIR, type DbClient } from './db';
import { ValidationError } from './errors';

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

function sanitizeFilename(name: string): string {
  const base = path.basename(name);
  const cleaned = base.replace(/[^\w.\-]/g, '_');
  return cleaned.slice(0, 200) || 'receipt';
}

function resolveContentType(contentType: string | null | undefined, filename: string): string {
  if (contentType && ALLOWED_CONTENT_TYPES[contentType.toLowerCase()]) {
    return contentType.toLowerCase();
  }
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpeg') return 'image/jpeg';
  for (const [mime, suffix] of Object.entries(ALLOWED_CONTENT_TYPES)) {
    if (suffix === ext) return mime;
  }
  throw new ValidationError('Unsupported file type. Accepted formats: JPEG, PNG, WebP, HEIC.');
}

export async function ensureReceiptsDir(): Promise<void> {
  await mkdir(RECEIPTS_DIR, { recursive: true });
}

export async function listReceiptsForTrip(db: DbClient, tripId: number): Promise<Receipt[]> {
  return db.receipt.findMany({
    where: { tripId },
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
  });
}

export async function getReceipt(db: DbClient, receiptId: number): Promise<Receipt | null> {
  return db.receipt.findUnique({ where: { id: receiptId } });
}

export function receiptFilePath(receipt: Receipt): string {
  return path.join(DATA_DIR, receipt.storagePath);
}

export async function storeReceipt(
  db: DbClient,
  trip: Trip,
  filename: string,
  contentType: string | null | undefined,
  data: Buffer
): Promise<Receipt> {
  if (!data.length) {
    throw new ValidationError('Receipt file is empty.');
  }
  if (data.length > MAX_RECEIPT_BYTES) {
    throw new ValidationError('Receipt exceeds the 10 MB size limit.');
  }

  const resolvedType = resolveContentType(contentType, filename);
  const safeName = sanitizeFilename(filename);
  const contentHash = createHash('sha256').update(data).digest('hex');

  await ensureReceiptsDir();

  const receipt = await db.receipt.create({
    data: {
      tripId: trip.id,
      originalFilename: safeName,
      contentType: resolvedType,
      byteSize: data.length,
      contentHash,
      storagePath: '',
    },
  });

  const tripDir = path.join(RECEIPTS_DIR, String(trip.id));
  await mkdir(tripDir, { recursive: true });
  const suffix =
    ALLOWED_CONTENT_TYPES[resolvedType] ?? (path.extname(safeName) || '.bin');
  const storedName = `${receipt.id}_${path.parse(safeName).name}${suffix}`;
  const filePath = path.join(tripDir, storedName);
  await writeFile(filePath, data);

  const relativePath = path.relative(DATA_DIR, filePath);
  const updated = await db.receipt.update({
    where: { id: receipt.id },
    data: { storagePath: relativePath },
  });

  await recordAuditEvent(db, {
    entityType: 'receipt',
    entityId: receipt.id,
    action: 'create',
    fieldChanges: {
      trip_id: trip.id,
      original_filename: safeName,
      content_type: resolvedType,
      byte_size: data.length,
      content_hash: contentHash,
    },
  });

  return updated;
}

export async function deleteReceipt(db: DbClient, receipt: Receipt): Promise<void> {
  const snapshot = {
    trip_id: receipt.tripId,
    original_filename: receipt.originalFilename,
    content_type: receipt.contentType,
    byte_size: receipt.byteSize,
    content_hash: receipt.contentHash,
  };

  await db.receipt.delete({ where: { id: receipt.id } });

  await recordAuditEvent(db, {
    entityType: 'receipt',
    entityId: receipt.id,
    action: 'delete',
    fieldChanges: snapshot,
  });

  const filePath = receiptFilePath(receipt);
  try {
    await unlink(filePath);
  } catch {
    // file may already be missing
  }
}

export async function deleteReceiptsForTrip(db: DbClient, tripId: number): Promise<void> {
  const receipts = await listReceiptsForTrip(db, tripId);
  for (const receipt of receipts) {
    await deleteReceipt(db, receipt);
  }
}

export function receiptReferenceSummary(receipts: Receipt[]): string {
  if (!receipts.length) return '';
  const parts = receipts.map((r) => `${r.id}:${r.originalFilename}`);
  return `${receipts.length} (${parts.join('; ')})`;
}

export async function readReceiptBytes(receipt: Receipt): Promise<Buffer | null> {
  try {
    return await readFile(receiptFilePath(receipt));
  } catch {
    return null;
  }
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

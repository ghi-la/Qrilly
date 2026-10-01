import type { Types } from 'mongoose';
import { HttpError } from './api';
import { FileAsset, Invoice, Preset } from './models';

const GRACE_MS = 60 * 60_000;

/** A preset may only point at a logo its own owner uploaded. */
export async function assertOwnLogo(userId: Types.ObjectId, fileId: string | null | undefined) {
  if (!fileId) return;
  const exists = await FileAsset.exists({ _id: fileId, userId }).catch(() => null);
  if (!exists) throw new HttpError(400, 'That logo no longer exists. Upload it again.');
}

/**
 * Removes uploads nothing points at any more - replaced logos, deleted
 * presets, abandoned dialogs. Invoices keep the logo they were issued with,
 * so anything an invoice references stays. The grace period keeps a file that
 * was just uploaded into a dialog that hasn't been saved yet.
 */
export async function purgeUnusedLogos(userId: Types.ObjectId) {
  const [presetLogos, invoiceLogos] = await Promise.all([
    Preset.distinct('logoFileId', { userId }),
    Invoice.distinct('logoFileId', { userId }),
  ]);
  const inUse = [...presetLogos, ...invoiceLogos].filter(Boolean);
  await FileAsset.deleteMany({
    userId,
    _id: { $nin: inUse },
    createdAt: { $lt: new Date(Date.now() - GRACE_MS) },
  });
}

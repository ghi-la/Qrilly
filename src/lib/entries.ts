import type { Types } from 'mongoose';
import type { z } from 'zod';
import { HttpError } from './api';
import { Client, Preset } from './models';
import type { workEntrySchema } from './schemas';

type WorkEntryInput = z.infer<typeof workEntrySchema>;

/**
 * Resolves a validated entry payload against the owning preset and client,
 * snapshotting the matched group's unit/price/VAT the way an invoice
 * snapshots its preset - so a later change to the preset's groups doesn't
 * silently rewrite an entry that's already sitting there unbilled.
 */
export async function resolveWorkEntryFields(userId: Types.ObjectId, input: WorkEntryInput) {
  const preset = await Preset.findOne({ _id: input.presetId, userId }).lean();
  if (!preset) throw new HttpError(404, 'That preset no longer exists.');

  const client = await Client.findOne({ _id: input.clientId, userId }).select({ _id: 1 }).lean();
  if (!client) throw new HttpError(404, 'That client no longer exists.');

  const group = (preset.lineGroups ?? []).find((g) => g.name === input.groupName);
  if (!group) {
    throw new HttpError(400, 'That group is no longer part of this preset - pick another one.');
  }

  return {
    presetId: preset._id,
    clientId: client._id,
    groupName: group.name,
    unit: group.unit,
    unitPrice: group.unitPrice,
    vatRate: group.vatRate,
    quantity: input.quantity,
    note: input.note,
    entryDate: input.entryDate,
  };
}

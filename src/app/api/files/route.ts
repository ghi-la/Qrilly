import { FileAsset } from '@/lib/models';
import { purgeUnusedLogos } from '@/lib/files';
import { HttpError, ok, requireUser, route } from '@/lib/api';

export const runtime = 'nodejs';

const MAX_BYTES = 600 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Logos are small, so they live in Mongo as base64 rather than pulling an
 * object store into a deployment that otherwise needs nothing but a database.
 * Files are immutable: uploading a replacement creates a new document, which
 * is what lets an old invoice keep rendering with the logo it was issued with.
 */
export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) throw new HttpError(400, 'No file was uploaded.');
  if (!ALLOWED.includes(file.type)) throw new HttpError(400, 'Logos must be PNG, JPEG or WebP.');
  if (file.size > MAX_BYTES) throw new HttpError(400, 'Logos must be smaller than 600 KB.');

  const buffer = Buffer.from(await file.arrayBuffer());

  // Trusting the browser's Content-Type would let an arbitrary payload through
  // under an image label, so the magic bytes are checked too.
  if (!looksLikeImage(buffer)) throw new HttpError(400, 'That file is not a valid image.');

  await purgeUnusedLogos(userId);
  const asset = await FileAsset.create({
    userId,
    name: file.name.slice(0, 120),
    mime: file.type,
    size: file.size,
    data: buffer.toString('base64'),
  });

  return ok({ _id: String(asset._id), mime: asset.mime, size: asset.size }, 201);
});

function looksLikeImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  return isPng || isJpeg || isWebp;
}

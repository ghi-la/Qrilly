import { FileAsset } from '@/lib/models';
import { HttpError, requireOid, requireUser, route } from '@/lib/api';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'file');

  // Scoped to the owner: an id alone never grants access to someone's logo.
  const file = await FileAsset.findOne({ _id: id, userId }).lean();
  if (!file) throw new HttpError(404, 'File not found.');

  return new Response(new Uint8Array(Buffer.from(file.data, 'base64')), {
    headers: {
      'Content-Type': file.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
    },
  });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const userId = await requireUser();
  const id = requireOid((await params).id, 'file');
  await FileAsset.deleteOne({ _id: id, userId });
  return new Response(null, { status: 204 });
});

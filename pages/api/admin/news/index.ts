import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(200).json({
    ok: true,
    endpoints: [
      'POST   /api/admin/news/set-primary',
      'GET    /api/admin/news/list',
      'POST   /api/admin/news/create',
      'POST   /api/admin/news/update',
      'POST   /api/admin/news/delete',
      'GET    /api/admin/news/get',
      'GET    /api/admin/news/media-list',
      'POST   /api/admin/news/upload-media',
      'POST   /api/admin/news/update-media',
      'POST   /api/admin/news/delete-media',
    ],
  });
}

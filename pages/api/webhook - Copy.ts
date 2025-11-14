// pages/api/diag.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminApp, getAdminBucket } from '@/lib/firebaseAdmin';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const app = getAdminApp();
    const bucket = getAdminBucket();
    res.status(200).json({
      ok: true,
      project: (app.options as any)?.projectId || null,
      bucket: bucket?.name || null,
      runtime: 'node'
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'init failed' });
  }
}

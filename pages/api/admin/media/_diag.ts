import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { admin, adminStorage } from '@/lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as unknown)?.role !== 'admin') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    (admin.app().options as unknown)?.projectId;

  const bucketName = adminStorage?.name || '(unset)';
  let bucketOk = false;
  try { const [m] = await admin.storage().bucket().getMetadata(); bucketOk = !!m?.id; } catch {}
  res.status(200).json({ ok: true, projectId, bucketName, bucketOk });
}

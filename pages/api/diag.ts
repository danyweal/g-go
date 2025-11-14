// pages/api/diag.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminApp, getAdminDb, getAdminBucket } from "@/lib/firebaseAdmin";

// Force Node.js runtime (NOT Edge), so Admin SDK can use ADC on Hosting/Cloud Run.
export const config = { runtime: "nodejs" };

type DiagResult = {
  ok: boolean;
  where: "local" | "gcp";
  // how we *think* creds are provided (no secrets revealed)
  credMode: "adc" | "env-b64" | "env-json" | "env-split" | "unknown";
  projectId?: string;
  bucket?: string;
  firestore?: { ok: boolean; count?: number; error?: string };
  storage?: { ok: boolean; error?: string };
  notes?: string[];
  error?: string;
};

function inferCredMode(): DiagResult["credMode"] {
  if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
    // On GCP, ADC should be used unless you explicitly forced env creds.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) return "env-b64";
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return "env-json";
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) return "env-split";
    return "adc";
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) return "env-b64";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return "env-json";
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) return "env-split";
  return "unknown";
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse<DiagResult>) {
  // Don’t cache diagnostics
  res.setHeader("Cache-Control", "no-store");

  const notes: string[] = [];
  const where: DiagResult["where"] =
    (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT)
      ? "gcp"
      : "local";
  const credMode = inferCredMode();

  try {
    // Initialize / fetch singletons
    const app = getAdminApp();
    const db = getAdminDb();
    const bucket = getAdminBucket();

    const projectId = (app.options as any)?.projectId ?? process.env.GOOGLE_CLOUD_PROJECT;
    const bucketName = (() => {
      try { return bucket.name as string; } catch { return undefined; }
    })();

    // --- Firestore probe (lightweight) ---
    let fsOK = false;
    let fsCount: number | undefined;
    let fsErr: string | undefined;
    try {
      const snap = await db.collection("campaigns").limit(1).get();
      fsOK = true;
      fsCount = snap.size;
    } catch (e: any) {
      fsErr = e?.message || String(e);
    }

    // --- Storage probe (metadata only) ---
    let stOK = false;
    let stErr: string | undefined;
    try {
      // simple call that should hit ADC perms if bucket is bound
      await bucket.getMetadata(); // lightweight
      stOK = true;
    } catch (e: any) {
      stErr = e?.message || String(e);
      notes.push("If this fails on Hosting/Run, ensure service account has Storage Object Admin or at least Viewer.");
    }

    // Helpful hints
    if (where === "gpp") {
      notes.push("Running on GCP; Admin SDK should use ADC. Do NOT set GOOGLE_APPLICATION_CREDENTIALS.");
    } else {
      notes.push("Running locally; ensure env creds are set (FIREBASE_SERVICE_ACCOUNT_KEY or PRIVATE_KEY trio).");
    }

    return res.status(200).json({
      ok: fsOK || stOK,
      where,
      credMode,
      projectId,
      bucket: bucketName,
      firestore: { ok: fsOK, count: fsCount, error: fsErr },
      storage: { ok: stOK, error: stErr },
      notes,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    // Common gotcha on GCP if you accidentally set GOOGLE_APPLICATION_CREDENTIALS:
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      notes.push(
        "GOOGLE_APPLICATION_CREDENTIALS is set. On Firebase Hosting/Cloud Run you should remove it and rely on ADC."
      );
    }
    return res.status(200).json({
      ok: false,
      where,
      credMode,
      notes,
      error: msg,
    });
  }
}

// lib/firebaseAdmin.ts
// Node-only. Do NOT import this in edge runtimes or client code.

import * as admin from 'firebase-admin';

/**
 * Keep a singleton across hot reloads in dev.
 * We store both the initialized app and a small flag with how it was initialized (for diagnostics).
 */
declare global {
  // eslint-disable-next-line no-var
  var __FBA_APP__: admin.app.App | undefined;
  // eslint-disable-next-line no-var
  var __FBA_INIT_INFO__:
    | { mode: 'env-cert' | 'env-json' | 'adc' | 'no-cred' | 'reused'; projectId?: string; bucket?: string; svc?: string }
    | undefined;
}

/** Normalize a PEM private key string that might contain escaped newlines, quotes, or be base64-wrapped. */
function normalizePrivateKey(raw?: string | null) {
  if (!raw) return undefined;

  let key = String(raw).trim();

  // Remove accidental wrapping quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // Support base64-encoded keys if you store it as base64:<blob>
  if (key.startsWith('base64:')) {
    const b64 = key.slice(7);
    key = Buffer.from(b64, 'base64').toString('utf8');
  }

  // Convert escaped newlines to real newlines
  key = key.replace(/\\n/g, '\n').replace(/\\r/g, '\r').trim();

  return key;
}

/** Try to parse a full service-account JSON (string or base64:<blob>). Returns undefined if not present or invalid. */
function readServiceAccountJsonFromEnv():
  | admin.ServiceAccount
  | undefined {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return undefined;

  let txt = raw.trim();

  // Remove accidental wrapping quotes
  if ((txt.startsWith('"') && txt.endsWith('"')) || (txt.startsWith("'") && txt.endsWith("'"))) {
    txt = txt.slice(1, -1);
  }

  // Support base64-encoded JSON with prefix
  if (txt.startsWith('base64:')) {
    const b64 = txt.slice(7);
    txt = Buffer.from(b64, 'base64').toString('utf8');
  }

  try {
    const parsed = JSON.parse(txt);
    // Light sanity check
    if (parsed.client_email && parsed.private_key) {
      // Normalize possible escaped newlines in the private_key
      parsed.private_key = normalizePrivateKey(parsed.private_key);
      return parsed as admin.ServiceAccount;
    }
  } catch {
    // fallthrough
  }
  return undefined;
}

/** Decide projectId and bucket based on env. */
function resolveProjectAndBucket() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  const bucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : undefined);

  return { projectId, bucket };
}

/** Initialize the Admin SDK exactly once with robust credential fallbacks. */
function initAdmin(): admin.app.App {
  if (global.__FBA_APP__) {
    global.__FBA_INIT_INFO__ = { ...(global.__FBA_INIT_INFO__ || {}), mode: 'reused' };
    return global.__FBA_APP__;
  }

  const { projectId, bucket } = resolveProjectAndBucket();

  // 1) Preferred: whole service account JSON via env (GOOGLE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT)
  const saJson = readServiceAccountJsonFromEnv();
  if (saJson) {
    const app = admin.initializeApp({
      credential: admin.credential.cert(saJson),
      storageBucket: bucket,
      projectId: projectId || saJson.projectId,
    });
    global.__FBA_APP__ = app;
    global.__FBA_INIT_INFO__ = { mode: 'env-json', projectId: projectId || saJson.projectId, bucket, svc: saJson.client_email };
    afterInitTuning();
    return app;
  }

  // 2) Next best: split env vars (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY [+ FIREBASE_PROJECT_ID])
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || undefined;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (clientEmail && privateKey) {
    try {
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: bucket,
        projectId,
      });
      global.__FBA_APP__ = app;
      global.__FBA_INIT_INFO__ = { mode: 'env-cert', projectId, bucket, svc: clientEmail };
      afterInitTuning();
      return app;
    } catch (e) {
      // fall through to ADC
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
          '[firebaseAdmin] Failed to initialize with explicit env cert; falling back to ADC:',
          (e as Error)?.message
        );
      }
    }
  }

  // 3) Application Default Credentials (GCP runtimes / local "gcloud auth application-default login")
  try {
    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: bucket,
      projectId,
    });
    global.__FBA_APP__ = app;
    global.__FBA_INIT_INFO__ = { mode: 'adc', projectId, bucket, svc: 'applicationDefault()' };
    afterInitTuning();
    return app;
  } catch {
    // 4) Final fallback: no explicit creds (useful for local emulators where rules permit)
    const app = admin.initializeApp({
      storageBucket: bucket,
      projectId,
    });
    global.__FBA_APP__ = app;
    global.__FBA_INIT_INFO__ = { mode: 'no-cred', projectId, bucket, svc: 'none' };
    afterInitTuning();
    return app;
  }
}

/** Post-initialization tuning (safe to call multiple times). */
function afterInitTuning() {
  try {
    // Helpful default: avoid crashes when writing objects with undefined fields.
    admin.firestore().settings({ ignoreUndefinedProperties: true });

    // If using emulators locally, Admin SDK will auto-detect via env (e.g., FIRESTORE_EMULATOR_HOST).
    // Nothing else needed here; keeping for clarity.
  } catch {
    // ignore
  }

  // Dev diagnostics
  if (process.env.NODE_ENV !== 'production') {
    try {
      const info = global.__FBA_INIT_INFO__;
      const b = admin.storage().bucket();
      // eslint-disable-next-line no-console
      console.log(
        `[firebaseAdmin] mode=${info?.mode} project=${info?.projectId || '(unset)'} bucket=${b?.name || '(unset)'} svc=${info?.svc || 'unknown'}`
      );
    } catch {
      // ignore
    }
  }
}

// ---- Initialize once and export conveniences ----
const adminApp = initAdmin();
const adminDb = admin.firestore();
const adminAuth = admin.auth();
const adminStorage = admin.storage().bucket();

/** ✅ alias for files that import `adminBucket` */
const adminBucket = adminStorage;

/** ✅ convenience helpers for server timestamps */
const adminFieldValue = admin.firestore.FieldValue; // use: adminFieldValue.serverTimestamp()
const adminServerTimestamp = () => adminFieldValue.serverTimestamp();

export {
  adminApp,
  adminDb,
  adminAuth,
  adminStorage,
  adminBucket,
  admin,
  adminFieldValue,
  adminServerTimestamp,
};

export default admin;

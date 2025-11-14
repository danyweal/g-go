// lib/paypal.ts
const MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase(); // sandbox | live
export const PAYPAL_BASE = MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

export async function getAccessToken() {
  const cid = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const auth = Buffer.from(`${cid}:${secret}`).toString('base64');

  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PayPal OAuth failed: ${t}`);
  }
  const j = await r.json();
  return j.access_token as string;
}

// pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import type Stripe from 'stripe';
import stripe from '@/lib/stripe'; // your initialized Stripe instance

export const config = {
  api: {
    // REQUIRED: Stripe needs the raw body to verify the signature
    bodyParser: false,
  },
};

type WebhookResponse = { received: true } | { error: string };

// Read the raw request body as a UTF-8 string (no extra deps)
async function readRawBody(req: NextApiRequest): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Ensure we have the signing secret configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe] Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Read signature header
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // Read the raw body (string!)
  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('[stripe] Webhook signature verification failed:', err?.message || err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle events
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent succeeded: ${pi.id}`);
        // TODO: fulfill order / mark paid
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Checkout session completed: ${session.id}`);
        // TODO: capture metadata and fulfill
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`Charge refunded: ${charge.id}`);
        // TODO: handle refund
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[stripe] Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failure' });
  }
}

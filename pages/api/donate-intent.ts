// pages/api/donate-intent.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import stripe from '@/lib/stripe';

// ---- Input validation ----
const BodySchema = z.object({
  amount: z.number().positive().finite(),            // major units (e.g., 12.34 GBP -> 12.34)
  currency: z.string().min(3).max(10).default('GBP'),// ISO currency code
  email: z.string().email().optional(),
  metadata: z.record(z.string()).optional(),         // e.g., { causeId, donorId }
  // optional flags you might use on the client
  statementDescriptor: z.string().max(22).optional(), // bank statement (<=22 chars)
});

type Resp =
  | { clientSecret: string }
  | { error: string };

// Currencies with zero decimal places in Stripe
const ZERO_DECIMAL = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'
]);

function toMinorUnits(amountMajor: number, currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) {
    // e.g., JPY ¥100 -> 100
    return Math.round(amountMajor);
  }
  // Avoid floating errors: round to 2dp, multiply by 100
  return Math.round(Math.round(amountMajor * 100) + 0); // ensures integer
}

// Simple guard rails for donation amounts (adjust to your needs)
const MIN_MAJOR = 1;     // £1.00
const MAX_MAJOR = 10_000;// £10,000.00

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[donate-intent] Missing STRIPE_SECRET_KEY');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { amount, currency, email, metadata, statementDescriptor } = parsed.data;

    // Bounds check (major units)
    if (amount < MIN_MAJOR || amount > MAX_MAJOR) {
      return res.status(400).json({
        error: `Amount must be between ${MIN_MAJOR} and ${MAX_MAJOR} ${currency.toUpperCase()}`
      });
    }

    const amountInMinor = toMinorUnits(amount, currency);

    // Create PaymentIntent
    const intent = await stripe.paymentIntents.create({
      amount: amountInMinor,
      currency: currency.toLowerCase(),
      // Let Stripe figure out the best payment methods for this currency
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      metadata: {
        source: 'donation',
        ...(metadata ?? {}),
      },
      ...(statementDescriptor ? { statement_descriptor: statementDescriptor } : {}),
    });

    if (!intent.client_secret) {
      console.error('[donate-intent] No client_secret on PaymentIntent');
      return res.status(500).json({ error: 'Failed to create payment intent' });
    }

    return res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err: any) {
    // Stripe errors include type & code
    const msg = err?.message ?? 'Internal Server Error';
    console.error('[donate-intent] Error:', err);
    // If it's a StripeCardError, you might want to return 402; otherwise 500 is fine
    return res.status(500).json({ error: msg });
  }
}

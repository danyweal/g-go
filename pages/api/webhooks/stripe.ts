// pages/api/webhooks/stripe.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '@/lib/stripe';
import { buffer } from 'micro';
import { adminDb } from '@/lib/firebaseAdmin';

// Keep bodyParser off for Stripe signatures
export const config = { api: { bodyParser: false } };

/* ---------------- JOIN FLOW helpers (leave as-is) ---------------- */
async function upsertMemberByApp(applicationId: string, data: Record<string, any>) {
  const members = await adminDb
    .collection('members')
    .where('applicationId', '==', applicationId)
    .limit(1)
    .get();

  if (members.empty) {
    await adminDb.collection('members').add({
      applicationId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    });
  } else {
    await members.docs[0].ref.update({ updatedAt: new Date(), ...data });
  }
}

/* ---------------- DONATIONS helpers (NEW) ---------------- */

// Where your donation campaigns might live. The handler will try each.
const CANDIDATE_COLLECTIONS = ['donations', 'donationCampaigns', 'campaigns'];

/**
 * Find the campaign document by id across a set of candidate collections.
 * Returns { ref, snap, collection } or null if not found.
 */
async function findCampaignById(campaignId: string) {
  for (const col of CANDIDATE_COLLECTIONS) {
    const ref = adminDb.collection(col).doc(campaignId);
    const snap = await ref.get();
    if (snap.exists) return { ref, snap, collection: col };
  }
  return null;
}

/** Zero-decimal currencies (Stripe minor == major units) */
const ZERO_DECIMAL = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'
]);

function toMajor(minor: number, currency: string): number {
  const cur = (currency || '').toUpperCase();
  if (!minor || minor <= 0) return 0;
  return ZERO_DECIMAL.has(cur) ? minor : minor / 100;
}

/**
 * Idempotently record a donation and bump totals for a campaign.
 * - Creates/merges a donation payment doc keyed by paymentRef (PI id)
 * - Uses a transaction to prevent double increments
 */
async function recordDonationAndUpdateTotals(opts: {
  campaignId: string;
  paymentRef: string;            // Stripe PI id
  provider: string;
  status: string;
  amount: number;                // major units
  currency: string;
  donor?: { firstName?: string; lastName?: string } | null;
}) {
  const { campaignId, paymentRef, provider, status, amount, currency, donor } = opts;

  const campaign = await findCampaignById(campaignId);
  if (!campaign) {
    // If your admin uses a different collection, add it to CANDIDATE_COLLECTIONS
    throw new Error(`Donation campaign not found for id "${campaignId}"`);
  }

  const paymentRefDoc = adminDb.collection('donationPayments').doc(paymentRef);

  await adminDb.runTransaction(async (tx) => {
    const paySnap = await tx.get(paymentRefDoc);
    if (paySnap.exists) {
      // Already processed this PI — do nothing (idempotent)
      return;
    }

    const campSnap = await tx.get(campaign.ref);
    if (!campSnap.exists) {
      throw new Error(`Donation campaign not found for id "${campaignId}"`);
    }

    const data = campSnap.data() || {};
    const prevTotal = Number(data.totalDonated || 0);
    const prevDonors = Number(data.donorsCount || 0);
    const prevLast: Array<{ name: string; amount: number; at: number }> = Array.isArray(data.lastDonors)
      ? data.lastDonors
      : [];

    const donorName = `${(donor?.firstName || '').trim()} ${(donor?.lastName || '').trim()}`.trim() || 'Anonymous';
    const newEntry = { name: donorName, amount: Number(amount || 0), at: Date.now() };

    // Persist payment record first (so replays won't double-increment)
    tx.set(paymentRefDoc, {
      campaignId,
      provider,
      paymentRef,
      status,
      amount,
      currency: (currency || 'GBP').toUpperCase(),
      donor: {
        firstName: (donor?.firstName || '').trim() || null,
        lastName: (donor?.lastName || '').trim() || null,
        fullName: donorName,
      },
      createdAt: new Date(),
    });

    // Update campaign totals (no FieldValue to avoid import issues)
    const nextTotal = prevTotal + Number(amount || 0);
    const nextDonors = prevDonors + 1;
    const nextLast = prevLast.concat([newEntry]).slice(-20); // keep last 20 donors

    tx.update(campaign.ref, {
      totalDonated: nextTotal,
      donorsCount: nextDonors,
      lastDonors: nextLast,
      updatedAt: new Date(),
    });
  });
}

/* ---------------- Webhook handler ---------------- */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sig = req.headers['stripe-signature'] as string;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  let event: any;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch (err: any) {
    console.error('stripe webhook signature failed', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  try {
    switch (event.type) {
      /* ---------------- JOIN FLOW (keep your existing logic) ---------------- */
      case 'checkout.session.completed': {
        const session: any = event.data.object;
        const applicationId = session?.metadata?.applicationId as string | undefined;
        const customerId = session?.customer as string | undefined;
        const subscriptionId = (session?.subscription as string) || undefined;

        if (applicationId) {
          const appRef = adminDb.collection('joinApplications').doc(applicationId);
          await appRef.update({
            stripeCustomerId: customerId || null,
            stripeSubscriptionId: subscriptionId || null,
            status: 'approved',
            membershipPlan: subscriptionId ? 'monthly' : 'once',
            updatedAt: new Date(),
          });

          await upsertMemberByApp(applicationId, {
            stripeCustomerId: customerId || null,
            stripeSubscriptionId: subscriptionId || null,
            status: 'active',
          });
        }
        break;
      }

      case 'invoice.paid': {
        const inv: any = event.data.object;
        const customerId = inv.customer as string;
        const subscriptionId = (inv.subscription as string) || null;
        const amountPaidMinor = Number(inv.amount_paid || 0);
        const currency = (inv.currency || 'gbp').toUpperCase();
        const invoiceId = inv.id as string;

        // Find application by customerId (join flow)
        const appSnap = await adminDb
          .collection('joinApplications')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        const applicationId = appSnap.empty ? null : appSnap.docs[0].id;

        await adminDb.collection('payments').add({
          applicationId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeInvoiceId: invoiceId,
          amount: amountPaidMinor,
          currency,
          status: inv.status || 'paid',
          createdAt: new Date(),
          periodStart: inv?.lines?.data?.[0]?.period?.start ? new Date(inv.lines.data[0].period.start * 1000) : null,
          periodEnd: inv?.lines?.data?.[0]?.period?.end ? new Date(inv.lines.data[0].period.end * 1000) : null,
        });

        if (applicationId) {
          await upsertMemberByApp(applicationId, {
            status: 'active',
            lastPaymentAt: new Date(),
            currentPeriodEnd: inv?.lines?.data?.[0]?.period?.end ? new Date(inv.lines.data[0].period.end * 1000) : null,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv: any = event.data.object;
        const customerId = inv.customer as string;

        const appSnap = await adminDb
          .collection('joinApplications')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        const applicationId = appSnap.empty ? null : appSnap.docs[0].id;
        if (applicationId) {
          await upsertMemberByApp(applicationId, { status: 'past_due' });
        }
        break;
      }

      /* ---------------- DONATIONS FLOW (NEW) ----------------
         For PaymentElement one-time donations, the authoritative event is
         payment_intent.succeeded. We use the metadata.campaignId to locate
         the correct campaign document and update its totals. */
      case 'payment_intent.succeeded': {
        const pi: any = event.data.object;
        const md: Record<string, string> = (pi?.metadata || {}) as any;

        // Accept common keys for robustness
        const campaignId =
          md.campaignId ||
          md.campaign_id ||
          md.donationCampaignId ||
          md.donation_campaign_id;

        if (campaignId) {
          const minor = Number((pi.amount_received ?? pi.amount) || 0);
          const currency = (pi.currency || 'gbp').toUpperCase();
          const amount = toMajor(minor, currency);

          await recordDonationAndUpdateTotals({
            campaignId: String(campaignId),
            provider: 'stripe',
            paymentRef: String(pi.id),
            status: String(pi.status || 'succeeded'),
            amount,
            currency,
            donor: {
              firstName: (md.donorFirstName || '').trim(),
              lastName: (md.donorLastName || '').trim(),
            },
          });
        }

        break;
      }

      // (Optional) handle charge.succeeded as a fallback (some setups)
      case 'charge.succeeded': {
        const charge: any = event.data.object;
        const piId: string | undefined = charge.payment_intent as string | undefined;
        const md: Record<string, string> = (charge?.metadata || {}) as any;

        const campaignId =
          md.campaignId ||
          md.campaign_id ||
          md.donationCampaignId ||
          md.donation_campaign_id;

        if (campaignId && piId) {
          const minor = Number(charge.amount || 0);
          const currency = (charge.currency || 'gbp').toUpperCase();
          const amount = toMajor(minor, currency);

          await recordDonationAndUpdateTotals({
            campaignId: String(campaignId),
            provider: 'stripe',
            paymentRef: String(piId),
            status: String(charge.status || 'succeeded'),
            amount,
            currency,
            donor: {
              firstName: (md.donorFirstName || '').trim(),
              lastName: (md.donorLastName || '').trim(),
            },
          });
        }
        break;
      }

      default:
        // Ignore other events
        break;
    }

    return res.json({ received: true });
  } catch (e: any) {
    console.error('stripe webhook handler error', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Webhook handler error' });
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import getRawBody from 'raw-body';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const sig = req.headers['stripe-signature'] as string | undefined;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) return res.status(500).json({ ok: false, error: 'Missing STRIPE_WEBHOOK_SECRET' });

  let event;
  try {
    const raw = (await getRawBody(req)).toString('utf8');
    event = stripe.webhooks.constructEvent(raw, sig as string, whSecret);
  } catch (err: unknown) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as unknown;
        const applicationId = s.metadata?.applicationId as string | undefined;
        const customerId = s.customer as string | undefined;
        const subscriptionId = s.subscription as string | undefined;

        if (applicationId) {
          await adminDb.collection('joinApplications').doc(applicationId).update({
            stripeCustomerId: customerId ?? null,
            stripeSubscriptionId: subscriptionId ?? null,
            status: 'approved',
            updatedAt: FieldValue.serverTimestamp(),
          });

          const appSnap = await adminDb.collection('joinApplications').doc(applicationId).get();
          const app = appSnap.data()!;
          const members = await adminDb.collection('members').where('applicationId', '==', applicationId).limit(1).get();

          const payload = {
            applicationId,
            fullName: app.fullName,
            email: app.email,
            phone: app.phone ?? null,
            membershipPlan: app.membershipPlan,
            status: 'active',
            stripeCustomerId: customerId ?? null,
            stripeSubscriptionId: subscriptionId ?? null,
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          };

          if (members.empty) await adminDb.collection('members').add(payload);
          else await members.docs[0].ref.set(payload, { merge: true });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as unknown;
        const customerId = sub.customer as string;
        const subscriptionId = sub.id as string;
        const status = sub.status as string;
        const currentPeriodEnd = sub.current_period_end ? Timestamp.fromMillis(sub.current_period_end * 1000) : null;

        const apps = await adminDb.collection('joinApplications').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!apps.empty) {
          const appRef = apps.docs[0].ref;
          await appRef.update({ stripeSubscriptionId: subscriptionId, updatedAt: FieldValue.serverTimestamp() });

          const members = await adminDb.collection('members').where('applicationId', '==', appRef.id).limit(1).get();

          const statusMap: Record<string, 'active'|'inactive'|'past_due'|'canceled'> = {
            active: 'active', trialing: 'active', past_due: 'past_due',
            unpaid: 'past_due', canceled: 'canceled', paused: 'inactive',
            incomplete: 'inactive', incomplete_expired: 'inactive',
          };

          const payload = {
            stripeSubscriptionId: subscriptionId,
            status: statusMap[status] ?? 'inactive',
            currentPeriodEnd,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (members.empty) {
            const app = (await appRef.get()).data()!;
            await adminDb.collection('members').add({
              applicationId: appRef.id,
              fullName: app.fullName,
              email: app.email,
              phone: app.phone ?? null,
              membershipPlan: app.membershipPlan,
              stripeCustomerId: customerId,
              ...payload,
              createdAt: FieldValue.serverTimestamp(),
            });
          } else {
            await members.docs[0].ref.set(payload, { merge: true });
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as unknown;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string | undefined;
        const amountPaid = invoice.amount_paid as number;
        const currency = invoice.currency as string;
        const created = invoice.created as number;

        const apps = await adminDb.collection('joinApplications').where('stripeCustomerId', '==', customerId).limit(1).get();
        const applicationId = apps.empty ? undefined : apps.docs[0].id;

        const members = await adminDb.collection('members').where('stripeCustomerId', '==', customerId).limit(1).get();
        const memberId = members.empty ? undefined : members.docs[0].id;

        const period = invoice.lines?.data?.[0]?.period;
        const periodStart = period?.start ? Timestamp.fromMillis(period.start * 1000) : null;
        const periodEnd = period?.end ? Timestamp.fromMillis(period.end * 1000) : null;

        await adminDb.collection('payments').add({
          applicationId: applicationId ?? null,
          memberId: memberId ?? null,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId ?? null,
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: invoice.payment_intent ?? null,
          amount: amountPaid,
          currency,
          status: 'paid',
          createdAt: Timestamp.fromMillis(created * 1000),
          periodStart, periodEnd,
        });

        if (!members.empty) {
          await members.docs[0].ref.update({
            lastPaymentAt: Timestamp.fromMillis(created * 1000),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string | undefined;
        const created = invoice.created as number;

        const members = await adminDb.collection('members').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!members.empty) {
          await members.docs[0].ref.update({ status: 'past_due', updatedAt: FieldValue.serverTimestamp() });
        }

        await adminDb.collection('payments').add({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId ?? null,
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: invoice.payment_intent ?? null,
          amount: invoice.amount_due ?? 0,
          currency: invoice.currency ?? 'gbp',
          status: 'failed',
          createdAt: Timestamp.fromMillis(created * 1000),
          periodStart: null,
          periodEnd: null,
        });
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e: unknown) {
    console.error('Webhook handler error', e);
    return res.status(500).json({ ok: false, error: e?.message ?? 'Webhook error' });
  }
}

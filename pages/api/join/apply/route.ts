import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; // reuse your existing admin initializer
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

export const runtime = 'nodejs';

const Schema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().transform(v => v.toLowerCase()),
  phone: z.string().max(30).optional().or(z.literal('')),
  message: z.string().max(5000).optional().or(z.literal('')),
  // 'none' | 'once' | 'monthly'  (monthly triggers subscription)
  membershipPlan: z.enum(['none', 'once', 'monthly']).default('none'),
  consentToContact: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = Schema.parse(body);

    const now = FieldValue.serverTimestamp();
    const doc = {
      ...data,
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
      // Stripe linkage fields reserved
      stripeCustomerId: null,
      stripeCheckoutSessionId: null,
      stripeSubscriptionId: null,
    };

    const ref = await adminDb.collection('joinApplications').add(doc);

    // If monthly plan, client will call create-checkout-session with this applicationId
    return NextResponse.json({ ok: true, applicationId: ref.id, membershipPlan: data.membershipPlan }, { status: 201 });
  } catch (e: unknown) {
    console.error('join/apply error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Failed' }, { status: 400 });
  }
}

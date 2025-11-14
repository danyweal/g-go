'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

type SuccessPayload = {
  paymentIntentId: string;
  amountPaid: number; // major units
  currency: string;
  status: string;
};

type Props = {
  campaignId: string;           // donations campaign id from Admin
  campaignSlug?: string;
  defaultAmount?: number;
  currency?: 'GBP' | 'USD' | 'EUR' | (string & {});
  donorFirstName: string;
  donorLastName: string;
  onSuccess?: ((paymentIntentId: string) => void) | ((payload: SuccessPayload) => void);
};

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = pk ? loadStripe(pk) : null;

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const ZERO_DECIMAL = new Set([
  'BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'
]);
function minorToMajor(minor: number | null | undefined, currency: string) {
  const cur = (currency || '').toUpperCase();
  if (!minor || minor <= 0) return 0;
  return ZERO_DECIMAL.has(cur) ? minor : minor / 100;
}

/* -------------------- Inner (confirm + callbacks) -------------------- */
function OneTimeInner({
  clientSecret,
  amount,
  currency,
  donorFirstName,
  donorLastName,
  campaignId,
  onSuccess,
}: {
  clientSecret: string;
  amount: number;
  currency: string;
  donorFirstName: string;
  donorLastName: string;
  campaignId: string;
  onSuccess?: Props['onSuccess'];
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fullName = `${donorFirstName}`.trim() + (donorLastName.trim() ? ` ${donorLastName.trim()}` : '');
  const validName = donorFirstName.trim().length > 0 && donorLastName.trim().length > 0;

  const invokeOnSuccess = (payload: SuccessPayload) => {
    if (!onSuccess) return;
    try {
      // Support either signature
      // @ts-ignore
      onSuccess(payload);
      // Old signature fallback:
      // @ts-ignore
      if (onSuccess?.toString?.().includes('(paymentIntentId')) onSuccess(payload.paymentIntentId);
    } catch {}
  };

  const pay = async () => {
    if (!stripe || !elements) return;
    if (!validName) {
      setMsg('Please enter your first and last name.');
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      // Confirm on client (no redirect unless required)
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: undefined },
        redirect: 'if_required',
      });
      if (error) throw new Error(error.message || 'Stripe error');
      if (!paymentIntent) throw new Error('No payment intent returned');

      const amountPaid = minorToMajor(
        (paymentIntent as any).amount_received ?? (paymentIntent as any).amount,
        currency
      );

      // ✅ IMPORTANT: call the **public** confirmation route (server verifies with secret + updates aggregates)
      const resp = await fetch('/api/donations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          campaignId, // fallback if PI metadata ever misses it
        }),
      });

      let serverMsg = '';
      try {
        const j = await resp.json();
        if (!resp.ok || j?.ok === false) serverMsg = j?.error || 'Server failed to confirm donation';
      } catch {
        if (!resp.ok) serverMsg = `Server error (${resp.status})`;
      }
      if (serverMsg) throw new Error(serverMsg);

      if (paymentIntent.status === 'succeeded') {
        setMsg('تم الدفع بنجاح. شكرًا لدعمك ♥');
        invokeOnSuccess({ paymentIntentId: paymentIntent.id, amountPaid, currency, status: paymentIntent.status });
      } else if (paymentIntent.status === 'processing' || paymentIntent.status === 'requires_capture') {
        setMsg('تم استلام الدفع ويجري معالجته…');
        invokeOnSuccess({ paymentIntentId: paymentIntent.id, amountPaid, currency, status: paymentIntent.status });
      } else {
        setMsg(`حالة الدفع: ${paymentIntent.status}`);
      }
    } catch (e: any) {
      setMsg(e?.message || 'حدث خطأ أثناء الدفع');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <PaymentElement />
      <button
        onClick={pay}
        disabled={busy || !validName}
        className={cx(
          'w-full rounded-full bg-neutral-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-black',
          (busy || !validName) && 'opacity-60 cursor-not-allowed'
        )}
      >
        {busy ? 'Processing…' : `Pay ${currency} ${amount.toFixed(2)}`}
      </button>
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
      {!validName && <div className="text-xs text-red-600">الاسم والكنية مطلوبان قبل الدفع.</div>}
    </div>
  );
}

/* -------------------- Public widget -------------------- */
export default function DonationPaymentWidget({
  campaignId,
  campaignSlug,
  defaultAmount = 25,
  currency = 'GBP',
  donorFirstName,
  donorLastName,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState<number>(Math.max(1, Number(defaultAmount) || 25));
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const hasStripe = !!pk && !!stripePromise;

  const options: StripeElementsOptions | undefined = useMemo(
    () =>
      clientSecret
        ? { clientSecret, appearance: { theme: 'stripe' }, locale: 'en' }
        : undefined,
    [clientSecret]
  );

  useEffect(() => {
    setClientSecret(null);
    setSdkError(null);
    if (!hasStripe || amount <= 0) return;

    (async () => {
      try {
        // Keep donation metadata so server can derive campaign + donor info idempotently
        const meta = {
          type: 'donation',
          campaignId,                 // **correct id for campaigns**
          campaignSlug: campaignSlug || '',
          donorFirstName: donorFirstName.trim(),
          donorLastName: donorLastName.trim(),
          // common aliases to be extra safe:
          campaign_id: campaignId,
          donationCampaignId: campaignId,
          donation_campaign_id: campaignId,
          slug: campaignSlug || '',
        };

        const r = await fetch('/api/payments/stripe/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, currency, metadata: meta }),
        });
        const j = await r.json();
        if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Failed to create intent');
        setClientSecret(j.clientSecret);
      } catch (e: any) {
        setSdkError(e?.message || 'Stripe init failed');
      }
    })();
  }, [amount, currency, campaignId, campaignSlug, donorFirstName, donorLastName, hasStripe]);

  return (
    <div className="grid gap-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Amount ({String(currency)})</label>
        <input
          type="number"
          min={1}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value || 0)))}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2"
        />
      </div>

      {!hasStripe && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          أضف <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> لظهور Stripe.
        </div>
      )}
      {sdkError && <div className="text-sm text-red-700">{sdkError}</div>}

      {hasStripe && clientSecret && stripePromise && options ? (
        <Elements stripe={stripePromise} options={options}>
          <OneTimeInner
            clientSecret={clientSecret}
            amount={amount}
            currency={String(currency)}
            donorFirstName={donorFirstName}
            donorLastName={donorLastName}
            campaignId={campaignId}
            onSuccess={onSuccess}
          />
        </Elements>
      ) : null}
    </div>
  );
}

// components/payments/PaymentWidget.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

type Mode = 'one_time' | 'subscription';

type Props = {
  applicationId?: string;          // optional — if missing, we create after successful payment (server side)
  formSnapshot?: unknown;          // required if applicationId is not provided
  defaultAmount?: number;          // prefill amount (e.g., 11.99 | 21.99 | 49.99)
  currency?: 'GBP' | 'USD' | 'EUR';
  onApplicationCreated?: (id: string) => void;
};

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = pk ? loadStripe(pk) : null;

function classNames(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

/** ---------- Stripe One-time (PaymentElement) ---------- */
function StripeOneTimeInner({
  clientSecret,
  amount,
  currency,
  applicationId,
  formSnapshot,
  onApplicationCreated,
}: {
  clientSecret: string;
  amount: number;
  currency: string;
  applicationId?: string;
  formSnapshot?: unknown;
  onApplicationCreated?: (id: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setMsg(null);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: undefined }, // stay on page
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || 'Stripe error');
      if (!paymentIntent) throw new Error('No payment intent');

      if (paymentIntent.status === 'succeeded') {
        // Create/link application if needed
        let appId = applicationId;
        if (!appId) {
          const r = await fetch('/api/join/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(formSnapshot || {}),
              paymentRequired: false,
              status: 'submitted',
            }),
          });
          const j = await r.json();
          if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Failed to create application');
          appId = j.id;
        }

        // Attach payment to application
        await fetch('/api/payments/attach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'stripe',
            ref: paymentIntent.id,
            applicationId: appId,
            status: 'succeeded',
            amount,
            currency,
          }),
        });

        setMsg(`تم الدفع بنجاح. رقم الطلب: ${appId}`);
        onApplicationCreated?.(appId!);
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
        disabled={busy}
        className="w-full rounded-full bg-neutral-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-black disabled:opacity-60"
      >
        {busy ? 'Processing…' : `Pay ${currency} ${amount.toFixed(2)}`}
      </button>
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </div>
  );
}

/** ---------- Wrapper (Stripe only: One-time + Subscription) ---------- */
export default function PaymentWidget({
  applicationId,
  formSnapshot,
  defaultAmount = 11.99, // sensible default to one of your plans
  currency = 'GBP',
  onApplicationCreated,
}: Props) {
  const [mode, setMode] = useState<Mode>('one_time');
  const [amount, setAmount] = useState<number>(Math.max(0, defaultAmount));
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const hasStripe = !!pk && !!stripePromise;

  // Elements options for one-time
  const options: StripeElementsOptions | undefined = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: { theme: 'stripe' },
            locale: 'en',
          }
        : undefined,
    [clientSecret]
  );

  // Init PaymentIntent only for one-time mode
  useEffect(() => {
    setClientSecret(null);
    setSdkError(null);
    if (!hasStripe) return;
    if (mode !== 'one_time') return;
    if (amount <= 0) return;

    (async () => {
      try {
        const r = await fetch('/api/payments/stripe/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId: applicationId || undefined,
            amount,
            currency,
            preApplication: applicationId ? undefined : (formSnapshot || null),
          }),
        });
        const j = await r.json();
        if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Failed to create intent');
        setClientSecret(j.clientSecret);
      } catch (e: any) {
        setSdkError(e?.message || 'Stripe init failed');
      }
    })();
  }, [mode, amount, currency, applicationId, hasStripe, formSnapshot]);

  // Start Stripe subscription (robust redirect handling)
  const startStripeSubscription = async () => {
    try {
      const r = await fetch('/api/payments/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: applicationId || undefined,
          amount,
          currency,
          mode: 'subscription',
          formSnapshot: applicationId ? undefined : (formSnapshot || null),
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.error || 'Stripe checkout error');

      // Prefer hosted url if provided
      const hostedUrl: unknown =
        (typeof j?.url === 'string' && j.url) ||
        (typeof j?.session?.url === 'string' && j.session.url);
      if (typeof hostedUrl === 'string' && hostedUrl.length > 0) {
        window.location.assign(hostedUrl);
        return;
      }

      // Fallback to sessionId via redirectToCheckout
      const sessionId: unknown =
        (typeof j?.sessionId === 'string' && j.sessionId) ||
        (typeof j?.id === 'string' && j.id) ||
        (typeof j?.session?.id === 'string' && j.session.id);

      if (typeof sessionId === 'string' && sessionId.length > 0) {
        if (!stripePromise) throw new Error('Stripe publishable key missing on client.');
        const stripe = await stripePromise;
        if (!stripe) throw new Error('Stripe.js failed to initialize.');
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) throw new Error(error.message || 'Stripe redirect failed');
        return;
      }

      throw new Error('Server did not return a Checkout URL or sessionId.');
    } catch (e: any) {
      alert(e?.message || 'Subscription error');
    }
  };

  return (
    <div className="grid gap-5">
      {/* Mode chooser */}
      <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-1 w-fit">
        <button
          className={classNames(
            'px-4 py-1.5 rounded-full text-sm font-semibold',
            mode === 'one_time' ? 'bg-white shadow ring-1 ring-black/5' : 'text-neutral-600'
          )}
          onClick={() => setMode('one_time')}
          type="button"
        >
          دفع مرة واحدة
        </button>
        <button
          className={classNames(
            'px-4 py-1.5 rounded-full text-sm font-semibold',
            mode === 'subscription' ? 'bg-white shadow ring-1 ring-black/5' : 'text-neutral-600'
          )}
          onClick={() => setMode('subscription')}
          type="button"
        >
          اشتراك شهري
        </button>
      </div>

      {/* ONE-TIME (Stripe Elements) */}
      {mode === 'one_time' && (
        <div className="rounded-2xl border p-4">
          <div className="font-semibold mb-2">Stripe (Card)</div>
          {!hasStripe && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              أضف <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> لظهور Stripe.
            </div>
          )}

          {/* optional quick amount adjuster (keeps your previous UX flexible) */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Amount (GBP)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            />
          </div>

          {hasStripe && clientSecret && stripePromise && options ? (
            <Elements stripe={stripePromise} options={options}>
              <StripeOneTimeInner
                clientSecret={clientSecret}
                amount={amount}
                currency={currency}
                applicationId={applicationId}
                formSnapshot={formSnapshot}
                onApplicationCreated={onApplicationCreated}
              />
            </Elements>
          ) : null}

          {sdkError && <div className="text-sm text-red-700 mt-2">{sdkError}</div>}
        </div>
      )}

      {/* SUBSCRIPTION (Stripe Checkout) */}
      {mode === 'subscription' && (
        <div className="rounded-2xl border p-4">
          <div className="font-semibold mb-2">Stripe (Subscription)</div>

          {/* plan selector (optional, works with your amounts: 11.99 / 21.99 / 49.99) */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[11.99, 21.99, 49.99].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className={classNames(
                  'rounded-xl border px-3 py-2 text-sm',
                  amount === v ? 'bg-neutral-900 text-white border-neutral-900' : 'hover:bg-neutral-50'
                )}
              >
                £{v.toFixed(2)} / Month
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-3 mb-3">
            <div className="text-sm">الخطة المختارة</div>
            <div className="text-sm font-semibold">£{amount.toFixed(2)} / شهريًا</div>
          </div>

          <button
            onClick={startStripeSubscription}
            className="w-full rounded-full bg-neutral-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-black"
            type="button"
          >
            Subscribe with Stripe
          </button>
        </div>
      )}
    </div>
  );
}

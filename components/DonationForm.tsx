'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Button from './Button';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

const presetAmounts = [10, 25, 50, 100];

// Removed unused type InnerFormProps

function InnerDonationForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState<number>(25);
  const [custom, setCustom] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'succeeded' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Create PaymentIntent when amount changes
  useEffect(() => {
    const resolvedAmount = custom ? parseFloat(custom) : amount;
    if (isNaN(resolvedAmount) || resolvedAmount <= 0) return;

    async function createIntent() {
      setStatus('processing');
      setError(null);
      try {
        const res = await fetch('/api/donate-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: resolvedAmount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create intent');
        setClientSecret(data.clientSecret);
        setStatus('idle');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error creating donation intent';
        setError(message);
        setStatus('error');
      }
    }

    createIntent();
  }, [amount, custom]);

  const handlePreset = (v: number) => {
    setCustom('');
    setAmount(v);
  };

  const handleCustomChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCustom(e.target.value);
    setAmount(0);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!clientSecret) {
      setError('Unable to initialize payment. Try again.');
      return;
    }
    setStatus('processing');
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed.');
      setStatus('error');
      return;
    }
    if (paymentIntent?.status === 'succeeded') {
      setStatus('succeeded');
    } else {
      setStatus('idle');
    }
  };

  const displayAmount = custom ? parseFloat(custom) : amount;
  const isValidAmount = !isNaN(displayAmount) && displayAmount >= 1;

  return (
    <div className="max-w-xl mx-auto bg-white shadow-card rounded-xl p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Support the Community</h2>
          <p className="text-sm text-palestine-muted mt-1">
            Your donation helps fund events, youth programs, and community support.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {presetAmounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => handlePreset(a)}
              className={`px-4 py-2 rounded-lg font-medium transition shadow-sm border ${
                !custom && amount === a
                  ? 'bg-palestine-green text-white border-transparent'
                  : 'bg-transparent text-palestine-dark border-palestine-green/30 hover:bg-palestine-green/5'
              }`}
              aria-label={`Donate £${a}`}
            >
              £{a}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label htmlFor="custom-amount" className="font-medium">
              Custom Amount (£)
            </label>
            <input
              id="custom-amount"
              type="number"
              min={1}
              step={0.5}
              placeholder="e.g., 30"
              value={custom}
              onChange={handleCustomChange}
              className="mt-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-palestine-green transition"
              aria-label="Custom donation amount in pounds"
            />
          </div>
          <div className="flex flex-col">
            <label className="font-medium">Total</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-2xl font-bold">
                £{isValidAmount ? displayAmount.toFixed(2) : '0.00'}
              </div>
              <div className="text-sm text-palestine-muted">One-time donation</div>
            </div>
          </div>
        </div>

        {!isValidAmount && (
          <div className="text-sm text-red-600">Please enter a valid amount (at least £1).</div>
        )}

        {error && (
          <div className="text-sm text-red-600 font-medium">{error}</div>
        )}

        {clientSecret && isValidAmount && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="mb-3 font-medium">Payment Details</div>
            <div className="p-3 bg-white rounded-md shadow-inner">
              <PaymentElement />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-palestine-muted">
            Secure payment powered by Stripe. You can cancel anytime.
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={
              !stripe ||
              !elements ||
              status === 'processing' ||
              !isValidAmount ||
              !clientSecret
            }
            className="flex-1 sm:flex-none"
          >
            {status === 'processing'
              ? 'Processing...'
              : status === 'succeeded'
              ? 'Thank you!'
              : `Donate £${isValidAmount ? displayAmount.toFixed(2) : '0.00'}`}
          </Button>
        </div>

        {status === 'succeeded' && (
          <div className="mt-2 text-green-600 font-medium">
            Donation successful. Thank you for your support!
          </div>
        )}
      </form>
    </div>
  );
}

export default function DonationFormWrapper() {
  const [options, setOptions] = useState<{ clientSecret: string } | null>(null);

  useEffect(() => {
    setOptions({ clientSecret: '' });
  }, []);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="p-6 bg-yellow-100 rounded-lg">
        <p className="text-sm">
          Stripe publishable key is missing. Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in your
          environment.
        </p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options!}>
      <InnerDonationForm />
    </Elements>
  );
}

// pages/join/subscribe.tsx
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

export default function SubscribeStatus() {
  const router = useRouter();
  const { query, isReady } = router;

  // Accept multiple param names just in case
  const statusParam = (typeof query.status === 'string' ? query.status : '') || '';
  const sessionIdParam =
    (typeof query.session_id === 'string' ? query.session_id : '') ||
    (typeof query.sessionId === 'string' ? query.sessionId : '') ||
    (typeof query.sid === 'string' ? query.sid : '');

  const [done, setDone] = React.useState(false);
  const [appId, setAppId] = React.useState<string>('');
  const [err, setErr] = React.useState<string>('');

  React.useEffect(() => {
    if (!isReady) return;

    const finalize = async () => {
      // If we don’t even have a session id, there’s nothing to finalize.
      if (!sessionIdParam) {
        setDone(true);
        return;
      }

      try {
        // Even if no `status` is supplied, finalize on the server —
        // the server can inspect the session/payment status directly.
        const r = await fetch(
          `/api/payments/stripe/finalize-checkout?session_id=${encodeURIComponent(sessionIdParam)}`
        );
        const j = await r.json();
        if (!r.ok || j?.ok === false) {
          throw new Error(j?.error || 'Finalize error');
        }
        setAppId(j.applicationId || '');
      } catch (e: any) {
        setErr(e?.message || 'Finalize failed');
      } finally {
        setDone(true);
      }
    };

    finalize();
  }, [isReady, sessionIdParam]);

  // Friendly heading (don’t rely solely on status; fall back to generic)
  const title =
    statusParam === 'success'
      ? 'تم الدفع بنجاح'
      : statusParam === 'canceled'
      ? 'تم إلغاء العملية'
      : appId
      ? 'تم الدفع بنجاح'
      : err
      ? 'حدث خطأ'
      : 'حالة الدفع';

  const toneClasses =
    (statusParam === 'success' || (!!appId && !err))
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : statusParam === 'canceled'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : err
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-neutral-200 bg-neutral-50 text-neutral-800';

  return (
    <>
      <Head><title>Payment Status</title></Head>
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className={`rounded-2xl border p-5 ${toneClasses}`}>
          <h1 className="text-2xl font-bold mb-1">{title}</h1>

          {!isReady ? (
            <p className="text-sm">جارٍ التحميل…</p>
          ) : done ? (
            <>
              {sessionIdParam && (
                <p className="text-xs text-neutral-500 mb-1">
                  Session: <span className="font-mono">{sessionIdParam}</span>
                </p>
              )}

              {appId ? (
                <p className="text-sm">
                  تم إنشاء/ربط طلب العضوية بنجاح. رقم الطلب:
                  {' '}<span className="font-mono">{appId}</span>
                </p>
              ) : err ? (
                <p className="text-sm">
                  {err}
                </p>
              ) : statusParam === 'canceled' ? (
                <p className="text-sm">لقد ألغيت عملية الدفع. يمكنك المحاولة مرة أخرى.</p>
              ) : (
                <p className="text-sm">تم التحقق من الجلسة.</p>
              )}
            </>
          ) : (
            <p className="text-sm">جارٍ التحقق…</p>
          )}

          <div className="mt-4 flex gap-3">
            <Link
              href="/join"
              className="rounded-full bg-neutral-900 text-white px-5 py-2 text-sm font-semibold hover:bg-black"
            >
              العودة إلى الانضمام
            </Link>
            <Link
              href="/"
              className="rounded-full ring-1 ring-current px-5 py-2 text-sm font-semibold"
            >
              الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

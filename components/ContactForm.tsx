// components/ContactForm.tsx

import React, {
  useState,
  useEffect,
  ChangeEvent,
  FormEvent,
  useId,
} from 'react';
import Button from './Button';

type FormState = {
  name: string;
  email: string;
  message: string;
  honeypot: string;
};

const isValidEmail = (email: string) =>
  /^\S+@\S+\.\S+$/.test(email.trim());

export default function ContactForm() {
  const id = useId();
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    message: '',
    honeypot: '',
  });
  const [status, setStatus] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<string>('');

  useEffect(() => {
    if (status === 'success') {
      setAnnounce('Message sent successfully.');
      const t = setTimeout(() => setStatus('idle'), 4000);
      return () => clearTimeout(t);
    }
    if (status === 'error' && error) {
      setAnnounce(`Error: ${error}`);
    }
  }, [status, error]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const resetForm = () =>
    setForm({ name: '', email: '', message: '', honeypot: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'sending') return;

    if (form.honeypot.trim() !== '') {
      setError('Bot detected.');
      setStatus('error');
      return;
    }
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('All fields are required.');
      setStatus('error');
      return;
    }
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Submission failed.');
      }
      setStatus('success');
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announce}
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-xl shadow-card p-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="text-2xl">✉️</div>
          <h2 className="text-xl font-bold">Contact Us</h2>
        </div>
        <p className="text-sm text-palestine-muted">
          Have a question or message? Fill out the form below and we&apos;ll get back to you
          soon.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="flex flex-col">
            <label htmlFor={`${id}-name`} className="font-medium">
              Name
            </label>
            <input
              id={`${id}-name`}
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
              className="mt-1 border border-gray-200 rounded-lg px-4 py-3 focus:border-palestine-green focus:ring-2 focus:ring-palestine-green/40 transition"
              aria-invalid={status === 'error' && !form.name.trim()}
            />
          </div>
          {/* Email */}
          <div className="flex flex-col">
            <label htmlFor={`${id}-email`} className="font-medium">
              Email
            </label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="mt-1 border border-gray-200 rounded-lg px-4 py-3 focus:border-palestine-green focus:ring-2 focus:ring-palestine-green/40 transition"
              aria-invalid={status === 'error' && !isValidEmail(form.email)}
            />
          </div>
        </div>

        {/* Message */}
        <div className="flex flex-col">
          <label htmlFor={`${id}-message`} className="font-medium">
            Message
          </label>
          <textarea
            id={`${id}-message`}
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={4}
            required
            placeholder="Write your message..."
            className="mt-1 border border-gray-200 rounded-lg px-4 py-3 resize-none focus:border-palestine-green focus:ring-2 focus:ring-palestine-green/40 transition"
            aria-invalid={status === 'error' && !form.message.trim()}
          />
        </div>

        {/* Honeypot */}
        <div style={{ display: 'none' }} aria-hidden="true">
          <label htmlFor={`${id}-hp`}>Leave this field empty</label>
          <input
            id={`${id}-hp`}
            name="honeypot"
            value={form.honeypot}
            onChange={handleChange}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Feedback */}
        {status === 'error' && error && (
          <div className="text-sm text-red-600 flex items-center gap-2">
            {error}
          </div>
        )}
        {status === 'success' && (
          <div className="text-sm text-green-600 flex items-center gap-2">
            Thank you! Your message has been sent.
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="text-xs text-palestine-muted">
            We&apos;ll never share your info. No login required.
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={status === 'sending' || status === 'success'}
            className="flex-1 sm:flex-none"
          >
            {status === 'sending' ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// pages/api/join.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import sendgrid from '@sendgrid/mail';

sendgrid.setApiKey(process.env.SENDGRID_API_KEY!);

const TO_EMAIL = process.env.TO_EMAIL!;
const FROM_EMAIL = process.env.FROM_EMAIL!;

const ipSubmissions: Record<string, { count: number; firstTimestamp: number }> = {};
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

type JoinRequest = {
  name: string;
  email: string;
  interests?: string;
  howHeard?: string;
  message?: string;
};

type JoinResponse = { success: true } | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<JoinResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

  // Rate limiting by IP
  const now = Date.now();
  const entry = ipSubmissions[ip] || { count: 0, firstTimestamp: now };
  if (now - entry.firstTimestamp > WINDOW_MS) {
    ipSubmissions[ip] = { count: 1, firstTimestamp: now };
  } else {
    entry.count += 1;
    ipSubmissions[ip] = entry;
    if (entry.count > MAX_PER_WINDOW) {
      return res.status(429).json({ error: 'Too many requests; please try again later.' });
    }
  }

  const { name, email, interests, howHeard, message } = req.body as JoinRequest;

  if (!name || typeof name !== 'string' || !email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Name and valid email are required.' });
  }

  const subject = `New community join request from ${name}`;
  const plain = `Name: ${name}
Email: ${email}
Interests: ${interests || '(none)'}
Heard about us via: ${howHeard || '(not specified)'}
Message: ${message || '(none)'}
IP: ${ip}`;

  try {
    await sendgrid.send({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject,
      text: plain,
      html: `<h2>New Join Request</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Interests:</strong> ${interests || '(none provided)'}</p>
<p><strong>Heard about us via:</strong> ${howHeard || '(not specified)'}</p>
<p><strong>Message:</strong> ${message || '(none)'}</p>
<p><small>IP: ${ip}</small></p>`,
    });
    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('SendGrid error:', msg);
    return res.status(500).json({ error: 'Failed to send email.' });
  }
}

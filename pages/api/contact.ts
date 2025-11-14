import type { NextApiRequest, NextApiResponse } from 'next';
import sendgrid from '@sendgrid/mail';

sendgrid.setApiKey(process.env.SENDGRID_API_KEY!);
const TO_EMAIL = process.env.TO_EMAIL!;
const FROM_EMAIL = process.env.FROM_EMAIL!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });
  const { name, email, message, honeypot } = req.body;
  if (honeypot) return res.status(400).json({ error: 'Bot' });
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });
  try {
    await sendgrid.send({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject: `Contact form: ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Send failed' });
  }
}

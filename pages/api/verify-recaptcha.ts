import type { NextApiRequest, NextApiResponse } from 'next';
import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

type VerifyResponse = {
  success: boolean;
  score?: number;
  errorCodes?: string[];
};

// Google Cloud Project ID and Site Key (should be set in env vars)
const PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const SITE_KEY = process.env.RECAPTCHA_ENTERPRISE_SITE_KEY || '';

// Initialize the reCAPTCHA Enterprise client once
const recaptchaClient = new RecaptchaEnterpriseServiceClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerifyResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res
      .status(405)
      .json({ success: false, errorCodes: ['method-not-allowed'] });
  }

  const { token, action } = req.body as { token?: string; action?: string };
  if (!token) {
    return res
      .status(400)
      .json({ success: false, errorCodes: ['missing-input'] });
  }

  if (!PROJECT_ID || !SITE_KEY) {
    console.error(
      'Missing GCP_PROJECT_ID or RECAPTCHA_ENTERPRISE_SITE_KEY in environment'
    );
    return res.status(500).json({ success: false });
  }

  try {
    // Build the event payload
    const event: { token: string; siteKey: string; expectedAction?: string } = {
      token,
      siteKey: SITE_KEY,
    };
    if (action) {
      event.expectedAction = action;
    }

    // Build and send the assessment
    const [assessment] = await recaptchaClient.createAssessment({
      parent: recaptchaClient.projectPath(PROJECT_ID),
      assessment: { event },
    });

    const { tokenProperties, riskAnalysis } = assessment;

    // Token validity check
    if (!tokenProperties?.valid) {
      const reason = tokenProperties?.invalidReason || 'invalid-token';
      console.error('reCAPTCHA Enterprise invalid token:', reason);
      return res
        .status(200)
        .json({ success: false, errorCodes: [reason] });
    }

    // If action was provided, check for mismatch
    if (action && tokenProperties.action !== action) {
      console.error(
        'reCAPTCHA Enterprise action mismatch:',
        tokenProperties.action
      );
      return res
        .status(200)
        .json({ success: false, errorCodes: ['action-mismatch'] });
    }

    // Success: return the risk score
    const score = riskAnalysis?.score ?? 0;
    return res.status(200).json({ success: true, score });
  } catch (err) {
    console.error('Error verifying reCAPTCHA Enterprise:', err);
    return res.status(500).json({ success: false });
  }
}

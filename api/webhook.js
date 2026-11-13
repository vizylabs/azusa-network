/**
 * Vercel Serverless Function: /api/webhook
 * Receives form submissions ("Notify Me at Launch", "Contact Us", "Membership Checkout")
 * and forwards them as JSON to the configured WEBHOOK_URL with source = WEBHOOK_SOURCE.
 */

const DEFAULT_WEBHOOK_URL = 'https://move.vizylabs.com/webhook/506ffde9-4381-4fae-8377-375f71b9d0d6';
const DEFAULT_WEBHOOK_SOURCE = 'azusanetwork.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { webhookUrl: clientWebhookUrl, ...cleanBody } = body;

    const source = process.env.WEBHOOK_SOURCE || DEFAULT_WEBHOOK_SOURCE;
    const webhookUrl =
      process.env.WEBHOOK_URL ||
      process.env.AZUSA_WEBHOOK_URL ||
      clientWebhookUrl ||
      DEFAULT_WEBHOOK_URL;

    const payload = {
      ...cleanBody,
      source,
      submittedAt: cleanBody.submittedAt || new Date().toISOString(),
    };

    let forwarded = false;
    let webhookStatus = null;

    if (webhookUrl && /^https?:\/\//i.test(webhookUrl)) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AzusaNetwork-Webhook/1.0',
        },
        body: JSON.stringify(payload),
      });
      webhookStatus = response.status;
      forwarded = response.ok;
    }

    return res.status(200).json({
      ok: true,
      forwarded,
      webhookConfigured: Boolean(webhookUrl),
      webhookStatus,
      received: payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : 'Webhook forwarding error',
    });
  }
};

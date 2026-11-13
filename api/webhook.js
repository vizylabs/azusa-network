/**
 * Vercel Serverless Function: /api/webhook
 * Receives form submissions ("Notify Me at Launch", "Contact Us", "Membership Checkout")
 * and forwards them as JSON to the configured WEBHOOK_URL.
 */

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
    const payload = {
      source: 'azusanetwork.com',
      submittedAt: new Date().toISOString(),
      ...body,
    };

    // Configure via Vercel Environment Variable WEBHOOK_URL (or customWebhookUrl in payload for testing)
    const webhookUrl = process.env.WEBHOOK_URL || process.env.AZUSA_WEBHOOK_URL || body.webhookUrl || '';

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

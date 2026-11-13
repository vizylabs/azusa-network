/**
 * Vercel Serverless Function: /api/webhook
 * Forwards form submissions ("Notify Me at Launch", "Contact Us", "Membership Checkout")
 * to https://move.vizylabs.com/webhook/506ffde9-4381-4fae-8377-375f71b9d0d6
 * with the exact VizyLabs n8n webhook body structure and "source": "azusanetwork.com".
 */

const DEFAULT_WEBHOOK_URL = 'https://move.vizylabs.com/webhook/506ffde9-4381-4fae-8377-375f71b9d0d6';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const raw = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const webhookUrl = process.env.WEBHOOK_URL || raw.webhookUrl || DEFAULT_WEBHOOK_URL;

    // Normalize body to the exact n8n webhook schema expected by move.vizylabs.com
    const payload = {
      name: raw.name || 'Launch Notification Subscriber',
      company: raw.company || raw.ministry || 'Azusa Network',
      email: raw.email || '',
      projectType: raw.projectType || raw.topic || raw.event || 'website-inquiry',
      message:
        raw.message ||
        (raw.event === 'launch_notify'
          ? 'Requested launch notification on azusanetwork.com Coming Soon page.'
          : 'Submitted via azusanetwork.com'),
      submittedAt: raw.submittedAt || new Date().toISOString(),
      source: 'azusanetwork.com',
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return res.status(200).json({
      ok: true,
      forwarded: response.ok,
      webhookStatus: response.status,
      body: payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : 'Webhook forwarding error',
    });
  }
};

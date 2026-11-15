/**
 * Vercel Serverless Function: /api/stripe-webhook
 * Receives Stripe webhook events (e.g., checkout.session.completed, invoice.paid)
 * and forwards payment confirmations to the VizyLabs webhook with source: "azusanetwork.com".
 */

const DEFAULT_WEBHOOK_URL = 'https://move.vizylabs.com/webhook/506ffde9-4381-4fae-8377-375f71b9d0d6';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const type = event.type || '';
    const obj = (event.data && event.data.object) || {};

    if (type === 'checkout.session.completed' || type === 'invoice.paid') {
      const metadata = obj.metadata || {};
      const customerEmail = obj.customer_email || obj.customer_details?.email || '';
      const customerName =
        metadata.applicant_name || obj.customer_details?.name || 'ANCM Affiliate Member';
      const ministryName = metadata.ministry_name || 'Azusa Network Affiliate';
      const affiliationLevel = metadata.affiliation_level || 'ANCM Monthly Affiliation';
      const appId = metadata.application_id || obj.client_reference_id || obj.id || '';
      const amountPaid = obj.amount_total
        ? `$${(obj.amount_total / 100).toFixed(2)}`
        : obj.amount_paid
        ? `$${(obj.amount_paid / 100).toFixed(2)}`
        : 'Paid';

      const webhookUrl = process.env.WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
      const payload = {
        name: customerName,
        company: ministryName,
        email: customerEmail,
        projectType: `stripe-payment-confirmed (${affiliationLevel})`,
        message: `Stripe recurring payment confirmed (${type}) | Amount: ${amountPaid} | Level: ${affiliationLevel} | Application ID: ${appId} | Stripe Session/Invoice: ${obj.id}`,
        submittedAt: new Date().toISOString(),
        source: 'azusanetwork.com',
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err && err.message ? err.message : 'Stripe webhook error',
    });
  }
};

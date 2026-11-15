/**
 * Vercel Serverless Function: /api/create-checkout-session
 * Creates a live or test Stripe Checkout Session for recurring monthly ANCM Affiliation:
 *   - associate: Associate Minister ($29.00 / month)
 *   - minister:  Credentialed Minister ($59.00 / month)
 *   - church:    Affiliated Church & Ministry ($149.00 / month)
 *
 * Zero external npm dependencies required — uses Stripe's official REST API via native fetch.
 * Simply add STRIPE_SECRET_KEY (sk_live_... or sk_test_...) in Vercel Environment Variables.
 */

const TIER_PRICING = {
  associate: {
    name: 'ANCM Associate Minister Affiliation',
    description: 'Azusa Network of Churches and Ministries — Associate Minister Monthly Affiliation',
    unitAmountCents: 2900, // $29.00 / month
    envPriceKey: 'STRIPE_PRICE_ASSOCIATE',
    envLinkKey: 'STRIPE_LINK_ASSOCIATE',
  },
  minister: {
    name: 'ANCM Credentialed Minister Affiliation',
    description: 'Azusa Network of Churches and Ministries — Credentialed Minister Monthly Affiliation',
    unitAmountCents: 5900, // $59.00 / month
    envPriceKey: 'STRIPE_PRICE_MINISTER',
    envLinkKey: 'STRIPE_LINK_MINISTER',
  },
  church: {
    name: 'ANCM Affiliated Church & Ministry',
    description: 'Azusa Network of Churches and Ministries — Affiliated Church & Ministry Monthly Affiliation',
    unitAmountCents: 14900, // $149.00 / month
    envPriceKey: 'STRIPE_PRICE_CHURCH',
    envLinkKey: 'STRIPE_LINK_CHURCH',
  },
};

function encodeFormBody(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') {
      params.append(k, String(v));
    }
  }
  return params.toString();
}

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const tierKey = ['associate', 'minister', 'church'].includes(body.tier) ? body.tier : 'minister';
    const tierConfig = TIER_PRICING[tierKey];

    // 1. Check if a direct Stripe Payment Link is configured in environment variables
    const paymentLink = process.env[tierConfig.envLinkKey];
    if (paymentLink && /^https:\/\/buy\.stripe\.com\//i.test(paymentLink)) {
      const url = new URL(paymentLink);
      if (body.email) url.searchParams.set('prefilled_email', body.email);
      if (body.applicationId) url.searchParams.set('client_reference_id', body.applicationId);
      return res.status(200).json({
        ok: true,
        stripeConfigured: true,
        checkoutUrl: url.toString(),
      });
    }

    // 2. Check if STRIPE_SECRET_KEY is configured in Vercel Environment Variables
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!stripeSecretKey) {
      return res.status(200).json({
        ok: true,
        stripeConfigured: false,
        message: 'Stripe secret key not yet added. Application recorded via webhook.',
      });
    }

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'azusanetwork.com';
    const origin = `${proto}://${host}`;

    const configuredPriceId = process.env[tierConfig.envPriceKey] || '';

    const formFields = {
      mode: 'subscription',
      success_url: `${origin}/?checkout=success&tier=${encodeURIComponent(tierKey)}&app_id=${encodeURIComponent(body.applicationId || '')}`,
      cancel_url: `${origin}/?checkout=canceled&tier=${encodeURIComponent(tierKey)}`,
      client_reference_id: body.applicationId || `ANCM-${Date.now()}`,
      customer_email: body.email || undefined,
      'line_items[0][quantity]': '1',
      'metadata[source]': 'azusanetwork.com',
      'metadata[affiliation_level]': tierConfig.name,
      'metadata[applicant_name]': body.name || '',
      'metadata[ministry_name]': body.company || '',
      'metadata[application_id]': body.applicationId || '',
      'subscription_data[metadata][source]': 'azusanetwork.com',
      'subscription_data[metadata][affiliation_level]': tierConfig.name,
      'subscription_data[metadata][applicant_name]': body.name || '',
      'subscription_data[metadata][application_id]': body.applicationId || '',
    };

    if (configuredPriceId) {
      formFields['line_items[0][price]'] = configuredPriceId;
    } else {
      // Automatically create recurring monthly price inline so no manual Stripe Product setup is required
      formFields['line_items[0][price_data][currency]'] = 'usd';
      formFields['line_items[0][price_data][unit_amount]'] = String(tierConfig.unitAmountCents);
      formFields['line_items[0][price_data][recurring][interval]'] = 'month';
      formFields['line_items[0][price_data][product_data][name]'] = tierConfig.name;
      formFields['line_items[0][price_data][product_data][description]'] = tierConfig.description;
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: encodeFormBody(formFields),
    });

    const sessionData = await stripeRes.json();

    if (!stripeRes.ok || !sessionData.url) {
      return res.status(stripeRes.status || 500).json({
        ok: false,
        stripeConfigured: true,
        error:
          sessionData && sessionData.error && sessionData.error.message
            ? sessionData.error.message
            : 'Unable to create Stripe Checkout session',
      });
    }

    return res.status(200).json({
      ok: true,
      stripeConfigured: true,
      sessionId: sessionData.id,
      checkoutUrl: sessionData.url,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : 'Stripe checkout error',
    });
  }
};

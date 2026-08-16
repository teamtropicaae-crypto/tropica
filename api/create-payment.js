// Creates a Ziina payment and returns the URL to send the customer to.
// The API key lives ONLY in Vercel env vars — never in the website files.

const PRICES = { adult: 185, kids: 165 };   // server-side source of truth
const DELIVERY_FEE = 30;
const FREE_OVER = 0;                        // 0 = always charge delivery
const VAT_RATE = 0.05;

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = (process.env.ZIINA_API_KEY || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['\"]|['\"]$/g, '')
    .trim();
  if (!KEY) return res.status(500).json({ error: 'Missing ZIINA_API_KEY' });

  try {
    const { items = [], customer = {} } = req.body || {};
    if (!items.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!customer.name || !customer.phone || !customer.address || !customer.emirate) {
      return res.status(400).json({ error: 'Missing delivery details' });
    }

    // Recalculate the total here so the price can't be tampered with in the browser.
    let subtotal = 0;
    for (const it of items) {
      const unit = PRICES[it.kind];
      const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
      if (!unit) return res.status(400).json({ error: 'Unknown item type' });
      subtotal += unit * qty;
    }
    const delivery = (FREE_OVER > 0 && subtotal >= FREE_OVER) ? 0 : DELIVERY_FEE;
    const vat = roundMoney((subtotal + delivery) * VAT_RATE);
    const total = roundMoney(subtotal + delivery + vat);

    // Ziina expects the amount in fils: 185 AED -> 18500
    const amountFils = Math.round(total * 100);

    // SITE_URL should be the production Vercel URL. Falling back to the
    // forwarded host keeps preview deployments usable during testing.
    const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
    const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
    const origin = process.env.SITE_URL
      ? new URL(process.env.SITE_URL).origin
      : `${forwardedProto}://${forwardedHost}`;
    const summary = items
      .map(i => `${i.name} (${i.size}) x${i.qty}`)
      .join(', ')
      .slice(0, 120);

    const zRes = await fetch('https://api-v2.ziina.com/api/payment_intent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountFils,
        currency_code: 'AED',
        message: `Tropica order — ${summary}`,
        success_url: `${origin}/?payment_intent={PAYMENT_INTENT_ID}`,
        cancel_url: `${origin}/?cancelled=1`,
        failure_url: `${origin}/?payment_failed=1`,
        test: process.env.ZIINA_TEST_MODE === 'true'
      })
    });

    const data = await zRes.json();
    if (!zRes.ok || !data.redirect_url) {
      console.error('Ziina error:', data);
      const diagnostic = process.env.ZIINA_TEST_MODE === 'true'
        ? {
            provider_status: zRes.status,
            provider_error: String(
              data?.error?.message || data?.message || data?.detail || data?.error || 'Unknown Ziina error'
            ).slice(0, 160)
          }
        : {};
      return res.status(502).json({ error: 'Could not start payment', ...diagnostic });
    }

    // Order details are logged here so you can match the payment to a shipment.
    console.log('ORDER', JSON.stringify({
      payment_intent: data.id, subtotal, delivery, vat, total, customer, items
    }));

    return res.status(200).json({ redirect_url: data.redirect_url, id: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

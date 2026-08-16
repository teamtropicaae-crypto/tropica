// Creates a Ziina payment and returns the URL to send the customer to.
// The API key lives ONLY in Vercel env vars — never in the website files.

const PRICES = { adult: 185, kids: 165 };   // server-side source of truth
const DELIVERY_FEE = 30;
const FREE_OVER = 0;                        // 0 = always charge delivery

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.ZIINA_API_KEY;
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
    const total = subtotal + delivery;

    // Ziina expects the amount in fils: 185 AED -> 18500
    const amountFils = Math.round(total * 100);

    const origin = `https://${req.headers.host}`;
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
        success_url: `${origin}/?paid=1`,
        cancel_url: `${origin}/?cancelled=1`,
        test: process.env.ZIINA_TEST_MODE === 'true'
      })
    });

    const data = await zRes.json();
    if (!zRes.ok || !data.redirect_url) {
      console.error('Ziina error:', data);
      return res.status(502).json({ error: 'Could not start payment' });
    }

    // Order details are logged here so you can match the payment to a shipment.
    console.log('ORDER', JSON.stringify({
      payment_intent: data.id, total, delivery, customer, items
    }));

    return res.status(200).json({ redirect_url: data.redirect_url, id: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

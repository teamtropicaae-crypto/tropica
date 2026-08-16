// Verifies a Ziina payment on the server before the website confirms an order.
// The API key is read from Vercel environment variables and never sent to the browser.

const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ZIINA_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing ZIINA_API_KEY' });

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id || !PAYMENT_ID_PATTERN.test(id)) {
    return res.status(400).json({ error: 'Invalid payment ID' });
  }

  try {
    const ziinaResponse = await fetch(
      `https://api-v2.ziina.com/api/payment_intent/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const payment = await ziinaResponse.json();

    if (!ziinaResponse.ok) {
      console.error('Ziina verification error:', payment);
      return res.status(502).json({ error: 'Could not verify payment' });
    }

    return res.status(200).json({
      id: payment.id,
      status: payment.status,
      paid: payment.status === 'completed'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
}

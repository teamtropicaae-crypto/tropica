// Sends a paid order to the private Google Apps Script order log.
// The Ziina payment is re-verified here before any customer details are forwarded.

const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const PRICES = { adult: 185, kids: 165 };
const DELIVERY_FEE = 30;
const FREE_OVER = 0;
const PRODUCTS = {
  Regatta: 'adult',
  'Coral Reef': 'adult',
  Aqua: 'adult',
  'Candy Fish': 'adult',
  'Sea Turtle': 'kids',
  'Regatta · Mini': 'kids'
};

function envValue(name) {
  return (process.env[name] || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['\"]|['\"]$/g, '')
    .trim();
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function appsScriptUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && url.pathname.startsWith('/macros/s/')
      ? url.toString()
      : '';
  } catch (_) {
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = envValue('ZIINA_API_KEY');
  const orderLogUrl = appsScriptUrl(envValue('ORDER_LOG_URL'));
  if (!key) return res.status(500).json({ error: 'Missing ZIINA_API_KEY' });
  if (!orderLogUrl) return res.status(503).json({ error: 'Order email is not configured' });

  const { payment_intent: paymentId, order = {} } = req.body || {};
  if (!paymentId || !PAYMENT_ID_PATTERN.test(paymentId)) {
    return res.status(400).json({ error: 'Invalid payment ID' });
  }

  const customer = {
    name: cleanText(order.customer?.name, 100),
    phone: cleanText(order.customer?.phone, 40),
    emirate: cleanText(order.customer?.emirate, 40),
    address: cleanText(order.customer?.address, 240),
    note: cleanText(order.customer?.note, 240)
  };
  if (!customer.name || !customer.phone || !customer.emirate || !customer.address) {
    return res.status(400).json({ error: 'Missing delivery details' });
  }

  const incomingItems = Array.isArray(order.items) ? order.items : [];
  if (!incomingItems.length || incomingItems.length > 20) {
    return res.status(400).json({ error: 'Invalid order items' });
  }

  let subtotal = 0;
  const items = [];
  for (const item of incomingItems) {
    const name = cleanText(item.name, 80);
    const kind = cleanText(item.kind, 10);
    const size = cleanText(item.size, 20);
    const qty = Math.max(1, Math.min(20, parseInt(item.qty, 10) || 1));
    if (!PRODUCTS[name] || PRODUCTS[name] !== kind || !size || !PRICES[kind]) {
      return res.status(400).json({ error: 'Invalid order item' });
    }
    subtotal += PRICES[kind] * qty;
    items.push({ name, kind, size, qty, price: PRICES[kind] });
  }

  const delivery = FREE_OVER > 0 && subtotal >= FREE_OVER ? 0 : DELIVERY_FEE;
  const total = subtotal + delivery;

  try {
    const ziinaResponse = await fetch(
      `https://api-v2.ziina.com/api/payment_intent/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const payment = await ziinaResponse.json();
    if (!ziinaResponse.ok) return res.status(502).json({ error: 'Could not verify payment' });
    if (payment.status !== 'completed') return res.status(409).json({ error: 'Payment is not completed' });
    if (Number(payment.amount) !== Math.round(total * 100)) {
      return res.status(409).json({ error: 'Payment amount does not match order' });
    }

    const logResponse = await fetch(orderLogUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        payment_intent: paymentId,
        payment_status: payment.status,
        placed_at: new Date().toISOString(),
        customer,
        items,
        subtotal,
        delivery,
        total
      }),
      redirect: 'follow'
    });
    const logResult = await logResponse.text();
    if (!logResponse.ok || !logResult.trim().startsWith('ok')) {
      console.error('Order log error:', logResponse.status, logResult.slice(0, 200));
      return res.status(502).json({ error: 'Could not send order notification' });
    }

    return res.status(200).json({ logged: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not complete order notification' });
  }
}

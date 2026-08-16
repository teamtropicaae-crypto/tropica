# Tropica — site setup

Files:

- `index.html` — the whole website (images built in, nothing else to load)
- `api/create-payment.js` — creates the Ziina payment. Only runs on Vercel.
- `order-log.gs` — optional: logs every order into a Google Sheet

Right now the site is in **WhatsApp mode**: orders arrive in your WhatsApp with the
customer's name, phone, emirate, address and the full total including 30 AED delivery.
Nothing is needed from Ziina for this to work.

---

## 1. Put it online (free, ~5 minutes)

1. Create a GitHub account (use teamtropicaae@gmail.com), then a new repository called `tropica`.
2. Upload these files, keeping `api/create-payment.js` inside a folder named `api`.
3. Go to vercel.com, sign in **with GitHub**, click **Add New > Project**, pick `tropica`, click **Deploy**.

You'll get a live address like `tropica.vercel.app`. Every time you change a file on
GitHub, Vercel updates the site automatically.

A real domain (tropica.ae) can be attached later: Vercel > Settings > Domains.

---

## 2. Turn on card / Apple Pay / Google Pay (when the API key arrives)

1. In Vercel: **Settings > Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `ZIINA_API_KEY` | the key from Ziina |
   | `ZIINA_TEST_MODE` | `true` while testing, `false` when live |

   Never put the key in `index.html` — anyone can read that file.

2. In `index.html`, find the CONFIG block near the bottom and change:

   ```js
   const PAY_MODE = "whatsapp";   ->   const PAY_MODE = "ziina";
   ```

3. Redeploy. Test with `ZIINA_TEST_MODE = true` — any card number works and no
   money moves. When the confirmation screen appears, set it to `false` and do one
   small real order to confirm.

If a payment ever fails, the checkout still offers WhatsApp as a fallback.

---

## 3. Optional: log orders to a Google Sheet

1. Make a new Google Sheet.
2. **Extensions > Apps Script**, delete what's there, paste in `order-log.gs`.
3. The script already emails every order to teamtropicaae@gmail.com. Make sure you are signed in to Google as that account (or change `NOTIFY_EMAIL` at the top).
4. **Deploy > New deployment > Web app** — Execute as **Me**, Access **Anyone**. Copy the `/exec` URL.
5. Paste that URL into `ORDER_LOG_URL` in `index.html`.

Every order then lands in the sheet with items, sizes, totals and the delivery address.

---

## Things you can edit yourself

All near the bottom of `index.html`:

- `WHATSAPP` — your number, international format, no `+`
- `DELIVERY_FEE` — currently `30`
- `FREE_OVER` — set to e.g. `500` for free delivery above 500 AED (`0` = always charge)
- `PRODUCTS` — names, descriptions, prices, adult/kids

Prices are also repeated in `api/create-payment.js` so nobody can change the total in
their browser. **If you change a price, change it in both places.**

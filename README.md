# Tropica — site setup

Files:

- `index.html` — the complete storefront markup, styles, and interactions.
- `assets/` — optimized, cacheable product and campaign photography.
- `api/create-payment.js` — creates the Ziina payment. Only runs on Vercel.
- `api/verify-payment.js` — checks the payment status with Ziina before confirming an order.
- `api/complete-order.js` — re-verifies a paid order and forwards it to the seller email service.
- `order-email.gs` — standalone Google Apps Script that emails the seller; no Sheet required.
- `order-log.gs` — optional alternative that also saves orders into Google Sheets.

The site is in **Ziina mode**. Ziina handles the payment page, while Vercel
re-verifies successful payments before any order notification is sent.
Checkout adds 5% VAT to the merchandise subtotal and delivery charge. Only enable
this if the seller is VAT-registered and legally allowed to collect UAE VAT.

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
   | `SITE_URL` | the production Vercel URL, for example `https://tropica.vercel.app` |

   Never put the key in `index.html` — anyone can read that file.

2. In `index.html`, find the CONFIG block near the bottom and change:

   ```js
   const PAY_MODE = "whatsapp";   ->   const PAY_MODE = "ziina";
   ```

3. Redeploy. Test with `ZIINA_TEST_MODE = true` using one of Ziina's documented
   test cards. No money moves in test mode. The website verifies the returned
   Payment Intent with Ziina before displaying the order-confirmed message.
4. When the entire flow works, set `ZIINA_TEST_MODE` to `false`, redeploy, and do
   one small real order to confirm funds arrive in the correct Ziina Business account.

If a payment ever fails, the checkout still offers WhatsApp as a fallback.

GitHub Pages can host the WhatsApp-only website, but it cannot run the `/api`
server functions. Ziina checkout must use the Vercel URL (or another serverless host).

---

## 3. Email every paid order (easiest setup — no Google Sheet)

1. Sign in to the seller's Google account and open `https://script.new`.
2. Delete the sample code and paste in `order-email.gs`, then name the project `Tropica order emails`.
3. **Deploy > New deployment > Web app** — Execute as **Me**, Access **Anyone**. Approve the Google authorization request and copy the `/exec` URL.
4. In Vercel, open **Settings > Environment Variables** and add `ORDER_EMAIL_URL`
   with that `/exec` URL for **Production** and **Preview**.
5. Save it and redeploy the latest Production deployment.

Only orders that the server confirms as `completed` with Ziina are forwarded.
The payment amount must also match the server-calculated order total. The script
deduplicates payment IDs and sends a `PAID Tropica order` email with the products,
sizes, customer, delivery address, VAT, and total.

If you also want a permanent spreadsheet later, use `order-log.gs` instead and
save its web-app URL under the same `ORDER_EMAIL_URL` variable.

---

## Things you can edit yourself

All near the bottom of `index.html`:

- `WHATSAPP` — your number, international format, no `+`
- `DELIVERY_FEE` — currently `30`
- `FREE_OVER` — set to e.g. `500` for free delivery above 500 AED (`0` = always charge)
- `VAT_RATE` — currently `0.05` (5% VAT, added to products and delivery)
- `PRODUCTS` — names, descriptions, prices, adult/kids

Prices are also repeated in `api/create-payment.js` so nobody can change the total in
their browser. **If you change a price, change it in both places.**

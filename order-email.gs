/**
 * TROPICA — standalone paid-order email
 *
 * Create this at https://script.new while signed in to the seller's Google
 * account. It does not need a Google Sheet. Deploy it as a Web app, execute as
 * Me, with access set to Anyone, then put its /exec URL in Vercel as
 * ORDER_EMAIL_URL.
 *
 * The Vercel function verifies the Ziina payment before forwarding an order.
 */

function safeText(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function textResult(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var order = JSON.parse(e.postData.contents);
    var paymentId = safeText(order.payment_intent);
    var status = safeText(order.payment_status);
    if (!paymentId || status !== 'completed') return textResult('error: paid order required');

    var properties = PropertiesService.getScriptProperties();
    var dedupeKey = 'sent_' + paymentId;
    if (properties.getProperty(dedupeKey)) return textResult('ok: duplicate ignored');

    var customer = order.customer || {};
    var items = (order.items || []).map(function (item) {
      return '• ' + safeText(item.name) + ' (' + safeText(item.kind) +
        ' / ' + safeText(item.size) + ') ×' + Number(item.qty || 1) +
        ' — ' + money(Number(item.price || 0) * Number(item.qty || 1)) + ' AED';
    }).join('\n');

    var recipient = Session.getEffectiveUser().getEmail();
    if (!recipient) return textResult('error: could not determine recipient email');

    MailApp.sendEmail({
      to: recipient,
      subject: 'PAID Tropica order — ' + money(order.total) + ' AED',
      body:
        'Payment confirmed\n' +
        'Payment ID: ' + paymentId + '\n' +
        'Placed: ' + safeText(order.placed_at) + '\n\n' +
        'ORDER\n' + items + '\n\n' +
        'DELIVERY\n' +
        safeText(customer.name) + '\n' +
        safeText(customer.phone) + '\n' +
        safeText(customer.emirate) + '\n' +
        safeText(customer.address) +
        (customer.note ? '\nNote: ' + safeText(customer.note) : '') +
        '\n\nSubtotal: ' + money(order.subtotal) + ' AED' +
        '\nDelivery: ' + money(order.delivery) + ' AED' +
        '\nVAT (5%): ' + money(order.vat) + ' AED' +
        '\nTOTAL: ' + money(order.total) + ' AED'
    });

    properties.setProperty(dedupeKey, new Date().toISOString());
    return textResult('ok');
  } catch (error) {
    return textResult('error: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

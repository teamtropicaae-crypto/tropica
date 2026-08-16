/**
 * TROPICA — verified paid-order log
 *
 * 1. Create a blank Google Sheet and open Extensions > Apps Script.
 * 2. Paste this file into the editor.
 * 3. Deploy > New deployment > Web app.
 *    Execute as: Me. Who has access: Anyone.
 * 4. Put the resulting /exec URL in Vercel as ORDER_EMAIL_URL.
 *
 * The Vercel function verifies the Ziina payment before sending an order here.
 */

var NOTIFY_EMAIL = "teamtropicaae@gmail.com";

function safeCell(value) {
  var text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function textResult(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var order = JSON.parse(e.postData.contents);
    var paymentId = safeCell(order.payment_intent);
    var status = safeCell(order.payment_status);
    if (!paymentId || status !== 'completed') return textResult('error: paid order required');

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Payment ID', 'Status', 'Date', 'Name', 'Phone', 'Emirate', 'Address',
        'Items', 'Subtotal', 'Delivery', 'VAT (5%)', 'Total', 'Note'
      ]);
      sheet.getRange(1, 1, 1, 13).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    if (sheet.getRange(1, 1).getValue() !== 'Payment ID') {
      return textResult('error: use a blank sheet for the verified order log');
    }

    if (sheet.getLastRow() > 1) {
      var existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
        .createTextFinder(paymentId)
        .matchEntireCell(true)
        .findNext();
      if (existing) return textResult('ok: duplicate ignored');
    }

    var items = (order.items || []).map(function (item) {
      return safeCell(item.name) + ' (' + safeCell(item.kind) + '/' + safeCell(item.size) + ') x' + Number(item.qty || 1);
    }).join('\n');
    var customer = order.customer || {};

    sheet.appendRow([
      paymentId,
      status,
      order.placed_at ? new Date(order.placed_at) : new Date(),
      safeCell(customer.name),
      "'" + safeCell(customer.phone),
      safeCell(customer.emirate),
      safeCell(customer.address),
      items,
      Number(order.subtotal || 0),
      Number(order.delivery || 0),
      Number(order.vat || 0),
      Number(order.total || 0),
      safeCell(customer.note)
    ]);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'PAID Tropica order — ' + Number(order.total || 0) + ' AED',
        body:
          'Payment confirmed\n' +
          'Payment ID: ' + paymentId + '\n\n' +
          items + '\n\n' +
          safeCell(customer.name) + '\n' +
          safeCell(customer.phone) + '\n' +
          safeCell(customer.emirate) + '\n' +
          safeCell(customer.address) +
          (customer.note ? '\nNote: ' + safeCell(customer.note) : '') +
          '\n\nSubtotal: ' + Number(order.subtotal || 0) + ' AED' +
          '\nDelivery: ' + Number(order.delivery || 0) + ' AED' +
          '\nVAT (5%): ' + Number(order.vat || 0) + ' AED' +
          '\nTotal: ' + Number(order.total || 0) + ' AED'
      });
    }

    return textResult('ok');
  } catch (error) {
    return textResult('error: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

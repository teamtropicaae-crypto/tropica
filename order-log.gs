/**
 * TROPICA — order log
 * Paste this into a Google Sheet: Extensions > Apps Script.
 * Then Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the /exec URL it gives you and put it in ORDER_LOG_URL in index.html.
 */

// Every order is emailed here. Change the address if you ever want it elsewhere.
var NOTIFY_EMAIL = "teamtropicaae@gmail.com";

function doPost(e) {
  try {
    var order = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Write the header row once.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Date', 'Name', 'Phone', 'Emirate', 'Address',
        'Items', 'Subtotal', 'Delivery', 'Total', 'Note'
      ]);
      sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
    }

    var items = order.items.map(function (i) {
      return i.name + ' (' + i.kind + '/' + i.size + ') x' + i.qty;
    }).join('\n');

    var c = order.customer || {};
    sheet.appendRow([
      new Date(), c.name, "'" + c.phone, c.emirate, c.address,
      items, order.subtotal, order.delivery, order.total, c.note || ''
    ]);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(
        NOTIFY_EMAIL,
        'New Tropica order — ' + order.total + ' AED',
        items + '\n\n' + c.name + '\n' + c.phone + '\n' + c.emirate + '\n' + c.address +
        '\n\nTotal: ' + order.total + ' AED'
      );
    }

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Attempts')
    .addItem('Modify Attempts', 'showModifyAttemptsDialog')
    .addToUi();
}

function showModifyAttemptsDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ModifyAttempts')
    .setWidth(480)
    .setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(html, 'Modify Attempts');
}

/**
 * Modify attempts for provided emails.
 * data: { emails: string, attemptType: 'FA'|'RA', batch: string|number, activity: string }
 */
function modifyAttempts(data) {
  data = data || {};
  const emailsRaw = String(data.emails || '').trim();
  const attemptType = String(data.attemptType || 'FA').trim().toUpperCase();
  const batch = String(data.batch || '').trim();
  const activity = String(data.activity || '').trim().toUpperCase();

  if (!emailsRaw) return { success: false, message: 'No emails provided' };
  if (!batch) return { success: false, message: 'Batch number required' };

  const attemptsValue = attemptType + batch + 'B';

  // decide sheet and column name based on activity
  const level1SheetName = 'Training Database - 2026 - Level 1';
  const level2SheetName = 'Training Database - 2026 - Level 2';
  const level3SheetName = 'Training Database - 2026 - Level 3';

  let targetSheetName = null;
  let targetHeader = null;

  if (activity === 'PPM' || activity === 'CSM') {
    targetSheetName = level1SheetName;
    targetHeader = activity === 'PPM' ? 'PPM Attempt' : 'CSM Attempt';
  } else if (activity === 'SA' || activity === 'BA' || activity === 'PR') {
    targetSheetName = level2SheetName;
    if (activity === 'SA') targetHeader = 'SA Attempt';
    if (activity === 'BA') targetHeader = 'BA Attempt';
    if (activity === 'PR') targetHeader = 'PR Attempt';
  } else if (activity === 'TMCQ' || activity === 'AI' || activity === '1ON1' || activity.indexOf('1ON1') === 0) {
    // Level 3 activities
    targetSheetName = level3SheetName;
    if (activity === 'TMCQ') targetHeader = 'TMCQ Attempt';
    if (activity === 'AI') targetHeader = 'AI Attempt';
    if (activity === '1ON1' || activity.indexOf('1ON1') === 0) targetHeader = '1on1 Attempt';
  } else {
    return { success: false, message: 'Unknown activity: ' + activity };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) return { success: false, message: 'Sheet not found: ' + targetSheetName };

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return { success: false, message: 'Sheet has no data' };

  // find header indices
  const headerRow = values[0].map(function(h) { return String(h || '').trim(); });
  const emailCol = headerRow.findIndex(function(h) { return /^email$/i.test(h); });
  const targetCol = headerRow.findIndex(function(h) { return h.toLowerCase() === targetHeader.toLowerCase(); });

  if (emailCol < 0) return { success: false, message: 'Email column not found in ' + targetSheetName };
  if (targetCol < 0) return { success: false, message: 'Target column "' + targetHeader + '" not found in ' + targetSheetName };

  const emails = emailsRaw.split(/[\s,;]+/).map(function(e) { return String(e || '').trim().toLowerCase(); }).filter(Boolean);
  if (!emails.length) return { success: false, message: 'No valid emails parsed' };

  const updates = [];
  const notFound = [];

  // map email -> row index (1-based)
  const emailToRow = {};
  for (let r = 1; r < values.length; r++) {
    const rowEmail = String(values[r][emailCol] || '').trim().toLowerCase();
    if (rowEmail) emailToRow[rowEmail] = r + 1;
  }

  emails.forEach(function(mail) {
    const rowIndex = emailToRow[mail];
    if (rowIndex) {
      sheet.getRange(rowIndex, targetCol + 1).setValue(attemptsValue);
      updates.push({ email: mail, row: rowIndex, value: attemptsValue });
    } else {
      notFound.push(mail);
    }
  });

  return { success: true, updated: updates.length, notFound: notFound, details: updates };
}

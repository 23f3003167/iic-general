/**
 * Reconciles Booked Slots into Summary for 1-on-1 sessions.
 *
 * Api.gs writes new bookings to Summary immediately. This script mirrors the
 * Behavioral/Presentation summary jobs so that imported or older bookings are
 * also represented, without creating any additional sheets.
 */
function refreshOneOnOneSummary() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = SpreadsheetApp.getActive();
    var bookedSheet = ss.getSheetByName('Booked Slots');
    var summarySheet = ss.getSheetByName('Summary');
    if (!bookedSheet || !summarySheet) {
      throw new Error('Booked Slots and Summary sheets are required.');
    }
    if (bookedSheet.getLastRow() < 2) return;

    ensureOneOnOneSummaryHeader_(summarySheet);
    var instructorMap = getOneOnOneInstructorMap_();
    replaceOneOnOneSummaryInstructorEmails_(summarySheet, instructorMap);
    var slotInstructorMap = getOneOnOneSlotInstructorMap_();
    var existingEmails = getOneOnOneSummaryEmails_(summarySheet);
    var bookedValues = bookedSheet.getDataRange().getValues();
    var rowsToAppend = [];

    for (var rowIndex = 1; rowIndex < bookedValues.length; rowIndex++) {
      var booking = parseOneOnOneBookedRow_(bookedValues[rowIndex]);
      if (!booking.email || !booking.slot || booking.status === 'Cancelled') continue;
      if (existingEmails[booking.email]) continue;

      rowsToAppend.push([
        Utilities.getUuid(),
        booking.email,
        booking.name,
        booking.resume,
        booking.progressCard,
        booking.domain,
        booking.plan,
        instructorMap[slotInstructorMap[booking.slot] || booking.instructorEmail] || slotInstructorMap[booking.slot] || booking.instructorEmail,
        booking.slot,
        'Pending', '', '', '', '', '', '', '', '', ''
      ]);
      existingEmails[booking.email] = true;
    }

    if (rowsToAppend.length) {
      summarySheet.getRange(summarySheet.getLastRow() + 1, 1, rowsToAppend.length, 20).setValues(rowsToAppend);
    }
    sortOneOnOneSummaryBySlot_(summarySheet);
  } finally {
    lock.releaseLock();
  }
}

/** Sorts Summary rows by the date and start time encoded in the Slot column. */
function sortOneOnOneSummaryBySlot_(sheet) {
  var rowCount = sheet.getLastRow() - 1;
  if (rowCount < 2) return;

  var columnCount = sheet.getLastColumn();
  var rows = sheet.getRange(2, 1, rowCount, columnCount).getValues();
  var sortableRows = rows.map(function (row, index) {
    return {
      row: row,
      index: index,
      time: getOneOnOneSlotStartTime_(row[8])
    };
  });

  sortableRows.sort(function (first, second) {
    var firstTime = first.time ? first.time.getTime() : Number.MAX_SAFE_INTEGER;
    var secondTime = second.time ? second.time.getTime() : Number.MAX_SAFE_INTEGER;
    return firstTime - secondTime || first.index - second.index;
  });

  sheet.getRange(2, 1, rowCount, columnCount).setValues(
    sortableRows.map(function (item) { return item.row; })
  );
}

function getOneOnOneSlotStartTime_(slot) {
  // Expected format: dd/MM/yyyy EEEE hh:mm AM - hh:mm AM (Domain)
  var match = String(slot || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*?(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!match) return null;

  var hour = Number(match[4]);
  var minute = Number(match[5]);
  var period = String(match[6]).toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), hour, minute);
}

function replaceOneOnOneSummaryInstructorEmails_(sheet, instructorMap) {
  if (sheet.getLastRow() < 2) return;
  var range = sheet.getRange(2, 8, sheet.getLastRow() - 1, 1);
  var values = range.getValues();
  var changed = false;
  for (var i = 0; i < values.length; i++) {
    var instructorEmail = String(values[i][0] || '').trim().toLowerCase();
    if (instructorMap[instructorEmail] && values[i][0] !== instructorMap[instructorEmail]) {
      values[i][0] = instructorMap[instructorEmail];
      changed = true;
    }
  }
  if (changed) range.setValues(values);
}

function createOneOnOneSummaryTimeTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'refreshOneOnOneSummary' &&
        triggers[i].getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('refreshOneOnOneSummary').timeBased().everyMinutes(15).create();
}

function ensureOneOnOneSummaryHeader_(sheet) {
  if (sheet.getLastRow()) return;
  sheet.appendRow([
    'ID', 'Email', 'Name', 'Resume', 'Progress Card', 'Domain', 'Plan', 'Instructor',
    'Slot', 'Status', 'Skillsets of student', 'Technical skills in programming (Rate from 1 to 5)',
    'Technical skills in data science (Rate from 1 to 5)', 'Communication skills (Rate from 1 to 5)',
    'Readiness of the student for placement', 'Performing Exceptionally good',
    'If not ready, please mention the list of tasks students should do',
    'What roles they are suitable for? (Recommondations by instructor)',
    'Detailed feedback from instructor 1', 'Any additional remarks'
  ]);
}

function getOneOnOneSummaryEmails_(sheet) {
  var emails = {};
  if (sheet.getLastRow() < 2) return emails;
  var values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var email = String(values[i][0] || '').trim().toLowerCase();
    if (email) emails[email] = true;
  }
  return emails;
}

function getOneOnOneInstructorMap_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Instructors');
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][0] || '').trim();
    var email = String(values[i][1] || '').trim().toLowerCase();
    if (name && email) map[email] = name;
  }
  return map;
}

function getOneOnOneSlotInstructorMap_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Slot');
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  for (var i = 0; i < values.length; i++) {
    var slot = String(values[i][0] || '').trim();
    var instructorEmail = String(values[i][4] || '').trim().toLowerCase();
    if (slot && instructorEmail) map[slot] = instructorEmail;
  }
  return map;
}

function parseOneOnOneBookedRow_(row) {
  // Canonical rows created by Api.gs have Slot at G. Older rows use G/H for
  // Data Science/Programming slots, so retain compatibility with both.
  var slot = String(row[8] || row[9] || '').trim();
  var canonical = row.length >= 12;
  return {
    timestamp: String(row[0] || '').trim(),
    name: String(row[1] || '').trim(),
    email: String(row[2] || '').trim().toLowerCase(),
    resume: String(row[6] || '').trim(),
    progressCard: String(row[7] || '').trim(),
    slot: slot,
    domain: String(row[4] || '').trim() || extractOneOnOneDomain_(slot),
    plan: String(row[5] || '').trim(),
    status: canonical ? String(row[11] || 'Booked').trim() : 'Booked',
    instructorEmail: ''
  };
}

function extractOneOnOneDomain_(slot) {
  var match = String(slot || '').match(/\(([^)]+)\)$/);
  return match ? match[1] : '';
}

/**
 * 1-on-1 web-app API.
 *
 * Only these sheets are used: Booked Slots, Slot, Students, Instructors, Summary.
 * Keep the web app deployed with this spreadsheet as its active container.
 */
function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  try {
    return handleRequest_(parsePayload_(e));
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
}

function handleRequest_(payload) {
  try {
    validateApiToken_(payload);
    var action = String(payload.action || '').trim();
    var data;

    if (action === 'getInstructors') data = getInstructors_();
    else if (action === 'releaseOneOnOneSlots') data = releaseOneOnOneSlots_(payload);
    else if (action === 'checkOneOnOneSlot') data = checkOneOnOneSlot_(payload);
    else if (action === 'getOneOnOneBookableSlots') data = getOneOnOneBookableSlots_(payload);
    else if (action === 'bookOneOnOneSlot') data = bookOneOnOneSlot_(payload);
    else if (action === 'getOneOnOneStats') data = getOneOnOneStats_();
    else if (action === 'getUniqueInstructors') data = getUniqueInstructors_();
    else if (action === 'getPendingEvaluations') data = getPendingEvaluations_(payload);
    else if (action === 'submitEvaluation') data = submitEvaluation_(payload);
    else throw new Error('Unsupported action: ' + action);

    return jsonResponse_(true, data, 'OK');
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Empty request body');
  try { return JSON.parse(e.postData.contents); }
  catch (_error) { throw new Error('Invalid JSON body'); }
}

function jsonResponse_(success, data, message, error) {
  return ContentService.createTextOutput(JSON.stringify({ success: success, data: data, message: message || '', error: error || '' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function validateApiToken_(payload) {
  var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (token && (!payload || payload.apiToken !== token)) throw new Error('Unauthorized request');
}

function getRequiredSheet_(name) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(name + ' sheet not found');
  return sheet;
}

function getInstructors_() {
  var values = getRequiredSheet_('Instructors').getDataRange().getValues();
  var instructors = [];
  for (var i = 1; i < values.length; i++) {
    var name = String(values[i][0] || '').trim();
    var email = normalizeEmail_(values[i][1]);
    if (name && email) instructors.push({ number: email, name: name });
  }
  return instructors;
}

function releaseOneOnOneSlots_(payload) {
  var date = String(payload.date || '').trim();
  var startTime = String(payload.startTime || '').trim();
  var endTime = String(payload.endTime || '').trim();
  var instructorEmail = normalizeEmail_(payload.instructorNumber);
  var domain = String(payload.domain || '').trim();
  var duration = Number(payload.durationMinutes || 30);
  var studentAuthorizationEmails = payload.studentAuthorizationEmails;
  if (!date || !startTime || !endTime || !instructorEmail || !domain) throw new Error('Missing slot details');
  if ([15, 30].indexOf(duration) === -1) throw new Error('Unsupported slot duration. Use 15 or 30 minutes.');

  var start = parseDateTime_(date, startTime);
  var end = parseDateTime_(date, endTime);
  if (end <= start) throw new Error('End time should be after start time');

  var rows = [], cursor = new Date(start.getTime());
  while (cursor.getTime() + duration * 60000 <= end.getTime()) {
    var slotEnd = new Date(cursor.getTime() + duration * 60000);
    rows.push([
      Utilities.formatDate(cursor, 'Asia/Kolkata', 'dd/MM/yyyy EEEE hh:mm a') +
        ' - ' + Utilities.formatDate(slotEnd, 'Asia/Kolkata', 'hh:mm a') + ' (' + domain + ')',
      0, 1, 1, instructorEmail, ''
    ]);
    cursor = slotEnd;
  }
  if (!rows.length) throw new Error('No complete slots fit within the selected time range.');
  var sheet = getRequiredSheet_('Slot');
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);

  var authorizationColumn = '';
  var validStudents = null;
  var invalidStudents = null;
  var addedStudents = null;

  if (studentAuthorizationEmails) {
    var appendStats = appendAuthorizationEmailsToStudents_(studentAuthorizationEmails);
    authorizationColumn = appendStats.authorizationColumn;
    validStudents = appendStats.validStudents;
    invalidStudents = appendStats.invalidStudents;
    addedStudents = appendStats.addedStudents;
  }

  return { 
    slotsCreated: rows.length, 
    syncToForm: false,
    authorizationColumn: authorizationColumn || '',
    validStudents: validStudents,
    invalidStudents: invalidStudents,
    addedStudents: addedStudents
  };
}

function getOneOnOneBookableSlots_(payload) {
  var email = normalizeEmail_(payload.email);
  var domain = String(payload.domain || '').trim();
  var plan = String(payload.plan || '').trim();
  if (!email || !domain || !plan) throw new Error('Email, domain, and plan are required');
  if (!isAuthorizedStudent_(email)) return { email: email, domain: domain, plan: plan, verified: false, alreadyBooked: false, slots: [] };
  var existing = findBookedByEmail_(email);
  if (existing) return { email: email, domain: domain, plan: plan, verified: true, alreadyBooked: true, booking: existing, slots: [] };

  var values = getRequiredSheet_('Slot').getDataRange().getValues();
  var slots = [];
  for (var i = 1; i < values.length; i++) {
    var text = String(values[i][0] || '').trim();
    if (!text || Number(values[i][2] || 0) <= 0 || extractDomain_(text).toLowerCase() !== domain.toLowerCase()) continue;
    slots.push({ slot: text, seatRemaining: Number(values[i][2]), evaluatorEmail: normalizeEmail_(values[i][4]) });
  }
  return { email: email, domain: domain, plan: plan, verified: true, alreadyBooked: false, slots: slots };
}

function checkOneOnOneSlot_(payload) {
  var email = normalizeEmail_(payload.email);
  if (!email) throw new Error('Email is required');
  var booking = findBookedByEmail_(email);
  var authorized = isAuthorizedStudent_(email);
  return booking ? { found: true, authorized: authorized, email: email, name: booking.name, slot: booking.slot, status: booking.status } :
    { found: false, authorized: authorized, email: email, message: authorized ? 'No slot booked yet' : 'Email is not authorized for 1-on-1 booking.' };
}

function isAuthorizedStudent_(email) {
  var sheet = getRequiredSheet_('Students');
  var columnLetter = PropertiesService.getScriptProperties().getProperty('ACTIVE_STUDENT_COLUMN');
  
  var columnIndex;
  if (columnLetter) {
    columnIndex = columnToIndex_(columnLetter);
  } else {
    // If admin never synced yet, use the last column
    columnIndex = Math.max(sheet.getLastColumn() - 1, 0);
  }
  
  var values = sheet.getDataRange().getValues();
  email = normalizeEmail_(email);
  
  for (var i = 1; i < values.length; i++) {
    var studentEmail = normalizeEmail_(values[i][columnIndex]);
    if (studentEmail === email) return true;
  }
  return false;
}

function bookOneOnOneSlot_(payload) {
  var email = normalizeEmail_(payload.email), name = String(payload.name || '').trim();
  var contact = String(payload.contact || '').trim(), slot = String(payload.slot || '').trim();
  var bookingId = String(payload.bookingId || payload.idempotencyKey || '').trim();
  var domain = String(payload.domain || '').trim(), plan = String(payload.plan || '').trim();
  if (!email || !name || !contact || !slot || !bookingId || !domain || !plan) throw new Error('Fill all required booking fields.');
  if (!isAuthorizedStudent_(email)) throw new Error('This email is not authorized for 1-on-1 booking.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var existing = findBookedByBookingId_(bookingId) || findBookedByEmail_(email);
    if (existing) {
      if (existing.email === email && (existing.bookingId === bookingId || existing.slot === slot)) return bookingResponse_(existing, true);
      throw new Error('This email already has a booked slot.');
    }
    var slotSheet = getRequiredSheet_('Slot'), values = slotSheet.getDataRange().getValues(), row = -1;
    for (var i = 1; i < values.length; i++) if (String(values[i][0] || '').trim() === slot) { row = i; break; }
    if (row < 0 || Number(values[row][2] || 0) <= 0) throw new Error('Selected slot is no longer available.');
    if (extractDomain_(slot).toLowerCase() !== domain.toLowerCase()) throw new Error('Selected slot does not match the chosen domain.');

    var taken = Number(values[row][1] || 0), remaining = Number(values[row][2] || 0), instructor = normalizeEmail_(values[row][4]);
    slotSheet.getRange(row + 1, 2, 1, 2).setValues([[taken + 1, remaining - 1]]);
    var timestamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy hh:mm:ss a');
    var booking = { timestamp: timestamp, name: name, email: email, contact: contact, slot: slot, bookingId: bookingId, domain: domain, plan: plan, status: 'Booked' };
    appendBooked_(booking, String(payload.resumeDriveLink || '').trim(), String(payload.progressCardDriveLink || '').trim());
    upsertSummary_(booking, instructor, String(payload.resumeDriveLink || '').trim(), String(payload.progressCardDriveLink || '').trim());
    if (instructor && typeof handleEvaluatorSession === 'function') handleEvaluatorSession(values, slotSheet, row, email, instructor);
    return bookingResponse_(booking, false);
  } finally { lock.releaseLock(); }
}

function bookedSheet_() {
  var sheet = getRequiredSheet_('Booked Slots');
  if (!sheet.getLastRow()) sheet.appendRow(['Timestamp', 'Student Name', 'Student Email', 'Mobile Number', 'Domain', 'Plan', 'Upload your resume', 'Upload your progress card.', 'Slots (Timing in IST) – Data Science', 'Slots (Timing in IST) – Programming', 'Booking ID', 'Status']);
  return sheet;
}

function appendBooked_(booking, resume, progressCard) {
  bookedSheet_().appendRow([booking.timestamp, booking.name, booking.email, booking.contact, booking.domain, booking.plan, resume, progressCard, booking.domain.toLowerCase() === 'data science' ? booking.slot : '', booking.domain.toLowerCase() === 'programming' ? booking.slot : '', booking.bookingId, booking.status]);
}

function findBookedByEmail_(email) { return findBooked_(function (b) { return b.email === email; }); }
function findBookedByBookingId_(id) { return id ? findBooked_(function (b) { return b.bookingId === id; }) : null; }
function findBooked_(matches) {
  var sheet = getRequiredSheet_('Booked Slots');
  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var slotColumn = findHeaderIndex_(headers, 'slot');
  var bookingIdColumn = findHeaderIndex_(headers, 'booking id');
  var domainColumn = findHeaderIndex_(headers, 'domain');
  var planColumn = findHeaderIndex_(headers, 'plan');
  var statusColumn = findHeaderIndex_(headers, 'status');
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var booking = { timestamp: String(row[0] || ''), name: String(row[1] || ''), email: normalizeEmail_(row[2]), contact: String(row[3] || ''), slot: String(row[slotColumn >= 0 ? slotColumn : 8] || row[9] || ''), bookingId: String(row[bookingIdColumn >= 0 ? bookingIdColumn : 10] || ''), domain: String(row[domainColumn >= 0 ? domainColumn : -1] || ''), plan: String(row[planColumn >= 0 ? planColumn : -1] || ''), status: String(row[statusColumn >= 0 ? statusColumn : 11] || 'Booked') };
    if (booking.status !== 'Cancelled' && matches(booking)) return booking;
  }
  return null;
}
function findHeaderIndex_(headers, label) {
  var expected = String(label).toLowerCase();
  for (var i = 0; i < headers.length; i++) if (String(headers[i] || '').trim().toLowerCase().indexOf(expected) >= 0) return i;
  return -1;
}
function bookingResponse_(booking, alreadyProcessed) {
  return { success: true, alreadyProcessed: alreadyProcessed, timestamp: booking.timestamp, name: booking.name, email: booking.email, contact: booking.contact, slot: booking.slot, status: booking.status, bookingId: booking.bookingId, domain: booking.domain, plan: booking.plan };
}

function summarySheet_() { return getRequiredSheet_('Summary'); }
function summaryHeaders_() { return ['ID', 'Email', 'Name', 'Resume', 'Progress Card', 'Domain', 'Plan', 'Instructor', 'Slot', 'Status', 'Skillsets of student', 'Technical skills in programming (Rate from 1 to 5)', 'Technical skills in data science (Rate from 1 to 5)', 'Communication skills (Rate from 1 to 5)', 'Readiness of the student for placement', 'Performing Exceptionally good', 'If not ready, please mention the list of tasks students should do', 'What roles they are suitable for? (Recommondations by instructor)', 'Feedback', 'Remarks']; }
function ensureSummaryHeader_(sheet) { if (!sheet.getLastRow()) sheet.appendRow(summaryHeaders_()); }
function upsertSummary_(booking, instructor, resume, progressCard) {
  var sheet = summarySheet_(); ensureSummaryHeader_(sheet); var values = sheet.getDataRange().getValues(), target = -1;
  for (var i = 1; i < values.length; i++) if (normalizeEmail_(values[i][1]) === booking.email) { target = i + 1; break; }
  var row = [Utilities.getUuid(), booking.email, booking.name, resume, progressCard, booking.domain, booking.plan, instructor, booking.slot, 'Pending', '', '', '', '', '', '', '', '', '', ''];
  if (target > 0) {
    var existing = values[target - 1];
    for (var column = 1; column < 10; column++) existing[column] = row[column];
    sheet.getRange(target, 1, 1, row.length).setValues([existing]);
  } else sheet.appendRow(row);
}

function getUniqueInstructors_() {
  var values = summarySheet_().getDataRange().getValues(), seen = {}, result = [];
  for (var i = 1; i < values.length; i++) { var instructor = String(values[i][7] || '').trim(); if (instructor && !seen[instructor]) { seen[instructor] = true; result.push(instructor); } }
  return result.sort();
}
function getPendingEvaluations_(payload) {
  var instructor = String(payload.instructorName || '').trim(), values = summarySheet_().getDataRange().getValues(), result = [];
  if (!instructor) throw new Error('Instructor name is required');
  for (var i = 1; i < values.length; i++) { var r = values[i]; if (String(r[7] || '').trim().toLowerCase() === instructor.toLowerCase() && String(r[9] || '').trim().toLowerCase() === 'pending') result.push({ id: String(r[1]), instructor: String(r[7]), name: String(r[2]), email: String(r[1]), resumeUrl: String(r[3]), progressCard: String(r[4]), domain: String(r[5]), plan: String(r[6]), slot: String(r[8]), slotTime: String(r[8]), technicalProgramming: r[11] || '', technicalDataScience: r[12] || '', communication: r[13] || '', readiness: r[14] || '', exceptional: r[15] || '', tasks: r[16] || '', roles: r[17] || '', detailedFeedback1: r[18] || '', status: 'Pending' }); }
  return result;
}
function submitEvaluation_(payload) {
  var email = normalizeEmail_(payload.id), sheet = summarySheet_(), values = sheet.getDataRange().getValues();
  if (!email) throw new Error('Evaluation ID is required');
  for (var i = 1; i < values.length; i++) if (normalizeEmail_(values[i][1]) === email) { sheet.getRange(i + 1, 10).setValue('Completed'); sheet.getRange(i + 1, 12, 1, 8).setValues([[Number(payload.technicalProgramming || 0), Number(payload.technicalDataScience || 0), Number(payload.communication || 0), String(payload.readiness || ''), String(payload.exceptional || ''), String(payload.tasks || ''), String(payload.roles || ''), String(payload.detailedFeedback1 || '')]]); return { updated: true, row: i + 1 }; }
  throw new Error('Student not found for ID: ' + email);
}
function getOneOnOneStats_() {
  var values = summarySheet_().getDataRange().getValues(), stats = {};
  for (var i = 1; i < values.length; i++) { var instructor = String(values[i][7] || '').trim(); if (!instructor) continue; if (!stats[instructor]) stats[instructor] = { instructorName: instructor, instructorNumber: instructor, slotsAllocated: 0, slotsWithFeedback: 0, absentees: 0 }; stats[instructor].slotsAllocated++; if (String(values[i][9] || '').trim().toLowerCase() === 'completed') stats[instructor].slotsWithFeedback++; if (String(values[i][14] || '').trim().toLowerCase() === 'absent') stats[instructor].absentees++; }
  return Object.keys(stats).map(function (key) { return stats[key]; });
}
function extractDomain_(slot) { var match = String(slot || '').match(/\(([^)]+)\)$/); return match ? match[1] : ''; }
function normalizeEmail_(value) { return String(value || '').trim().toLowerCase(); }
function parseDateTime_(date, time) { var d = String(date).split('-'), t = String(time).split(':'); if (d.length !== 3 || t.length < 2) throw new Error('Invalid date or time'); return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), Number(t[0]), Number(t[1]), 0); }

function appendAuthorizationEmailsToStudents_(emailInput) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Students');
  if (!sheet) {
    throw new Error('Students sheet not found');
  }

  var emails = normalizeAuthorizationEmails_(emailInput);
  if (emails.length === 0) {
    throw new Error('No valid student emails found in authorization input');
  }

  var nextColumn = sheet.getLastColumn() > 0 ? sheet.getLastColumn() + 1 : 1;
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss');

  sheet.getRange(1, nextColumn).setValue(timestamp);

  var rows = [];
  for (var i = 0; i < emails.length; i++) {
    rows.push([emails[i]]);
  }
  sheet.getRange(2, nextColumn, rows.length, 1).setValues(rows);

  var columnLetter = columnIndexToLetter_(nextColumn);
  PropertiesService.getScriptProperties().setProperty('ACTIVE_STUDENT_COLUMN', columnLetter);

  return {
    authorizationColumn: columnLetter,
    validStudents: emails.length,
    invalidStudents: 0,
    addedStudents: emails.length
  };
}

function normalizeAuthorizationEmails_(emailInput) {
  var text = '';

  if (Array.isArray(emailInput)) {
    text = emailInput.join('\n');
  } else {
    text = String(emailInput || '');
  }

  var tokens = text.split(/[\s,;\n\r\t]+/);
  var seen = {};
  var valid = [];
  var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (var i = 0; i < tokens.length; i++) {
    var email = String(tokens[i] || '').trim().toLowerCase();
    if (!email) continue;
    if (!regex.test(email)) continue;
    if (seen[email]) continue;
    seen[email] = true;
    valid.push(email);
  }

  return valid;
}

function columnIndexToLetter_(columnNumber) {
  var letter = '';
  while (columnNumber > 0) {
    var remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
}

function columnToIndex_(columnLetter) {
  var column = 0;
  var length = columnLetter.length;
  for (var i = 0; i < length; i++) {
    var letter = columnLetter.charAt(i);
    var value = letter.charCodeAt(0) - 64;
    column = column * 26 + value;
  }
  return column - 1;
}

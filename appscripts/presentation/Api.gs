function doGet(e) {
  return handleRequest_(e.parameter || {});
}

function doPost(e) {
  return handleRequest_(parsePayload_(e));
}

function handleRequest_(payload) {
  try {
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'releasePresentationSlots') {
      data = releasePresentationSlots_(payload);
    } else if (action === 'getInstructors') {
      data = getInstructors_();
    } else if (action === 'getUniqueInstructors') {
      data = getUniqueInstructors_();
    } else if (action === 'getPendingEvaluations') {
      data = getPendingEvaluations_(payload);
    } else if (action === 'submitEvaluation') {
      data = submitEvaluation_(payload);
    } else if (action === 'getPresentationStats') {
      data = getPresentationStats_();
    } else if (action === 'checkSlot') {
      data = checkSlot_(payload);
    } else if (action === 'getLastBookingWindow') {
      data = getLastBookingWindow_();
    } else {
      throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse_(true, data, 'OK');
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
}

function doOptions(e) {
  return ContentService.createTextOutput('');
}

function addCorsHeaders_(response) {
  return response;
}

function getInstructors_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Instructors');
  if (!sheet) {
    throw new Error('Instructors sheet not found');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return [];
  }

  var values = sheet.getRange(1, 1, lastRow, 2).getValues();
  var seen = {};
  var instructors = [];

  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    var name = String(values[i][1] || '').trim();
    if (!key || !name) continue;

    var match = key.match(/(\d+)/);
    if (!match) continue;
    var number = String(match[1]);

    if (seen[number]) continue;
    seen[number] = true;

    instructors.push({
      number: number,
      name: name
    });
  }

  instructors.sort(function (a, b) {
    return Number(a.number) - Number(b.number);
  });

  return instructors;
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }

  var contents = e.postData.contents;
  try {
    return JSON.parse(contents);
  } catch (_err) {
    return parseFormEncodedPayload_(contents);
  }
}

function parseFormEncodedPayload_(contents) {
  var params = {};
  var pairs = contents.split('&');

  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i];
    if (!pair) continue;

    var parts = pair.split('=');
    var key = decodeURIComponent(parts[0] || '').trim();
    if (!key) continue;

    var value = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
    params[key] = value;
  }

  return params;
}

function validateApiToken_(payload) {
  var expectedToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');

  // If no token is configured in Script Properties, skip validation to avoid breaking setup.
  if (!expectedToken) {
    return;
  }

  if (!payload || payload.apiToken !== expectedToken) {
    throw new Error('Unauthorized request');
  }
}

function releasePresentationSlots_(payload) {
  var date = String(payload.date || '').trim();
  var startTime = String(payload.startTime || '').trim();
  var endTime = String(payload.endTime || '').trim();
  var durationMinutes = Number(payload.durationMinutes || 0);
  var instructorNumber = String(payload.instructorNumber || '').trim();
  var bookingWindowDate = String(payload.bookingWindowDate || '').trim();
  var bookingWindowStartTime = String(payload.bookingWindowStartTime || '').trim();
  var bookingWindowEndTime = String(payload.bookingWindowEndTime || '').trim();
  var syncToForm = payload.syncToForm !== false;
  var resetFormResponses = payload.resetFormResponses === true;
  var studentAuthorizationColumn = String(payload.studentAuthorizationColumn || '').trim().toUpperCase();
  var studentAuthorizationEmails = payload.studentAuthorizationEmails;

  if (!date || !startTime || !endTime || !durationMinutes || !instructorNumber) {
    throw new Error('Missing slot details');
  }
  if (bookingWindowDate && !bookingWindowStartTime) {
    throw new Error('Booking window start time is required when booking window date is provided');
  }
  if (bookingWindowDate && !bookingWindowEndTime) {
    throw new Error('Booking window end time is required when booking window date is provided');
  }
  if (bookingWindowDate && bookingWindowStartTime && bookingWindowEndTime && bookingWindowEndTime <= bookingWindowStartTime) {
    throw new Error('Booking window end time should be after start time');
  }

  if (bookingWindowDate && bookingWindowStartTime && bookingWindowEndTime) {
    setPresentationBookingWindow_({
      date: bookingWindowDate,
      startTime: bookingWindowStartTime,
      endTime: bookingWindowEndTime
    });
  }

  createSlots(
    date,
    startTime,
    endTime,
    durationMinutes,
    instructorNumber
  );

  var slotsCreated = countCreatedSlots_(date, startTime, endTime, instructorNumber, durationMinutes);

  var validStudents = null;
  var invalidStudents = null;
  var addedStudents = null;

  if (syncToForm && studentAuthorizationEmails) {
    var appendStats = appendAuthorizationEmailsToStudents_(studentAuthorizationEmails);
    studentAuthorizationColumn = appendStats.authorizationColumn;
    validStudents = appendStats.validStudents;
    invalidStudents = appendStats.invalidStudents;
    addedStudents = appendStats.addedStudents;
  }

  if (syncToForm && studentAuthorizationColumn && validStudents === null) {
    var stats = evaluateStudentAuthorizationColumn_(studentAuthorizationColumn);
    if (!stats.ok) {
      throw new Error(stats.error || 'Invalid student authorization column');
    }

    PropertiesService
      .getScriptProperties()
      .setProperty('ACTIVE_STUDENT_COLUMN', studentAuthorizationColumn);

    validStudents = stats.allowed;
    invalidStudents = stats.invalidEmails.length;
    addedStudents = stats.allowed;
  }

  if (syncToForm) {
    if (resetFormResponses) {
      resetFormResponsesForReattempt();
    }
    syncAvailableSlotsToForm();
  }

  return {
    slotsCreated: slotsCreated,
    syncToForm: syncToForm,
    resetFormResponses: resetFormResponses,
    authorizationColumn: studentAuthorizationColumn || '',
    validStudents: validStudents,
    invalidStudents: invalidStudents,
    addedStudents: addedStudents,
    bookingWindowDate: bookingWindowDate,
    bookingWindowStartTime: bookingWindowStartTime,
    bookingWindowEndTime: bookingWindowEndTime
  };
}

function getPrimarySignature_() {
  try {
    var sendAsList = Gmail.Users.Settings.SendAs.list('me').sendAs || [];
    for (var i = 0; i < sendAsList.length; i++) {
      if (sendAsList[i].isPrimary) {
        return sendAsList[i].signature || '';
      }
    }
    return '';
  } catch (_e) {
    return '';
  }
}

function nl2brEscaped_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n|\n|\r/g, '<br>');
}

function applyMailTemplate_(template, replacements) {
  var output = String(template || '');
  for (var key in replacements) {
    if (replacements.hasOwnProperty(key)) {
      output = output.split(key).join(String(replacements[key]));
    }
  }
  return output;
}

function resolveInstructorNameByNumber_(instructorNumber) {
  var normalized = String(instructorNumber || '').trim();
  if (!normalized) {
    return '';
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName('Instructors');
  if (!sheet) {
    return normalized;
  }

  var rows = sheet.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][0] || '').trim();
    var name = String(rows[i][1] || '').trim();
    if (!key || !name) continue;

    var match = key.match(/(\d+)/);
    var number = match ? String(match[1]) : '';
    if (number === normalized) {
      return name;
    }
  }

  return normalized;
}

function countCreatedSlots_(date, startTime, endTime, instructorNumber, durationMinutes) {
  var start = parseDateTime(date, startTime);
  var end = parseDateTime(date, endTime);
  var count = 0;

  while (start < end) {
    var slotEnd = new Date(start.getTime() + durationMinutes * 60000);
    if (slotEnd > end) {
      break;
    }
    count++;
    start = slotEnd;
  }

  return count;
}

function evaluateStudentAuthorizationColumn_(columnLetter) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Students');
  if (!sheet) {
    return {
      ok: false,
      allowed: 0,
      invalidEmails: [],
      error: 'Students sheet not found'
    };
  }

  if (!columnLetter || !columnLetter.match(/^[A-Z]+$/)) {
    return {
      ok: false,
      allowed: 0,
      invalidEmails: [],
      error: 'Invalid column. Use letters only (A, B, C...)'
    };
  }

  var columnIndex = columnToIndex_(columnLetter);
  var data = sheet.getDataRange().getValues();
  var allowed = 0;
  var invalidEmails = [];
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][columnIndex] || '').trim();
    if (!email) continue;

    if (!emailRegex.test(email)) {
      invalidEmails.push(email);
      continue;
    }

    allowed++;
  }

  return {
    ok: true,
    allowed: allowed,
    invalidEmails: invalidEmails
  };
}

function columnToIndex_(letter) {
  var column = 0;
  for (var i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column - 1;
}

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
  PropertiesService
    .getScriptProperties()
    .setProperty('ACTIVE_STUDENT_COLUMN', columnLetter);

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

function getSummarySheet_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Summary');
  if (!sheet) {
    throw new Error('Summary sheet not found');
  }
  return sheet;
}

function getUniqueInstructors_() {
  var sheet = getSummarySheet_();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var seen = {};
  var unique = [];

  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][0] || '').trim();
    if (!name) continue;
    if (seen[name]) continue;
    seen[name] = true;
    unique.push(name);
  }

  unique.sort();
  return unique;
}

function getPendingEvaluations_(payload) {
  var instructorName = String(payload.instructorName || '').trim();
  if (!instructorName) {
    throw new Error('Instructor name is required');
  }

  var sheet = getSummarySheet_();
  var values = sheet.getDataRange().getValues();
  var items = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var id = String(row[0] || '').trim();
    var instructor = String(row[1] || '').trim();
    var slot = String(row[2] || '').trim();
    var name = String(row[3] || '').trim();
    var email = String(row[4] || '').trim();
    var status = String(row[5] || '').trim();

    if (!id) continue;
    if (instructor !== instructorName) continue;
    if (status.toLowerCase() === 'completed') continue;

    items.push({
      id: id,
      instructor: instructor,
      slot: slot,
      name: name,
      email: email,
      status: status || 'Pending',
      contact: String(row[12] || row[13] || '').trim(),
      content: row[6] || null,
      slideComposition: row[7] || null,
      presentation: row[8] || null,
      feedback: String(row[9] || '').trim(),
      total: row[10] || null,
      outOf30: row[11] || null
    });
  }

  return items;
}

function parseScore_(value, label, min, max) {
  var score = Number(value);
  if (!isFinite(score)) {
    throw new Error(label + ' score is required');
  }
  if (score < min || score > max) {
    throw new Error(label + ' score should be between ' + min + ' and ' + max);
  }
  return score;
}

function submitEvaluation_(payload) {
  var id = String(payload.id || '').trim();
  if (!id) {
    throw new Error('Evaluation ID is required');
  }

  var content = parseScore_(payload.content, 'Content', 0, 30);
  var slideComposition = parseScore_(payload.slideComposition, 'Slide Composition & Organization', 0, 35);
  var presentation = parseScore_(payload.presentation, 'Presentation', 0, 35);
  var feedback = String(payload.feedback || '').trim();

  var sheet = getSummarySheet_();
  var values = sheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    throw new Error('Evaluation row not found for ID: ' + id);
  }

  var total = content + slideComposition + presentation;
  var outOf30 = Number((total * 0.3).toFixed(2));

  sheet.getRange(targetRow, 6).setValue('Completed');
  sheet.getRange(targetRow, 7).setValue(content);
  sheet.getRange(targetRow, 8).setValue(slideComposition);
  sheet.getRange(targetRow, 9).setValue(presentation);
  sheet.getRange(targetRow, 10).setValue(feedback);
  sheet.getRange(targetRow, 11).setValue(total);
  sheet.getRange(targetRow, 12).setValue(outOf30);

  return { updated: true };
}

function getOrCreateMailLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Mail Log');
  
  if (!sheet) {
    sheet = ss.insertSheet('Mail Log');
    var headers = ['timestamp', 'recipient_email', 'status', 'error', 'slots_created', 'instructor', 'date'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  
  return sheet;
}

function ensureMailLogSheetReady_() {
  try {
    getOrCreateMailLogSheet_();
    return { ok: true, error: '' };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

function logMailSend_(recipient, status, error, context) {
  try {
    var sheet = getOrCreateMailLogSheet_();
    var now = new Date().toISOString();
    var nextRow = sheet.getLastRow() + 1;
    
    sheet.getRange(nextRow, 1, 1, 7).setValues([[
      now,
      recipient,
      status,
      error || '',
      String(context.slotsCreated || ''),
      String(context.instructorNumber || ''),
      String(context.date || '')
    ]]);
  } catch (_err) {
    // Silently log to system logger if sheet write fails
    Logger.log('[logMailSend_] Failed to write log: %s', _err && _err.message ? _err.message : String(_err));
  }
}

function jsonResponse_(success, data, message, error) {
  var payload = {
    success: success,
    message: message || '',
    data: data || null
  };

  if (!success) {
    payload.error = error || 'Request failed';
  }

  var response = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
  
  return addCorsHeaders_(response);
}

function getPresentationStats_() {
  var sheet = getSummarySheet_();
  if (!sheet) {
    throw new Error('Summary sheet not found');
  }

  var values = sheet.getDataRange().getValues();
  var statsMap = {};

  // Iterate through all rows (skip header at index 0)
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var instructorName = String(row[1] || '').trim(); // Column B
    var instructorNumber = String(row[1] || '').trim(); // For now, using name as number
    var feedback = String(row[9] || '').trim(); // Column J - feedback field
    var status = String(row[5] || '').trim(); // Column F - status

    if (!instructorName) continue;

    // Initialize stats object for this instructor if not exists
    if (!statsMap[instructorName]) {
      statsMap[instructorName] = {
        instructorName: instructorName,
        instructorNumber: instructorNumber, // Will be extracted from slot if available
        slotsAllocated: 0,
        slotsWithFeedback: 0,
        absentees: 0
      };
    }

    // Count slot allocated
    statsMap[instructorName].slotsAllocated++;

    // Count slots with feedback (non-empty feedback)
    if (feedback && feedback.toLowerCase() !== '') {
      statsMap[instructorName].slotsWithFeedback++;

      // Count absentees (feedback == "Absent")
      if (feedback.toLowerCase() === 'absent') {
        statsMap[instructorName].absentees++;
      }
    }
  }

  // Convert map to array and sort
  var result = [];
  for (var key in statsMap) {
    if (statsMap.hasOwnProperty(key)) {
      result.push(statsMap[key]);
    }
  }

  result.sort(function(a, b) {
    return (a.instructorName || '').localeCompare(b.instructorName || '');
  });

  return result;
}

function checkSlot_(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var assessmentType = String(payload.assessmentType || '').trim().toLowerCase();

  if (!email) {
    throw new Error('Email is required');
  }

  if (assessmentType !== 'behavioral' && assessmentType !== 'presentation') {
    throw new Error('Invalid assessment type');
  }

  var sheet = getSummarySheet_();
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowEmail = String(row[4] || '').trim().toLowerCase();

    if (rowEmail === email) {
      return {
        found: true,
        email: email,
        name: String(row[3] || '').trim(),
        instructor: String(row[1] || '').trim(),
        slot: String(row[2] || '').trim(),
        status: String(row[5] || '').trim()
      };
    }
  }

  return {
    found: false,
    email: email,
    message: 'No slot found for this email'
  };
}

function setPresentationBookingWindow_(windowConfig) {
  PropertiesService
    .getScriptProperties()
    .setProperties({
      PRESENTATION_BOOKING_WINDOW_DATE: String(windowConfig.date || '').trim(),
      PRESENTATION_BOOKING_WINDOW_START_TIME: String(windowConfig.startTime || '').trim(),
      PRESENTATION_BOOKING_WINDOW_END_TIME: String(windowConfig.endTime || '').trim()
    }, true);
}

function getPresentationBookingWindow_() {
  var props = PropertiesService.getScriptProperties();
  return {
    date: String(props.getProperty('PRESENTATION_BOOKING_WINDOW_DATE') || '').trim(),
    startTime: String(props.getProperty('PRESENTATION_BOOKING_WINDOW_START_TIME') || '').trim(),
    endTime: String(props.getProperty('PRESENTATION_BOOKING_WINDOW_END_TIME') || '').trim()
  };
}

function getLastBookingWindow_() {
  return getPresentationBookingWindow_();
}

// Run once from Apps Script editor (Run button) to grant mail + spreadsheet scopes.
function authorizePresentationMail_() {
  SpreadsheetApp.getActiveSpreadsheet().getId();
  GmailApp.getAliases();
  Gmail.Users.Settings.SendAs.list('me');
  return 'Authorization successful';
}

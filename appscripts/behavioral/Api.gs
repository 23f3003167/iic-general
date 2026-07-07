function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'releaseBehaviouralSlots' || action === 'releaseBehavioralSlots') {
      data = releaseBehaviouralSlots_(payload);
    } else if (action === 'getInstructors') {
      data = getInstructors_();
    } else if (action === 'getUniqueInstructors') {
      data = getUniqueInstructors_();
    } else if (action === 'getBehavioralStats') {
      data = getBehavioralStats_();
    } else if (action === 'getPendingEvaluations') {
      data = getPendingEvaluations_(payload);
    } else if (action === 'submitEvaluation') {
      data = submitEvaluation_(payload);
    } else if (action === 'checkSlot') {
      data = checkSlot_(payload);
    } else if (action === 'verifyBehavioralStudent') {
      data = verifyBehavioralStudent_(payload);
    } else if (action === 'getBehavioralBookableSlots') {
      data = getBehavioralBookableSlots_(payload);
    } else if (action === 'bookBehavioralSlot') {
      data = bookBehavioralSlot_(payload);
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

  try {
    return JSON.parse(e.postData.contents);
  } catch (_err) {
    throw new Error('Invalid JSON body');
  }
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

function releaseBehaviouralSlots_(payload) {
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
  if (!bookingWindowDate || !bookingWindowStartTime || !bookingWindowEndTime) {
    throw new Error('Booking window date and time are required');
  }
  if (bookingWindowEndTime <= bookingWindowStartTime) {
    throw new Error('Booking window end time should be after start time');
  }

  setBehavioralBookingWindow_({
    date: bookingWindowDate,
    startTime: bookingWindowStartTime,
    endTime: bookingWindowEndTime
  });

  var slotsCreated = createSlots(
    date,
    startTime,
    endTime,
    durationMinutes,
    instructorNumber
  );

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
    var stats = evaluateStudentAuthorizationColumn(studentAuthorizationColumn);
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

function getBehavioralStats_() {
  var sheet = getSummarySheet_();
  var values = sheet.getDataRange().getValues();
  var statsMap = {};

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var instructorName = String(row[1] || '').trim();
    var instructorNumber = String(row[1] || '').trim();
    var status = String(row[5] || '').trim().toLowerCase();

    if (!instructorName) continue;

    if (!statsMap[instructorName]) {
      statsMap[instructorName] = {
        instructorName: instructorName,
        instructorNumber: instructorNumber,
        slotsAllocated: 0,
        slotsWithFeedback: 0,
        absentees: 0,
      };
    }

    statsMap[instructorName].slotsAllocated++;

    if (status === 'completed') {
      statsMap[instructorName].slotsWithFeedback++;
    }

    if (status === 'absent') {
      statsMap[instructorName].absentees++;
    }
  }

  var result = [];
  for (var key in statsMap) {
    if (Object.prototype.hasOwnProperty.call(statsMap, key)) {
      result.push(statsMap[key]);
    }
  }

  result.sort(function (a, b) {
    return String(a.instructorName || '').localeCompare(String(b.instructorName || ''));
  });

  return result;
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
      contact: String(row[13] || '').trim(),
      status: status || 'Pending',
      relevance: row[6] || null,
      clarity: row[7] || null,
      analyticalSkills: row[8] || null,
      grammar: row[9] || null,
      feedback: String(row[12] || '').trim(),
      total: row[10] || null,
      outOf20: row[11] || null
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

  var relevance = parseScore_(payload.relevance, 'Relevance', 0, 20);
  var clarity = parseScore_(payload.clarity, 'Clarity', 0, 30);
  var analyticalSkills = parseScore_(payload.analyticalSkills, 'Analytical/Problem-Solving Skills', 0, 25);
  var grammar = parseScore_(payload.grammar, 'Grammar', 0, 25);
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

  var total = relevance + clarity + analyticalSkills + grammar;
  var outOf20 = Number((total / 5).toFixed(2));

  sheet.getRange(targetRow, 6).setValue('Completed');
  sheet.getRange(targetRow, 7).setValue(relevance);
  sheet.getRange(targetRow, 8).setValue(clarity);
  sheet.getRange(targetRow, 9).setValue(analyticalSkills);
  sheet.getRange(targetRow, 10).setValue(grammar);
  sheet.getRange(targetRow, 11).setValue(total);
  sheet.getRange(targetRow, 12).setValue(outOf20);
  sheet.getRange(targetRow, 13).setValue(feedback);

  return { updated: true };
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

  var bookedSheet = getBookedSlotsSheet_(false);
  if (bookedSheet) {
    var bookedData = bookedSheet.getDataRange().getValues();
    for (var b = 1; b < bookedData.length; b++) {
      var bookedRow = bookedData[b];
      var bookedEmail = normalizeEmail_(bookedRow[2]);
      if (bookedEmail !== email) {
        continue;
      }

      return {
        found: true,
        email: email,
        name: String(bookedRow[1] || '').trim(),
        slot: String(bookedRow[4] || '').trim(),
        status: String(bookedRow[6] || '').trim() || 'Booked',
        source: 'booked-slots'
      };
    }
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

function verifyBehavioralStudent_(payload) {
  assertBookingWindowOpen_();

  var email = normalizeEmail_(payload.email);
  if (!email) {
    throw new Error('Email is required');
  }

  var eligibility = getStudentEligibility_(email);
  var existingBooking = findExistingBookedSlotByEmail_(email);

  return {
    verified: eligibility.authorized,
    email: email,
    alreadyBooked: !!existingBooking,
    booking: existingBooking
      ? {
        timestamp: existingBooking.timestamp,
        name: existingBooking.name,
        email: existingBooking.email,
        contact: existingBooking.contact,
        slot: existingBooking.slot,
        status: existingBooking.status
      }
      : null
  };
}

function getBehavioralBookableSlots_(payload) {
  assertBookingWindowOpen_();

  var email = normalizeEmail_(payload.email);
  if (!email) {
    throw new Error('Email is required');
  }

  var eligibility = getStudentEligibility_(email);
  if (!eligibility.authorized) {
    return {
      email: email,
      verified: false,
      slots: []
    };
  }

  if (findExistingBookedSlotByEmail_(email)) {
    return {
      email: email,
      verified: true,
      slots: []
    };
  }

  var slotSheet = getSlotSheet_();
  var values = slotSheet.getDataRange().getValues();
  var slots = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var slotText = String(row[0] || '').trim();
    var seatRemaining = Number(row[2] || 0);
    var evaluatorEmail = String(row[4] || '').trim();
    if (!slotText || seatRemaining <= 0) {
      continue;
    }

    slots.push({
      slot: slotText,
      seatRemaining: seatRemaining,
      evaluatorEmail: evaluatorEmail
    });
  }

  return {
    email: email,
    verified: true,
    slots: slots
  };
}

function bookBehavioralSlot_(payload) {
  assertBookingWindowOpen_();

  var email = normalizeEmail_(payload.email);
  var name = String(payload.name || '').trim();
  var contact = String(payload.contact || '').trim();
  var slot = String(payload.slot || '').trim();
  var bookingId = String(payload.bookingId || payload.idempotencyKey || '').trim();

  if (!email) {
    throw new Error('Email is required');
  }
  if (!name) {
    throw new Error('Name is required');
  }
  if (!contact) {
    throw new Error('Contact is required');
  }
  if (!slot) {
    throw new Error('Slot is required');
  }
  if (!bookingId) {
    throw new Error('bookingId is required');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var eligibility = getStudentEligibility_(email);
    if (!eligibility.authorized) {
      throw new Error('This email is not authorized to book a behavioral slot.');
    }

    var bookedSheet = getBookedSlotsSheet_(true);
    ensureBookedSlotsHeader_(bookedSheet);

    var existingByBookingId = findExistingBookedSlotByBookingId_(bookingId);
    if (existingByBookingId) {
      return {
        success: true,
        alreadyProcessed: true,
        timestamp: existingByBookingId.timestamp,
        name: existingByBookingId.name,
        email: existingByBookingId.email,
        contact: existingByBookingId.contact,
        slot: existingByBookingId.slot,
        status: existingByBookingId.status,
        bookingId: existingByBookingId.bookingId
      };
    }

    var existingByEmail = findExistingBookedSlotByEmail_(email);
    if (existingByEmail) {
      if (existingByEmail.slot === slot) {
        return {
          success: true,
          alreadyProcessed: true,
          timestamp: existingByEmail.timestamp,
          name: existingByEmail.name,
          email: existingByEmail.email,
          contact: existingByEmail.contact,
          slot: existingByEmail.slot,
          status: existingByEmail.status,
          bookingId: existingByEmail.bookingId
        };
      }
      throw new Error('This email already has a booked slot.');
    }

    var slotSheet = getSlotSheet_();
    var slotValues = slotSheet.getDataRange().getValues();
    var slotRowIndex = -1;

    for (var i = 1; i < slotValues.length; i++) {
      if (String(slotValues[i][0] || '').trim() === slot) {
        slotRowIndex = i;
        break;
      }
    }

    if (slotRowIndex < 0) {
      throw new Error('Selected slot is no longer available.');
    }

    var rowValues = slotValues[slotRowIndex];
    var seatTaken = Number(rowValues[1] || 0);
    var seatRemaining = Number(rowValues[2] || 0);
    var evaluatorEmail = normalizeEmail_(rowValues[4]);

    if (seatRemaining <= 0) {
      throw new Error('Selected slot is already booked.');
    }

    slotSheet.getRange(slotRowIndex + 1, 2).setValue(seatTaken + 1);
    slotSheet.getRange(slotRowIndex + 1, 3).setValue(seatRemaining - 1);

    try {
      if (evaluatorEmail) {
        handleEvaluatorSession(
          slotValues,
          slotSheet,
          slotRowIndex,
          email,
          evaluatorEmail
        );
      }
    } catch (calendarError) {
      slotSheet.getRange(slotRowIndex + 1, 2).setValue(seatTaken);
      slotSheet.getRange(slotRowIndex + 1, 3).setValue(seatRemaining);
      throw calendarError;
    }

    var timestamp = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy hh:mm:ss a');
    bookedSheet.appendRow([
      timestamp,
      name,
      email,
      contact,
      slot,
      bookingId,
      'Booked'
    ]);

    return {
      success: true,
      alreadyProcessed: false,
      timestamp: timestamp,
      name: name,
      email: email,
      contact: contact,
      slot: slot,
      status: 'Booked',
      bookingId: bookingId
    };
  } finally {
    lock.releaseLock();
  }
}

function getSlotSheet_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Slot');
  if (!sheet) {
    throw new Error('Slot sheet not found');
  }
  return sheet;
}

function getBookedSlotsSheet_(createIfMissing) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Booked Slots');
  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet('Booked Slots');
  }
  return sheet;
}

function ensureBookedSlotsHeader_(sheet) {
  if (!sheet) {
    throw new Error('Booked Slots sheet not found');
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp',
      'Name',
      'Email ID',
      'Contact',
      'Slots (Timing in IST)',
      'Booking ID',
      'Status'
    ]);
  }
}

function getStudentEligibility_(email) {
  return {
    authorized: isAuthorizedStudent(email)
  };
}

function setBehavioralBookingWindow_(windowConfig) {
  PropertiesService
    .getScriptProperties()
    .setProperties({
      BEHAVIORAL_BOOKING_WINDOW_DATE: String(windowConfig.date || '').trim(),
      BEHAVIORAL_BOOKING_WINDOW_START_TIME: String(windowConfig.startTime || '').trim(),
      BEHAVIORAL_BOOKING_WINDOW_END_TIME: String(windowConfig.endTime || '').trim()
    }, true);
}

function getBehavioralBookingWindow_() {
  var props = PropertiesService.getScriptProperties();
  return {
    date: String(props.getProperty('BEHAVIORAL_BOOKING_WINDOW_DATE') || '').trim(),
    startTime: String(props.getProperty('BEHAVIORAL_BOOKING_WINDOW_START_TIME') || '').trim(),
    endTime: String(props.getProperty('BEHAVIORAL_BOOKING_WINDOW_END_TIME') || '').trim()
  };
}

function getLastBookingWindow_() {
  return getBehavioralBookingWindow_();
}

function assertBookingWindowOpen_() {
  var windowConfig = getBehavioralBookingWindow_();
  if (!windowConfig.date || !windowConfig.startTime || !windowConfig.endTime) {
    throw new Error('Slot booking window is currently closed.');
  }

  var parts = windowConfig.date.split('/');
  if (parts.length !== 3) {
    throw new Error('Slot booking window is currently closed.');
  }

  var day = Number(parts[0]);
  var month = Number(parts[1]) - 1;
  var year = Number(parts[2]);
  var startParts = windowConfig.startTime.split(':');
  var endParts = windowConfig.endTime.split(':');
  if (startParts.length !== 2 || endParts.length !== 2) {
    throw new Error('Slot booking window is currently closed.');
  }

  var startAt = new Date(
    year,
    month,
    day,
    Number(startParts[0]),
    Number(startParts[1]),
    0,
    0
  );
  var endAt = new Date(
    year,
    month,
    day,
    Number(endParts[0]),
    Number(endParts[1]),
    59,
    999
  );
  var now = new Date();

  if (now < startAt || now > endAt) {
    throw new Error('Slot booking window is currently closed.');
  }
}

function findExistingBookedSlotByEmail_(email) {
  var sheet = getBookedSlotsSheet_(false);
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowEmail = normalizeEmail_(row[2]);
    var status = String(row[6] || '').trim();
    if (rowEmail === email && status !== 'Cancelled') {
      return {
        rowIndex: i + 1,
        timestamp: String(row[0] || '').trim(),
        name: String(row[1] || '').trim(),
        email: rowEmail,
        contact: String(row[3] || '').trim(),
        slot: String(row[4] || '').trim(),
        bookingId: String(row[5] || '').trim(),
        status: status || 'Booked'
      };
    }
  }

  return null;
}

function findExistingBookedSlotByBookingId_(bookingId) {
  var sheet = getBookedSlotsSheet_(false);
  if (!sheet || sheet.getLastRow() < 2 || !bookingId) {
    return null;
  }

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[5] || '').trim() !== bookingId) {
      continue;
    }

    return {
      rowIndex: i + 1,
      timestamp: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(),
      email: normalizeEmail_(row[2]),
      contact: String(row[3] || '').trim(),
      slot: String(row[4] || '').trim(),
      bookingId: String(row[5] || '').trim(),
      status: String(row[6] || '').trim() || 'Booked'
    };
  }

  return null;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
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

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

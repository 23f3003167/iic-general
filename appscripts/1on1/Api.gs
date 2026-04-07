function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'getInstructors') {
      data = getInstructors_();
    } else if (action === 'releaseOneOnOneSlots') {
      data = releaseOneOnOneSlots_(payload);
    } else if (action === 'getUniqueInstructors') {
      data = getUniqueInstructors_();
    } else if (action === 'getPendingEvaluations') {
      data = getPendingEvaluations_(payload);
    } else if (action === 'submitEvaluation') {
      data = submitEvaluation_(payload);
    } else {
      throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse_(true, data, 'OK');
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
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

  if (!expectedToken) {
    return;
  }

  if (!payload || payload.apiToken !== expectedToken) {
    throw new Error('Unauthorized request');
  }
}

function jsonResponse_(success, data, message, error) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: success,
      data: data,
      message: message || '',
      error: error || ''
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getInstructors_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Instructors');
  if (!sheet) {
    throw new Error('Instructors sheet not found');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var instructors = [];

  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][0] || '').trim();
    var email = String(values[i][1] || '').trim();
    if (!name || !email) continue;

    instructors.push({
      number: email,
      name: name
    });
  }

  return instructors;
}

function releaseOneOnOneSlots_(payload) {
  var date = String(payload.date || '').trim();
  var startTime = String(payload.startTime || '').trim();
  var endTime = String(payload.endTime || '').trim();
  var durationMinutes = Number(payload.durationMinutes || 30);
  var instructorEmail = String(payload.instructorNumber || '').trim();
  var domain = String(payload.domain || '').trim();
  var syncToForm = payload.syncToForm !== false;

  if (!date || !startTime || !endTime || !instructorEmail || !domain) {
    throw new Error('Missing slot details');
  }

  if (durationMinutes <= 0) {
    throw new Error('Invalid duration');
  }

  var slotsCreated = createOneOnOneSlots_(date, startTime, endTime, durationMinutes, instructorEmail, domain);

  if (syncToForm && typeof syncAvailableSlotsToForm === 'function') {
    syncAvailableSlotsToForm();
  }

  return {
    slotsCreated: slotsCreated,
    syncToForm: syncToForm
  };
}

function createOneOnOneSlots_(date, startTime, endTime, durationMinutes, instructorEmail, domain) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Slot');
  if (!sheet) {
    throw new Error('Slot sheet not found');
  }

  var start = parseDateTimeFlexible_(date, startTime);
  var end = parseDateTimeFlexible_(date, endTime);

  if (!(start instanceof Date) || isNaN(start.getTime())) {
    throw new Error('Invalid start date/time');
  }
  if (!(end instanceof Date) || isNaN(end.getTime())) {
    throw new Error('Invalid end date/time');
  }
  if (end <= start) {
    throw new Error('End time should be after start time');
  }

  var rows = [];
  var cursor = new Date(start.getTime());

  while (cursor < end) {
    var slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
    if (slotEnd > end) {
      break;
    }

    var day = Utilities.formatDate(cursor, 'Asia/Kolkata', 'EEEE');
    var slotText =
      Utilities.formatDate(cursor, 'Asia/Kolkata', 'dd/MM/yyyy') +
      ' ' + day + ' ' +
      Utilities.formatDate(cursor, 'Asia/Kolkata', 'hh:mm a') +
      ' - ' +
      Utilities.formatDate(slotEnd, 'Asia/Kolkata', 'hh:mm a') +
      ' (' + domain + ')';

    rows.push([
      slotText,
      0,
      1,
      1,
      instructorEmail
    ]);

    cursor = slotEnd;
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }

  return rows.length;
}

function parseDateTimeFlexible_(dateText, timeText) {
  var dateParts;
  if (dateText.indexOf('-') > -1) {
    dateParts = dateText.split('-');
    return new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2]),
      parseTimeTo24h_(timeText).hour,
      parseTimeTo24h_(timeText).minute,
      0
    );
  }

  dateParts = dateText.split('/');
  return new Date(
    Number(dateParts[2]),
    Number(dateParts[1]) - 1,
    Number(dateParts[0]),
    parseTimeTo24h_(timeText).hour,
    parseTimeTo24h_(timeText).minute,
    0
  );
}

function parseTimeTo24h_(timeText) {
  var normalized = String(timeText || '').trim();
  if (!normalized) {
    throw new Error('Time is required');
  }

  if (/^\d{2}:\d{2}$/.test(normalized)) {
    var parts24 = normalized.split(':');
    return {
      hour: Number(parts24[0]),
      minute: Number(parts24[1])
    };
  }

  var match = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) {
    throw new Error('Invalid time format: ' + normalized);
  }

  var hour = Number(match[1]);
  var minute = Number(match[2]);
  var period = String(match[3]).toUpperCase();

  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  return { hour: hour, minute: minute };
}

function getStudentDetailsSheet_() {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName('Student Details') || ss.getSheetByName('Student_Details');
}

function getFeedbackSheet_() {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName('Feedback Sheet') || ss.getSheetByName('Feedback_Sheet');
}

function getUniqueInstructors_() {
  var sheet = getStudentDetailsSheet_();
  if (!sheet) {
    throw new Error('Student Details sheet not found');
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var seen = {};
  var unique = [];

  for (var i = 1; i < values.length; i++) {
    var name = String(values[i][4] || '').trim();
    var placementReadiness = String(values[i][10] || '').trim();
    if (!name) continue;
    if (placementReadiness) continue;
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

  var studentSheet = getStudentDetailsSheet_();
  var feedbackSheet = getFeedbackSheet_();

  if (!studentSheet) {
    throw new Error('Student Details sheet not found');
  }
  if (!feedbackSheet) {
    throw new Error('Feedback sheet not found');
  }

  var studentRows = studentSheet.getDataRange().getValues();
  var feedbackRows = feedbackSheet.getDataRange().getValues();

  var feedbackByEmail = {};
  for (var i = 1; i < feedbackRows.length; i++) {
    var key = String(feedbackRows[i][0] || '').trim().toLowerCase();
    if (!key) continue;
    feedbackByEmail[key] = feedbackRows[i];
  }

  var items = [];
  for (var r = 1; r < studentRows.length; r++) {
    var row = studentRows[r];

    var email = String(row[0] || '').trim();
    var name = String(row[1] || '').trim();
    var date = String(row[2] || '').trim();
    var slotTime = String(row[3] || '').trim();
    var instructor = String(row[4] || '').trim();
    var cgpa = String(row[5] || '').trim();
    var domain = String(row[6] || '').trim();
    var plan = String(row[7] || '').trim();
    var resumeUrl = String(row[8] || '').trim();
    var progressCard = String(row[9] || '').trim();
    var placementReadiness = String(row[10] || '').trim();

    if (!email || !instructor) continue;
    if (instructor.toLowerCase() !== instructorName.toLowerCase()) continue;
    if (placementReadiness !== '') continue;

    var feedback = feedbackByEmail[email.toLowerCase()] || [];

    items.push({
      id: email,
      instructor: instructor,
      slot: slotTime,
      name: name,
      email: email,
      status: 'Pending',
      studentDate: date,
      slotTime: slotTime,
      cgpa: cgpa,
      domain: domain,
      plan: plan,
      resumeUrl: resumeUrl,
      progressCard: progressCard,
      placementReadiness: '',
      technicalProgramming: feedback[6] || '',
      technicalDataScience: feedback[7] || '',
      communication: feedback[8] || '',
      readiness: String(feedback[9] || '').trim(),
      exceptional: String(feedback[10] || '').trim(),
      tasks: String(feedback[11] || '').trim(),
      roles: String(feedback[12] || '').trim(),
      detailedFeedback1: String(feedback[13] || '').trim()
    });
  }

  return items;
}

function parseRating_(value, label) {
  var num = Number(value);
  if (!isFinite(num)) {
    throw new Error(label + ' is required');
  }
  if (num < 0 || num > 5) {
    throw new Error(label + ' should be between 0 and 5');
  }
  return num;
}

function submitEvaluation_(payload) {
  var id = String(payload.id || '').trim();
  if (!id) {
    throw new Error('Evaluation ID is required');
  }

  var studentSheet = getStudentDetailsSheet_();
  var feedbackSheet = getFeedbackSheet_();

  if (!studentSheet) {
    throw new Error('Student Details sheet not found');
  }
  if (!feedbackSheet) {
    throw new Error('Feedback sheet not found');
  }

  var studentRows = studentSheet.getDataRange().getValues();
  var student = null;

  for (var i = 1; i < studentRows.length; i++) {
    if (String(studentRows[i][0] || '').trim().toLowerCase() === id.toLowerCase()) {
      student = studentRows[i];
      break;
    }
  }

  if (!student) {
    throw new Error('Student not found for ID: ' + id);
  }

  var technicalProgramming = parseRating_(payload.technicalProgramming, 'Technical programming score');
  var technicalDataScience = parseRating_(payload.technicalDataScience, 'Technical data science score');
  var communication = parseRating_(payload.communication, 'Communication score');

  var values = feedbackSheet.getDataRange().getValues();
  var targetRow = -1;

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() === id.toLowerCase()) {
      targetRow = r + 1;
      break;
    }
  }

  if (targetRow === -1) {
    targetRow = feedbackSheet.getLastRow() + 1;
  }

  var output = [
    id,
    String(student[1] || '').trim(),
    String(student[7] || '').trim(),
    String(student[6] || '').trim(),
    String(student[4] || '').trim(),
    '',
    technicalProgramming,
    technicalDataScience,
    communication,
    String(payload.readiness || '').trim(),
    String(payload.exceptional || '').trim(),
    String(payload.tasks || '').trim(),
    String(payload.roles || '').trim(),
    String(payload.detailedFeedback1 || '').trim(),
    '',
    ''
  ];

  feedbackSheet.getRange(targetRow, 1, 1, output.length).setValues([output]);

  return {
    updated: true,
    row: targetRow
  };
}

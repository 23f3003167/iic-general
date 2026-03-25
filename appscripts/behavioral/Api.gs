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
  var syncToForm = payload.syncToForm !== false;
  var resetFormResponses = payload.resetFormResponses === true;
  var studentAuthorizationColumn = String(payload.studentAuthorizationColumn || '').trim().toUpperCase();
  var studentAuthorizationEmails = payload.studentAuthorizationEmails;

  if (!date || !startTime || !endTime || !durationMinutes || !instructorNumber) {
    throw new Error('Missing slot details');
  }

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
    addedStudents: addedStudents
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
  var header = 'Authorized ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm');

  sheet.getRange(1, nextColumn).setValue(header);

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

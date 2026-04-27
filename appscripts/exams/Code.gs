var EXAM_HEADERS = [
  'exam_id',
  'title',
  'description',
  'status',
  'start_at',
  'end_at',
  'duration_minutes',
  'questions_json',
  'eligible_column',
  'eligible_count',
  'created_at',
  'updated_at'
];

var STUDENTS_SHEET_NAME = 'Students';
var EXAMS_SHEET_NAME = 'Exams';
var ATTEMPTED_SHEET_NAME = 'Attempted';
var QUESTIONS_SHEET_NAME = 'Questions';

var ATTEMPT_HEADERS = [
  'attempt_id',
  'exam_id',
  'exam_title',
  'entered_email',
  'eligible',
  'tab_switch_count',
  'score',
  'start_at',
  'end_at',
  'submitted_at',
  'duration_minutes',
  'exam_status',
  'last_updated_at'
];

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
      message: message || '',
      error: error || '',
      data: data || null
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  var spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('EXAMS_SPREADSHEET_ID') || '').trim();
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  throw new Error('Could not resolve exams spreadsheet');
}

function getSheetByNameOrCreate_(sheetName, headers) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getExamsSheet_() {
  return getSheetByNameOrCreate_(EXAMS_SHEET_NAME, EXAM_HEADERS);
}

function getAttemptedSheet_() {
  return getSheetByNameOrCreate_(ATTEMPTED_SHEET_NAME, ATTEMPT_HEADERS);
}

function getStudentsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(STUDENTS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Students sheet not found');
  }
  return sheet;
}

function getQuestionsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(QUESTIONS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Questions sheet not found');
  }
  return sheet;
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

function getQuestionsForTestId_(testId) {
  var normalizedTestId = String(testId || '').trim();
  if (!normalizedTestId) {
    return [];
  }

  var sheet = getQuestionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var items = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowTestId = String(row[0] || '').trim();
    if (!rowTestId || rowTestId !== normalizedTestId) {
      continue;
    }

    var questionNumber = Number(row[1]);
    var prompt = String(row[2] || '').trim();
    var optionA = String(row[3] || '').trim();
    var optionB = String(row[4] || '').trim();
    var optionC = String(row[5] || '').trim();
    var optionD = String(row[6] || '').trim();
    var correctOptionRaw = String(row[7] || '').trim();
    var weight = Number(row[8] || 1);

    if (!prompt) {
      throw new Error('Questions sheet row ' + (i + 2) + ' has empty question text');
    }

    var options = [optionA, optionB, optionC, optionD];
    for (var j = 0; j < options.length; j++) {
      if (!options[j]) {
        throw new Error('Questions sheet row ' + (i + 2) + ' has empty option in column ' + String.fromCharCode(68 + j));
      }
    }

    var answerIndex = mapCorrectOptionToIndex_(correctOptionRaw);
    if (answerIndex < 0 || answerIndex > 3) {
      throw new Error('Questions sheet row ' + (i + 2) + ' has invalid correct option in column H');
    }

    items.push({
      order: Number.isNaN(questionNumber) ? 999999 : questionNumber,
      row: i,
      question: {
        prompt: prompt,
        options: options,
        answerIndex: answerIndex,
        weight: Number.isNaN(weight) || weight <= 0 ? 1 : weight
      }
    });
  }

  items.sort(function (a, b) {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.row - b.row;
  });

  var questions = [];
  for (var k = 0; k < items.length; k++) {
    questions.push(items[k].question);
  }

  return questions;
}

function mapCorrectOptionToIndex_(correctOptionRaw) {
  var raw = String(correctOptionRaw || '').trim().toUpperCase();
  if (!raw) {
    return -1;
  }

  if (raw === 'A' || raw === '1') return 0;
  if (raw === 'B' || raw === '2') return 1;
  if (raw === 'C' || raw === '3') return 2;
  if (raw === 'D' || raw === '4') return 3;

  if (raw.indexOf('OPTION') === 0) {
    var suffix = raw.replace('OPTION', '').trim();
    return mapCorrectOptionToIndex_(suffix);
  }

  return -1;
}

function rowToExam_(row) {
  if (!row || !row.length) {
    return null;
  }

  var examId = String(row[0] || '').trim();
  if (!examId) {
    return null;
  }

  var questions = [];
  try {
    questions = JSON.parse(String(row[7] || '[]'));
  } catch (_err) {
    questions = [];
  }

  var eligibleEmails = [];
  try {
    eligibleEmails = getEligibleEmailsFromColumn_(String(row[8] || '').trim());
  } catch (_err2) {
    eligibleEmails = [];
  }

  var configuredStatus = String(row[3] || 'DRAFT');
  var computedStatus = deriveExamStatus_(configuredStatus, String(row[4] || ''), String(row[5] || ''));

  return {
    id: examId,
    examId: examId,
    title: String(row[1] || ''),
    description: String(row[2] || ''),
    status: computedStatus,
    configuredStatus: configuredStatus,
    startAt: String(row[4] || ''),
    endAt: String(row[5] || ''),
    durationMinutes: Number(row[6] || 0),
    questions: questions,
    eligibleEmails: eligibleEmails,
    eligibleColumn: String(row[8] || ''),
    eligibleCount: Number(row[9] || eligibleEmails.length || 0),
    createdAt: String(row[10] || ''),
    updatedAt: String(row[11] || '')
  };
}

function deriveExamStatus_(configuredStatus, startAt, endAt) {
  var status = String(configuredStatus || 'DRAFT').trim().toUpperCase();
  if (status === 'DRAFT') {
    return 'DRAFT';
  }

  var start = new Date(startAt);
  var end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return status || 'UPCOMING';
  }

  var now = new Date();
  if (now < start) {
    return 'UPCOMING';
  }
  if (now > end) {
    return 'CLOSED';
  }
  return 'OPEN';
}

function getEligibleEmailsFromColumn_(columnRef) {
  if (!columnRef) {
    return [];
  }

  var sheet = getStudentsSheet_();
  var column = resolveColumnIndex_(sheet, columnRef);
  if (column < 1) {
    return [];
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  var values = sheet.getRange(2, column, lastRow - 1, 1).getValues();
  var emails = [];
  for (var i = 0; i < values.length; i++) {
    var email = String(values[i][0] || '').trim().toLowerCase();
    if (email) {
      emails.push(email);
    }
  }
  return emails;
}

function resolveColumnIndex_(sheet, ref) {
  var text = String(ref || '').trim();
  if (!text) {
    return -1;
  }

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  var value = 0;
  var upper = text.toUpperCase();
  for (var i = 0; i < upper.length; i++) {
    value = (value * 26) + (upper.charCodeAt(i) - 64);
  }
  return value;
}

function findExamRow_(sheet, examId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { rowIndex: -1, exam: null };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === examId) {
      return { rowIndex: i + 2, exam: rowToExam_(values[i]) };
    }
  }

  return { rowIndex: -1, exam: null };
}

function findAttemptRow_(sheet, attemptId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === attemptId) {
      return i + 2;
    }
  }

  return -1;
}

function writeEligibleStudents_(examId, title, eligibleEmails, existingColumnRef) {
  var sheet = getStudentsSheet_();
  var column = existingColumnRef ? resolveColumnIndex_(sheet, existingColumnRef) : findFirstBlankColumn_(sheet);
  if (column < 1) {
    column = sheet.getLastColumn() + 1;
  }

  sheet.getRange(1, column).setValue(examId + ' | ' + title);

  if (eligibleEmails.length === 0) {
    return columnIndexToLetter_(column);
  }

  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, column, sheet.getMaxRows() - 1, 1).clearContent();
  }

  var rows = [];
  for (var i = 0; i < eligibleEmails.length; i++) {
    rows.push([eligibleEmails[i]]);
  }

  sheet.getRange(2, column, rows.length, 1).setValues(rows);
  return columnIndexToLetter_(column);
}

function findFirstBlankColumn_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  for (var i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i] || '').trim() === '') {
      return i + 1;
    }
  }
  return lastColumn + 1;
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
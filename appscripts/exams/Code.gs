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
  'updated_at',
  'assessment_type'
];

var STUDENTS_SHEET_NAME = 'Students';
var EXAMS_SHEET_NAME = 'Exams';
var ATTEMPTED_SHEET_NAME = 'Attempted';
var QUESTIONS_SHEET_NAME = 'Questions';
var CSM_SHEET_NAME = 'CSM';
var CSM_HEADERS = [
  'Name',
  'Email',
  'Self-Intro Video Link',
  'Listening & Speaking Audio Link',
  'Listening & Writing Text Response',
  'Email Writing Response'
];

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

function getCsmSheet_() {
  return getSheetByNameOrCreate_(CSM_SHEET_NAME, CSM_HEADERS);
}

function findCsmRowByEmail_(sheet, email) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }

  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === email.toLowerCase()) {
      return i + 2;
    }
  }

  return -1;
}

function writeCsmResponse_(email, name, responses) {
  var sheet = getCsmSheet_();
  var rowIndex = findCsmRowByEmail_(sheet, email);
  var rowValues = [
    name || '',
    email,
    responses && responses.length > 0 ? String(responses[0] || '') : '',
    responses && responses.length > 1 ? String(responses[1] || '') : '',
    responses && responses.length > 2 ? String(responses[2] || '') : '',
    responses && responses.length > 3 ? String(responses[3] || '') : ''
  ];
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function getCsmQuestions_() {
  return [
    {
      prompt: 'Formal Dressed - Self Intro video activity. Please follow the guidelines shared - formal dress code. No distraction in the room you record the video. Introduce yourself briefly. Make a video recording of your self-introduction and upload the same as the answer to this question (not exceeding 3 minutes).\nThe drive link to the video may be uploaded in the given field. Your "Share" settings should be such that anyone with the link can open the file. If the file cannot be opened due to your drive settings, your answer will be disqualified from evaluation and you will be marked zero.',
      responseType: 'URL',
      options: [],
      answerIndex: -1,
      weight: 0
    },
    {
      prompt: 'Listening Skill Assessment - Listen and Speak. Do you agree with the speakers? Why or why not? Prepare a short audio recording not exceeding 3 minutes stating your own opinion on the matter and giving arguments to support your answer. AI generated answers will be penalised. The drive link to the audio may be uploaded in the given field. Your "Share" settings should be such that anyone with the link can open the file. If the file cannot be opened due to your drive settings, your answer will be disqualified from evaluation and you will be marked zero.\nAudio link: https://drive.google.com/file/d/1i28YWLZmPB28S7jFqOx_8dEqo9fuZ_-P/view?usp=sharing',
      responseType: 'URL',
      options: [],
      answerIndex: -1,
      weight: 0
    },
    {
      prompt: 'Listening Skill Assessment - Listen and write. Listen to the audio sample and summarise the opinions voiced by the speakers in no more than 500 words. Write in full sentences, not in bulleted points. AI generated answers will be penalised.\nAudio link: https://drive.google.com/file/d/1i28YWLZmPB28S7jFqOx_8dEqo9fuZ_-P/view?usp=sharing',
      responseType: 'TEXT',
      options: [],
      answerIndex: -1,
      weight: 0
    },
    {
      prompt: 'Email Writing. You are a marketing intern at ABC Educational Consultancy and part of the team organizing a student outreach program as an educational fair. Write an e-mail, not exceeding 300 words, inviting AGT Institute of Technology, one of your partner colleges, to the fair. Highlight how the event might be useful to their students, detail the various services that you provide, and intimate the date, time and venue to them.',
      responseType: 'TEXT',
      options: [],
      answerIndex: -1,
      weight: 0
    }
  ];
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
    // Match exam by exam_id | title format in students sheet headers
    var examId = String(row[0] || '').trim();
    var title = String(row[1] || '').trim();
    eligibleEmails = getEligibleEmailsForExam_(examId, title);
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
    updatedAt: String(row[11] || ''),
    assessmentType: String(row[12] || 'STANDARD').toUpperCase()
  };
}

function deriveExamStatus_(configuredStatus, startAt, endAt) {
  var status = String(configuredStatus || '').trim().toUpperCase();

  var start = new Date(startAt);
  var end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return status || 'DRAFT';
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

function getEligibleEmailsForExam_(examId, title) {
  if (!examId) {
    return [];
  }

  var sheet = getStudentsSheet_();
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return [];
  }

  // Get header row to find matching column
  var headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var targetColumn = -1;
  
  // Match by "exam_id | title" format
  var expectedHeader = examId + ' | ' + title;
  
  for (var i = 0; i < headerRow.length; i++) {
    var header = String(headerRow[i] || '').trim();
    if (header === expectedHeader) {
      targetColumn = i + 1;
      break;
    }
  }
  
  if (targetColumn < 1) {
    return [];
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  var values = sheet.getRange(2, targetColumn, lastRow - 1, 1).getValues();
  var emails = [];
  for (var i = 0; i < values.length; i++) {
    var email = String(values[i][0] || '').trim().toLowerCase();
    if (email) {
      emails.push(email);
    }
  }
  return emails;
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

  var values = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === examId) {
      var examObj = rowToExam_(values[i]);
      var startAt = new Date(String(values[i][4] || ''));
      matches.push({ rowIndex: i + 2, exam: examObj, startAt: isNaN(startAt.getTime()) ? null : startAt });
    }
  }

  if (matches.length === 0) return { rowIndex: -1, exam: null };

  // Prefer an exam that's currently OPEN. If multiple OPEN, pick the one with latest startAt.
  var openMatches = matches.filter(function(m) {
    return String(m.exam && m.exam.status || '').toUpperCase() === 'OPEN';
  });

  var chosen = null;
  var comparator = function(a, b) {
    var ta = a.startAt ? a.startAt.getTime() : 0;
    var tb = b.startAt ? b.startAt.getTime() : 0;
    return ta - tb;
  };

  if (openMatches.length > 0) {
    openMatches.sort(comparator);
    chosen = openMatches[openMatches.length - 1];
  } else {
    // No OPEN exams — pick the one with the latest startAt (most recent configuration)
    matches.sort(comparator);
    chosen = matches[matches.length - 1];
  }

  return { rowIndex: chosen.rowIndex, exam: chosen.exam };
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

function findLastSubmittedAttemptAt_(sheet, examId, email) {
  if (!examId || !email) {
    return '';
  }

  var normalizedEmail = String(email || '').trim().toLowerCase();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return '';
  }

  var values = sheet.getRange(2, 1, lastRow - 1, ATTEMPT_HEADERS.length).getValues();
  var latestTimestamp = '';
  var latestTime = 0;

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][1] || '').trim() !== examId) {
      continue;
    }

    if (String(values[i][3] || '').trim().toLowerCase() !== normalizedEmail) {
      continue;
    }

    var submittedAt = String(values[i][9] || '').trim();
    if (!submittedAt) {
      continue;
    }

    var submittedTime = new Date(submittedAt).getTime();
    if (isNaN(submittedTime)) {
      continue;
    }

    if (submittedTime > latestTime) {
      latestTime = submittedTime;
      latestTimestamp = submittedAt;
    }
  }

  return latestTimestamp;
}

function findSubmittedAttemptTimestamps_(sheet, examId, email) {
  if (!examId || !email) {
    return [];
  }

  var normalizedEmail = String(email || '').trim().toLowerCase();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  var values = sheet.getRange(2, 1, lastRow - 1, ATTEMPT_HEADERS.length).getValues();
  var timestamps = [];

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][1] || '').trim() !== examId) {
      continue;
    }

    if (String(values[i][3] || '').trim().toLowerCase() !== normalizedEmail) {
      continue;
    }

    var submittedAt = String(values[i][9] || '').trim();
    if (!submittedAt) {
      continue;
    }

    var submittedTime = new Date(submittedAt).getTime();
    if (isNaN(submittedTime)) {
      continue;
    }

    timestamps.push(submittedAt);
  }

  timestamps.sort(function(a, b) {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return timestamps;
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
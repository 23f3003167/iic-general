/******************************************************
 * AI EVALUATION APPS SCRIPT API
 * Web-safe API wrapper for Code.gs workflow.
 ******************************************************/

var API_SHEET_NAME = 'Evaluation';

// Input columns
var API_COL_SELF_INTRO_LINK = 3;    // C
var API_COL_LISTEN_SPEAK_LINK = 4;  // D
var API_COL_LISTEN_WRITE_TEXT = 5;  // E
var API_COL_EMAIL_TEXT = 6;         // F

// Status and metadata columns
var API_COL_STATUS = 7;             // G
var API_COL_EVALUATOR_VERSION = 19; // S
var API_COL_EVAL_TIMESTAMP = 20;    // T

var API_EVALUATOR_VERSION = 'v1.0';

var MENU_OPTIONS = [
  {
    key: 'evaluate_selected_student',
    label: 'Evaluate Selected Student',
    module: 'all',
    requiresRow: true,
    mode: 'selected'
  },
  {
    key: 'evaluate_m_to_n_all',
    label: 'Evaluate all Students from Mth row to Nth row',
    module: 'all',
    requiresRange: true,
    mode: 'range'
  },
  {
    key: 'evaluate_all_students',
    label: 'Evaluate All Students',
    module: 'all',
    mode: 'all'
  },
  {
    key: 'evaluate_self_intro_all',
    label: 'Evaluate Self-Intro for all',
    module: 'self_intro',
    mode: 'all'
  },
  {
    key: 'evaluate_self_intro_m_to_n',
    label: 'Evalaute Self-Intro from Mth row to Nth row',
    module: 'self_intro',
    requiresRange: true,
    mode: 'range'
  },
  {
    key: 'evaluate_listening_speaking_all',
    label: 'Evaluate Listening and speaking for All',
    module: 'listening_speaking',
    mode: 'all'
  },
  {
    key: 'evaluate_listening_speaking_m_to_n',
    label: 'Evalaute Listening and speaking from Mth row to Nth row',
    module: 'listening_speaking',
    requiresRange: true,
    mode: 'range'
  },
  {
    key: 'evaluate_listening_writing_all',
    label: 'Evalaute Listening and Writing for all',
    module: 'listening_writing',
    mode: 'all'
  },
  {
    key: 'evaluate_listening_writing_m_to_n',
    label: 'Evalaute Listening and Writing from Mth row to Nth row',
    module: 'listening_writing',
    requiresRange: true,
    mode: 'range'
  },
  {
    key: 'evaluate_email_writing_all',
    label: 'Evaluate Email writing for all',
    module: 'email_writing',
    mode: 'all'
  },
  {
    key: 'evaluate_email_writing_m_to_n',
    label: 'Evalaute Email writing from Mth row to Nth row',
    module: 'email_writing',
    requiresRange: true,
    mode: 'range'
  }
];

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;
    if (action === 'getMenuOptions') {
      data = getMenuOptions_();
    } else if (action === 'getStudents') {
      data = getStudents_(payload);
    } else if (action === 'runMenuAction') {
      data = runMenuAction_(payload);
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

function getMenuOptions_() {
  return { options: MENU_OPTIONS };
}

function getStudents_(payload) {
  var sheet = getEvaluationSheet_(payload.sheetId);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { students: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, API_COL_STATUS).getValues();
  var students = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowNumber = i + 2;

    students.push({
      sheetRow: rowNumber,
      name: String(row[0] || '').trim(),
      email: String(row[1] || '').trim(),
      status: String(row[API_COL_STATUS - 1] || '').trim(),
      selfIntroLink: String(row[API_COL_SELF_INTRO_LINK - 1] || '').trim(),
      listeningSpeakingLink: String(row[API_COL_LISTEN_SPEAK_LINK - 1] || '').trim(),
      listeningWritingText: String(row[API_COL_LISTEN_WRITE_TEXT - 1] || '').trim(),
      emailWritingText: String(row[API_COL_EMAIL_TEXT - 1] || '').trim()
    });
  }

  return { students: students };
}

function runMenuAction_(payload) {
  var sheet = getEvaluationSheet_(payload.sheetId);
  var optionKey = String(payload.optionKey || '').trim();
  if (!optionKey) {
    throw new Error('Missing optionKey');
  }

  var option = findMenuOption_(optionKey);
  if (!option) {
    throw new Error('Unknown menu option: ' + optionKey);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      queued: 0,
      skipped: 0,
      failed: 0,
      message: 'No student rows found.'
    };
  }

  if (option.mode === 'selected') {
    var selectedRow = Number(payload.row || 0);
    if (!Number.isInteger(selectedRow) || selectedRow < 2) {
      throw new Error('Invalid row for selected-student action');
    }

    return queueRows_(sheet, selectedRow, selectedRow, option.module, option.key, option.label);
  }

  if (option.mode === 'range') {
    var startRow = Number(payload.rowStart || 0);
    var endRow = Number(payload.rowEnd || 0);
    if (!Number.isInteger(startRow) || !Number.isInteger(endRow) || startRow < 2 || endRow < startRow) {
      throw new Error('Invalid M,N range');
    }

    return queueRows_(sheet, startRow, endRow, option.module, option.key, option.label);
  }

  return queueRows_(sheet, 2, lastRow, option.module, option.key, option.label);
}

function queueRows_(sheet, startRow, endRow, moduleName, batchKind, batchLabel) {
  var lastRow = sheet.getLastRow();
  var safeStart = Math.max(2, startRow);
  var safeEnd = Math.min(endRow, lastRow);

  if (safeStart > safeEnd) {
    return {
      queued: 0,
      skipped: 0,
      failed: 0,
      message: 'No valid rows in selected range.'
    };
  }

  var batch = createBatchContext_(batchKind || moduleName || 'batch');
  var queued = 0;
  var skipped = 0;
  var failed = 0;
  var details = [];

  for (var row = safeStart; row <= safeEnd; row++) {
    if (!hasInputForModuleApi_(sheet, row, moduleName)) {
      skipped += 1;
      details.push('Row ' + row + ': skipped (missing input)');
      continue;
    }

    sheet.getRange(row, API_COL_STATUS).setValue(queueStatusTextApi_(moduleName));
    setEvaluationMetadataApi_(sheet, row);

    var result = triggerCloudEvaluationApi_(moduleName, row, {
      batchId: batch.id,
      batchLabel: batch.label
    });

    if (result.ok) {
      queued += 1;
      details.push('Row ' + row + ': queued' + (result.jobId ? ' (' + result.jobId + ')' : ''));
    } else {
      failed += 1;
      details.push('Row ' + row + ': failed (' + (result.error || 'unknown error') + ')');
      sheet.getRange(row, API_COL_STATUS).setValue('Queue Failed');
    }
  }

  return {
    queued: queued,
    skipped: skipped,
    failed: failed,
    batchId: batch.id,
    message: batchLabel + ' queue complete',
    details: details
  };
}

function hasInputForModuleApi_(sheet, row, moduleName) {
  if (moduleName === 'all') {
    return hasAnyInputApi_(sheet, row);
  }

  var selfIntro = sheet.getRange(row, API_COL_SELF_INTRO_LINK).getValue();
  var listenSpeak = sheet.getRange(row, API_COL_LISTEN_SPEAK_LINK).getValue();
  var listenWrite = sheet.getRange(row, API_COL_LISTEN_WRITE_TEXT).getValue();
  var emailWrite = sheet.getRange(row, API_COL_EMAIL_TEXT).getValue();

  if (moduleName === 'self_intro') return !!(selfIntro && String(selfIntro).trim() !== '');
  if (moduleName === 'listening_speaking') return !!(listenSpeak && String(listenSpeak).trim() !== '');
  if (moduleName === 'listening_writing') return !!(listenWrite && String(listenWrite).trim() !== '');
  if (moduleName === 'email_writing') return !!(emailWrite && String(emailWrite).trim() !== '');
  return false;
}

function hasAnyInputApi_(sheet, row) {
  var c = sheet.getRange(row, API_COL_SELF_INTRO_LINK).getValue();
  var d = sheet.getRange(row, API_COL_LISTEN_SPEAK_LINK).getValue();
  var e = sheet.getRange(row, API_COL_LISTEN_WRITE_TEXT).getValue();
  var f = sheet.getRange(row, API_COL_EMAIL_TEXT).getValue();

  return (
    (c && String(c).trim() !== '') ||
    (d && String(d).trim() !== '') ||
    (e && String(e).trim() !== '') ||
    (f && String(f).trim() !== '')
  );
}

function queueStatusTextApi_(moduleName) {
  if (moduleName === 'self_intro') return 'Queued: Self-Intro (Cloud)';
  if (moduleName === 'listening_speaking') return 'Queued: Listening & Speaking (Cloud)';
  if (moduleName === 'listening_writing') return 'Queued: Listening & Writing (Cloud)';
  if (moduleName === 'email_writing') return 'Queued: Email Writing (Cloud)';
  return 'Queued: Full Evaluation (Cloud)';
}

function setEvaluationMetadataApi_(sheet, row) {
  sheet.getRange(row, API_COL_EVALUATOR_VERSION).setValue(API_EVALUATOR_VERSION);
  sheet.getRange(row, API_COL_EVAL_TIMESTAMP).setValue(new Date());
}

function createBatchContext_(kind) {
  var now = new Date();
  var stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  var normalizedKind = String(kind || 'batch').replace(/[^a-zA-Z0-9_-]/g, '_');
  var id = normalizedKind + '_' + stamp + '_' + randomPart;
  return {
    id: id,
    label: normalizedKind + ' ' + stamp
  };
}

function triggerCloudEvaluationApi_(moduleName, row, options) {
  var opts = options || {};
  var batchId = opts.batchId || '';
  var batchLabel = opts.batchLabel || '';

  var config = getCloudConfigApi_();
  if (!config.apiBaseUrl) {
    return { ok: false, error: 'Cloud API URL missing in script properties (EVALUATION_API_URL)' };
  }

  var sheetId = SpreadsheetApp.getActive().getId();
  var url = config.apiBaseUrl.replace(/\/$/, '') + '/evaluate';

  var payload = {
    sheet_id: sheetId,
    row: row,
    module: moduleName,
    async: true
  };

  if (batchId) payload.batch_id = batchId;
  if (batchLabel) payload.batch_label = batchLabel;

  var headers = { 'Content-Type': 'application/json' };
  if (config.apiToken) {
    headers['x-api-key'] = config.apiToken;
  }

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var statusCode = response.getResponseCode();
    var text = response.getContentText();
    var body = text ? JSON.parse(text) : {};

    if (statusCode >= 200 && statusCode < 300 && body.ok) {
      return { ok: true, jobId: body.job_id || '' };
    }

    return { ok: false, error: 'HTTP ' + statusCode + ': ' + text };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function getCloudConfigApi_() {
  var props = PropertiesService.getScriptProperties();
  var apiBaseUrl = String(props.getProperty('EVALUATION_API_URL') || '').trim();
  var apiToken = String(props.getProperty('EVALUATION_API_TOKEN') || '').trim();
  return {
    apiBaseUrl: apiBaseUrl,
    apiToken: apiToken
  };
}

function findMenuOption_(key) {
  for (var i = 0; i < MENU_OPTIONS.length; i++) {
    if (MENU_OPTIONS[i].key === key) return MENU_OPTIONS[i];
  }
  return null;
}

function getEvaluationSheet_(sheetId) {
  var trimmedSheetId = String(sheetId || '').trim();
  var spreadsheet = trimmedSheetId
    ? SpreadsheetApp.openById(trimmedSheetId)
    : SpreadsheetApp.getActive();

  var sheet = spreadsheet.getSheetByName(API_SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet not found: ' + API_SHEET_NAME);
  }
  return sheet;
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

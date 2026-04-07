function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'getPublishScoreActivities') {
      data = getPublishScoreActivities();
    } else if (action === 'publishScores') {
      data = publishScores(payload);
    } else {
      throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse_(true, data, 'OK');
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
}

function getPublishScoreActivities() {
  return [
    { key: 'ppm', label: 'PPM', startCol: 1, width: 2 },
    { key: 'aptitude', label: 'Aptitude', startCol: 10, width: 2 },
    { key: 'tech-mcq', label: 'Tech MCQ', startCol: 19, width: 2 }
  ];
}

function publishScores(payload) {
  payload = payload || {};

  var activityKey = String(payload.activityKey || '').trim();
  var rowsText = String(payload.rowsText || '').trim();
  var activity = getPublishScoreActivityByKey_(activityKey);

  if (!activity) {
    throw new Error('Select a valid activity');
  }

  if (!rowsText) {
    throw new Error('Paste at least one row of email and score data');
  }

  var rows = parseScoreRows_(rowsText, activity.width);
  if (rows.length === 0) {
    throw new Error('No valid rows found');
  }

  var sheet = resolveScoresSheet_(payload);
  var startRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(startRow, activity.startCol, rows.length, activity.width).setValues(rows);

  cleanBlock(activity.startCol, activity.width, sheet);

  return {
    activity: activity.label,
    rowsWritten: rows.length,
    startCol: activity.startCol,
    width: activity.width,
    sheetName: sheet.getName()
  };
}

function resolveScoresSheet_(payload) {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty('SCORES_SPREADSHEET_ID') || '').trim();
  var payloadSheetName = String(payload.sheetName || '').trim();
  var configuredSheetName = String(props.getProperty('SCORES_SHEET_NAME') || '').trim();
  var targetSheetName = payloadSheetName || configuredSheetName;

  var ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Could not resolve scores spreadsheet. Set SCORES_SPREADSHEET_ID in Script Properties.');
  }

  if (targetSheetName) {
    var namedSheet = ss.getSheetByName(targetSheetName);
    if (!namedSheet) {
      throw new Error('Sheet not found: ' + targetSheetName + '. Check SCORES_SHEET_NAME or payload.sheetName.');
    }
    return namedSheet;
  }

  var activeSheet = ss.getActiveSheet();
  if (activeSheet) {
    return activeSheet;
  }

  var firstSheet = ss.getSheets()[0];
  if (!firstSheet) {
    throw new Error('No sheets found in the target spreadsheet.');
  }

  return firstSheet;
}

function getPublishScoreActivityByKey_(activityKey) {
  var activities = getPublishScoreActivities();

  for (var i = 0; i < activities.length; i++) {
    if (activities[i].key === activityKey) {
      return activities[i];
    }
  }

  return null;
}

function parseScoreRows_(rowsText, expectedWidth) {
  var lines = rowsText.split(/\r?\n/);
  var rows = [];

  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i] || '').trim();
    if (!line) {
      continue;
    }

    var cells = line.split('\t');
    for (var c = 0; c < cells.length; c++) {
      cells[c] = String(cells[c] || '').trim();
    }

    if (cells.length !== expectedWidth) {
      throw new Error('Line ' + (i + 1) + ' must contain exactly ' + expectedWidth + ' tab-separated values.');
    }

    if (!cells[0]) {
      throw new Error('Line ' + (i + 1) + ' is missing an email id.');
    }

    cells[0] = cells[0].toLowerCase();
    rows.push(cells);
  }

  return rows;
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
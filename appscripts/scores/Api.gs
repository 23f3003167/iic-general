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
    } else if (action === 'lookupStudentScore') {
      data = lookupStudentScore(payload);
    } else if (action === 'lookupStudentFeedback') {
      data = lookupStudentFeedback(payload);
    } else if (action === 'lookupStudentActivityPoints') {
      data = lookupStudentActivityPoints(payload);
    } else if (action === 'lookupStudentSubmissions') {
      data = lookupStudentSubmissions(payload);
    } else if (action === 'modifyAttempts') {
      // payload.data should contain { emails, attemptType, batch, activity }
      data = modifyAttempts(payload.data || payload);
    } else if (action === 'getDatabaseData') {
      data = getDatabaseData();
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

function lookupStudentScore(payload) {
  var level = String(payload.level || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();
  var domain = String(payload.domain || '').trim().toLowerCase();
  var plan = String(payload.plan || '').trim().toLowerCase();

  if (!level) {
    throw new Error('Select a level');
  }
  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = resolveScoresSheet_({ sheetName: level });
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('No score rows found in ' + sheet.getName());
  }

  var headers = values[0];
  var emailIndex = findHeaderIndex_(headers, ['email']);
  var domainIndex = findHeaderIndex_(headers, ['domain']);
  var planIndex = findHeaderIndex_(headers, ['plan']);

  if (emailIndex < 0) {
    throw new Error('Email column not found in ' + sheet.getName());
  }

  var matchedRow = null;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowEmail = String(row[emailIndex] || '').trim().toLowerCase();
    if (rowEmail !== email) {
      continue;
    }

    if (domain && domainIndex >= 0) {
      var rowDomain = String(row[domainIndex] || '').trim().toLowerCase();
      if (rowDomain !== domain) {
        continue;
      }
    }

    if (plan && planIndex >= 0) {
      var rowPlan = String(row[planIndex] || '').trim().toLowerCase();
      if (rowPlan !== plan) {
        continue;
      }
    }

    matchedRow = row;
    break;
  }

  if (!matchedRow) {
    throw new Error('No matching score row found for the entered details.');
  }

  return {
    sheetName: sheet.getName(),
    level: level,
    headers: headers,
    row: matchedRow,
    matched: {
      email: email,
      domain: domain,
      plan: plan
    }
  };
}

function lookupStudentFeedback(payload) {
  var category = String(payload.category || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();

  if (!category) {
    throw new Error('Select a feedback category');
  }
  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = resolveFeedbackSheet_(category);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('No feedback rows found in ' + sheet.getName());
  }

  var headers = values[0];
  var emailIndex = findHeaderIndex_(headers, ['email']);

  if (emailIndex < 0) {
    throw new Error('Email column not found in ' + sheet.getName());
  }

  var matchedRow = null;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[emailIndex] || '').trim().toLowerCase() === email) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) {
    throw new Error('No feedback found for the entered email.');
  }

  return {
    sheetName: sheet.getName(),
    category: category,
    headers: headers,
    row: matchedRow,
    email: email
  };
}

function lookupStudentActivityPoints(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var plan = String(payload.plan || '').trim().toLowerCase();
  var domain = String(payload.domain || '').trim().toLowerCase();

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = resolveActivityPointsSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('No activity point rows found in ' + sheet.getName());
  }

  var headers = values[0];
  var emailIndex = findHeaderIndex_(headers, ['email']);
  var planIndex = findHeaderIndex_(headers, ['plan']);
  var domainIndex = findHeaderIndex_(headers, ['domain']);

  if (emailIndex < 0) {
    throw new Error('Email column not found in ' + sheet.getName());
  }

  var matchedRow = null;
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowEmail = String(row[emailIndex] || '').trim().toLowerCase();
    if (rowEmail !== email) {
      continue;
    }

    if (plan && planIndex >= 0) {
      var rowPlan = String(row[planIndex] || '').trim().toLowerCase();
      if (rowPlan !== plan) {
        continue;
      }
    }

    if (domain && domainIndex >= 0) {
      var rowDomain = String(row[domainIndex] || '').trim().toLowerCase();
      if (rowDomain !== domain) {
        continue;
      }
    }

    matchedRow = row;
    break;
  }

  if (!matchedRow) {
    throw new Error('No matching activity points row found for the entered details.');
  }

  return {
    sheetName: sheet.getName(),
    headers: headers,
    row: matchedRow,
    matched: {
      email: email,
      domain: domain,
      plan: plan
    }
  };
}

function lookupStudentSubmissions(payload) {
  payload = payload || {};

  var rawUserEmail = Session.getActiveUser().getEmail();
  if (!rawUserEmail) {
    throw new Error('Please open the portal using your IITM email login.');
  }

  var userEmail = String(rawUserEmail).trim().toLowerCase();
  var sheet = SpreadsheetApp.openById('1K6RPucCl6cqvO4SmC1Z66kKPpCVTaStf34pJ6V2E7pk').getSheetByName('Form Responses 2');

  if (!sheet) {
    throw new Error('Sheet not found.');
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return {
      sheetName: sheet.getName(),
      email: userEmail,
      count: 0,
      submissions: []
    };
  }

  var headers = values[0];
  var emailIndex = findSubmissionEmailIndex_(headers);

  if (emailIndex < 0) {
    throw new Error('Email column not found in sheet.');
  }

  var proofIndex = findHeaderIndex_(headers, ['paste', 'link', 'below']);
  var activityIndex = 37;
  if (activityIndex >= headers.length) {
    activityIndex = findHeaderIndex_(headers, ['activity']);
  }

  var submissions = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowEmail = normalizeText_(row[emailIndex]);

    if (rowEmail !== userEmail) {
      continue;
    }

    var activity = '';
    if (activityIndex >= 0 && activityIndex < row.length) {
      activity = String(row[activityIndex] || '').trim();
    }

    submissions.push({
      date: serializeDate_(row[0]),
      activity: activity,
      proof: proofIndex >= 0 ? String(row[proofIndex] || '').trim() : ''
    });
  }

  return {
    sheetName: sheet.getName(),
    email: userEmail,
    count: submissions.length,
    submissions: submissions
  };
}

function getDomainPlanOptions() {
  var props = PropertiesService.getScriptProperties();
  var examSpreadsheetId = String(props.getProperty('EXAMS_SPREADSHEET_ID') || '').trim();
  var scoresSpreadsheetId = String(props.getProperty('SCORES_SPREADSHEET_ID') || '').trim();

  var sheet = null;

  if (examSpreadsheetId) {
    try {
      var ss = SpreadsheetApp.openById(examSpreadsheetId);
      sheet = ss.getSheetByName('Students');
    } catch (e) {
      sheet = null;
    }
  }

  if (!sheet && scoresSpreadsheetId) {
    try {
      var ss2 = SpreadsheetApp.openById(scoresSpreadsheetId);
      sheet = ss2.getSheetByName('Students');
    } catch (e) {
      sheet = null;
    }
  }

  if (!sheet) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      sheet = active.getSheetByName('Students');
    }
  }

  if (!sheet) {
    throw new Error('Students sheet not found in configured spreadsheets.');
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 1) {
    return { domains: [], plans: [] };
  }

  var headers = values[0] || [];
  var domainIndex = findHeaderIndex_(headers, ['domain']);
  var planIndex = findHeaderIndex_(headers, ['plan']);

  var domainSet = {};
  var planSet = {};
  var domains = [];
  var plans = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i] || [];
    if (domainIndex >= 0) {
      var d = String(row[domainIndex] || '').trim();
      if (d) {
        var key = d.toLowerCase();
        if (!domainSet[key]) { domainSet[key] = true; domains.push(d); }
      }
    }
    if (planIndex >= 0) {
      var p = String(row[planIndex] || '').trim();
      if (p) {
        var k2 = p.toLowerCase();
        if (!planSet[k2]) { planSet[k2] = true; plans.push(p); }
      }
    }
  }

  domains.sort();
  plans.sort();

  return { domains: domains, plans: plans };
}

function resolveFeedbackSheet_(category) {
  var candidates = getFeedbackSheetCandidates_(category);
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty('SCORES_SPREADSHEET_ID') || '').trim();
  var ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Could not resolve feedback spreadsheet. Set SCORES_SPREADSHEET_ID in Script Properties.');
  }

  for (var i = 0; i < candidates.length; i++) {
    var sheet = ss.getSheetByName(candidates[i]);
    if (sheet) {
      return sheet;
    }
  }

  throw new Error('Feedback sheet not found for category: ' + category);
}

function getFeedbackSheetCandidates_(category) {
  var normalized = String(category || '').trim().toLowerCase();

  if (normalized === 'csm') {
    return ['CSM Feedback', 'CSM'];
  }
  if (normalized === 'behavioral' || normalized === 'behavioural' || normalized === 'ba') {
    return ['BA Feedback', 'Behavioral Feedback', 'Behavioural Feedback', 'BA'];
  }
  if (normalized === 'presentation') {
    return ['Presentation Feedback', 'Presentation'];
  }
  if (normalized === '1o1' || normalized === '1on1') {
    return ['1on1', '1on1 Feedback', 'Feedback Sheet', 'Feedback_Sheet'];
  }

  return [category];
}

function resolveActivityPointsSheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty('SCORES_SPREADSHEET_ID') || '').trim();
  var ss = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error('Could not resolve activity points spreadsheet. Set SCORES_SPREADSHEET_ID in Script Properties.');
  }

  var candidates = ['Activity points', 'Activity Points', 'activity points'];
  for (var i = 0; i < candidates.length; i++) {
    var sheet = ss.getSheetByName(candidates[i]);
    if (sheet) {
      return sheet;
    }
  }

  throw new Error('Activity points sheet not found.');
}

function findHeaderIndex_(headers, keywords) {
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').trim().toLowerCase();
    if (!header) continue;

    var matched = true;
    for (var k = 0; k < keywords.length; k++) {
      if (header.indexOf(String(keywords[k]).toLowerCase()) === -1) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return i;
    }
  }

  return -1;
}

function findSubmissionEmailIndex_(headers) {
  for (var i = 0; i < headers.length; i++) {
    var header = normalizeText_(headers[i]);
    if (!header) continue;

    if (header.indexOf('student email id') !== -1 || header.indexOf('email') !== -1) {
      return i;
    }
  }

  return -1;
}

function normalizeText_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().toLowerCase();
}

function serializeDate_(value) {
  if (!value) {
    return '';
  }

  var d = new Date(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a');
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

function getDatabaseData() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty('DATABASE_SPREADSHEET_ID') || '').trim();
  
  if (!spreadsheetId) {
    throw new Error('DATABASE_SPREADSHEET_ID not configured in Script Properties');
  }
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  
  var level1 = getLevelData_(ss, 'Level 1', 18); // Column S (index 18)
  var level2 = getLevelData_(ss, 'Level 2', 12); // Column M (index 12)
  var level3 = getLevelData_(ss, 'Level 3', 11); // Column L (index 11)
  
  return {
    level1: level1,
    level2: level2,
    level3: level3
  };
}

function getLevelData_(ss, sheetName, statusColumnIndex) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { error: sheetName + ' sheet not found' };
  }
  
  var data = sheet.getDataRange().getValues();
  var categories = {};
  
  // Skip header row (index 0)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var email = row[2]; // Column C
    var status = row[statusColumnIndex];
    
    // Check if status indicates pending activities
    if (status && String(status).indexOf('Pending:') !== -1) {
      // Extract the pending category
      var category = String(status).replace('Pending: ', '').trim();
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(email);
    }
  }
  
  return {
    level: sheetName,
    categories: categories
  };
}

// NOTE: `getDomainPlanOptions` removed — domain/plan are now static on the frontend.
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
      data = modifyAttempts(payload.data || payload);
    } else if (action === 'getDatabaseData') {
      data = getDatabaseData();
    } else if (action === 'verifyStudentEmail') {
      data = verifyStudentEmail(payload);
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
      throw new Error('Sheet "' + targetSheetName + '" not found');
    }
    return namedSheet;
  }

  return ss.getSheets()[0];
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
  payload = payload || {};

  var email = String(payload.email || '').trim().toLowerCase();
  var level = String(payload.level || '').trim();
  var domain = String(payload.domain || '').trim();
  var plan = String(payload.plan || '').trim();

  if (!email) {
    throw new Error('Email is required');
  }

  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty('SCORES_SPREADSHEET_ID') || '').trim();

  if (!spreadsheetId) {
    throw new Error('SCORES_SPREADSHEET_ID not configured in Script Properties');
  }

  var ss = SpreadsheetApp.openById(spreadsheetId);
  
  // Find the appropriate sheet based on level
  var targetSheetName = level;
  if (level.indexOf('level 1') !== -1 || level.indexOf('1') === 0) {
    targetSheetName = 'Level 1';
  } else if (level.indexOf('level 2') !== -1 || level.indexOf('2') === 0) {
    targetSheetName = 'Level 2';
  } else if (level.indexOf('level 3') !== -1 || level.indexOf('3') === 0) {
    targetSheetName = 'Level 3';
  }
  
  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIndex = findHeaderIndex_(headers, ['email', 'mail', 'e-mail']);
  var domainIndex = findHeaderIndex_(headers, ['domain']);
  var planIndex = findHeaderIndex_(headers, ['plan']);

  if (emailIndex === -1) {
    throw new Error('Email column not found in scores sheet');
  }

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIndex] || '').trim().toLowerCase();
    if (rowEmail === email) {
      // Check domain if provided
      if (domain && domainIndex !== -1) {
        var rowDomain = String(data[i][domainIndex] || '').trim().toLowerCase();
        var domainLower = domain.toLowerCase();
        if (rowDomain !== domainLower && rowDomain.indexOf(domainLower) === -1 && domainLower.indexOf(rowDomain) === -1) {
          continue;
        }
      }
      
      // Check plan if provided
      if (plan && planIndex !== -1) {
        var rowPlan = String(data[i][planIndex] || '').trim().toLowerCase();
        var planLower = plan.toLowerCase();
        if (rowPlan !== planLower && rowPlan.indexOf(planLower) === -1 && planLower.indexOf(rowPlan) === -1) {
          continue;
        }
      }
      
      return {
        sheetName: sheet.getName(),
        level: level,
        headers: headers,
        row: data[i],
        matched: {
          email: email,
          domain: domain,
          plan: plan
        }
      };
    }
  }

  return { email: email, notFound: true };
}

function lookupStudentFeedback(payload) {
  payload = payload || {};

  var email = String(payload.email || '').trim().toLowerCase();
  var category = String(payload.category || '').trim();

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = resolveFeedbackSheet_(category);
  if (!sheet) {
    throw new Error('Could not resolve feedback sheet for category: ' + category);
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var emailIndex = findHeaderIndex_(headers, ['email', 'mail', 'e-mail']);

  if (emailIndex === -1) {
    throw new Error('Email column not found in feedback sheet');
  }

  var data = sheet.getDataRange().getValues();
  var matchedRows = [];

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIndex] || '').trim().toLowerCase();
    if (rowEmail === email) {
      matchedRows.push(data[i]);
    }
  }

  if (matchedRows.length === 0) {
    return { email: email, category: category, notFound: true };
  }

  return {
    sheetName: sheet.getName(),
    category: category,
    headers: headers,
    rows: matchedRows,
    email: email,
    count: matchedRows.length
  };
}

function lookupStudentActivityPoints(payload) {
  payload = payload || {};

  var email = String(payload.email || '').trim().toLowerCase();
  var domain = String(payload.domain || '').trim();
  var plan = String(payload.plan || '').trim();

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = resolveActivityPointsSheet_();
  if (!sheet) {
    throw new Error('Activity Points sheet not found');
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIndex = findHeaderIndex_(headers, ['email', 'mail', 'e-mail']);
  var domainIndex = findHeaderIndex_(headers, ['domain']);
  var planIndex = findHeaderIndex_(headers, ['plan']);

  if (emailIndex === -1) {
    throw new Error('Email column not found in Activity Points sheet');
  }

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIndex] || '').trim().toLowerCase();
    if (rowEmail === email) {
      // Check domain if provided
      if (domain && domainIndex !== -1) {
        var rowDomain = String(data[i][domainIndex] || '').trim().toLowerCase();
        var domainLower = domain.toLowerCase();
        if (rowDomain !== domainLower && rowDomain.indexOf(domainLower) === -1 && domainLower.indexOf(rowDomain) === -1) {
          continue;
        }
      }
      
      // Check plan if provided
      if (plan && planIndex !== -1) {
        var rowPlan = String(data[i][planIndex] || '').trim().toLowerCase();
        var planLower = plan.toLowerCase();
        if (rowPlan !== planLower && rowPlan.indexOf(planLower) === -1 && planLower.indexOf(rowPlan) === -1) {
          continue;
        }
      }
      
      return {
        sheetName: sheet.getName(),
        headers: headers,
        row: data[i],
        email: email,
        matched: {
          email: email,
          domain: domain,
          plan: plan
        }
      };
    }
  }

  return { email: email, notFound: true };
}

function lookupStudentSubmissions(payload) {
  payload = payload || {};

  var email = String(payload.email || '').trim().toLowerCase();

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Submissions');
  if (!sheet) {
    throw new Error('Submissions sheet not found');
  }

  var data = sheet.getDataRange().getValues();
  var submissions = [];

  var emailIndex = findSubmissionEmailIndex_(data[0]);

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIndex] || '').trim().toLowerCase();
    if (rowEmail === email) {
      var submission = {};
      for (var j = 0; j < data[0].length; j++) {
        submission[normalizeText_(data[0][j])] = serializeDate_(data[i][j]);
      }
      submissions.push(submission);
    }
  }

  return {
    email: email,
    submissions: submissions,
    count: submissions.length
  };
}

function getDomainPlanOptions() {
  return [
    { domain: 'IT', plans: ['Semester 1', 'Semester 2'] },
    { domain: 'Non-IT', plans: ['Semester 1'] }
  ];
}

function resolveFeedbackSheet_(category) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  
  // Map category names to actual sheet names
  var categoryToSheetName = {
    'behavioral': 'BA Feedback',
    'behavioural': 'BA Feedback',
    'presentation': 'Presentation Feedback',
    'csm': 'CSM Feedback',
    '1o1': '1o1 Feedback',
    '1-on-1': '1o1 Feedback'
  };
  
  var categoryLower = String(category).toLowerCase().trim();
  var mappedName = categoryToSheetName[categoryLower];
  
  if (mappedName) {
    var sheet = ss.getSheetByName(mappedName);
    if (sheet) return sheet;
  }
  
  // Try exact match with "Feedback - " prefix
  var exactName = 'Feedback - ' + category;
  var sheet = ss.getSheetByName(exactName);
  if (sheet) return sheet;
  
  // Try case-insensitive match
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    var normalized = String(sheetName).toLowerCase().trim();
    var target = 'feedback - ' + categoryLower;
    if (normalized === target) {
      return sheets[i];
    }
  }
  
  // Try partial match (contains category name)
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    var normalized = String(sheetName).toLowerCase().trim();
    if (normalized.indexOf('feedback') !== -1 && normalized.indexOf(categoryLower) !== -1) {
      return sheets[i];
    }
  }
  
  // Try without "Feedback -" prefix (just category name)
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    var normalized = String(sheetName).toLowerCase().trim();
    if (normalized === categoryLower) {
      return sheets[i];
    }
  }
  
  // List available feedback sheets for debugging
  var availableFeedbackSheets = [];
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    if (sheetName.toLowerCase().indexOf('feedback') !== -1) {
      availableFeedbackSheets.push(sheetName);
    }
  }
  
  if (availableFeedbackSheets.length > 0) {
    throw new Error('Could not resolve feedback sheet for category: ' + category + '. Available feedback sheets: ' + availableFeedbackSheets.join(', '));
  }
  
  return null;
}

function getFeedbackSheetCandidates_(category) {
  var sheet = resolveFeedbackSheet_(category);
  if (!sheet) return [];

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var candidates = [];

  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').trim();
    if (header && !header.match(/email|mail/i)) {
      candidates.push({ name: header, colIndex: i });
    }
  }

  return candidates;
}

function resolveActivityPointsSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Activity Points');
}

function findHeaderIndex_(headers, keywords) {
  for (var i = 0; i < headers.length; i++) {
    var header = normalizeText_(headers[i]);
    for (var j = 0; j < keywords.length; j++) {
      if (header.indexOf(keywords[j]) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

function findSubmissionEmailIndex_(headers) {
  var emailIndex = findHeaderIndex_(headers, ['email', 'mail']);
  if (emailIndex !== -1) return emailIndex;
  
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).match(/@/)) {
      return i;
    }
  }
  
  throw new Error('Email column not found in submissions');
}

function normalizeText_(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function serializeDate_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function parseScoreRows_(rowsText, expectedWidth) {
  var rows = [];
  var lines = rowsText.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var line = String(lines[i]).trim();
    if (!line) continue;

    var cells = line.split('\t');
    if (cells.length < expectedWidth) {
      throw new Error('Line ' + (i + 1) + ' has insufficient columns');
    }

    if (cells.length > expectedWidth) {
      cells = cells.slice(0, expectedWidth);
    }

    if (!cells[0] || !String(cells[0]).match(/@/)) {
      throw new Error('Line ' + (i + 1) + ' is missing an email id.');
    }

    cells[0] = cells[0].toLowerCase();
    rows.push(cells);
  }

  return rows;
}

function parsePayload_(e) {
  if (e && e.parameter && e.parameter.payload) {
    try {
      return JSON.parse(e.parameter.payload);
    } catch (_err) {
      throw new Error('Invalid JSON in payload parameter');
    }
  }
  throw new Error('Empty request body or missing payload parameter');
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
  
  var level1 = getLevelData_(ss, 'Level 1', 18);
  var level2 = getLevelData_(ss, 'Level 2', 12);
  var level3 = getLevelData_(ss, 'Level 3', 11);
  
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
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var email = row[2];
    var status = row[statusColumnIndex];
    
    if (status && String(status).indexOf('Pending:') !== -1) {
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

function verifyStudentEmail(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  
  if (!email) {
    throw new Error('Email is required');
  }
  
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = String(props.getProperty('DATABASE_SPREADSHEET_ID') || '').trim();
  
  if (!spreadsheetId) {
    throw new Error('DATABASE_SPREADSHEET_ID not configured in Script Properties');
  }
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName('Level 1');
  
  if (!sheet) {
    throw new Error('Level 1 sheet not found in training database');
  }
  
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][2] || '').trim().toLowerCase();
    if (rowEmail === email) {
      return {
        verified: true,
        email: email,
        message: 'Email verified successfully'
      };
    }
  }
  
  return {
    verified: false,
    email: email,
    message: 'Email not found in authorized student list'
  };
}

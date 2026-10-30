function doPost(e) {
  try {
    var payload = parsePayload_(e);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'getSubmissions') {
      data = getSubmissions_(payload);
    } else if (action === 'submitActivityPoints') {
      data = submitActivityPoints_(payload);
    } else if (action === 'getFormConfig') {
      data = getFormConfig_();
    } else if (action === 'saveFormConfig') {
      data = saveFormConfig_(payload);
    } else {
      throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse_(true, data, 'OK');
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
}

function parsePayload_(e) {
  if (!e) {
    throw new Error('Empty request');
  }

  // Handle FormData (parameters are in e.parameter)
  if (e.parameter) {
    var payload = {};
    for (var key in e.parameter) {
      if (Object.prototype.hasOwnProperty.call(e.parameter, key)) {
        payload[key] = e.parameter[key];
      }
    }
    // Check if we have any meaningful parameters
    if (Object.keys(payload).length > 0) {
      return payload;
    }
  }

  // Handle JSON (from postData.contents)
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_err) {
      throw new Error('Invalid JSON body');
    }
  }

  throw new Error('Empty request body');
}

function getSubmissions_(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var sheetName = 'Submissions';

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var emailIndex = findHeaderIndex_(headers, ['student email id']);
  var timestampIndex = findHeaderIndex_(headers, ['timestamp', 'date']);

  if (emailIndex === -1) {
    throw new Error('Email column not found in sheet');
  }

  var proofIndex = findHeaderIndex_(headers, ['evidence link', 'links', 'proof', 'certificate link']);
  var courseIndex = findHeaderIndex_(headers, ['activities', 'activity']);
  var statusIndex = findHeaderIndex_(headers, ['status']);
  var reasonIndex = findHeaderIndex_(headers, ['reason']);

  var results = [];

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIndex] || '').trim().toLowerCase();

    if (rowEmail === email) {
      var submission = {
        date: timestampIndex === -1 ? '' : serializeDate_(data[i][timestampIndex]),
        timestamp: timestampIndex === -1 || !data[i][timestampIndex]
          ? null
          : new Date(data[i][timestampIndex]).getTime()
      };

      if (courseIndex !== -1) {
        submission.course = String(data[i][courseIndex] || '');
      }

      if (proofIndex !== -1) {
        submission.proof = String(data[i][proofIndex] || '');
      }

      if (statusIndex !== -1) {
        submission.status = String(data[i][statusIndex] || '');
      }

      if (reasonIndex !== -1) {
        submission.reason = String(data[i][reasonIndex] || '');
      }

      results.push(submission);
    }
  }

  return {
    email: email,
    count: results.length, 
    submissions: results
  };
}

function submitActivityPoints_(payload) {
  var config = getFormConfig_().config;
  var configuredFieldIds = getConfiguredFieldIds_(config);
  if (Object.keys(configuredFieldIds).length === 0) {
    throw new Error('The activity-points form configuration has not been saved by an admin yet.');
  }

  var studentName = String(payload.studentName || '').trim();
  var studentEmailId = String(payload.studentEmailId || '').trim().toLowerCase();
  if (!studentName || !studentEmailId) {
    throw new Error('Student name and Student Email ID are required.');
  }

  var submissionFields = {};
  Object.keys(payload).forEach(function(fieldId) {
    if ((configuredFieldIds[fieldId] || fieldId === 'certificateLink') && String(payload[fieldId] || '').trim()) {
      submissionFields[fieldId] = String(payload[fieldId]).trim();
    }
  });

  var sheet = getOrCreateSubmissionsSheet_();
  var headers = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];
  var requiredHeaders = [
    'Submission ID', 'Timestamp', 'Student Name', 'Student Email ID',
    'Activity Category', 'Subscription Type', 'Course', 'Activity Title',
    'Certificate Title', 'Profile URL', 'Project 1 Name', 'Project 1 Link',
    'Project 2 Name', 'Project 2 Link', 'Project 3 Name', 'Project 3 Link',
    'Project 4 Name', 'Project 4 Link', 'Evidence Link', 'Additional Details',
    'Activities', 'Status', 'Reason'
  ];

  headers = ensureSubmissionHeaders_(sheet, headers, requiredHeaders);

  var course = getFirstSubmissionValue_(submissionFields, [
    'mandatoryCourse', 'sdCourse', 'dsCourse', 'placementSdCourse', 'placementDsCourse'
  ]);
  var activityTitle = getFirstSubmissionValue_(submissionFields, [
    'dbmsActivityTitle', 'pdsaActivityTitle', 'scActivityTitle',
    'placementScActivityTitle', 'cloudActivityTitleCMA', 'placementCloudActivityTitle',
    'javaActivityTitle', 'mlpActivityTitle', 'dvdActivityTitle', 'awsActivityTitle',
    'dlpNppeActivityTitle', 'which-nppe'
  ]);
  var certificateTitle = submissionFields.certificateTitle || '';
  var profileUrl = getFirstProfileUrl_(submissionFields);
  var activities = [course, activityTitle, certificateTitle].filter(Boolean);
  var mappedFieldIds = {
    studentName: true,
    activityType: true,
    subscriptionType: true,
    mandatoryCourse: true,
    sdCourse: true,
    dsCourse: true,
    placementSdCourse: true,
    placementDsCourse: true,
    dbmsActivityTitle: true,
    pdsaActivityTitle: true,
    scActivityTitle: true,
    placementScActivityTitle: true,
    cloudActivityTitleCMA: true,
    placementCloudActivityTitle: true,
    javaActivityTitle: true,
    mlpActivityTitle: true,
    dvdActivityTitle: true,
    awsActivityTitle: true,
    dlpNppeActivityTitle: true,
    'which-nppe': true,
    certificateTitle: true,
    certificateLink: true,
    dbmsHackerrankProfile: true,
    pdsaLeetcodeProfile: true,
    javaHackerrankProfile: true,
    seHackerrankProfile: true,
    scHackerrankProfile: true,
    project1Name: true,
    project1Link: true,
    project2Name: true,
    project2Link: true,
    project3Name: true,
    project3Link: true,
    project4Name: true,
    project4Link: true
  };
  var additionalDetails = {};
  Object.keys(submissionFields).forEach(function(fieldId) {
    if (!mappedFieldIds[fieldId]) additionalDetails[fieldId] = submissionFields[fieldId];
  });

  var rowValues = {
    'Submission ID': Utilities.getUuid(),
    'Timestamp': new Date(),
    'Student Name': studentName,
    'Student Email ID': studentEmailId,
    'Activity Category': submissionFields.activityType || '',
    'Subscription Type': submissionFields.subscriptionType || '',
    'Course': course,
    'Activity Title': activityTitle,
    'Certificate Title': certificateTitle,
    'Profile URL': profileUrl,
    'Project 1 Name': submissionFields.project1Name || '',
    'Project 1 Link': submissionFields.project1Link || '',
    'Project 2 Name': submissionFields.project2Name || '',
    'Project 2 Link': submissionFields.project2Link || '',
    'Project 3 Name': submissionFields.project3Name || '',
    'Project 3 Link': submissionFields.project3Link || '',
    'Project 4 Name': submissionFields.project4Name || '',
    'Project 4 Link': submissionFields.project4Link || '',
    'Evidence Link': submissionFields.certificateLink || '',
    'Additional Details': JSON.stringify(additionalDetails),
    'Activities': activities.join(', '),
    'Status': 'Pending',
    'Reason': ''
  };
  var rowData = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowValues, String(header || '').trim())
      ? rowValues[String(header || '').trim()]
      : '';
  });
  sheet.appendRow(rowData);

  return {
    message: 'Submission recorded successfully',
    timestamp: new Date().toISOString()
  };
}

function getOrCreateSubmissionsSheet_() {
  var spreadsheet = SpreadsheetApp.getActive();
  var sheet = spreadsheet.getSheetByName('Submissions');
  if (!sheet) sheet = spreadsheet.insertSheet('Submissions');
  return sheet;
}

function getConfiguredFieldIds_(config) {
  var fieldIds = {};
  var sections = config && Array.isArray(config.sections) ? config.sections : [];
  sections.forEach(function(section) {
    (section.fields || []).forEach(function(field) {
      if (field && field.id) fieldIds[field.id] = true;
    });
  });
  return fieldIds;
}

function getFirstSubmissionValue_(fields, fieldIds) {
  for (var i = 0; i < fieldIds.length; i++) {
    if (fields[fieldIds[i]]) return fields[fieldIds[i]];
  }
  return '';
}

function getFirstProfileUrl_(fields) {
  var profileFieldId = Object.keys(fields).find(function(fieldId) {
    return /profile$/i.test(fieldId);
  });
  return profileFieldId ? fields[profileFieldId] : '';
}

function ensureSubmissionHeaders_(sheet, headers, requiredHeaders) {
  if (sheet.getLastRow() <= 1) {
    var lastColumn = sheet.getLastColumn();
    if (lastColumn > requiredHeaders.length) {
      sheet.getRange(1, requiredHeaders.length + 1, 1, lastColumn - requiredHeaders.length).clearContent();
    }
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }

  for (var i = 0; i < requiredHeaders.length; i++) {
    headers = ensureSubmissionHeader_(sheet, headers, requiredHeaders[i]);
  }
  return headers;
}

function ensureSubmissionHeader_(sheet, headers, header) {
  var existing = findHeaderIndex_(headers, [header]);
  if (existing !== -1) return headers;

  var column = headers.length + 1;
  sheet.getRange(1, column).setValue(header);
  headers.push(header);
  return headers;
}

function findHeaderIndex_(headers, candidates) {
  var normalizedCandidates = candidates.map(function(candidate) {
    return String(candidate || '').trim().toLowerCase();
  });
  return headers.findIndex(function(header) {
    return normalizedCandidates.indexOf(String(header || '').trim().toLowerCase()) !== -1;
  });
}

function serializeDate_(value) {
  if (!value) return '';
  var d = new Date(value);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy, hh:mm a');
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

function getFormConfig_() {
  var sheetName = 'Form Config';
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  
  if (!sheet) {
    // Create the sheet if it doesn't exist
    sheet = SpreadsheetApp.getActive().insertSheet(sheetName);
    sheet.appendRow(['Key', 'Value', 'Last Updated']);
    
    // Initialize with default config
    var defaultConfig = {
      sections: []
    };
    sheet.getRange(2, 1).setValue('config');
    sheet.getRange(2, 2).setValue(JSON.stringify(defaultConfig));
    sheet.getRange(2, 3).setValue(new Date());
  }
  
  var data = sheet.getDataRange().getValues();
  var configRow = data.find(row => row[0] === 'config');
  
  if (configRow && configRow[1]) {
    return {
      config: JSON.parse(configRow[1]),
      lastUpdated: configRow[2] ? new Date(configRow[2]).toISOString() : null
    };
  }
  
  return {
    config: { sections: [] },
    lastUpdated: null
  };
}

function saveFormConfig_(payload) {
  var config = payload.config;

  // FormData values arrive as strings; JSON requests may already contain an object.
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (_err) {
      throw new Error('Invalid config format');
    }
  }

  if (!config || !Array.isArray(config.sections)) {
    throw new Error('Invalid config format');
  }

  var sheetName = 'Form Config';
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = SpreadsheetApp.getActive().insertSheet(sheetName);
    sheet.appendRow(['Key', 'Value', 'Last Updated']);
  }
  
  var data = sheet.getDataRange().getValues();
  var configRowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'config') {
      configRowIndex = i + 1;
      break;
    }
  }

  var configJson = JSON.stringify(config);
  if (configRowIndex !== -1) {
    sheet.getRange(configRowIndex, 2).setValue(configJson);
    sheet.getRange(configRowIndex, 3).setValue(new Date());
  } else {
    sheet.appendRow(['config', configJson, new Date()]);
  }

  return {
    message: 'Form configuration saved successfully',
    lastUpdated: new Date().toISOString()
  };
}

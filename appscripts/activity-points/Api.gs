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
  var sheetName = String('Form Responses 2').trim();

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var emailIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'student email id'
  );

  if (emailIndex === -1) {
    throw new Error('Email column not found in sheet');
  }

  var proofIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'links'
  );

  var courseIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'activities'
  );

  var statusIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'status'
  );

  var reasonIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'reason'
  );

  var results = [];

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailIndex] || '').trim().toLowerCase();

    if (rowEmail === email) {
      var submission = {
        date: serializeDate_(data[i][0]),
        timestamp: data[i][0] ? new Date(data[i][0]).getTime() : null
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
  var sheetName = String('Form Responses 2').trim();
  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  var headers = sheet.getDataRange().getValues()[0];
  var rowData = new Array(headers.length).fill('');
  
  // Map form field IDs to column names
  var fieldMapping = {
    'email': 'Email Address',
    'studentName': 'Student Name',
    'studentEmailId': 'Student Email ID',
    'activityType': 'Activity Type',
    'mandatoryCourse': 'Select the Mandatory Course',
    'subscriptionType': 'Choose your Subscription Type',
    'sdCourse': 'Select the Software Development Course',
    'dsCourse': 'Select the Data Science Course',
    'placementSdCourse': 'Select the Software Development Course',
    'placementDsCourse': 'Select the Data Science Course',
    'dbmsActivityTitle': 'Activity Title for DBMS',
    'dbmsHackerrankProfile': 'Link to Hackerrank Profile',
    'pdsaActivityTitle': 'Activity Title for PDSA',
    'pdsaLeetcodeProfile': 'Link to Leetcode Profile',
    'scActivityTitle': 'Activity Title for System Commands',
    'scVmTasksCount': 'How many questions have you finished in VM Tasks?',
    'scHackerrankProfile': 'Link to Hackerrank Profile',
    'cloudActivityTitle': 'Activity Title for Cloud & DevOps',
    'certificateTitle': 'Certificate Title',
    'javaActivityTitle': 'Activity Title for JAVA',
    'javaHackerrankProfile': 'Link to Hackerrank  Profile',
    'project1Name': 'Project 1 Name',
    'project1Link': 'Project 1 (GitHub Link)',
    'project2Name': 'Project 2 Name',
    'project2Link': 'Project 2 (GitHub Link)',
    'project3Name': 'Project 3 Name',
    'project3Link': 'Project 3 (GitHub Link)',
    'project4Name': 'Project 4 Name',
    'project4Link': 'Project 4 (GitHub Link)',
    'seHackerrankProfile': 'Link to You HackerRank Profile',
    'mlpActivityTitle': 'Activity Title for MLP',
    'dvdActivityTitle': 'Activity Title for Data Visualization Design',
    'awsActivityTitle': 'Activity Title for AWS',
    'certificateLink': 'links'
  };

  // Set timestamp
  rowData[0] = new Date();

  // Build activities string for the 'Activities' column
  var activities = [];
  
  // Map form data to columns
  for (var fieldId in payload) {
    if (fieldId === 'action') continue;
    
    var value = String(payload[fieldId] || '').trim();
    if (!value) continue;

    var columnName = fieldMapping[fieldId];
    if (columnName) {
      var columnIndex = headers.findIndex(
        h => String(h || '').trim().toLowerCase() === columnName.toLowerCase()
      );
      
      if (columnIndex !== -1) {
        rowData[columnIndex] = value;
        
        // Add to activities list if it's an activity title
        if (columnName.includes('Activity Title') || 
            columnName.includes('Course') ||
            columnName.includes('Project') ||
            columnName.includes('Certificate')) {
          activities.push(value);
        }
      }
    }
  }

  // Set the Activities column
  var activitiesIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'activities'
  );
  if (activitiesIndex !== -1) {
    rowData[activitiesIndex] = activities.join(', ');
  }

  // Append row to sheet Status and Reason will be filled by admin
  var statusIndex = headers.findIndex(
    h => String(h || '').trim().toLowerCase() === 'status'
  );
  if (statusIndex !== -1) {
    rowData[statusIndex] = 'Pending';
  }

  sheet.appendRow(rowData);

  return {
    message: 'Submission recorded successfully',
    timestamp: new Date().toISOString()
  };
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
  
  // Find existing config row
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'config') {
      configRowIndex = i + 1;
      break;
    }
  }
  
  var configJson = JSON.stringify(config);
  
  if (configRowIndex !== -1) {
    // Update existing row
    sheet.getRange(configRowIndex, 2).setValue(configJson);
    sheet.getRange(configRowIndex, 3).setValue(new Date());
  } else {
    // Append new row
    sheet.appendRow(['config', configJson, new Date()]);
  }
  
  return {
    message: 'Form configuration saved successfully',
    lastUpdated: new Date().toISOString()
  };
}

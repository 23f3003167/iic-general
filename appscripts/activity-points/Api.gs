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
    'placementScActivityTitle': 'Activity Title for System Commands',
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

  // Some response-sheet headers are duplicated (for example, HackerRank
  // profile columns). These fields must target their exact worksheet columns.
  // Indices below are zero-based: Q=16, S=18, X:AE=23:30, AF=31, AG=32.
  var fixedColumnIndices = {
    'scActivityTitle': 16,
    'placementScActivityTitle': 16,
    'scHackerrankProfile': 18,
    'project1Name': 23,
    'project1Link': 24,
    'project2Name': 25,
    'project2Link': 26,
    'project3Name': 27,
    'project3Link': 28,
    'project4Name': 29,
    'project4Link': 30,
    'seHackerrankProfile': 31,
    'mlpActivityTitle': 32
  };

  // Both Cloud & DevOps paths write their selected activity to the same sheet
  // column. Use one normalized field to avoid duplicate activity entries.
  if (payload.cloudActivityTitleCMA) {
    payload['cloudActivityTitle'] = payload.cloudActivityTitleCMA;
  } else if (payload.placementCloudActivityTitle) {
    payload['cloudActivityTitle'] = payload.placementCloudActivityTitle;
  }

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
      var columnIndex = Object.prototype.hasOwnProperty.call(fixedColumnIndices, fieldId)
        ? fixedColumnIndices[fieldId]
        : headers.findIndex(
            h => String(h || '').trim().toLowerCase() === columnName.toLowerCase()
          );
      
      if (columnIndex !== -1 && columnIndex < headers.length) {
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
    var savedConfig = normalizeCloudDevOpsPaths_(JSON.parse(configRow[1]));
    return {
      config: savedConfig,
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

  config = normalizeCloudDevOpsPaths_(config);
  
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

var CLOUD_DEVOPS_SECTION_IDS_ = {
  'cloud-devops': true,
  'cloud-devops-cma': true,
  'placement-cloud-devops': true,
  'associate-certifications': true
};

function normalizeCloudDevOpsPaths_(config) {
  // Keep the empty-config fallback intact: the web app uses its full bundled
  // definition until an administrator has saved a configuration.
  if (!config || !Array.isArray(config.sections) || config.sections.length === 0) {
    return config;
  }

  var normalized = {};
  for (var key in config) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      normalized[key] = config[key];
    }
  }

  normalized.sections = config.sections.filter(function(section) {
    return !CLOUD_DEVOPS_SECTION_IDS_[section.id];
  }).concat(getCloudDevOpsSections_());

  return normalized;
}

function getCloudDevOpsSections_() {
  return [
    {
      id: 'cloud-devops-cma',
      title: 'Cloud & DevOps (CMA)',
      requiresCertificateUpload: true,
      conditionalLogic: {
        showWhen: [
          { fieldId: 'activityType', equals: 'Common Mandatory Activity Points' },
          { fieldId: 'mandatoryCourse', equals: 'Cloud & DevOps' }
        ]
      },
      fields: [
        {
          id: 'cloudActivityTitleCMA',
          label: 'Activity Title for Cloud & DevOps',
          type: 'radio',
          required: true,
          options: [
            'Intro to Cloud Computing by Simplilearn',
            'AWS Cloud Foundation Course',
            'Any other Similar Certifications'
          ]
        }
      ]
    },
    {
      id: 'placement-cloud-devops',
      title: 'Cloud & DevOps (AM_EP)',
      requiresCertificateUpload: true,
      conditionalLogic: {
        showWhen: [
          { fieldId: 'activityType', equals: 'Additional Mandatory Activity Points' },
          { fieldId: 'subscriptionType', equals: 'Placement - Software Development' },
          { fieldId: 'placementSdCourse', equals: 'Cloud & DevOps' }
        ]
      },
      fields: [
        {
          id: 'placementCloudActivityTitle',
          label: 'Activity Title for Cloud & DevOps',
          type: 'radio',
          required: true,
          options: ['Associate Certification']
        }
      ]
    },
    {
      id: 'associate-certifications',
      title: 'Associate Certifications',
      requiresCertificateUpload: true,
      conditionalLogic: {
        showWhen: [
          { fieldId: 'activityType', equals: 'Additional Mandatory Activity Points' },
          { fieldId: 'subscriptionType', equals: 'Placement - Software Development' },
          { fieldId: 'placementSdCourse', equals: 'Cloud & DevOps' },
          { fieldId: 'placementCloudActivityTitle', equals: 'Associate Certification' }
        ]
      },
      fields: [
        {
          id: 'certificateTitle',
          label: 'Certificate Title',
          type: 'radio',
          required: true,
          options: [
            'Microsoft Azure AZ204',
            'AWS Certified Solutions Architect – Associate',
            'AWS Certified Developer – Associate',
            'AWS Certified SysOps Administrator – Associate',
            'Google Associate Certifications'
          ]
        }
      ]
    }
  ];
}

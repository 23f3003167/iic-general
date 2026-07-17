function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'getSubmissions') {
      data = getSubmissions_(payload);
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

function getSubmissions_(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var sheetName = String(payload.sheetName || 'Form Responses 2').trim();

  if (!email) {
    throw new Error('Email is required');
  }

  var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  // Detect Email Column (auto)
  var emailIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').trim().toLowerCase();
    if (header.indexOf('student email id') !== -1 || header.indexOf('email') !== -1) {
      emailIndex = i;
      break;
    }
  }

  if (emailIndex === -1) {
    throw new Error('Email column not found in sheet');
  }

  // Detect Certificate Link Column
  var proofIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').trim().toLowerCase();
    if (header.indexOf('paste the link below') !== -1 || header.indexOf('proof') !== -1 || header.indexOf('certificate') !== -1) {
      proofIndex = i;
      break;
    }
  }

  // Detect Activities/Course Column
  var courseIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || '').trim().toLowerCase();
    if (header.indexOf('activities') !== -1 || header.indexOf('course') !== -1 || header.indexOf('activity') !== -1) {
      courseIndex = i;
      break;
    }
  }

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

      results.push(submission);
    }
  }

  return {
    email: email,
    count: results.length,
    submissions: results
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

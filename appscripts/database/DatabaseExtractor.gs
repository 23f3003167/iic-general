/**
 * Google Apps Script to extract email IDs by pending category from spreadsheet
 * 
 * This script reads data from Level 1, Level 2, and Level 3 sheets
 * and extracts email IDs based on pending activities
 * 
 * Column mappings:
 * - Column C (index 2): Email IDs
 * - Level 1: Column S (index 18): Level 1 (Pass/Fail)
 * - Level 2: Column M (index 12): Level 2 (Pass/Fail)
 * - Level 3: Column L (index 11): Level 3 (Pass/Fail)
 */

// CONFIGURATION - Replace with your actual spreadsheet ID
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

/**
 * Main function to handle web app requests
 */
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;
  const email = e.parameter.email;
  
  let data;
  
  if (action === 'level1') {
    data = getLevel1Data();
  } else if (action === 'level2') {
    data = getLevel2Data();
  } else if (action === 'level3') {
    data = getLevel3Data();
  } else if (action === 'all') {
    data = getAllData();
  } else if (action === 'searchStudent') {
    data = searchStudentByEmail(email);
  } else {
    data = {
      error: 'Invalid action. Use: level1, level2, level3, all, or searchStudent'
    };
  }
  
  // If callback is provided, use JSONP (for CORS workaround)
  if (callback) {
    const jsonpData = JSON.stringify(data);
    const jsonpResponse = callback + '(' + jsonpData + ')';
    return ContentService
      .createTextOutput(jsonpResponse)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return createResponse(data);
}

/**
 * Get Level 1 pending data
 */
function getLevel1Data() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Level 1');
  if (!sheet) {
    return { error: 'Level 1 sheet not found' };
  }
  
  const data = sheet.getDataRange().getValues();
  const categories = {};
  
  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = row[2]; // Column C
    const status = row[18]; // Column S - Level 1 (Pass/Fail)
    
    // Check if status indicates pending activities
    if (status && status.toString().includes('Pending:')) {
      // Extract the pending category
      const category = status.toString().replace('Pending: ', '').trim();
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(email);
    }
  }
  
  return {
    level: 'Level 1',
    categories: categories
  };
}

/**
 * Get Level 2 pending data
 */
function getLevel2Data() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Level 2');
  if (!sheet) {
    return { error: 'Level 2 sheet not found' };
  }
  
  const data = sheet.getDataRange().getValues();
  const categories = {};
  
  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = row[2]; // Column C
    const status = row[12]; // Column M - Level 2 (Pass/Fail)
    
    // Check if status indicates pending activities
    if (status && status.toString().includes('Pending:')) {
      // Extract the pending category
      const category = status.toString().replace('Pending: ', '').trim();
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(email);
    }
  }
  
  return {
    level: 'Level 2',
    categories: categories
  };
}

/**
 * Get Level 3 pending data
 */
function getLevel3Data() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Level 3');
  if (!sheet) {
    return { error: 'Level 3 sheet not found' };
  }
  
  const data = sheet.getDataRange().getValues();
  const categories = {};
  
  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = row[2]; // Column C
    const status = row[11]; // Column L - Level 3 (Pass/Fail)
    
    // Check if status indicates pending activities
    if (status && status.toString().includes('Pending:')) {
      // Extract the pending category
      const category = status.toString().replace('Pending: ', '').trim();
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(email);
    }
  }
  
  return {
    level: 'Level 3',
    categories: categories
  };
}

/**
 * Get all levels data
 */
function getAllData() {
  const level1 = getLevel1Data();
  const level2 = getLevel2Data();
  const level3 = getLevel3Data();
  
  return {
    level1: level1,
    level2: level2,
    level3: level3
  };
}

/**
 * Search student row in all level sheets by email
 */
function searchStudentByEmail(email) {
  const normalizedEmail = normalizeEmail_(email);
  if (!normalizedEmail) {
    return { error: 'Email is required for searchStudent action' };
  }

  return {
    email: normalizedEmail,
    level1: getStudentRowByEmail_('Level 1', normalizedEmail, ['PPM Attempt', 'CSM Attempt']),
    level2: getStudentRowByEmail_('Level 2', normalizedEmail, ['SA Attempt', 'BA Attempt', 'PR Attempt']),
    level3: getStudentRowByEmail_('Level 3', normalizedEmail, ['TMCQ Attempt', 'AI Attempt', '1on1 Attempt'])
  };
}

function getStudentRowByEmail_(sheetName, email, attemptHeaders) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    return {
      level: sheetName,
      found: false,
      error: sheetName + ' sheet not found'
    };
  }

  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return {
      level: sheetName,
      found: false
    };
  }

  const headers = data[0];
  const emailIndex = findHeaderIndex_(headers, ['email']);
  if (emailIndex < 0) {
    return {
      level: sheetName,
      found: false,
      error: 'Email column not found in ' + sheetName
    };
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmail = normalizeEmail_(row[emailIndex]);
    if (rowEmail !== email) {
      continue;
    }

    const fields = [];
    for (let c = 0; c < headers.length; c++) {
      fields.push({
        header: String(headers[c] || '').trim(),
        value: stringifyCell_(row[c])
      });
    }

    const attempts = [];
    for (let a = 0; a < attemptHeaders.length; a++) {
      const attemptHeader = attemptHeaders[a];
      const attemptIndex = findHeaderIndex_(headers, [attemptHeader]);
      attempts.push({
        header: attemptHeader,
        value: attemptIndex >= 0 ? stringifyCell_(row[attemptIndex]) : ''
      });
    }

    return {
      level: sheetName,
      found: true,
      fields: fields,
      attempts: attempts
    };
  }

  return {
    level: sheetName,
    found: false
  };
}

function findHeaderIndex_(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim().toLowerCase();
    if (!header) continue;

    let matched = true;
    for (let k = 0; k < keywords.length; k++) {
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

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function stringifyCell_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/**
 * Create JSON response with CORS headers
 */
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle OPTIONS request for CORS preflight
 */
function doOptions(e) {
  var output = ContentService.createTextOutput("");
  output.setMimeType(ContentService.MimeType.TEXT);
  return output;
}

/**
 * Helper function to test the script
 * Run this function in the Apps Script editor to test
 */
function testScript() {
  // Test Level 1
  const level1Result = getLevel1Data();
  Logger.log('Level 1 Result: ' + JSON.stringify(level1Result));
  
  // Test Level 2
  const level2Result = getLevel2Data();
  Logger.log('Level 2 Result: ' + JSON.stringify(level2Result));
  
  // Test Level 3
  const level3Result = getLevel3Data();
  Logger.log('Level 3 Result: ' + JSON.stringify(level3Result));
}

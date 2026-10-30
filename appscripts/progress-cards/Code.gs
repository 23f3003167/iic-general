function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Progress Cards')
    .addItem('Send feedback form to selected row', 'sendFeedbackFormForSelectedRow')
    .addItem('Generate reports and send forms to eligible students', 'sendFeedbackFormToAllUnsentPassedStudents')
    .addItem('Send progress card to selected row', 'sendProgressCardForSelectedRow')
    .addItem('Send progress cards for submitted forms', 'sendProgressCardsForPendingSubmissions')
    .addSeparator()
    .addItem('Regenerate card for selected row', 'regenerateSelectedProgressCard')
    .addItem('Regenerate and email updated card', 'regenerateAndEmailSelectedProgressCard')
    .addItem('Resend latest card for selected row', 'resendSelectedProgressCard')
    .addSeparator()
    .addItem('Set up progress card triggers', 'setupProgressCardTriggers')
    .addToUi();
}

function setupProgressCardTriggers() {
  var sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!sourceSpreadsheet || sourceSpreadsheet.getName() !== PROGRESS_CARD_CONFIG.sourceSpreadsheetName) {
    throw new Error('Open the Training Database - 2026 spreadsheet before running setup.');
  }

  var level3Sheet = sourceSpreadsheet.getSheetByName('Level 3');
  if (!level3Sheet) throw new Error('The Level 3 sheet was not found.');
  ensureOutputHeaders_(level3Sheet);

  var properties = PropertiesService.getScriptProperties();
  var responseSpreadsheetId = properties.getProperty('PROGRESS_CARD_RESPONSE_SPREADSHEET_ID');
  var responseSheetId = Number(properties.getProperty('PROGRESS_CARD_RESPONSE_SHEET_ID'));
  if (!responseSpreadsheetId || !responseSheetId) {
    var prompt = SpreadsheetApp.getUi().prompt(
      'Feedback response spreadsheet',
      'Paste the Google Sheets URL for the feedback responses spreadsheet. Its gid is read from the URL.',
      SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
    );
    if (prompt.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return;
    var responseLocation = parseSpreadsheetLocation_(prompt.getResponseText());
    responseSpreadsheetId = responseLocation.spreadsheetId;
    responseSheetId = responseLocation.sheetId;
    properties.setProperty('PROGRESS_CARD_RESPONSE_SPREADSHEET_ID', responseSpreadsheetId);
    properties.setProperty('PROGRESS_CARD_RESPONSE_SHEET_ID', String(responseSheetId));
  }

  var responseSpreadsheet = SpreadsheetApp.openById(responseSpreadsheetId);
  var responseSheet = getSheetById_(responseSpreadsheet, responseSheetId);
  if (!responseSheet) throw new Error('The configured feedback response sheet was not found.');
  var responseHeaders = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getDisplayValues()[0];
  if (findHeaderIndex_(responseHeaders, PROGRESS_CARD_CONFIG.formEmailHeader) < 0) {
    throw new Error('The feedback response sheet is missing the "' + PROGRESS_CARD_CONFIG.formEmailHeader + '" column.');
  }

  properties.setProperty('PROGRESS_CARD_SOURCE_SPREADSHEET_ID', sourceSpreadsheet.getId());
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'handleLevel3StatusEdit' || handler === 'handleTrainingFeedbackSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('handleTrainingFeedbackSubmit').forSpreadsheet(responseSpreadsheet).onFormSubmit().create();
  reconcileProgressCardSharing_(level3Sheet);
  SpreadsheetApp.getUi().alert('Progress card triggers are ready.');
}

function handleTrainingFeedbackSubmit(event) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var studentEmail = getSubmittedEmail_(event);
    if (!studentEmail) throw new Error('The submitted form response did not contain a student email.');

    var sourceSpreadsheetId = PropertiesService.getScriptProperties().getProperty('PROGRESS_CARD_SOURCE_SPREADSHEET_ID');
    if (!sourceSpreadsheetId) throw new Error('Run setupProgressCardTriggers from the Training Database spreadsheet first.');
    var sourceSpreadsheet = SpreadsheetApp.openById(sourceSpreadsheetId);
    var level3Sheet = sourceSpreadsheet.getSheetByName('Level 3');
    if (!level3Sheet) throw new Error('The Level 3 sheet was not found.');

    sendPendingProgressCardForStudent_(level3Sheet, studentEmail);
  } finally {
    lock.releaseLock();
  }
}

function getSelectedLevel3Row_() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var activeRange = sheet.getActiveRange();
  var rowNumber = activeRange ? activeRange.getRow() : 0;
  if (sheet.getName() !== 'Level 3' || rowNumber < 2) {
    throw new Error('Select a student row in the Level 3 sheet first.');
  }
  return { sheet: sheet, rowNumber: rowNumber };
}

function sendFeedbackFormForSelectedRow() {
  var selected = getSelectedLevel3Row_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sendFeedbackFormToRow_(selected.sheet, selected.rowNumber);
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert('The feedback form email was sent. Column U now records FORM SENT.');
}

function sendFeedbackFormToAllUnsentPassedStudents() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Generate reports and send forms', 'Generate a team-only PDF and send the feedback form to every Level 3 student with Pass and a blank form-email status in column U?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Level 3');
  ensureOutputHeaders_(sheet);
  var sent = 0;
  var skipped = 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (var rowNumber = 2; rowNumber <= sheet.getLastRow(); rowNumber++) {
      if (normalizeValue_(getCellByHeader_(sheet, rowNumber, 'Level 3 (Pass/Fail)')) !== 'pass' ||
          getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.feedbackRequestHeader)) {
        skipped++;
        continue;
      }
      ensureProgressCardLink_(sheet, rowNumber);
      sendFeedbackFormToRow_(sheet, rowNumber);
      sent++;
    }
  } finally {
    lock.releaseLock();
  }
  ui.alert('Feedback form emails sent: ' + sent + '\nRows skipped: ' + skipped);
}

function sendProgressCardForSelectedRow() {
  var selected = getSelectedLevel3Row_();
  var studentEmail = String(getCellByHeader_(selected.sheet, selected.rowNumber, 'Email') || '').trim();
  if (!studentEmail || !hasSubmittedFeedbackForm_(studentEmail)) {
    throw new Error('No feedback form submission was found for the selected student.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sendProgressCardForStudent_(selected.sheet, studentEmail);
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert('The progress card email was sent. Column T now records REPORT SENT.');
}

function sendProgressCardsForPendingSubmissions() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Send pending progress cards', 'Send progress cards to passed students who submitted the feedback form and do not have REPORT SENT in column T?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Level 3');
  ensureOutputHeaders_(sheet);
  var emails = getSubmittedEmails_();
  var sent = 0;
  var skipped = 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    emails.forEach(function (studentEmail) {
      if (sendPendingProgressCardForStudent_(sheet, studentEmail)) sent++;
      else skipped++;
    });
  } finally {
    lock.releaseLock();
  }
  ui.alert('Progress card emails sent: ' + sent + '\nSubmitted emails skipped: ' + skipped);
}

function sendProgressCardForStudent_(sheet, studentEmail) {
  var rowNumber = findUnsentPassedLevel3Row_(sheet, studentEmail);
  if (!rowNumber) throw new Error('No eligible passed Level 3 row with a progress card was found for ' + studentEmail + '.');
  generateProgressCardForRow_(sheet, rowNumber);
  var reportUrl = String(getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.linkHeader) || '').trim();
  shareProgressCardWithStudent_(sheet, rowNumber);
  sendReportEmail_(studentEmail, reportUrl);
  setCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.statusHeader, 'REPORT SENT');
  return true;
}

function sendPendingProgressCardForStudent_(sheet, studentEmail) {
  var rowNumber = findUnsentPassedLevel3Row_(sheet, studentEmail);
  if (!rowNumber) return false;
  sendProgressCardForStudent_(sheet, studentEmail);
  return true;
}

function sendFeedbackFormToRow_(sheet, rowNumber) {
  ensureOutputHeaders_(sheet);
  if (normalizeValue_(getCellByHeader_(sheet, rowNumber, 'Level 3 (Pass/Fail)')) !== 'pass') {
    throw new Error('The selected student must have Pass in Level 3 column L.');
  }
  ensureProgressCardLink_(sheet, rowNumber);
  var studentEmail = String(getCellByHeader_(sheet, rowNumber, 'Email') || '').trim();
  if (!studentEmail) throw new Error('The selected Level 3 row has no student email.');
  sendFeedbackRequest_(studentEmail);
  setCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.feedbackRequestHeader, 'FORM SENT');
}

function shareProgressCardWithStudent_(sheet, rowNumber) {
  var studentEmail = String(getCellByHeader_(sheet, rowNumber, 'Email') || '').trim();
  if (!studentEmail || !hasSubmittedFeedbackForm_(studentEmail)) {
    throw new Error('Student access is enabled only after a matching feedback form submission.');
  }
  var reportUrl = String(getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.linkHeader) || '').trim();
  var fileIdMatch = reportUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!fileIdMatch) throw new Error('The progress card link is not a valid Drive file URL.');
  var file = DriveApp.getFileById(fileIdMatch[1]);
  var viewers = file.getViewers().map(function (user) { return normalizeEmail_(user.getEmail()); });
  if (viewers.indexOf(normalizeEmail_(studentEmail)) < 0 && normalizeEmail_(file.getOwner().getEmail()) !== normalizeEmail_(studentEmail)) {
    file.addViewer(studentEmail);
  }
}

function reconcileProgressCardSharing_(sheet) {
  var submittedEmails = {};
  getSubmittedEmails_().forEach(function (email) { submittedEmails[email] = true; });
  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0];
  var emailIndex = findHeaderIndex_(headers, 'Email');
  var linkIndex = findHeaderIndex_(headers, PROGRESS_CARD_CONFIG.linkHeader);
  if (emailIndex < 0 || linkIndex < 0) throw new Error('The Level 3 sheet is missing the email or progress card link header.');
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    var studentEmail = String(values[rowIndex][emailIndex] || '').trim();
    var reportUrl = String(values[rowIndex][linkIndex] || '').trim();
    if (!studentEmail || !reportUrl) continue;
    var fileIdMatch = reportUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) continue;
    var file = DriveApp.getFileById(fileIdMatch[1]);
    var hasSubmitted = !!submittedEmails[normalizeEmail_(studentEmail)];
    var viewers = file.getViewers().map(function (user) { return normalizeEmail_(user.getEmail()); });
    var isViewer = viewers.indexOf(normalizeEmail_(studentEmail)) >= 0;
    if (hasSubmitted && !isViewer && normalizeEmail_(file.getOwner().getEmail()) !== normalizeEmail_(studentEmail)) {
      file.addViewer(studentEmail);
    } else if (!hasSubmitted && isViewer) {
      file.removeViewer(studentEmail);
    }
  }
}

function ensureProgressCardLink_(sheet, rowNumber) {
  if (!getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.linkHeader)) {
    generateProgressCardForRow_(sheet, rowNumber);
  }
}

function regenerateSelectedProgressCard() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rowNumber = sheet.getActiveRange().getRow();
  if (sheet.getName() !== 'Level 3' || rowNumber < 2) {
    throw new Error('Select a student row in the Level 3 sheet first.');
  }
  if (normalizeValue_(getCellByHeader_(sheet, rowNumber, 'Level 3 (Pass/Fail)')) !== 'pass') {
    throw new Error('The selected student must have Pass in Level 3 column L.');
  }

  var reportUrl = generateProgressCardForRow_(sheet, rowNumber);
  SpreadsheetApp.getUi().alert('Progress card regenerated and the link updated in column S.\n' + reportUrl);
}

function resendSelectedProgressCard() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rowNumber = sheet.getActiveRange().getRow();
  if (sheet.getName() !== 'Level 3' || rowNumber < 2) {
    throw new Error('Select a student row in the Level 3 sheet first.');
  }

  var studentEmail = String(getCellByHeader_(sheet, rowNumber, 'Email') || '').trim();
  var reportUrl = String(getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.linkHeader) || '').trim();
  if (!studentEmail || !reportUrl) throw new Error('The selected row must have a student email and progress card link.');
  if (normalizeValue_(getCellByHeader_(sheet, rowNumber, 'Level 3 (Pass/Fail)')) !== 'pass') {
    throw new Error('The selected student must have Pass in Level 3 column L.');
  }
  if (normalizeValue_(getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.statusHeader)) !== 'report sent') {
    throw new Error('The student must submit the feedback form before the progress card can be emailed.');
  }
  if (!hasSubmittedFeedbackForm_(studentEmail)) {
    throw new Error('No feedback form submission was found for the selected student.');
  }

  shareProgressCardWithStudent_(sheet, rowNumber);
  sendReportEmail_(studentEmail, reportUrl);
  SpreadsheetApp.getUi().alert('The latest progress card was emailed again.');
}

function regenerateAndEmailSelectedProgressCard() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rowNumber = sheet.getActiveRange().getRow();
  if (sheet.getName() !== 'Level 3' || rowNumber < 2) {
    throw new Error('Select a student row in the Level 3 sheet first.');
  }
  if (normalizeValue_(getCellByHeader_(sheet, rowNumber, 'Level 3 (Pass/Fail)')) !== 'pass') {
    throw new Error('The selected student must have Pass in Level 3 column L.');
  }
  if (normalizeValue_(getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.statusHeader)) !== 'report sent') {
    throw new Error('The student must submit the feedback form before the progress card can be emailed.');
  }

  var studentEmail = String(getCellByHeader_(sheet, rowNumber, 'Email') || '').trim();
  if (!hasSubmittedFeedbackForm_(studentEmail)) {
    throw new Error('No feedback form submission was found for the selected student.');
  }
  var reportUrl = generateProgressCardForRow_(sheet, rowNumber);
  shareProgressCardWithStudent_(sheet, rowNumber);
  sendReportEmail_(studentEmail, reportUrl);
  SpreadsheetApp.getUi().alert('The updated progress card was regenerated and emailed.');
}

function generateProgressCardForRow_(level3Sheet, rowNumber) {
  ensureOutputHeaders_(level3Sheet);
  var studentEmail = String(getCellByHeader_(level3Sheet, rowNumber, 'Email') || '').trim();
  if (!studentEmail) throw new Error('The selected Level 3 row has no student email.');

  var reportData = collectProgressCardData_(level3Sheet.getParent(), rowNumber, studentEmail);
  var html = renderProgressCardHtml_(reportData);
  var fileName = 'IIC Training Progress Card - ' + safeFileName_(reportData.student.name) + ' - ' + dateStamp_();
  var pdf = HtmlService.createHtmlOutput(html).getBlob().getAs(MimeType.PDF).setName(fileName + '.pdf');
  var file = DriveApp.createFile(pdf);

  try {
    PROGRESS_CARD_CONFIG.teamViewerEmails.forEach(function (email) {
      if (normalizeEmail_(email) !== normalizeEmail_(PROGRESS_CARD_CONFIG.ownerEmail)) file.addViewer(email);
    });
    file.setOwner(PROGRESS_CARD_CONFIG.ownerEmail);
  } catch (error) {
    try {
      file.setTrashed(true);
    } catch (ignored) {}
    throw new Error('Could not create an IIC-owned, shared progress card. Check Drive ownership and sharing permissions: ' + error.message);
  }

  setCellByHeader_(level3Sheet, rowNumber, PROGRESS_CARD_CONFIG.linkHeader, file.getUrl());
  return file.getUrl();
}

function collectProgressCardData_(spreadsheet, level3RowNumber, studentEmail) {
  var level3Sheet = spreadsheet.getSheetByName('Level 3');
  var level3Headers = getHeaders_(level3Sheet);
  var level3Values = getRowObject_(level3Headers, level3Sheet.getRange(level3RowNumber, 1, 1, level3Headers.length).getDisplayValues()[0]);
  var student = {
    name: getObjectValue_(level3Values, 'Name') || 'Student',
    email: studentEmail,
    batch: getObjectValue_(level3Values, 'Batch'),
    plan: getObjectValue_(level3Values, 'Plan'),
    domain: getObjectValue_(level3Values, 'Domain')
  };

  var levelDefinitions = [
    {
      name: 'Level 1',
      activities: [
        ['Pre-Placement Module (PPM)', 'PPM', 'PPM - Pass/Fail', 'PPM Attempt', 20],
        ['Self Introduction', 'Self Intro', 'SI Status', 'CSM Attempt', 40],
        ['Listening and Speaking (LS)', 'Listen & Speak', 'LS Status', 'CSM Attempt', 20],
        ['Listening and Writing (LW)', 'Listen & Write', 'LW Status', 'CSM Attempt', 20],
        ['Email Writing', 'Email Writing', 'EW Status', 'CSM Attempt', 20]
      ],
      totalHeader: 'Total',
      totalMaximum: 120,
      statusHeader: 'Level 1 (Pass/Fail)'
    },
    {
      name: 'Level 2',
      activities: [
        ['Self Aptitude', 'Self Aptitude', 'Self Aptitude - Pass/Fail', 'SA Attempt', 30],
        ['Behavioral Assessment (BA)', 'Behavioural', 'Behavioural Pass/Fail', 'BA Attempt', 20],
        ['Presentation', 'Presentation', 'Presentation - Pass/Fail', 'PR Attempt', 30]
      ],
      totalHeader: 'Total',
      totalMaximum: 80,
      statusHeader: 'Level 2 (Pass/Fail)'
    },
    {
      name: 'Level 3',
      activities: [
        ['Tech MCQ', 'TECH MCQ', 'MCQ Pass/Fail', 'TMCQ Attempt', 25],
        ['AI Mock Interview', 'AI MOCK', 'AI Mock Pass/Fail', 'AI Attempt', ''],
        ['1-on-1 with Course Instructor', '1on1 Session', '1on1 Pass/Fail', '1on1 Attempt', ''],
        ['Activity Points', 'Activity Points', '', '', '']
      ],
      totalHeader: '',
      statusHeader: 'Level 3 (Pass/Fail)'
    }
  ];

  var levels = levelDefinitions.map(function (definition) {
    var sheet = spreadsheet.getSheetByName(definition.name);
    var row = definition.name === 'Level 3' ? level3Values : findStudentRow_(sheet, studentEmail);
    var activities = definition.activities.map(function (activity) {
      return {
        name: activity[0],
        mark: activity[1] ? getObjectValue_(row, activity[1]) : '',
        result: activity[2] ? getObjectValue_(row, activity[2]) : '',
        attempt: activity[3] ? getObjectValue_(row, activity[3]) : '',
        maximum: activity[4]
      };
    });
    return {
      name: definition.name,
      activities: activities,
      total: definition.totalHeader ? getObjectValue_(row, definition.totalHeader) : '',
      totalMaximum: definition.totalMaximum || '',
      status: getObjectValue_(row, definition.statusHeader),
      found: !!row
    };
  });

  return {
    student: student,
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMM yyyy'),
    levels: levels,
    feedback: collectFeedback_(spreadsheet, studentEmail)
  };
}

function collectFeedback_(spreadsheet, studentEmail) {
  var feedback = [];
  var csmAttempts = {};
  var csmRows = findStudentRows_(spreadsheet.getSheetByName('CSM Feedback'), studentEmail);
  var csmActivities = [
      ['Self Introduction', 'Feedback - Self Intro'],
      ['Listening and Speaking', 'Feedback - Listening and Speaking'],
      ['Listening and Writing', 'Feedback - Listening and Writing'],
      ['Email Writing', 'Feedback - Email Writing']
  ];
  csmRows.forEach(function (entry) {
    csmActivities.forEach(function (activity) {
      var comment = getObjectValue_(entry.values, activity[1]);
      if (!comment) return;
      csmAttempts[activity[0]] = (csmAttempts[activity[0]] || 0) + 1;
      var attemptNumber = csmAttempts[activity[0]];
      feedback.push({
        source: activity[0],
        attempt: attemptNumber === 1 ? 'First Attempt' : (attemptNumber === 2 ? 'Reattempt' : 'Attempt ' + attemptNumber),
        score: '',
        parts: [{ label: 'Feedback', value: comment }]
      });
    });
  });

  appendSingleFieldFeedback_(feedback, spreadsheet, studentEmail, 'Presentation Feedback', 'Presentation', ['Feedback'], 'Score');
  appendSingleFieldFeedback_(feedback, spreadsheet, studentEmail, 'BA Feedback', 'Behavioral', ['Feedback'], 'Score');
  appendSingleFieldFeedback_(feedback, spreadsheet, studentEmail, '1on1 Feedback', '1-on-1', [
    'If not ready, please mention the list of tasks students should do',
    'What roles they are suitable for? (Recommondations by instructor)',
    'Feedback'
  ], '');
  return feedback;
}

function appendSingleFieldFeedback_(destination, spreadsheet, studentEmail, sheetName, label, feedbackHeaders, scoreHeader) {
  var rows = findStudentRows_(spreadsheet.getSheetByName(sheetName), studentEmail);
  rows.forEach(function (entry, index) {
    var parts = feedbackHeaders.map(function (header) {
      return { label: header === 'Feedback' ? 'Feedback' : header, value: getObjectValue_(entry.values, header) };
    }).filter(function (part) { return !!part.value; });
    if (!parts.length) return;
    destination.push({
      source: label,
      attempt: index === 0 ? 'First attempt' : (index === 1 ? 'Reattempt' : 'Attempt ' + (index + 1)),
      score: scoreHeader ? getObjectValue_(entry.values, scoreHeader) : '',
      parts: parts
    });
  });
}

function renderProgressCardHtml_(data) {
  var student = data.student;
  var levelsHtml = data.levels.map(function (level) {
    var activitiesHtml = level.activities.map(function (activity) {
      return '<tr><td>' + escapeHtml_(activity.name) + '</td><td>' + formatScoreValue_(activity.mark, activity.maximum) + '</td><td>' + displayValue_(activity.result) + '</td><td>' + displayValue_(formatAttempt_(activity.attempt)) + '</td></tr>';
    }).join('');
    var summaryHtml = level.found
      ? '<p class="level-summary"><strong>Level outcome:</strong> ' + displayValue_(level.status) + (level.total ? ' <span class="sep">|</span> <strong>Total:</strong> ' + formatScoreValue_(level.total, level.totalMaximum) : '') + '</p>'
      : '<p class="level-summary">No matching training record found for this level.</p>';
    return '<section><h2>' + escapeHtml_(level.name) + '</h2>' + summaryHtml +
      '<table><thead><tr><th>Activity</th><th>Score (earned / maximum)</th><th>Outcome</th><th>Attempt</th></tr></thead><tbody>' + activitiesHtml + '</tbody></table></section>';
  }).join('');

  var feedbackHtml = data.feedback.length
    ? data.feedback.map(function (item) {
      var partsHtml = item.parts.map(function (part) {
        return '<div class="feedback-part"><strong>' + escapeHtml_(part.label) + ':</strong><br>' + displayValue_(part.value) + '</div>';
      }).join('');
      return '<article class="feedback-entry"><div class="feedback-heading"><strong>' + escapeHtml_(item.source) + '</strong><span>' + escapeHtml_(item.attempt) + (item.score ? ' | Score: ' + escapeHtml_(item.score) : '') + '</span></div>' + partsHtml + '</article>';
    }).join('')
    : '<p class="empty">No feedback available.</p>';

  return '<!doctype html><html><head><meta charset="utf-8"><style>' + progressCardCss_() + '</style></head><body>' +
    '<header><div><div class="brandrow"><img class="logo" src="' + PROGRESS_CARD_CONFIG.logoHdDataUri + '"><div class="brand">IIT Madras <span>IIC Placement Cell</span><small>BS Degree</small></div></div></div>' +
    '<div class="coordinators"><strong>Coordinators</strong><br><b>Prof. Andrew Thangaraj</b><br>Dept. of Electrical Engineering<br>IIT Madras<br><br><b>Prof. Vignesh Muthuvijayan</b><br>Dept. of Biotechnology<br>IIT Madras</div></header>' +
    '<div class="rule"></div><div class="date">Chennai<br><strong>' + escapeHtml_(data.generatedAt) + '</strong></div>' +
    '<h1>TRAINING PROGRESS CARD</h1><p class="greeting">Training Completion Report</p>' +
    '<div class="student"><div><strong>' + escapeHtml_(student.name) + '</strong></div><div>Email: ' + escapeHtml_(student.email) + '</div>' +
    (student.batch ? '<div>Batch: ' + escapeHtml_(student.batch) + '</div>' : '') +
    (student.plan ? '<div>Training plan: ' + escapeHtml_(student.plan) + '</div>' : '') +
    (student.domain ? '<div>Domain: ' + escapeHtml_(student.domain) + '</div>' : '') + '</div>' +
    '<p class="intro">This card summarizes the learner\'s progress across training levels including assessment results, attempts, and feedback for improvement.</p>' +
    levelsHtml + '<section><h2>Feedback</h2>' + feedbackHtml + '</section>' +
    '<footer><div>Feel free to reach out to us in case of any mistakes in this progress card.</div>' +
    '<div>IITM BS Degree Office, 3rd Floor, ICSR Building, Indian Institute of Technology Madras, Chennai - 600 036</div>' +
    '<div class="contact">+91-7850999966 (Mon-Fri 9am-6pm) <span>iic@study.iitm.ac.in</span></div></footer>' +
    '</body></html>';
}

function progressCardCss_() {
  return '@page{size:A4;margin:18mm 15mm 20mm 18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#222;font-size:10pt;line-height:1.45;padding:0}header{display:flex;justify-content:space-between;align-items:flex-start;min-height:96px;border-bottom:3px solid #7d211e;padding-bottom:12px}.brandrow{display:flex;align-items:center;gap:12px}.logo{width:48px;height:48px;object-fit:contain}.brand{font-family:Arial,sans-serif;font-size:22pt;font-weight:bold;color:#111;line-height:1}.brand span{display:block;font-size:14pt}.brand small{display:block;font-size:9pt;color:#7d211e;margin-top:7px}.coordinators{text-align:right;font-size:8pt;line-height:1.3;color:#444}.coordinators b{color:#7d211e}.rule{display:none}.date{text-align:right;margin-top:14px}.date strong{font-size:10pt}h1{text-align:center;font-size:15pt;margin:18px 0 4px;color:#7d211e}.greeting{text-align:center;font-weight:bold;font-size:11pt;color:#555;margin:0 0 20px}.student{border-left:3px solid #7d211e;padding:8px 12px;margin-bottom:12px;background:#f7f7f5}.student div{margin:2px 0}.intro{margin:10px 0 14px}h2{font-size:12pt;color:#7d211e;border-bottom:1px solid #b8a19f;padding-bottom:5px;margin:17px 0 6px}.level-summary{margin:5px 0 8px}.sep{padding:0 8px;color:#777}table{width:100%;border-collapse:collapse;font-size:8.5pt;page-break-inside:auto}tr{page-break-inside:avoid}th{background:#f0e9e7;color:#63201d;text-align:left;padding:7px;border-bottom:1px solid #c7aaa6}td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}tbody tr:nth-child(even){background:#faf9f8}.feedback-entry{border-bottom:1px solid #ddd;padding:8px 2px;page-break-inside:avoid}.feedback-heading{display:flex;justify-content:space-between;color:#7d211e;margin-bottom:4px}.feedback-heading span{font-size:8pt;color:#555}.feedback-part{margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.empty{color:#666;font-style:italic}footer{border-top:1px solid #888;margin-top:25px;padding-top:8px;text-align:center;font-size:8pt;color:#444;page-break-inside:avoid}.contact{margin-top:5px}.contact span{margin-left:18px;color:#7d211e}';
}

function sendFeedbackRequest_(studentEmail) {
  var body = 'Dear Student,\n\nCongratulations on clearing all levels in the IIC Training. Kindly fill the Training Feedback Form which is compulsory to receive your Training Progress Card. You will be added to the new GSpace to receive prioritized opportunities once you receive your progress card.\n\nTraining Feedback Form: ' + PROGRESS_CARD_CONFIG.feedbackFormUrl + '\n\nRegards,\nIIC Training Team';
  MailApp.sendEmail({
    to: studentEmail,
    subject: 'Complete the IIC Training Feedback Form to receive your Progress Card',
    body: body,
    htmlBody: '<p>Dear Student,</p><p>Congratulations on clearing all levels in the IIC Training. Kindly fill the <a href="' + escapeHtml_(PROGRESS_CARD_CONFIG.feedbackFormUrl) + '">Training Feedback Form</a> which is compulsory to receive your Training Progress Card. You will be added to the new GSpace to receive prioritized opportunities once you receive your progress card.</p><p>Regards,<br>IIC Training Team</p>',
    replyTo: PROGRESS_CARD_CONFIG.ownerEmail,
    name: PROGRESS_CARD_CONFIG.senderName
  });
}

function sendReportEmail_(studentEmail, reportUrl) {
  MailApp.sendEmail({
    to: studentEmail,
    subject: 'Your IIC Training Progress Card',
    body: buildReportEmailText_(reportUrl),
    htmlBody: buildReportEmailHtml_(reportUrl),
    replyTo: PROGRESS_CARD_CONFIG.ownerEmail,
    name: PROGRESS_CARD_CONFIG.senderName
  });
}

function buildReportEmailText_(reportUrl) {
  return 'Dear Student,\n\nThank you for submitting the IIC Training Feedback Form. Your Training Progress Card is ready.\n\nView your Training Progress Card PDF: ' + reportUrl + '\n\nRegards,\nIIC Training Team';
}

function buildReportEmailHtml_(reportUrl) {
  return '<p>Dear Student,</p><p>Thank you for submitting the IIC Training Feedback Form. Your Training Progress Card is ready.</p><p><a href="' + escapeHtml_(reportUrl) + '">View your Training Progress Card PDF</a></p><p>Regards,<br>IIC Training Team</p>';
}

function getSubmittedEmail_(event) {
  if (!event) return '';
  var namedValues = event.namedValues || {};
  var expected = normalizeHeader_(PROGRESS_CARD_CONFIG.formEmailHeader);
  var keys = Object.keys(namedValues);
  for (var index = 0; index < keys.length; index++) {
    if (normalizeHeader_(keys[index]) === expected) {
      var value = namedValues[keys[index]];
      return normalizeEmail_(Array.isArray(value) ? value[0] : value);
    }
  }
  var configuredSheetId = Number(PropertiesService.getScriptProperties().getProperty('PROGRESS_CARD_RESPONSE_SHEET_ID'));
  if (event.range && event.range.getSheet().getSheetId() === configuredSheetId) {
    var sheet = event.range.getSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    var emailColumn = findHeaderIndex_(headers, PROGRESS_CARD_CONFIG.formEmailHeader);
    if (emailColumn >= 0) return normalizeEmail_(sheet.getRange(event.range.getRow(), emailColumn + 1).getDisplayValue());
  }
  return '';
}

function findUnsentPassedLevel3Row_(sheet, studentEmail) {
  var rows = findStudentRows_(sheet, studentEmail);
  for (var index = 0; index < rows.length; index++) {
    var rowNumber = rows[index].rowNumber;
    if (normalizeValue_(getCellByHeader_(sheet, rowNumber, 'Level 3 (Pass/Fail)')) !== 'pass') continue;
    if (normalizeValue_(getCellByHeader_(sheet, rowNumber, PROGRESS_CARD_CONFIG.statusHeader)) === 'report sent') continue;
    return rowNumber;
  }
  return 0;
}

function getSubmittedEmails_() {
  var responseSheet = getFeedbackResponseSheet_();
  if (responseSheet.getLastRow() < 2) return [];
  var values = responseSheet.getDataRange().getDisplayValues();
  var emailIndex = findHeaderIndex_(values[0], PROGRESS_CARD_CONFIG.formEmailHeader);
  if (emailIndex < 0) throw new Error('The feedback response sheet is missing the "' + PROGRESS_CARD_CONFIG.formEmailHeader + '" column.');
  var seen = {};
  var emails = [];
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    var email = normalizeEmail_(values[rowIndex][emailIndex]);
    if (!email || seen[email]) continue;
    seen[email] = true;
    emails.push(email);
  }
  return emails;
}

function hasSubmittedFeedbackForm_(studentEmail) {
  var normalizedEmail = normalizeEmail_(studentEmail);
  return getSubmittedEmails_().some(function (email) { return email === normalizedEmail; });
}

function getFeedbackResponseSheet_() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty('PROGRESS_CARD_RESPONSE_SPREADSHEET_ID');
  var sheetId = Number(properties.getProperty('PROGRESS_CARD_RESPONSE_SHEET_ID'));
  if (!spreadsheetId || !sheetId) throw new Error('Run setupProgressCardTriggers to configure the feedback response sheet first.');
  var sheet = getSheetById_(SpreadsheetApp.openById(spreadsheetId), sheetId);
  if (!sheet) throw new Error('The configured feedback response sheet was not found.');
  return sheet;
}

function findStudentRow_(sheet, studentEmail) {
  var rows = findStudentRows_(sheet, studentEmail);
  return rows.length ? rows[0].values : null;
}

function findStudentRows_(sheet, studentEmail) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0];
  var emailIndex = findHeaderIndex_(headers, 'Email');
  if (emailIndex < 0) emailIndex = findHeaderIndex_(headers, PROGRESS_CARD_CONFIG.formEmailHeader);
  if (emailIndex < 0) return [];

  var matches = [];
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (normalizeEmail_(values[rowIndex][emailIndex]) !== normalizeEmail_(studentEmail)) continue;
    matches.push({ rowNumber: rowIndex + 1, values: getRowObject_(headers, values[rowIndex]) });
  }
  return matches;
}

function getHeaders_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
}

function getRowObject_(headers, values) {
  var result = {};
  headers.forEach(function (header, index) {
    result[normalizeHeader_(header)] = values[index];
  });
  return result;
}

function getObjectValue_(row, header) {
  if (!row) return '';
  return row[normalizeHeader_(header)] || '';
}

function getCellByHeader_(sheet, rowNumber, header) {
  var headers = getHeaders_(sheet);
  var index = findHeaderIndex_(headers, header);
  return index < 0 ? '' : sheet.getRange(rowNumber, index + 1).getDisplayValue();
}

function setCellByHeader_(sheet, rowNumber, header, value) {
  var headers = getHeaders_(sheet);
  var index = findHeaderIndex_(headers, header);
  if (index < 0) throw new Error('The Level 3 sheet is missing the "' + header + '" column.');
  sheet.getRange(rowNumber, index + 1).setValue(value);
}

function ensureOutputHeaders_(sheet) {
  var linkHeader = sheet.getRange(1, 19).getDisplayValue();
  var statusHeader = sheet.getRange(1, 20).getDisplayValue();
  var requestHeader = sheet.getRange(1, 21).getDisplayValue();
  if (!linkHeader) sheet.getRange(1, 19).setValue(PROGRESS_CARD_CONFIG.linkHeader);
  if (!statusHeader) sheet.getRange(1, 20).setValue(PROGRESS_CARD_CONFIG.statusHeader);
  if (!requestHeader) sheet.getRange(1, 21).setValue(PROGRESS_CARD_CONFIG.feedbackRequestHeader);
  var headers = getHeaders_(sheet);
  if (findHeaderIndex_(headers, PROGRESS_CARD_CONFIG.linkHeader) !== 18 ||
      findHeaderIndex_(headers, PROGRESS_CARD_CONFIG.statusHeader) !== 19 ||
      findHeaderIndex_(headers, PROGRESS_CARD_CONFIG.feedbackRequestHeader) !== 20) {
    throw new Error('Columns S, T, and U must be Progress Card Link, Progress Card Status, and Feedback Form Email Status.');
  }
}

function findHeaderIndex_(headers, expectedHeader) {
  var expected = normalizeHeader_(expectedHeader);
  for (var index = 0; index < headers.length; index++) {
    if (normalizeHeader_(headers[index]) === expected) return index;
  }
  return -1;
}

function getSheetById_(spreadsheet, sheetId) {
  var sheets = spreadsheet.getSheets();
  for (var index = 0; index < sheets.length; index++) {
    if (sheets[index].getSheetId() === sheetId) return sheets[index];
  }
  return null;
}

function parseSpreadsheetLocation_(url) {
  var spreadsheetMatch = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  var sheetMatch = String(url || '').match(/[?#&]gid=(\d+)/);
  if (!spreadsheetMatch || !sheetMatch) {
    throw new Error('Use a Google Sheets URL that includes both the spreadsheet ID and the response tab gid.');
  }
  return { spreadsheetId: spreadsheetMatch[1], sheetId: Number(sheetMatch[1]) };
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeValue_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function displayValue_(value) {
  return value ? escapeHtml_(value) : '<span class="muted">-</span>';
}

function formatScoreValue_(value, maximum) {
  if (value === '' || value == null) return '<span class="muted">-</span>';
  return escapeHtml_(value) + (maximum ? ' / ' + escapeHtml_(maximum) : '');
}

function formatAttempt_(value) {
  var code = String(value || '').trim().toUpperCase();
  var match = code.match(/^(FA|RA)(\d+)B$/);
  if (!match) return value;
  return match[1] === 'FA' ? 'First Attempt' : 'Reattempt';
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFileName_(value) {
  return String(value || 'Student').replace(/[\\/:*?"<>|]/g, '-').trim();
}

function dateStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Tickets")
    .addItem("Sync Tickets", "mapToTickets")
    .addToUi();
}

function mapToTickets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = findSheetByAnyName_(ss, [
    'Form Responses 1',
    'Form Responses',
    'Form responses 1',
    'Form responses',
    'Form_responses',
    'Form responses 1 (Responses)'
  ]);
  const ticketSheet = ss.getSheetByName('Tickets');

  if (!sourceSheet) throw new Error('Source sheet not found: expected a form responses sheet with name like "Form Responses 1" or "Form Responses"');
  if (!ticketSheet) throw new Error('Target sheet not found: Tickets');

  const data = sourceSheet.getDataRange().getValues();
  const ticketData = ticketSheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0].map(normalizeHeader_);
  const ticketHeaders = ticketData[0].map(normalizeHeader_);
  const ticketMap = makeHeaderMap_(ticketHeaders);

  const existingSourceKeys = new Map();
  const existingFingerprints = new Set();
  for (let i = 1; i < ticketData.length; i++) {
    const row = ticketData[i];
    const sourceKey = buildSourceKey_(row[1], row[2]);
    if (sourceKey) {
      existingSourceKeys.set(sourceKey, i + 1);
    }
    const fingerprint = buildFingerprint_(row[1], row[2], row[3], row[4], row[5], row[6]);
    if (fingerprint) {
      existingFingerprints.add(fingerprint);
    }
  }

  const col = {
    timestamp: findHeaderIndex_(headers, ['timestamp']),
    email: findHeaderIndex_(headers, ['email', 'student email', 'student_email', 'student email id']),
    name: findHeaderIndex_(headers, ['name', 'student name', 'student_name']),
    issueRelated: findHeaderIndex_(headers, ['issue related', 'issue_related', 'issue type', 'issue_type']),
    level1: findHeaderIndex_(headers, ['level 1', 'level1']),
    level2: findHeaderIndex_(headers, ['level 2', 'level2']),
    level3: findHeaderIndex_(headers, ['level 3', 'level3']),
    domainPlan: findHeaderIndex_(headers, ['domain plan', 'domain and plan', 'domain/plan', 'domain_plan', 'domain']),
    issueText: findHeaderIndex_(headers, ['issue text', 'issue_text', 'problem text', 'problem_text', 'brief description', 'brief description of the issue', 'description of the issue', 'issue description']),
    fileUrl: findHeaderIndex_(headers, ['file url', 'file_url', 'proof', 'proof url', 'upload supporting document', 'upload supporting document (if any)', 'supporting document', 'supporting document (if any)', 'attachment']),
  };

  let newRows = [];
  let importedCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;
  let missingRequiredCount = 0;

  let updatedCount = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowRef = String(i + 1);

    const issueRelated = getValue_(row, col.issueRelated);
    const level1 = getValue_(row, col.level1);
    const level2 = getValue_(row, col.level2);
    const level3 = getValue_(row, col.level3);
    const domainPlan = getValue_(row, col.domainPlan);
    const issueText = getValue_(row, col.issueText);
    const fileUrl = getValue_(row, col.fileUrl);
    const timestamp = getValue_(row, col.timestamp);
    const email = getValue_(row, col.email);
    const name = getValue_(row, col.name);

    const sourceKey = buildSourceKey_(timestamp, email);
    const existingRowIndex = sourceKey ? existingSourceKeys.get(sourceKey) : null;

    let activity = "";

    // Pick the deepest non-empty level
    if (level3) activity = level3;
    else if (level2) activity = level2;
    else if (level1) activity = level1;
    else activity = domainPlan;

    let category = "";

    if (String(issueRelated).trim() === "Activity Points") {
      category = "Activity Points - " + domainPlan;
    } else if (activity) {
      category = issueRelated + " - " + activity;
    } else {
      category = issueRelated;
    }

    if (!timestamp || !email || !name || !category) {
      missingRequiredCount++;
      continue;
    }

    if (existingRowIndex) {
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'timestamp', timestamp);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'student_email', email);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'student_name', name);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'category', category);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'issue_text', issueText);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'file_url', fileUrl);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'source_row_ref', rowRef);
      setCellByHeader_(ticketSheet, existingRowIndex, ticketMap, 'last_updated_at', new Date());
      updatedCount++;
      continue;
    }

    const fingerprint = buildFingerprint_(timestamp, email, name, category, issueText, fileUrl);

    if (existingFingerprints.has(fingerprint)) {
      duplicateCount++;
      continue;
    }

    const ticketId = "TCKT-" + new Date().getTime() + "-" + i;

    newRows.push([
      ticketId,
      timestamp,
      email,
      name,
      category,
      issueText,
      fileUrl,
      "",
      "OPEN",
      "",
      "",
      "",
      new Date(),
      "",
      rowRef
    ]);

    existingFingerprints.add(fingerprint);
    importedCount++;
  }

  if (newRows.length > 0) {
    ticketSheet
      .getRange(ticketSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length)
      .setValues(newRows);
  }

  skippedCount = Math.max(0, (data.length - 1) - importedCount - updatedCount);

  const summary = [
    'Tickets sync complete',
    '',
    'Imported: ' + importedCount,
    'Updated: ' + updatedCount,
    'Duplicates skipped: ' + duplicateCount,
    'Rows missing required data: ' + missingRequiredCount,
    'Total source rows scanned: ' + Math.max(0, data.length - 1)
  ].join('\n');

  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (err) {
    Logger.log(summary);
  }
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderIndex_(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim().toLowerCase();
    if (!header) continue;

    for (let j = 0; j < aliases.length; j++) {
      const alias = String(aliases[j] || '').trim().toLowerCase();
      if (!alias) continue;
      if (header === alias || header.indexOf(alias) !== -1) {
        return i;
      }
    }
  }

  return -1;
}

function getValue_(row, index) {
  if (index < 0 || index >= row.length) return '';
  return row[index] == null ? '' : String(row[index]).trim();
}

function findSheetByAnyName_(spreadsheet, names) {
  for (var i = 0; i < names.length; i++) {
    var sheet = spreadsheet.getSheetByName(names[i]);
    if (sheet) return sheet;
  }
  return null;
}

function makeHeaderMap_(headerRow) {
  const map = {};
  for (var i = 0; i < headerRow.length; i++) {
    const key = normalizeHeader_(headerRow[i]);
    if (key) map[key] = i + 1;
  }
  return map;
}

function setCellByHeader_(sheet, rowIndex, map, header, value) {
  const col = map[normalizeHeader_(header)];
  if (!col) return;
  sheet.getRange(rowIndex, col).setValue(value);
}

function buildSourceKey_(timestamp, email) {
  return [timestamp, email]
    .map(function(value) {
      return String(value || '').trim().toLowerCase();
    })
    .join('||');
}

function buildFingerprint_(timestamp, email, name, category, issueText, fileUrl) {
  return [timestamp, email, name, category, issueText, fileUrl]
    .map(function(value) {
      return String(value || '').trim().toLowerCase();
    })
    .join('||');
}
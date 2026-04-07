/************* CONFIG *************/
const CONFIG = {
  SHEET_NAME: 'Tickets',
  SUBJECT: 'Query Resolved - IIC Training',
  RATE_LIMIT_MS: 1200,
  REQUIRED_HEADERS: [
    'ticket_id',
    'timestamp',
    'student_email',
    'student_name',
    'category',
    'issue_text',
    'file_url',
    'mail_draft',
    'status',
    'assigned_to',
    'sent_by',
    'sent_at',
    'last_updated_at',
    'last_error',
    'source_row_ref',
  ],
};

/************* ENTRY *************/
function doPost(e) {
  try {
    const body = parseBody_(e);
    assertApiToken_(body.apiToken);

    const action = String(body.action || '').trim();

    switch (action) {
      case 'listTickets':
        return jsonSuccess_({ tickets: listTickets_(body.filters || {}) });

      case 'updateTicketDraft':
        return jsonSuccess_({ ticket: updateTicketDraft_(body) });

      case 'sendTicketMail':
        return jsonSuccess_({ ticket: sendTicketMail_(body) });

      case 'sendBulkTicketMails':
        return jsonSuccess_(sendBulkTicketMails_(body));

      default:
        return jsonError_('Unknown action: ' + action);
    }
  } catch (err) {
    return jsonError_(err && err.message ? err.message : String(err));
  }
}

/************* ACTIONS *************/
function listTickets_(filters) {
  const ctx = getSheetContext_();
  const rows = ctx.sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const query = String(filters.query || '').trim().toLowerCase();
  const category = String(filters.category || 'ALL');
  const status = String(filters.status || 'ALL');

  const tickets = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ticket = rowToTicket_(row, ctx.map);

    if (!ticket.ticketId) continue;
    if (category !== 'ALL' && ticket.category !== category) continue;
    if (status !== 'ALL' && ticket.status !== status) continue;

    if (query) {
      const hay = [
        ticket.studentEmail,
        ticket.studentName,
        ticket.issueText,
        ticket.category,
        ticket.ticketId,
      ].join(' ').toLowerCase();

      if (hay.indexOf(query) === -1) continue;
    }

    tickets.push(ticket);
  }

  tickets.sort(function(a, b) {
    return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
  });

  return tickets;
}

function updateTicketDraft_(body) {
  const ticketId = String(body.ticketId || '').trim();
  if (!ticketId) throw new Error('ticketId is required');

  const ctx = getSheetContext_();
  const rowIndex = findRowByTicketId_(ctx.sheet, ctx.map, ticketId);
  if (rowIndex < 2) throw new Error('Ticket not found: ' + ticketId);

  const now = new Date().toISOString();
  const draft = body.mailDraft == null ? '' : String(body.mailDraft);
  const assignedTo = body.assignedTo == null ? '' : String(body.assignedTo);
  const explicitStatus = body.status == null ? '' : String(body.status);

  setCell_(ctx.sheet, rowIndex, ctx.map, 'mail_draft', draft);

  if (explicitStatus) {
    setCell_(ctx.sheet, rowIndex, ctx.map, 'status', explicitStatus);
  } else if (draft.trim()) {
    setCell_(ctx.sheet, rowIndex, ctx.map, 'status', 'DRAFTED');
  }

  if (assignedTo) {
    setCell_(ctx.sheet, rowIndex, ctx.map, 'assigned_to', assignedTo);
  }

  setCell_(ctx.sheet, rowIndex, ctx.map, 'last_updated_at', now);

  const row = ctx.sheet.getRange(rowIndex, 1, 1, ctx.width).getValues()[0];
  return rowToTicket_(row, ctx.map);
}

function sendTicketMail_(body) {
  const ticketId = String(body.ticketId || '').trim();
  const sentBy = String(body.sentBy || '').trim();

  if (!ticketId) throw new Error('ticketId is required');
  if (!sentBy) throw new Error('sentBy is required');

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return sendTicketMailInternal_(ticketId, sentBy).ticket;
  } finally {
    lock.releaseLock();
  }
}

function sendBulkTicketMails_(body) {
  const ticketIds = Array.isArray(body.ticketIds) ? body.ticketIds : [];
  const sentBy = String(body.sentBy || '').trim();

  if (!sentBy) throw new Error('sentBy is required');
  if (!ticketIds.length) throw new Error('ticketIds is required');

  const successIds = [];
  const failed = [];

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    for (var i = 0; i < ticketIds.length; i++) {
      const id = String(ticketIds[i] || '').trim();
      if (!id) continue;

      try {
        const result = sendTicketMailInternal_(id, sentBy);
        if (result.ok) {
          successIds.push(id);
        } else {
          failed.push({ ticketId: id, error: result.error || 'Unknown error' });
        }
      } catch (err) {
        failed.push({
          ticketId: id,
          error: err && err.message ? err.message : String(err),
        });
      }

      Utilities.sleep(CONFIG.RATE_LIMIT_MS);
    }
  } finally {
    lock.releaseLock();
  }

  return { successIds: successIds, failed: failed };
}

/************* MAIL CORE *************/
function sendTicketMailInternal_(ticketId, sentBy) {
  const ctx = getSheetContext_();
  const rowIndex = findRowByTicketId_(ctx.sheet, ctx.map, ticketId);
  if (rowIndex < 2) throw new Error('Ticket not found: ' + ticketId);

  const row = ctx.sheet.getRange(rowIndex, 1, 1, ctx.width).getValues()[0];
  const ticket = rowToTicket_(row, ctx.map);

  if (String(ticket.status) === 'SENT') {
    return { ok: false, error: 'Already SENT' };
  }

  if (!ticket.studentEmail) {
    writeSendError_(ctx.sheet, ctx.map, rowIndex, 'Missing student_email');
    return { ok: false, error: 'Missing student_email' };
  }

  if (!ticket.mailDraft || !ticket.mailDraft.trim()) {
    writeSendError_(ctx.sheet, ctx.map, rowIndex, 'Missing mail_draft');
    return { ok: false, error: 'Missing mail_draft' };
  }

  try {
    const signature = getPrimarySignature_();
    const textBody = ticket.mailDraft;
    const htmlBody = nl2brEscaped_(ticket.mailDraft) + (signature ? '<br><br>' + signature : '');

    GmailApp.sendEmail(ticket.studentEmail, CONFIG.SUBJECT, textBody, {
      htmlBody: htmlBody,
    });

    const now = new Date().toISOString();
    setCell_(ctx.sheet, rowIndex, ctx.map, 'status', 'SENT');
    setCell_(ctx.sheet, rowIndex, ctx.map, 'sent_by', sentBy);
    setCell_(ctx.sheet, rowIndex, ctx.map, 'sent_at', now);
    setCell_(ctx.sheet, rowIndex, ctx.map, 'last_updated_at', now);
    setCell_(ctx.sheet, rowIndex, ctx.map, 'last_error', '');

    const newRow = ctx.sheet.getRange(rowIndex, 1, 1, ctx.width).getValues()[0];
    return { ok: true, ticket: rowToTicket_(newRow, ctx.map) };
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    writeSendError_(ctx.sheet, ctx.map, rowIndex, msg);
    return { ok: false, error: msg };
  }
}

function writeSendError_(sheet, map, rowIndex, errorText) {
  const now = new Date().toISOString();
  setCell_(sheet, rowIndex, map, 'status', 'ERROR');
  setCell_(sheet, rowIndex, map, 'last_error', String(errorText || 'Unknown error'));
  setCell_(sheet, rowIndex, map, 'last_updated_at', now);
}

/************* HELPERS *************/
function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }
  return JSON.parse(e.postData.contents);
}

function assertApiToken_(incomingToken) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected) throw new Error('Missing API_TOKEN in Script Properties');
  if (String(incomingToken || '') !== String(expected)) {
    throw new Error('Unauthorized');
  }
}

function getSheetContext_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + CONFIG.SHEET_NAME);

  const all = sheet.getDataRange().getValues();
  if (all.length === 0) throw new Error('Tickets sheet is empty');

  const headerRow = all[0];
  const map = makeHeaderMap_(headerRow);
  validateHeaders_(map);

  return {
    sheet: sheet,
    map: map,
    width: headerRow.length,
  };
}

function makeHeaderMap_(headerRow) {
  const map = {};
  for (var i = 0; i < headerRow.length; i++) {
    const key = normalizeHeader_(headerRow[i]);
    if (key) map[key] = i + 1; // 1-based column index
  }
  return map;
}

function validateHeaders_(map) {
  const missing = [];
  for (var i = 0; i < CONFIG.REQUIRED_HEADERS.length; i++) {
    const h = CONFIG.REQUIRED_HEADERS[i];
    if (!map[h]) missing.push(h);
  }
  if (missing.length) {
    throw new Error('Missing required headers in Tickets sheet: ' + missing.join(', '));
  }
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function findRowByTicketId_(sheet, map, ticketId) {
  const col = map['ticket_id'];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === ticketId) {
      return i + 2;
    }
  }
  return -1;
}

function rowToTicket_(row, map) {
  return {
    ticketId: getCellByHeader_(row, map, 'ticket_id'),
    timestamp: getCellByHeader_(row, map, 'timestamp'),
    studentEmail: getCellByHeader_(row, map, 'student_email'),
    studentName: getCellByHeader_(row, map, 'student_name'),
    category: getCellByHeader_(row, map, 'category'),
    issueText: getCellByHeader_(row, map, 'issue_text'),
    fileUrl: getCellByHeader_(row, map, 'file_url'),
    mailDraft: getCellByHeader_(row, map, 'mail_draft'),
    status: getCellByHeader_(row, map, 'status') || 'NEW',
    assignedTo: getCellByHeader_(row, map, 'assigned_to'),
    sentBy: getCellByHeader_(row, map, 'sent_by'),
    sentAt: getCellByHeader_(row, map, 'sent_at'),
    lastUpdatedAt: getCellByHeader_(row, map, 'last_updated_at'),
    lastError: getCellByHeader_(row, map, 'last_error'),
  };
}

function getCellByHeader_(row, map, header) {
  const col = map[header];
  if (!col) return '';
  const v = row[col - 1];
  return v == null ? '' : String(v);
}

function setCell_(sheet, rowIndex, map, header, value) {
  const col = map[header];
  if (!col) return;
  sheet.getRange(rowIndex, col).setValue(value);
}

function nl2brEscaped_(text) {
  const safe = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return safe.replace(/\r?\n/g, '<br>');
}

function getPrimarySignature_() {
  try {
    const sendAsList = Gmail.Users.Settings.SendAs.list('me').sendAs || [];
    for (var i = 0; i < sendAsList.length; i++) {
      if (sendAsList[i].isPrimary) {
        return sendAsList[i].signature || '';
      }
    }
    return '';
  } catch (e) {
    return '';
  }
}

function jsonSuccess_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
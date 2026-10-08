/* ===========================
   TRIGGER HANDLER
=========================== */
function onSummarySubmit() {
  refreshSummary();
}

function createSummaryTimeTrigger() {
  // Remove existing time triggers for refreshSummary
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (
      t.getHandlerFunction() === "refreshSummary" &&
      t.getEventType() === ScriptApp.EventType.CLOCK
    ) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("refreshSummary")
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("✅ refreshSummary scheduled every 15 minutes");
}

/* ===========================
   SLOT → DATE PARSER
=========================== */
function parseSlotToDate(slot) {
  if (!slot || typeof slot !== "string") return null;

  const left = slot.split("-")[0].trim();
  const d = left.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!d) return null;

  const day = +d[1], month = +d[2], year = +d[3];
  const t = left.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);

  let hour = 0, minute = 0;
  if (t) {
    hour = +t[1];
    minute = t[2] ? +t[2] : 0;
    const ampm = t[3].toUpperCase();
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  }

  return new Date(year, month - 1, day, hour, minute, 0);
}

/* ===========================
   MAIN SUMMARY REFRESH
=========================== */
function refreshSummary() {
  const lock = LockService.getScriptLock();

  try {
    // wait max 30 sec for other execution to finish
    lock.waitLock(30000);

    const ss = SpreadsheetApp.getActive();
    const formSheet = getActiveFormResponseSheet();
    const summarySheet = ss.getSheetByName("Summary");
    const instructorMap = getInstructorMap();

    if (!formSheet || !summarySheet) {
      throw new Error("Form or Summary sheet missing.");
    }

    ensureSummaryContactRatingHeaders_(summarySheet);

    const formLastRow = formSheet.getLastRow();
    const formLastColumn = formSheet.getLastColumn();
    if (formLastRow < 2) return;

    const existing = getExistingIds(summarySheet);
    const formHeaders = formSheet.getRange(1, 1, 1, formLastColumn).getValues()[0];
    const nameIndex = getColumnIndexByHeader_(formHeaders, ["name"]);
    const emailIndex = getColumnIndexByHeader_(formHeaders, ["email"]);
    const slotIndex = getColumnIndexByHeader_(formHeaders, ["slot"]);
    const contactIndex = getColumnIndexByHeader_(formHeaders, ["contact"]);

    const rowsToAppend = [];

    for (let r = 2; r <= formLastRow; r++) {
      const row = formSheet.getRange(r, 1, 1, formLastColumn).getValues()[0];
      const name = getStringByIndex_(row, nameIndex, 1);
      const email = getStringByIndex_(row, emailIndex, 2);
      const slot = getStringByIndex_(row, slotIndex, 3);
      const contact = getStringByIndex_(row, contactIndex, formLastColumn - 1);

      if (!email || !slot) continue;

      const key = email + " | " + slot;
      if (existing[key]) {
        if (contact && !existing[key].contact) {
          summarySheet.getRange(existing[key].rowNumber, 13).setValue(contact);
          existing[key].contact = contact;
        }
        continue;
      }

      const id = Utilities.getUuid();
      existing[key] = true;

      const instructorKey = extractInstructorKey(slot);
      const instructorName = instructorMap[instructorKey] || "";

      rowsToAppend.push([
        id,
        instructorName,
        slot,
        name,
        email,
        "Pending",
        "", "", "",
        "",
        "",
        "",
        contact,
        "",
        ""
      ]);
    }

    if (rowsToAppend.length > 0) {
      summarySheet
        .getRange(summarySheet.getLastRow() + 1, 1, rowsToAppend.length, 15)
        .setValues(rowsToAppend);
    }

    sortSummaryBySlot_(summarySheet);

  } finally {
    lock.releaseLock();
  }
}

function ensureSummaryContactRatingHeaders_(summarySheet) {
  const lastRow = summarySheet.getLastRow();
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = summarySheet.getRange(rowNumber, 1, 1, 15).getValues()[0];
    normalizePresentationContactRating_(summarySheet, rowNumber, row);
  }

  summarySheet.getRange(1, 13, 1, 3).setValues([["Contact", "Rating", ""]]);
}

function sortSummaryBySlot_(summarySheet) {
  const lastRow = summarySheet.getLastRow();
  if (lastRow < 3) return;

  const range = summarySheet.getRange(2, 1, lastRow - 1, 15);
  const rows = range.getValues();

  rows.sort((a, b) => {
    const aDate = parseSlotToDate(String(a[2] || ""));
    const bDate = parseSlotToDate(String(b[2] || ""));

    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;

    const dayDifference = new Date(
      aDate.getFullYear(),
      aDate.getMonth(),
      aDate.getDate()
    ).getTime() - new Date(
      bDate.getFullYear(),
      bDate.getMonth(),
      bDate.getDate()
    ).getTime();
    if (dayDifference !== 0) return dayDifference;

    const instructorDifference = String(a[1] || "").localeCompare(String(b[1] || ""));
    if (instructorDifference !== 0) return instructorDifference;

    return aDate.getTime() - bDate.getTime();
  });

  range.setValues(rows);
}

/* ===========================
   EXISTING RECORD MAP
=========================== */
function getExistingIds(summarySheet) {
  const map = {};
  const last = summarySheet.getLastRow();
  if (last < 2) return map;

  const data = summarySheet.getRange(2, 1, last - 1, Math.max(15, summarySheet.getLastColumn())).getValues();

  data.forEach((r, idx) => {
    const email = String(r[4] || "").trim(); // Column E
    const slot  = String(r[2] || "").trim(); // Column C
    const contact = String(r[12] || "").trim(); // Column M after contact/rating normalization

    if (email && slot) {
      map[email + " | " + slot] = {
        rowNumber: idx + 2,
        contact: contact
      };
    }
  });

  return map;
}


function getInstructorMap() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Instructors");
  if (!sheet) throw new Error("Instructors sheet not found");

  const data = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  const map = {};

  data.forEach(r => {
    if (r[0] && r[1]) {
      map[String(r[0]).trim()] = String(r[1]).trim();
    }
  });

  return map;
}

function extractInstructorKey(slot) {
  if (!slot) return null;

  const parts = slot.split("|");
  if (parts.length < 2) return null;

  return parts[1].trim(); // "Instructor 1"
}

function getColumnIndexByHeader_(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || "").trim().toLowerCase();
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

function getStringByIndex_(row, resolvedIndex, fallbackIndex) {
  if (resolvedIndex >= 0 && resolvedIndex < row.length) {
    return String(row[resolvedIndex] || "").trim();
  }

  if (fallbackIndex >= 0 && fallbackIndex < row.length) {
    return String(row[fallbackIndex] || "").trim();
  }

  return "";
}

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

  Logger.log("===== refreshSummary START =====");

  const lock = LockService.getScriptLock();

  try {
    Logger.log("Waiting for lock...");
    lock.waitLock(30000);
    Logger.log("Lock acquired");

    const ss = SpreadsheetApp.getActive();
    Logger.log("Spreadsheet: " + ss.getName());

    const formSheet = getActiveFormResponseSheet();
    Logger.log("Form sheet: " + (formSheet ? formSheet.getName() : "NOT FOUND"));

    const summarySheet = ss.getSheetByName("Summary");
    Logger.log("Summary sheet: " + (summarySheet ? "FOUND" : "NOT FOUND"));

    const instructorMap = getInstructorMap();
    Logger.log("Instructor map size: " + Object.keys(instructorMap).length);

    if (!formSheet || !summarySheet) {
      Logger.log("❌ Missing sheet. Exiting.");
      return;
    }

    const formLastRow = formSheet.getLastRow();
    Logger.log("Form last row: " + formLastRow);

    if (formLastRow < 2) {
      Logger.log("❌ No form responses yet.");
      return;
    }

    const existing = getExistingIds(summarySheet);
    Logger.log("Existing keys count: " + Object.keys(existing).length);

    const rowsToAppend = [];

    for (let r = 2; r <= formLastRow; r++) {

      Logger.log("Reading form row: " + r);

      const row = formSheet.getRange(r, 1, 1, 5).getValues()[0];

      Logger.log("Raw row: " + JSON.stringify(row));

      const name = String(row[1] || "").trim();
      const email = String(row[2] || "").trim();
      const slot = String(row[3] || "").trim();

      Logger.log("Parsed → Name: " + name);
      Logger.log("Parsed → Email: " + email);
      Logger.log("Parsed → Slot: " + slot);

      if (!email || !slot) {
        Logger.log("⚠️ Missing email or slot → skipping");
        continue;
      }

      const key = email + " | " + slot;
      Logger.log("Generated key: " + key);

      if (existing[key]) {
        Logger.log("⚠️ Already exists → skipping");
        continue;
      }

      Logger.log("✅ New record detected");

      const id = Utilities.getUuid();
      existing[key] = true;

      const instructorKey = extractInstructorKey(slot);
      Logger.log("Instructor key: " + instructorKey);

      const instructorName = instructorMap[instructorKey] || "";
      Logger.log("Instructor name: " + instructorName);

      rowsToAppend.push([
        id,
        instructorName,
        slot,
        name,
        email,
        "Pending",
        "", "", "", "",
        "",
        "",
        ""
      ]);
    }

    Logger.log("Rows prepared: " + rowsToAppend.length);

    if (rowsToAppend.length > 0) {
      summarySheet
        .getRange(summarySheet.getLastRow() + 1, 1, rowsToAppend.length, 13)
        .setValues(rowsToAppend);

      Logger.log("✅ Rows written to Summary");
    } else {
      Logger.log("⚠️ Nothing to append");
    }

  } catch (err) {
    Logger.log("🔥 ERROR: " + err);
    throw err;
  } finally {
    lock.releaseLock();
    Logger.log("Lock released");
    Logger.log("===== refreshSummary END =====");
  }
}

/* ===========================
   EXISTING RECORD MAP
=========================== */
function getExistingIds(summarySheet) {
  const map = {};
  const last = summarySheet.getLastRow();
  if (last < 2) return map;

  const data = summarySheet.getRange(2, 1, last - 1, 13).getValues();

  data.forEach(r => {
    const email = String(r[4] || "").trim(); // Column E
    const slot  = String(r[2] || "").trim(); // Column C

    if (email && slot) {
      map[email + " | " + slot] = true;
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

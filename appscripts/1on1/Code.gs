function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Slot Manager")
    .addItem("Sync Slots to Form", "syncAvailableSlotsToForm")
    .addItem("Update", "autoSyncMidnight")
    .addItem("Create 1-on-1 Slots","openSlotWizard")
    .addToUi();
}

/* ---------- HELPERS ---------- */

function normalizeSlot(text) {
  return text
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getEvaluatorDisplayName(value) {
  if (!value) return "";

  if (!value.includes("@")) {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  var name = value.match(/^([^@]+)@/)[1];
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/* ---------- TRIGGER ---------- */

function createTrigger() {
  var FORM_ID = "1wLHl27-ckaDv80K2v_HD79RcsUDyThKYo-723EJLBQo";
  var form = FormApp.openById(FORM_ID);

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("onFormSubmit")
    .forForm(form)
    .onFormSubmit()
    .create();
}

/* ---------- FORM SUBMIT ---------- */

function onFormSubmit(e) {
  var SHEET_ID = "17gb8QUDCPIjINQwmKsoG6CQKzv97qPYy11qNKWoPj8w";
  var SHEET_NAME = "Slot";

  var SLOT_COL = 1;
  var TAKEN_COL = 2;
  var REMAINING_COL = 3;
  var EVALUATOR_COL = 5;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    if (!e || !e.response) return;

    var chosenSlot, studentEmail;

    e.response.getItemResponses().forEach(function(ir) {
      var title = ir.getItem().getTitle();
      if (title.startsWith("Slots (Timing in IST)")) chosenSlot = ir.getResponse();
      if (title === "Student Email") studentEmail = ir.getResponse();
    });

    if (!chosenSlot) return;

    var selectedRawSlot = normalizeSlot(chosenSlot.split(" | ")[0]);
    var selectedEvaluator = chosenSlot.split(" | ")[1].trim();

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    var values = sheet.getDataRange().getValues();

    for (var r = 1; r < values.length; r++) {
      var slot = normalizeSlot(values[r][SLOT_COL - 1]);
      var taken = values[r][TAKEN_COL - 1];
      var remaining = values[r][REMAINING_COL - 1];
      var evaluatorEmail = values[r][EVALUATOR_COL - 1];
      var evaluatorName = getEvaluatorDisplayName(evaluatorEmail);

      if (
        slot === selectedRawSlot &&
        evaluatorName === selectedEvaluator &&
        remaining > 0
      ) {
        sheet.getRange(r + 1, TAKEN_COL).setValue(taken + 1);
        sheet.getRange(r + 1, REMAINING_COL).setValue(remaining - 1);

        if (studentEmail && evaluatorEmail) {
          handleEvaluatorSession(values, sheet, r, studentEmail, evaluatorEmail);
        }
        break;
      }

    }

    syncAvailableSlotsToForm();

  } finally {
    lock.releaseLock();
  }
}

/* ---------- SLOT SYNC ---------- */

function syncAvailableSlotsToForm() {
  var SHEET_ID = "17gb8QUDCPIjINQwmKsoG6CQKzv97qPYy11qNKWoPj8w";
  var SHEET_NAME = "Slot";
  var FORM_ID = "1wLHl27-ckaDv80K2v_HD79RcsUDyThKYo-723EJLBQo";

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();

  var slots = {
    DS: [],
    PG: [],
  };

  for (var i = 1; i < values.length; i++) {
    var rawSlot = values[i][0];
    var remaining = values[i][2];
    var evaluatorName = getEvaluatorDisplayName(values[i][4]);

    if (!rawSlot || remaining <= 0 || !evaluatorName) continue;

    var displaySlot = normalizeSlot(rawSlot) + " | " + evaluatorName;


    if (rawSlot.includes("(Data Science)"))
      slots.DS.push(displaySlot);

    if (rawSlot.includes("(Programming)"))
      slots.PG.push(displaySlot);
  }

  var form = FormApp.openById(FORM_ID);

  if (
    !slots.DS.length &&
    !slots.PG.length
  ) {
    form.setAcceptingResponses(false);
    return;
  }

  form.setAcceptingResponses(true);

  updateSlotQuestion(form, "Slots (Timing in IST) – Data Science", slots.DS);
  updateSlotQuestion(form, "Slots (Timing in IST) – Programming", slots.PG);
}

function updateSlotQuestion(form, title, slotList) {
  var items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);
  var item = items.find(i => i.getTitle() === title);

  if (!item) {
    item = form.addMultipleChoiceItem().setTitle(title);
  }

  item.asMultipleChoiceItem().setChoiceValues(
    slotList.length ? slotList : ["No slots available"]
  );
}

/* ---------- CALENDAR + BLOCK LOGIC ---------- */
/* (UNCHANGED — YOUR CODE HERE IS ALREADY CORRECT) */



/*****************************
 * EVALUATOR SESSION HANDLER
 *****************************/
function handleEvaluatorSession(values, sheet, rowIndex, studentEmail, evaluatorEmail) {
  var SLOT_COL = 1;
  var EVALUATOR_COL = 5;
  var EVENT_ID_COL = 6;

  var block = findEvaluatorBlock(values, rowIndex, SLOT_COL - 1, EVALUATOR_COL - 1);

  var eventId = null;
  for (var i = block.top; i <= block.bottom; i++) {
    if (values[i][EVENT_ID_COL - 1]) {
      eventId = values[i][EVENT_ID_COL - 1];
      break;
    }
  }

  var start = extractStartTime(values[block.top][SLOT_COL - 1]);
  var end = extractEndTime(values[block.bottom][SLOT_COL - 1]);

  Logger.log("📅 Creating/updating calendar event");

  eventId = createOrUpdateMeeting(
    eventId,
    start,
    end,
    evaluatorEmail,
    studentEmail
  );

  for (var i = block.top; i <= block.bottom; i++) {
    sheet.getRange(i + 1, EVENT_ID_COL).setValue(eventId);
  }
}

/*****************************
 * BLOCK DETECTION
 *****************************/
function findEvaluatorBlock(values, startRow, slotCol, evaluatorCol) {
  var evaluator = values[startRow][evaluatorCol];
  var top = startRow;
  var bottom = startRow;

  while (
    top > 1 &&
    values[top - 1][evaluatorCol] === evaluator &&
    areSlotsContinuous(values[top - 1][slotCol], values[top][slotCol])
  ) top--;

  while (
    bottom < values.length - 1 &&
    values[bottom + 1][evaluatorCol] === evaluator &&
    areSlotsContinuous(values[bottom][slotCol], values[bottom + 1][slotCol])
  ) bottom++;

  return { top: top, bottom: bottom };
}

function areSlotsContinuous(a, b) {
  return extractEndTime(a).getTime() === extractStartTime(b).getTime();
}

/*****************************
 * TIME PARSING
 *****************************/
function extractStartTime(slotText) {
  var m = slotText.match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{1,2}):(\d{2})\s*([AP]M)/);
  return buildDate(m, true);
}

function extractEndTime(slotText) {
  var m = slotText.match(/(\d{2})\/(\d{2})\/(\d{4}).*?[-–—]\s*(\d{1,2}):(\d{2})\s*([AP]M)/);
  return buildDate([null, m[1], m[2], m[3], null, null, null, m[4], m[5], m[6]], false);
}

function buildDate(match, isStart) {
  var d = +match[1], m = +match[2] - 1, y = +match[3];
  var h = +(isStart ? match[4] : match[7]);
  var min = +(isStart ? match[5] : match[8]);
  var ap = isStart ? match[6] : match[9];

  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;

  return new Date(y, m, d, h, min);
}

/*****************************
 * CALENDAR LOGIC
 *****************************/
function createOrUpdateMeeting(eventId, start, end, evaluatorEmail, studentEmail) {
  var CALENDAR_ID = "c_6f35047cccd7bac679e647b411414afe318551830edf885aa33ddea1a8772f84@group.calendar.google.com";
  Logger.log(Calendar.Events.list(CALENDAR_ID).items.length);

  try {
    if (!eventId) {
      var event = {
        summary: "1on1 Session with Instructor",
        description: "Kindly attend the scheduled session.",
        start: { dateTime: start.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
        attendees: [
          { email: evaluatorEmail },
          { email: studentEmail }
        ],
        conferenceData: {
          createRequest: {
            requestId: Utilities.getUuid(),
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        }
      };

      var created = Calendar.Events.insert(
        event,
        CALENDAR_ID,
        { conferenceDataVersion: 1, sendUpdates: "all" }
      );

      Logger.log("✅ Calendar event created: " + created.id);
      Logger.log("Meet link: " + created.hangoutLink);

      return created.id;
    }

    var existing = Calendar.Events.get(CALENDAR_ID, eventId);
    existing.attendees = existing.attendees || [];

    var exists = existing.attendees.some(a => a.email === studentEmail);
    if (!exists) {
      existing.attendees.push({ email: studentEmail });
    }

    Calendar.Events.update(
      existing,
      CALENDAR_ID,
      eventId,
      { sendUpdates: "all" }
    );

    Logger.log("✅ Student added to existing event");
    return eventId;

  } catch (err) {
    Logger.log("❌ Calendar error: " + err.message);
    throw err;
  }
}
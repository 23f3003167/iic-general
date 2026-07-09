function createSlotTrigger() {
  var FORM_ID = "1Rskp34_FQoM77f7Gg2L8XpWNZ_uiHjXI8UBuVnw4yy0";
  var form = FormApp.openById(FORM_ID);

  // Remove old triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onSlotSubmit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create correct trigger
  ScriptApp.newTrigger("onSlotSubmit")
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log("✅ Form submit trigger created");
}

function onSlotSubmit(e) {

  if (!e || !e.response) {
    Logger.log("❌ Invalid trigger source");
    return;
  }
  var SHEET_ID = "11kkG4ZPkRzgc5xRvTn9TF7n1RtQ15p-TXwZFT0YpL8I";
  var SHEET_NAME = "Slot";

  var SLOT_COL = 1;
  var TAKEN_COL = 2;
  var REMAINING_COL = 3;
  var EVALUATOR_COL = 5;
  var EVENT_ID_COL = 6;

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var response = e.response;
    var studentEmail = null;

    response.getItemResponses().forEach(function (ir) {
      if (ir.getItem().getTitle() === "Email ID") {
        studentEmail = ir.getResponse();
      }
    });

    studentEmail = studentEmail ? studentEmail.trim().toLowerCase() : null;

    if (!isAuthorizedStudent(studentEmail)) {

        // store response id for deletion
      PropertiesService.getScriptProperties()
        .setProperty("REJECT_" + e.response.getId(), "1");

      Utilities.sleep(4000); // wait for Google to write row to sheet

      removeLatestFormResponseRow();

      MailApp.sendEmail({
        to: studentEmail,
        subject: "Form Submission Rejected – IIC",
        body:
          "Dear Student,\n\n" +
          "You are currently not eligible to book a slot.\n" +
          "If you believe this is a mistake, please contact the coordinators."
      });

      Logger.log("Unauthorized booking blocked: " + studentEmail);
      return;
    }


    var chosenSlot = null;
    response.getItemResponses().forEach(function (ir) {
      if (ir.getItem().getTitle().startsWith("Slots (Timing in IST)")) {
        chosenSlot = ir.getResponse();
      }
    });

    if (!chosenSlot) return;

    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    var values = sheet.getDataRange().getValues();

    for (var r = 1; r < values.length; r++) {
      var slot = values[r][SLOT_COL - 1];
      var remaining = values[r][REMAINING_COL - 1];
      var evaluatorEmail = values[r][EVALUATOR_COL - 1];

      if (slot === chosenSlot && remaining > 0) {
        // Update seats
        sheet.getRange(r + 1, TAKEN_COL).setValue(values[r][TAKEN_COL - 1] + 1);
        sheet.getRange(r + 1, REMAINING_COL).setValue(remaining - 1);

        studentEmail = studentEmail ? studentEmail.trim().toLowerCase() : null;
        evaluatorEmail = evaluatorEmail ? evaluatorEmail.trim().toLowerCase() : null;

        Logger.log("Student Email = " + studentEmail);
        Logger.log("Evaluator Email = " + evaluatorEmail);

        if (studentEmail && evaluatorEmail) {
          handleEvaluatorSession(
            values,
            sheet,
            r,
            studentEmail,
            evaluatorEmail
          );
        }

        break;
      }
    }

    // ❗ DO NOT TOUCH — as requested
    syncAvailableSlotsToForm();

  } catch (err) {
    Logger.log("❌ Error: " + err);
  } finally {
    lock.releaseLock();
  }
}

function handleEvaluatorSession(values, sheet, rowIndex, studentEmail, evaluatorEmail) {
  var SLOT_COL = 1;
  var EVALUATOR_COL = 5;
  var EVENT_ID_COL = 6;

  // Find continuous evaluator block
  var block = findEvaluatorBlock(values, rowIndex, SLOT_COL - 1, EVALUATOR_COL - 1);

  // Check existing Event ID in block
  var eventId = null;
  for (var i = block.top; i <= block.bottom; i++) {
    if (values[i][EVENT_ID_COL - 1]) {
      eventId = values[i][EVENT_ID_COL - 1];
      break;
    }
  }

  var start = extractStartTime(values[block.top][SLOT_COL - 1]);
  var end = extractEndTime(values[block.bottom][SLOT_COL - 1]);

  eventId = createOrUpdateMeeting(
    eventId,
    start,
    end,
    evaluatorEmail,
    studentEmail
  );

  // Write same Event ID to entire block
  for (var i = block.top; i <= block.bottom; i++) {
    sheet.getRange(i + 1, EVENT_ID_COL).setValue(eventId);
  }
}


function findEvaluatorBlock(values, startRow, slotCol, evaluatorCol) {
  var evaluator = values[startRow][evaluatorCol];
  var top = startRow;
  var bottom = startRow;

  while (
    top > 1 &&
    values[top - 1][evaluatorCol] === evaluator &&
    areSlotsContinuous(values[top - 1][slotCol], values[top][slotCol])
  ) {
    top--;
  }

  while (
    bottom < values.length - 1 &&
    values[bottom + 1][evaluatorCol] === evaluator &&
    areSlotsContinuous(values[bottom][slotCol], values[bottom + 1][slotCol])
  ) {
    bottom++;
  }

  return { top: top, bottom: bottom };
}

function areSlotsContinuous(a, b) {
  return extractEndTime(a).getTime() === extractStartTime(b).getTime();
}

function extractStartTime(slotText) {
  var m = slotText.match(
    /(\d{2})\/(\d{2})\/(\d{4}).*?(\d{1,2}):(\d{2})\s*([AP]M)/
  );
  return buildDate(m, true);
}

function extractEndTime(slotText) {
  var m = slotText.match(
    /(\d{2})\/(\d{2})\/(\d{4}).*?[-–—]\s*(\d{1,2}):(\d{2})\s*([AP]M)/
  );
  return buildDate(
    [null, m[1], m[2], m[3], null, null, null, m[4], m[5], m[6]],
    false
  );
}

function buildDate(match, isStart) {
  var d = +match[1];
  var m = +match[2] - 1;
  var y = +match[3];

  var h = +(isStart ? match[4] : match[7]);
  var min = +(isStart ? match[5] : match[8]);
  var ap = isStart ? match[6] : match[9];

  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;

  return new Date(y, m, d, h, min);
}

function createOrUpdateMeeting(eventId, start, end, evaluatorEmail, studentEmail) {
  var configuredCalendarId = String(PropertiesService.getScriptProperties().getProperty('PRESENTATION_CALENDAR_ID') || '').trim();
  var calendarId = configuredCalendarId || "c_d0f61069328b5f6bcce8d3c7c6ce34f0826cbb8d2291f9029448ff2da38746ae@group.calendar.google.com";

  if (!eventId) {
    var event = {
      summary: "Presentation Round",
      description: "Kindly please attend the meet as per your chosen Slot.",
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

    try {
      var created = Calendar.Events.insert(event, calendarId, { conferenceDataVersion: 1, sendUpdates: "all" });
      Logger.log('✅ Calendar event created on %s: %s', calendarId, created.id);
      return created.id;
    } catch (_err) {
      Logger.log('⚠️ Calendar insert failed for %s: %s — falling back to primary', calendarId, _err && _err.message);
      var createdFallback = Calendar.Events.insert(event, 'primary', { conferenceDataVersion: 1, sendUpdates: "all" });
      Logger.log('✅ Calendar event created on primary: %s', createdFallback.id);
      return createdFallback.id;
    }
  }

  var existing;
  try {
    existing = Calendar.Events.get(calendarId, eventId);
  } catch (_getErr) {
    Logger.log('⚠️ Failed to fetch event %s from %s: %s — trying primary', eventId, calendarId, _getErr && _getErr.message);
    existing = Calendar.Events.get('primary', eventId);
    calendarId = 'primary';
  }

  existing.attendees = existing.attendees || [];
  var alreadyAdded = false;
  for (var i = 0; i < existing.attendees.length; i++) {
    if (String(existing.attendees[i].email || '').trim().toLowerCase() === String(studentEmail || '').trim().toLowerCase()) {
      alreadyAdded = true;
      break;
    }
  }
  if (!alreadyAdded) existing.attendees.push({ email: studentEmail });

  try {
    Calendar.Events.update(existing, calendarId, eventId, { sendUpdates: "all" });
  } catch (_updateErr) {
    Logger.log('⚠️ Calendar update failed on %s for event %s: %s — attempting update on primary', calendarId, eventId, _updateErr && _updateErr.message);
    if (calendarId !== 'primary') {
      // try updating on primary calendar
      try {
        Calendar.Events.update(existing, 'primary', eventId, { sendUpdates: "all" });
        calendarId = 'primary';
      } catch (_err2) {
        throw _err2;
      }
    } else {
      throw _updateErr;
    }
  }

  Logger.log('✅ Event %s updated on calendar %s', eventId, calendarId);
  return eventId;
}

function syncAvailableSlotsToForm() {
  var SHEET_ID = "11kkG4ZPkRzgc5xRvTn9TF7n1RtQ15p-TXwZFT0YpL8I";
  var SHEET_NAME = "Slot";
  var FORM_ID = "1Rskp34_FQoM77f7Gg2L8XpWNZ_uiHjXI8UBuVnw4yy0";
  var SLOT_COL = 1;
  var REMAINING_COL = 3;

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();

  var slotList = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i][SLOT_COL - 1] && values[i][REMAINING_COL - 1] > 0) {
      slotList.push(values[i][SLOT_COL - 1].toString().trim());
    }
  }

  var form = FormApp.openById(FORM_ID);

  if (slotList.length === 0) {
    form.setAcceptingResponses(false);
    return;
  }

  // ✅ FIND THE CORRECT SLOT QUESTION
  var slotItem = null;
  var items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);

  for (var i = 0; i < items.length; i++) {
    var mcq = items[i].asMultipleChoiceItem();
    if (mcq.getTitle().startsWith("Slots (Timing in IST)")) {
      slotItem = mcq;
      break;
    }
  }

  if (!slotItem) {
    Logger.log("❌ Slot question not found");
    return;
  }

  slotItem.setChoiceValues(slotList);
  Logger.log("✅ Slot options updated in form");
}

function removeLatestFormResponseRow() {

  const ss = SpreadsheetApp.getActive();
  const formSheet = getActiveFormResponseSheet();

  if (!formSheet) return;

  const lastRow = formSheet.getLastRow();
  if (lastRow <= 1) return;

  formSheet.deleteRow(lastRow);

  Logger.log("🧹 Unauthorized response row removed from sheet");
}


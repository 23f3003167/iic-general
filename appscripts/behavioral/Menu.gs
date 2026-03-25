//-----------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Manager")
    .addItem("Generate Slots", "generateSlotsWizard")
    .addItem("Sync Slots to Form", "confirmAndSyncSlots")
    .addItem("Refresh Summary", "refreshSummary")
    .addToUi();
}

function confirmAndSyncSlots() {

  var ui = SpreadsheetApp.getUi();

  // 🔒 Mandatory authorization check
  if (!checkStudentsBeforeSync()) {
    ui.alert("❌ Sync cancelled. Students list not confirmed.");
    return;
  }

  var response = ui.alert(
    "Reset Form for Reattempts?",
    "YES → Clear form responses for new round.\nNO → Only update slot availability.",
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    resetFormResponsesForReattempt();
  }

  syncAvailableSlotsToForm();

  ui.alert("✅ Slots published with new authorized students.");
}


function resetFormResponsesForReattempt() {
  const FORM_ID = "1jkk_gq7kRqHUtrPkbkntBtxYsdiXHf2Mxlnag9QsdrU";
  const ss = SpreadsheetApp.getActive();
  const form = FormApp.openById(FORM_ID);

  // Unlink the form (this freezes old responses in current sheet)
  form.removeDestination();

  // Clear responses from the Form itself
  form.deleteAllResponses();

  // Re-link to the same spreadsheet
  // Google will automatically create "Form Responses 2 / 3 / ..."
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log("✅ Form reset completed – new Form Responses sheet created");
}

function getActiveFormResponseSheet() {
  const FORM_ID = "1jkk_gq7kRqHUtrPkbkntBtxYsdiXHf2Mxlnag9QsdrU";
  const ss = SpreadsheetApp.getActive();
  const form = FormApp.openById(FORM_ID);

  const destinationId = form.getDestinationId();
  if (!destinationId) {
    throw new Error("Form is not linked to any spreadsheet.");
  }

  const sheets = ss.getSheets();
  for (const sheet of sheets) {
    if (sheet.getFormUrl()) {
      return sheet;
    }
  }

  throw new Error("No active Form Responses sheet found.");
}


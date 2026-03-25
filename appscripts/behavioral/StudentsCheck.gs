function checkStudentsBeforeSync() {

  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName("Students");

  if (!sheet) {
    ui.alert("❌ Students sheet not found!");
    return false;
  }

  // Ask admin which column to use
  const response = ui.prompt(
    "Select Authorization Column",
    "Enter column letter to use (Example: A or B or C)",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return false;

  const columnLetter = response.getResponseText().trim().toUpperCase();

  const stats = evaluateStudentAuthorizationColumn(columnLetter);
  if (!stats.ok) {
    ui.alert("❌ " + stats.error);
    return false;
  }

  // Save chosen column permanently
  PropertiesService.getScriptProperties()
    .setProperty("ACTIVE_STUDENT_COLUMN", columnLetter);

  let message =
    "Authorization Column: " + columnLetter + "\n\n" +
    "Valid Students Found: " + stats.allowed + "\n" +
    "Invalid Emails: " + stats.invalidEmails.length + "\n\n" +
    "Proceed to publish slots?";

  const confirm = ui.alert("Check Students List", message, ui.ButtonSet.YES_NO);

  return confirm === ui.Button.YES;
}

function evaluateStudentAuthorizationColumn(columnLetter) {

  if (!columnLetter.match(/^[A-Z]+$/)) {
    return {
      ok: false,
      error: "Invalid column. Use letters only (A, B, C...)",
      allowed: 0,
      invalidEmails: []
    };
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName("Students");
  if (!sheet) {
    return {
      ok: false,
      error: "Students sheet not found",
      allowed: 0,
      invalidEmails: []
    };
  }

  const columnIndex = columnToIndex(columnLetter);
  const data = sheet.getDataRange().getValues();

  let allowed = 0;
  let invalidEmails = [];

  for (let i = 1; i < data.length; i++) {

    const email = (data[i][columnIndex] || "").toString().trim();

    if (!email) continue;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      invalidEmails.push(email);
      continue;
    }

    allowed++;
  }

  return {
    ok: true,
    error: "",
    allowed: allowed,
    invalidEmails: invalidEmails
  };
}

function columnToIndex(letter) {
  let column = 0;
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column - 1;
}
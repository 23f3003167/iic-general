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

  if (!columnLetter.match(/^[A-Z]+$/)) {
    ui.alert("❌ Invalid column. Use letters only (A, B, C...)");
    return false;
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

  // Save chosen column permanently
  PropertiesService.getScriptProperties()
    .setProperty("ACTIVE_STUDENT_COLUMN", columnLetter);

  let message =
    "Authorization Column: " + columnLetter + "\n\n" +
    "Valid Students Found: " + allowed + "\n" +
    "Invalid Emails: " + invalidEmails.length + "\n\n" +
    "Proceed to publish slots?";

  const confirm = ui.alert("Check Students List", message, ui.ButtonSet.YES_NO);

  return confirm === ui.Button.YES;
}

function columnToIndex(letter) {
  let column = 0;
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column - 1;
}

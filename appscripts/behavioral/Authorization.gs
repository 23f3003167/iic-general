function isAuthorizedStudent(email) {

  const sheet = SpreadsheetApp.getActive().getSheetByName("Students");
  if (!sheet) return false;

  const columnLetter = PropertiesService
    .getScriptProperties()
    .getProperty("ACTIVE_STUDENT_COLUMN");

  // If admin never synced yet
  if (!columnLetter) return false;

  const columnIndex = columnToIndex(columnLetter);
  const data = sheet.getDataRange().getValues();

  email = email.toString().trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const studentEmail = (data[i][columnIndex] || "")
      .toString()
      .trim()
      .toLowerCase();

    if (studentEmail === email) {
      return true;
    }
  }

  return false;
}

function cleanUnauthorizedResponses(e) {

  const sheet = e.range.getSheet();
  if (!sheet.getName().includes("Form Responses")) return;

  const row = e.range.getRow();

  // Email column (change if needed)
  const email = sheet.getRange(row, 3).getValue().toString().trim().toLowerCase();

  if (!isAuthorizedStudent(email)) {
    Logger.log("Deleting unauthorized response row: " + row + " | " + email);
    sheet.deleteRow(row);
  }
}

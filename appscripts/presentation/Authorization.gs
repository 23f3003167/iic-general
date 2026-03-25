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

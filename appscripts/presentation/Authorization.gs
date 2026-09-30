function isAuthorizedStudent(email) {

  const sheet = SpreadsheetApp.getActive().getSheetByName("Students");
  if (!sheet) return false;
  const columnIndex = Math.max(sheet.getLastColumn() - 1, 0);
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

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu("Clean")
    .addItem("PPM", "cleanPPM")
    .addItem("CSM", "cleanCSM")
    .addItem("Aptitude", "cleanAptitude")
    .addItem("BA", "cleanBA")
    .addItem("Presentation", "cleanPresentation")
    .addItem("Tech MCQ", "cleanTechMCQ")
    .addItem("AI Mock", "cleanAIMock")
    .addItem("1on1", "cleanOneOnOne")
    .addToUi();
}


function cleanBlock(startCol, width, targetSheet) {

  var sheet = targetSheet || SpreadsheetApp.getActiveSheet();
  if (!sheet) {
    throw new Error('No target sheet available for cleanup.');
  }

  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return;
  }

  var range = sheet.getRange(2, startCol, lastRow - 1, width);
  var data = range.getValues();

  var seen = {};
  var cleaned = [];

  for (var i = 0; i < data.length; i++) {

    var email = String(data[i][0] || '').trim();
    if (!email) continue;

    var normalizedRow = [];
    for (var j = 0; j < width; j++) {
      var cell = data[i][j];
      normalizedRow.push(String(cell == null ? '' : cell).trim());
    }

    normalizedRow[0] = normalizedRow[0].toLowerCase();
    var key = normalizedRow.join("_");

    if (!seen[key]) {
      seen[key] = true;
      cleaned.push(data[i]);
    }

  }

  while (cleaned.length < data.length) {
    cleaned.push(new Array(width).fill(""));
  }

  range.setValues(cleaned);

}

function cleanPPM() {
  cleanBlock(1,2);   // A:B
}

function cleanCSM() {
  cleanBlock(4,5);   // D:H
}

function cleanAptitude() {
  cleanBlock(10,2);  // J:K
}

function cleanBA() {
  cleanBlock(13,2);  // M:N
}

function cleanPresentation() {
  cleanBlock(16,2);  // P:Q
}

function cleanTechMCQ() {
  cleanBlock(19,2);  // S:T
}

function cleanAIMock() {
  cleanBlock(22,2);  // V:W
}

function cleanOneOnOne() {
  cleanBlock(25,2);  // Y:Z
}
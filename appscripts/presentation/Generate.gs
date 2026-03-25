function generateSlotsWizard() {
  const ui = SpreadsheetApp.getUi();

  const dateStr = ui.prompt("Enter Date", "Format: DD/MM/YYYY", ui.ButtonSet.OK_CANCEL);
  if (dateStr.getSelectedButton() !== ui.Button.OK) return;

  const startStr = ui.prompt("Start Time", "Example: 10:00 AM", ui.ButtonSet.OK_CANCEL);
  if (startStr.getSelectedButton() !== ui.Button.OK) return;

  const endStr = ui.prompt("End Time", "Example: 12:00 PM", ui.ButtonSet.OK_CANCEL);
  if (endStr.getSelectedButton() !== ui.Button.OK) return;

  const durationStr = ui.prompt("Slot Duration (minutes)", "Example: 15", ui.ButtonSet.OK_CANCEL);
  if (durationStr.getSelectedButton() !== ui.Button.OK) return;

  const instructorStr = ui.prompt("Instructor Number", "Example: 1", ui.ButtonSet.OK_CANCEL);
  if (instructorStr.getSelectedButton() !== ui.Button.OK) return;

  createSlots(
    dateStr.getResponseText().trim(),
    startStr.getResponseText().trim(),
    endStr.getResponseText().trim(),
    parseInt(durationStr.getResponseText(), 10),
    instructorStr.getResponseText().trim()
  );
}

function createSlots(dateStr, startTimeStr, endTimeStr, durationMin, instructorNum) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("Slot");
  const instructorMap = getInstructorEmailMap();

  const instructorKey = "Instructor " + instructorNum;
  const evaluatorEmail = instructorMap[instructorKey];
  if (!evaluatorEmail) {
    throw new Error("Instructor not found in Instructors sheet");
  }

  let start = parseDateTime(dateStr, startTimeStr);
  const end = parseDateTime(dateStr, endTimeStr);

  const rows = [];

  while (start < end) {
    const slotEnd = new Date(start.getTime() + durationMin * 60000);
    if (slotEnd > end) break;

    const dayName = Utilities.formatDate(start, "Asia/Kolkata", "EEEE");
    const slotText =
      Utilities.formatDate(start, "Asia/Kolkata", "dd/MM/yyyy") +
      " " + dayName + " " +
      formatTime(start) + " – " + formatTime(slotEnd) +
      " | " + instructorKey;

    rows.push([
      slotText,   // Slot
      0,          // Seat Taken
      1,          // Seat Remaining
      1,          // Max Capacity
      evaluatorEmail,
      ""           // Calendar Event ID
    ]);

    start = slotEnd;
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  }
}

function parseDateTime(dateStr, timeStr) {
  const [d, m, y] = dateStr.split("/").map(Number);
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  let h = +match[1];
  const min = +match[2];
  const ap = match[3].toUpperCase();

  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;

  return new Date(y, m - 1, d, h, min, 0);
}

function formatTime(d) {
  return Utilities.formatDate(d, "Asia/Kolkata", "hh:mm a");
}

function getInstructorEmailMap() {
  const sheet = SpreadsheetApp.getActive().getSheetByName("Instructors");
  const data = sheet.getRange(1, 1, sheet.getLastRow(), 3).getValues();
  const map = {};

  data.forEach(r => {
    if (r[0] && r[2]) {
      map[String(r[0]).trim()] = String(r[2]).trim();
    }
  });

  return map;
}


/************ CONFIG ************/
const SHEET_NAME = "Form Responses 2";

/************ HELPERS ************/
function normalize(value){
  if(value === null || value === undefined) return "";
  return value.toString().trim().toLowerCase();
}

function serializeDate(value){
  if(!value) return "";
  const d = new Date(value);
  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "dd MMM yyyy, hh:mm a"
  );
}

/************ WEB APP ENTRY ************/
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/************ MAIN QUERY FUNCTION ************/
function getMySubmissions() {

  const rawUserEmail = Session.getActiveUser().getEmail();

  if(!rawUserEmail){
    return {
      status: "error",
      message: "Please open the portal using your IITM email login."
    };
  }

  const userEmail = normalize(rawUserEmail);

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEET_NAME);

  if(!sheet){
    return { status:"error", message:"Sheet not found." };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  /* -------- Detect Email Column (auto) -------- */
  const emailIndex = headers.findIndex(h =>
    normalize(h).includes("student email id")
  );

  if(emailIndex === -1){
    return { status:"error", message:"Email column not found in sheet." };
  }

  /* -------- Detect Certificate Link Column -------- */
  const proofIndex = headers.findIndex(h =>
    normalize(h).includes("paste the link below")
  );

  const results = [];

  for (let i = 1; i < data.length; i++) {

    const rowEmail = normalize(data[i][emailIndex]);

    if(rowEmail === userEmail){

      results.push({
        date: serializeDate(data[i][0]),
        course: String(data[i][37] || ""),
        proof: proofIndex !== -2 ? String(data[i][proofIndex] || "") : ""
      });
    }
  }


  if(results.length === 0){
    return {
      status: "empty",
      message: "No submissions found yet."
    };
  }

  return {
    status: "success",
    data: results
  };
}

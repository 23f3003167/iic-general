/******************************************************
 * AI EVALUATION PROJECT – APPS SCRIPT (WORKFLOW)
 * Orchestration for all modules:
 * - Self-Intro (video)
 * - Listening & Speaking (audio)
 * - Listening & Writing (text)
 * - Email Writing (text)
 ******************************************************/

/* =========================
   CONFIG
   ========================= */
const SHEET_NAME = "Evaluation";

// Input columns
const COL_SELF_INTRO_LINK = 3;   // C
const COL_LISTEN_SPEAK_LINK = 4; // D
const COL_LISTEN_WRITE_TEXT = 5; // E
const COL_EMAIL_TEXT = 6;        // F

// Status column
const COL_STATUS = 7;            // G

// Self-Intro outputs
const COL_SELF_INTRO_TRANSCRIPT = 8; // H
const COL_SELF_INTRO_SCORE = 10;     // J
const COL_SELF_INTRO_FEEDBACK = 11;  // K

// Listening & Speaking outputs
const COL_LISTEN_SPEAK_TRANSCRIPT = 9;  // I
const COL_LISTEN_SPEAK_SCORE = 12;      // L
const COL_LISTEN_SPEAK_FEEDBACK = 13;   // M

// Listening & Writing outputs
const COL_LISTEN_WRITE_SCORE = 14;      // N
const COL_LISTEN_WRITE_FEEDBACK = 15;   // O

// Email Writing outputs
const COL_EMAIL_SCORE = 16;             // P
const COL_EMAIL_FEEDBACK = 17;          // Q

// Overall outputs
const COL_TOTAL_SCORE = 18;             // R
const COL_EVALUATOR_VERSION = 19;       // S
const COL_EVALUATION_TIMESTAMP = 20;    // T

const EVALUATOR_VERSION = "v1.0";

/* =========================
   MENU
   ========================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("AI Evaluation")
    .addItem("Evaluate Selected Student", "evaluateSelectedStudent")
    .addItem("Evaluate all Students from Mth row to Nth row", "evaluateStudentsFromMToN")
    .addItem("Evaluate All Students", "evaluateAllStudents")
    .addSeparator()
    .addItem("Evaluate Self-Intro for all", "evaluateSelfIntroForAll")
    .addItem("Evalaute Self-Intro from Mth row to Nth row", "evaluateSelfIntroFromMToN")
    .addItem("Evaluate Listening and speaking for All", "evaluateListeningSpeakingForAll")
    .addItem("Evalaute Listening and speaking from Mth row to Nth row", "evaluateListeningSpeakingFromMToN")
    .addItem("Evalaute Listening and Writing for all", "evaluateListeningWritingForAll")
    .addItem("Evalaute Listening and Writing from Mth row to Nth row", "evaluateListeningWritingFromMToN")
    .addItem("Evaluate Email writing for all", "evaluateEmailWritingForAll")
    .addItem("Evalaute Email writing from Mth row to Nth row", "evaluateEmailWritingFromMToN")
    .addSeparator()
    .addItem("Set Cloud API URL", "setupCloudApiConfig")
    .addToUi();
}

/* =========================
   SELF-INTRO
   ========================= */
function evaluateSelfIntro() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = getActiveRow_(sheet);
  if (!row) return;

  if (!confirmOverwrite_(sheet, row, [COL_SELF_INTRO_SCORE, COL_SELF_INTRO_FEEDBACK])) return;

  const videoLink = sheet.getRange(row, COL_SELF_INTRO_LINK).getValue();
  if (!videoLink) {
    ui.alert("No Self-Intro video link found in Column C.");
    return;
  }

  const fileId = extractDriveFileId_(videoLink);
  if (!fileId) {
    ui.alert("Invalid Drive link in Column C.");
    return;
  }

  sheet.getRange(row, COL_STATUS).setValue("Queued: Self-Intro (Cloud)");
  setEvaluationMetadata_(sheet, row);
  triggerCloudEvaluation_("self_intro", row);
}

/* =========================
   LISTENING & SPEAKING
   ========================= */
function evaluateListeningSpeaking() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = getActiveRow_(sheet);
  if (!row) return;

  if (!confirmOverwrite_(sheet, row, [COL_LISTEN_SPEAK_SCORE, COL_LISTEN_SPEAK_FEEDBACK])) return;

  const audioLink = sheet.getRange(row, COL_LISTEN_SPEAK_LINK).getValue();
  if (!audioLink) {
    ui.alert("No Listening & Speaking audio link found in Column D.");
    return;
  }

  const fileId = extractDriveFileId_(audioLink);
  if (!fileId) {
    ui.alert("Invalid Drive link in Column D.");
    return;
  }

  sheet.getRange(row, COL_STATUS).setValue("Queued: Listening & Speaking (Cloud)");
  setEvaluationMetadata_(sheet, row);
  triggerCloudEvaluation_("listening_speaking", row);
}

/* =========================
   LISTENING & WRITING
   ========================= */
function evaluateListeningWriting() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = getActiveRow_(sheet);
  if (!row) return;

  if (!confirmOverwrite_(sheet, row, [COL_LISTEN_WRITE_SCORE, COL_LISTEN_WRITE_FEEDBACK])) return;

  const summaryText = sheet.getRange(row, COL_LISTEN_WRITE_TEXT).getValue();
  if (!summaryText || summaryText.toString().trim() === "") {
    ui.alert("No Listening & Writing response found in Column E.");
    return;
  }

  sheet.getRange(row, COL_STATUS).setValue("Queued: Listening & Writing (Cloud)");
  setEvaluationMetadata_(sheet, row);
  triggerCloudEvaluation_("listening_writing", row);
}

/* =========================
   EMAIL WRITING
   ========================= */
function evaluateEmailWriting() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = getActiveRow_(sheet);
  if (!row) return;

  if (!confirmOverwrite_(sheet, row, [COL_EMAIL_SCORE, COL_EMAIL_FEEDBACK])) return;

  const emailText = sheet.getRange(row, COL_EMAIL_TEXT).getValue();
  if (!emailText || emailText.toString().trim() === "") {
    ui.alert("No Email Writing response found in Column F.");
    return;
  }

  sheet.getRange(row, COL_STATUS).setValue("Queued: Email Writing (Cloud)");
  setEvaluationMetadata_(sheet, row);
  triggerCloudEvaluation_("email_writing", row);
}

/* =========================
   ALL MODULES (CLOUD)
   ========================= */
function evaluateAllModules() {
  evaluateSelectedStudent();
}

function evaluateSelectedStudent() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const row = getActiveRow_(sheet);
  if (!row) return;

  const c = sheet.getRange(row, COL_SELF_INTRO_LINK).getValue();
  const d = sheet.getRange(row, COL_LISTEN_SPEAK_LINK).getValue();
  const e = sheet.getRange(row, COL_LISTEN_WRITE_TEXT).getValue();
  const f = sheet.getRange(row, COL_EMAIL_TEXT).getValue();

  const hasAnyInput =
    (c && c.toString().trim() !== "") ||
    (d && d.toString().trim() !== "") ||
    (e && e.toString().trim() !== "") ||
    (f && f.toString().trim() !== "");

  if (!hasAnyInput) {
    ui.alert("No inputs found in columns C-F for this row.");
    return;
  }

  const batch = createBatchContext_("selected_student");

  sheet.getRange(row, COL_STATUS).setValue("Queued: Full Evaluation (Cloud)");
  setEvaluationMetadata_(sheet, row);
  const result = triggerCloudEvaluation_("all", row, {
    batchId: batch.id,
    batchLabel: batch.label
  });

  if (!result.ok) {
    sheet.getRange(row, COL_STATUS).setValue("Queue Failed");
  }
}

function evaluateBatchFiveRowsCloud() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const startRow = getActiveRow_(sheet);
  if (!startRow) return;
  queueCloudEvaluationForRows_(sheet, startRow, startRow + 4, "all", "five_rows", "Batch Evaluate 5 Rows");
}

function evaluateAllRowsCloud() {
  evaluateAllStudents();
}

function evaluateAllStudents() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    ui.alert("No student rows found.");
    return;
  }

  queueCloudEvaluationForRows_(sheet, 2, lastRow, "all", "all_students", "Evaluate All Students");
}

function evaluateStudentsFromMToN() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    ui.alert("No student rows found.");
    return;
  }

  const prompt = ui.prompt(
    "Evaluate Students from Mth row to Nth row",
    `Enter M,N (example: 2,20). Last row in sheet: ${lastRow}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  const text = (prompt.getResponseText() || "").trim();
  const parts = text.split(",").map((x) => x.trim());
  if (parts.length !== 2) {
    ui.alert("Invalid input. Please enter in M,N format (example: 2,20).");
    return;
  }

  const startRow = Number(parts[0]);
  const endRow = Number(parts[1]);

  if (!Number.isInteger(startRow) || !Number.isInteger(endRow) || startRow < 2 || endRow < startRow) {
    ui.alert("Invalid row range. Ensure M >= 2 and N >= M.");
    return;
  }

  const clippedEndRow = Math.min(endRow, lastRow);
  queueCloudEvaluationForRows_(sheet, startRow, clippedEndRow, "all", "m_to_n", "Evaluate Students from M to N");
}

function evaluateSelfIntroForAll() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  queueCloudEvaluationForRows_(sheet, 2, sheet.getLastRow(), "self_intro", "self_intro_all", "Evaluate Self-Intro for all");
}

function evaluateSelfIntroFromMToN() {
  queueSingleActivityFromMToN_(
    "self_intro",
    "self_intro_m_to_n",
    "Evalaute Self-Intro from Mth row to Nth row"
  );
}

function evaluateListeningSpeakingForAll() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  queueCloudEvaluationForRows_(sheet, 2, sheet.getLastRow(), "listening_speaking", "listening_speaking_all", "Evaluate Listening and speaking for All");
}

function evaluateListeningSpeakingFromMToN() {
  queueSingleActivityFromMToN_(
    "listening_speaking",
    "listening_speaking_m_to_n",
    "Evalaute Listening and speaking from Mth row to Nth row"
  );
}

function evaluateListeningWritingForAll() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  queueCloudEvaluationForRows_(sheet, 2, sheet.getLastRow(), "listening_writing", "listening_writing_all", "Evaluate Listening and Writing for all");
}

function evaluateListeningWritingFromMToN() {
  queueSingleActivityFromMToN_(
    "listening_writing",
    "listening_writing_m_to_n",
    "Evalaute Listening and Writing from Mth row to Nth row"
  );
}

function evaluateEmailWritingForAll() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  queueCloudEvaluationForRows_(sheet, 2, sheet.getLastRow(), "email_writing", "email_writing_all", "Evaluate Email writing for all");
}

function evaluateEmailWritingFromMToN() {
  queueSingleActivityFromMToN_(
    "email_writing",
    "email_writing_m_to_n",
    "Evalaute Email writing from Mth row to Nth row"
  );
}

function queueSingleActivityFromMToN_(moduleName, batchKind, title) {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    ui.alert("No student rows found.");
    return;
  }

  const prompt = ui.prompt(
    title,
    `Enter M,N (example: 2,20). Last row in sheet: ${lastRow}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  const text = (prompt.getResponseText() || "").trim();
  const parts = text.split(",").map((x) => x.trim());
  if (parts.length !== 2) {
    ui.alert("Invalid input. Please enter in M,N format (example: 2,20).");
    return;
  }

  const startRow = Number(parts[0]);
  const endRow = Number(parts[1]);

  if (!Number.isInteger(startRow) || !Number.isInteger(endRow) || startRow < 2 || endRow < startRow) {
    ui.alert("Invalid row range. Ensure M >= 2 and N >= M.");
    return;
  }

  const clippedEndRow = Math.min(endRow, lastRow);
  queueCloudEvaluationForRows_(sheet, startRow, clippedEndRow, moduleName, batchKind, title);
}

function queueCloudEvaluationForRows_(sheet, startRow, endRow, moduleName, batchKind, title) {
  const ui = SpreadsheetApp.getUi();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    ui.alert("No student rows found.");
    return;
  }

  const safeStart = Math.max(2, startRow);
  const safeEnd = Math.min(endRow, lastRow);
  if (safeStart > safeEnd) {
    ui.alert("No valid rows in the selected range.");
    return;
  }

  const batch = createBatchContext_(batchKind || moduleName || "batch");
  const confirm = ui.alert(
    title || "Batch Evaluate",
    `Queue cloud evaluation for rows ${safeStart} to ${safeEnd}?\nModule: ${moduleName}\nBatch ID: ${batch.id}`,
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  let queued = 0;
  let skipped = 0;
  let failed = 0;
  const details = [];

  for (let row = safeStart; row <= safeEnd; row++) {
    if (!hasInputForModule_(sheet, row, moduleName)) {
      skipped += 1;
      continue;
    }

    sheet.getRange(row, COL_STATUS).setValue(queueStatusText_(moduleName));
    setEvaluationMetadata_(sheet, row);

    const result = triggerCloudEvaluation_(moduleName, row, {
      silent: true,
      batchId: batch.id,
      batchLabel: batch.label
    });

    if (result.ok) {
      queued += 1;
      details.push(`Row ${row}: queued${result.jobId ? ` (${result.jobId})` : ""}`);
    } else {
      failed += 1;
      details.push(`Row ${row}: failed (${result.error || "unknown error"})`);
      sheet.getRange(row, COL_STATUS).setValue("Queue Failed");
    }
  }

  ui.alert(
    `${title || "Batch"} Queue Complete`,
    `Batch ID: ${batch.id}\nQueued: ${queued}\nSkipped: ${skipped}\nFailed: ${failed}\n\nFailure logs (if any): batch_logs/${batch.id}/failed_scoring.jsonl\n\n${details.join("\n")}`,
    ui.ButtonSet.OK
  );
}


/* =========================
   HELPERS
   ========================= */
function getActiveRow_(sheet) {
  const ui = SpreadsheetApp.getUi();
  const range = sheet.getActiveRange();
  if (!range) {
    ui.alert("Please select a student row.");
    return null;
  }
  const row = range.getRow();
  if (row === 1) {
    ui.alert("Header row cannot be evaluated.");
    return null;
  }
  return row;
}

function confirmOverwrite_(sheet, row, cols) {
  const ui = SpreadsheetApp.getUi();
  const hasExisting = cols.some((col) => sheet.getRange(row, col).getValue() !== "");
  if (!hasExisting) return true;

  const response = ui.alert(
    "Results already exist for this student.\nOverwrite?",
    ui.ButtonSet.YES_NO
  );
  return response === ui.Button.YES;
}

function extractDriveFileId_(url) {
  const match = url.toString().match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function hasAnyInput_(sheet, row) {
  const c = sheet.getRange(row, COL_SELF_INTRO_LINK).getValue();
  const d = sheet.getRange(row, COL_LISTEN_SPEAK_LINK).getValue();
  const e = sheet.getRange(row, COL_LISTEN_WRITE_TEXT).getValue();
  const f = sheet.getRange(row, COL_EMAIL_TEXT).getValue();

  return (
    (c && c.toString().trim() !== "") ||
    (d && d.toString().trim() !== "") ||
    (e && e.toString().trim() !== "") ||
    (f && f.toString().trim() !== "")
  );
}

function hasInputForModule_(sheet, row, moduleName) {
  if (moduleName === "all") return hasAnyInput_(sheet, row);

  const selfIntro = sheet.getRange(row, COL_SELF_INTRO_LINK).getValue();
  const listenSpeak = sheet.getRange(row, COL_LISTEN_SPEAK_LINK).getValue();
  const listenWrite = sheet.getRange(row, COL_LISTEN_WRITE_TEXT).getValue();
  const emailWrite = sheet.getRange(row, COL_EMAIL_TEXT).getValue();

  if (moduleName === "self_intro") return !!(selfIntro && selfIntro.toString().trim() !== "");
  if (moduleName === "listening_speaking") return !!(listenSpeak && listenSpeak.toString().trim() !== "");
  if (moduleName === "listening_writing") return !!(listenWrite && listenWrite.toString().trim() !== "");
  if (moduleName === "email_writing") return !!(emailWrite && emailWrite.toString().trim() !== "");
  return false;
}

function queueStatusText_(moduleName) {
  if (moduleName === "self_intro") return "Queued: Self-Intro (Cloud)";
  if (moduleName === "listening_speaking") return "Queued: Listening & Speaking (Cloud)";
  if (moduleName === "listening_writing") return "Queued: Listening & Writing (Cloud)";
  if (moduleName === "email_writing") return "Queued: Email Writing (Cloud)";
  return "Queued: Full Evaluation (Cloud)";
}

function setEvaluationMetadata_(sheet, row) {
  sheet.getRange(row, COL_EVALUATOR_VERSION).setValue(EVALUATOR_VERSION);
  sheet.getRange(row, COL_EVALUATION_TIMESTAMP).setValue(new Date());
}

function createBatchContext_(kind) {
  const now = new Date();
  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  const normalizedKind = (kind || "batch").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
  const id = `${normalizedKind}_${stamp}_${randomPart}`;
  return {
    id: id,
    label: `${normalizedKind} ${stamp}`
  };
}

function getCloudConfig_() {
  const props = PropertiesService.getScriptProperties();
  const apiBaseUrl = (props.getProperty("EVALUATION_API_URL") || "").trim();
  const apiToken = (props.getProperty("EVALUATION_API_TOKEN") || "").trim();
  return { apiBaseUrl, apiToken };
}

function setupCloudApiConfig() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const current = getCloudConfig_();

  const urlPrompt = ui.prompt(
    "Set Cloud API URL",
    `Enter Cloud API base URL (example: https://xxxx.trycloudflare.com)\nCurrent: ${current.apiBaseUrl || "(not set)"}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;

  const url = (urlPrompt.getResponseText() || "").trim().replace(/\/$/, "");

  if (!url) {
    ui.alert("URL cannot be empty.");
    return;
  }

  props.setProperty("EVALUATION_API_URL", url);

  ui.alert("Cloud API URL saved in Script Properties. Token is managed in your local shell profile.");
}

function triggerCloudEvaluation_(moduleName, row, options) {
  const opts = options || {};
  const silent = !!opts.silent;
  const batchId = opts.batchId || "";
  const batchLabel = opts.batchLabel || "";
  const ui = SpreadsheetApp.getUi();
  const { apiBaseUrl, apiToken } = getCloudConfig_();

  if (!apiBaseUrl) {
    if (!silent) {
      ui.alert(
        "Cloud API URL missing. Set Script Property EVALUATION_API_URL to your deployed backend URL."
      );
    }
    return { ok: false, error: "Cloud API URL missing" };
  }

  const sheetId = SpreadsheetApp.getActive().getId();
  const url = apiBaseUrl.replace(/\/$/, "") + "/evaluate";

  const payload = {
    sheet_id: sheetId,
    row: row,
    module: moduleName,
    async: true
  };

  if (batchId) payload.batch_id = batchId;
  if (batchLabel) payload.batch_label = batchLabel;

  const headers = { "Content-Type": "application/json" };
  if (apiToken) {
    headers["x-api-key"] = apiToken;
  }

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const text = response.getContentText();
    const body = text ? JSON.parse(text) : {};

    if (statusCode >= 200 && statusCode < 300 && body.ok) {
      if (!silent) {
        const message =
          `Cloud evaluation queued.\n\n` +
          `Module: ${moduleName}\n` +
          `Row: ${row}\n` +
          `Job ID: ${body.job_id || "n/a"}\n\n` +
          `Track progress in Status column (G).`;
        ui.alert(message);
      }
      return { ok: true, jobId: body.job_id || "" };
    } else {
      if (!silent) {
        ui.alert(`Cloud evaluation failed (${statusCode}).\n${text}`);
      }
      return { ok: false, error: `HTTP ${statusCode}: ${text}` };
    }
  } catch (e) {
    if (!silent) {
      ui.alert(`Error calling cloud API: ${e}`);
    }
    return { ok: false, error: String(e) };
  }
}
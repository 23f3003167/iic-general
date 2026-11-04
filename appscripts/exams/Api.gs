function doPost(e) {
  try {
    var payload = parsePayload_(e);
    validateApiToken_(payload);

    var action = String(payload.action || '').trim();
    if (!action) {
      throw new Error('Missing action');
    }

    var data;

    if (action === 'listExams') {
      var email = normalizeEmail_(payload.email);
      data = { exams: listExams_(email) };
    } else if (action === 'getActiveExam') {
      var email = normalizeEmail_(payload.email);
      data = { exam: getActiveExam_(email) };
    } else if (action === 'upsertExam') {
      data = { exam: upsertExam_(payload) };
    } else if (action === 'getLastSubmission') {
      data = getLastSubmission_(payload);
    } else if (action === 'getPreviousSubmissions') {
      data = getPreviousSubmissions_(payload);
    } else if (action === 'startAttempt') {
      data = startAttempt_(payload);
    } else if (action === 'submitAttempt') {
      data = submitAttempt_(payload);
    } else {
      throw new Error('Unsupported action: ' + action);
    }

    return jsonResponse_(true, data, 'OK');
  } catch (error) {
    return jsonResponse_(false, null, '', error && error.message ? error.message : String(error));
  }
}

function listExams_(email) {
  var sheet = getExamsSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headerMap = getHeaderMap_(sheet);
  var normalizedEmail = email ? normalizeEmail_(email) : '';
  var eligibleEmailsByExam = normalizedEmail ? getEligibleEmailsByExam_(values.slice(1)) : {};
  var exams = [];
  for (var i = 1; i < values.length; i++) {
    var exam = rowToExam_(values[i], eligibleEmailsByExam, headerMap, i + 1);
    if (!exam) continue;
    
    // Filter by eligibility if email is provided
    if (normalizedEmail && exam.eligibleEmails.indexOf(normalizedEmail) < 0) {
      continue;
    }
    
    // Students only need assessments that are upcoming or currently open.
    if (normalizedEmail && exam.status !== 'UPCOMING' && exam.status !== 'OPEN') {
      continue;
    }
    
    exams.push(examForStudent_(exam));
  }

  exams.sort(function (a, b) {
    return String(b.startAt || '').localeCompare(String(a.startAt || ''));
  });

  return exams;
}

function examForStudent_(exam) {
  var safeExam = JSON.parse(JSON.stringify(exam));
  (safeExam.questions || []).forEach(function(question) {
    delete question.answerIndex;
    delete question.explanation;
  });
  return safeExam;
}

function getActiveExam_(email) {
  var exams = listExams_(email);

  for (var i = 0; i < exams.length; i++) {
    var exam = exams[i];
    if (exam.status !== 'OPEN') {
      continue;
    }

    return exam;
  }

  return null;
}

function upsertExam_(payload) {
  var operation = String(payload.operation || 'CREATE').trim().toUpperCase();
  var examId = String(payload.examId || '').trim();
  var originalExamId = String(payload.originalExamId || examId).trim();
  var assessmentType = String(payload.assessmentType || 'STANDARD').trim().toUpperCase();
  var title = String(payload.title || '').trim();
  var description = String(payload.description || '').trim();
  var startAt = String(payload.startAt || '').trim();
  var endAt = String(payload.endAt || '').trim();
  var durationMinutes = Number(payload.durationMinutes || 0);
  var eligibleEmails = normalizeAuthorizationEmails_(payload.eligibleEmails);
  var questions = assessmentType === 'CSM' ? getCsmQuestions_() : getQuestionsForTestId_(examId);

  if (!examId || !startAt || !endAt || ((assessmentType !== 'CSM' && assessmentType !== 'PREPLACEMENT') && !durationMinutes)) {
    throw new Error('Missing exam configuration');
  }

  if ((assessmentType !== 'CSM' && assessmentType !== 'PREPLACEMENT') && questions.length === 0) {
    throw new Error('No questions found in Questions sheet for testID: ' + examId);
  }

  if (eligibleEmails.length === 0) {
    throw new Error('At least one eligible email is required');
  }

  if (assessmentType === 'CSM') {
    // Allow admin-provided title/description for CSM; fall back to defaults only if empty
    if (!title) {
      title = 'Communication Skills Assessment';
    }
    if (!description) {
      description = 'A non-MCQ communication skills assessment. Students provide video and written responses directly in the response sheet.';
    }
    durationMinutes = 0;
  } else if (assessmentType === 'PREPLACEMENT') {
    durationMinutes = 0;
  }

  var sheet = getExamsSheet_();
  var headerMap = getHeaderMap_(sheet);
  var rowIndex = -1;
  var existingExam = null;
  if (operation === 'UPDATE') {
    rowIndex = Number(payload.sheetRow);
    if (!Number.isInteger(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
      throw new Error('Invalid assessment row. Refresh the assessment list and try again.');
    }
    var existingValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (normalizeText_(getHeaderValue_(existingValues, headerMap, 'exam_id', 0)) !== normalizeText_(originalExamId)) {
      throw new Error('Assessment row changed. Refresh the assessment list and try again.');
    }
    existingExam = rowToExam_(existingValues, null, headerMap, rowIndex);
  } else if (operation !== 'CREATE') {
    throw new Error('Unsupported assessment operation: ' + operation);
  }

  var now = new Date().toISOString();
  var examRow = {
    examId: examId,
    title: title,
    description: description,
    startAt: startAt,
    endAt: endAt,
    durationMinutes: durationMinutes,
    questionsJson: JSON.stringify(questions),
    eligibleCount: eligibleEmails.length,
    createdAt: existingExam ? existingExam.createdAt : now,
    updatedAt: now,
    assessmentType: assessmentType
  };

  writeEligibleStudents_(examId, title, eligibleEmails, operation === 'CREATE');

  var examValues = {
    exam_id: examRow.examId,
    title: examRow.title,
    description: examRow.description,
    start_at: examRow.startAt,
    end_at: examRow.endAt,
    duration_minutes: examRow.durationMinutes,
    questions_json: examRow.questionsJson,
    eligible_count: examRow.eligibleCount,
    created_at: examRow.createdAt,
    updated_at: examRow.updatedAt,
    assessment_type: examRow.assessmentType
  };

  if (operation === 'UPDATE') {
    writeValuesByHeaders_(sheet, rowIndex, examValues);
  } else {
    sheet.appendRow(rowValuesForHeaders_(sheet, examValues));
    rowIndex = sheet.getLastRow();
  }

  var rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  return examForStudent_(rowToExam_(rowValues, null, getHeaderMap_(sheet), rowIndex));
}

function startAttempt_(payload) {
  var examId = String(payload.examId || '').trim();
  var email = normalizeEmail_(payload.email);
  var attemptId = String(payload.attemptId || '').trim();

  if (!examId || !email) {
    throw new Error('examId and email are required');
  }

  // Generate attemptId if not provided (for backward compatibility)
  if (!attemptId) {
    attemptId = Utilities.getUuid();
  }

  var exam = getExamById_(examId, payload.sheetRow);
  if (!exam) {
    throw new Error('Exam not found: ' + examId);
  }

  var now = new Date();
  var start = new Date(exam.startAt);
  var end = new Date(exam.endAt);
  if (exam.status !== 'OPEN' || now < start || now > end) {
    throw new Error('Exam is not currently open');
  }

  if (exam.eligibleEmails.indexOf(email) < 0) {
    throw new Error('This email is not eligible for the assessment');
  }

  var previousSubmissionAt = findLastSubmittedAttemptAt_(getAttemptedSheet_(), exam.examId, email, exam.sheetRow);
  var eligible = true;
  var startedAt = now.toISOString();

  // Return attempt data without writing to sheet - will be written on submit
  return {
    attempt: {
      attemptId: attemptId,
      examId: exam.examId,
      email: email,
      tabSwitchCount: 0,
      score: 0,
      startAt: startedAt,
      endAt: '',
      submittedAt: '',
      eligible: eligible,
      previousSubmissionAt: previousSubmissionAt
    },
    exam: examForStudent_(exam)
  };
}

function submitAttempt_(payload) {
  var attemptId = String(payload.attemptId || '').trim();
  var examId = String(payload.examId || '').trim();
  var email = normalizeEmail_(payload.email);
  var name = String(payload.name || '').trim();
  var responses = Array.isArray(payload.responses) ? payload.responses : [];
  var score = Number(payload.score || 0);
  var tabSwitchCount = Number(payload.tabSwitchCount || 0);
  var startAt = String(payload.startAt || '').trim();
  var endAt = String(payload.endAt || '').trim();

  if (!attemptId || !examId || !email) {
    throw new Error('attemptId, examId, and email are required');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getAttemptedSheet_();
    
    // First try to find by attemptId (for resubmit of same attempt)
    var rowIndex = findAttemptRow_(sheet, attemptId);
    
    var submittedAt = new Date().toISOString();
    var exam = getExamById_(examId, payload.sheetRow);
    var eligible = !!exam && exam.eligibleEmails.indexOf(email) >= 0;
    if (!eligible) {
      throw new Error('This email is not eligible for the assessment');
    }
    
    // If updating an existing row, keep the maximum score
    var finalScore = score;
    if (rowIndex > 0) {
      var existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
      var existingScore = Number(getHeaderValue_(existingRow, getHeaderMap_(sheet), 'score', 6) || 0);
      if (existingScore > score) {
        finalScore = existingScore;
      }
    }

    var attempt = {
      attemptId: attemptId,
      examId: examId,
      examTitle: exam ? exam.title : '',
      email: email,
      eligible: eligible,
      tabSwitchCount: tabSwitchCount,
      score: finalScore,
      startAt: startAt,
      endAt: endAt,
      submittedAt: submittedAt,
      durationMinutes: exam ? exam.durationMinutes : '',
      lastUpdatedAt: submittedAt,
      sheetRow: exam ? exam.sheetRow : payload.sheetRow
    };

    // Update existing row or append new one
    if (rowIndex > 0) {
      writeAttempt_(sheet, rowIndex, attempt);
    } else {
      sheet.appendRow(rowValuesForHeaders_(sheet, attemptValues_(attempt)));
    }

    if (exam && isCsmExam_(exam)) {
      writeCsmResponse_(email, name, responses);
    }

    return {
      attempt: {
        attemptId: attemptId,
        examId: examId,
        email: email,
        tabSwitchCount: tabSwitchCount,
        score: finalScore,
        startAt: startAt,
        endAt: endAt,
        submittedAt: submittedAt,
        eligible: eligible
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function getPreviousSubmissions_(payload) {
  var examId = String(payload.examId || '').trim();
  var email = normalizeEmail_(payload.email);
  if (!examId || !email) {
    throw new Error('examId and email are required');
  }

  var sheet = getAttemptedSheet_();
  return {
    submissions: findSubmittedAttemptTimestamps_(sheet, examId, email, payload.sheetRow)
  };
}

function getExamById_(examId, sheetRow) {
  var sheet = getExamsSheet_();
  var headerMap = getHeaderMap_(sheet);
  var hasSheetRow = sheetRow !== undefined && sheetRow !== null && String(sheetRow).trim() !== '';
  if (hasSheetRow) {
    var rowIndex = Number(sheetRow);
    if (!Number.isInteger(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
      throw new Error('Assessment row changed. Refresh the assessment list and try again.');
    }
    var values = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (normalizeText_(getHeaderValue_(values, headerMap, 'exam_id', 0)) !== normalizeText_(examId)) {
      throw new Error('Assessment row changed. Refresh the assessment list and try again.');
    }
    return rowToExam_(values, null, headerMap, rowIndex);
  }
  return findExamRow_(sheet, examId).exam || null;
}
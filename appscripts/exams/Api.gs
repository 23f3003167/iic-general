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
      data = { exams: listExams_() };
    } else if (action === 'getActiveExam') {
      data = { exam: getActiveExam_() };
    } else if (action === 'upsertExam') {
      data = { exam: upsertExam_(payload) };
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

function listExams_() {
  var sheet = getExamsSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var exams = [];
  for (var i = 1; i < values.length; i++) {
    var exam = rowToExam_(values[i]);
    if (!exam) continue;
    exams.push(exam);
  }

  exams.sort(function (a, b) {
    return String(b.startAt || '').localeCompare(String(a.startAt || ''));
  });

  return exams;
}

function getActiveExam_() {
  var exams = listExams_();

  for (var i = 0; i < exams.length; i++) {
    var exam = exams[i];
    if (String(exam.status || '').toUpperCase() !== 'OPEN') {
      continue;
    }

    return exam;
  }

  return null;
}

function upsertExam_(payload) {
  var examId = String(payload.examId || '').trim();
  var assessmentType = String(payload.assessmentType || 'STANDARD').trim().toUpperCase();
  var title = String(payload.title || '').trim();
  var description = String(payload.description || '').trim();
  var status = String(payload.status || 'DRAFT').trim().toUpperCase();
  var startAt = String(payload.startAt || '').trim();
  var endAt = String(payload.endAt || '').trim();
  var durationMinutes = Number(payload.durationMinutes || 0);
  var eligibleEmails = normalizeAuthorizationEmails_(payload.eligibleEmails);
  var forceCreate = payload.forceCreate === true || payload.forceCreate === 'true';
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
  var existing = findExamRow_(sheet, examId);
  var rowIndex = existing.rowIndex;
  if (forceCreate) {
    // Force creating a fresh exam row even if examId exists
    rowIndex = -1;
    existing = { rowIndex: -1, exam: null };
  }
  var now = new Date().toISOString();
  var examRow = {
    examId: examId,
    title: title,
    description: description,
    status: status,
    startAt: startAt,
    endAt: endAt,
    durationMinutes: durationMinutes,
    questionsJson: JSON.stringify(questions),
    eligibleColumn: existing.exam ? existing.exam.eligibleColumn : '',
    eligibleCount: eligibleEmails.length,
    createdAt: existing.exam ? existing.exam.createdAt : now,
    updatedAt: now,
    assessmentType: assessmentType
  };

  if (!examRow.eligibleColumn) {
    examRow.eligibleColumn = writeEligibleStudents_(examId, title, eligibleEmails, existing.exam ? existing.exam.eligibleColumn : '');
  } else {
    writeEligibleStudents_(examId, title, eligibleEmails, examRow.eligibleColumn);
  }

  var rowValues = [
    examRow.examId,
    examRow.title,
    examRow.description,
    examRow.status,
    examRow.startAt,
    examRow.endAt,
    examRow.durationMinutes,
    examRow.questionsJson,
    examRow.eligibleColumn,
    examRow.eligibleCount,
    examRow.createdAt,
    examRow.updatedAt,
    examRow.assessmentType
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return rowToExam_(rowValues);
}

function startAttempt_(payload) {
  var examId = String(payload.examId || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();

  if (!examId || !email) {
    throw new Error('examId and email are required');
  }

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var exam = getExamById_(examId);
    if (!exam) {
      throw new Error('Exam not found: ' + examId);
    }

    var now = new Date();
    var start = new Date(exam.startAt);
    var end = new Date(exam.endAt);
    if (String(exam.status || '').toUpperCase() !== 'OPEN' || now < start || now > end) {
      throw new Error('Exam is not currently open');
    }

    var attemptId = Utilities.getUuid();
    var eligible = exam.eligibleEmails.indexOf(email) >= 0;
    var startedAt = now.toISOString();
    var rowValues = [
      attemptId,
      exam.examId,
      exam.title,
      email,
      eligible ? 'YES' : 'NO',
      0,
      0,
      startedAt,
      '',
      '',
      exam.durationMinutes,
      String(exam.status || ''),
      new Date().toISOString()
    ];

    getAttemptedSheet_().appendRow(rowValues);

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
        eligible: eligible
      },
      exam: exam
    };
  } finally {
    lock.releaseLock();
  }
}

function submitAttempt_(payload) {
  var attemptId = String(payload.attemptId || '').trim();
  var examId = String(payload.examId || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();
  var name = String(payload.name || '').trim();
  var responses = Array.isArray(payload.responses) ? payload.responses : [];
  var score = Number(payload.score || 0);
  var tabSwitchCount = Number(payload.tabSwitchCount || 0);
  var startAt = String(payload.startAt || '').trim();
  var endAt = String(payload.endAt || '').trim();

  if (!attemptId || !examId || !email) {
    throw new Error('attemptId, examId, and email are required');
  }

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var sheet = getAttemptedSheet_();
    var rowIndex = findAttemptRow_(sheet, attemptId);
    var submittedAt = new Date().toISOString();
    var exam = getExamById_(examId);
    var eligible = exam ? exam.eligibleEmails.indexOf(email) >= 0 : false;

    var rowValues = [
      attemptId,
      examId,
      exam ? exam.title : '',
      email,
      eligible ? 'YES' : 'NO',
      tabSwitchCount,
      score,
      startAt,
      endAt,
      submittedAt,
      exam ? exam.durationMinutes : '',
      exam ? exam.status : '',
      submittedAt
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    if (exam && String(exam.assessmentType || '').toUpperCase() === 'CSM') {
      writeCsmResponse_(email, name, responses);
    }

    return {
      attempt: {
        attemptId: attemptId,
        examId: examId,
        email: email,
        tabSwitchCount: tabSwitchCount,
        score: score,
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

function getExamById_(examId) {
  var sheet = getExamsSheet_();
  var row = findExamRow_(sheet, examId).exam;
  return row || null;
}
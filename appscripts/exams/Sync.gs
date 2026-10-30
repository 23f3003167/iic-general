var EXAM_SUBMISSIONS_COLLECTION = 'examSubmissions';
var EXAM_SUBMISSION_SYNC_BATCH_SIZE = 10;

function syncPendingExamSubmissions() {
  var documents = listPendingExamSubmissions_();
  var synced = 0;
  var failed = 0;

  documents.forEach(function(document) {
    try {
      syncExamSubmission_(document);
      synced++;
    } catch (error) {
      failed++;
      console.error('Exam submission sync failed for ' + document.name + ': ' + error.message);
    }
  });

  console.log('Exam submission sync complete. Synced: ' + synced + ', failed: ' + failed);
}

function setupExamSubmissionSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncPendingExamSubmissions') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncPendingExamSubmissions')
    .timeBased()
    .everyMinutes(1)
    .create();
}

function listPendingExamSubmissions_() {
  var projectId = getFirestoreProjectId_();
  var url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) +
    '/databases/(default)/documents:runQuery';
  var result = firestoreRequest_(url, 'post', {
    structuredQuery: {
      from: [{ collectionId: EXAM_SUBMISSIONS_COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'pending' }
        }
      },
      limit: EXAM_SUBMISSION_SYNC_BATCH_SIZE
    }
  });

  return result
    .map(function(item) { return item.document; })
    .filter(function(document) { return !!document; });
}

function syncExamSubmission_(document) {
  var fields = document.fields || {};
  var responses = firestoreArray_(fields.responses);
  var examId = firestoreString_(fields.examId);
  var email = normalizeEmail_(firestoreString_(fields.email));
  var attemptId = firestoreString_(fields.attemptId);
  var exam = getExamById_(examId, firestoreNumber_(fields.sheetRow));

  if (!attemptId || !email || !exam) {
    throw new Error('Submission is missing a valid attempt, student, or exam.');
  }

  var score = calculateExamSubmissionScore_(exam, responses);
  submitAttempt_({
    attemptId: attemptId,
    examId: examId,
    sheetRow: exam.sheetRow,
    email: email,
    name: firestoreString_(fields.name),
    responses: responses,
    score: score,
    tabSwitchCount: firestoreNumber_(fields.tabSwitchCount),
    startAt: firestoreString_(fields.startAt),
    endAt: firestoreString_(fields.endAt)
  });

  deleteFirestoreSubmission_(document.name);
}

function calculateExamSubmissionScore_(exam, responses) {
  if (exam.assessmentType === 'CSM') {
    return 0;
  }

  return (exam.questions || []).reduce(function(total, question, index) {
    if (Number(responses[index]) !== Number(question.answerIndex)) {
      return total;
    }
    return total + (Number(question.weight) || 1);
  }, 0);
}

function deleteFirestoreSubmission_(documentName) {
  var url = 'https://firestore.googleapis.com/v1/' + documentName;
  firestoreRequest_(url, 'delete', undefined, true);
}

function firestoreRequest_(url, method, payload, allowNotFound) {
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };
  if (payload !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();
  if (allowNotFound && status === 404) return null;
  if (status < 200 || status >= 300) {
    throw new Error('Firestore REST request failed (' + status + '): ' + response.getContentText().slice(0, 300));
  }

  var body = response.getContentText();
  return body ? JSON.parse(body) : null;
}

function getFirestoreProjectId_() {
  var projectId = String(PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID') || '').trim();
  if (!projectId) {
    throw new Error('Set FIREBASE_PROJECT_ID in Apps Script project properties.');
  }
  return projectId;
}

function firestoreString_(field) {
  if (!field) return '';
  if (field.stringValue !== undefined) return String(field.stringValue);
  if (field.integerValue !== undefined) return String(field.integerValue);
  return '';
}

function firestoreNumber_(field) {
  if (!field) return undefined;
  var value = field.integerValue !== undefined ? field.integerValue : field.doubleValue;
  var number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function firestoreArray_(field) {
  if (!field || !field.arrayValue || !Array.isArray(field.arrayValue.values)) return [];
  return field.arrayValue.values.map(function(value) {
    return firestoreString_(value);
  });
}
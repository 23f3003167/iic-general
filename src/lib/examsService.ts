import type { ExamAttempt, ExamConfig, ExamStatus } from '@/types';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

type GetExamsResponse = {
  exams: ExamConfig[];
};

type GetActiveExamResponse = {
  exam: ExamConfig | null;
};

type UpsertExamRequest = {
  operation: 'CREATE' | 'UPDATE';
  sheetRow?: number;
  examId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  assessmentType?: string;
  eligibleEmails: string[];
};

type StartAttemptRequest = {
  examId: string;
  sheetRow?: number;
  email: string;
};

type SubmitAttemptRequest = {
  attemptId: string;
  examId: string;
  sheetRow?: number;
  email: string;
  name?: string;
  responses?: string[];
  score: number;
  tabSwitchCount: number;
  startAt: string;
  endAt: string;
};

export type QueueExamSubmissionRequest = {
  attemptId: string;
  examId: string;
  sheetRow?: number;
  name?: string;
  responses: string[];
  tabSwitchCount: number;
  startAt: string;
  endAt: string;
};

type StartAttemptResponse = {
  attempt: ExamAttempt;
  exam: ExamConfig;
};

type SubmitAttemptResponse = {
  attempt: ExamAttempt;
};

type GetLastSubmissionResponse = {
  lastSubmissionAt: string;
};

type GetPreviousSubmissionsResponse = {
  submissions: string[];
};

const examsWebAppUrl = import.meta.env.VITE_EXAMS_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const examsApiToken = import.meta.env.VITE_EXAMS_APPS_SCRIPT_API_TOKEN as string | undefined;

function normalizeWebAppUrl(url: string): string {
  return url.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
}

async function parseJsonResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Invalid response from Apps Script: ${text.slice(0, 200)}`);
  }
}

async function callExamsAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  if (!examsWebAppUrl) {
    throw new Error('Missing exams Apps Script URL in environment.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(normalizeWebAppUrl(examsWebAppUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        ...payload,
        apiToken: examsApiToken,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Exams service timed out after 30 seconds. Check the Apps Script deployment and spreadsheet access.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Apps Script request failed (${response.status})`);
  }

  const result = await parseJsonResponse<T>(response);
  if (!result.success) {
    throw new Error(result.error || result.message || 'Apps Script request failed.');
  }

  if (result.data === undefined) {
    throw new Error('Apps Script response is missing data.');
  }

  return result.data;
}

export async function getExams(email?: string): Promise<ExamConfig[]> {
  console.log('[getExams] Fetching exams with email:', email);
  const payload: Record<string, unknown> = { action: 'listExams' };
  if (email) {
    payload.email = email.toLowerCase().trim();
  }
  const data = await callExamsAppsScript<GetExamsResponse>(payload);
  console.log('[getExams] Received exams:', data.exams?.length, 'exams');
  console.log('[getExams] Exam details:', data.exams?.map((e: any) => ({
    examId: e.examId,
    title: e.title,
    status: e.status,
    eligibleCount: e.eligibleCount,
    eligibleEmailsSample: e.eligibleEmails?.slice(0, 3)
  })));
  return data.exams || [];
}

export async function getActiveExam(email?: string): Promise<ExamConfig | null> {
  console.log('[getActiveExam] Fetching active exam with email:', email);
  const payload: Record<string, unknown> = { action: 'getActiveExam' };
  if (email) {
    payload.email = email.toLowerCase().trim();
  }
  const data = await callExamsAppsScript<GetActiveExamResponse>(payload);
  console.log('[getActiveExam] Active exam:', (data.exam as any) ? {
    examId: data.exam.examId,
    title: data.exam.title,
    status: data.exam.status,
    eligibleCount: (data.exam as any).eligibleCount
  } : 'null');
  return data.exam || null;
}

export async function upsertExam(exam: UpsertExamRequest): Promise<ExamConfig> {
  const data = await callExamsAppsScript<{ exam: ExamConfig }>({
    action: 'upsertExam',
    operation: exam.operation,
    sheetRow: exam.sheetRow,
    examId: exam.examId,
    title: exam.title,
    description: exam.description,
    startAt: exam.startAt,
    endAt: exam.endAt,
    durationMinutes: exam.durationMinutes,
    assessmentType: exam.assessmentType,
    eligibleEmails: exam.eligibleEmails,
  });

  return data.exam;
}

function generateAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Generate a UUID-like ID locally to avoid lock contention
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function startExamAttempt(request: StartAttemptRequest): Promise<StartAttemptResponse> {
  // Generate attemptId locally to avoid concurrent lock issues
  const attemptId = generateAttemptId();
  const response = await callExamsAppsScript<StartAttemptResponse>({
    action: 'startAttempt',
    ...request,
    attemptId, // Pass locally-generated attemptId
  });
  
  // Ensure the returned attempt uses our generated ID
  return {
    ...response,
    attempt: {
      ...response.attempt,
      attemptId: attemptId,
    },
  };
}

export async function getLastSubmission(examId: string, email: string, sheetRow?: number): Promise<string> {
  const data = await callExamsAppsScript<GetLastSubmissionResponse>({
    action: 'getLastSubmission',
    examId,
    sheetRow,
    email,
  });
  return data.lastSubmissionAt || '';
}

export async function getPreviousSubmissions(examId: string, email: string, sheetRow?: number): Promise<string[]> {
  const data = await callExamsAppsScript<GetPreviousSubmissionsResponse>({
    action: 'getPreviousSubmissions',
    examId,
    sheetRow,
    email,
  });
  return Array.isArray(data.submissions) ? data.submissions : [];
}

export async function submitExamAttempt(request: SubmitAttemptRequest): Promise<SubmitAttemptResponse> {
  return callExamsAppsScript<SubmitAttemptResponse>({
    action: 'submitAttempt',
    ...request,
  });
}

export async function queueExamSubmission(request: QueueExamSubmissionRequest): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email || !user.emailVerified) {
    throw new Error('Sign in with a verified student account before submitting.');
  }

  await setDoc(doc(db, 'examSubmissions', request.attemptId), {
    attemptId: request.attemptId,
    examId: request.examId,
    ...(request.sheetRow === undefined ? {} : { sheetRow: request.sheetRow }),
    email: user.email,
    name: request.name || '',
    responses: request.responses,
    tabSwitchCount: request.tabSwitchCount,
    startAt: request.startAt,
    endAt: request.endAt,
    status: 'pending',
    submittedAt: serverTimestamp(),
  });
}
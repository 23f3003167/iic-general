import type { ExamAttempt, ExamConfig, ExamStatus } from '@/types';

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
  examId: string;
  title: string;
  description?: string;
  status: ExamStatus;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  assessmentType?: string;
  eligibleEmails: string[];
  forceCreate?: boolean;
};

type StartAttemptRequest = {
  examId: string;
  email: string;
};

type SubmitAttemptRequest = {
  attemptId: string;
  examId: string;
  email: string;
  name?: string;
  responses?: string[];
  score: number;
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

  const response = await fetch(normalizeWebAppUrl(examsWebAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken: examsApiToken,
    }),
  });

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

export async function getExams(): Promise<ExamConfig[]> {
  const data = await callExamsAppsScript<GetExamsResponse>({ action: 'listExams' });
  return data.exams || [];
}

export async function getActiveExam(): Promise<ExamConfig | null> {
  const data = await callExamsAppsScript<GetActiveExamResponse>({ action: 'getActiveExam' });
  return data.exam || null;
}

export async function upsertExam(exam: UpsertExamRequest): Promise<ExamConfig> {
  const data = await callExamsAppsScript<{ exam: ExamConfig }>({
    action: 'upsertExam',
    ...exam,
  });

  return data.exam;
}

export async function startExamAttempt(request: StartAttemptRequest): Promise<StartAttemptResponse> {
  return callExamsAppsScript<StartAttemptResponse>({
    action: 'startAttempt',
    ...request,
  });
}

export async function submitExamAttempt(request: SubmitAttemptRequest): Promise<SubmitAttemptResponse> {
  return callExamsAppsScript<SubmitAttemptResponse>({
    action: 'submitAttempt',
    ...request,
  });
}
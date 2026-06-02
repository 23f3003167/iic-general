type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

type ReleaseBehaviouralSlotsRequest = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  instructorNumber: string;
  syncToForm?: boolean;
  resetFormResponses?: boolean;
  studentAuthorizationEmails?: string;
  studentAuthorizationColumn?: string;
};

type ReleaseOneOnOneSlotsRequest = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  instructorNumber: string;
  domain: string;
  syncToForm?: boolean;
};

type ReleasePresentationSlotsRequest = {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  instructorNumber: string;
  syncToForm?: boolean;
  resetFormResponses?: boolean;
  studentAuthorizationEmails?: string;
  studentAuthorizationColumn?: string;
};

export type ReleaseBehaviouralSlotsResponse = {
  slotsCreated: number;
  syncToForm: boolean;
  resetFormResponses?: boolean;
  authorizationColumn?: string;
  validStudents?: number;
  invalidStudents?: number;
  addedStudents?: number;
};

export type ReleasePresentationSlotsResponse = ReleaseBehaviouralSlotsResponse & {
};

export type InstructorOption = {
  number: string;
  name: string;
};

export type PublishScoreActivity = {
  key: string;
  label: string;
  startCol: number;
  width: number;
};

export type PublishScoresResponse = {
  activity: string;
  rowsWritten: number;
  startCol: number;
  width: number;
};

export type StudentScoreLookup = {
  sheetName: string;
  level: string;
  headers: string[];
  row: string[];
  matched: {
    email: string;
    domain: string;
    plan: string;
  };
};

export type StudentFeedbackLookup = {
  sheetName: string;
  category: string;
  headers: string[];
  row: string[];
  email: string;
};

export type StudentActivityPointsLookup = {
  sheetName: string;
  headers: string[];
  row: string[];
  matched: {
    email: string;
    domain: string;
    plan: string;
  };
};

export type StudentSubmission = {
  date: string;
  activity: string;
  proof: string;
};

export type StudentSubmissionsLookup = {
  sheetName: string;
  email: string;
  count: number;
  submissions: StudentSubmission[];
};

const behavioralWebAppUrl = import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const behavioralApiToken = import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_API_TOKEN as string | undefined;
const presentationWebAppUrl = import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const presentationApiToken = import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_API_TOKEN as string | undefined;
const aiEvaluationAppsScriptUrl = import.meta.env.VITE_AI_EVALUATION_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const aiEvaluationAppsScriptToken = import.meta.env.VITE_AI_EVALUATION_APPS_SCRIPT_API_TOKEN as string | undefined;
const oneOnOneWebAppUrl = import.meta.env.VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const oneOnOneApiToken = import.meta.env.VITE_ONE_ON_ONE_APPS_SCRIPT_API_TOKEN as string | undefined;
const scoresWebAppUrl = import.meta.env.VITE_SCORES_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const scoresApiToken = import.meta.env.VITE_SCORES_APPS_SCRIPT_API_TOKEN as string | undefined;

export type AiEvaluationModule =
  | 'all'
  | 'self_intro'
  | 'listening_speaking'
  | 'listening_writing'
  | 'email_writing';

export type AiMenuOption = {
  key: string;
  label: string;
  requiresRow?: boolean;
  requiresRange?: boolean;
  module?: AiEvaluationModule;
};

type RunAiMenuActionRequest = {
  sheetId: string;
  optionKey: string;
  row?: number;
  rowStart?: number;
  rowEnd?: number;
};

export type RunAiMenuActionResponse = {
  queued: number;
  skipped: number;
  failed: number;
  batchId?: string;
  message?: string;
  details?: string[];
  updatedConfig?: boolean;
};

type GetAiMenuOptionsResponse = {
  options: AiMenuOption[];
};

export type AiStudent = {
  sheetRow: number;
  name: string;
  email: string;
  status: string;
  selfIntroLink: string;
  listeningSpeakingLink: string;
  listeningWritingText: string;
  emailWritingText: string;
};

type GetAiStudentsResponse = {
  students: AiStudent[];
};

function normalizeWebAppUrl(url: string): string {
  return url.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
}

async function callOneOnOneAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  if (!oneOnOneWebAppUrl) {
    throw new Error('Missing 1on1 Apps Script URL in environment.');
  }

  const response = await fetch(normalizeWebAppUrl(oneOnOneWebAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken: oneOnOneApiToken,
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

async function callScoresAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  if (!scoresWebAppUrl) {
    throw new Error('Missing scores Apps Script URL in environment.');
  }

  const response = await fetch(normalizeWebAppUrl(scoresWebAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken: scoresApiToken,
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

async function parseJsonResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Invalid response from Apps Script: ${text.slice(0, 200)}`);
  }
}

async function callBehavioralAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  if (!behavioralWebAppUrl) {
    throw new Error('Missing behavioural Apps Script URL in environment.');
  }

  const response = await fetch(normalizeWebAppUrl(behavioralWebAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken: behavioralApiToken,
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

async function callPresentationAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  if (!presentationWebAppUrl) {
    throw new Error('Missing presentation Apps Script URL in environment.');
  }

  const response = await fetch(normalizeWebAppUrl(presentationWebAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken: presentationApiToken,
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

export async function releaseBehaviouralSlots(
  args: ReleaseBehaviouralSlotsRequest,
): Promise<ReleaseBehaviouralSlotsResponse> {
  const payload = {
    ...args,
  };

  try {
    return await callBehavioralAppsScript<ReleaseBehaviouralSlotsResponse>({
      action: 'releaseBehaviouralSlots',
      ...payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/unknown action|unsupported action/i.test(message)) {
      throw error;
    }

    // Compatibility fallback for projects that use American spelling.
    return callBehavioralAppsScript<ReleaseBehaviouralSlotsResponse>({
      action: 'releaseBehavioralSlots',
      ...payload,
    });
  }
}

export async function releasePresentationSlots(
  args: ReleasePresentationSlotsRequest,
): Promise<ReleasePresentationSlotsResponse> {
  return callPresentationAppsScript<ReleasePresentationSlotsResponse>({
    action: 'releasePresentationSlots',
    ...args,
  });
}

export async function getBehavioralInstructors(): Promise<InstructorOption[]> {
  return callBehavioralAppsScript<InstructorOption[]>({
    action: 'getInstructors',
  });
}

export async function getPresentationInstructors(): Promise<InstructorOption[]> {
  return callPresentationAppsScript<InstructorOption[]>({
    action: 'getInstructors',
  });
}

export async function getOneOnOneInstructors(): Promise<InstructorOption[]> {
  return callOneOnOneAppsScript<InstructorOption[]>({
    action: 'getInstructors',
  });
}

export async function releaseOneOnOneSlots(
  args: ReleaseOneOnOneSlotsRequest,
): Promise<ReleaseBehaviouralSlotsResponse> {
  return callOneOnOneAppsScript<ReleaseBehaviouralSlotsResponse>({
    action: 'releaseOneOnOneSlots',
    ...args,
  });
}

async function callAiEvaluationAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  if (!aiEvaluationAppsScriptUrl) {
    throw new Error('Missing AI evaluation Apps Script URL in environment.');
  }

  const response = await fetch(normalizeWebAppUrl(aiEvaluationAppsScriptUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken: aiEvaluationAppsScriptToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apps Script request failed (${response.status}).`);
  }

  const body = await parseJsonResponse<T>(response);
  if (!body.success || body.data === undefined) {
    throw new Error(body.error || body.message || 'AI Apps Script request failed.');
  }

  return body.data;
}

export async function getAiMenuOptions(): Promise<AiMenuOption[]> {
  const data = await callAiEvaluationAppsScript<GetAiMenuOptionsResponse>({
    action: 'getMenuOptions',
  });
  return data.options || [];
}

export async function getAiStudents(sheetId: string): Promise<AiStudent[]> {
  const data = await callAiEvaluationAppsScript<GetAiStudentsResponse>({
    action: 'getStudents',
    sheetId,
  });
  return data.students || [];
}

export async function runAiMenuAction(
  request: RunAiMenuActionRequest,
): Promise<RunAiMenuActionResponse> {
  return callAiEvaluationAppsScript<RunAiMenuActionResponse>({
    action: 'runMenuAction',
    ...request,
  });
}

export async function getPublishScoreActivities(): Promise<PublishScoreActivity[]> {
  return callScoresAppsScript<PublishScoreActivity[]>({
    action: 'getPublishScoreActivities',
  });
}

export async function publishScoresToSheet(request: {
  activityKey: string;
  rowsText: string;
}): Promise<PublishScoresResponse> {
  return callScoresAppsScript<PublishScoresResponse>({
    action: 'publishScores',
    ...request,
  });
}

export async function lookupStudentScore(request: {
  level: string;
  email: string;
  domain: string;
  plan: string;
}): Promise<StudentScoreLookup> {
  return callScoresAppsScript<StudentScoreLookup>({
    action: 'lookupStudentScore',
    ...request,
  });
}

export async function lookupStudentFeedback(request: {
  category: string;
  email: string;
}): Promise<StudentFeedbackLookup> {
  return callScoresAppsScript<StudentFeedbackLookup>({
    action: 'lookupStudentFeedback',
    ...request,
  });
}

export async function lookupStudentActivityPoints(request: {
  email: string;
  domain: string;
  plan: string;
}): Promise<StudentActivityPointsLookup> {
  return callScoresAppsScript<StudentActivityPointsLookup>({
    action: 'lookupStudentActivityPoints',
    ...request,
  });
}

export async function lookupStudentSubmissions(): Promise<StudentSubmissionsLookup> {
  return callScoresAppsScript<StudentSubmissionsLookup>({
    action: 'lookupStudentSubmissions',
  });
}
// Domain/Plan options are handled statically in the frontend now.

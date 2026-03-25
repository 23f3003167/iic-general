import { BehavioralEvaluation, EvaluationSection, PresentationEvaluation } from '@/types';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

type BehavioralSubmitEvaluationArgs = {
  id: string;
  relevance: number;
  clarity: number;
  analyticalSkills: number;
  grammar: number;
  feedback: string;
};

type PresentationSubmitEvaluationArgs = {
  id: string;
  content: number;
  slideComposition: number;
  presentation: number;
  feedback: string;
};

type SubmitEvaluationArgs = BehavioralSubmitEvaluationArgs | PresentationSubmitEvaluationArgs;

type EvaluatorsConfig = {
  webAppUrl?: string;
  apiToken?: string;
};

const evaluatorsConfig: Record<EvaluationSection, EvaluatorsConfig> = {
  behavioral: {
    webAppUrl: import.meta.env.VITE_EVALUATORS_APPS_SCRIPT_WEB_APP_URL || import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL,
    apiToken: import.meta.env.VITE_EVALUATORS_APPS_SCRIPT_API_TOKEN || import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_API_TOKEN,
  },
  presentation: {
    webAppUrl: import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL,
    apiToken: import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_API_TOKEN,
  },
};

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

async function callEvaluatorsAppsScript<T>(
  section: EvaluationSection,
  payload: Record<string, unknown>,
): Promise<T> {
  const config = evaluatorsConfig[section];

  if (!config.webAppUrl) {
    const envVar = section === 'presentation' ? 'VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL' : 'VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL';
    throw new Error(
      `Evaluators Apps Script URL not configured for ${section}. Set ${envVar}.`,
    );
  }

  const response = await fetch(normalizeWebAppUrl(config.webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      ...(config.apiToken ? { apiToken: config.apiToken } : {}),
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

export async function getPendingEvaluations(
  section: 'behavioral',
  instructorName: string,
): Promise<BehavioralEvaluation[]>;
export async function getPendingEvaluations(
  section: 'presentation',
  instructorName: string,
): Promise<PresentationEvaluation[]>;
export async function getPendingEvaluations(
  section: EvaluationSection,
  instructorName: string,
): Promise<Array<BehavioralEvaluation | PresentationEvaluation>> {
  return callEvaluatorsAppsScript<Array<BehavioralEvaluation | PresentationEvaluation>>(section, {
    action: 'getPendingEvaluations',
    instructorName,
  });
}

export async function submitEvaluation(section: EvaluationSection, args: SubmitEvaluationArgs): Promise<void> {
  await callEvaluatorsAppsScript<{ updated: boolean }>(section, {
    action: 'submitEvaluation',
    ...args,
  });
}

export async function getUniqueInstructors(section: EvaluationSection): Promise<string[]> {
  return callEvaluatorsAppsScript<string[]>(section, {
    action: 'getUniqueInstructors',
  });
}

import {
  BehavioralEvaluation,
  EvaluationSection,
  OneOnOneEvaluation,
  PresentationEvaluation,
} from '@/types';

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
  rating: 'Excellent' | 'Good' | 'Average' | 'Poor';
};

type PresentationSubmitEvaluationArgs = {
  id: string;
  content: number;
  slideComposition: number;
  presentation: number;
  feedback: string;
  rating: 'Excellent' | 'Good' | 'Average' | 'Poor';
};

type OneOnOneSubmitEvaluationArgs = {
  id: string;
  technicalProgramming: number;
  technicalDataScience: number;
  communication: number;
  readiness: string;
  rating: 'Excellent' | 'Good' | 'Average' | 'Poor';
  tasks: string;
  roles: string;
  detailedFeedback1: string;
};

type SubmitEvaluationArgs =
  | BehavioralSubmitEvaluationArgs
  | PresentationSubmitEvaluationArgs
  | OneOnOneSubmitEvaluationArgs;

type EvaluatorsConfig = {
  webAppUrl?: string;
  apiToken?: string;
};

type PresentationEvaluatorData = {
  fetchedAt: number;
  instructors: string[];
  evaluations: PresentationEvaluation[];
};

const presentationEvaluatorCacheKey = 'iic.presentation-evaluator-data.v1';
const presentationEvaluatorCacheTtlMs = 5 * 60 * 1000;
let presentationEvaluatorRequest: Promise<PresentationEvaluatorData> | null = null;
let presentationEvaluatorCacheGeneration = 0;

const evaluatorsConfig: Record<EvaluationSection, EvaluatorsConfig> = {
  behavioral: {
    webAppUrl: import.meta.env.VITE_EVALUATORS_APPS_SCRIPT_WEB_APP_URL || import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL,
    apiToken: import.meta.env.VITE_EVALUATORS_APPS_SCRIPT_API_TOKEN || import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_API_TOKEN,
  },
  presentation: {
    webAppUrl: import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL,
    apiToken: import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_API_TOKEN,
  },
  oneOnOne: {
    webAppUrl: import.meta.env.VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL,
    apiToken: import.meta.env.VITE_ONE_ON_ONE_APPS_SCRIPT_API_TOKEN,
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
    const envVar =
      section === 'presentation'
        ? 'VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL'
        : section === 'oneOnOne'
          ? 'VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL'
          : 'VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL';
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
    throw new Error(
      `Evaluator Apps Script request failed (${response.status}). ` +
      `Redeploy the evaluator API as a Web app and update VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL if the deployment URL changed.`,
    );
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

function readPresentationEvaluatorCache(): PresentationEvaluatorData | null {
  try {
    const cached = sessionStorage.getItem(presentationEvaluatorCacheKey);
    if (!cached) return null;

    const data = JSON.parse(cached) as PresentationEvaluatorData;
    if (
      !Number.isFinite(data.fetchedAt) ||
      !Array.isArray(data.instructors) ||
      !Array.isArray(data.evaluations) ||
      Date.now() - data.fetchedAt > presentationEvaluatorCacheTtlMs
    ) {
      sessionStorage.removeItem(presentationEvaluatorCacheKey);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function clearPresentationEvaluatorCache(): void {
  presentationEvaluatorCacheGeneration += 1;
  try {
    sessionStorage.removeItem(presentationEvaluatorCacheKey);
  } catch {
    // Session storage may be unavailable in restricted browser contexts.
  }
}

async function getPresentationEvaluatorData(refresh = false): Promise<PresentationEvaluatorData> {
  if (!refresh) {
    const cached = readPresentationEvaluatorCache();
    if (cached) return cached;
    if (presentationEvaluatorRequest) return presentationEvaluatorRequest;
  }

  const cacheGeneration = presentationEvaluatorCacheGeneration;
  const request = callEvaluatorsAppsScript<{
    instructors: string[];
    evaluations: PresentationEvaluation[];
  }>('presentation', { action: 'getEvaluatorDashboardData' }).then((data) => {
    const cachedData = { ...data, fetchedAt: Date.now() };
    if (cacheGeneration === presentationEvaluatorCacheGeneration) {
      try {
        sessionStorage.setItem(presentationEvaluatorCacheKey, JSON.stringify(cachedData));
      } catch {
        // Continue with in-memory data if session storage is unavailable.
      }
    }
    return cachedData;
  });
  const trackedRequest = request.finally(() => {
    if (presentationEvaluatorRequest === trackedRequest) {
      presentationEvaluatorRequest = null;
    }
  });
  presentationEvaluatorRequest = trackedRequest;
  return trackedRequest;
}

export function prefetchPresentationEvaluatorData(): Promise<void> {
  return getPresentationEvaluatorData().then(() => undefined);
}

export function clearEvaluatorSessionData(): void {
  clearPresentationEvaluatorCache();
}

export async function getPendingEvaluations(
  section: 'behavioral',
  instructorName: string,
): Promise<BehavioralEvaluation[]>;
export async function getPendingEvaluations(
  section: 'presentation',
  instructorName: string,
  options?: { refresh?: boolean },
): Promise<PresentationEvaluation[]>;
export async function getPendingEvaluations(
  section: 'oneOnOne',
  instructorName: string,
): Promise<OneOnOneEvaluation[]>;
export async function getPendingEvaluations(
  section: EvaluationSection,
  instructorName: string,
  options?: { refresh?: boolean },
): Promise<Array<BehavioralEvaluation | PresentationEvaluation | OneOnOneEvaluation>>;
export async function getPendingEvaluations(
  section: EvaluationSection,
  instructorName: string,
  options: { refresh?: boolean } = {},
): Promise<Array<BehavioralEvaluation | PresentationEvaluation | OneOnOneEvaluation>> {
  if (section === 'presentation') {
    const data = await getPresentationEvaluatorData(options.refresh);
    return data.evaluations.filter((evaluation) => evaluation.instructor === instructorName);
  }

  return callEvaluatorsAppsScript<Array<BehavioralEvaluation | PresentationEvaluation | OneOnOneEvaluation>>(section, {
    action: 'getPendingEvaluations',
    instructorName,
  });
}

export async function submitEvaluation(section: EvaluationSection, args: SubmitEvaluationArgs): Promise<void> {
  await callEvaluatorsAppsScript<{ updated: boolean }>(section, {
    action: 'submitEvaluation',
    ...args,
  });
  if (section === 'presentation') clearPresentationEvaluatorCache();
}

export async function getUniqueInstructors(section: EvaluationSection): Promise<string[]> {
  if (section === 'presentation') {
    return (await getPresentationEvaluatorData()).instructors;
  }

  return callEvaluatorsAppsScript<string[]>(section, {
    action: 'getUniqueInstructors',
  });
}

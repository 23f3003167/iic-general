import { SummaryStats } from '@/lib/slotsService';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

const webAppUrl = import.meta.env.VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL;
const apiToken = import.meta.env.VITE_ONE_ON_ONE_APPS_SCRIPT_API_TOKEN;

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

export async function fetchOneOnOneSummaryStats(): Promise<SummaryStats[]> {
  if (!webAppUrl) {
    throw new Error(
      '1on1 Apps Script URL not configured. Set VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'getOneOnOneStats',
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `1on1 Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<SummaryStats[]>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data || [];
}

export async function checkStudentSlot(email: string, assessmentType: string): Promise<any> {
  if (!webAppUrl) {
    throw new Error(
      '1on1 Apps Script URL not configured. Set VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'checkOneOnOneSlot',
      email: email,
      assessmentType: assessmentType,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `1on1 Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<any>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export type OneOnOneBookableSlot = {
  slot: string;
  seatRemaining: number;
  evaluatorEmail: string;
};

export type OneOnOneBookableSlotsResponse = {
  email: string;
  domain: string;
  plan: string;
  verified: boolean;
  alreadyBooked?: boolean;
  booking?: OneOnOneBookSlotResponse;
  slots: OneOnOneBookableSlot[];
};

export type OneOnOneBookSlotRequest = {
  bookingId: string;
  name: string;
  email: string;
  contact: string;
  slot: string;
  domain: string;
  plan: string;
  resumeDriveLink?: string;
  progressCardDriveLink?: string;
};

export type OneOnOneBookSlotResponse = {
  success: boolean;
  alreadyProcessed: boolean;
  timestamp: string;
  name: string;
  email: string;
  contact: string;
  slot: string;
  status: string;
  bookingId: string;
  domain: string;
  plan: string;
};

export async function getOneOnOneBookableSlots(email: string, domain: string, plan: string): Promise<OneOnOneBookableSlotsResponse> {
  if (!webAppUrl) {
    throw new Error(
      '1on1 Apps Script URL not configured. Set VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'getOneOnOneBookableSlots',
      email,
      domain,
      plan,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `1on1 Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<OneOnOneBookableSlotsResponse>(response);
  if (!result.success || !result.data) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export async function bookOneOnOneSlot(request: OneOnOneBookSlotRequest): Promise<OneOnOneBookSlotResponse> {
  if (!webAppUrl) {
    throw new Error(
      '1on1 Apps Script URL not configured. Set VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'bookOneOnOneSlot',
      ...request,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `1on1 Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<OneOnOneBookSlotResponse>(response);
  if (!result.success || !result.data) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export type OneOnOneSlotsOverview = {
  instructorName: string;
  instructorNumber: string;
  slotsAllocated: number;
  slotsWithFeedback: number;
  absentees: number;
};

export { combineSlotsData } from '@/lib/slotsService';

export async function callOneOnOneAppsScript<T>(payload: Record<string, any>): Promise<T> {
  if (!webAppUrl) {
    throw new Error(
      '1on1 Apps Script URL not configured. Set VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `1on1 Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<T>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data as T;
}

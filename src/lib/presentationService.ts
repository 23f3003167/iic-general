import { SummaryStats } from '@/lib/slotsService';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

const webAppUrl = import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL;
const apiToken = import.meta.env.VITE_PRESENTATION_APPS_SCRIPT_API_TOKEN;

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

/**
 * Fetch presentation summary statistics (slots allocated, absentees) from the Presentation Apps Script.
 */
export async function fetchPresentationSummaryStats(): Promise<SummaryStats[]> {
  if (!webAppUrl) {
    throw new Error(
      'Presentation Apps Script URL not configured. Set VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const requestParams = new URLSearchParams({
    action: 'getPresentationStats',
    ...(apiToken ? { apiToken } : {}),
  });

  const response = await fetch(
    `${normalizeWebAppUrl(webAppUrl)}?${requestParams.toString()}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    throw new Error(
      `Presentation Apps Script request failed: ${response.status} ${response.statusText}`
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
      'Presentation Apps Script URL not configured. Set VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'checkSlot',
      email: email,
      assessmentType: assessmentType,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Presentation Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<any>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export async function bookPresentationSlot(bookingData: {
  bookingId: string;
  name: string;
  email: string;
  contact: string;
  slot: string;
}): Promise<any> {
  if (!webAppUrl) {
    throw new Error(
      'Presentation Apps Script URL not configured. Set VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'bookPresentationSlot',
      ...bookingData,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Presentation Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<any>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export async function getPresentationBookableSlots(email: string): Promise<{ slots: Array<{ slot: string; seatRemaining: number; evaluatorEmail: string }> }> {
  if (!webAppUrl) {
    throw new Error(
      'Presentation Apps Script URL not configured. Set VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'getPresentationBookableSlots',
      email,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Presentation Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<{ slots: Array<{ slot: string; seatRemaining: number; evaluatorEmail: string }> }>(response);

  if (!result.success || !result.data) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export type PresentationSlotsOverview = {
  instructorName: string;
  instructorNumber: string;
  slotsGiven: number;
  slotsAllocated: number;
  slotsWithFeedback: number;
  absentees: number;
  slotsTaken: number;
};

export { combineSlotsData } from '@/lib/slotsService';

export async function callPresentationAppsScript<T>(payload: Record<string, any>): Promise<T> {
  if (!webAppUrl) {
    throw new Error(
      'Presentation Apps Script URL not configured. Set VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL.'
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
      `Presentation Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<T>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data as T;
}

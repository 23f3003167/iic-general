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

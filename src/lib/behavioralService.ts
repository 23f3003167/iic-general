import { combineSlotsData, SummaryStats } from '@/lib/slotsService';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

const webAppUrl = import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL;
const apiToken = import.meta.env.VITE_BEHAVIORAL_APPS_SCRIPT_API_TOKEN;

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

export async function fetchBehavioralSummaryStats(): Promise<SummaryStats[]> {
  if (!webAppUrl) {
    throw new Error(
      'Behavioral Apps Script URL not configured. Set VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL.'
    );
  }

  const response = await fetch(normalizeWebAppUrl(webAppUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'getBehavioralStats',
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Behavioral Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<SummaryStats[]>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data || [];
}

export { combineSlotsData };

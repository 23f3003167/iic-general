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

export async function checkStudentSlot(email: string, assessmentType: string): Promise<any> {
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
      action: 'checkSlot',
      email: email,
      assessmentType: assessmentType,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Behavioral Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<any>(response);

  if (!result.success) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export type BehavioralStudentVerification = {
  verified: boolean;
  email: string;
  alreadyBooked: boolean;
  booking: {
    timestamp: string;
    name: string;
    email: string;
    contact: string;
    slot: string;
    status: string;
  } | null;
};

export type BehavioralBookableSlot = {
  slot: string;
  seatRemaining: number;
  evaluatorEmail: string;
};

export type BehavioralBookableSlotsResponse = {
  email: string;
  verified: boolean;
  slots: BehavioralBookableSlot[];
};

export type BehavioralBookSlotRequest = {
  bookingId: string;
  name: string;
  email: string;
  contact: string;
  slot: string;
};

export type BehavioralBookSlotResponse = {
  success: boolean;
  alreadyProcessed: boolean;
  timestamp: string;
  name: string;
  email: string;
  contact: string;
  slot: string;
  status: string;
  bookingId: string;
};

export async function verifyBehavioralStudent(email: string): Promise<BehavioralStudentVerification> {
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
      action: 'verifyBehavioralStudent',
      email,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Behavioral Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<BehavioralStudentVerification>(response);
  if (!result.success || !result.data) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export async function getBehavioralBookableSlots(email: string): Promise<BehavioralBookableSlotsResponse> {
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
      action: 'getBehavioralBookableSlots',
      email,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Behavioral Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<BehavioralBookableSlotsResponse>(response);
  if (!result.success || !result.data) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export async function bookBehavioralSlot(request: BehavioralBookSlotRequest): Promise<BehavioralBookSlotResponse> {
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
      action: 'bookBehavioralSlot',
      ...request,
      ...(apiToken ? { apiToken } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Behavioral Apps Script request failed: ${response.status} ${response.statusText}`
    );
  }

  const result = await parseJsonResponse<BehavioralBookSlotResponse>(response);
  if (!result.success || !result.data) {
    throw new Error(result.message || result.error || 'Unknown error from Apps Script');
  }

  return result.data;
}

export { combineSlotsData };

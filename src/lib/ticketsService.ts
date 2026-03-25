import type { Ticket, TicketCategory, TicketStatus } from '@/types';

type TicketFilters = {
  category?: TicketCategory | 'ALL';
  status?: TicketStatus | 'ALL';
  query?: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

const webAppUrl = import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const apiToken = import.meta.env.VITE_APPS_SCRIPT_API_TOKEN as string | undefined;

function normalizeWebAppUrl(url: string): string {
  // Convert domain-scoped /a/macros/<domain>/s/... URL to public /macros/s/... format.
  return url.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
}

function assertConfig() {
  if (!webAppUrl) {
    throw new Error('Missing VITE_APPS_SCRIPT_WEB_APP_URL in environment.');
  }
}

async function parseJsonResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Invalid response from Apps Script: ${text.slice(0, 200)}`);
  }
}

async function callAppsScript<T>(payload: Record<string, unknown>): Promise<T> {
  assertConfig();

  const targetUrl = normalizeWebAppUrl(webAppUrl as string);

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      // Use a CORS-safelisted content type to avoid browser preflight for Apps Script.
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      apiToken,
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

export async function getTickets(filters: TicketFilters = {}): Promise<Ticket[]> {
  const data = await callAppsScript<{ tickets: Ticket[] }>({
    action: 'listTickets',
    filters,
  });
  return data.tickets || [];
}

export async function updateTicketDraft(args: {
  ticketId: string;
  mailDraft: string;
  status?: TicketStatus;
  assignedTo?: string;
}): Promise<Ticket> {
  const data = await callAppsScript<{ ticket: Ticket }>({
    action: 'updateTicketDraft',
    ...args,
  });
  return data.ticket;
}

export async function sendTicketMail(args: {
  ticketId: string;
  sentBy: string;
}): Promise<Ticket> {
  const data = await callAppsScript<{ ticket: Ticket }>({
    action: 'sendTicketMail',
    ...args,
  });
  return data.ticket;
}

export async function sendBulkTicketMails(args: {
  ticketIds: string[];
  sentBy: string;
}): Promise<{ successIds: string[]; failed: Array<{ ticketId: string; error: string }> }> {
  return callAppsScript<{ successIds: string[]; failed: Array<{ ticketId: string; error: string }> }>({
    action: 'sendBulkTicketMails',
    ...args,
  });
}

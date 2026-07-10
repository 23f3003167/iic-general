type VerifyEmailResponse = {
  verified: boolean;
  email: string;
  message: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

const scoresWebAppUrl = import.meta.env.VITE_SCORES_APPS_SCRIPT_WEB_APP_URL as string | undefined;
const scoresApiToken = import.meta.env.VITE_SCORES_APPS_SCRIPT_API_TOKEN as string | undefined;

export async function verifyStudentEmail(email: string): Promise<VerifyEmailResponse> {
  if (!scoresWebAppUrl) {
    throw new Error('VITE_SCORES_APPS_SCRIPT_WEB_APP_URL is not configured');
  }

  const payload = {
    action: 'verifyStudentEmail',
    email: email.trim().toLowerCase(),
    apiToken: scoresApiToken,
  };

  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));

  const response = await fetch(scoresWebAppUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result: ApiEnvelope<VerifyEmailResponse> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Email verification failed');
  }

  if (!result.data) {
    throw new Error('No data returned from server');
  }

  return result.data;
}

const VERIFIED_EMAIL_STORAGE_KEY = 'iic_portal_verified_email';

export function getStoredVerifiedEmail(): string | null {
  try {
    return localStorage.getItem(VERIFIED_EMAIL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeVerifiedEmail(email: string): void {
  try {
    localStorage.setItem(VERIFIED_EMAIL_STORAGE_KEY, email.trim().toLowerCase());
  } catch {
    console.warn('Failed to store verified email in localStorage');
  }
}

export function clearVerifiedEmail(): void {
  try {
    localStorage.removeItem(VERIFIED_EMAIL_STORAGE_KEY);
  } catch {
    console.warn('Failed to clear verified email from localStorage');
  }
}

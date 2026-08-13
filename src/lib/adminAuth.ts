import { doc, getDoc } from 'firebase/firestore';
import { signOut, User } from 'firebase/auth';
import { auth, db } from './firebase';

export async function fetchAllowedEmails(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'admins', 'allowed'));
    if (!snap.exists()) {
      console.warn('admins/allowed document does not exist in Firestore');
      return [];
    }
    const data = snap.data();
    const emails = Array.isArray(data?.emails) ? data.emails : [];
    return emails.map((e) => String(e).toLowerCase());
  } catch (error) {
    console.error('Error fetching allowed emails:', error);
    throw error;
  }
}

export async function verifyAdminAccess(user: User | null): Promise<boolean> {
  if (!user?.email) return false;
  try {
    const allowedEmails = await fetchAllowedEmails();
    return allowedEmails.includes(user.email.toLowerCase());
  } catch {
    return false; // Fail closed — don't crash the auth listener
  }
}

export async function signOutUnauthorized(message?: string) {
  await signOut(auth);
  if (message) {
    console.warn(message);
  }
}

export async function fetchEvaluatorEmails(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'admins', 'evaluators'));
    if (!snap.exists()) return [];
    const emails = Array.isArray(snap.data()?.emails) ? snap.data().emails : [];
    return emails.map((email) => String(email).trim().toLowerCase()).filter(Boolean);
  } catch (error) {
    console.error('Error fetching evaluator emails:', error);
    throw error;
  }
}

export type AdminPortalRole = 'admin' | 'evaluator';

export async function getAdminPortalRole(user: User | null): Promise<AdminPortalRole | null> {
  if (!user?.email) return null;

  try {
    const email = user.email.trim().toLowerCase();
    const adminEmails = await fetchAllowedEmails();
    if (adminEmails.includes(email)) return 'admin';

    const evaluatorEmails = await fetchEvaluatorEmails();
    return evaluatorEmails.includes(email) ? 'evaluator' : null;
  } catch {
    return null;
  }
}

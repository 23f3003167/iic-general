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
    console.log('Allowed emails fetched:', emails);
    return emails.map((e) => String(e).toLowerCase());
  } catch (error) {
    console.error('Error fetching allowed emails:', error);
    throw error;
  }
}

export async function verifyAdminAccess(user: User | null): Promise<boolean> {
  if (!user?.email) return false;
  const allowedEmails = await fetchAllowedEmails();
  return allowedEmails.includes(user.email.toLowerCase());
}

export async function signOutUnauthorized(message?: string) {
  await signOut(auth);
  if (message) {
    console.warn(message);
  }
}
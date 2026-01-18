import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { FormEntry, Announcement, FAQ, Document } from '@/types';

// Forms CRUD
export async function getForms(): Promise<FormEntry[]> {
  const q = query(collection(db, 'forms'), orderBy('startDate', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FormEntry));
}

export async function getForm(id: string): Promise<FormEntry | null> {
  const docSnap = await getDoc(doc(db, 'forms', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as FormEntry) : null;
}

export async function createForm(form: Omit<FormEntry, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'forms'), form);
  return docRef.id;
}

export async function updateForm(id: string, form: Partial<Omit<FormEntry, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'forms', id), form);
}

export async function deleteForm(id: string): Promise<void> {
  await deleteDoc(doc(db, 'forms', id));
}

// Announcements CRUD
export async function getAnnouncements(): Promise<Announcement[]> {
  const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Announcement));
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  const docSnap = await getDoc(doc(db, 'announcements', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Announcement) : null;
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'announcements'), announcement);
  return docRef.id;
}

export async function updateAnnouncement(id: string, announcement: Partial<Omit<Announcement, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'announcements', id), announcement);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, 'announcements', id));
}

// FAQs CRUD
export async function getFAQs(): Promise<FAQ[]> {
  const snapshot = await getDocs(collection(db, 'faqs'));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FAQ));
}

export async function getFAQ(id: string): Promise<FAQ | null> {
  const docSnap = await getDoc(doc(db, 'faqs', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as FAQ) : null;
}

export async function createFAQ(faq: Omit<FAQ, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'faqs'), faq);
  return docRef.id;
}

export async function updateFAQ(id: string, faq: Partial<Omit<FAQ, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'faqs', id), faq);
}

export async function deleteFAQ(id: string): Promise<void> {
  await deleteDoc(doc(db, 'faqs', id));
}

// Documents CRUD
export async function getDocuments(): Promise<Document[]> {
  const snapshot = await getDocs(collection(db, 'documents'));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Document));
}

export async function getDocument(id: string): Promise<Document | null> {
  const docSnap = await getDoc(doc(db, 'documents', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Document) : null;
}

export async function createDocument(document: Omit<Document, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'documents'), document);
  return docRef.id;
}

export async function updateDocument(id: string, document: Partial<Omit<Document, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'documents', id), document);
}

export async function deleteDocument(id: string): Promise<void> {
  await deleteDoc(doc(db, 'documents', id));
}

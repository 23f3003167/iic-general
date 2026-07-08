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
  where,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement, Document, FAQ, FormEntry, Opportunity, OpportunityApplication, Recruiter } from '@/types';
import { computeFormsStatus } from './statusCompute';

export type SlotAvailability = {
  id?: string;
  section: 'behavioral' | 'presentation';
  instructorNumber: string;
  instructorName: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  active?: boolean;
  createdBy?: string;
  createdAt?: unknown;
};

export type SlotsAvailabilityWindow = {
  editingEnabled: boolean;
  availableDate: string;
  availableStartTime: string;
  availableEndTime: string;
  updatedBy?: string;
  updatedAt?: unknown;
};

const SLOT_AVAILABILITY_COLLECTION = 'slotsAvailability';
const SLOT_AVAILABILITY_CONFIG_DOC = 'slotsAvailabilityConfig/config';

export async function listSlotsAvailability(section: 'behavioral' | 'presentation'): Promise<SlotAvailability[]> {
  const snapshot = await getDocs(collection(db, SLOT_AVAILABILITY_COLLECTION));
  return snapshot.docs
    .map((snapshotDoc) => ({ id: snapshotDoc.id, ...(snapshotDoc.data() as SlotAvailability) }))
    .filter((item) => item.section === section && item.active !== false)
    .sort((left, right) => {
      const dateCompare = String(left.date || '').localeCompare(String(right.date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(left.startTime || '').localeCompare(String(right.startTime || ''));
    });
}

export async function createSlotAvailability(payload: SlotAvailability): Promise<{ id: string }> {
  const docRef = await addDoc(collection(db, SLOT_AVAILABILITY_COLLECTION), {
    ...payload,
    active: payload.active === undefined ? true : payload.active,
  });
  return { id: docRef.id };
}

export async function deleteSlotAvailability(id: string): Promise<void> {
  await deleteDoc(doc(db, SLOT_AVAILABILITY_COLLECTION, id));
}

export async function getSlotsConfig(): Promise<SlotsAvailabilityWindow> {
  const docRef = doc(db, ...SLOT_AVAILABILITY_CONFIG_DOC.split('/'));
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return {
      editingEnabled: false,
      availableDate: '',
      availableStartTime: '',
      availableEndTime: '',
    };
  }
  const data = snapshot.data() as Partial<SlotsAvailabilityWindow>;
  return {
    editingEnabled: Boolean(data.editingEnabled),
    availableDate: String(data.availableDate || ''),
    availableStartTime: String(data.availableStartTime || ''),
    availableEndTime: String(data.availableEndTime || ''),
    updatedBy: data.updatedBy,
    updatedAt: data.updatedAt,
  };
}

export async function setSlotsConfig(config: SlotsAvailabilityWindow): Promise<void> {
  const docRef = doc(db, ...SLOT_AVAILABILITY_CONFIG_DOC.split('/'));
  await setDoc(docRef, {
    editingEnabled: config.editingEnabled,
    availableDate: config.availableDate,
    availableStartTime: config.availableStartTime,
    availableEndTime: config.availableEndTime,
    updatedBy: config.updatedBy || '',
    updatedAt: config.updatedAt || new Date(),
  }, { merge: true });
}

const BOOKING_WINDOWS_COLLECTION = 'bookingWindows';

export type BookingWindow = {
  id?: string;
  type: 'behavioral' | 'presentation';
  availableDate: string;
  availableStartTime: string;
  availableEndTime: string;
  createdBy?: string;
  createdAt?: unknown;
};

export async function getBookingWindowsFromFirestore(): Promise<BookingWindow[]> {
  const snapshot = await getDocs(collection(db, BOOKING_WINDOWS_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as BookingWindow) }));
}

export async function createBookingWindowIfNotExists(window: BookingWindow): Promise<{ id?: string; existed: boolean }> {
  const q = query(
    collection(db, BOOKING_WINDOWS_COLLECTION),
    where('type', '==', window.type),
    where('availableDate', '==', window.availableDate),
    where('availableStartTime', '==', window.availableStartTime),
    where('availableEndTime', '==', window.availableEndTime),
  );
  const snapshot = await getDocs(q);
  if (snapshot.size > 0) {
    return { existed: true };
  }
  const docRef = await addDoc(collection(db, BOOKING_WINDOWS_COLLECTION), {
    type: window.type,
    availableDate: window.availableDate,
    availableStartTime: window.availableStartTime,
    availableEndTime: window.availableEndTime,
    createdBy: window.createdBy || '',
    createdAt: window.createdAt || new Date(),
  });
  return { id: docRef.id, existed: false };
}

// Forms CRUD
export async function getForms(): Promise<FormEntry[]> {
  const q = query(collection(db, 'forms'), orderBy('startDate', 'desc'));
  const snapshot = await getDocs(q);
  const forms = snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as FormEntry));
  return computeFormsStatus(forms).map((form) => ({ ...form, id: form.id } as FormEntry));
}

export async function getForm(id: string): Promise<FormEntry | null> {
  const docSnap = await getDoc(doc(db, 'forms', id));
  if (!docSnap.exists()) return null;
  const form = { id: docSnap.id, ...docSnap.data() } as FormEntry;
  const computedForm = computeFormsStatus([form])[0];
  return { ...computedForm, id: form.id } as FormEntry;
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
  return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as Announcement));
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
  return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as FAQ));
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
  return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as Document));
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

// Recruiters CRUD
export async function getRecruiters(): Promise<Recruiter[]> {
  const snapshot = await getDocs(query(collection(db, 'recruiters'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Recruiter) }));
}

export async function getRecruiter(id: string): Promise<Recruiter | null> {
  const docSnap = await getDoc(doc(db, 'recruiters', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Recruiter) : null;
}

export async function createRecruiter(recruiter: Omit<Recruiter, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'recruiters'), recruiter);
  return docRef.id;
}

export async function updateRecruiter(id: string, recruiter: Partial<Omit<Recruiter, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'recruiters', id), recruiter);
}

// Opportunities CRUD
export async function getOpportunities(): Promise<Opportunity[]> {
  const snapshot = await getDocs(query(collection(db, 'opportunities'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Opportunity) }));
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const docSnap = await getDoc(doc(db, 'opportunities', id));
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Opportunity) : null;
}

export async function createOpportunity(opportunity: Omit<Opportunity, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'opportunities'), opportunity);
  return docRef.id;
}

export async function updateOpportunity(id: string, opportunity: Partial<Omit<Opportunity, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'opportunities', id), opportunity);
}

export async function getApplications(): Promise<OpportunityApplication[]> {
  const snapshot = await getDocs(query(collection(db, 'applications'), orderBy('appliedAt', 'desc')));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as OpportunityApplication) }));
}

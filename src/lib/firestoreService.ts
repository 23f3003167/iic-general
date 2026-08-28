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
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement, ExamSyllabus, FAQ, FormEntry, ImportantLink, Opportunity, OpportunityApplication, Recruiter, TrainingLecture } from '@/types';
import { computeFormsStatus } from './statusCompute';

export type SlotAvailability = {
  id?: string;
  section: 'behavioral' | 'presentation' | 'oneOnOne';
  instructorNumber: string;
  instructorName: string;
  date: string;
  startDate?: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  active?: boolean;
  createdBy?: string;
  createdAt?: unknown;
  domain?: string;
};

export type SlotsAvailabilityWindow = {
  editingEnabled: boolean;
  availableDate: string; // legacy single-day value
  availableStartDate?: string;
  availableEndDate?: string;
  availableStartTime: string;
  availableEndTime: string;
  updatedBy?: string;
  updatedAt?: unknown;
};

const SLOT_AVAILABILITY_COLLECTION = 'slotsAvailability';
const SLOT_AVAILABILITY_CONFIG_DOC = 'slotsAvailabilityConfig/config';

export async function listSlotsAvailability(section: 'behavioral' | 'presentation' | 'oneOnOne'): Promise<SlotAvailability[]> {
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

export async function createSlotAvailabilityBulk(payloads: SlotAvailability[]): Promise<void> {
  // Firestore permits a maximum of 500 writes per batch. Keep a small margin
  // so this remains safe if metadata is added to each write in the future.
  const batchSize = 450;
  for (let start = 0; start < payloads.length; start += batchSize) {
    const batch = writeBatch(db);
    payloads.slice(start, start + batchSize).forEach((payload) => {
      batch.set(doc(collection(db, SLOT_AVAILABILITY_COLLECTION)), {
        ...payload,
        active: payload.active === undefined ? true : payload.active,
      });
    });
    await batch.commit();
  }
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
    availableStartDate: String(data.availableStartDate || data.availableDate || ''),
    availableEndDate: String(data.availableEndDate || data.availableDate || ''),
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
    availableStartDate: config.availableStartDate || config.availableDate,
    availableEndDate: config.availableEndDate || config.availableDate,
    availableStartTime: config.availableStartTime,
    availableEndTime: config.availableEndTime,
    updatedBy: config.updatedBy || '',
    updatedAt: config.updatedAt || new Date(),
  }, { merge: true });
}

const BOOKING_WINDOWS_COLLECTION = 'bookingWindows';

export type BookingWindow = {
  id?: string;
  type: 'behavioral' | 'presentation' | 'oneOnOne';
  availableDate: string;
  availableStartTime: string;
  availableEndTime: string;
  createdBy?: string;
  createdAt?: unknown;
};

export async function getBookingWindowsFromFirestore(): Promise<BookingWindow[]> {
  const snapshot = await getDocs(query(collection(db, BOOKING_WINDOWS_COLLECTION), orderBy('createdAt', 'desc')));
  const allWindows = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as BookingWindow) }));
  
  // Return only the latest booking window for each type
  const latestByType = new Map<string, BookingWindow>();
  for (const window of allWindows) {
    if (!latestByType.has(window.type)) {
      latestByType.set(window.type, window);
    }
  }
  
  return Array.from(latestByType.values());
}

export async function createBookingWindowIfNotExists(window: BookingWindow): Promise<{ id?: string; existed: boolean }> {
  console.log('createBookingWindowIfNotExists called with:', window);
  console.log('Firestore db initialized:', db);
  console.log('Collection name:', BOOKING_WINDOWS_COLLECTION);
  
  try {
    const q = query(
      collection(db, BOOKING_WINDOWS_COLLECTION),
      where('type', '==', window.type),
      where('availableDate', '==', window.availableDate),
      where('availableStartTime', '==', window.availableStartTime),
      where('availableEndTime', '==', window.availableEndTime),
    );
    console.log('Query created:', q);
    const snapshot = await getDocs(q);
    console.log('Query snapshot size:', snapshot.size);
    
    if (snapshot.size > 0) {
      console.log('Booking window already exists, returning');
      return { existed: true };
    }
    
    console.log('Creating new document...');
    const docRef = await addDoc(collection(db, BOOKING_WINDOWS_COLLECTION), {
      type: window.type,
      availableDate: window.availableDate,
      availableStartTime: window.availableStartTime,
      availableEndTime: window.availableEndTime,
      createdBy: window.createdBy || '',
      createdAt: window.createdAt || new Date(),
    });
    console.log('Document created with ID:', docRef.id);
    return { id: docRef.id, existed: false };
  } catch (error) {
    console.error('Error in createBookingWindowIfNotExists:', error);
    throw error;
  }
}

export async function isBookingWindowOpen(type: 'behavioral' | 'presentation' | 'oneOnOne'): Promise<{ open: boolean; window?: BookingWindow }> {
  try {
    console.log('Checking booking window for type:', type);
    const q = query(
      collection(db, BOOKING_WINDOWS_COLLECTION),
      where('type', '==', type),
    );
    const snapshot = await getDocs(q);
    
    console.log('Firestore query snapshot size:', snapshot.size);
    
    if (snapshot.size === 0) {
      console.log('No booking windows found in Firestore for type:', type);
      return { open: false };
    }

    // Sort by createdAt descending to get the latest window
    const sortedDocs = snapshot.docs.sort((a, b) => {
      const aData = a.data();
      const bData = b.data();
      let aTime = 0;
      let bTime = 0;
      
      if (aData.createdAt) {
        // Handle Firestore Timestamp
        if (typeof aData.createdAt.toMillis === 'function') {
          aTime = aData.createdAt.toMillis();
        } else {
          aTime = new Date(aData.createdAt as any).getTime();
        }
      }
      
      if (bData.createdAt) {
        // Handle Firestore Timestamp
        if (typeof bData.createdAt.toMillis === 'function') {
          bTime = bData.createdAt.toMillis();
        } else {
          bTime = new Date(bData.createdAt as any).getTime();
        }
      }
      
      console.log('Sorting comparison:', { aTime, bTime, result: bTime - aTime });
      return bTime - aTime;
    });
    
    console.log('Sorted docs count:', sortedDocs.length);
    sortedDocs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`Doc ${index}:`, {
        availableDate: data.availableDate,
        createdAt: data.createdAt,
        createdAtMillis: data.createdAt && typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : new Date(data.createdAt as any).getTime()
      });
    });
    
    // Only check the latest booking window
    const latestDoc = sortedDocs[0];
    const window = latestDoc.data() as BookingWindow;
    console.log('Checking latest booking window:', window);
    
    const [day, month, year] = window.availableDate.split('/').map(Number);
    const [startHour, startMin] = window.availableStartTime.split(':').map(Number);
    const [endHour, endMin] = window.availableEndTime.split(':').map(Number);
    
    console.log('Parsed date:', { day, month, year });
    console.log('Parsed time:', { startHour, startMin, endHour, endMin });
    
    const now = new Date();
    const windowStart = new Date(year, month - 1, day, startHour, startMin, 0, 0);
    const windowEnd = new Date(year, month - 1, day, endHour, endMin, 59, 999);
    
    console.log('Window start:', windowStart);
    console.log('Window end:', windowEnd);
    console.log('Now:', now);
    console.log('Is now >= windowStart?', now >= windowStart);
    console.log('Is now <= windowEnd?', now <= windowEnd);
    
    if (now >= windowStart && now <= windowEnd) {
      console.log('Booking window is OPEN');
      return { open: true, window: { id: latestDoc.id, ...window } };
    }
    
    console.log('No booking window is currently open');
    return { open: false };
  } catch (error) {
    console.error('Error checking booking window:', error);
    return { open: false };
  }
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

// Resources CRUD
export async function getTrainingLectures(): Promise<TrainingLecture[]> {
  const snapshot = await getDocs(collection(db, 'trainingLectures'));
  return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as TrainingLecture));
}

export async function createTrainingLecture(lecture: Omit<TrainingLecture, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'trainingLectures'), lecture);
  return docRef.id;
}

export async function updateTrainingLecture(id: string, lecture: Partial<Omit<TrainingLecture, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'trainingLectures', id), lecture);
}

export async function deleteTrainingLecture(id: string): Promise<void> {
  await deleteDoc(doc(db, 'trainingLectures', id));
}

export async function getImportantLinks(): Promise<ImportantLink[]> {
  const snapshot = await getDocs(collection(db, 'importantLinks'));
  return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as ImportantLink));
}

export async function createImportantLink(link: Omit<ImportantLink, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'importantLinks'), link);
  return docRef.id;
}

export async function updateImportantLink(id: string, link: Partial<Omit<ImportantLink, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'importantLinks', id), link);
}

export async function deleteImportantLink(id: string): Promise<void> {
  await deleteDoc(doc(db, 'importantLinks', id));
}

export async function getExamSyllabi(): Promise<ExamSyllabus[]> {
  const snapshot = await getDocs(collection(db, 'examSyllabi'));
  return snapshot.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as ExamSyllabus));
}

export async function createExamSyllabus(syllabus: Omit<ExamSyllabus, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'examSyllabi'), syllabus);
  return docRef.id;
}

export async function updateExamSyllabus(id: string, syllabus: Partial<Omit<ExamSyllabus, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'examSyllabi', id), syllabus);
}

export async function deleteExamSyllabus(id: string): Promise<void> {
  await deleteDoc(doc(db, 'examSyllabi', id));
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

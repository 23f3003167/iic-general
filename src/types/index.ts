// Type definitions for IIC Portal

export type FormCategory = 'Marks' | 'Training' | 'Slot' | 'Other';
export type FormStatus = 'Open' | 'Upcoming' | 'Closed';

export interface FormEntry {
  id: string;
  title: string;
  category: FormCategory;
  description: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  status: FormStatus;
  formUrl: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  important: boolean;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  url: string;
  type: 'PDF' | 'Drive' | 'External';
}

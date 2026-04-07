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

export type TicketCategory = string;

export type TicketStatus = 'NEW' | 'DRAFTED' | 'SENT' | 'ERROR';

export interface Ticket {
  ticketId: string;
  timestamp: string;
  studentEmail: string;
  studentName: string;
  category: TicketCategory;
  issueRelated?: string;
  level1?: string;
  level2?: string;
  level3?: string;
  domainPlan?: string;
  issueText: string;
  fileUrl?: string;
  mailDraft: string;
  status: TicketStatus;
  assignedTo?: string;
  sentBy?: string;
  sentAt?: string;
  lastUpdatedAt?: string;
  lastError?: string;
}

export type EvaluationStatus = 'Pending' | 'Completed';

export type EvaluationSection = 'behavioral' | 'presentation' | 'oneOnOne';

export interface BaseEvaluation {
  id: string;
  instructor: string;
  slot: string;
  name: string;
  email: string;
  status: EvaluationStatus;
  feedback?: string;
  total?: number;
}

export interface BehavioralEvaluation extends BaseEvaluation {
  relevance?: number;
  clarity?: number;
  analyticalSkills?: number;
  grammar?: number;
  outOf20?: number;
}

export interface PresentationEvaluation extends BaseEvaluation {
  content?: number;
  slideComposition?: number;
  presentation?: number;
  outOf30?: number;
}

export interface OneOnOneEvaluation extends BaseEvaluation {
  studentDate?: string;
  slotTime?: string;
  cgpa?: string;
  domain?: string;
  plan?: string;
  resumeUrl?: string;
  progressCard?: string;
  placementReadiness?: string;
  skillsets?: string;
  technicalProgramming?: number | string;
  technicalDataScience?: number | string;
  communication?: number | string;
  readiness?: string;
  exceptional?: string;
  tasks?: string;
  roles?: string;
  detailedFeedback1?: string;
  detailedFeedback2?: string;
  additionalRemarks?: string;
}

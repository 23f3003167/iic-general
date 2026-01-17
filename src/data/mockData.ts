// Mock data for the IIC portal - structured for easy Firebase migration later

export type FormCategory = 'Marks' | 'Training' | 'Slot' | 'Other';
export type FormStatus = 'Open' | 'Upcoming' | 'Closed';

export interface FormEntry {
  id: string;
  title: string;
  category: FormCategory;
  description: string;
  startDate: string;
  endDate: string;
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

export const mockForms: FormEntry[] = [
  {
    id: '1',
    title: 'Training Issue Resolution Form',
    category: 'Training',
    description: 'Report any issues faced during the placement training sessions.',
    startDate: '2026-01-15',
    endDate: '2026-01-25',
    status: 'Open',
    formUrl: 'https://forms.google.com/example1'
  },
  {
    id: '2',
    title: 'Marks Discrepancy Form - Jan 2026',
    category: 'Marks',
    description: 'Submit discrepancies in your assessment marks for review.',
    startDate: '2026-01-10',
    endDate: '2026-01-20',
    status: 'Open',
    formUrl: 'https://forms.google.com/example2'
  },
  {
    id: '3',
    title: 'Mock Interview Slot Booking',
    category: 'Slot',
    description: 'Book your preferred slot for the upcoming mock interview sessions.',
    startDate: '2026-01-20',
    endDate: '2026-01-30',
    status: 'Upcoming',
    formUrl: 'https://forms.google.com/example3'
  },
  {
    id: '4',
    title: 'Resume Review Slot Booking',
    category: 'Slot',
    description: 'Schedule a one-on-one resume review session with mentors.',
    startDate: '2026-01-22',
    endDate: '2026-02-05',
    status: 'Upcoming',
    formUrl: 'https://forms.google.com/example4'
  },
  {
    id: '5',
    title: 'Training Feedback Form - Dec 2025',
    category: 'Training',
    description: 'Share your feedback on the December training sessions.',
    startDate: '2025-12-20',
    endDate: '2026-01-05',
    status: 'Closed',
    formUrl: 'https://forms.google.com/example5'
  },
  {
    id: '6',
    title: 'Aptitude Test Registration',
    category: 'Other',
    description: 'Register for the upcoming aptitude assessment.',
    startDate: '2025-12-15',
    endDate: '2025-12-25',
    status: 'Closed',
    formUrl: 'https://forms.google.com/example6'
  }
];

export const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'Mock Interview Schedule Released',
    content: 'The schedule for mock interviews has been released. Please check your registered email for your assigned slot.',
    date: '2026-01-16',
    important: true
  },
  {
    id: '2',
    title: 'Training Session Postponed',
    content: 'The communication skills training session scheduled for Jan 18 has been postponed to Jan 20.',
    date: '2026-01-15',
    important: true
  },
  {
    id: '3',
    title: 'New Resume Templates Available',
    content: 'Updated resume templates are now available in the Reference Documents section.',
    date: '2026-01-12',
    important: false
  },
  {
    id: '4',
    title: 'Placement Statistics 2025 Published',
    content: 'The annual placement statistics for 2025 have been published on the main portal.',
    date: '2026-01-10',
    important: false
  }
];

export const mockFAQs: FAQ[] = [
  {
    id: '1',
    question: 'How do I report a marks discrepancy?',
    answer: 'Fill out the Marks Discrepancy Form available in the Open Forms section when it is active. Provide your roll number, subject details, and a clear description of the issue.'
  },
  {
    id: '2',
    question: 'What should I do if I miss my booked slot?',
    answer: 'Contact the IIC office immediately via email at iic@study.iitm.ac.in. Rescheduling is subject to availability.'
  },
  {
    id: '3',
    question: 'How are training sessions scheduled?',
    answer: 'Training sessions are scheduled based on batch and are communicated via official announcements. Check the Announcements section regularly.'
  },
  {
    id: '4',
    question: 'Can I change my registered slot after booking?',
    answer: 'Slot changes are generally not allowed. However, in case of genuine emergencies, contact the IIC office with proper documentation.'
  },
  {
    id: '5',
    question: 'Where can I find placement preparation resources?',
    answer: 'All official resources are available in the Reference Documents section. Additional materials may be shared via announcements.'
  }
];

export const mockDocuments: Document[] = [
  {
    id: '1',
    title: 'Resume Template - Technical Roles',
    description: 'Standard resume template for technical placement applications.',
    url: 'https://drive.google.com/example1',
    type: 'Drive'
  },
  {
    id: '2',
    title: 'Resume Template - Non-Technical Roles',
    description: 'Resume template optimized for management and business roles.',
    url: 'https://drive.google.com/example2',
    type: 'Drive'
  },
  {
    id: '3',
    title: 'Placement Policy Document',
    description: 'Official placement policy and guidelines for students.',
    url: 'https://example.com/policy.pdf',
    type: 'PDF'
  },
  {
    id: '4',
    title: 'Interview Preparation Guide',
    description: 'Comprehensive guide for technical and HR interviews.',
    url: 'https://example.com/interview-guide.pdf',
    type: 'PDF'
  },
  {
    id: '5',
    title: 'Company Profiles 2026',
    description: 'Profiles of companies participating in campus placements.',
    url: 'https://drive.google.com/example3',
    type: 'Drive'
  }
];

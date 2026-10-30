import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarClock, Check, CheckCircle2, Clock3, ExternalLink, FilePlus2, GraduationCap, Loader2, LogOut, Menu, RotateCw, Star, X } from 'lucide-react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ActivityPointsForm from '@/components/ActivityPointsForm';
import { getAnnouncements, getExamSyllabi, getImportantLinks, getTrainingLectures, isBookingWindowOpen } from '@/lib/firestoreService';
import { getExams } from '@/lib/examsService';
import { auth } from '@/lib/firebase';
import { lookupStudentActivityPoints, lookupStudentFeedback, lookupStudentScore } from '@/lib/toolsService';
import { getStoredStudentDomain, getStoredStudentPlan } from '@/lib/emailVerificationService';
import { bookBehavioralSlot, checkStudentSlot as checkBehavioralSlot, getBehavioralBookableSlots, verifyBehavioralStudent, type BehavioralBookableSlot } from '@/lib/behavioralService';
import { bookPresentationSlot, checkStudentSlot as checkPresentationSlot, getPresentationBookableSlots } from '@/lib/presentationService';
import { bookOneOnOneSlot, checkStudentSlot as checkOneOnOneSlot, getOneOnOneBookableSlots, type OneOnOneBookableSlot } from '@/lib/oneOnOneService';
import type { Announcement, ExamConfig, ExamSyllabus, ImportantLink, TrainingLecture } from '@/types';
import type { StudentActivityPointsLookup, StudentFeedbackLookup, StudentScoreLookup } from '@/lib/toolsService';
import './StudentDashboard.css';

type ScoreField = { label: string; value: string };
type ActivitySubmission = { date: string; course: string; proof: string; status?: string; reason?: string };

type LevelStatus = {
  level: string;
  status: string;
  total: string;
  hasActivities: boolean;
  activities: ScoreField[];
};

type BookingOpportunity = {
  label: string;
  slots: number;
  type: 'behavioral' | 'presentation' | 'oneOnOne';
};

type DashboardBookableSlot = BehavioralBookableSlot | OneOnOneBookableSlot | { slot: string; seatRemaining: number; evaluatorEmail: string };

const initializeDashboardParticles = async (engine: Parameters<typeof loadSlim>[0]) => {
  await loadSlim(engine);
};

const dashboardParticleOptions = {
  background: { color: { value: 'transparent' } },
  fullScreen: { enable: false },
  fpsLimit: 30,
  detectRetina: true,
  particles: {
    number: { value: 40, density: { enable: true, area: 1000 } },
    color: { value: '#7b2334' },
    shape: { type: 'circle' },
    opacity: { value: 0.3, random: { enable: true, minimumValue: 0.1 } },
    size: { value: { min: 1, max: 3 }, random: { enable: true, minimumValue: 0.5 } },
    move: {
      enable: true,
      speed: 0.2,
      direction: 'none',
      random: false,
      straight: false,
      outModes: { default: 'out' },
    },
  },
  interactivity: {
    events: {
      onHover: { enable: false },
      onClick: { enable: false },
    },
  },
};

const levels = [
  { name: 'Level 1', status: ['level', '1', 'pass', 'fail'], activities: ['ppm', 'self intro', 'si status', 'listen', 'ls status', 'lw status', 'email writing', 'ew status', 'csm'] },
  { name: 'Level 2', status: ['level 2'], activities: ['self aptitude', 'aptitude status', 'sa attempt', 'behavioural', 'ba attempt', 'presentation', 'pr attempt'] },
  { name: 'Level 3', status: ['level', '3', 'pass', 'fail'], activities: ['tech mcq', 'mcq pass', 'tmcq attempt', 'ai mock', 'ai attempt', '1on1', '1-on-1', 'activity points', 'cma'] },
];

function valueFor(result: StudentScoreLookup | null, terms: string[]): string {
  if (!result?.headers || !result.row) return '';
  const index = result.headers.findIndex((header) => {
    const normalized = String(header || '').trim().toLowerCase();
    return terms.every((term) => normalized.includes(term));
  });
  return index < 0 ? '' : String(result.row[index] || '').trim();
}

function formatAttemptCode(value: string): string {
  switch (value.trim().toUpperCase()) {
    case 'FA1B': return '1st attempt · Batch 1';
    case 'FA2B': return '1st attempt · Batch 2';
    case 'RA1B': return 'Re-attempt · Batch 1';
    case 'RA2B': return 'Re-attempt · Batch 2';
    default: return value;
  }
}

function formatActivityValue(label: string, value: string): string {
  const normalized = value.trim();
  if (!normalized || ['—', '#N/A', 'N/A', 'NOT ATTEMPTED'].includes(normalized.toUpperCase())) return 'Not attempted';
  return label.toLowerCase().includes('attempt') ? formatAttemptCode(normalized) : normalized;
}

function hasRecordedValue(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return Boolean(normalized) && !['—', '#N/A', 'N/A', 'NOT ATTEMPTED'].includes(normalized);
}

function formatAnnouncementContent(content: string): React.ReactNode[] {
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  const result: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      result.push(<strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('*') && part.endsWith('*')) {
      result.push(<em key={index} className="italic">{part.slice(1, -1)}</em>);
    } else if (part.trim()) {
      const lines = part.split('\n');
      lines.forEach((line, lineIndex) => {
        if (line) {
          result.push(<span key={`${index}-${lineIndex}`}>{line}</span>);
        }
        if (lineIndex < lines.length - 1) {
          result.push(<br key={`${index}-br-${lineIndex}`} />);
        }
      });
    }
  });

  return result;
}

function buildLevelStatuses(results: Record<string, StudentScoreLookup | null>): LevelStatus[] {
  return levels.map((level) => {
    const result = results[level.name] || null;
    const status = valueFor(result, level.status) || 'Not started';
    const activityHeaders = result?.headers || [];
    const activities = activityHeaders.flatMap((header, index) => {
      const label = String(header || '').trim();
      const value = String(result?.row?.[index] || '').trim();
      const matches = level.activities.some((term) => label.toLowerCase().includes(term));
      return matches ? [{ label, value }] : [];
    });
    return {
      level: level.name,
      status,
      total: valueFor(result, ['total']),
      hasActivities: activities.some((activity) => hasRecordedValue(activity.value)),
      activities,
    };
  });
}

function isPassed(status: string): boolean {
  return /^(pass|passed)\b/i.test(status.trim());
}

function currentLevelLabel(levelStatuses: LevelStatus[]): string {
  if (!levelStatuses.length) return 'Awaiting scores';
  const current = levelStatuses.find((level) => !isPassed(level.status) && (level.hasActivities || /pending|fail/i.test(level.status)));
  if (current) return current.level;
  const next = levelStatuses.find((level) => !isPassed(level.status));
  return next?.level || 'All levels passed';
}

function getActivityPoints(result: StudentActivityPointsLookup | null): string {
  if (!result?.headers || !result.row) return 'Not available';
  const index = result.headers.findIndex((header) => String(header || '').trim().toLowerCase().includes('total'));
  return index < 0 ? 'Not available' : String(result.row[index] || '0').trim();
}

function activityField(result: StudentActivityPointsLookup | null, field: string): string {
  if (!result?.headers || !result.row) return '';
  const index = result.headers.findIndex((header) => String(header || '').trim().toLowerCase().includes(field));
  return index < 0 ? '' : String(result.row[index] || '').trim();
}

function buildPointsBreakdown(result: StudentActivityPointsLookup | null): ScoreField[] {
  if (!result?.headers || !result.row) return [];
  const ignoredHeaders = ['email', 'name', 'roll', 'plan', 'domain', 'status', 'total', 'cma'];
  return result.headers.flatMap((header, index) => {
    const label = String(header || '').trim();
    const value = String(result.row?.[index] || '').trim();
    const normalized = label.toLowerCase();
    if (!label || !value || ignoredHeaders.some((term) => normalized.includes(term))) return [];
    const numericValue = Number(value.replace(/,/g, ''));
    return Number.isFinite(numericValue) ? [{ label, value: String(numericValue) }] : [];
  });
}

function feedbackEntries(result: StudentFeedbackLookup | null): ScoreField[] {
  if (!result) return [];
  const rows = result.rows || (result.row ? [result.row] : []);
  return rows.flatMap((row, rowIndex) => row.flatMap((cell, columnIndex) => {
    const value = String(cell || '').trim();
    const label = String(result.headers?.[columnIndex] || '').trim();
    if (!value || label.toLowerCase().includes('email')) return [];
    return [{ label: label || `Feedback ${rowIndex + 1}`, value }];
  }));
}

function examStartTime(exam: ExamConfig): number {
  const time = new Date(exam.startAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function examEndTime(exam: ExamConfig): number {
  const time = new Date(exam.endAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatExamTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function localDayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchDailyCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const storageKey = `iic-dashboard-daily:${key}`;
  let staleValue: T | undefined;

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const cached = JSON.parse(stored) as { day?: string; value?: T };
      staleValue = cached.value;
      if (cached.day === localDayKey() && cached.value !== undefined) return cached.value;
    }
  } catch {
    // Ignore unavailable or malformed browser cache entries.
  }

  try {
    const value = await fetcher();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ day: localDayKey(), value }));
    } catch {
      // The fetched data remains usable when browser storage is unavailable.
    }
    return value;
  } catch (error) {
    if (staleValue !== undefined) return staleValue;
    throw error;
  }
}

async function getBookingOpportunities(email: string, studentDomain: string, studentPlan: string): Promise<BookingOpportunity[]> {
  const checks = await Promise.all([
    (async () => {
      if (!(await isBookingWindowOpen('behavioral')).open) return null;
      const verification = await verifyBehavioralStudent(email);
      if (!verification.verified || verification.alreadyBooked) return null;
      const available = await getBehavioralBookableSlots(email);
      return available.slots.length ? { label: 'Behavioral assessment', slots: available.slots.length, type: 'behavioral' as const } : null;
    })().catch(() => null),
    (async () => {
      if (!(await isBookingWindowOpen('presentation')).open) return null;
      const available = await getPresentationBookableSlots(email);
      return available.slots.length ? { label: 'Presentation', slots: available.slots.length, type: 'presentation' as const } : null;
    })().catch(() => null),
    (async () => {
      const domain = studentDomain || getStoredStudentDomain() || '';
      const plan = studentPlan || getStoredStudentPlan() || '';
      if (!domain || !plan || !(await isBookingWindowOpen('oneOnOne')).open) return null;
      const available = await getOneOnOneBookableSlots(email, domain, plan);
      return available.verified && !available.alreadyBooked && available.slots.length
        ? { label: '1-on-1 session', slots: available.slots.length, type: 'oneOnOne' as const }
        : null;
    })().catch(() => null),
  ]);

  return checks.filter((item): item is BookingOpportunity => item !== null);
}

export default function StudentDashboard() {
  const user = auth.currentUser;
  const email = user?.email?.trim().toLowerCase() || '';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [staticResourcesLoading, setStaticResourcesLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [importantLinks, setImportantLinks] = useState<ImportantLink[]>([]);
  const [trainingLectures, setTrainingLectures] = useState<TrainingLecture[]>([]);
  const [examSyllabi, setExamSyllabi] = useState<ExamSyllabus[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [levelStatuses, setLevelStatuses] = useState<LevelStatus[]>([]);
  const [points, setPoints] = useState('—');
  const [cma, setCma] = useState('—');
  const [pointsBreakdown, setPointsBreakdown] = useState<ScoreField[]>([]);
  const [studentDomain, setStudentDomain] = useState('');
  const [studentPlan, setStudentPlan] = useState('');
  const [bookingOpportunities, setBookingOpportunities] = useState<BookingOpportunity[]>([]);
    const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
    const [bookingType, setBookingType] = useState<BookingOpportunity['type']>('behavioral');
    const [bookingChecking, setBookingChecking] = useState(false);
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [bookingSlots, setBookingSlots] = useState<DashboardBookableSlot[]>([]);
    const [bookingAlreadyBooked, setBookingAlreadyBooked] = useState(false);
    const [bookingReceipt, setBookingReceipt] = useState<Record<string, string> | null>(null);
    const [bookingName, setBookingName] = useState('');
    const [bookingContact, setBookingContact] = useState('');
    const [bookingSlot, setBookingSlot] = useState('');
    const [bookingResumeLink, setBookingResumeLink] = useState('');
    const [bookingProgressLink, setBookingProgressLink] = useState('');
    const [checkSlotOpen, setCheckSlotOpen] = useState(false);
    const [checkSlotType, setCheckSlotType] = useState<BookingOpportunity['type']>('behavioral');
    const [checkingSlot, setCheckingSlot] = useState(false);
    const [checkSlotError, setCheckSlotError] = useState('');
    const [checkSlotResult, setCheckSlotResult] = useState<Record<string, string> | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [showPreviousLevels, setShowPreviousLevels] = useState(false);
  const [activityFormOpen, setActivityFormOpen] = useState(false);
  const [examsOpen, setExamsOpen] = useState(false);
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [lecturesOpen, setLecturesOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [submissionsVisible, setSubmissionsVisible] = useState(false);
  const [activitySubmissions, setActivitySubmissions] = useState<ActivitySubmission[]>([]);
  const [activitySubmissionsLoading, setActivitySubmissionsLoading] = useState(false);
  const [activitySubmissionsError, setActivitySubmissionsError] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackByCategory, setFeedbackByCategory] = useState<Record<string, StudentFeedbackLookup | null>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  const refreshStaticResources = useCallback(async () => {
    setStaticResourcesLoading(true);
    try {
      const [links, lectures, syllabi] = await Promise.all([
        fetchDailyCached('important-links', getImportantLinks).catch(() => []),
        fetchDailyCached('training-lectures', getTrainingLectures).catch(() => []),
        fetchDailyCached('exam-syllabi', getExamSyllabi).catch(() => []),
      ]);
      setImportantLinks(links);
      setTrainingLectures(lectures);
      setExamSyllabi(syllabi);
    } finally {
      setStaticResourcesLoading(false);
    }
  }, []);

  const refreshDashboardData = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    setBookingLoading(true);
    setFeedbackLoading(true);
    try {
      const feedbackCategories = ['CSM', 'Behavioral', 'Presentation', '1o1'];
      const [announcementResult, examResult, level1, level2, level3, activityResult, feedbackResults] = await Promise.all([
        getAnnouncements().catch(() => []),
        getExams(email).catch(() => []),
        lookupStudentScore({ level: 'Level 1', email }).catch(() => null),
        lookupStudentScore({ level: 'Level 2', email }).catch(() => null),
        lookupStudentScore({ level: 'Level 3', email }).catch(() => null),
        lookupStudentActivityPoints({ email }).catch(() => null),
        Promise.all(feedbackCategories.map(async (category) => [
          category,
          await lookupStudentFeedback({ category, email }).catch(() => null),
        ] as const)),
      ]);

      const domain = activityField(activityResult, 'domain');
      const plan = activityField(activityResult, 'plan');
      const bookingResult = await getBookingOpportunities(email, domain, plan).catch(() => []);
      const results = { 'Level 1': level1, 'Level 2': level2, 'Level 3': level3 };

      setAnnouncements(announcementResult.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()));
      setExams(examResult);
      setLevelStatuses(buildLevelStatuses(results));
      setPoints(getActivityPoints(activityResult));
      setCma(activityField(activityResult, 'cma') || '—');
      setPointsBreakdown(buildPointsBreakdown(activityResult));
      setFeedbackByCategory(Object.fromEntries(feedbackResults));
      setStudentDomain(domain);
      setStudentPlan(plan);
      setBookingOpportunities(bookingResult);
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
      setBookingLoading(false);
      setFeedbackLoading(false);
      setRefreshing(false);
    }
  }, [email]);

  useEffect(() => {
    let active = true;
    let midnightTimer: number;

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnightTimer = window.setTimeout(async () => {
        if (!active) return;
        await refreshStaticResources();
        if (active) scheduleMidnightRefresh();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    };

    void refreshStaticResources();
    scheduleMidnightRefresh();
    return () => {
      active = false;
      window.clearTimeout(midnightTimer);
    };
  }, [refreshStaticResources]);

  const levelLabel = useMemo(() => currentLevelLabel(levelStatuses), [levelStatuses]);
  const currentLevel = levelStatuses.find((level) => level.level === levelLabel);
  const currentLevelIndex = levelLabel === 'All levels passed' ? levels.length : levels.findIndex((level) => level.name === levelLabel);
  const previousPassedLevels = levelStatuses
    .slice(0, Math.max(0, currentLevelIndex))
    .filter((level) => isPassed(level.status));
  const activeExam = exams.find((exam) => now >= examStartTime(exam) && now <= examEndTime(exam));
  const scheduledExams = exams
    .filter((exam) => examEndTime(exam) >= now)
    .sort((left, right) => examStartTime(left) - examStartTime(right))[0];
  const syllabusExam = activeExam || scheduledExams;
  const matchingSyllabi = syllabusExam
    ? examSyllabi.filter((syllabus) => {
        const syllabusTitle = syllabus.title.toLowerCase();
        const identifiers = [syllabusExam.examId, syllabusExam.title, syllabusExam.assessmentType || '']
          .map((value) => value.toLowerCase().trim())
          .filter((value) => value.length > 2);
        return identifiers.some((identifier) => syllabusTitle.includes(identifier) || identifier.includes(syllabusTitle));
      })
    : [];
  const displayedSyllabi = matchingSyllabi.length ? matchingSyllabi : examSyllabi;
  const recentAnnouncement = announcements[0];

  const openLevelDetails = () => {
    setLevelOpen(true);
    setShowPreviousLevels(false);
  };

  const loadPreviousFeedback = () => {
    setShowPreviousLevels(true);
  };

  const signOutStudent = async () => {
    await signOut(auth);
    navigate('/');
  };

  const startExam = (exam: ExamConfig) => {
    navigate(`/exam?start=${encodeURIComponent(exam.examId)}&standalone=1`);
  };

  const openExamPanel = () => {
    if (activeExam) startExam(activeExam);
    else setExamsOpen(true);
  };

  const openBookingDialog = (opportunity: BookingOpportunity) => {
    setBookingType(opportunity.type);
    setBookingDialogOpen(true);
    setBookingError('');
    setBookingSlots([]);
    setBookingAlreadyBooked(false);
    setBookingReceipt(null);
    setBookingSlot('');
    setBookingName(user?.displayName || '');
    setBookingContact('');
    setBookingResumeLink('');
    setBookingProgressLink('');

    void (async () => {
      setBookingChecking(true);
      try {
        if (!email) throw new Error('Sign in with your student account to book a slot.');
        if (!(await isBookingWindowOpen(opportunity.type)).open) {
          throw new Error('The booking window has closed. Refresh the dashboard to check again.');
        }

        if (opportunity.type === 'behavioral') {
          const verification = await verifyBehavioralStudent(email);
          if (!verification.verified) throw new Error('This account is not eligible for behavioral slot booking.');
          if (verification.alreadyBooked && verification.booking) {
            setBookingAlreadyBooked(true);
            setBookingReceipt(Object.fromEntries(Object.entries(verification.booking).map(([key, value]) => [key, String(value ?? '')])));
            return;
          }
          const available = await getBehavioralBookableSlots(email);
          setBookingSlots(available.slots || []);
          if (!available.slots?.length) throw new Error(available.message || 'No slots are currently available.');
        } else if (opportunity.type === 'presentation') {
          const available = await getPresentationBookableSlots(email);
          if ('verified' in available && !available.verified) throw new Error('This account is not eligible for presentation slot booking.');
          setBookingSlots(available.slots || []);
          if (!available.slots?.length) throw new Error('No presentation slots are currently available.');
        } else {
          if (!studentDomain || !studentPlan) throw new Error('Your domain and plan are not available. Refresh the dashboard and try again.');
          const available = await getOneOnOneBookableSlots(email, studentDomain, studentPlan);
          if (!available.verified) throw new Error('This account is not eligible for 1-on-1 slot booking.');
          if (available.alreadyBooked && available.booking) {
            setBookingAlreadyBooked(true);
            setBookingReceipt(Object.fromEntries(Object.entries(available.booking).map(([key, value]) => [key, String(value ?? '')])));
            return;
          }
          setBookingSlots(available.slots || []);
          if (!available.slots?.length) throw new Error('No 1-on-1 slots are currently available.');
        }
      } catch (error) {
        setBookingError(error instanceof Error ? error.message : 'Could not load bookable slots.');
      } finally {
        setBookingChecking(false);
      }
    })();
  };

  const submitDashboardBooking = async () => {
    if (!email || !bookingName.trim() || !bookingContact.trim() || !bookingSlot) {
      setBookingError('Enter your name and contact number, then select a slot.');
      return;
    }
    if (bookingType === 'oneOnOne' && (!bookingResumeLink.trim() || !bookingProgressLink.trim())) {
      setBookingError('Provide both your resume and progress card Drive links.');
      return;
    }

    setBookingSubmitting(true);
    setBookingError('');
    try {
      const bookingId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `booking_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
      const common = {
        bookingId,
        name: bookingName.trim(),
        email,
        contact: bookingContact.trim(),
        slot: bookingSlot,
      };
      let result: Record<string, unknown>;
      if (bookingType === 'behavioral') {
        result = await bookBehavioralSlot(common);
      } else if (bookingType === 'presentation') {
        result = await bookPresentationSlot(common);
      } else {
        result = await bookOneOnOneSlot({
          ...common,
          domain: studentDomain,
          plan: studentPlan,
          resumeDriveLink: bookingResumeLink.trim(),
          progressCardDriveLink: bookingProgressLink.trim(),
        });
      }
      setBookingReceipt(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value ?? '')])));
      setBookingSlots([]);
      setBookingAlreadyBooked(true);
      setBookingOpportunities((current) => current.filter((item) => item.type !== bookingType));
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Booking failed. Please try again.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleCheckBookedSlot = async () => {
    if (!email) {
      setCheckSlotError('Sign in with your student account to check your booking.');
      return;
    }
    setCheckingSlot(true);
    setCheckSlotError('');
    setCheckSlotResult(null);
    try {
      const result = checkSlotType === 'behavioral'
        ? await checkBehavioralSlot(email, 'behavioral')
        : checkSlotType === 'presentation'
          ? await checkPresentationSlot(email, 'presentation')
          : await checkOneOnOneSlot(email, 'oneOnOne');
      if (!result?.found) {
        setCheckSlotError(result?.message || 'No booked slot was found for this assessment.');
      } else {
        setCheckSlotResult(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value ?? '')])));
      }
    } catch (error) {
      setCheckSlotError(error instanceof Error ? error.message : 'Could not check the booked slot.');
    } finally {
      setCheckingSlot(false);
    }
  };

  const loadActivitySubmissions = async () => {
    setSubmissionsVisible(true);
    setActivitySubmissionsLoading(true);
    setActivitySubmissionsError('');
    try {
      const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL || '';
      if (!apiUrl) throw new Error('Activity points service is not configured.');
      if (!email) throw new Error('Sign in with your student account to view submissions.');

      const formData = new FormData();
      formData.append('action', 'getSubmissions');
      formData.append('email', email);
      const response = await fetch(apiUrl, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not load activity submissions.');
      }
      setActivitySubmissions(Array.isArray(result.data?.submissions) ? result.data.submissions : []);
    } catch (error) {
      setActivitySubmissionsError(error instanceof Error ? error.message : 'Could not load activity submissions.');
      setActivitySubmissions([]);
    } finally {
      setActivitySubmissionsLoading(false);
    }
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <ParticlesProvider init={initializeDashboardParticles}>
    <Layout hideHeader>
      <div className="dashboard-viewport">
        <div className="dashboard-particle-layer" aria-hidden="true">
          <Particles id="dashboard-space" options={dashboardParticleOptions} />
        </div>
        <header className="dashboard-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#7b2334] text-white text-sm font-bold">IIC</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">General Portal</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><span className="dashboard-live-dot" /> Live dashboard</span>
            {lastUpdatedAt && <span className="hidden text-xs text-muted-foreground md:inline">Updated {lastUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
            <Button variant="outline" size="sm" onClick={() => void refreshDashboardData()} disabled={refreshing} aria-label="Refresh dashboard">
              {refreshing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCw className="mr-1.5 h-3.5 w-3.5" />}
              Refresh
            </Button>
            <Button variant="ghost" size="icon" onClick={signOutStudent} aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>

        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogContent className="max-w-md max-h-[80dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Menu</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <Card
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => { setMobileMenuOpen(false); openLevelDetails(); }}
                onKeyDown={(event) => handlePanelKeyDown(event, () => { setMobileMenuOpen(false); openLevelDetails(); })}
                role="button"
                tabIndex={0}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Current level</p><p className="mt-2 text-xl font-semibold leading-tight">{loading ? 'Loading…' : levelLabel}</p></div>
                    <CheckCircle2 className="text-[#7b2334] h-5 w-5 shrink-0" />
                  </div>
                  <div>
                    <Badge variant={currentLevel && isPassed(currentLevel.status) ? 'default' : 'outline'}>{currentLevel?.status || 'In progress'}</Badge>
                    <p className="mt-2 truncate text-sm text-muted-foreground">{currentLevel?.total ? `Score ${currentLevel.total}` : 'Tap to view pending activities'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => { setMobileMenuOpen(false); openExamPanel(); }}
                onKeyDown={(event) => handlePanelKeyDown(event, () => { setMobileMenuOpen(false); openExamPanel(); })}
                role="button"
                tabIndex={0}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2"><CalendarClock className="text-[#276f67] h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Exams</p></div>
                  {activeExam ? (
                    <div><Badge className="bg-emerald-700 hover:bg-emerald-700">Open now</Badge><h2 className="mt-2 line-clamp-2 font-semibold">{activeExam.title}</h2><p className="mt-1 text-xs text-muted-foreground">Ready to start</p></div>
                  ) : scheduledExams ? (
                    <div><p className="mt-1 text-lg font-semibold leading-tight">{scheduledExams.title}</p><p className="mt-2 text-xs text-muted-foreground">Starts {formatExamTime(scheduledExams.startAt)}</p></div>
                  ) : <p className="text-sm text-muted-foreground">{loading ? 'Checking schedule…' : lastUpdatedAt ? 'There are no upcoming exams scheduled for you.' : 'Refresh to load the exam schedule.'}</p>}
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={(event) => { event.stopPropagation(); setMobileMenuOpen(false); setSyllabusOpen(true); }}>
                    Check syllabus
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:bg-accent/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2"><Star className="h-4 w-4 text-[#b77922]" /><p className="text-xs font-semibold uppercase text-muted-foreground">Activity points</p></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-[11px] text-muted-foreground">Total points</p><p className="mt-1 truncate text-xl font-semibold">{points}</p></div>
                    <div><p className="text-[11px] text-muted-foreground">CMA score</p><p className="mt-1 truncate text-xl font-semibold">{cma}</p></div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-[#7b2334] h-7 px-2" onClick={() => { setMobileMenuOpen(false); setPointsOpen(true); }}>Points breakdown</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:bg-accent/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2"><BookOpen className="text-[#456e9b] h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Important links</p></div>
                  <div className="mt-1 divide-y">
                    {importantLinks.slice(0, 2).map((item) => (
                      <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="text-[#7b2334] flex items-center justify-between gap-2 py-1.5 text-sm">
                        <span className="line-clamp-1 font-medium">{item.title}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                    {!importantLinks.length && <p className="py-2 text-sm text-muted-foreground">{staticResourcesLoading ? 'Loading…' : 'No important links available.'}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#456e9b] mt-1 h-7 justify-start px-0 text-xs font-semibold" onClick={() => { setMobileMenuOpen(false); setLinksOpen(true); }}>All links <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button>
                </CardContent>
              </Card>

              <Card className="hover:bg-accent/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2"><CalendarClock className="text-[#276f67] h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Slot bookings</p></div>
                  {bookingOpportunities.length ? (
                    <div className="mt-1 space-y-1.5">
                      {bookingOpportunities.slice(0, 3).map((item) => (
                        <div key={item.label} className="flex min-w-0 items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{item.label}<span className="ml-1 text-xs text-muted-foreground">{item.slots}</span></span>
                          <Button size="sm" className="h-7 shrink-0 px-2" onClick={() => { setMobileMenuOpen(false); openBookingDialog(item); }}>Book</Button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{loading || bookingLoading ? 'Checking your eligibility…' : lastUpdatedAt ? 'No eligible booking windows are open.' : 'Refresh to check booking availability.'}</p>}
                  <Button variant="ghost" size="sm" className="text-[#276f67] mt-1 h-7 px-2" onClick={() => { setMobileMenuOpen(false); setCheckSlotError(''); setCheckSlotResult(null); setCheckSlotOpen(true); }}>Check your booked slot <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button>
                </CardContent>
              </Card>

              <Card className="hover:bg-accent/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2"><GraduationCap className="text-[#456e9b] h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Training lectures</p></div>
                  <div className="mt-1 divide-y">
                    {trainingLectures.slice(0, 2).map((lecture) => (
                      <a key={lecture.id} href={lecture.videoUrl || lecture.youtubeUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 py-2 text-sm font-medium hover:text-[#7b2334]">
                        <span className="line-clamp-1">{lecture.title}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                    {!trainingLectures.length && <p className="py-2 text-sm text-muted-foreground">{staticResourcesLoading ? 'Loading…' : 'No lectures available.'}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#456e9b] mt-1 h-7 justify-start px-0 text-xs font-semibold" onClick={() => { setMobileMenuOpen(false); setLecturesOpen(true); }}>All lectures <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => { setMobileMenuOpen(false); setActivityFormOpen(true); }}
                onKeyDown={(event) => handlePanelKeyDown(event, () => { setMobileMenuOpen(false); setActivityFormOpen(true); })}
                role="button"
                tabIndex={0}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2"><FilePlus2 className="text-[#ad623a] h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Submit activity</p></div>
                  <div><p className="text-lg font-semibold">Claim points</p><p className="mt-1 text-sm text-muted-foreground">Submit a completed activity for review.</p></div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        <main className="dashboard-stage" aria-label="Student dashboard">
          <Card className="dashboard-panel dashboard-announcement-panel">
            <CardContent className="dashboard-panel-content">
              <div className="flex items-center gap-2"><Bell className="dashboard-rust h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Announcements</p></div>
              {recentAnnouncement ? (
                <>
                  <div className="flex items-center gap-2 mt-3">
                    <h2 className="text-base font-semibold leading-snug">{recentAnnouncement.title}</h2>
                    {recentAnnouncement.important && <Badge variant="destructive">Important</Badge>}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed prose prose-sm max-w-none">{formatAnnouncementContent(recentAnnouncement.content)}</div>
                  <p className="mt-3 text-xs text-muted-foreground">{new Date(recentAnnouncement.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                  {announcements.length > 1 && (
                    <div className="mt-auto flex justify-end pt-3">
                      <Button size="sm" variant="ghost" className="dashboard-accent h-8 px-2" onClick={() => { setShowAllAnnouncements(true); setAnnouncementOpen(true); }}>
                        View all announcements <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              ) : <p className="mt-3 text-sm text-muted-foreground">{loading ? 'Loading…' : lastUpdatedAt ? 'No announcements yet.' : 'Refresh to load announcements.'}</p>}
            </CardContent>
          </Card>

          <Card
            className="dashboard-panel dashboard-level-panel cursor-pointer"
            onClick={openLevelDetails}
            onKeyDown={(event) => handlePanelKeyDown(event, openLevelDetails)}
            role="button"
            tabIndex={0}
          >
            <CardContent className="dashboard-panel-content justify-between">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-xs font-semibold uppercase text-muted-foreground">Current level</p><p className="mt-2 text-xl font-semibold leading-tight">{loading ? 'Loading…' : levelLabel}</p></div>
                <CheckCircle2 className="dashboard-accent h-5 w-5 shrink-0" />
              </div>
              <div>
                <Badge variant={currentLevel && isPassed(currentLevel.status) ? 'default' : 'outline'}>{currentLevel?.status || 'In progress'}</Badge>
                <p className="mt-2 truncate text-sm text-muted-foreground">{currentLevel?.total ? `Score ${currentLevel.total}` : 'Tap to view pending activities'}</p>
                <span className="dashboard-accent mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold">View level <ArrowUpRight className="h-3.5 w-3.5" /></span>
              </div>
            </CardContent>
          </Card>

          <Card
            className="dashboard-panel dashboard-exam-panel cursor-pointer"
            onClick={openExamPanel}
            onKeyDown={(event) => handlePanelKeyDown(event, openExamPanel)}
            role="button"
            tabIndex={0}
          >
            <CardContent className="dashboard-panel-content justify-between">
              <div className="flex items-center gap-2"><CalendarClock className="dashboard-teal h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Exams</p></div>
              {activeExam ? (
                <div><Badge className="bg-emerald-700 hover:bg-emerald-700">Open now</Badge><h2 className="mt-2 line-clamp-2 font-semibold">{activeExam.title}</h2><p className="mt-1 text-xs text-muted-foreground">Ready to start</p></div>
              ) : scheduledExams ? (
                <div><p className="mt-1 text-lg font-semibold leading-tight">{scheduledExams.title}</p><p className="mt-2 text-xs text-muted-foreground">Starts {formatExamTime(scheduledExams.startAt)}</p></div>
              ) : <p className="text-sm text-muted-foreground">{loading ? 'Checking schedule…' : lastUpdatedAt ? 'There are no upcoming exams scheduled for you.' : 'Refresh to load the exam schedule.'}</p>}
              <span className="dashboard-teal inline-flex items-center gap-1 pt-2 text-xs font-semibold">{activeExam ? 'Start exam' : 'View schedule'} <ArrowUpRight className="h-3.5 w-3.5" /></span>
              <Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setSyllabusOpen(true); }}>Check syllabus</Button>
            </CardContent>
          </Card>

          <Card className="dashboard-panel dashboard-points-panel">
            <CardContent className="dashboard-panel-content">
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-[#b77922]" /><p className="text-xs font-semibold uppercase text-muted-foreground">Activity points</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[11px] text-muted-foreground">Total points</p><p className="mt-1 truncate text-xl font-semibold">{points}</p></div>
                <div><p className="text-[11px] text-muted-foreground">CMA score</p><p className="mt-1 truncate text-xl font-semibold">{cma}</p></div>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Button variant="ghost" size="sm" className="dashboard-accent h-7 px-2" onClick={() => setPointsOpen(true)}>Points breakdown</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="dashboard-panel dashboard-links-panel">
            <CardContent className="dashboard-panel-content">
              <div className="flex items-center gap-2"><BookOpen className="dashboard-blue h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Important links</p></div>
              <div className="mt-1 min-h-0 divide-y overflow-hidden">
                {importantLinks.slice(0, 2).map((item) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="dashboard-link-item dashboard-accent flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="line-clamp-1 font-medium">{item.title}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
                {!importantLinks.length && <p className="py-2 text-sm text-muted-foreground">{staticResourcesLoading ? 'Loading…' : 'No important links available.'}</p>}
              </div>
              {importantLinks.length > 0 && <Button variant="ghost" size="sm" className="dashboard-accent mt-1 h-7 self-end px-2" onClick={() => setLinksOpen(true)}>Explore more <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
            </CardContent>
          </Card>

          <Card className="dashboard-panel dashboard-booking-panel">
            <CardContent className="dashboard-panel-content">
              <div className="flex items-center gap-2"><CalendarClock className="dashboard-teal h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Slot bookings</p></div>
              {bookingOpportunities.length ? (
                <div className="mt-1 min-h-0 space-y-1.5 overflow-hidden">
                  {bookingOpportunities.slice(0, 3).map((item) => (
                    <div key={item.label} className="dashboard-booking-item flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.label}<span className="ml-1 text-xs text-muted-foreground">{item.slots}</span></span>
                      <Button size="sm" className="h-7 shrink-0 px-2" onClick={() => openBookingDialog(item)}>Book</Button>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{loading || bookingLoading ? 'Checking your eligibility…' : lastUpdatedAt ? 'No eligible booking windows are open.' : 'Refresh to check booking availability.'}</p>}
              <Button variant="ghost" size="sm" className="dashboard-teal mt-1 h-7 self-start px-2" onClick={() => { setCheckSlotError(''); setCheckSlotResult(null); setCheckSlotOpen(true); }}>Check your booked slot <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Button>
            </CardContent>
          </Card>

          <Card className="dashboard-panel dashboard-training-panel">
            <CardContent className="dashboard-panel-content">
              <div className="flex items-center gap-2"><GraduationCap className="dashboard-blue h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Training lectures</p></div>
              <div className="mt-1 min-h-0 divide-y overflow-hidden">
                {trainingLectures.slice(0, 2).map((lecture) => (
                  <a key={lecture.id} href={lecture.videoUrl || lecture.youtubeUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 py-2 text-sm font-medium hover:text-[#7b2334]">
                    <span className="line-clamp-1">{lecture.title}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
                {!trainingLectures.length && <p className="py-2 text-sm text-muted-foreground">{staticResourcesLoading ? 'Loading…' : 'No lectures available.'}</p>}
              </div>
              {trainingLectures.length > 0 && <Button variant="ghost" size="sm" className="dashboard-blue mt-1 h-7 self-end px-2" onClick={() => setLecturesOpen(true)}>Explore lectures <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
            </CardContent>
          </Card>

          <Card
            className="dashboard-panel dashboard-submit-panel cursor-pointer"
            onClick={() => setActivityFormOpen(true)}
            onKeyDown={(event) => handlePanelKeyDown(event, () => setActivityFormOpen(true))}
            role="button"
            tabIndex={0}
          >
            <CardContent className="dashboard-panel-content justify-between">
              <div className="flex items-center gap-2"><FilePlus2 className="dashboard-rust h-4 w-4" /><p className="text-xs font-semibold uppercase text-muted-foreground">Submit activity</p></div>
              <div><p className="text-lg font-semibold">Claim points</p><p className="dashboard-submit-description mt-1 text-sm text-muted-foreground">Submit a completed activity for review.</p></div>
              <span className="dashboard-accent inline-flex items-center gap-1 pt-2 text-xs font-semibold">Open form <ArrowUpRight className="h-3.5 w-3.5" /></span>
            </CardContent>
          </Card>
        </main>

        <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
          <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>{showAllAnnouncements ? 'Announcements' : 'Recent announcement'}</DialogTitle><DialogDescription>Updates from the Industry Interaction Cell.</DialogDescription></DialogHeader>
            {showAllAnnouncements ? (
              <div className="divide-y rounded-md border">
                {announcements.map((announcement) => (
                  <article key={announcement.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{announcement.title}</h3>{announcement.important && <Badge variant="destructive">Important</Badge>}</div>
                    <div className="mt-2 text-sm leading-relaxed prose prose-sm max-w-none text-muted-foreground">{formatAnnouncementContent(announcement.content)}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(announcement.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                  </article>
                ))}
                {!announcements.length && <p className="p-4 text-sm text-muted-foreground">No announcements yet.</p>}
              </div>
            ) : recentAnnouncement ? (
              <article className="rounded-md border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{recentAnnouncement.title}</h3>{recentAnnouncement.important && <Badge variant="destructive">Important</Badge>}</div>
                <div className="mt-3 text-sm leading-relaxed prose prose-sm max-w-none">{formatAnnouncementContent(recentAnnouncement.content)}</div>
                <p className="mt-3 text-xs text-muted-foreground">{new Date(recentAnnouncement.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
              </article>
            ) : <p className="text-sm text-muted-foreground">No announcements yet.</p>}
            <DialogFooter>
              {!showAllAnnouncements && announcements.length > 1 && <Button variant="outline" onClick={() => setShowAllAnnouncements(true)}>Explore more</Button>}
              <Button variant="ghost" onClick={() => setAnnouncementOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={levelOpen} onOpenChange={setLevelOpen}>
          <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>{levelLabel}</DialogTitle><DialogDescription>Level status, attempts, and assessment feedback.</DialogDescription></DialogHeader>
            <section className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Level progress</h3><Badge variant={currentLevel && (isPassed(currentLevel.status) || /^report sent$/i.test(currentLevel.status.trim())) ? 'default' : 'outline'}>{currentLevel && /^report sent$/i.test(currentLevel.status.trim()) ? 'Completed' : currentLevel?.status || 'In progress'}</Badge></div>
              {currentLevel?.hasActivities ? (
                <div className="mt-3 divide-y">
                  {currentLevel.activities.map((field) => (
                    <div key={field.label} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-muted-foreground">{field.label}</span><span className="text-right font-medium">{formatActivityValue(field.label, field.value)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">{lastUpdatedAt ? 'Please check your email for the progress card of your training completion.' : 'Refresh the dashboard to load level progress.'}</p>}
            </section>
            <section className="space-y-3">
              <div><h3 className="font-semibold">Assessment feedback</h3><p className="text-sm text-muted-foreground">Feedback is grouped by assessment type.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'CSM', label: 'CSM' },
                  { key: 'Behavioral', label: 'BA · Behavioral' },
                  { key: 'Presentation', label: 'Presentation' },
                  { key: '1o1', label: '1-on-1' },
                ].map(({ key, label }) => {
                  const entries = feedbackEntries(feedbackByCategory[key] || null);
                  return (
                    <article key={key} className="rounded-md border p-3">
                      <h4 className="text-sm font-semibold">{label}</h4>
                      {feedbackLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading feedback…</p> : entries.length ? (
                        <div className="mt-2 space-y-2">
                          {entries.map((entry, index) => <div key={`${key}-${index}`}><p className="text-xs text-muted-foreground">{entry.label}</p><p className="mt-0.5 whitespace-pre-wrap text-sm">{entry.value}</p></div>)}
                        </div>
                      ) : <p className="mt-2 text-sm text-muted-foreground">{!lastUpdatedAt ? 'Refresh the dashboard to load feedback.' : 'Not attempted'}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
            <Button variant="outline" onClick={loadPreviousFeedback}>
              <ArrowRight className="mr-2 h-4 w-4" />
              {showPreviousLevels ? 'Previous level scores shown' : 'Show previous level scores'}
            </Button>
            {showPreviousLevels && (
              <div className="space-y-4">
                {previousPassedLevels.length ? previousPassedLevels.map((level) => (
                  <section key={level.level} className="rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{level.level}</h3><Badge><Check className="mr-1 h-3 w-3" />Passed</Badge></div>
                    <p className="mt-2 text-sm">Overall score: <span className="font-semibold">{level.total || '—'}</span></p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {level.activities.map((field) => <div key={field.label} className="rounded-sm bg-muted/50 p-2 text-sm"><p className="text-xs text-muted-foreground">{field.label}</p><p className="mt-1 font-medium">{formatActivityValue(field.label, field.value)}</p></div>)}
                    </div>
                  </section>
                )) : <p className="text-sm text-muted-foreground">There are no passed previous levels to show yet.</p>}
              </div>
            )}
            <DialogFooter><Button variant="ghost" onClick={() => setLevelOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={examsOpen} onOpenChange={setExamsOpen}>
          <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle>Exams</DialogTitle><DialogDescription>Scheduled assessments for your account.</DialogDescription></DialogHeader>
            {activeExam && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-700/30 bg-emerald-50 p-4">
                <div className="min-w-0"><Badge className="bg-emerald-700 hover:bg-emerald-700">Open now</Badge><p className="mt-2 font-semibold">{activeExam.title}</p><p className="text-sm text-muted-foreground">Closes {formatExamTime(activeExam.endAt)}</p></div>
                <Button onClick={() => startExam(activeExam)}>Start <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
              </div>
            )}
            {exams.filter((exam) => examEndTime(exam) >= now && exam.examId !== activeExam?.examId).length ? (
              <div className="divide-y rounded-md border">
                {exams.filter((exam) => examEndTime(exam) >= now && exam.examId !== activeExam?.examId).map((exam) => {
                  const isOpen = now >= examStartTime(exam);
                  return <div key={exam.examId} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="truncate font-medium">{exam.title}</p><p className="text-xs text-muted-foreground">{isOpen ? 'Open now' : `Opens ${formatExamTime(exam.startAt)}`}</p></div>{isOpen && <Button size="sm" onClick={() => startExam(exam)}>Start exam</Button>}</div>;
                })}
              </div>
            ) : null}
            {!loading && !activeExam && !scheduledExams && <p className="rounded-md border p-4 text-sm text-muted-foreground">There are no upcoming exams scheduled for you.</p>}
            <DialogFooter><Button variant="ghost" onClick={() => setExamsOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={syllabusOpen} onOpenChange={setSyllabusOpen}>
          <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Exam syllabus</DialogTitle>
              <DialogDescription>{syllabusExam ? `Syllabus for ${syllabusExam.title}` : 'Available exam syllabi'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {displayedSyllabi.map((syllabus) => (
                <section key={syllabus.id} className="rounded-md border p-4">
                  <h3 className="font-semibold">{syllabus.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{syllabus.description}</p>
                </section>
              ))}
              {!displayedSyllabi.length && <p className="rounded-md border p-4 text-sm text-muted-foreground">No syllabus has been added yet.</p>}
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setSyllabusOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activityFormOpen} onOpenChange={setActivityFormOpen}>
          <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>Submit activity points</DialogTitle><DialogDescription>Complete the activity details and submit them for review.</DialogDescription></DialogHeader>
            <ActivityPointsForm />
          </DialogContent>
        </Dialog>

        <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
          <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Important links</DialogTitle><DialogDescription>Resources shared by the Industry Interaction Cell.</DialogDescription></DialogHeader>
            <div className="divide-y rounded-md border">
              {importantLinks.map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 p-4 hover:bg-muted/50">
                  <span><span className="block font-medium">{item.title}</span>{item.description && <span className="mt-1 block text-sm text-muted-foreground">{item.description}</span>}</span>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
              {!importantLinks.length && <p className="p-4 text-sm text-muted-foreground">No links available.</p>}
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setLinksOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pointsOpen} onOpenChange={setPointsOpen}>
          <DialogContent className="flex max-h-[85dvh] max-w-6xl flex-col overflow-hidden">
            <DialogHeader><DialogTitle>Activity points breakdown</DialogTitle><DialogDescription>Your recorded points by activity.</DialogDescription></DialogHeader>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.6fr)] md:overflow-hidden">
              <section className="space-y-3 md:min-h-0 md:overflow-y-auto">
                <h3 className="text-sm font-semibold">Points breakdown</h3>
                <div className="divide-y rounded-md border">
                  {pointsBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4 p-3 text-sm"><span className="text-muted-foreground">{item.label}</span><span className="font-semibold">{item.value}</span></div>
                  ))}
                  {!pointsBreakdown.length && <p className="p-4 text-sm text-muted-foreground">No activity breakdown is available yet.</p>}
                </div>
              </section>
              <section className="space-y-3 md:min-h-0 md:overflow-y-auto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Activity submissions</h3>
                  <Button variant="outline" size="sm" onClick={() => void loadActivitySubmissions()} disabled={activitySubmissionsLoading}>
                    {activitySubmissionsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {submissionsVisible ? 'Refresh submissions' : 'View submissions'}
                  </Button>
                </div>
                {activitySubmissionsLoading ? <p className="text-sm text-muted-foreground">Loading submissions…</p> : null}
                {activitySubmissionsError ? <p className="text-sm text-destructive">{activitySubmissionsError}</p> : null}
                {submissionsVisible && !activitySubmissionsLoading && !activitySubmissionsError && activitySubmissions.length === 0 && <p className="text-sm text-muted-foreground">No activity submissions found.</p>}
                {activitySubmissions.length > 0 && (
                  <div className="max-h-[60dvh] overflow-auto rounded-md border">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr><th className="p-2 font-medium">Date</th><th className="p-2 font-medium">Activity</th><th className="p-2 font-medium">Proof</th><th className="p-2 font-medium">Status</th><th className="p-2 font-medium">Reason</th></tr>
                      </thead>
                      <tbody>
                        {activitySubmissions.map((submission, index) => (
                          <tr key={`${submission.date}-${submission.course}-${index}`} className="border-t align-top">
                            <td className="p-2">{submission.date || '—'}</td>
                            <td className="p-2">{submission.course || '—'}</td>
                            <td className="p-2">{submission.proof ? <a href={submission.proof} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a> : '—'}</td>
                            <td className="p-2">{submission.status || '—'}</td>
                            <td className="p-2">{submission.reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setPointsOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={lecturesOpen} onOpenChange={setLecturesOpen}>
          <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Training lectures</DialogTitle><DialogDescription>Continue with a lecture from the training library.</DialogDescription></DialogHeader>
            <div className="divide-y rounded-md border">
              {trainingLectures.map((lecture) => (
                <a key={lecture.id} href={lecture.videoUrl || lecture.youtubeUrl || '#'} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-3 p-4 hover:bg-muted/50">
                  <span><span className="block font-medium">{lecture.title}</span>{lecture.description && <span className="mt-1 block text-sm text-muted-foreground">{lecture.description}</span>}</span>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
              {!trainingLectures.length && <p className="p-4 text-sm text-muted-foreground">No lectures available.</p>}
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setLecturesOpen(false)}>Close</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
          <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{bookingAlreadyBooked ? 'Slot booking status' : `Book ${bookingType === 'oneOnOne' ? '1-on-1' : bookingType} slot`}</DialogTitle>
              <DialogDescription>{email || 'Your verified portal email'}{bookingType === 'oneOnOne' && studentDomain && studentPlan ? ` · ${studentDomain} · ${studentPlan}` : ''}</DialogDescription>
            </DialogHeader>

            {bookingChecking ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking eligibility and available slots…</div>
            ) : bookingError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{bookingError}</div>
            ) : bookingReceipt ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
                <p className="font-semibold">{bookingAlreadyBooked ? 'A booking is already recorded.' : 'Slot booked successfully.'}</p>
                {['name', 'email', 'contact', 'slot', 'timestamp', 'domain', 'plan'].map((key) => bookingReceipt[key] ? (
                  <div key={key} className="flex justify-between gap-3"><span className="capitalize text-muted-foreground">{key === 'timestamp' ? 'Booked at' : key}</span><span className="text-right font-medium">{bookingReceipt[key]}</span></div>
                ) : null)}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5"><Label htmlFor="dashboard-booking-name">Name</Label><Input id="dashboard-booking-name" value={bookingName} onChange={(event) => setBookingName(event.target.value)} placeholder="Enter your full name" disabled={bookingSubmitting} /></div>
                <div className="space-y-1.5"><Label htmlFor="dashboard-booking-contact">Contact</Label><Input id="dashboard-booking-contact" value={bookingContact} onChange={(event) => setBookingContact(event.target.value)} placeholder="Enter your contact number" disabled={bookingSubmitting} /></div>
                {bookingType === 'oneOnOne' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Domain</Label><Input value={studentDomain} readOnly /></div>
                      <div className="space-y-1.5"><Label>Plan</Label><Input value={studentPlan} readOnly /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="dashboard-resume-link">Resume Drive link</Label><Input id="dashboard-resume-link" type="url" value={bookingResumeLink} onChange={(event) => setBookingResumeLink(event.target.value)} placeholder="https://drive.google.com/..." disabled={bookingSubmitting} /></div>
                    <div className="space-y-1.5"><Label htmlFor="dashboard-progress-link">Progress card Drive link</Label><Input id="dashboard-progress-link" type="url" value={bookingProgressLink} onChange={(event) => setBookingProgressLink(event.target.value)} placeholder="https://drive.google.com/..." disabled={bookingSubmitting} /></div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="dashboard-booking-slot">Available slot</Label>
                  <Select value={bookingSlot} onValueChange={setBookingSlot} disabled={bookingSubmitting}>
                    <SelectTrigger id="dashboard-booking-slot"><SelectValue placeholder="Select an available slot" /></SelectTrigger>
                    <SelectContent>{bookingSlots.map((slot) => <SelectItem key={slot.slot} value={slot.slot}>{slot.slot}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setBookingDialogOpen(false)} disabled={bookingSubmitting}>Close</Button>
              {!bookingChecking && !bookingError && !bookingReceipt && <Button onClick={() => void submitDashboardBooking()} disabled={bookingSubmitting || !bookingSlots.length}>{bookingSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm booking</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={checkSlotOpen} onOpenChange={setCheckSlotOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Check your booked slot</DialogTitle><DialogDescription>Look up a scheduled slot using your verified portal email.</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Verified email</Label><Input value={email} readOnly /></div>
              <div className="space-y-1.5">
                <Label htmlFor="dashboard-check-slot-type">Assessment</Label>
                <Select value={checkSlotType} onValueChange={(value) => setCheckSlotType(value as BookingOpportunity['type'])}>
                  <SelectTrigger id="dashboard-check-slot-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                    <SelectItem value="oneOnOne">1-on-1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {checkSlotError && <p className="text-sm text-destructive">{checkSlotError}</p>}
              {checkSlotResult && <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">{Object.entries(checkSlotResult).filter(([, value]) => value).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><span className="capitalize text-muted-foreground">{key}</span><span className="text-right font-medium">{value}</span></div>)}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCheckSlotOpen(false)}>Close</Button>
              <Button onClick={() => void handleCheckBookedSlot()} disabled={checkingSlot}>{checkingSlot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Check slot</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
    </ParticlesProvider>
  );
}
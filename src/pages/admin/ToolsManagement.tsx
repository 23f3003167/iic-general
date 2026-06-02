import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Loader2, Upload, Wrench } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { auth } from '@/lib/firebase';
import { listSlotsAvailability, type SlotAvailability, getSlotsConfig } from '@/lib/firestoreService';
import {
  releaseBehaviouralSlots,
  getBehavioralInstructors,
  getPresentationInstructors,
  getOneOnOneInstructors,
  releasePresentationSlots,
  releaseOneOnOneSlots,
  getAiMenuOptions,
  getAiStudents,
  runAiMenuAction,
  getPublishScoreActivities,
  publishScoresToSheet,
  type AiMenuOption,
  type AiStudent,
  type InstructorOption,
  type PublishScoreActivity,
  type ReleaseBehaviouralSlotsResponse,
} from '@/lib/toolsService';

const BA_SLOT_DURATION_MINUTES = 10;
const PRESENTATION_SLOT_DURATION_MINUTES = 15;
const ONE_ON_ONE_SLOT_DURATION_MINUTES = 30;
const ONE_ON_ONE_SLOT_DURATION_OPTIONS = [15, 30] as const;
const DEFAULT_AI_MENU_OPTIONS: AiMenuOption[] = [
  {
    key: 'evaluate_selected_student',
    label: 'Evaluate Selected Student',
    module: 'all',
    requiresRow: true,
  },
  {
    key: 'evaluate_m_to_n_all',
    label: 'Evaluate all Students from Mth row to Nth row',
    module: 'all',
    requiresRange: true,
  },
  {
    key: 'evaluate_all_students',
    label: 'Evaluate All Students',
    module: 'all',
  },
  {
    key: 'evaluate_self_intro_all',
    label: 'Evaluate Self-Intro for all',
    module: 'self_intro',
  },
  {
    key: 'evaluate_self_intro_m_to_n',
    label: 'Evalaute Self-Intro from Mth row to Nth row',
    module: 'self_intro',
    requiresRange: true,
  },
  {
    key: 'evaluate_listening_speaking_all',
    label: 'Evaluate Listening and speaking for All',
    module: 'listening_speaking',
  },
  {
    key: 'evaluate_listening_speaking_m_to_n',
    label: 'Evalaute Listening and speaking from Mth row to Nth row',
    module: 'listening_speaking',
    requiresRange: true,
  },
  {
    key: 'evaluate_listening_writing_all',
    label: 'Evalaute Listening and Writing for all',
    module: 'listening_writing',
  },
  {
    key: 'evaluate_listening_writing_m_to_n',
    label: 'Evalaute Listening and Writing from Mth row to Nth row',
    module: 'listening_writing',
    requiresRange: true,
  },
  {
    key: 'evaluate_email_writing_all',
    label: 'Evaluate Email writing for all',
    module: 'email_writing',
  },
  {
    key: 'evaluate_email_writing_m_to_n',
    label: 'Evalaute Email writing from Mth row to Nth row',
    module: 'email_writing',
    requiresRange: true,
  },
];

function getInstructorNameByNumber(instructorNumber: string, instructors: InstructorOption[]): string {
  return instructors.find((item) => item.number === instructorNumber)?.name || `#${instructorNumber}`;
}

type ReleaseHistoryEntry = {
  id: string;
  time: string;
  tool: string;
  payload: {
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    instructorNumber: string;
    syncToForm: boolean;
    resetFormResponses: boolean;
    studentAuthorizationEmails?: string;
  };
  status: 'SUCCESS' | 'FAILED';
  message: string;
  result?: ReleaseBehaviouralSlotsResponse;
};

function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const unique = new Set(matches.map((email) => email.trim().toLowerCase()));
  return Array.from(unique).sort();
}

function toMultiline(items: string[]): string {
  return items.join('\n');
}

function toDdMmYyyy(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function toAmPmFrom24Hour(time24: string): string {
  const [hoursStr, minutes] = time24.split(':');
  const hours = Number(hoursStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(twelveHour)}:${minutes} ${period}`;
}

function buildThirtyMinuteOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      options.push({ value, label: toAmPmFrom24Hour(value) });
    }
  }
  return options;
}

function formatAvailabilityLabel(availability?: {
  date?: string;
  startTime?: string;
  endTime?: string;
  instructorName?: string;
  section?: string;
  durationMinutes?: number;
  instructorNumber?: string;
}): string {
  if (!availability) return '';

  const parts = [
    availability.section || '',
    availability.date || '—',
    availability.startTime || '—',
    availability.endTime || '—',
    availability.instructorName || `#${availability.instructorNumber || '—'}`,
    availability.durationMinutes ? `${availability.durationMinutes} mins` : '—',
  ].filter(Boolean);

  return parts.join(' | ');
}

const ToolsManagement = () => {
  const { toast } = useToast();

  const [openOperationalLauncher, setOpenOperationalLauncher] = useState(false);
  const [openEmailTool, setOpenEmailTool] = useState(false);
  const [openSlotLauncher, setOpenSlotLauncher] = useState(false);
  const [openBehavioralTool, setOpenBehavioralTool] = useState(false);
  const [openPresentationTool, setOpenPresentationTool] = useState(false);
  const [openOneOnOneTool, setOpenOneOnOneTool] = useState(false);
  const [openAiEvaluationTool, setOpenAiEvaluationTool] = useState(false);
  const [openPublishScoresTool, setOpenPublishScoresTool] = useState(false);

  const [setAInput, setSetAInput] = useState('');
  const [setBInput, setSetBInput] = useState('');

  const [slotDate, setSlotDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructorNumber, setInstructorNumber] = useState('1');
  const [syncToForm, setSyncToForm] = useState(true);
  const [resetFormResponses, setResetFormResponses] = useState(false);
  const [studentAuthorizationEmails, setStudentAuthorizationEmails] = useState('');
  const [isReleasingSlots, setIsReleasingSlots] = useState(false);
  const [behavioralInstructors, setBehavioralInstructors] = useState<InstructorOption[]>([]);

  const [behavioralAvailabilities, setBehavioralAvailabilities] = useState<SlotAvailability[]>([]);
  const [presentationAvailabilities, setPresentationAvailabilities] = useState<SlotAvailability[]>([]);
  const [selectedBehavioralAvailability, setSelectedBehavioralAvailability] = useState<string>('');
  const [selectedPresentationAvailability, setSelectedPresentationAvailability] = useState<string>('');
  const [slotsConfig, setSlotsConfigState] = useState<{ editingEnabled?: boolean }>({ editingEnabled: false });

  const SUPER_ADMINS = ['sanjay_k@study.iitm.ac.in', 'jeyalakshmi_a@study.iitm.ac.in'];
  const isSuperAdmin = !!auth.currentUser && SUPER_ADMINS.includes(String(auth.currentUser.email || '').trim().toLowerCase());
  const [presentationSlotDate, setPresentationSlotDate] = useState('');
  const [presentationStartTime, setPresentationStartTime] = useState('');
  const [presentationEndTime, setPresentationEndTime] = useState('');
  const [presentationInstructorNumber, setPresentationInstructorNumber] = useState('1');
  const [presentationSyncToForm, setPresentationSyncToForm] = useState(true);
  const [presentationResetFormResponses, setPresentationResetFormResponses] = useState(false);
  const [presentationStudentAuthorizationEmails, setPresentationStudentAuthorizationEmails] = useState('');
  const [isReleasingPresentationSlots, setIsReleasingPresentationSlots] = useState(false);
  const [presentationInstructors, setPresentationInstructors] = useState<InstructorOption[]>([]);

  const [oneOnOneSlotDate, setOneOnOneSlotDate] = useState('');
  const [oneOnOneStartTime, setOneOnOneStartTime] = useState('');
  const [oneOnOneEndTime, setOneOnOneEndTime] = useState('');
  const [oneOnOneInstructorNumber, setOneOnOneInstructorNumber] = useState('');
  const [oneOnOneDomain, setOneOnOneDomain] = useState('Data Science');
  const [oneOnOneDurationMinutes, setOneOnOneDurationMinutes] = useState<number>(ONE_ON_ONE_SLOT_DURATION_MINUTES);
  const [oneOnOneSyncToForm, setOneOnOneSyncToForm] = useState(true);
  const [isReleasingOneOnOneSlots, setIsReleasingOneOnOneSlots] = useState(false);
  const [oneOnOneInstructors, setOneOnOneInstructors] = useState<InstructorOption[]>([]);

  const [aiSheetId, setAiSheetId] = useState(import.meta.env.VITE_AI_EVALUATION_SHEET_ID || '');
  const [aiSheetIdEditable, setAiSheetIdEditable] = useState(false);
  const [aiMenuOptions, setAiMenuOptions] = useState<AiMenuOption[]>(DEFAULT_AI_MENU_OPTIONS);
  const [selectedAiOptionKey, setSelectedAiOptionKey] = useState(DEFAULT_AI_MENU_OPTIONS[0]?.key || '');
  const [aiSelectedRow, setAiSelectedRow] = useState('2');
  const [aiRangeStartRow, setAiRangeStartRow] = useState('2');
  const [aiRangeEndRow, setAiRangeEndRow] = useState('20');
  const [aiStudents, setAiStudents] = useState<AiStudent[]>([]);
  const [isLoadingAiMenu, setIsLoadingAiMenu] = useState(false);
  const [isLoadingAiStudents, setIsLoadingAiStudents] = useState(false);
  const [isRunningAiAction, setIsRunningAiAction] = useState(false);

  const [publishScoreActivities, setPublishScoreActivities] = useState<PublishScoreActivity[]>([]);
  const [selectedPublishScoreActivityKey, setSelectedPublishScoreActivityKey] = useState('');
  const [publishScoresText, setPublishScoresText] = useState('');
  const [isLoadingPublishScoreActivities, setIsLoadingPublishScoreActivities] = useState(false);
  const [isPublishingScores, setIsPublishingScores] = useState(false);

  const [releaseHistory, setReleaseHistory] = useState<ReleaseHistoryEntry[]>([]);

  useEffect(() => {
    const loadInstructors = async () => {
      try {
        const [ba, presentation, oneOnOne] = await Promise.all([
          getBehavioralInstructors(),
          getPresentationInstructors(),
          getOneOnOneInstructors(),
        ]);

        setBehavioralInstructors(ba);
        setPresentationInstructors(presentation);
        setOneOnOneInstructors(oneOnOne);

        if (ba.length > 0 && !ba.some((item) => item.number === instructorNumber)) {
          setInstructorNumber(ba[0].number);
        }

        if (
          presentation.length > 0 &&
          !presentation.some((item) => item.number === presentationInstructorNumber)
        ) {
          setPresentationInstructorNumber(presentation[0].number);
        }

        if (oneOnOne.length > 0 && !oneOnOne.some((item) => item.number === oneOnOneInstructorNumber)) {
          setOneOnOneInstructorNumber(oneOnOne[0].number);
        }
      } catch (error) {
        console.error(error);
        toast({
          title: 'Could not load instructors',
          description: error instanceof Error ? error.message : 'Please verify Apps Script deployment.',
          variant: 'destructive',
        });
      }
    };

    const loadAvailabilities = async () => {
      try {
        const [baList, prList] = await Promise.all([
          listSlotsAvailability('behavioral'),
          listSlotsAvailability('presentation'),
        ]);
        setBehavioralAvailabilities(baList || []);
        setPresentationAvailabilities(prList || []);
        // load config
        try {
          const cfg = await getSlotsConfig();
          setSlotsConfigState(cfg || { editingEnabled: false });
        } catch (_e) {
          // ignore
        }
      } catch (error) {
        console.error('Could not load availabilities', error);
      }
    };

    loadInstructors();
    loadAvailabilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPresentationAvailability = (id: string) => {
    setSelectedPresentationAvailability(id);
    if (!id) return;
    const a = presentationAvailabilities.find((it) => it.id === id);
    if (!a) return;
    setPresentationSlotDate(a.date || '');
    setPresentationStartTime(a.startTime || '');
    setPresentationEndTime(a.endTime || '');
    setPresentationInstructorNumber(a.instructorNumber || presentationInstructorNumber);
  };

  const handleSelectBehavioralAvailability = (id: string) => {
    setSelectedBehavioralAvailability(id);
    if (!id) return;
    const a = behavioralAvailabilities.find((it) => it.id === id);
    if (!a) return;
    setSlotDate(a.date || '');
    setStartTime(a.startTime || '');
    setEndTime(a.endTime || '');
    setInstructorNumber(a.instructorNumber || instructorNumber);
  };

  const selectedPresentationAvailabilityRow = presentationAvailabilities.find((item) => item.id === selectedPresentationAvailability);
  const selectedBehavioralAvailabilityRow = behavioralAvailabilities.find((item) => item.id === selectedBehavioralAvailability);

  useEffect(() => {
    if (openAiEvaluationTool) {
      loadAiMenuOptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAiEvaluationTool]);

  useEffect(() => {
    if (openPublishScoresTool) {
      loadPublishScoreActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPublishScoresTool]);

  const result = useMemo(() => {
    const setAEmails = extractEmails(setAInput);
    const setBEmails = extractEmails(setBInput);

    const setA = new Set(setAEmails);
    const setB = new Set(setBEmails);

    const onlyA = setAEmails.filter((email) => !setB.has(email));
    const onlyB = setBEmails.filter((email) => !setA.has(email));
    const common = setAEmails.filter((email) => setB.has(email));

    return {
      setAEmails,
      setBEmails,
      onlyA,
      onlyB,
      common,
    };
  }, [setAInput, setBInput]);

  const timeOptions = useMemo(() => buildThirtyMinuteOptions(), []);
  const selectedAiOption = useMemo(
    () => aiMenuOptions.find((option) => option.key === selectedAiOptionKey) || null,
    [aiMenuOptions, selectedAiOptionKey],
  );

  const clearOperationalTool = () => {
    setSetAInput('');
    setSetBInput('');
  };

  const clearSlotBooking = () => {
    setSlotDate('');
    setStartTime('');
    setEndTime('');
    setInstructorNumber(behavioralInstructors[0]?.number || '1');
    setSyncToForm(true);
    setResetFormResponses(false);
    setStudentAuthorizationEmails('');
  };

  const clearPresentationSlotBooking = () => {
    setPresentationSlotDate('');
    setPresentationStartTime('');
    setPresentationEndTime('');
    setPresentationInstructorNumber(presentationInstructors[0]?.number || '1');
    setPresentationSyncToForm(true);
    setPresentationResetFormResponses(false);
    setPresentationStudentAuthorizationEmails('');
  };

  const clearOneOnOneSlotBooking = () => {
    setOneOnOneSlotDate('');
    setOneOnOneStartTime('');
    setOneOnOneEndTime('');
    setOneOnOneInstructorNumber(oneOnOneInstructors[0]?.number || '');
    setOneOnOneDomain('Data Science');
    setOneOnOneDurationMinutes(ONE_ON_ONE_SLOT_DURATION_MINUTES);
    setOneOnOneSyncToForm(true);
  };

  const clearAiTool = () => {
    setSelectedAiOptionKey(aiMenuOptions[0]?.key || '');
    setAiSelectedRow('2');
    setAiRangeStartRow('2');
    setAiRangeEndRow('20');
    setAiSheetIdEditable(false);
    setAiStudents([]);
  };

  const clearPublishScoresTool = () => {
    setSelectedPublishScoreActivityKey(publishScoreActivities[0]?.key || '');
    setPublishScoresText('');
  };

  const copyList = async (label: string, items: string[]) => {
    try {
      await navigator.clipboard.writeText(toMultiline(items));
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard (${items.length} emails).`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const addHistory = (entry: Omit<ReleaseHistoryEntry, 'id' | 'time'>) => {
    setReleaseHistory((prev) => [
      {
        id: crypto.randomUUID(),
        time: new Date().toLocaleString(),
        ...entry,
      },
      ...prev,
    ]);
  };

  const loadAiMenuOptions = async () => {
    setIsLoadingAiMenu(true);
    try {
      const options = await getAiMenuOptions();
      if (options.length > 0) {
        setAiMenuOptions(options);
        if (!options.some((option) => option.key === selectedAiOptionKey)) {
          setSelectedAiOptionKey(options[0].key);
        }
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load AI menu options',
        description: error instanceof Error ? error.message : 'Using local fallback menu list.',
        variant: 'destructive',
      });
      setAiMenuOptions(DEFAULT_AI_MENU_OPTIONS);
      if (!DEFAULT_AI_MENU_OPTIONS.some((option) => option.key === selectedAiOptionKey)) {
        setSelectedAiOptionKey(DEFAULT_AI_MENU_OPTIONS[0].key);
      }
    } finally {
      setIsLoadingAiMenu(false);
    }
  };

  const loadPublishScoreActivities = async () => {
    if (publishScoreActivities.length > 0) {
      return;
    }

    setIsLoadingPublishScoreActivities(true);
    try {
      const activities = await getPublishScoreActivities();
      setPublishScoreActivities(activities);
      if (activities.length > 0 && !activities.some((activity) => activity.key === selectedPublishScoreActivityKey)) {
        setSelectedPublishScoreActivityKey(activities[0].key);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load publish activities',
        description: error instanceof Error ? error.message : 'Please verify Apps Script deployment.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPublishScoreActivities(false);
    }
  };

  const handlePublishScores = async () => {
    if (!selectedPublishScoreActivityKey) {
      toast({
        title: 'Missing activity',
        description: 'Choose the activity before publishing scores.',
        variant: 'destructive',
      });
      return;
    }

    if (!publishScoresText.trim()) {
      toast({
        title: 'Missing rows',
        description: 'Paste the email and score rows before publishing.',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishingScores(true);
    try {
      const response = await publishScoresToSheet({
        activityKey: selectedPublishScoreActivityKey,
        rowsText: publishScoresText,
      });

      const activity = publishScoreActivities.find((item) => item.key === selectedPublishScoreActivityKey);
      toast({
        title: 'Scores published',
        description: `${response.rowsWritten} row(s) published to ${activity?.label || response.activity}. Duplicate email/score rows were cleaned automatically.`,
      });

      setPublishScoresText('');
    } catch (error) {
      console.error(error);
      toast({
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'Could not publish scores.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishingScores(false);
    }
  };

  const selectedPublishScoreActivity = useMemo(
    () => publishScoreActivities.find((item) => item.key === selectedPublishScoreActivityKey) || null,
    [publishScoreActivities, selectedPublishScoreActivityKey],
  );

  const publishScoresPlaceholder = selectedPublishScoreActivity
    ? selectedPublishScoreActivity.width === 2
      ? 'student@example.com\t20'
      : 'student@example.com\t32\t14\t14\t14'
    : 'student@example.com\t20';

  const handleAiFetchStudents = async () => {
    if (!aiSheetId.trim()) {
      toast({
        title: 'Missing Sheet ID',
        description: 'Set AI Evaluation Sheet ID before fetching students.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingAiStudents(true);
    try {
      const students = await getAiStudents(aiSheetId.trim());
      setAiStudents(students);
      toast({
        title: 'Students loaded',
        description: `${students.length} rows fetched from Evaluation sheet.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Failed to fetch students',
        description: error instanceof Error ? error.message : 'Could not fetch student rows.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAiStudents(false);
    }
  };

  const handleRunAiAction = async () => {
    if (!selectedAiOption) {
      toast({
        title: 'No option selected',
        description: 'Choose an AI menu option to continue.',
        variant: 'destructive',
      });
      return;
    }

    if (!aiSheetId.trim()) {
      toast({
        title: 'Missing Sheet ID',
        description: 'Set AI Evaluation Sheet ID before running any action.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedAiOption.requiresRow && !Number.isInteger(Number(aiSelectedRow))) {
      toast({
        title: 'Invalid row',
        description: 'Selected-student action requires a valid row number.',
        variant: 'destructive',
      });
      return;
    }

    if (
      selectedAiOption.requiresRange &&
      (!Number.isInteger(Number(aiRangeStartRow)) ||
        !Number.isInteger(Number(aiRangeEndRow)) ||
        Number(aiRangeEndRow) < Number(aiRangeStartRow))
    ) {
      toast({
        title: 'Invalid range',
        description: 'Range action requires valid M and N values.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunningAiAction(true);
    try {
      const result = await runAiMenuAction({
        sheetId: aiSheetId.trim(),
        optionKey: selectedAiOption.key,
        row: selectedAiOption.requiresRow ? Number(aiSelectedRow) : undefined,
        rowStart: selectedAiOption.requiresRange ? Number(aiRangeStartRow) : undefined,
        rowEnd: selectedAiOption.requiresRange ? Number(aiRangeEndRow) : undefined,
      });

      toast({
        title: selectedAiOption.label,
        description: result.message || `Queued: ${result.queued}, Skipped: ${result.skipped}, Failed: ${result.failed}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      await handleAiFetchStudents();
    } catch (error) {
      console.error(error);
      toast({
        title: 'AI action failed',
        description: error instanceof Error ? error.message : 'Could not run selected menu action.',
        variant: 'destructive',
      });
    } finally {
      setIsRunningAiAction(false);
    }
  };

  const handleReleaseSlots = async () => {
    if (!slotDate || !startTime || !endTime || !instructorNumber) {
      toast({
        title: 'Missing details',
        description: 'Please fill all slot fields before releasing.',
        variant: 'destructive',
      });
      return;
    }

    if (endTime <= startTime) {
      toast({
        title: 'Invalid timing',
        description: 'End time should be after start time.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      date: toDdMmYyyy(slotDate),
      startTime: toAmPmFrom24Hour(startTime),
      endTime: toAmPmFrom24Hour(endTime),
      durationMinutes: BA_SLOT_DURATION_MINUTES,
      instructorNumber: instructorNumber.trim(),
      syncToForm,
      resetFormResponses,
      studentAuthorizationEmails: studentAuthorizationEmails.trim() || undefined,
    };

    setIsReleasingSlots(true);
    try {
      const response = await releaseBehaviouralSlots(payload);
      const authSummary = response.authorizationColumn
        ? ` Auth column ${response.authorizationColumn}: ${response.addedStudents ?? response.validStudents ?? 0} emails added.`
        : '';
      const resetSummary = response.resetFormResponses ? ' Form responses reset for reattempts.' : '';

      toast({
        title: 'Slots released',
        description: `${response.slotsCreated} slots created${response.syncToForm ? ' and synced to form.' : '.'}${resetSummary}${authSummary}`,
      });

      addHistory({
        tool: 'Behavioural',
        payload,
        status: 'SUCCESS',
        message: `${response.slotsCreated} slots created`,
        result: response,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Could not release slots.';
      const resolvedMessage = /unknown action|unsupported action/i.test(message)
        ? 'Unknown action from Apps Script. Deploy the behavioural web app with appscripts/behavioral/Api.gs and set VITE_BEHAVIORAL_APPS_SCRIPT_WEB_APP_URL.'
        : message;

      toast({
        title: 'Release failed',
        description: resolvedMessage,
        variant: 'destructive',
      });

      addHistory({
        tool: 'Behavioural',
        payload,
        status: 'FAILED',
        message: resolvedMessage,
      });
    } finally {
      setIsReleasingSlots(false);
    }
  };

  const handleReleasePresentationSlots = async () => {
    if (!presentationSlotDate || !presentationStartTime || !presentationEndTime || !presentationInstructorNumber) {
      toast({
        title: 'Missing details',
        description: 'Please fill all slot fields before releasing.',
        variant: 'destructive',
      });
      return;
    }

    if (presentationEndTime <= presentationStartTime) {
      toast({
        title: 'Invalid timing',
        description: 'End time should be after start time.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      date: toDdMmYyyy(presentationSlotDate),
      startTime: toAmPmFrom24Hour(presentationStartTime),
      endTime: toAmPmFrom24Hour(presentationEndTime),
      durationMinutes: PRESENTATION_SLOT_DURATION_MINUTES,
      instructorNumber: presentationInstructorNumber.trim(),
      syncToForm: presentationSyncToForm,
      resetFormResponses: presentationResetFormResponses,
      studentAuthorizationEmails: presentationStudentAuthorizationEmails.trim() || undefined,
    };

    setIsReleasingPresentationSlots(true);
    try {
      const response = await releasePresentationSlots(payload);
      const authSummary = response.authorizationColumn
        ? ` Auth column ${response.authorizationColumn}: ${response.addedStudents ?? response.validStudents ?? 0} emails added.`
        : '';
      const resetSummary = response.resetFormResponses ? ' Form responses reset for reattempts.' : '';

      toast({
        title: 'Presentation slots released',
        description: `${response.slotsCreated} slots created${response.syncToForm ? ' and synced to form.' : '.'}${resetSummary}${authSummary}`,
      });

      addHistory({
        tool: 'Presentation',
        payload,
        status: 'SUCCESS',
        message: `${response.slotsCreated} slots created`,
        result: response,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Could not release slots.';
      const resolvedMessage = /unknown action|unsupported action/i.test(message)
        ? 'Unknown action from Apps Script. Deploy the presentation web app with appscripts/presentation/Api.gs and set VITE_PRESENTATION_APPS_SCRIPT_WEB_APP_URL.'
        : message;

      toast({
        title: 'Release failed',
        description: resolvedMessage,
        variant: 'destructive',
      });

      addHistory({
        tool: 'Presentation',
        payload,
        status: 'FAILED',
        message: resolvedMessage,
      });
    } finally {
      setIsReleasingPresentationSlots(false);
    }
  };

  const handleReleaseOneOnOneSlots = async () => {
    if (!oneOnOneSlotDate || !oneOnOneStartTime || !oneOnOneEndTime || !oneOnOneInstructorNumber || !oneOnOneDomain) {
      toast({
        title: 'Missing details',
        description: 'Please fill all slot fields before releasing.',
        variant: 'destructive',
      });
      return;
    }

    if (oneOnOneEndTime <= oneOnOneStartTime) {
      toast({
        title: 'Invalid timing',
        description: 'End time should be after start time.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      date: oneOnOneSlotDate,
      startTime: oneOnOneStartTime,
      endTime: oneOnOneEndTime,
      durationMinutes: oneOnOneDurationMinutes,
      instructorNumber: oneOnOneInstructorNumber,
      domain: oneOnOneDomain,
      syncToForm: oneOnOneSyncToForm,
    };

    setIsReleasingOneOnOneSlots(true);
    try {
      const response = await releaseOneOnOneSlots(payload);
      toast({
        title: '1on1 slots released',
        description: `${response.slotsCreated} slots created${response.syncToForm ? ' and synced to form.' : '.'}`,
      });

      addHistory({
        tool: '1on1 Session',
        payload: {
          date: oneOnOneSlotDate,
          startTime: toAmPmFrom24Hour(oneOnOneStartTime),
          endTime: toAmPmFrom24Hour(oneOnOneEndTime),
          durationMinutes: oneOnOneDurationMinutes,
          instructorNumber: oneOnOneInstructorNumber,
          syncToForm: oneOnOneSyncToForm,
          resetFormResponses: false,
        },
        status: 'SUCCESS',
        message: `${response.slotsCreated} slots created (${oneOnOneDomain})`,
        result: response,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Could not release slots.';
      const resolvedMessage = /unknown action|unsupported action/i.test(message)
        ? 'Unknown action from Apps Script. Deploy the 1on1 web app with appscripts/1on1/Api.gs and set VITE_ONE_ON_ONE_APPS_SCRIPT_WEB_APP_URL.'
        : message;

      toast({
        title: 'Release failed',
        description: resolvedMessage,
        variant: 'destructive',
      });

      addHistory({
        tool: '1on1 Session',
        payload: {
          date: oneOnOneSlotDate,
          startTime: toAmPmFrom24Hour(oneOnOneStartTime),
          endTime: toAmPmFrom24Hour(oneOnOneEndTime),
          durationMinutes: oneOnOneDurationMinutes,
          instructorNumber: oneOnOneInstructorNumber,
          syncToForm: oneOnOneSyncToForm,
          resetFormResponses: false,
        },
        status: 'FAILED',
        message: resolvedMessage,
      });
    } finally {
      setIsReleasingOneOnOneSlots(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          Tools
        </h2>
        <p className="text-muted-foreground">Choose a tool category and launch utilities in popups.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Operational Tools</CardTitle>
            <CardDescription>Utility tools for daily admin operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpenOperationalLauncher(true)}>Open Operational Tools</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slot Booking Tool</CardTitle>
            <CardDescription>Release slots for different assessments from the website.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpenSlotLauncher(true)}>Open Slot Booking Tools</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Evaluation Tool</CardTitle>
            <CardDescription>Run all AI menu actions from web app, without using sheet menus.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpenAiEvaluationTool(true)}>Open AI Evaluation Tool</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publish Scores</CardTitle>
            <CardDescription>Publish tab-separated score rows into the scores sheet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setOpenPublishScoresTool(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Open Publish Scores
            </Button>
          </CardContent>
        </Card>

      </div>

      <Card>
        <CardHeader>
          <CardTitle>Release History</CardTitle>
          <CardDescription>Recent slot release attempts with payload and results.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {releaseHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No release history yet.</p>
          ) : (
            releaseHistory.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{entry.tool} • {entry.time}</p>
                  <Badge variant={entry.status === 'SUCCESS' ? 'default' : 'destructive'}>{entry.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{entry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.payload.date} | {entry.payload.startTime} - {entry.payload.endTime} | {entry.payload.durationMinutes}m | {getInstructorNameByNumber(
                    entry.payload.instructorNumber,
                    entry.tool === 'Presentation'
                      ? presentationInstructors
                      : entry.tool === '1on1 Session'
                        ? oneOnOneInstructors
                        : behavioralInstructors,
                  )}
                </p>
                {entry.payload.studentAuthorizationEmails && (
                  <p className="text-xs text-muted-foreground">
                    Authorization emails provided for this release.
                  </p>
                )}
                {entry.result && entry.result.authorizationColumn && (
                  <p className="text-xs text-muted-foreground">
                    Column used: {entry.result.authorizationColumn}, Added: {entry.result.addedStudents ?? entry.result.validStudents ?? 0}
                  </p>
                )}
                {entry.payload.resetFormResponses && (
                  <p className="text-xs text-muted-foreground">Form responses were reset for reattempts.</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={openOperationalLauncher} onOpenChange={setOpenOperationalLauncher}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Operational Tools</DialogTitle>
            <DialogDescription>Select a tool to open.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              className="w-full justify-start"
              onClick={() => {
                setOpenOperationalLauncher(false);
                setOpenEmailTool(true);
              }}
            >
              Emails Comparison Tool
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openSlotLauncher} onOpenChange={setOpenSlotLauncher}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slot Booking Tools</DialogTitle>
            <DialogDescription>Select a slot module.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              className="w-full justify-start"
              onClick={() => {
                setOpenSlotLauncher(false);
                setOpenBehavioralTool(true);
              }}
            >
              Behavioral
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => {
                setOpenSlotLauncher(false);
                setOpenPresentationTool(true);
              }}
            >
              Presentation
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => {
                setOpenSlotLauncher(false);
                setOpenOneOnOneTool(true);
              }}
            >
              1on1 Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openOneOnOneTool} onOpenChange={setOpenOneOnOneTool}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>1on1 Slot Booking Tool</DialogTitle>
            <DialogDescription>
              Create 1on1 slots using date, time range, instructor, and domain.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={oneOnOneSlotDate}
                onChange={(e) => setOneOnOneSlotDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Time</label>
              <Select value={oneOnOneStartTime} onValueChange={setOneOnOneStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={`oneonone-start-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Time</label>
              <Select value={oneOnOneEndTime} onValueChange={setOneOnOneEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={`oneonone-end-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Slot Duration (mins)</label>
              <Select
                value={String(oneOnOneDurationMinutes)}
                onValueChange={(value) => setOneOnOneDurationMinutes(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {ONE_ON_ONE_SLOT_DURATION_OPTIONS.map((duration) => (
                    <SelectItem key={`oneonone-duration-${duration}`} value={String(duration)}>
                      {duration} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructor</label>
              <Select value={oneOnOneInstructorNumber} onValueChange={setOneOnOneInstructorNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  {oneOnOneInstructors.map((instructor) => (
                    <SelectItem key={`oneonone-instructor-${instructor.number}`} value={instructor.number}>
                      {instructor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Domain</label>
              <Select value={oneOnOneDomain} onValueChange={setOneOnOneDomain}>
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Data Science">Data Science</SelectItem>
                  <SelectItem value="Programming">Programming</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sync To Form</label>
              <Button
                type="button"
                variant={oneOnOneSyncToForm ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setOneOnOneSyncToForm((prev) => !prev)}
              >
                {oneOnOneSyncToForm ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Action will run as: {auth.currentUser?.email || 'Unknown Admin'}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearOneOnOneSlotBooking} disabled={isReleasingOneOnOneSlots}>
              Reset
            </Button>
            <Button onClick={handleReleaseOneOnOneSlots} disabled={isReleasingOneOnOneSlots}>
              {isReleasingOneOnOneSlots ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Release 1on1 Slots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openAiEvaluationTool} onOpenChange={setOpenAiEvaluationTool}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>AI Evaluation Manager</DialogTitle>
            <DialogDescription>
              Menu options below are kept same as Code.gs and executed through Apps Script API.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sheet ID</label>
              <div className="flex gap-2">
                <Input
                  value={aiSheetId}
                  onChange={(e) => setAiSheetId(e.target.value)}
                  placeholder="Google Sheet ID"
                  readOnly={!aiSheetIdEditable}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAiSheetIdEditable((prev) => !prev)}
                >
                  {aiSheetIdEditable ? 'Lock' : 'Edit'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Menu Option</label>
              <Select value={selectedAiOptionKey} onValueChange={setSelectedAiOptionKey}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAiMenu ? 'Loading options...' : 'Select menu option'} />
                </SelectTrigger>
                <SelectContent>
                  {aiMenuOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedAiOption?.requiresRow && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Row</label>
                <Input
                  type="number"
                  min={2}
                  value={aiSelectedRow}
                  onChange={(e) => setAiSelectedRow(e.target.value)}
                  placeholder="Example: 2"
                />
              </div>
            </div>
          )}

          {selectedAiOption?.requiresRange && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">M (Start Row)</label>
                <Input
                  type="number"
                  min={2}
                  value={aiRangeStartRow}
                  onChange={(e) => setAiRangeStartRow(e.target.value)}
                  placeholder="Example: 2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">N (End Row)</label>
                <Input
                  type="number"
                  min={2}
                  value={aiRangeEndRow}
                  onChange={(e) => setAiRangeEndRow(e.target.value)}
                  placeholder="Example: 20"
                />
              </div>
            </div>
          )}

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Action will run as: {auth.currentUser?.email || 'Unknown Admin'}
          </div>

          <div className="max-h-48 overflow-auto rounded-md border p-2 text-sm space-y-1">
            {aiStudents.length === 0 ? (
              <p className="text-muted-foreground">No students loaded yet.</p>
            ) : (
              aiStudents.map((student) => (
                <div key={`ai-student-${student.sheetRow}`} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                  <p>
                    Row {student.sheetRow}: {student.name || 'Unknown'} ({student.email || 'No email'})
                  </p>
                  <Badge variant={student.status.trim().toLowerCase() === 'evaluated' ? 'default' : 'secondary'}>
                    {student.status || 'Not Evaluated'}
                  </Badge>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearAiTool} disabled={isRunningAiAction || isLoadingAiStudents}>
              Reset
            </Button>
            <Button variant="outline" onClick={handleAiFetchStudents} disabled={isLoadingAiStudents || isRunningAiAction}>
              {isLoadingAiStudents ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Refresh Students
            </Button>
            <Button onClick={handleRunAiAction} disabled={isRunningAiAction || isLoadingAiMenu}>
              {isRunningAiAction ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Run Selected Option
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openPublishScoresTool}
        onOpenChange={(open) => {
          setOpenPublishScoresTool(open);
          if (!open) {
            clearPublishScoresTool();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Publish Scores</DialogTitle>
            <DialogDescription>
              Select the activity, then paste one row per student with the email first and the scores separated by tabs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Activity</label>
              <Select
                value={selectedPublishScoreActivityKey}
                onValueChange={setSelectedPublishScoreActivityKey}
                disabled={isLoadingPublishScoreActivities}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingPublishScoreActivities ? 'Loading activities...' : 'Select activity'} />
                </SelectTrigger>
                <SelectContent>
                  {publishScoreActivities.map((activity) => (
                    <SelectItem key={activity.key} value={activity.key}>
                      {activity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedPublishScoreActivity
                  ? `Expected columns per row: ${selectedPublishScoreActivity.width}. For ${selectedPublishScoreActivity.label}, paste email plus ${selectedPublishScoreActivity.width - 1} score value(s).`
                  : 'Choose an activity to see the expected row shape.'}
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Rows</label>
              <Textarea
                rows={12}
                value={publishScoresText}
                onChange={(e) => setPublishScoresText(e.target.value)}
                placeholder={publishScoresPlaceholder}
                spellCheck={false}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use one row per student. Keep the email in the first cell and separate the scores with tab characters only.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Action will run as: {auth.currentUser?.email || 'Unknown Admin'}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearPublishScoresTool} disabled={isPublishingScores}>
              Reset
            </Button>
            <Button onClick={handlePublishScores} disabled={isPublishingScores || isLoadingPublishScoreActivities}>
              {isPublishingScores ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Publish Scores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openPresentationTool} onOpenChange={setOpenPresentationTool}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Presentation Slot Booking Tool</DialogTitle>
            <DialogDescription>
              Enter slot details and release Presentation slots from here.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saved Availability</label>
              <Select value={selectedPresentationAvailability} onValueChange={handleSelectPresentationAvailability}>
                <SelectTrigger>
                  <SelectValue placeholder={presentationAvailabilities.length > 0 ? 'Select availability' : 'No saved availability'} />
                </SelectTrigger>
                <SelectContent>
                  {presentationAvailabilities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatAvailabilityLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {selectedPresentationAvailabilityRow ? (
                  <>
                    <div className="font-medium text-foreground">Selected availability</div>
                    <div>{formatAvailabilityLabel(selectedPresentationAvailabilityRow)}</div>
                    <div>ID: {selectedPresentationAvailabilityRow.id}</div>
                    <div>Created by: {selectedPresentationAvailabilityRow.createdBy || '—'}</div>
                  </>
                ) : (
                  'Select a saved availability to populate the release fields.'
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={presentationSlotDate}
                onChange={(e) => setPresentationSlotDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Time</label>
              <Select value={presentationStartTime} onValueChange={setPresentationStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={`presentation-start-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Time</label>
              <Select value={presentationEndTime} onValueChange={setPresentationEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={`presentation-end-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Slot Duration (mins)</label>
              <Input value={String(PRESENTATION_SLOT_DURATION_MINUTES)} disabled />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructor</label>
              <Select value={presentationInstructorNumber} onValueChange={setPresentationInstructorNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  {presentationInstructors.map((instructor) => (
                    <SelectItem key={`presentation-instructor-${instructor.number}`} value={instructor.number}>
                      {instructor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sync To Form</label>
              <Button
                type="button"
                variant={presentationSyncToForm ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setPresentationSyncToForm((prev) => !prev)}
              >
                {presentationSyncToForm ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reset Form Responses</label>
              <Button
                type="button"
                variant={presentationResetFormResponses ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setPresentationResetFormResponses((prev) => !prev)}
              >
                {presentationResetFormResponses ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Student Authorization Emails (Optional)</label>
            <Textarea
              rows={4}
              placeholder="Paste student email IDs separated by comma, space, or new line"
              value={presentationStudentAuthorizationEmails}
              onChange={(e) => setPresentationStudentAuthorizationEmails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If provided, emails are added to the next column in Students sheet and set as active authorization column.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Action will run as: {auth.currentUser?.email || 'Unknown Admin'}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearPresentationSlotBooking} disabled={isReleasingPresentationSlots}>
              Reset
            </Button>
            <Button onClick={handleReleasePresentationSlots} disabled={isReleasingPresentationSlots}>
              {isReleasingPresentationSlots ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Release Presentation Slots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEmailTool} onOpenChange={setOpenEmailTool}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Emails Comparison Tool</DialogTitle>
            <DialogDescription>Find A-only, B-only, and common emails.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Set A Emails</p>
              <Textarea
                value={setAInput}
                onChange={(e) => setSetAInput(e.target.value)}
                rows={10}
                placeholder="Paste emails from first source."
              />
              <p className="text-xs text-muted-foreground">Parsed unique emails: {result.setAEmails.length}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Set B Emails</p>
              <Textarea
                value={setBInput}
                onChange={(e) => setSetBInput(e.target.value)}
                rows={10}
                placeholder="Paste emails from second source."
              />
              <p className="text-xs text-muted-foreground">Parsed unique emails: {result.setBEmails.length}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">A but not in B</CardTitle>
                <Badge variant="secondary">{result.onlyA.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyList('A but not in B', result.onlyA)}
                  disabled={result.onlyA.length === 0}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Textarea value={toMultiline(result.onlyA)} readOnly rows={8} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">B but not in A</CardTitle>
                <Badge variant="secondary">{result.onlyB.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyList('B but not in A', result.onlyB)}
                  disabled={result.onlyB.length === 0}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Textarea value={toMultiline(result.onlyB)} readOnly rows={8} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Common in both</CardTitle>
                <Badge>{result.common.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyList('Common in both', result.common)}
                  disabled={result.common.length === 0}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Textarea value={toMultiline(result.common)} readOnly rows={8} />
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearOperationalTool}>Clear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openBehavioralTool} onOpenChange={setOpenBehavioralTool}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Behavioral Slot Booking Tool</DialogTitle>
            <DialogDescription>
              Enter slot details, optionally provide authorization column, and release slots.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saved Availability</label>
              <Select value={selectedBehavioralAvailability} onValueChange={handleSelectBehavioralAvailability}>
                <SelectTrigger>
                  <SelectValue placeholder={behavioralAvailabilities.length > 0 ? 'Select availability' : 'No saved availability'} />
                </SelectTrigger>
                <SelectContent>
                  {behavioralAvailabilities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatAvailabilityLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {selectedBehavioralAvailabilityRow ? (
                  <>
                    <div className="font-medium text-foreground">Selected availability</div>
                    <div>{formatAvailabilityLabel(selectedBehavioralAvailabilityRow)}</div>
                    <div>ID: {selectedBehavioralAvailabilityRow.id}</div>
                    <div>Created by: {selectedBehavioralAvailabilityRow.createdBy || '—'}</div>
                  </>
                ) : (
                  'Select a saved availability to populate the release fields.'
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Time</label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={`start-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Time</label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((option) => (
                    <SelectItem key={`end-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Slot Duration (mins)</label>
              <Input value={String(BA_SLOT_DURATION_MINUTES)} disabled />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructor</label>
              <Select value={instructorNumber} onValueChange={setInstructorNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  {behavioralInstructors.map((instructor) => (
                    <SelectItem key={instructor.number} value={instructor.number}>
                      {instructor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sync To Form</label>
              <Button
                type="button"
                variant={syncToForm ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setSyncToForm((prev) => !prev)}
              >
                {syncToForm ? 'Enabled' : 'Disabled'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reset Form Responses</label>
              <Button
                type="button"
                variant={resetFormResponses ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setResetFormResponses((prev) => !prev)}
              >
                {resetFormResponses ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Student Authorization Emails (Optional)</label>
            <Textarea
              rows={4}
              placeholder="Paste student email IDs separated by comma, space, or new line"
              value={studentAuthorizationEmails}
              onChange={(e) => setStudentAuthorizationEmails(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If provided, emails are added to the next column in Students sheet and set as active authorization column.
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Action will run as: {auth.currentUser?.email || 'Unknown Admin'}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearSlotBooking} disabled={isReleasingSlots}>Reset</Button>
            <Button onClick={handleReleaseSlots} disabled={isReleasingSlots}>
              {isReleasingSlots ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Release Behavioral Slots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ToolsManagement;

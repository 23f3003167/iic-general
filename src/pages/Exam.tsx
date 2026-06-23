import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getExams, getPreviousSubmissions, startExamAttempt, submitExamAttempt } from '@/lib/examsService';
import type { ExamAttempt, ExamConfig, ExamQuestion } from '@/types';
import { AlertCircle, Clock3, Loader2, ShieldAlert } from 'lucide-react';

type Screen = 'loading' | 'waiting' | 'ready' | 'running' | 'submitted';

function formatDateTime(value?: string): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTotalWeight(questions: ExamQuestion[]): number {
  return questions.reduce((total, question) => total + (Number(question.weight) || 1), 0);
}

function getEffectiveDuration(exam: ExamConfig): number {
  if (exam.durationMinutes && exam.durationMinutes > 0) {
    return exam.durationMinutes;
  }
  // Auto-calculate from date range
  const startAt = parseLocalDateTime(exam.startAt);
  const endAt = parseLocalDateTime(exam.endAt);
  if (startAt && endAt) {
    return Math.round((endAt - startAt) / 60000); // Convert ms to minutes
  }
  return 0;
}

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function parseLocalDateTime(value?: string): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function ExamPage() {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>('loading');
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [activeExam, setActiveExam] = useState<ExamConfig | null>(null);
  const [email, setEmail] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [attemptId, setAttemptId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [name, setName] = useState('');
  const [responses, setResponses] = useState<(number | string | null)[]>([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [previousSubmissions, setPreviousSubmissions] = useState<string[]>([]);
  const [previousSubmissionsLoading, setPreviousSubmissionsLoading] = useState(false);
  const [previousSubmissionsFetched, setPreviousSubmissionsFetched] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsExam, setDetailsExam] = useState<ExamConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitAttemptRef = useRef<() => Promise<void>>(async () => undefined);

  const isTimedAssessment = useMemo(() => {
    return activeExam ? activeExam.assessmentType !== 'CSM' && activeExam.assessmentType !== 'PREPLACEMENT' : false;
  }, [activeExam]);

  useEffect(() => {
    loadExamData();
  }, []);

  useEffect(() => {
    if (screen !== 'running' || !isTimedAssessment) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval);
          void submitAttemptRef.current();
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [screen, isTimedAssessment]);

  useEffect(() => {
    if (screen !== 'running' || !isTimedAssessment) return;

    const handleFocusLoss = () => {
      setTabSwitchCount((previous) => previous + 1);
      setWarningVisible(true);
      window.setTimeout(() => setWarningVisible(false), 3500);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        handleFocusLoss();
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [screen, isTimedAssessment]);

  const loadExamData = async () => {
    try {
      setLoading(true);
      const examList = await getExams();
      setExams(examList || []);

      const hasOpenExam = (examList || []).some((exam) => exam.status === 'OPEN');
      setScreen(hasOpenExam ? 'ready' : 'waiting');
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load assessment',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
      setScreen('waiting');
    } finally {
      setLoading(false);
    }
  };

  const eligibleMatch = useMemo(() => {
    if (!activeExam || !email.trim()) return null;
    return activeExam.eligibleEmails.some((item) => item.toLowerCase() === email.trim().toLowerCase());
  }, [activeExam, email]);

  useEffect(() => {
    if (!emailDialogOpen) {
      setPreviousSubmissions([]);
      setPreviousSubmissionsFetched(false);
      setPreviousSubmissionsLoading(false);
    }
  }, [emailDialogOpen]);

  const totalPossible = useMemo(() => {
    if (!activeExam) return 0;
    return getTotalWeight(activeExam.questions || []);
  }, [activeExam]);

  const fetchPreviousSubmissions = async () => {
    if (!activeExam || !email.trim()) {
      return;
    }

    setPreviousSubmissionsLoading(true);
    setPreviousSubmissionsFetched(false);
    setPreviousSubmissions([]);

    try {
      const submissions = await getPreviousSubmissions(activeExam.examId, email.trim().toLowerCase());
      setPreviousSubmissions(submissions || []);
    } catch (error) {
      console.error('Unable to load previous submissions', error);
      toast({
        title: 'Unable to load previous submissions',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setPreviousSubmissions([]);
    } finally {
      setPreviousSubmissionsFetched(true);
      setPreviousSubmissionsLoading(false);
    }
  };

  const currentQuestion = activeExam?.questions?.[currentIndex] || null;

  const upcomingExams = useMemo(() => {
    return (exams || [])
      .filter((exam) => exam.status === 'UPCOMING')
      .sort((a, b) => parseLocalDateTime(a.startAt) - parseLocalDateTime(b.startAt));
  }, [exams]);

  const openExams = useMemo(() => {
    return (exams || [])
      .filter((exam) => exam.status === 'OPEN')
      .sort((a, b) => parseLocalDateTime(a.startAt) - parseLocalDateTime(b.startAt));
  }, [exams]);

  const hasAnyTimed = useMemo(() => {
    return (openExams || []).some((exam) => exam.assessmentType !== 'CSM' && exam.assessmentType !== 'PREPLACEMENT');
  }, [openExams]);

  const openAttemptDialog = (exam: ExamConfig) => {
    setActiveExam(exam);
    setEmailDialogOpen(true);
  };

  const openDetails = (exam: ExamConfig) => {
    setDetailsExam(exam);
    setDetailsDialogOpen(true);
  };

  const closeDetails = () => {
    setDetailsExam(null);
    setDetailsDialogOpen(false);
  };

  const startExam = async () => {
    if (!activeExam) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({
        title: 'Email required',
        description: 'Enter your email to start the assessment.',
        variant: 'destructive',
      });
      return;
    }

    if (activeExam.assessmentType === 'CSM' && !name.trim()) {
      toast({
        title: 'Name required',
        description: 'Enter your full name before starting the communication skills assessment.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await startExamAttempt({
        examId: activeExam.examId,
        email: normalizedEmail,
      });

      setEmailDialogOpen(false);
      setActiveExam(response.exam);
      setAttemptId(response.attempt.attemptId);
      setAttempt(response.attempt);
      setStartedAt(response.attempt.startAt);
      setResponses(new Array(response.exam.questions.length).fill(null));
      setCurrentIndex(0);
      setTabSwitchCount(0);
      
      // Calculate effective duration and set timer for timed assessments
      const isTimedExam = response.exam.assessmentType !== 'CSM' && response.exam.assessmentType !== 'PREPLACEMENT';
      if (isTimedExam) {
        const effectiveDuration = getEffectiveDuration(response.exam);
        setSecondsLeft(Math.max(1, Math.min(effectiveDuration * 60, Math.floor((parseLocalDateTime(response.exam.endAt) - Date.now()) / 1000))));
      } else {
        setSecondsLeft(0);
      }
      setScreen('running');

      if (eligibleMatch === false) {
        toast({
          title: 'Email not listed for this cycle',
          description: 'You can still attempt the assessment, but your email is not in the eligible list for this assessment.',
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not start assessment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectAnswer = (optionIndex: number) => {
    setResponses((previous) => {
      const next = [...previous];
      next[currentIndex] = optionIndex;
      return next;
    });
  };

  const updateResponseText = (value: string) => {
    setResponses((previous) => {
      const next = [...previous];
      next[currentIndex] = value;
      return next;
    });
  };

  const calculateScore = () => {
    if (!activeExam) return 0;
    if (activeExam.assessmentType === 'CSM') {
      return 0;
    }
    return activeExam.questions.reduce((total, question, index) => {
      const selected = responses[index];
      if (selected === question.answerIndex) {
        return total + (Number(question.weight) || 1);
      }
      return total;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!activeExam || !attemptId || submitting) return;

    const responsesRequired = activeExam.questions.map((question, index) => {
      const response = responses[index];
      return String(response || '').trim();
    });

    if (activeExam.assessmentType === 'CSM' && responsesRequired.some((value) => !value)) {
      toast({
        title: 'Complete all responses',
        description: 'Please answer all CSM questions before submitting.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const endAt = new Date().toISOString();
      const score = calculateScore();
      const response = await submitExamAttempt({
        attemptId,
        examId: activeExam.examId,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        responses: responsesRequired,
        score,
        tabSwitchCount,
        startAt: startedAt,
        endAt,
      });

      setAttempt(response.attempt);
      setScreen('submitted');
      toast({
        title: 'Submission done',
        description: 'Your response has been logged to the Attempted sheet. You can leave the meet.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not submit assessment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    submitAttemptRef.current = handleSubmit;
  }, [handleSubmit]);

  const confirmAndSubmit = () => {
    if (!window.confirm('Are you sure you want to submit the assessment? You cannot change answers after submission.')) {
      return;
    }
    void handleSubmit();
  };

  const moveQuestion = (delta: number) => {
    if (!activeExam) return;
    setCurrentIndex((previous) => Math.max(0, Math.min(activeExam.questions.length - 1, previous + delta)));
  };

  const currentProgress = activeExam && isTimedAssessment && secondsLeft > 0
    ? Math.max(0, Math.min(100, (secondsLeft / (activeExam.durationMinutes * 60)) * 100))
    : 0;
  const lastMinuteReminderVisible = screen === 'running' && isTimedAssessment && secondsLeft > 0 && secondsLeft <= 60;

  if (loading) {
    return (
      <Layout>
        <div className="container py-8">
          <p className="text-center text-muted-foreground">Loading assessment...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        {/* Assessment access banner removed per request */}

        {screen === 'waiting' && (
          <Card>
            <CardHeader>
              <CardTitle>Assessment not available yet</CardTitle>
              <CardDescription>
                The current assessment opens only during the configured start window.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingExams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assessment is currently configured as OPEN.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Upcoming assessments</p>
                  {upcomingExams.map((exam) => (
                    <div key={exam.examId} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{exam.title}</p>
                        <Badge variant="secondary">{exam.status}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Window: {formatDateTime(exam.startAt)} to {formatDateTime(exam.endAt)}
                      </p>
                      {(exam.assessmentType !== 'CSM' && exam.assessmentType !== 'PREPLACEMENT') ? (
                        <p className="text-muted-foreground">Duration: {exam.durationMinutes} min</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {screen === 'ready' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Open assessments</CardTitle>
                <CardDescription>Open assessments are shown below. Upcoming assessments are listed separately so students can plan ahead.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {openExams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open assessments right now.</p>
                ) : (
                  openExams.map((exam) => (
                    <div key={exam.examId} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{exam.title}</p>
                        <Badge>{exam.status}</Badge>
                      </div>
                      <div className="flex items-start gap-3">
                        <p className="text-sm text-muted-foreground">
                          {(exam.description || 'Assessment configured by the admin team.').slice(0, 180)}
                          {(exam.description || '').length > 180 ? '…' : ''}
                        </p>
                        <button
                          type="button"
                          className="text-sm text-primary underline"
                          onClick={() => openDetails(exam)}
                        >
                          View details
                        </button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3 text-sm">
                        <p className="text-muted-foreground">Window: {formatDateTime(exam.startAt)} to {formatDateTime(exam.endAt)}</p>
                        {(exam.assessmentType !== 'CSM' && exam.assessmentType !== 'PREPLACEMENT') ? (
                          <p className="text-muted-foreground">Duration: {exam.durationMinutes} minutes</p>
                        ) : null}
                        <p className="text-muted-foreground">Questions: {exam.questions.length}</p>
                      </div>
                      <Button onClick={() => openAttemptDialog(exam)} disabled={submitting}>
                        {submitting && activeExam?.examId === exam.examId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Attempt Assessment
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming assessments</CardTitle>
                <CardDescription>These assessments are not open yet, but they are scheduled and visible here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingExams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming assessments found.</p>
                ) : (
                  upcomingExams.map((exam) => (
                    <div key={exam.examId} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{exam.title}</p>
                        <Badge variant="secondary">{exam.status}</Badge>
                      </div>
                      <div className="flex items-start gap-3">
                        <p className="text-sm text-muted-foreground">
                          {(exam.description || 'Assessment configured by the admin team.').slice(0, 180)}
                          {(exam.description || '').length > 180 ? '…' : ''}
                        </p>
                        <button
                          type="button"
                          className="text-sm text-primary underline"
                          onClick={() => openDetails(exam)}
                        >
                          View details
                        </button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3 text-sm">
                        <p className="text-muted-foreground">Window: {formatDateTime(exam.startAt)} to {formatDateTime(exam.endAt)}</p>
                        {(exam.assessmentType !== 'CSM' && exam.assessmentType !== 'PREPLACEMENT') ? (
                          <p className="text-muted-foreground">Duration: {exam.durationMinutes} minutes</p>
                        ) : null}
                        <p className="text-muted-foreground">Questions: {exam.questions.length}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>1. Start only when the assessment window is open.</p>
                {hasAnyTimed ? (
                  <>
                    <p>2. Keep the tab focused. Switching tabs increases the violation count.</p>
                    <p>3. Submit before the timer ends.</p>
                  </>
                ) : (
                  <p>2. All open assessments are not timed and do not track tab switches.</p>
                )}
                <p>4. Your email, start time, and end time will be recorded.</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{detailsExam?.title || 'Details'}</DialogTitle>
              <DialogDescription>{detailsExam?.examId}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{detailsExam?.description}</p>
              <p className="text-sm text-muted-foreground">Window: {formatDateTime(detailsExam?.startAt)} to {formatDateTime(detailsExam?.endAt)}</p>
              <p className="text-sm text-muted-foreground">Duration: {detailsExam?.durationMinutes} minutes</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDetails}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {screen === 'running' && activeExam && currentQuestion && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Live Assessment</p>
                  <h2 className="text-xl font-semibold">{activeExam.title}</h2>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {isTimedAssessment ? (
                    <>
                      <Clock3 className="h-4 w-4" />
                      <span className={secondsLeft <= 300 ? 'text-destructive font-semibold' : 'font-medium'}>{formatTime(secondsLeft)}</span>
                      <Badge variant="outline">Tab switches: {tabSwitchCount}</Badge>
                    </>
                  ) : (
                    <Badge variant="secondary">No timer / no tab tracking</Badge>
                  )}
                </div>
              </div>

              {isTimedAssessment ? <Progress value={currentProgress} /> : null}

              {lastMinuteReminderVisible && (
                <Alert className="border-amber-500/40 bg-amber-50">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <AlertTitle>Last minute reminder</AlertTitle>
                  <AlertDescription>
                    Only 1 minute left. Please click Submit now to avoid auto-submit at the end.
                  </AlertDescription>
                </Alert>
              )}

              {warningVisible && (
                <Alert className="border-amber-500/40 bg-amber-50">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <AlertTitle>Tab switch detected</AlertTitle>
                  <AlertDescription>
                    Stay focused on the exam. The switch count is being logged.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Question {currentIndex + 1} of {activeExam.questions.length}</CardTitle>
                  <CardDescription>Started at {startedAt ? formatDateTime(startedAt) : 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-base font-medium leading-7">{currentQuestion.prompt}</p>
                    <p className="text-xs text-muted-foreground mt-1">Weight: {currentQuestion.weight}</p>
                  </div>

                  <div className="space-y-4">
                    {currentQuestion.responseType === 'TEXT' ? (
                      <Textarea
                        value={String(responses[currentIndex] || '')}
                        onChange={(e) => updateResponseText(e.target.value)}
                        placeholder="Write your answer here"
                        rows={8}
                      />
                    ) : currentQuestion.responseType === 'URL' ? (
                      <Input
                        type="url"
                        value={String(responses[currentIndex] || '')}
                        onChange={(e) => updateResponseText(e.target.value)}
                        placeholder="Paste your shareable link here"
                      />
                    ) : (
                      (currentQuestion.options || []).map((option, optionIndex) => {
                        const selected = responses[currentIndex] === optionIndex;
                        return (
                          <button
                            key={`${currentIndex}-${optionIndex}`}
                            type="button"
                            onClick={() => selectAnswer(optionIndex)}
                            className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${selected ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                          >
                            <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="text-sm">{option}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button variant="outline" onClick={() => moveQuestion(-1)} disabled={currentIndex === 0}>
                      Previous
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => moveQuestion(1)} disabled={currentIndex === activeExam.questions.length - 1}>
                        Next
                      </Button>
                      <Button onClick={confirmAndSubmit} disabled={submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Submit Assessment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium break-all">{email.trim().toLowerCase()}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Tab switches</p>
                    <p className="font-medium">{tabSwitchCount}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Answered</p>
                    <p className="font-medium">{responses.filter((answer) => answer !== null && String(answer).trim() !== '').length} / {responses.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Start Time</p>
                    <p className="font-medium">{startedAt ? formatDateTime(startedAt) : 'N/A'}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Eligible Status</p>
                    <p className="font-medium">{eligibleMatch === false ? 'Not matched' : eligibleMatch === true ? 'Matched' : 'Unchecked'}</p>
                  </div>
                  {attempt?.previousSubmissionAt ? (
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Last submission</p>
                      <p className="font-medium">{formatDateTime(attempt.previousSubmissionAt)}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {screen === 'submitted' && attempt && activeExam && (
          <Card>
            <CardHeader>
              <CardTitle>Submission done</CardTitle>
              <CardDescription>Your response has been logged. You can leave the meet.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Tab switches</p>
                <p className="font-medium">{attempt.tabSwitchCount}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">Start</p>
                <p className="font-medium">{formatDateTime(attempt.startAt)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-muted-foreground">End</p>
                <p className="font-medium">{formatDateTime(attempt.endAt)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Details</DialogTitle>
              <DialogDescription>
                Use your student email to start {activeExam?.title || 'the test'}. This email is logged in the Attempted sheet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="attempt-email">Email ID</Label>
                <Input
                  id="attempt-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@study.iitm.ac.in"
                />
              </div>
              {activeExam?.assessmentType === 'CSM' && (
                <div className="space-y-2">
                  <Label htmlFor="attempt-name">Full Name</Label>
                  <Input
                    id="attempt-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
              )}
                      <p className="text-xs text-muted-foreground">
                {eligibleMatch === false
                  ? 'This email is not in the eligible list for this cycle. You may still attempt, but it will be flagged.'
                  : eligibleMatch === true
                    ? 'Email matches the eligible list for this cycle.'
                    : 'Enter your email to check against the eligible list.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchPreviousSubmissions}
                  disabled={!email.trim() || previousSubmissionsLoading}
                >
                  {previousSubmissionsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Check Previous Submissions
                </Button>
              </div>
              {previousSubmissionsFetched ? (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">Previous submissions for this exam:</p>
                  {previousSubmissions.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-foreground">
                      {previousSubmissions.map((timestamp, index) => (
                        <li key={index}>{formatDateTime(timestamp)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No previous submissions found for this email.</p>
                  )}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" onClick={startExam} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Start Attempt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
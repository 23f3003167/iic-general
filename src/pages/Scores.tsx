import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { lookupStudentActivityPoints, lookupStudentFeedback, lookupStudentScore, type StudentActivityPointsLookup, type StudentFeedbackLookup, type StudentScoreLookup } from '@/lib/toolsService';

const SUBMISSIONS_PORTAL_URL = (import.meta.env.VITE_SCORES_SUBMISSIONS_PORTAL_URL as string) || 'https://script.google.com/macros/s/AKfycbxxXwcNWMq4NfG7b1TCqVNikLFYObiNeCPO84MAaQVzKsPhFPmfqTmR1iWplmf5BsYD_A/exec';

const levelOptions = ['Level 1', 'Level 2', 'Level 3'] as const;
const feedbackOptions = ['CSM', 'Behavioral', 'Presentation', '1o1'] as const;
const activityPointsOptions = ['Internship', 'Employment'] as const;

type FeedbackFormState = {
  category: string;
  email: string;
};

type ScoreSummary = {
  name?: string;
  email?: string;
  plan?: string;
  domain?: string;
  total?: string;
  // Generic fields
  selfAptitude?: string;
  aptitudeStatus?: string;
  behavioural?: string;
  behaviouralStatus?: string;
  presentation?: string;
  presentationStatus?: string;
  level2?: string;
  // Level 1 specific
  ppm?: string;
  ppmStatus?: string;
  ppmAttempt?: string;
  selfIntro?: string;
  selfIntroStatus?: string;
  listenSpeak?: string;
  listenSpeakStatus?: string;
  listenWrite?: string;
  listenWriteStatus?: string;
  emailWriting?: string;
  emailWritingStatus?: string;
  csmPassFail?: string;
  csmAttempt?: string;
  overallPassFail?: string;
  // Level 2 specific
  saAttempt?: string;
  baAttempt?: string;
  prAttempt?: string;
  // Level 3 specific
  techMcq?: string;
  mcqPassFail?: string;
  aiMock?: string;
  aiMockPassFail?: string;
  tmcqAttempt?: string;
  aiAttempt?: string;
  oneOnOneAttempt?: string;
  oneOnOneSession?: string;
  oneOnOnePassFail?: string;
  level3PassFail?: string;
  activityPoints?: string;
  cma?: string;
};

type ActivityPointsSummary = {
  email?: string;
  name?: string;
  rollNumber?: string;
  plan?: string;
  domain?: string;
  nppeScores?: string;
  dbms?: string;
  pdsa?: string;
  sc?: string;
  cloudDevops?: string;
  java?: string;
  se?: string;
  mad?: string;
  pgws?: string;
  mlt?: string;
  dsws1?: string;
  mlp?: string;
  mlBasics?: string;
  dsws2?: string;
  dvd?: string;
  dl?: string;
  aws?: string;
  total?: string;
  cma?: string;
  status?: string;
  amIp?: string;
  amId?: string;
  amEp?: string;
  amEd?: string;
};

const ScoreRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border bg-muted/30 p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-medium break-words">{value || '—'}</p>
  </div>
);

function tableValue(row: string[], headers: string[], keywords: string[]): string {
  if (!headers || !Array.isArray(headers)) return '—';
  
  const index = headers.findIndex((header) => {
    const normalized = String(header || '').trim().toLowerCase();
    return keywords.every((keyword) => normalized.includes(keyword.toLowerCase()));
  });

  if (index < 0) return '—';
  return String(row[index] || '').trim() || '—';
}

function isMissingValue(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '' || normalized === '—' || normalized === '#n/a' || normalized === 'not found';
}

function resolveStudentEmail(input?: string): string {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';

  // If the user pasted the full email, use it directly
  if (raw.includes('@')) {
    return raw;
  }

  // Detect roll-number length:
  // 11-char rolls start with two digits (e.g. 23ds..., 23dp...)
  // 10-char rolls start with two letters (e.g. 21f1..., 22f3...)
  const isElevenChar = /^\d{2}[a-z]{2}\d{7}$/.test(raw);
  const rollNumber = isElevenChar ? raw.slice(0, 11) : raw.slice(0, 10);

  // Detect subdomain: 'es' students vs 'ds' students
  // ES students have rolls matching 2xfxxxxxxx where position 1 is a letter like 'e'
  // Safest: if they explicitly typed the full roll + domain hint, we already handled it above.
  // For the short-input case, 'es' rolls follow pattern: digit-letter(e/s)-f-digits
  const isES = /^\d{1}[es]{1}f\d/.test(raw);
  const domain = isES ? 'es.study.iitm.ac.in' : 'ds.study.iitm.ac.in';

  return `${rollNumber}@${domain}`;
}

function formatAttemptCode(value: string | undefined): string {
  if (!value) return '—';
  const normalized = String(value).trim().toUpperCase();

  switch (normalized) {
    case 'FA1B':
      return '1st Attempt - 1st Batch';
    case 'FA2B':
      return '1st Attempt - 2nd Batch';
    case 'RA1B':
      return 'Re-Attempt - 1st Batch';
    case 'RA2B':
      return 'Re-Attempt - 2nd Batch';
    default:
      return value;
  }
}

function buildActivityPointsSummary(result: StudentActivityPointsLookup | null): ActivityPointsSummary | null {
  if (!result || !result.headers || !Array.isArray(result.headers) || !result.row) return null;

  const headers = result.headers;
  const row = result.row;

  return {
    email: tableValue(row, headers, ['email']),
    name: tableValue(row, headers, ['name']),
    rollNumber: tableValue(row, headers, ['roll', 'number']),
    plan: tableValue(row, headers, ['plan']),
    domain: tableValue(row, headers, ['domain']),
    nppeScores: tableValue(row, headers, ['nppe']),
    dbms: tableValue(row, headers, ['dbms']),
    pdsa: tableValue(row, headers, ['pdsa']),
    sc: tableValue(row, headers, ['sc']),
    cloudDevops: tableValue(row, headers, ['cloud', 'devops']),
    java: tableValue(row, headers, ['java']),
    se: tableValue(row, headers, ['se']),
    mad: tableValue(row, headers, ['mad']),
    pgws: tableValue(row, headers, ['pgws']),
    mlt: tableValue(row, headers, ['mlt']),
    dsws1: tableValue(row, headers, ['dsws1']),
    mlp: tableValue(row, headers, ['mlp']),
    mlBasics: tableValue(row, headers, ['ml', 'basics']),
    dsws2: tableValue(row, headers, ['dsws2']),
    dvd: tableValue(row, headers, ['dvd']),
    dl: tableValue(row, headers, ['dl']),
    aws: tableValue(row, headers, ['aws']),
    total: tableValue(row, headers, ['total']),
    cma: tableValue(row, headers, ['cma']),
    status: tableValue(row, headers, ['status']),
    amIp: tableValue(row, headers, ['am', 'ip']),
    amId: tableValue(row, headers, ['am', 'id']),
    amEp: tableValue(row, headers, ['am', 'ep']),
    amEd: tableValue(row, headers, ['am', 'ed']),
  };
}

export default function Scores() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'scores' | 'feedback' | 'activity' | 'submissions'>('scores');
  const [scoreForm, setScoreForm] = useState<ScoreFormState>({
    level: 'Level 2',
    email: '',
    domain: 'Data Science',
    plan: 'Internship',
  });
  const [domainOptions] = useState<string[]>(['Data Science', 'Programming', 'Electronics']);
  const [planOptions] = useState<string[]>(['Internship', 'Employment']);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackFormState>({
    category: 'Behavioral',
    email: '',
  });
  const [activityPointsForm, setActivityPointsForm] = useState<ActivityPointsFormState>({
    email: '',
    domain: 'Data Science',
    plan: 'Internship',
  });
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [loadingActivityPoints, setLoadingActivityPoints] = useState(false);
  const [scoreResult, setScoreResult] = useState<StudentScoreLookup | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<StudentFeedbackLookup | null>(null);
  const [activityPointsResult, setActivityPointsResult] = useState<StudentActivityPointsLookup | null>(null);
  const selectedLevel = (scoreForm.level || '').toLowerCase();
  const isLevel1 = selectedLevel.includes('level 1');
  const isLevel2 = selectedLevel.includes('level 2');
  const isLevel3 = selectedLevel.includes('level 3');

  const scoreSummary = useMemo<ScoreSummary | null>(() => {
    if (!scoreResult || !scoreResult.headers || !Array.isArray(scoreResult.headers) || !scoreResult.row) return null;

    const level = selectedLevel;
    const headers = scoreResult.headers;
    const row = scoreResult.row;

    const base = {
      name: tableValue(row, headers, ['name']),
      email: tableValue(row, headers, ['email']),
      plan: tableValue(row, headers, ['plan']),
      domain: tableValue(row, headers, ['domain']),
      total: tableValue(row, headers, ['total']),
      selfAptitude: '—',
      aptitudeStatus: '—',
      behavioural: '—',
      behaviouralStatus: '—',
      presentation: '—',
      presentationStatus: '—',
      level2: '—',
    };

    if (level.indexOf('level 1') !== -1 || level.indexOf('1') === 0) {
      return {
        ...base,
          ppm: tableValue(row, headers, ['ppm']),
          ppmStatus: tableValue(row, headers, ['ppm', 'pass', 'fail']),
          ppmAttempt: tableValue(row, headers, ['ppm', 'attempt']),
          selfIntro: tableValue(row, headers, ['self', 'intro']),
          selfIntroStatus: tableValue(row, headers, ['si', 'status', 'si status']),
          listenSpeak: tableValue(row, headers, ['listen', 'speak']),
          listenSpeakStatus: tableValue(row, headers, ['ls', 'status']),
          listenWrite: tableValue(row, headers, ['listen', 'write']),
          listenWriteStatus: tableValue(row, headers, ['lw', 'status']),
          emailWriting: tableValue(row, headers, ['email', 'writing']),
          emailWritingStatus: tableValue(row, headers, ['ew', 'status']),
          csmPassFail: tableValue(row, headers, ['csm', 'pass', 'fail']),
          csmAttempt: tableValue(row, headers, ['csm', 'attempt']),
          overallPassFail: tableValue(row, headers, ['overall', 'pass', 'fail']),
        total: tableValue(row, headers, ['total']),
      };
    }

    if (level.indexOf('level 3') !== -1 || level.indexOf('3') === 0) {
      let oneOnOneSession = tableValue(row, headers, ['1on1', 'session']);
      if (isMissingValue(oneOnOneSession)) {
        oneOnOneSession = tableValue(row, headers, ['1-on-1', 'session']);
      }

      let oneOnOnePassFail = tableValue(row, headers, ['1on1', 'pass', 'fail']);
      if (isMissingValue(oneOnOnePassFail)) {
        oneOnOnePassFail = tableValue(row, headers, ['1-on-1', 'pass', 'fail']);
      }

      return {
        ...base,
        techMcq: tableValue(row, headers, ['tech', 'mcq']),
        mcqPassFail: tableValue(row, headers, ['mcq', 'pass', 'fail']),
        aiMock: tableValue(row, headers, ['ai', 'mock']),
        aiMockPassFail: tableValue(row, headers, ['ai', 'mock', 'pass', 'fail']),
        tmcqAttempt: tableValue(row, headers, ['tmcq', 'attempt']),
        aiAttempt: tableValue(row, headers, ['ai', 'attempt']),
        oneOnOneAttempt: tableValue(row, headers, ['1on1', 'attempt']) || tableValue(row, headers, ['1-on-1', 'attempt']),
        oneOnOneSession: oneOnOneSession,
        oneOnOnePassFail: oneOnOnePassFail,
        level3PassFail: tableValue(row, headers, ['level', '3', 'pass', 'fail']),
        activityPoints: tableValue(row, headers, ['activity', 'points']),
        cma: tableValue(row, headers, ['cma']),
      };
    }

    return {
      ...base,
      selfAptitude: tableValue(row, headers, ['self', 'aptitude']),
      aptitudeStatus: tableValue(row, headers, ['aptitude', 'pass', 'fail']),
      behavioural: tableValue(row, headers, ['behavioural']),
      behaviouralStatus: tableValue(row, headers, ['behavioural', 'pass', 'fail']),
      presentation: tableValue(row, headers, ['presentation']),
      presentationStatus: tableValue(row, headers, ['presentation', 'pass', 'fail']),
      level2: tableValue(row, headers, ['level 2']),
      saAttempt: tableValue(row, headers, ['sa', 'attempt']),
      baAttempt: tableValue(row, headers, ['ba', 'attempt']),
      prAttempt: tableValue(row, headers, ['pr', 'attempt']),
    };
  }, [scoreResult, selectedLevel]);

  const activityPointsSummary = useMemo(() => buildActivityPointsSummary(activityPointsResult), [activityPointsResult]);
  const feedbackSummary = useMemo(() => {
    if (!feedbackResult || !feedbackResult.headers || !Array.isArray(feedbackResult.headers) || !feedbackResult.rows) return [];

    return feedbackResult.rows
      .map((row, rowIndex) => {
        const items = feedbackResult.headers
          .map((header, index) => ({
            header: String(header || '').trim(),
            value: String(row[index] || '').trim(),
          }))
          .filter((item) => item.header && item.value);

        return {
          rowIndex,
          items,
        };
      })
      .filter((entry) => entry.items.length > 0);
  }, [feedbackResult]);

  const submitScoreLookup = async () => {
    if (!scoreForm.level || !scoreForm.email.trim()) {
      toast({ title: 'Missing details', description: 'Enter your roll number.', variant: 'destructive' });
      return;
    }

    const studentEmail = resolveStudentEmail(scoreForm.email);
    const localPart = studentEmail.split('@')[0];
    if (localPart.length < 10) {
      toast({ title: 'Invalid roll number', description: 'Enter a valid roll number (10 or 11 characters).', variant: 'destructive' });
      return;
    }

    setLoadingScore(true);
    setScoreResult(null);
    try {
      const result = await lookupStudentScore({
        level: scoreForm.level,
        email: studentEmail,
        domain: scoreForm.domain,
        plan: scoreForm.plan,
      });
      setScoreResult(result);
      setActiveTab('scores');
    } catch (error) {
      toast({
        title: 'Score lookup failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingScore(false);
    }
  };

  // Domain and Plan options are static lists as requested.

  const submitFeedbackLookup = async () => {
    if (!feedbackForm.category || !feedbackForm.email.trim()) {
      toast({ title: 'Missing details', description: 'Choose a category and enter your roll number.', variant: 'destructive' });
      return;
    }

    const studentEmail = resolveStudentEmail(feedbackForm.email);
    if (studentEmail.length < 12) {
      toast({ title: 'Invalid roll number', description: 'Enter the first 10 characters of your email ID.', variant: 'destructive' });
      return;
    }

    setLoadingFeedback(true);
    setFeedbackResult(null);
    try {
      const result = await lookupStudentFeedback({
        category: feedbackForm.category,
        email: studentEmail,
      });
      setFeedbackResult(result);
      setActiveTab('feedback');
    } catch (error) {
      toast({
        title: 'Feedback lookup failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingFeedback(false);
    }
  };

  const submitActivityPointsLookup = async () => {
    if (!activityPointsForm.email.trim()) {
      toast({ title: 'Missing details', description: 'Enter your roll number.', variant: 'destructive' });
      return;
    }

    const studentEmail = resolveStudentEmail(activityPointsForm.email);
    if (studentEmail.length < 12) {
      toast({ title: 'Invalid roll number', description: 'Enter the first 10 characters of your email ID.', variant: 'destructive' });
      return;
    }

    setLoadingActivityPoints(true);
    setActivityPointsResult(null);
    try {
      const result = await lookupStudentActivityPoints({
        email: studentEmail,
        domain: activityPointsForm.domain,
        plan: activityPointsForm.plan,
      });
      setActivityPointsResult(result);
      setActiveTab('activity');
    } catch (error) {
      toast({
        title: 'Activity points lookup failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingActivityPoints(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <Alert className="border-l-4 border-l-emerald-600 bg-emerald-50/70 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <AlertDescription className="text-emerald-900 text-sm leading-relaxed">
            Student score and feedback lookup is now available inside the portal. Use your email and the correct level/category to view results.
          </AlertDescription>
        </Alert>

        <div className="text-center space-y-2 pb-4 border-b">
          <h1 className="text-2xl font-bold sm:text-3xl">Scores & Feedback</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Check your level-wise scores and evaluation feedback without leaving the portal.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'scores' | 'feedback' | 'activity' | 'submissions')} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="activity">Activity Points</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="scores" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">Find Your Scores</CardTitle>
                  <CardDescription>Select your level, then enter the email, domain, and plan used in the sheet.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={scoreForm.level} onValueChange={(value) => setScoreForm({ ...scoreForm, level: value })}>
                      <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                      <SelectContent>
                        {levelOptions.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Roll Number</Label>
                    <Input value={scoreForm.email} onChange={(e) => setScoreForm({ ...scoreForm, email: e.target.value })} placeholder="First 10 chars of email ID (roll number)" />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    {domainOptions.length > 0 ? (
                      <Select value={scoreForm.domain} onValueChange={(value) => setScoreForm({ ...scoreForm, domain: value })}>
                        <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                        <SelectContent>
                          {domainOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={scoreForm.domain} onChange={(e) => setScoreForm({ ...scoreForm, domain: e.target.value })} placeholder="Data Science / Programming / Electronics" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    {planOptions.length > 0 ? (
                      <Select value={scoreForm.plan} onValueChange={(value) => setScoreForm({ ...scoreForm, plan: value })}>
                        <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                        <SelectContent>
                          {planOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={scoreForm.plan} onChange={(e) => setScoreForm({ ...scoreForm, plan: e.target.value })} placeholder="Internship / Employment" />
                    )}
                  </div>
                  <Button onClick={submitScoreLookup} disabled={loadingScore} className="w-full">
                    {loadingScore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    View Scores
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score Result</CardTitle>
                  <CardDescription>Matched against the selected level sheet.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!scoreResult ? (
                    <p className="text-sm text-muted-foreground">No scores loaded yet. Search to view your row.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{scoreResult.sheetName}</Badge>
                        <Badge>{scoreSummary?.email}</Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {isLevel1 ? (
                          <>
                            <ScoreRow label="Name" value={scoreSummary?.name || '—'} />
                            <div className="rounded-lg border bg-emerald-50 p-3 text-right">
                              <p className="text-xs uppercase tracking-wide text-emerald-700">Overall Pass/Fail</p>
                              <p className="mt-1 text-xl font-semibold text-emerald-900">{scoreSummary?.overallPassFail || '—'}</p>
                            </div>
                            <ScoreRow label="PPM / Status" value={`${scoreSummary?.ppm || '—'} / ${scoreSummary?.ppmStatus || '—'}`} />
                            <ScoreRow label="PPM Attempt" value={formatAttemptCode(scoreSummary?.ppmAttempt)} />
                            <ScoreRow label="Self Intro / SI Status" value={`${scoreSummary?.selfIntro || '—'} / ${scoreSummary?.selfIntroStatus || '—'}`} />
                            <ScoreRow label="Listen & Speak / LS Status" value={`${scoreSummary?.listenSpeak || '—'} / ${scoreSummary?.listenSpeakStatus || '—'}`} />
                            <ScoreRow label="Listen & Write / LW Status" value={`${scoreSummary?.listenWrite || '—'} / ${scoreSummary?.listenWriteStatus || '—'}`} />
                            <ScoreRow label="Email Writing / EW Status" value={`${scoreSummary?.emailWriting || '—'} / ${scoreSummary?.emailWritingStatus || '—'}`} />
                            <ScoreRow label="CSM Pass/Fail" value={scoreSummary?.csmPassFail || '—'} />
                            <ScoreRow label="CSM Attempt" value={formatAttemptCode(scoreSummary?.csmAttempt)} />
                          </>
                        ) : isLevel2 ? (
                          <>
                            <ScoreRow label="Name" value={scoreSummary?.name || '—'} />
                            <div className="rounded-lg border bg-sky-50 p-3 text-right">
                              <p className="text-xs uppercase tracking-wide text-sky-700">Level 2 (Pass/Fail)</p>
                              <p className="mt-1 text-xl font-semibold text-sky-900">{scoreSummary?.level2 || '—'}</p>
                            </div>
                            <ScoreRow label="Aptitude" value={`${scoreSummary?.selfAptitude || '—'} / ${scoreSummary?.aptitudeStatus || '—'}`} />
                            <ScoreRow label="Aptitude Attempt" value={formatAttemptCode(scoreSummary?.saAttempt)} />
                            <ScoreRow label="Behavioural" value={`${scoreSummary?.behavioural || '—'} / ${scoreSummary?.behaviouralStatus || '—'}`} />
                            <ScoreRow label="Behavioural Attempt" value={formatAttemptCode(scoreSummary?.baAttempt)} />
                            <ScoreRow label="Presentation" value={`${scoreSummary?.presentation || '—'} / ${scoreSummary?.presentationStatus || '—'}`} />
                            <ScoreRow label="Presentation Attempt" value={formatAttemptCode(scoreSummary?.prAttempt)} />
                          </>
                        ) : isLevel3 ? (
                          <>
                            <ScoreRow label="Name" value={scoreSummary?.name || '—'} />
                            <div className="rounded-lg border bg-amber-50 p-3 text-right">
                              <p className="text-xs uppercase tracking-wide text-amber-700">Level 3 (Pass/Fail)</p>
                              <p className="mt-1 text-xl font-semibold text-amber-900">{scoreSummary?.level3PassFail || '—'}</p>
                            </div>
                            <ScoreRow label="TECH MCQ" value={scoreSummary?.techMcq || '—'} />
                            <ScoreRow label="MCQ Pass/Fail" value={scoreSummary?.mcqPassFail || '—'} />
                            <ScoreRow label="TMCQ Attempt" value={formatAttemptCode(scoreSummary?.tmcqAttempt)} />
                            <ScoreRow label="AI MOCK" value={scoreSummary?.aiMock || '—'} />
                            <ScoreRow label="AI Mock Pass/Fail" value={scoreSummary?.aiMockPassFail || '—'} />
                            <ScoreRow label="AI Attempt" value={formatAttemptCode(scoreSummary?.aiAttempt)} />
                            <ScoreRow label="1on1 Session" value={scoreSummary?.oneOnOneSession || '—'} />
                            <ScoreRow label="1on1 Pass/Fail" value={scoreSummary?.oneOnOnePassFail || '—'} />
                            <ScoreRow label="1on1 Attempt" value={formatAttemptCode(scoreSummary?.oneOnOneAttempt)} />
                            <ScoreRow label="Activity Points" value={scoreSummary?.activityPoints || '—'} />
                            <ScoreRow label="CMA" value={scoreSummary?.cma || '—'} />
                          </>
                        ) : (
                          <>
                            <ScoreRow label="Name" value={scoreSummary?.name || '—'} />
                            <ScoreRow label="Aptitude" value={`${scoreSummary?.selfAptitude || '—'} / ${scoreSummary?.aptitudeStatus || '—'}`} />
                            <ScoreRow label="Behavioural" value={`${scoreSummary?.behavioural || '—'} / ${scoreSummary?.behaviouralStatus || '—'}`} />
                            <ScoreRow label="Presentation" value={`${scoreSummary?.presentation || '—'} / ${scoreSummary?.presentationStatus || '—'}`} />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="feedback" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Find Feedback</CardTitle>
                  <CardDescription>Choose the category and enter the same email used during evaluation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={feedbackForm.category} onValueChange={(value) => setFeedbackForm({ ...feedbackForm, category: value })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {feedbackOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Roll Number</Label>
                    <Input value={feedbackForm.email} onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })} placeholder="Roll number or full IITM email ID" />
                  </div>
                  <Button onClick={submitFeedbackLookup} disabled={loadingFeedback} className="w-full">
                    {loadingFeedback ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    View Feedback
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Result</CardTitle>
                  <CardDescription>Category-specific feedback for your email address.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!feedbackResult ? (
                    <p className="text-sm text-muted-foreground">No feedback loaded yet. Search to view your remarks.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{feedbackResult.sheetName}</Badge>
                        <Badge>{feedbackResult.email}</Badge>
                        <Badge variant="outline">{feedbackResult.count ?? feedbackResult.rows.length} matches</Badge>
                      </div>
                      <div className="space-y-3">
                        {feedbackSummary.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No filled feedback fields found for the matched rows.</p>
                        ) : feedbackSummary.map((entry) => (
                          <div key={entry.rowIndex} className="rounded-lg border bg-muted/10 p-3 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Entry {entry.rowIndex + 1}
                            </p>
                            {entry.items.map((item, itemIndex) => (
                              <div key={`${entry.rowIndex}-${item.header}-${itemIndex}`} className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.header}</p>
                                <p className="mt-1 text-sm whitespace-pre-wrap break-words">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Find Activity Points</CardTitle>
                  <CardDescription>Search the Activity points sheet using email, plan, and domain.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Roll Number</Label>
                    <Input value={activityPointsForm.email} onChange={(e) => setActivityPointsForm({ ...activityPointsForm, email: e.target.value })} placeholder="First 10 chars of email ID (roll number)" />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Select value={activityPointsForm.domain} onValueChange={(value) => setActivityPointsForm({ ...activityPointsForm, domain: value })}>
                      <SelectTrigger><SelectValue placeholder="Select domain" /></SelectTrigger>
                      <SelectContent>
                        {domainOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={activityPointsForm.plan} onValueChange={(value) => setActivityPointsForm({ ...activityPointsForm, plan: value })}>
                      <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                      <SelectContent>
                        {activityPointsOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={submitActivityPointsLookup} disabled={loadingActivityPoints} className="w-full">
                    {loadingActivityPoints ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    View Activity Points
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity Points Result</CardTitle>
                  <CardDescription>Matched against the Activity points sheet.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!activityPointsResult ? (
                    <p className="text-sm text-muted-foreground">No activity points loaded yet. Search to view your row.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{activityPointsResult.sheetName}</Badge>
                        <Badge>{activityPointsSummary?.email}</Badge>
                        <Badge>{activityPointsSummary?.status || '—'}</Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <ScoreRow label="Name" value={activityPointsSummary?.name || '—'} />
                        <ScoreRow label="Roll Number" value={activityPointsSummary?.rollNumber || '—'} />
                        <ScoreRow label="Plan" value={activityPointsSummary?.plan || '—'} />
                        <ScoreRow label="Domain" value={activityPointsSummary?.domain || '—'} />
                        <ScoreRow label="NPPE Scores" value={activityPointsSummary?.nppeScores || '—'} />
                        <ScoreRow label="DBMS" value={activityPointsSummary?.dbms || '—'} />
                        <ScoreRow label="PDSA" value={activityPointsSummary?.pdsa || '—'} />
                        <ScoreRow label="SC" value={activityPointsSummary?.sc || '—'} />
                        <ScoreRow label="Cloud & DevOps" value={activityPointsSummary?.cloudDevops || '—'} />
                        <ScoreRow label="JAVA" value={activityPointsSummary?.java || '—'} />
                        <ScoreRow label="SE" value={activityPointsSummary?.se || '—'} />
                        <ScoreRow label="MAD" value={activityPointsSummary?.mad || '—'} />
                        <ScoreRow label="PGWS" value={activityPointsSummary?.pgws || '—'} />
                        <ScoreRow label="MLT" value={activityPointsSummary?.mlt || '—'} />
                        <ScoreRow label="DSWS1" value={activityPointsSummary?.dsws1 || '—'} />
                        <ScoreRow label="MLP" value={activityPointsSummary?.mlp || '—'} />
                        <ScoreRow label="ML Basics" value={activityPointsSummary?.mlBasics || '—'} />
                        <ScoreRow label="DSWS2" value={activityPointsSummary?.dsws2 || '—'} />
                        <ScoreRow label="DVD" value={activityPointsSummary?.dvd || '—'} />
                        <ScoreRow label="DL" value={activityPointsSummary?.dl || '—'} />
                        <ScoreRow label="AWS" value={activityPointsSummary?.aws || '—'} />
                        <ScoreRow label="Total" value={activityPointsSummary?.total || '—'} />
                        <ScoreRow label="CMA" value={activityPointsSummary?.cma || '—'} />
                        <ScoreRow label="AM_IP" value={activityPointsSummary?.amIp || '—'} />
                        <ScoreRow label="AM_ID" value={activityPointsSummary?.amId || '—'} />
                        <ScoreRow label="AM_EP" value={activityPointsSummary?.amEp || '—'} />
                        <ScoreRow label="AM_ED" value={activityPointsSummary?.amEd || '—'} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-1">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Submissions</CardTitle>
                  <CardDescription>Open the submissions portal to view and manage your activity submissions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button asChild className="w-full">
                    <a href={SUBMISSIONS_PORTAL_URL} target="_blank" rel="noreferrer noopener">
                      Open Submissions Portal
                    </a>
                  </Button>
                  <p className="text-sm text-muted-foreground">The portal opens in a new tab and uses your Google sign-in to show your submissions.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
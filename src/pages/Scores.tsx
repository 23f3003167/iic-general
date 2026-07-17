import { useMemo, useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { lookupStudentFeedback, lookupStudentScore, type StudentFeedbackLookup, type StudentScoreLookup } from '@/lib/toolsService';
import { getStoredVerifiedEmail } from '@/lib/emailVerificationService';

const levelOptions = ['Level 1', 'Level 2', 'Level 3'] as const;
const feedbackOptions = ['CSM', 'Behavioral', 'Presentation', '1o1'] as const;
const domainOptions = ['Data Science', 'Programming', 'Electronics'];
const planOptions = ['Internship', 'Employment'];

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

export default function Scores() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'scores' | 'feedback'>('scores');
  const [feedbackForm, setFeedbackForm] = useState<FeedbackFormState>({
    category: 'Behavioral',
    email: '',
  });
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [scoreResults, setScoreResults] = useState<Record<string, StudentScoreLookup>>({});
  const [feedbackResults, setFeedbackResults] = useState<Record<string, StudentFeedbackLookup>>({});
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [studentDomain, setStudentDomain] = useState<string>('Data Science');
  const [studentPlan, setStudentPlan] = useState<string>('Internship');

  const scoreSummary = useMemo<Record<string, ScoreSummary | null>>(() => {
    const summaries: Record<string, ScoreSummary | null> = {};
    
    for (const [level, result] of Object.entries(scoreResults)) {
      if (!result || !result.headers || !Array.isArray(result.headers) || !result.row) {
        summaries[level] = null;
        continue;
      }

      const headers = result.headers;
      const row = result.row;

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
        summaries[level] = {
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

      if (level.indexOf('level 2') !== -1 || level.indexOf('2') === 0) {
        summaries[level] = {
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
      } else if (level.indexOf('level 3') !== -1 || level.indexOf('3') === 0) {
        let oneOnOneSession = tableValue(row, headers, ['1on1', 'session']);
        if (isMissingValue(oneOnOneSession)) {
          oneOnOneSession = tableValue(row, headers, ['1-on-1', 'session']);
        }

        let oneOnOnePassFail = tableValue(row, headers, ['1on1', 'pass', 'fail']);
        if (isMissingValue(oneOnOnePassFail)) {
          oneOnOnePassFail = tableValue(row, headers, ['1-on-1', 'pass', 'fail']);
        }

        summaries[level] = {
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
    }
    
    return summaries;
  }, [scoreResults]);

  const feedbackSummary = useMemo<Record<string, Array<{ rowIndex: number; items: Array<{ header: string; value: string }> }>>>(() => {
    const summaries: Record<string, Array<{ rowIndex: number; items: Array<{ header: string; value: string }> }>> = {};
    
    for (const [category, result] of Object.entries(feedbackResults)) {
      if (!result || !result.headers || !Array.isArray(result.headers) || !result.rows) {
        summaries[category] = [];
        continue;
      }

      summaries[category] = result.rows
        .map((row, rowIndex) => {
          const items = result.headers
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
    }
    
    return summaries;
  }, [feedbackResults]);

  // Auto-fetch scores for all levels on component mount
  useEffect(() => {
    const fetchAllScores = async () => {
      const email = getStoredVerifiedEmail();
      if (!email) {
        toast({ 
          title: 'Not authenticated', 
          description: 'Please sign in with Google to view your scores.', 
          variant: 'destructive' 
        });
        return;
      }

      setStudentEmail(email);
      setLoadingScore(true);
      setScoreResults({});

      try {
        // Try to find the student's domain and plan by checking Level 1 first
        let foundDomain = 'Data Science';
        let foundPlan = 'Internship';
        let foundInLevel1 = false;

        // Try all combinations for Level 1 to find the correct domain/plan
        for (const domain of domainOptions) {
          for (const plan of planOptions) {
            try {
              const result = await lookupStudentScore({
                level: 'Level 1',
                email: email,
                domain,
                plan,
              });
              foundDomain = result.matched.domain;
              foundPlan = result.matched.plan;
              foundInLevel1 = true;
              setScoreResults(prev => ({ ...prev, 'Level 1': result }));
              break;
            } catch (error) {
              // Continue trying other combinations
            }
          }
          if (foundInLevel1) break;
        }

        setStudentDomain(foundDomain);
        setStudentPlan(foundPlan);

        // Fetch Level 2 and Level 3 with the found domain/plan
        const level2Promise = lookupStudentScore({
          level: 'Level 2',
          email,
          domain: foundDomain,
          plan: foundPlan,
        }).catch(() => null);

        const level3Promise = lookupStudentScore({
          level: 'Level 3',
          email,
          domain: foundDomain,
          plan: foundPlan,
        }).catch(() => null);

        const [level2Result, level3Result] = await Promise.all([level2Promise, level3Promise]);

        if (level2Result) {
          setScoreResults(prev => ({ ...prev, 'Level 2': level2Result }));
        }
        if (level3Result) {
          setScoreResults(prev => ({ ...prev, 'Level 3': level3Result }));
        }

        if (!foundInLevel1 && !level2Result && !level3Result) {
          toast({
            title: 'No scores found',
            description: 'Your scores are not available in the database yet.',
            variant: 'destructive',
          });
        }
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

    fetchAllScores();
  }, [toast]);

  // Auto-fetch feedback for all categories on component mount
  useEffect(() => {
    const fetchAllFeedback = async () => {
      const email = getStoredVerifiedEmail();
      if (!email) {
        return;
      }

      setLoadingFeedback(true);
      setFeedbackResults({});

      try {
        // Fetch all feedback categories in parallel
        const feedbackPromises = feedbackOptions.map(async (category) => {
          try {
            const result = await lookupStudentFeedback({
              category,
              email,
            });
            return { category, result };
          } catch (error) {
            return { category, result: null };
          }
        });

        const results = await Promise.all(feedbackPromises);
        
        const feedbackData: Record<string, StudentFeedbackLookup> = {};
        results.forEach(({ category, result }) => {
          if (result) {
            feedbackData[category] = result;
          }
        });

        setFeedbackResults(feedbackData);
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

    fetchAllFeedback();
  }, [toast]);

  return (
    <Layout>
      <div className="container py-8 space-y-6">

        <div className="text-center space-y-2 pb-4 border-b">
          <h1 className="text-2xl font-bold sm:text-3xl">Scores & Feedback</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Check your level-wise scores and evaluation feedback without leaving the portal.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'scores' | 'feedback')} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-2">
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="scores" className="space-y-6">
            {loadingScore ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !studentEmail ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Please sign in with Google to view your scores.</p>
              </div>
            ) : Object.keys(scoreResults).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No scores found for your email in the database.</p>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                {levelOptions.map((level) => {
                  const result = scoreResults[level];
                  const summary = scoreSummary[level];
                  const isLevel1 = level === 'Level 1';
                  const isLevel2 = level === 'Level 2';
                  const isLevel3 = level === 'Level 3';
                  
                  if (!result || !summary) {
                    return (
                      <Card key={level} className="opacity-50">
                        <CardHeader>
                          <CardTitle>{level}</CardTitle>
                          <CardDescription>No data available</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">Scores not found for this level.</p>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={level}>
                      <CardHeader>
                        <CardTitle>{level}</CardTitle>
                        <CardDescription>
                          <Badge variant="secondary">{result.sheetName}</Badge>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge>{summary.email}</Badge>
                          </div>
                          <div className="grid gap-3">
                            {isLevel1 ? (
                              <>
                                <ScoreRow label="Name" value={summary.name || '—'} />
                                <div className="rounded-lg border bg-emerald-50 p-3 text-right">
                                  <p className="text-xs uppercase tracking-wide text-emerald-700">Overall Pass/Fail</p>
                                  <p className="mt-1 text-xl font-semibold text-emerald-900">{summary.overallPassFail || '—'}</p>
                                </div>
                                <ScoreRow label="PPM / Status" value={`${summary.ppm || '—'} / ${summary.ppmStatus || '—'}`} />
                                <ScoreRow label="PPM Attempt" value={formatAttemptCode(summary.ppmAttempt)} />
                                <ScoreRow label="Self Intro / SI Status" value={`${summary.selfIntro || '—'} / ${summary.selfIntroStatus || '—'}`} />
                                <ScoreRow label="Listen & Speak / LS Status" value={`${summary.listenSpeak || '—'} / ${summary.listenSpeakStatus || '—'}`} />
                                <ScoreRow label="Listen & Write / LW Status" value={`${summary.listenWrite || '—'} / ${summary.listenWriteStatus || '—'}`} />
                                <ScoreRow label="Email Writing / EW Status" value={`${summary.emailWriting || '—'} / ${summary.emailWritingStatus || '—'}`} />
                                <ScoreRow label="CSM Pass/Fail" value={summary.csmPassFail || '—'} />
                                <ScoreRow label="CSM Attempt" value={formatAttemptCode(summary.csmAttempt)} />
                              </>
                            ) : isLevel2 ? (
                              <>
                                <ScoreRow label="Name" value={summary.name || '—'} />
                                <div className="rounded-lg border bg-sky-50 p-3 text-right">
                                  <p className="text-xs uppercase tracking-wide text-sky-700">Level 2 (Pass/Fail)</p>
                                  <p className="mt-1 text-xl font-semibold text-sky-900">{summary.level2 || '—'}</p>
                                </div>
                                <ScoreRow label="Aptitude" value={`${summary.selfAptitude || '—'} / ${summary.aptitudeStatus || '—'}`} />
                                <ScoreRow label="Aptitude Attempt" value={formatAttemptCode(summary.saAttempt)} />
                                <ScoreRow label="Behavioural" value={`${summary.behavioural || '—'} / ${summary.behaviouralStatus || '—'}`} />
                                <ScoreRow label="Behavioural Attempt" value={formatAttemptCode(summary.baAttempt)} />
                                <ScoreRow label="Presentation" value={`${summary.presentation || '—'} / ${summary.presentationStatus || '—'}`} />
                                <ScoreRow label="Presentation Attempt" value={formatAttemptCode(summary.prAttempt)} />
                              </>
                            ) : isLevel3 ? (
                              <>
                                <ScoreRow label="Name" value={summary.name || '—'} />
                                <div className="rounded-lg border bg-amber-50 p-3 text-right">
                                  <p className="text-xs uppercase tracking-wide text-amber-700">Level 3 (Pass/Fail)</p>
                                  <p className="mt-1 text-xl font-semibold text-amber-900">{summary.level3PassFail || '—'}</p>
                                </div>
                                <ScoreRow label="TECH MCQ" value={summary.techMcq || '—'} />
                                <ScoreRow label="MCQ Pass/Fail" value={summary.mcqPassFail || '—'} />
                                <ScoreRow label="TMCQ Attempt" value={formatAttemptCode(summary.tmcqAttempt)} />
                                <ScoreRow label="AI MOCK" value={summary.aiMock || '—'} />
                                <ScoreRow label="AI Mock Pass/Fail" value={summary.aiMockPassFail || '—'} />
                                <ScoreRow label="AI Attempt" value={formatAttemptCode(summary.aiAttempt)} />
                                <ScoreRow label="1on1 Session" value={summary.oneOnOneSession || '—'} />
                                <ScoreRow label="1on1 Pass/Fail" value={summary.oneOnOnePassFail || '—'} />
                                <ScoreRow label="1on1 Attempt" value={formatAttemptCode(summary.oneOnOneAttempt)} />
                                <ScoreRow label="Activity Points" value={summary.activityPoints || '—'} />
                                <ScoreRow label="CMA" value={summary.cma || '—'} />
                              </>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="feedback" className="space-y-6">
            {loadingFeedback ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !studentEmail ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Please sign in with Google to view your feedback.</p>
              </div>
            ) : Object.keys(feedbackResults).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No Feedback is found</p>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1">
                {feedbackOptions.map((category) => {
                  const result = feedbackResults[category];
                  const summary = feedbackSummary[category] || [];
                  
                  if (!result || summary.length === 0) {
                    return (
                      <Card key={category} className="opacity-50">
                        <CardHeader>
                          <CardTitle>{category}</CardTitle>
                          <CardDescription>No feedback available</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">No feedback found for this category.</p>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={category}>
                      <CardHeader>
                        <CardTitle>{category}</CardTitle>
                        <CardDescription>
                          <Badge variant="secondary">{result.sheetName}</Badge>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge>{result.email}</Badge>
                            <Badge variant="outline">{result.count ?? result.rows.length} matches</Badge>
                          </div>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {summary.map((entry) => (
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
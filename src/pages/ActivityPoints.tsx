import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { lookupStudentActivityPoints, type StudentActivityPointsLookup } from '@/lib/toolsService';

interface Submission {
  date: string;
  course: string;
  proof: string;
}

type ActivityPointsFormState = {
  email: string;
  domain: string;
  plan: string;
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

const ActivityPoints = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'submit' | 'lookup' | 'submissions'>('submit');
  
  // Submissions state
  const [email, setEmail] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [error, setError] = useState('');
  const apiUrl = import.meta.env.VITE_ACTIVITY_POINTS_API_URL || '';
  
  // Activity Points Lookup state
  const [activityPointsForm, setActivityPointsForm] = useState<ActivityPointsFormState>({
    email: '',
    domain: 'Data Science',
    plan: 'Internship',
  });
  const [domainOptions] = useState<string[]>(['Data Science', 'Programming', 'Electronics']);
  const [planOptions] = useState<string[]>(['Internship', 'Employment']);
  const [loadingActivityPoints, setLoadingActivityPoints] = useState(false);
  const [activityPointsResult, setActivityPointsResult] = useState<StudentActivityPointsLookup | null>(null);

  const activityPointsSummary = useMemo(() => buildActivityPointsSummary(activityPointsResult), [activityPointsResult]);

  const handleCheckSubmissions = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    setLoadingSubmissions(true);
    setError('');
    setSubmissions([]);

    try {
      // Use FormData to avoid CORS preflight requests
      const formData = new FormData();
      formData.append('action', 'getSubmissions');
      formData.append('email', email.trim().toLowerCase());

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success && data.data?.submissions) {
        setSubmissions(data.data.submissions);
        if (data.data.submissions.length === 0) {
          setError('No submissions found for this email');
        }
      } else {
        setError(data.error || 'Failed to fetch submissions');
      }
    } catch (err) {
      setError('Failed to connect to the server. Please try again.');
      console.error(err);
    } finally {
      setLoadingSubmissions(false);
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
      setActiveTab('lookup');
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
      <div className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Section */}
          <div className="text-center space-y-2 pb-4 border-b">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Activity Points
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Fill out this form to claim activity points after completing activities.
            </p>
          </div>

          {/* Tabs for Submit, Lookup, and Submissions */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'submit' | 'lookup' | 'submissions')} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="submit">Submit Activity</TabsTrigger>
              <TabsTrigger value="lookup">Activity Points Lookup</TabsTrigger>
              <TabsTrigger value="submissions">My Submissions</TabsTrigger>
            </TabsList>

            <TabsContent value="submit" className="space-y-4">
              {/* Google Form Embed */}
              <div className="flex justify-center">
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLScKq2iceagaelvu46t0ABdZkXyTB0AVQ5aJM8cDQd6dwlvc6g/viewform?embedded=true"
                  style={{ width: '1100px', height: '700px' }}
                  frameBorder="0"
                  marginHeight={0}
                  marginWidth={0}
                  className="w-full max-w-[1100px]"
                  title="Activity Points Form"
                >
                  Loading…
                </iframe>
              </div>
            </TabsContent>

            <TabsContent value="lookup" className="space-y-6">
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
                          {planOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
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

            <TabsContent value="submissions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Check Your Submissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter your email ID"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCheckSubmissions()}
                    />
                    <Button onClick={handleCheckSubmissions} disabled={loadingSubmissions}>
                      {loadingSubmissions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Check'}
                    </Button>
                  </div>

                  {error && (
                    <div className="text-sm text-red-600">{error}</div>
                  )}

                  {submissions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Found {submissions.length} submission(s)
                      </p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-3 font-medium">Date</th>
                              <th className="text-left p-3 font-medium">Activity</th>
                              <th className="text-left p-3 font-medium">Proof</th>
                            </tr>
                          </thead>
                          <tbody>
                            {submissions.map((sub, index) => (
                              <tr key={index} className="border-t">
                                <td className="p-3">{sub.date}</td>
                                <td className="p-3">{sub.course}</td>
                                <td className="p-3">
                                  {sub.proof ? (
                                    <a
                                      href={sub.proof}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      View
                                    </a>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default ActivityPoints;

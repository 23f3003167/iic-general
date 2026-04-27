import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, RefreshCw } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useToast } from '@/components/ui/use-toast';
import { auth } from '@/lib/firebase';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { getExams, upsertExam } from '@/lib/examsService';
import type { ExamConfig, ExamStatus } from '@/types';

type ExamFormState = {
  examId: string;
  title: string;
  description: string;
  status: ExamStatus;
  startAt: string;
  endAt: string;
  durationMinutes: string;
  eligibleEmailsText: string;
};

const emptyFormState: ExamFormState = {
  examId: '',
  title: '',
  description: '',
  status: 'DRAFT',
  startAt: '',
  endAt: '',
  durationMinutes: '45',
  eligibleEmailsText: '',
};

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

function toDateTimeLocalInput(value?: string): string {
  if (!value) return '';

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 16);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function normalizeDateTimeForSave(value: string): string {
  const text = String(value || '').trim();
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return `${text}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`;
}

function normalizeEmails(text: string): string[] {
  const tokens = text.split(/[\s,;\n\r\t]+/);
  const seen = new Set<string>();
  const emails: string[] = [];
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  tokens.forEach((token) => {
    const email = token.trim().toLowerCase();
    if (!email || !regex.test(email) || seen.has(email)) return;
    seen.add(email);
    emails.push(email);
  });

  return emails;
}

export default function ExamsManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamConfig | null>(null);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [formData, setFormData] = useState<ExamFormState>(emptyFormState);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        navigate('/admin');
        return;
      }

      const allowed = await verifyAdminAccess(user);
      if (!allowed) {
        await signOut(auth);
        toast({
          title: 'Unauthorized',
          description: 'Your account is not allowed to access admin.',
          variant: 'destructive',
        });
        navigate('/admin');
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      setIsAdmin(true);
      setChecking(false);
    });

    return () => unsub();
  }, [navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadExams();
    }
  }, [isAdmin]);

  const loadExams = async () => {
    try {
      setLoading(true);
      setExams(await getExams());
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load exams',
        description: error instanceof Error ? error.message : 'Please verify Apps Script deployment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingExam(null);
    setFormData(emptyFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (exam: ExamConfig) => {
    setEditingExam(exam);
    setFormData({
      examId: exam.examId,
      title: exam.title,
      description: exam.description,
      status: exam.status,
      startAt: toDateTimeLocalInput(exam.startAt),
      endAt: toDateTimeLocalInput(exam.endAt),
      durationMinutes: String(exam.durationMinutes || 45),
      eligibleEmailsText: (exam.eligibleEmails || []).join('\n'),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingExam(null);
    setFormData(emptyFormState);
  };

  const activeExam = useMemo(
    () => exams.find((exam) => exam.status === 'OPEN') || null,
    [exams],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const eligibleEmails = normalizeEmails(formData.eligibleEmailsText);

      if (eligibleEmails.length === 0) {
        throw new Error('Add at least one eligible email.');
      }

      const examId = formData.examId.trim();
      if (!examId) {
        throw new Error('Exam ID is required.');
      }

      const updated = await upsertExam({
        examId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        startAt: normalizeDateTimeForSave(formData.startAt),
        endAt: normalizeDateTimeForSave(formData.endAt),
        durationMinutes: Number(formData.durationMinutes || 0),
        eligibleEmails,
      });

      toast({
        title: editingExam ? 'Exam updated' : 'Exam created',
        description: `${updated.title} saved. Questions were loaded from Questions sheet using testID ${updated.examId}.`,
      });
      closeDialog();
      loadExams();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not save exam',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Exams Management</h2>
          <p className="text-muted-foreground">Create aptitude tests, define the active window, and push eligible emails to the next Students column.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadExams} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Exam
          </Button>
        </div>
      </div>

      {activeExam && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Active Exam</CardTitle>
            <CardDescription>Only one exam should normally be OPEN at a time.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-sm">
            <Badge>{activeExam.examId}</Badge>
            <span>{activeExam.title}</span>
            <span className="text-muted-foreground">{formatDateTime(activeExam.startAt)} to {formatDateTime(activeExam.endAt)}</span>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading exams...</p>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No exams created yet. Create your first aptitude test.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{exam.title}</CardTitle>
                  <Badge variant={exam.status === 'OPEN' ? 'default' : exam.status === 'CLOSED' ? 'destructive' : 'secondary'}>
                    {exam.status}
                  </Badge>
                </div>
                <CardDescription>{exam.examId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground line-clamp-3">{exam.description || 'No description provided.'}</p>
                <p>
                  <span className="font-medium">Window:</span> {formatDateTime(exam.startAt)} to {formatDateTime(exam.endAt)}
                </p>
                <p><span className="font-medium">Duration:</span> {exam.durationMinutes} minutes</p>
                <p><span className="font-medium">Questions:</span> {exam.questions?.length || 0}</p>
                <p><span className="font-medium">Eligible emails:</span> {exam.eligibleEmails?.length || 0}</p>
                <div className="pt-2">
                  <Button variant="outline" className="w-full" onClick={() => openEditDialog(exam)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExam ? 'Edit Exam' : 'Create Exam'}</DialogTitle>
            <DialogDescription>
              Configure the exam window and student eligibility. Questions are fetched from the Questions subsheet by testID.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="examId">Exam ID</Label>
                <Input
                  id="examId"
                  value={formData.examId}
                  onChange={(e) => setFormData({ ...formData, examId: e.target.value })}
                  placeholder="aptitude-july-2026"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Aptitude Test - July 2026"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What the test covers and any instructions for students."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as ExamStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">DRAFT</SelectItem>
                    <SelectItem value="UPCOMING">UPCOMING</SelectItem>
                    <SelectItem value="OPEN">OPEN</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  min={1}
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start At</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={formData.startAt}
                  onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt">End At</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={formData.endAt}
                  onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Questions source: <strong>Questions</strong> subsheet.
              <br />
              Required columns: A testID, B question number, C question, D option A, E option B, F option C, G option D, H correct option, I weight.
            </div>

            <div className="space-y-2">
              <Label htmlFor="eligibleEmailsText">Eligible Student Emails</Label>
              <Textarea
                id="eligibleEmailsText"
                rows={8}
                value={formData.eligibleEmailsText}
                onChange={(e) => setFormData({ ...formData, eligibleEmailsText: e.target.value })}
                placeholder="student1@study.iitm.ac.in\nstudent2@study.iitm.ac.in"
                className="font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                These emails are written into the first blank column of the Students sheet when the exam is saved. New lines are supported.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingExam ? 'Update Exam' : 'Create Exam'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
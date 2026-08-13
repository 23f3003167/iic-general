import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { db } from '@/lib/firebase';
import { fetchAllowedEmails, fetchEvaluatorEmails } from '@/lib/adminAuth';

const parseEmails = (value: string) => Array.from(new Set(
  value
    .split(/\r?\n/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
));

const TeamManagement = () => {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<string[]>([]);
  const [evaluators, setEvaluators] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const invalidLines = useMemo(() => emailInput
    .split(/\r?\n/)
    .map((email) => email.trim())
    .filter(Boolean)
    .filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)), [emailInput]);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const [adminEmails, evaluatorEmails] = await Promise.all([
        fetchAllowedEmails(),
        fetchEvaluatorEmails(),
      ]);
      setAdmins(adminEmails);
      setEvaluators(evaluatorEmails);
    } catch {
      toast({ title: 'Could not load team members', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const updateEvaluators = async (action: 'add' | 'remove') => {
    const emails = parseEmails(emailInput);
    if (!emails.length || invalidLines.length) {
      toast({
        title: 'Enter valid email addresses',
        description: 'Use one valid email address per line.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const current = new Set(evaluators);
      emails.forEach((email) => action === 'add' ? current.add(email) : current.delete(email));
      const nextEvaluators = Array.from(current).sort();
      await setDoc(doc(db, 'admins', 'evaluators'), { emails: nextEvaluators }, { merge: true });
      setEvaluators(nextEvaluators);
      setEmailInput('');
      toast({
        title: action === 'add' ? 'Evaluators added' : 'Evaluators removed',
        description: `${emails.length} email${emails.length === 1 ? '' : 's'} processed.`,
      });
    } catch (error) {
      console.error('Failed to update evaluators:', error);
      toast({ title: 'Could not update evaluators', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground">Manage admin and evaluator access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
          <CardDescription>Admins have access to every admin portal section.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading admins…</p> : (
            <div className="flex flex-wrap gap-2">
              {admins.map((email) => <Badge key={email} variant="secondary">{email}</Badge>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluators</CardTitle>
          <CardDescription>Evaluators can access only Evaluators and Slot Availability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading evaluators…</p> : (
            <div className="flex flex-wrap gap-2">
              {evaluators.length ? evaluators.map((email) => <Badge key={email} variant="secondary">{email}</Badge>) : (
                <p className="text-sm text-muted-foreground">No evaluator access has been granted yet.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder={'evaluator1@example.com\nevaluator2@example.com'}
              aria-label="Evaluator email addresses"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">Enter one email address per line.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={saving} onClick={() => updateEvaluators('add')}>Add evaluators</Button>
            <Button disabled={saving} variant="destructive" onClick={() => updateEvaluators('remove')}>Remove evaluators</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamManagement;

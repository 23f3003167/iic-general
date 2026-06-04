import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { modifyAttempts } from '@/lib/toolsService';

export default function AttemptsManagement() {
  const { toast } = useToast();
  const [emails, setEmails] = useState('');
  const [attemptType, setAttemptType] = useState('FA');
  const [batch, setBatch] = useState('1');
  const [activity, setActivity] = useState('PPM');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      const resp = await modifyAttempts({ emails, attemptType, batch, activity });
      toast({ title: 'Done', description: `Updated ${resp.updated || 0} rows` });
      if (resp.notFound && resp.notFound.length) {
        toast({ title: 'Not found', description: resp.notFound.join(', ') });
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Modify Attempts</h2>

      <div>
        <Label>Emails (comma / newline separated)</Label>
        <Textarea value={emails} onChange={(e: any) => setEmails(e.target.value)} placeholder="student@study.iitm.ac.in, ..." />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Attempt Type</Label>
          <Select onValueChange={(v) => setAttemptType(v)} defaultValue={attemptType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FA">First Attempt (FA)</SelectItem>
              <SelectItem value="RA">ReAttempt (RA)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Batch</Label>
          <Input value={batch} onChange={(e: any) => setBatch(e.target.value)} />
        </div>

        <div>
          <Label>Activity</Label>
          <Select onValueChange={(v) => setActivity(v)} defaultValue={activity}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PPM">PPM (Pre-placement module)</SelectItem>
              <SelectItem value="CSM">CSM (Communication skills)</SelectItem>
              <SelectItem value="SA">SA (Self Aptitude)</SelectItem>
              <SelectItem value="BA">BA (Behavioural Assessment)</SelectItem>
              <SelectItem value="PR">PR (Presentation)</SelectItem>
              <SelectItem value="TMCQ">TMCQ (Tech MCQ)</SelectItem>
              <SelectItem value="AI">AI Mock</SelectItem>
              <SelectItem value="1ON1">1-on-1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Button onClick={handleSubmit} disabled={busy}>{busy ? 'Working...' : 'Apply'}</Button>
      </div>
    </div>
  );
}

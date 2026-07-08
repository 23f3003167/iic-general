import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth } from '@/lib/firebase';
import { listSlotsAvailability, createSlotAvailability, deleteSlotAvailability, getSlotsConfig, setSlotsConfig, createBookingWindowIfNotExists, type SlotAvailability, type SlotsAvailabilityWindow } from '@/lib/firestoreService';
import { getBehavioralInstructors, getPresentationInstructors, type InstructorOption } from '@/lib/toolsService';
import PresentationSlotsOverview from './PresentationSlotsOverview';
import BehavioralSlotsOverview from './BehavioralSlotsOverview';

const SUPER_ADMINS = ['sanjay_k@study.iitm.ac.in', 'jeyalakshmi_a@study.iitm.ac.in'];

const SlotsAvailabilityPage = () => {
  const { toast } = useToast();
  const [availabilities, setAvailabilities] = useState<SlotAvailability[]>([]);
  const [section, setSection] = useState<'behavioral' | 'presentation'>('behavioral');
  const [instructorNumber, setInstructorNumber] = useState('1');
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:10');
  const [duration] = useState({ behavioral: 10, presentation: 15 });
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<SlotsAvailabilityWindow>({
    editingEnabled: false,
    availableDate: '',
    availableStartTime: '',
    availableEndTime: '',
  });
  const [windowDate, setWindowDate] = useState('');
  const [windowStartTime, setWindowStartTime] = useState('09:00');
  const [windowEndTime, setWindowEndTime] = useState('17:00');

  const isSuperAdmin = !!auth.currentUser && SUPER_ADMINS.includes(String(auth.currentUser.email || '').trim().toLowerCase());

  const editingEnabled = useMemo(() => {
    if (!config.editingEnabled) return false;
    if (!config.availableDate) return false;
    const now = new Date();
    const [startHours, startMinutes] = (config.availableStartTime || '00:00').split(':').map(Number);
    const [endHours, endMinutes] = (config.availableEndTime || '23:59').split(':').map(Number);
    const [year, month, day] = config.availableDate.split('-').map(Number);
    const start = new Date(year, month - 1, day, startHours || 0, startMinutes || 0, 0);
    const end = new Date(year, month - 1, day, endHours || 23, endMinutes || 59, 59);
    return now >= start && now <= end;
  }, [config]);

  const canCreateAvailability = editingEnabled;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const cfg = await getSlotsConfig();
        setConfig(cfg);
        setWindowDate(cfg.availableDate || '');
        setWindowStartTime(cfg.availableStartTime || '09:00');
        setWindowEndTime(cfg.availableEndTime || '17:00');
        const [list, ins] = await Promise.all([
          listSlotsAvailability(section),
          section === 'behavioral' ? getBehavioralInstructors() : getPresentationInstructors(),
        ]);

        setAvailabilities(list || []);
        setInstructors(ins || []);
        if (ins.length > 0) setInstructorNumber(ins[0].number);
      } catch (err) {
        console.error(err);
        toast({ title: 'Could not load availability', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const handleCreate = async () => {
    try {
      const ins = instructors.find((i) => i.number === instructorNumber);
      if (!ins) throw new Error('Instructor not selected');
      const payload: SlotAvailability = {
        section,
        instructorNumber,
        instructorName: ins.name,
        date,
        startTime,
        endTime,
        durationMinutes: duration[section],
        active: true,
        createdBy: auth.currentUser?.email || 'unknown',
      };
      if (!endTime) {
        throw new Error('End time is required');
      }
      await createSlotAvailability(payload);
      toast({ title: 'Saved', description: 'Availability saved.' });
      const list = await listSlotsAvailability(section);
      setAvailabilities(list || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Could not save', variant: 'destructive' });
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    try {
      await deleteSlotAvailability(id);
      toast({ title: 'Deleted' });
      const list = await listSlotsAvailability(section);
      setAvailabilities(list || []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const toggleEditing = async () => {
    try {
      const nextEnabled = !config.editingEnabled;
      if (nextEnabled && (!windowDate || !windowStartTime || !windowEndTime)) {
        throw new Error('Set the editing date and time window before enabling editing.');
      }
      const nextConfig: SlotsAvailabilityWindow = {
        editingEnabled: nextEnabled,
        availableDate: nextEnabled ? windowDate : '',
        availableStartTime: nextEnabled ? windowStartTime : '',
        availableEndTime: nextEnabled ? windowEndTime : '',
        updatedBy: auth.currentUser?.email || 'unknown',
        updatedAt: new Date(),
      };
      await setSlotsConfig(nextConfig);
      setConfig(nextConfig);

      if (nextEnabled) {
        // store booking windows for both behavioral and presentation separately, avoid duplicates
        const payload = {
          availableDate: nextConfig.availableDate,
          availableStartTime: nextConfig.availableStartTime,
          availableEndTime: nextConfig.availableEndTime,
          createdBy: nextConfig.updatedBy,
          createdAt: nextConfig.updatedAt,
        } as any;
        await Promise.all([
          createBookingWindowIfNotExists({ type: 'behavioral', ...payload }),
          createBookingWindowIfNotExists({ type: 'presentation', ...payload }),
        ]);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Could not update',
        description: err instanceof Error ? err.message : 'FireStore write failed.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Slots Availability</h2>
      </div>

      <Tabs defaultValue="management" className="space-y-4">
        <TabsList>
          <TabsTrigger value="management">Slot Management</TabsTrigger>
          <TabsTrigger value="presentationOverview">Presentation Overview</TabsTrigger>
          <TabsTrigger value="behavioralOverview">Behavioral Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="space-y-4">
          <div className="flex items-center justify-between">
            {isSuperAdmin ? (
              <div className="flex items-center gap-3">
                {config.editingEnabled ? (
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Open: {config.availableDate || '—'}</div>
                    <div>{config.availableStartTime || '—'} to {config.availableEndTime || '—'}</div>
                    <div>{editingEnabled ? 'Status: open now' : 'Status: closed now'}</div>
                  </div>
                ) : null}
                <Button variant="outline" onClick={toggleEditing}>{config.editingEnabled ? 'Disable Editing' : 'Enable Editing'}</Button>
              </div>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Add Availability</CardTitle>
            </CardHeader>
            <CardContent>
              {!config.editingEnabled ? (
                <p className="text-sm text-muted-foreground">Adding availability is disabled by super admin. Saved availability is still shown below.</p>
              ) : !canCreateAvailability ? (
                <p className="text-sm text-muted-foreground">Adding availability is closed now. It is only open within the configured window. Saved availability is still shown below.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Section</label>
                    <Select value={section} onValueChange={(v) => setSection(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="behavioral">Behavioral</SelectItem>
                        <SelectItem value="presentation">Presentation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Instructor</label>
                    <Select value={instructorNumber} onValueChange={setInstructorNumber}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {instructors.map((ins) => (
                          <SelectItem key={ins.number} value={ins.number}>{ins.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Date</label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Start Time</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">End Time</label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Duration</label>
                    <Input value={`${duration[section]} mins`} disabled />
                  </div>

                  <div className="flex items-end">
                    <Button onClick={handleCreate}>Save Availability</Button>
                  </div>
                </div>
              )}

              {isSuperAdmin ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3 rounded-md border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Editing Date</label>
                    <Input type="date" value={windowDate} onChange={(e) => setWindowDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Editing Start Time</label>
                    <Input type="time" value={windowStartTime} onChange={(e) => setWindowStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Editing End Time</label>
                    <Input type="time" value={windowEndTime} onChange={(e) => setWindowEndTime(e.target.value)} />
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-medium">Existing Availability</h3>
                {availabilities.map((a) => (
                  <div key={a.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium">{a.instructorName || 'Unknown instructor'}</div>
                        <div className="text-sm text-muted-foreground">
                          {a.section} | {a.date || '—'} | {a.startTime || '—'} - {a.endTime || '—'} | {a.durationMinutes || '—'} mins
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {a.id}
                          {a.createdBy ? ` | Created by: ${a.createdBy}` : ''}
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => handleDelete(a.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presentationOverview">
          <PresentationSlotsOverview />
        </TabsContent>

        <TabsContent value="behavioralOverview">
          <BehavioralSlotsOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SlotsAvailabilityPage;

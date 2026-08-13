import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth } from '@/lib/firebase';
import { listSlotsAvailability, createSlotAvailability, createSlotAvailabilityBulk, deleteSlotAvailability, getSlotsConfig, setSlotsConfig, type SlotAvailability, type SlotsAvailabilityWindow } from '@/lib/firestoreService';
import { getBehavioralInstructors, getPresentationInstructors, getOneOnOneInstructors, type InstructorOption } from '@/lib/toolsService';
import PresentationSlotsOverview from './PresentationSlotsOverview';
import BehavioralSlotsOverview from './BehavioralSlotsOverview';
import OneOnOneSlotsOverview from './OneOnOneSlotsOverview';

const SUPER_ADMINS = ['sanjay_k@study.iitm.ac.in', 'jeyalakshmi_a@study.iitm.ac.in'];

type SlotSection = SlotAvailability['section'];

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const toIsoDate = (value: string): string | null => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const to24HourTime = (value: string): string | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (match[3].toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseBulkSlots = (
  csv: string,
  instructorNumbers: Map<string, string>,
  createdBy: string,
): { slots: SlotAvailability[]; errors: string[] } => {
  const [headers, ...rows] = parseCsv(csv);
  const columnIndex = new Map(headers.map((header, index) => [header.replace(/^\uFEFF/, '').trim().toLowerCase(), index]));
  const requiredHeaders = ['section', 'instructor name', 'date', 'start time', 'end time', 'duration'];
  const missingHeaders = requiredHeaders.filter((header) => !columnIndex.has(header));
  if (missingHeaders.length) {
    return { slots: [], errors: [`Missing CSV columns: ${missingHeaders.join(', ')}`] };
  }

  const slots: SlotAvailability[] = [];
  const errors: string[] = [];
  const instructorNumberColumn = ['instructor number', 'instructornumber', 'instructor email', 'instructoremail']
    .find((header) => columnIndex.has(header));
  rows.forEach((row, rowIndex) => {
    const value = (header: string) => row[columnIndex.get(header)!] || '';
    const sourceSection = value('section').replace(/\s/g, '').toLowerCase();
    const section: SlotSection | null = sourceSection === '1on1' || sourceSection === 'oneonone'
      ? 'oneOnOne'
      : sourceSection === 'behavioral' || sourceSection === 'presentation'
        ? sourceSection
        : null;
    const instructorName = value('instructor name').trim();
    const date = toIsoDate(value('date'));
    const startTime = to24HourTime(value('start time'));
    const endTime = to24HourTime(value('end time'));
    const durationMinutes = Number(value('duration'));
    const uploadedInstructorNumber = instructorNumberColumn ? value(instructorNumberColumn).trim() : '';
    const instructorNumber = uploadedInstructorNumber || instructorNumbers.get(instructorName.toLowerCase());

    if (!section || !instructorName || !date || !startTime || !endTime || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      errors.push(`Row ${rowIndex + 2}: invalid section, instructor, date, time, or duration.`);
      return;
    }
    if (!instructorNumber) {
      errors.push(`Row ${rowIndex + 2}: instructor "${instructorName}" was not found. Add an Instructor Number column with their email.`);
      return;
    }

    slots.push({
      section,
      instructorName,
      instructorNumber,
      date,
      startTime,
      endTime,
      durationMinutes,
      domain: value('domain').trim() || undefined,
      active: true,
      createdBy,
    });
  });

  return { slots, errors };
};

const SlotsAvailabilityPage = () => {
  const { toast } = useToast();
  const [availabilities, setAvailabilities] = useState<SlotAvailability[]>([]);
  const [section, setSection] = useState<'behavioral' | 'presentation' | 'oneOnOne'>('behavioral');
  const [instructorNumber, setInstructorNumber] = useState('1');
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [date, setDate] = useState('');
  const [editingStartDate, setEditingStartDate] = useState('');
  const [editingEndDate, setEditingEndDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:10');
  const [duration, setDuration] = useState({ behavioral: 10, presentation: 15, oneOnOne: 30 });
  const [domain, setDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [config, setConfig] = useState<SlotsAvailabilityWindow>({
    editingEnabled: false,
    availableDate: '',
    availableStartTime: '',
    availableEndTime: '',
  });
  const [windowStartTime, setWindowStartTime] = useState('09:00');
  const [windowEndTime, setWindowEndTime] = useState('17:00');

  const isSuperAdmin = !!auth.currentUser && SUPER_ADMINS.includes(String(auth.currentUser.email || '').trim().toLowerCase());

  const editingEnabled = useMemo(() => {
    if (!config.editingEnabled) return false;
    const startDate = config.availableStartDate || config.availableDate;
    const endDate = config.availableEndDate || config.availableDate;
    if (!startDate || !endDate) return false;
    const now = new Date();
    const [startHours, startMinutes] = (config.availableStartTime || '00:00').split(':').map(Number);
    const [endHours, endMinutes] = (config.availableEndTime || '23:59').split(':').map(Number);
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, startHours || 0, startMinutes || 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, endHours || 23, endMinutes || 59, 59);
    return now >= start && now <= end;
  }, [config]);

  const canCreateAvailability = editingEnabled;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const cfg = await getSlotsConfig();
        setConfig(cfg);
        setEditingStartDate(cfg.availableStartDate || cfg.availableDate || '');
        setEditingEndDate(cfg.availableEndDate || cfg.availableDate || '');
        setWindowStartTime(cfg.availableStartTime || '09:00');
        setWindowEndTime(cfg.availableEndTime || '17:00');
        
        const [list, ins] = await Promise.all([
          listSlotsAvailability(section),
          section === 'behavioral' ? getBehavioralInstructors() : 
          section === 'presentation' ? getPresentationInstructors() : 
          getOneOnOneInstructors(),
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
      
      if (section === 'oneOnOne' && !domain) {
        throw new Error('Domain is required for 1on1 slots');
      }
      
      if (!endTime) {
        throw new Error('End time is required');
      }

      // Save to Firestore only for all sections (behavioral, presentation, oneOnOne)
      const payload: SlotAvailability = {
        section,
        instructorNumber,
        instructorName: ins.name,
        date,
        startTime,
        endTime,
        durationMinutes: duration[section],
        domain: section === 'oneOnOne' ? domain : undefined,
        active: true,
        createdBy: auth.currentUser?.email || 'unknown',
      };
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

  const handleBulkUpload = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({ title: 'Upload a CSV file', variant: 'destructive' });
      return;
    }

    setIsBulkUploading(true);
    try {
      const [csv, behavioral, presentation, oneOnOne] = await Promise.all([
        file.text(),
        getBehavioralInstructors(),
        getPresentationInstructors(),
        getOneOnOneInstructors(),
      ]);
      const instructorNumbers = new Map(
        [...behavioral, ...presentation, ...oneOnOne].map((instructor) => [
          instructor.name.trim().toLowerCase(),
          instructor.number,
        ])
      );
      const { slots, errors } = parseBulkSlots(csv, instructorNumbers, auth.currentUser?.email || 'unknown');
      if (!slots.length) {
        throw new Error(errors[0] || 'No valid availability rows were found in the CSV.');
      }

      await createSlotAvailabilityBulk(slots);
      if (slots.some((slot) => slot.section === section)) {
        setAvailabilities(await listSlotsAvailability(section));
      }
      toast({
        title: 'Bulk availability saved',
        description: `${slots.length} slot${slots.length === 1 ? '' : 's'} added${errors.length ? `; ${errors.length} invalid row(s) skipped.` : '.'}`,
      });
    } catch (error) {
      console.error('Bulk upload failed:', error);
      toast({
        title: 'Bulk upload failed',
        description: error instanceof Error ? error.message : 'Could not save the CSV data.',
        variant: 'destructive',
      });
    } finally {
      setIsBulkUploading(false);
    }
  };

  const toggleEditing = async () => {
    try {
      const nextEnabled = !config.editingEnabled;
      if (nextEnabled && (!editingStartDate || !editingEndDate || !windowStartTime || !windowEndTime)) {
        throw new Error('Set the editing start/end dates and times before enabling editing.');
      }
      const nextConfig: SlotsAvailabilityWindow = {
        editingEnabled: nextEnabled,
        availableDate: nextEnabled ? editingStartDate : '',
        availableStartDate: nextEnabled ? editingStartDate : '',
        availableEndDate: nextEnabled ? editingEndDate : '',
        availableStartTime: nextEnabled ? windowStartTime : '',
        availableEndTime: nextEnabled ? windowEndTime : '',
        updatedBy: auth.currentUser?.email || 'unknown',
        updatedAt: new Date(),
      };
      await setSlotsConfig(nextConfig);
      setConfig(nextConfig);
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
          <TabsTrigger value="oneOnOneOverview">1on1 Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="space-y-4">
          <div className="flex items-center justify-between">
            {isSuperAdmin ? (
              <div className="flex items-center gap-3">
                {config.editingEnabled ? (
                  <div className="text-xs text-muted-foreground text-right">
                    <div>Open: {config.availableStartDate || config.availableDate || '—'} to {config.availableEndDate || config.availableDate || '—'}</div>
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
                <div className="space-y-4">
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
                          <SelectItem value="oneOnOne">1on1</SelectItem>
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

                  {section === 'oneOnOne' && (
                    <div>
                      <label className="text-sm font-medium">Domain</label>
                      <Select value={domain} onValueChange={setDomain}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select domain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Data Science">Data Science</SelectItem>
                          <SelectItem value="Programming">Programming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {section === 'oneOnOne' ? (
                    <div>
                      <label className="text-sm font-medium">Duration</label>
                      <Select value={String(duration.oneOnOne)} onValueChange={(v) => setDuration({ ...duration, oneOnOne: Number(v) })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 mins</SelectItem>
                          <SelectItem value="30">30 mins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium">Duration</label>
                      <Input value={`${duration[section]} mins`} disabled />
                    </div>
                  )}

                  <div className="flex items-end">
                    <Button onClick={handleCreate}>Save Availability</Button>
                  </div>
                </div>

                <div className="rounded-md border border-dashed p-4 space-y-2">
                  <div>
                    <h3 className="font-medium">Bulk Adding</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload a CSV with Section, Instructor Name, Date, Start Time, End Time, Domain, and Duration columns. Instructor Number (email) is optional but recommended.
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={isBulkUploading}
                    onChange={(event) => {
                      void handleBulkUpload(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                  {isBulkUploading && <p className="text-sm text-muted-foreground">Saving CSV availability…</p>}
                </div>
              </div>
              )}

              {isSuperAdmin ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3 rounded-md border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Editing Start Date</label>
                    <Input type="date" value={editingStartDate} onChange={(e) => setEditingStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Editing End Date</label>
                    <Input type="date" value={editingEndDate} onChange={(e) => setEditingEndDate(e.target.value)} />
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
                          {a.section} | {a.date || a.startDate || '—'} {a.endDate ? `- ${a.endDate}` : ''} | {a.startTime || '—'} - {a.endTime || '—'} | {a.durationMinutes || '—'} mins {a.domain ? `| Domain: ${a.domain}` : ''}
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

        <TabsContent value="oneOnOneOverview">
          <OneOnOneSlotsOverview />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SlotsAvailabilityPage;

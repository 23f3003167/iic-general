import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createExamSyllabus, createImportantLink, createTrainingLecture, deleteExamSyllabus, deleteImportantLink, deleteTrainingLecture, getExamSyllabi, getImportantLinks, getTrainingLectures, updateExamSyllabus, updateImportantLink, updateTrainingLecture } from '@/lib/firestoreService';
import type { ExamSyllabus, ImportantLink, TrainingLecture } from '@/types';
import { ExternalLink, Link2, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';

type LectureForm = Omit<TrainingLecture, 'id'>;
type LinkForm = Omit<ImportantLink, 'id'>;
type SyllabusForm = Omit<ExamSyllabus, 'id'>;
const emptyLecture: LectureForm = { title: '', videoUrl: '', description: '' };
const emptyLink: LinkForm = { title: '', url: '', description: '' };
const emptySyllabus: SyllabusForm = { title: '', description: '' };

export default function ResourcesManagement() {
  const { toast } = useToast();
  const [lectures, setLectures] = useState<TrainingLecture[]>([]);
  const [links, setLinks] = useState<ImportantLink[]>([]);
  const [syllabi, setSyllabi] = useState<ExamSyllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lectureDialog, setLectureDialog] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false);
  const [syllabusDialog, setSyllabusDialog] = useState(false);
  const [editingLecture, setEditingLecture] = useState<TrainingLecture | null>(null);
  const [editingLink, setEditingLink] = useState<ImportantLink | null>(null);
  const [editingSyllabus, setEditingSyllabus] = useState<ExamSyllabus | null>(null);
  const [lectureForm, setLectureForm] = useState<LectureForm>(emptyLecture);
  const [linkForm, setLinkForm] = useState<LinkForm>(emptyLink);
  const [syllabusForm, setSyllabusForm] = useState<SyllabusForm>(emptySyllabus);

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedLectures, loadedLinks, loadedSyllabi] = await Promise.all([getTrainingLectures(), getImportantLinks(), getExamSyllabi()]);
      setLectures(loadedLectures);
      setLinks(loadedLinks);
      setSyllabi(loadedSyllabi);
    } catch (error) {
      console.error(error);
      toast({ title: 'Unable to load resources', description: 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadResources(); }, [loadResources]);

  const saveLecture = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingLecture) await updateTrainingLecture(editingLecture.id, lectureForm);
      else await createTrainingLecture(lectureForm);
      toast({ title: editingLecture ? 'Lecture updated' : 'Lecture added' });
      setLectureDialog(false); setEditingLecture(null); setLectureForm(emptyLecture); loadResources();
    } catch (error) { console.error(error); toast({ title: 'Could not save lecture', variant: 'destructive' }); }
  };

  const saveLink = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingLink) await updateImportantLink(editingLink.id, linkForm);
      else await createImportantLink(linkForm);
      toast({ title: editingLink ? 'Link updated' : 'Link added' });
      setLinkDialog(false); setEditingLink(null); setLinkForm(emptyLink); loadResources();
    } catch (error) { console.error(error); toast({ title: 'Could not save link', variant: 'destructive' }); }
  };

  const saveSyllabus = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingSyllabus) await updateExamSyllabus(editingSyllabus.id, syllabusForm);
      else await createExamSyllabus(syllabusForm);
      toast({ title: editingSyllabus ? 'Exam syllabus updated' : 'Exam syllabus added' });
      setSyllabusDialog(false); setEditingSyllabus(null); setSyllabusForm(emptySyllabus); loadResources();
    } catch (error) { console.error(error); toast({ title: 'Could not save syllabus', variant: 'destructive' }); }
  };

  const removeLecture = async (id: string) => {
    if (!window.confirm('Delete this lecture?')) return;
    try { await deleteTrainingLecture(id); toast({ title: 'Lecture deleted' }); loadResources(); }
    catch (error) { console.error(error); toast({ title: 'Could not delete lecture', variant: 'destructive' }); }
  };
  const removeLink = async (id: string) => {
    if (!window.confirm('Delete this link?')) return;
    try { await deleteImportantLink(id); toast({ title: 'Link deleted' }); loadResources(); }
    catch (error) { console.error(error); toast({ title: 'Could not delete link', variant: 'destructive' }); }
  };
  const removeSyllabus = async (id: string) => {
    if (!window.confirm('Delete this exam syllabus?')) return;
    try { await deleteExamSyllabus(id); toast({ title: 'Exam syllabus deleted' }); loadResources(); }
    catch (error) { console.error(error); toast({ title: 'Could not delete syllabus', variant: 'destructive' }); }
  };

  return <div className="space-y-10">
    <div><h2 className="text-2xl font-bold">Resources Management</h2><p className="text-muted-foreground">Configure the material students should review before training.</p></div>

    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl font-semibold"><PlayCircle className="h-5 w-5 text-primary" /> Training Lectures</h3><p className="text-sm text-muted-foreground">YouTube and Google Drive videos displayed in the student portal.</p></div><Button onClick={() => { setEditingLecture(null); setLectureForm(emptyLecture); setLectureDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Lecture</Button></div>
      {loading ? <p className="text-muted-foreground">Loading...</p> : lectures.length === 0 ? <Empty message="No lectures added yet." /> : <div className="grid gap-4 md:grid-cols-2">{lectures.map((lecture) => <Card key={lecture.id}><CardHeader><CardTitle className="text-lg">{lecture.title}</CardTitle><CardDescription>{lecture.description}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="truncate text-xs text-muted-foreground">{lecture.videoUrl || lecture.youtubeUrl}</p><Actions onEdit={() => { setEditingLecture(lecture); setLectureForm({ title: lecture.title, videoUrl: lecture.videoUrl || lecture.youtubeUrl || '', description: lecture.description }); setLectureDialog(true); }} onDelete={() => removeLecture(lecture.id)} /></CardContent></Card>)}</div>}
    </section>

    <section className="space-y-4 border-t pt-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-semibold">Exam Syllabi</h3><p className="text-sm text-muted-foreground">Create a separate exam name and syllabus for each of the three exams.</p></div><Button onClick={() => { setEditingSyllabus(null); setSyllabusForm(emptySyllabus); setSyllabusDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Exam Syllabus</Button></div>{loading ? <p className="text-muted-foreground">Loading...</p> : syllabi.length === 0 ? <Empty message="No exam syllabi added yet." /> : <div className="grid gap-4 md:grid-cols-2">{syllabi.map((syllabus) => <Card key={syllabus.id}><CardHeader><CardTitle className="text-lg">{syllabus.title}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{syllabus.description}</p><Actions onEdit={() => { setEditingSyllabus(syllabus); setSyllabusForm({ title: syllabus.title, description: syllabus.description }); setSyllabusDialog(true); }} onDelete={() => removeSyllabus(syllabus.id)} /></CardContent></Card>)}</div>}</section>

    <section className="space-y-4 border-t pt-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl font-semibold"><Link2 className="h-5 w-5 text-primary" /> Important Links</h3><p className="text-sm text-muted-foreground">External links shown alongside the syllabus.</p></div><Button onClick={() => { setEditingLink(null); setLinkForm(emptyLink); setLinkDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Link</Button></div>{loading ? <p className="text-muted-foreground">Loading...</p> : links.length === 0 ? <Empty message="No important links added yet." /> : <div className="grid gap-4 md:grid-cols-2">{links.map((link) => <Card key={link.id}><CardHeader><CardTitle className="text-lg">{link.title}</CardTitle><CardDescription>{link.description}</CardDescription></CardHeader><CardContent className="space-y-4"><a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-sm text-primary hover:underline">Open link <ExternalLink className="h-3 w-3" /></a><Actions onEdit={() => { setEditingLink(link); setLinkForm({ title: link.title, description: link.description, url: link.url }); setLinkDialog(true); }} onDelete={() => removeLink(link.id)} /></CardContent></Card>)}</div>}</section>

    <LectureDialog open={lectureDialog} onOpenChange={setLectureDialog} form={lectureForm} setForm={setLectureForm} editing={Boolean(editingLecture)} onSubmit={saveLecture} />
    <LinkDialog open={linkDialog} onOpenChange={setLinkDialog} form={linkForm} setForm={setLinkForm} editing={Boolean(editingLink)} onSubmit={saveLink} />
    <SyllabusDialog open={syllabusDialog} onOpenChange={setSyllabusDialog} form={syllabusForm} setForm={setSyllabusForm} editing={Boolean(editingSyllabus)} onSubmit={saveSyllabus} />
  </div>;
}

function Empty({ message }: { message: string }) { return <Card><CardContent className="py-8 text-center text-muted-foreground">{message}</CardContent></Card>; }
function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onEdit}><Pencil className="mr-1 h-3 w-3" />Edit</Button><Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="mr-1 h-3 w-3" />Delete</Button></div>; }

function LectureDialog({ open, onOpenChange, form, setForm, editing, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; form: LectureForm; setForm: (form: LectureForm) => void; editing: boolean; onSubmit: (event: React.FormEvent) => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit Lecture' : 'Add Lecture'}</DialogTitle><DialogDescription>Students watch the video in a popup within the portal.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={onSubmit}><Field label="Lecture Title" value={form.title} onChange={(title) => setForm({ ...form, title })} /><Field label="Video Link" type="url" value={form.videoUrl} onChange={(videoUrl) => setForm({ ...form, videoUrl })} placeholder="YouTube or Google Drive share link" /><p className="-mt-2 text-xs text-muted-foreground">For Drive, set the file to “Anyone with the link” before saving.</p><Description value={form.description} onChange={(description) => setForm({ ...form, description })} /><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">{editing ? 'Update' : 'Add'} Lecture</Button></DialogFooter></form></DialogContent></Dialog>; }
function LinkDialog({ open, onOpenChange, form, setForm, editing, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; form: LinkForm; setForm: (form: LinkForm) => void; editing: boolean; onSubmit: (event: React.FormEvent) => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit Link' : 'Add Important Link'}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={onSubmit}><Field label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} /><Field label="URL" type="url" value={form.url} onChange={(url) => setForm({ ...form, url })} /><Description value={form.description} onChange={(description) => setForm({ ...form, description })} /><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">{editing ? 'Update' : 'Add'} Link</Button></DialogFooter></form></DialogContent></Dialog>; }
function SyllabusDialog({ open, onOpenChange, form, setForm, editing, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; form: SyllabusForm; setForm: (form: SyllabusForm) => void; editing: boolean; onSubmit: (event: React.FormEvent) => void }) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit Exam Syllabus' : 'Add Exam Syllabus'}</DialogTitle><DialogDescription>Students will see this as a separate syllabus card.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={onSubmit}><Field label="Exam Name" value={form.title} onChange={(title) => setForm({ ...form, title })} placeholder="e.g. Aptitude Assessment" /><Description value={form.description} onChange={(description) => setForm({ ...form, description })} /><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">{editing ? 'Update' : 'Add'} Syllabus</Button></DialogFooter></form></DialogContent></Dialog>; }
function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { const id = label.toLowerCase().replaceAll(' ', '-'); return <div className="space-y-2"><Label htmlFor={id}>{label} *</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required /></div>; }
function Description({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor="description">Description *</Label><Textarea id="description" value={value} onChange={(event) => onChange(event.target.value)} rows={4} required /></div>; }

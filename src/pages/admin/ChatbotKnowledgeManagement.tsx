import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Plus, Save } from 'lucide-react';
import { getChatbotKnowledgeRows, getChatbotTopics, saveChatbotKnowledgeRow, type ChatbotKnowledgeRow, type ChatbotTopic } from '@/lib/chatbotKnowledgeService';

const emptyRow: Partial<ChatbotKnowledgeRow> = {
  question: '', alternative_questions: '', keywords: '', section_heading: '', content: '', source_url: '', status: 'published',
};

export default function ChatbotKnowledgeManagement() {
  const { toast } = useToast();
  const [topics, setTopics] = useState<ChatbotTopic[]>([]);
  const [rows, setRows] = useState<ChatbotKnowledgeRow[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [form, setForm] = useState<Partial<ChatbotKnowledgeRow>>(emptyRow);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [nextTopics, nextRows] = await Promise.all([getChatbotTopics(), getChatbotKnowledgeRows()]);
      setTopics(nextTopics);
      setRows(nextRows);
      setSelectedTopic((current) => current || nextTopics[0]?.source_id || '');
    } catch (error) {
      toast({ title: 'Unable to load chatbot knowledge', description: String(error), variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const visibleRows = useMemo(() => rows.filter((row) => row.source_id === selectedTopic), [rows, selectedTopic]);
  const setField = (field: keyof ChatbotKnowledgeRow, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const startNew = () => { setEditingId(''); setForm(emptyRow); };
  const startEdit = (row: ChatbotKnowledgeRow) => { setEditingId(row.id); setForm(row); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTopic || !form.question?.trim() || !form.content?.trim()) return;
    try {
      setSaving(true);
      await saveChatbotKnowledgeRow(selectedTopic, { ...form, id: editingId });
      toast({ title: editingId ? 'Knowledge updated' : 'Knowledge added' });
      startNew();
      await load();
    } catch (error) {
      toast({ title: 'Could not save knowledge', description: String(error), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <p className="text-muted-foreground">Loading chatbot knowledge...</p>;

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Chatbot Knowledge</h2><p className="text-muted-foreground">Manage the official answers used by the IIC training assistant.</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card><CardHeader><CardTitle className="text-lg">Add or edit an answer</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={save}>
        <div className="space-y-2"><Label htmlFor="chatbot-topic">Topic *</Label><select id="chatbot-topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.source_id} value={topic.source_id}>{topic.name}</option>)}</select></div>
        <Field label="Question" value={form.question || ''} onChange={(value) => setField('question', value)} />
        <Field label="Alternative questions" value={form.alternative_questions || ''} onChange={(value) => setField('alternative_questions', value)} placeholder="Separate variations with semicolons" />
        <Field label="Keywords" value={form.keywords || ''} onChange={(value) => setField('keywords', value)} placeholder="Separate keywords with commas" />
        <Field label="Section heading" value={form.section_heading || ''} onChange={(value) => setField('section_heading', value)} />
        <div className="space-y-2"><Label htmlFor="chatbot-content">Official answer *</Label><Textarea id="chatbot-content" value={form.content || ''} onChange={(event) => setField('content', event.target.value)} rows={7} required /></div>
        <Field label="Source URL" type="url" value={form.source_url || ''} onChange={(value) => setField('source_url', value)} />
        <div className="flex gap-2"><Button type="submit" disabled={saving || !selectedTopic}>{saving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" />{editingId ? 'Update answer' : 'Add answer'}</>}</Button>{editingId && <Button type="button" variant="outline" onClick={startNew}>Cancel edit</Button>}</div>
      </form></CardContent></Card>
      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-lg">{selectedTopic || 'Topic answers'}</CardTitle><Button size="sm" variant="outline" onClick={startNew}><Plus className="mr-2 h-4 w-4" />New answer</Button></CardHeader><CardContent className="space-y-3">{visibleRows.length === 0 ? <p className="text-sm text-muted-foreground">No answers in this topic yet.</p> : visibleRows.map((row) => <div key={row.id} className="rounded-md border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{row.question}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.content}</p></div><Button size="icon" variant="ghost" onClick={() => startEdit(row)} aria-label="Edit answer"><Pencil className="h-4 w-4" /></Button></div></div>)}</CardContent></Card>
    </div>
  </div>;
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  const id = `chatbot-${label.toLowerCase().replaceAll(' ', '-')}`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}{label === 'Question' ? ' *' : ''}</Label><Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={label === 'Question'} /></div>;
}
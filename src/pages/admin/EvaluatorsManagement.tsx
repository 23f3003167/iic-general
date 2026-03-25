import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { getPendingEvaluations, getUniqueInstructors, submitEvaluation } from '@/lib/evaluatorsService';
import type { BehavioralEvaluation, EvaluationSection, PresentationEvaluation } from '@/types';
import { Loader2, RefreshCw } from 'lucide-react';

type DraftScores = {
  relevance: string;
  clarity: string;
  analyticalSkills: string;
  grammar: string;
  content: string;
  slideComposition: string;
  presentation: string;
  feedback: string;
};

type EvaluationRow = BehavioralEvaluation | PresentationEvaluation;

function initialDraft(section: EvaluationSection, evaluation?: EvaluationRow): DraftScores {
  if (section === 'presentation') {
    const presentationEvaluation = evaluation as PresentationEvaluation | undefined;
    return {
      relevance: '',
      clarity: '',
      analyticalSkills: '',
      grammar: '',
      content: presentationEvaluation?.content != null ? String(presentationEvaluation.content) : '',
      slideComposition: presentationEvaluation?.slideComposition != null ? String(presentationEvaluation.slideComposition) : '',
      presentation: presentationEvaluation?.presentation != null ? String(presentationEvaluation.presentation) : '',
      feedback: presentationEvaluation?.feedback || '',
    };
  }

  const behavioralEvaluation = evaluation as BehavioralEvaluation | undefined;
  return {
    relevance: behavioralEvaluation?.relevance != null ? String(behavioralEvaluation.relevance) : '',
    clarity: behavioralEvaluation?.clarity != null ? String(behavioralEvaluation.clarity) : '',
    analyticalSkills: behavioralEvaluation?.analyticalSkills != null ? String(behavioralEvaluation.analyticalSkills) : '',
    grammar: behavioralEvaluation?.grammar != null ? String(behavioralEvaluation.grammar) : '',
    content: '',
    slideComposition: '',
    presentation: '',
    feedback: behavioralEvaluation?.feedback || '',
  };
}

function parseScore(value: string): number {
  return Number(value.trim());
}

const EvaluatorsManagement = () => {
  const { toast } = useToast();
  const [section, setSection] = useState<EvaluationSection>('behavioral');
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [rows, setRows] = useState<EvaluationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftScores>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadInstructors = async () => {
    setLoadingInstructors(true);
    try {
      const names = await getUniqueInstructors(section);
      setInstructors(names);
      if (names.length === 0) {
        setSelectedInstructor('');
      } else if (!selectedInstructor || !names.includes(selectedInstructor)) {
        setSelectedInstructor(names[0]);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load evaluators',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingInstructors(false);
    }
  };

  const loadPendingRows = async (currentSection: EvaluationSection, instructor: string) => {
    if (!instructor) {
      setRows([]);
      setDrafts({});
      return;
    }

    setLoadingRows(true);
    try {
      const pending = await getPendingEvaluations(currentSection, instructor);
      setRows(pending);

      const nextDrafts: Record<string, DraftScores> = {};
      pending.forEach((item) => {
        nextDrafts[item.id] = initialDraft(currentSection, item);
      });
      setDrafts(nextDrafts);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not load pending rows',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    loadPendingRows(section, selectedInstructor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, selectedInstructor]);

  const updateDraft = (id: string, patch: Partial<DraftScores>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const summary = useMemo(() => {
    return {
      total: rows.length,
      pending: rows.length,
    };
  }, [rows]);

  const handleSubmit = async (row: EvaluationRow) => {
    const draft = drafts[row.id] || initialDraft(section, row);

    setSubmittingId(row.id);
    try {
      if (section === 'behavioral') {
        const relevance = parseScore(draft.relevance);
        const clarity = parseScore(draft.clarity);
        const analyticalSkills = parseScore(draft.analyticalSkills);
        const grammar = parseScore(draft.grammar);

        if (!Number.isFinite(relevance) || relevance < 0 || relevance > 20) {
          toast({ title: 'Invalid score', description: 'Relevance must be between 0 and 20.', variant: 'destructive' });
          return;
        }
        if (!Number.isFinite(clarity) || clarity < 0 || clarity > 30) {
          toast({ title: 'Invalid score', description: 'Clarity must be between 0 and 30.', variant: 'destructive' });
          return;
        }
        if (!Number.isFinite(analyticalSkills) || analyticalSkills < 0 || analyticalSkills > 25) {
          toast({
            title: 'Invalid score',
            description: 'Analytical/Problem-Solving Skills must be between 0 and 25.',
            variant: 'destructive',
          });
          return;
        }
        if (!Number.isFinite(grammar) || grammar < 0 || grammar > 25) {
          toast({ title: 'Invalid score', description: 'Grammar must be between 0 and 25.', variant: 'destructive' });
          return;
        }

        await submitEvaluation(section, {
          id: row.id,
          relevance,
          clarity,
          analyticalSkills,
          grammar,
          feedback: draft.feedback,
        });
      } else {
        const content = parseScore(draft.content);
        const slideComposition = parseScore(draft.slideComposition);
        const presentation = parseScore(draft.presentation);

        if (!Number.isFinite(content) || content < 0 || content > 30) {
          toast({ title: 'Invalid score', description: 'Content must be between 0 and 30.', variant: 'destructive' });
          return;
        }
        if (!Number.isFinite(slideComposition) || slideComposition < 0 || slideComposition > 35) {
          toast({
            title: 'Invalid score',
            description: 'Slide Composition & Organization must be between 0 and 35.',
            variant: 'destructive',
          });
          return;
        }
        if (!Number.isFinite(presentation) || presentation < 0 || presentation > 35) {
          toast({
            title: 'Invalid score',
            description: 'Presentation must be between 0 and 35.',
            variant: 'destructive',
          });
          return;
        }

        await submitEvaluation(section, {
          id: row.id,
          content,
          slideComposition,
          presentation,
          feedback: draft.feedback,
        });
      }

      setRows((prev) => prev.filter((item) => item.id !== row.id));

      toast({
        title: 'Score submitted',
        description: `Saved evaluation for ${row.name}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Could not submit score',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Evaluators</h2>
          <p className="text-muted-foreground">
            Score pending {section === 'behavioral' ? 'behavioral' : 'presentation'} rows from Summary sheet.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadPendingRows(section, selectedInstructor)}
          disabled={loadingRows || !selectedInstructor}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={section} onValueChange={(value) => setSection(value as EvaluationSection)}>
            <TabsList>
              <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
              <TabsTrigger value="presentation">Presentation</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Evaluator</CardTitle>
          <CardDescription>Select evaluator name to load pending rows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[320px_1fr] items-end">
          <div className="space-y-2">
            <p className="text-sm font-medium">Evaluator Name</p>
            <Select value={selectedInstructor} onValueChange={setSelectedInstructor} disabled={loadingInstructors}>
              <SelectTrigger>
                <SelectValue placeholder={loadingInstructors ? 'Loading evaluators...' : 'Select evaluator'} />
              </SelectTrigger>
              <SelectContent>
                {instructors.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Pending rows: {summary.pending}
          </div>
        </CardContent>
      </Card>

      {loadingRows ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Loading pending rows...</p>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">No slots for you today.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const draft = drafts[row.id] || initialDraft(section, row);
            const total = section === 'behavioral'
              ? Number(draft.relevance || 0) +
                Number(draft.clarity || 0) +
                Number(draft.analyticalSkills || 0) +
                Number(draft.grammar || 0)
              : Number(draft.content || 0) +
                Number(draft.slideComposition || 0) +
                Number(draft.presentation || 0);

            return (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="text-base">{row.name}</CardTitle>
                  <CardDescription>
                    {row.email} • {row.slot}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {section === 'behavioral' ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Relevance (20)</p>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={draft.relevance}
                          onChange={(e) => updateDraft(row.id, { relevance: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Clarity (30)</p>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={draft.clarity}
                          onChange={(e) => updateDraft(row.id, { clarity: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Analytical Skills (25)</p>
                        <Input
                          type="number"
                          min={0}
                          max={25}
                          value={draft.analyticalSkills}
                          onChange={(e) => updateDraft(row.id, { analyticalSkills: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Grammar (25)</p>
                        <Input
                          type="number"
                          min={0}
                          max={25}
                          value={draft.grammar}
                          onChange={(e) => updateDraft(row.id, { grammar: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Content (30)</p>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={draft.content}
                          onChange={(e) => updateDraft(row.id, { content: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Slide Composition &amp; Organization (35)</p>
                        <Input
                          type="number"
                          min={0}
                          max={35}
                          value={draft.slideComposition}
                          onChange={(e) => updateDraft(row.id, { slideComposition: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Presentation (35)</p>
                        <Input
                          type="number"
                          min={0}
                          max={35}
                          value={draft.presentation}
                          onChange={(e) => updateDraft(row.id, { presentation: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-sm font-medium">Feedback</p>
                    <Textarea
                      rows={3}
                      value={draft.feedback}
                      onChange={(e) => updateDraft(row.id, { feedback: e.target.value })}
                      placeholder="Enter feedback"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Current Total: {Number.isFinite(total) ? total : 0} / 100
                    </p>
                    <Button onClick={() => handleSubmit(row)} disabled={submittingId === row.id}>
                      {submittingId === row.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Save Score
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EvaluatorsManagement;

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
import type {
  BehavioralEvaluation,
  EvaluationSection,
  OneOnOneEvaluation,
  PresentationEvaluation,
} from '@/types';
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
  technicalProgramming: string;
  technicalDataScience: string;
  communication: string;
  readiness: string;
  exceptional: string;
  tasks: string;
  roles: string;
  detailedFeedback1: string;
};

type EvaluationRow = BehavioralEvaluation | PresentationEvaluation | OneOnOneEvaluation;

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
      technicalProgramming: '',
      technicalDataScience: '',
      communication: '',
      readiness: '',
      exceptional: '',
      tasks: '',
      roles: '',
      detailedFeedback1: '',
    };
  }

  if (section === 'oneOnOne') {
    const oneOnOneEvaluation = evaluation as OneOnOneEvaluation | undefined;
    return {
      relevance: '',
      clarity: '',
      analyticalSkills: '',
      grammar: '',
      content: '',
      slideComposition: '',
      presentation: '',
      feedback: oneOnOneEvaluation?.feedback || '',
      technicalProgramming:
        oneOnOneEvaluation?.technicalProgramming != null ? String(oneOnOneEvaluation.technicalProgramming) : '',
      technicalDataScience:
        oneOnOneEvaluation?.technicalDataScience != null ? String(oneOnOneEvaluation.technicalDataScience) : '',
      communication:
        oneOnOneEvaluation?.communication != null ? String(oneOnOneEvaluation.communication) : '',
      readiness: oneOnOneEvaluation?.readiness || oneOnOneEvaluation?.placementReadiness || '',
      exceptional: oneOnOneEvaluation?.exceptional || '',
      tasks: oneOnOneEvaluation?.tasks || '',
      roles: oneOnOneEvaluation?.roles || '',
      detailedFeedback1: oneOnOneEvaluation?.detailedFeedback1 || '',
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
    technicalProgramming: '',
    technicalDataScience: '',
    communication: '',
    readiness: '',
    exceptional: '',
    tasks: '',
    roles: '',
    detailedFeedback1: '',
  };
}

function parseScore(value: string): number {
  return Number(value.trim());
}

const EvaluatorsManagement = () => {
  const { toast } = useToast();
  const [section, setSection] = useState<EvaluationSection | null>(null);
  const [loadingInstructors, setLoadingInstructors] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [instructors, setInstructors] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [rows, setRows] = useState<EvaluationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftScores>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadInstructors = async () => {
    if (!section) {
      setInstructors([]);
      setSelectedInstructor('');
      setLoadingInstructors(false);
      return;
    }

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
    if (!section) return;
    loadInstructors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    if (!section) return;
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
        if (section === 'presentation') {
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
        } else {
          const technicalProgramming = parseScore(draft.technicalProgramming);
          const technicalDataScience = parseScore(draft.technicalDataScience);
          const communication = parseScore(draft.communication);

          if (!Number.isFinite(technicalProgramming) || technicalProgramming < 0 || technicalProgramming > 5) {
            toast({
              title: 'Invalid score',
              description: 'Technical skills in programming must be between 0 and 5.',
              variant: 'destructive',
            });
            return;
          }
          if (!Number.isFinite(technicalDataScience) || technicalDataScience < 0 || technicalDataScience > 5) {
            toast({
              title: 'Invalid score',
              description: 'Technical skills in data science must be between 0 and 5.',
              variant: 'destructive',
            });
            return;
          }
          if (!Number.isFinite(communication) || communication < 0 || communication > 5) {
            toast({
              title: 'Invalid score',
              description: 'Communication skills must be between 0 and 5.',
              variant: 'destructive',
            });
            return;
          }
          if (!draft.detailedFeedback1.trim()) {
            toast({
              title: 'Missing feedback',
              description: 'Detailed feedback from instructor 1 is required.',
              variant: 'destructive',
            });
            return;
          }

          await submitEvaluation(section, {
            id: row.id,
            technicalProgramming,
            technicalDataScience,
            communication,
            readiness: draft.readiness,
            exceptional: draft.exceptional,
            tasks: draft.tasks,
            roles: draft.roles,
            detailedFeedback1: draft.detailedFeedback1,
          });
        }
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
            {section
              ? `Score pending ${section === 'behavioral' ? 'behavioral' : section === 'presentation' ? 'presentation' : '1on1'} rows.`
              : 'Choose evaluation module to continue.'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => section && loadPendingRows(section, selectedInstructor)}
          disabled={loadingRows || !selectedInstructor || !section}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!section ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Choose Evaluation Module</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setSection('behavioral')}>Behavioral</Button>
                <Button variant="outline" onClick={() => setSection('presentation')}>Presentation</Button>
                <Button variant="outline" onClick={() => setSection('oneOnOne')}>1on1 Session</Button>
              </div>
            </div>
          ) : (
            <Tabs value={section} onValueChange={(value) => setSection(value as EvaluationSection)}>
              <TabsList>
                <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
                <TabsTrigger value="presentation">Presentation</TabsTrigger>
                <TabsTrigger value="oneOnOne">1on1 Session</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {!section ? null : (
        <>

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
              : section === 'presentation'
                ? Number(draft.content || 0) +
                  Number(draft.slideComposition || 0) +
                  Number(draft.presentation || 0)
                : Number(draft.technicalProgramming || 0) +
                  Number(draft.technicalDataScience || 0) +
                  Number(draft.communication || 0);

            const oneOnOneRow = section === 'oneOnOne' ? (row as OneOnOneEvaluation) : null;

            return (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="text-base">{row.name}</CardTitle>
                  <CardDescription>{row.email}</CardDescription>
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
                  ) : section === 'presentation' ? (
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
                  ) : (
                    <>
                      <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-3">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="rounded border bg-background p-2">
                            <p className="text-xs text-muted-foreground">Resume Drive Link</p>
                            {oneOnOneRow?.resumeUrl ? (
                              <a
                                href={oneOnOneRow.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium break-all text-blue-600 underline"
                              >
                                Open Resume
                              </a>
                            ) : (
                              <p className="font-medium">Not available</p>
                            )}
                          </div>
                          <div className="rounded border bg-background p-2">
                            <p className="text-xs text-muted-foreground">Progress Card</p>
                            {oneOnOneRow?.progressCard?.toLowerCase().startsWith('http') ? (
                              <a
                                href={oneOnOneRow.progressCard}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium break-all text-blue-600 underline"
                              >
                                Open Progress Card
                              </a>
                            ) : (
                              <p className="font-medium break-all">{oneOnOneRow?.progressCard || 'Not available'}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          <p><span className="font-medium">Date:</span> {oneOnOneRow?.studentDate || ''}</p>
                          <p><span className="font-medium">Slot:</span> {oneOnOneRow?.slotTime || oneOnOneRow?.slot || ''}</p>
                          <p><span className="font-medium">CGPA:</span> {oneOnOneRow?.cgpa || 'N/A'}</p>
                          <p><span className="font-medium">Domain:</span> {oneOnOneRow?.domain || 'N/A'}</p>
                          <p><span className="font-medium">Plan:</span> {oneOnOneRow?.plan || 'N/A'}</p>
                          <p><span className="font-medium">Placement Readiness:</span> {oneOnOneRow?.placementReadiness || ''}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Technical Skills in Programming (1-5)</p>
                          <Input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            value={draft.technicalProgramming}
                            onChange={(e) => updateDraft(row.id, { technicalProgramming: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Technical Skills in Data Science (1-5)</p>
                          <Input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            value={draft.technicalDataScience}
                            onChange={(e) => updateDraft(row.id, { technicalDataScience: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Communication Skills (1-5)</p>
                          <Input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            value={draft.communication}
                            onChange={(e) => updateDraft(row.id, { communication: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Readiness of the Student for Placement</p>
                          <Select value={draft.readiness || 'BLANK'} onValueChange={(value) => updateDraft(row.id, { readiness: value === 'BLANK' ? '' : value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select readiness" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                              <SelectItem value="Absent">Absent</SelectItem>
                              <SelectItem value="BLANK">Blank</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Performing Exceptionally Good</p>
                          <Select value={draft.exceptional || 'BLANK'} onValueChange={(value) => updateDraft(row.id, { exceptional: value === 'BLANK' ? '' : value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                              <SelectItem value="Absent">Absent</SelectItem>
                              <SelectItem value="BLANK">Blank</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">If Not Ready, Mention Tasks</p>
                        <Textarea
                          rows={2}
                          value={draft.tasks}
                          onChange={(e) => updateDraft(row.id, { tasks: e.target.value })}
                          placeholder="Actionable tasks for student"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Suitable Roles (Recommendations)</p>
                        <Textarea
                          rows={2}
                          value={draft.roles}
                          onChange={(e) => updateDraft(row.id, { roles: e.target.value })}
                          placeholder="Example: Full Stack, Data Analyst"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Detailed Feedback from Instructor 1</p>
                        <Textarea
                          rows={4}
                          value={draft.detailedFeedback1}
                          onChange={(e) => updateDraft(row.id, { detailedFeedback1: e.target.value })}
                          placeholder="Required"
                        />
                      </div>

                    </>
                  )}

                  {section !== 'oneOnOne' && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Feedback</p>
                      <Textarea
                        rows={3}
                        value={draft.feedback}
                        onChange={(e) => updateDraft(row.id, { feedback: e.target.value })}
                        placeholder="Enter feedback"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {section === 'oneOnOne'
                        ? `Current Technical Total: ${Number.isFinite(total) ? total : 0} / 15`
                        : `Current Total: ${Number.isFinite(total) ? total : 0} / 100`}
                    </p>
                    <Button onClick={() => handleSubmit(row)} disabled={submittingId === row.id}>
                      {submittingId === row.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {section === 'oneOnOne' ? 'Save Evaluation' : 'Save Score'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default EvaluatorsManagement;

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { getPendingEvaluations, getUniqueInstructors } from '@/lib/evaluatorsService';
import type { BehavioralEvaluation, PresentationEvaluation } from '@/types';

type ReviewSection = 'behavioral' | 'presentation';
type ReviewEvaluation = BehavioralEvaluation | PresentationEvaluation;

const EvaluatorFeedbackReview = () => {
  const { toast } = useToast();
  const [section, setSection] = useState<ReviewSection | ''>('');
  const [instructors, setInstructors] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [rows, setRows] = useState<ReviewEvaluation[]>([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!section) {
      setInstructors([]);
      setLoadingInstructors(false);
      return;
    }

    let active = true;
    setLoadingInstructors(true);

    getUniqueInstructors(section)
      .then((names) => {
        if (active) setInstructors(names);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
        toast({
          title: 'Could not load evaluators',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) setLoadingInstructors(false);
      });

    return () => {
      active = false;
    };
  }, [section, refreshKey, toast]);

  useEffect(() => {
    if (!section || !selectedInstructor) {
      setRows([]);
      setLoadingRows(false);
      return;
    }

    let active = true;
    setRows([]);
    setLoadingRows(true);

    getPendingEvaluations(section, selectedInstructor)
      .then((evaluations) => {
        if (active) setRows(evaluations);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
        toast({
          title: 'Could not load feedback',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) setLoadingRows(false);
      });

    return () => {
      active = false;
    };
  }, [section, selectedInstructor, refreshKey, toast]);

  const feedbackRows = useMemo(
    () => rows.filter((row) => row.status.toLowerCase() === 'completed' && Boolean(row.feedback?.trim())),
    [rows],
  );

  const handleSectionChange = (value: string) => {
    setSection(value as ReviewSection);
    setInstructors([]);
    setSelectedInstructor('');
    setRows([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Evaluator Feedback Review</h1>
          <p className="text-sm text-muted-foreground">Saved feedback for Behavioral and Presentation evaluations.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={!section || loadingInstructors || loadingRows}
          aria-label="Refresh feedback"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Select the assessment type and evaluator.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="review-section">Assessment type</label>
            <Select value={section} onValueChange={handleSectionChange}>
              <SelectTrigger id="review-section" aria-label="Assessment type">
                <SelectValue placeholder="Choose an assessment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="presentation">Presentation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="review-evaluator">Evaluator</label>
            <Select
              value={selectedInstructor}
              onValueChange={setSelectedInstructor}
              disabled={!section || loadingInstructors || instructors.length === 0}
            >
              <SelectTrigger id="review-evaluator" aria-label="Evaluator">
                <SelectValue placeholder={loadingInstructors ? 'Loading evaluators…' : 'Choose an evaluator'} />
              </SelectTrigger>
              <SelectContent>
                {instructors.map((instructor) => (
                  <SelectItem key={instructor} value={instructor}>{instructor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="h-5 w-5" />
                Saved feedback
              </CardTitle>
              <CardDescription>
                {selectedInstructor ? `${feedbackRows.length} feedback ${feedbackRows.length === 1 ? 'entry' : 'entries'}` : 'Choose both filters to view feedback.'}
              </CardDescription>
            </div>
            {loadingRows ? <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading feedback" /> : null}
          </div>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading feedback…</p>
          ) : !selectedInstructor ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Select an assessment type and evaluator.</p>
          ) : feedbackRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No saved feedback for this evaluator.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-[25%] px-3 py-2 font-medium">Student email</th>
                    <th className="w-[25%] px-3 py-2 font-medium">Slot</th>
                    <th className="w-[50%] px-3 py-2 font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {feedbackRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="break-all px-3 py-3">{row.email}</td>
                      <td className="whitespace-pre-wrap break-words px-3 py-3">{row.slot}</td>
                      <td className="whitespace-pre-wrap break-words px-3 py-3">{row.feedback}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluatorFeedbackReview;
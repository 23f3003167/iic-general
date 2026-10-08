// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EvaluatorFeedbackReview from './EvaluatorFeedbackReview';

const { getPendingEvaluations, getUniqueInstructors, toast } = vi.hoisted(() => ({
  getPendingEvaluations: vi.fn(),
  getUniqueInstructors: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/lib/evaluatorsService', () => ({
  getPendingEvaluations,
  getUniqueInstructors,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast }),
}));

describe('EvaluatorFeedbackReview', () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    getPendingEvaluations.mockReset();
    getUniqueInstructors.mockReset();
    getUniqueInstructors.mockResolvedValue(['Evaluator A']);
    getPendingEvaluations.mockResolvedValue([
      {
        id: 'saved-1',
        instructor: 'Evaluator A',
        slot: '06/10/2026 10:00 AM',
        name: 'Student One',
        email: 'student1@example.com',
        status: 'Completed',
        feedback: 'Clear and specific feedback.',
      },
      {
        id: 'pending-1',
        instructor: 'Evaluator A',
        slot: '06/10/2026 10:15 AM',
        name: 'Student Two',
        email: 'student2@example.com',
        status: 'Pending',
        feedback: '',
      },
      {
        id: 'blank-1',
        instructor: 'Evaluator A',
        slot: '06/10/2026 10:30 AM',
        name: 'Student Three',
        email: 'student3@example.com',
        status: 'Completed',
        feedback: '   ',
      },
    ]);
  });

  it('shows saved feedback with student email and slot for the selected evaluator', async () => {
    render(<EvaluatorFeedbackReview />);

    const selectors = screen.getAllByRole('combobox');
    fireEvent.click(selectors[0]);
    fireEvent.click(await screen.findByRole('option', { name: 'Behavioral' }));

    await waitFor(() => expect(getUniqueInstructors).toHaveBeenCalledWith('behavioral'));
    await waitFor(() => expect((screen.getAllByRole('combobox')[1] as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole('combobox')[1]);
    fireEvent.click(await screen.findByRole('option', { name: 'Evaluator A' }));

    await waitFor(() => expect(getPendingEvaluations).toHaveBeenCalledWith('behavioral', 'Evaluator A'));
    expect(await screen.findByText('Clear and specific feedback.')).toBeTruthy();
    expect(screen.getByText('student1@example.com')).toBeTruthy();
    expect(screen.getByText('06/10/2026 10:00 AM')).toBeTruthy();
    expect(screen.queryByText('student2@example.com')).toBeNull();
    expect(screen.queryByText('student3@example.com')).toBeNull();
  });
});
import { ExternalLink, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { CategoryBadge } from './CategoryBadge';
import type { FormEntry } from '@/types';

interface FormCardProps {
  form: FormEntry;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(timeString?: string): string {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const min = parseInt(minutes);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
}

export function FormCard({ form }: FormCardProps) {
  const isOpen = form.status === 'Open';

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight">
            {form.title}
          </CardTitle>
          <StatusBadge status={form.status} />
        </div>
        <CategoryBadge category={form.category} className="w-fit" />
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pt-0">
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {form.description}
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {formatDate(form.startDate)} {form.startTime && `at ${formatTime(form.startTime)}`}
            </span>
          </div>
          {form.startDate !== form.endDate || form.startTime !== form.endTime ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
              → {formatDate(form.endDate)} {form.endTime && `at ${formatTime(form.endTime)}`}
            </div>
          ) : null}
          <Button
            variant={isOpen ? 'default' : 'secondary'}
            size="sm"
            className="w-full"
            disabled={!isOpen}
            asChild={isOpen}
          >
            {isOpen ? (
              <a
                href={form.formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                Open Form
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span>
                {form.status === 'Upcoming' ? 'Coming Soon' : 'Form Closed'}
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

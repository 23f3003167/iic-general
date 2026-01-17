import { ExternalLink, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { CategoryBadge } from './CategoryBadge';
import type { FormEntry } from '@/data/mockData';

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
              {formatDate(form.startDate)} — {formatDate(form.endDate)}
            </span>
          </div>
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

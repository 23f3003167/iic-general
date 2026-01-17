import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FormSectionProps {
  title: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: 'primary' | 'secondary' | 'muted';
}

export function FormSection({
  title,
  count,
  children,
  defaultOpen = true,
  variant = 'secondary',
}: FormSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="space-y-4">
      <CollapsibleTrigger className="group flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <h2
            className={cn(
              'text-lg font-semibold',
              variant === 'primary' && 'text-primary',
              variant === 'muted' && 'text-muted-foreground'
            )}
          >
            {title}
          </h2>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              variant === 'primary' && 'bg-primary text-primary-foreground',
              variant === 'secondary' && 'bg-secondary text-secondary-foreground',
              variant === 'muted' && 'bg-muted text-muted-foreground'
            )}
          >
            {count}
          </span>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

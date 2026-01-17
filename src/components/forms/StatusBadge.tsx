import { cn } from '@/lib/utils';
import type { FormStatus } from '@/data/mockData';

interface StatusBadgeProps {
  status: FormStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'Open' && 'bg-status-open text-status-open-foreground',
        status === 'Upcoming' && 'bg-status-upcoming text-status-upcoming-foreground',
        status === 'Closed' && 'bg-status-closed text-status-closed-foreground',
        className
      )}
    >
      {status}
    </span>
  );
}

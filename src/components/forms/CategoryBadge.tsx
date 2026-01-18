import { cn } from '@/lib/utils';
import type { FormCategory } from '@/types';

interface CategoryBadgeProps {
  category: FormCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border',
        category === 'Marks' && 'border-category-marks text-category-marks bg-category-marks/10',
        category === 'Training' && 'border-category-training text-category-training bg-category-training/10',
        category === 'Slot' && 'border-category-slot text-category-slot bg-category-slot/10',
        category === 'Other' && 'border-category-other text-category-other bg-category-other/10',
        className
      )}
    >
      {category}
    </span>
  );
}

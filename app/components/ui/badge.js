import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/app/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center font-medium rounded-full transition-colors select-none tabular-nums',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent-light)] text-[var(--accent)] border border-transparent',
        secondary:
          'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]',
        outline:
          'border border-[var(--border)] text-[var(--text-secondary)] bg-transparent',
        success:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
        destructive:
          'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50',
        warning:
          'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px] gap-1',
        md: 'px-2.5 py-1 text-xs gap-1.5',
        lg: 'px-3 py-1.5 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

export function Badge({ className, variant, size, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
  );
}

const chipVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-full cursor-pointer transition-all duration-150 select-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  {
    variants: {
      selected: {
        true: 'bg-[var(--accent)] text-white shadow-sm border border-transparent',
        false: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs gap-1.5',
        md: 'h-8 px-3.5 text-sm gap-2',
        lg: 'h-9 px-4 text-sm gap-2',
      },
    },
    defaultVariants: {
      selected: false,
      size: 'md',
    },
  }
);

export const Chip = React.forwardRef(
  ({ className, selected = false, size, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(chipVariants({ selected, size, className }))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Chip.displayName = 'Chip';
export { badgeVariants, chipVariants };

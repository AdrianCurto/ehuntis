import * as React from 'react';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/app/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent)] text-white hover:opacity-90 shadow-sm',
        secondary:
          'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-[var(--border)]',
        destructive:
          'bg-[var(--destructive)] text-white hover:bg-[var(--destructive-hover)] shadow-sm',
        destructiveOutline:
          'border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/40',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
        accentSubtle:
          'bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-90 font-semibold',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)] gap-1.5',
        md: 'h-10 px-4 text-sm rounded-[var(--radius-md)] gap-2',
        lg: 'h-11 px-5 text-base rounded-[var(--radius-md)] gap-2.5',
        icon: 'h-9 w-9 rounded-[var(--radius-md)] p-0 touch-target-44',
        iconSm: 'h-7 w-7 rounded-[var(--radius-sm)] p-0 text-xs touch-target-44',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export const Button = React.forwardRef(
  ({ className, variant, size, type = 'button', loading = false, disabled, children, ...props }, ref) => {
    const isDisabled = Boolean(disabled || loading);
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { buttonVariants };

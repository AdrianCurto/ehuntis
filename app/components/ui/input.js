import * as React from 'react';
import { cn } from '@/app/utils/cn';

export const Input = React.forwardRef(
  ({ className, type = 'text', startIcon: StartIcon, endIcon: EndIcon, error, ...props }, ref) => {
    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : null;

    return (
      <div className="w-full">
        <div className="relative flex items-center w-full">
          {StartIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[var(--text-muted)]">
              <StartIcon className="w-4 h-4" />
            </div>
          )}
          <input
            type={type}
            ref={ref}
            aria-invalid={hasError || undefined}
            className={cn(
              'flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50',
              hasError && 'border-[var(--destructive)] focus-visible:border-[var(--destructive)] focus-visible:ring-[var(--destructive)]/50',
              StartIcon && 'pl-9',
              EndIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {EndIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-[var(--text-muted)]">
              <EndIcon className="w-4 h-4" />
            </div>
          )}
        </div>
        {errorMessage && (
          <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

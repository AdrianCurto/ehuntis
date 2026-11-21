import * as React from 'react';
import { cn } from '@/app/utils/cn';

export const Textarea = React.forwardRef(
  ({ className, value, defaultValue, onChange, minRows = 2, maxRows = 6, error, ...props }, ref) => {
    const internalRef = React.useRef(null);
    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : null;

    const combinedRef = (node) => {
      internalRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const adjustHeight = React.useCallback(() => {
      const textarea = internalRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 180;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, []);

    React.useEffect(() => {
      if (!value && !defaultValue) return;
      adjustHeight();
    }, [value, defaultValue, adjustHeight]);

    const handleChange = (e) => {
      adjustHeight();
      if (onChange) onChange(e);
    };

    return (
      <div className="w-full">
        <textarea
          ref={combinedRef}
          rows={minRows}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-invalid={hasError || undefined}
          className={cn(
            'flex w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden leading-relaxed',
            hasError && 'border-[var(--destructive)] focus-visible:border-[var(--destructive)] focus-visible:ring-[var(--destructive)]/50',
            className
          )}
          style={{ maxHeight: '180px' }}
          {...props}
        />
        {errorMessage && (
          <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

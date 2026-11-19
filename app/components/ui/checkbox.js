'use client';

import * as React from 'react';
import { Checkbox as AriaCheckbox } from 'react-aria-components';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/app/utils/cn';

export function Checkbox({
  className,
  children,
  checked,
  isSelected,
  onChange,
  disabled,
  isDisabled,
  indeterminate,
  isIndeterminate,
  ...props
}) {
  const selected = isSelected !== undefined ? isSelected : checked;
  const disabledState = isDisabled !== undefined ? isDisabled : disabled;
  const indeterminateState = isIndeterminate !== undefined ? isIndeterminate : indeterminate;

  return (
    <AriaCheckbox
      isSelected={selected}
      onChange={onChange}
      isDisabled={disabledState}
      isIndeterminate={indeterminateState}
      className={cn(
        'group inline-flex items-center gap-2.5 text-sm text-[var(--text-primary)] select-none cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {({ isSelected: sel, isIndeterminate: indet, isFocusVisible }) => (
        <>
          <span
            className={cn(
              'touch-target-44 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150',
              sel || indet
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-xs'
                : 'border-[var(--border)] bg-[var(--surface)] group-hover:border-[var(--accent)]/70',
              isFocusVisible && 'ring-2 ring-[var(--accent)]/50 ring-offset-2 ring-offset-[var(--surface)]'
            )}
          >
            {indet ? (
              <Minus className="h-3 w-3 stroke-[3]" />
            ) : sel ? (
              <Check className="h-3 w-3 stroke-[3]" />
            ) : null}
          </span>
          {children && (
            <div className="flex-1 min-w-0 leading-snug">{children}</div>
          )}
        </>
      )}
    </AriaCheckbox>
  );
}

'use client';

import * as React from 'react';
import { Switch as AriaSwitch } from 'react-aria-components';
import { cn } from '@/app/utils/cn';

export function Switch({
  className,
  children,
  checked,
  isSelected,
  onChange,
  disabled,
  isDisabled,
  ...props
}) {
  const selected = isSelected !== undefined ? isSelected : checked;
  const disabledState = isDisabled !== undefined ? isDisabled : disabled;

  return (
    <AriaSwitch
      isSelected={selected}
      onChange={onChange}
      isDisabled={disabledState}
      className={cn(
        'group inline-flex items-center gap-2.5 text-sm text-[var(--text-primary)] select-none cursor-pointer data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {({ isSelected: sel, isFocusVisible }) => (
        <>
          <span
            className={cn(
              'touch-target-44 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200',
              sel
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--border)] dark:bg-slate-700',
              isFocusVisible && 'ring-2 ring-[var(--accent)]/50 ring-offset-2 ring-offset-[var(--surface)]'
            )}
          >
            <span
              className={cn(
                'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                sel ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </span>
          {children && <span className="leading-snug">{children}</span>}
        </>
      )}
    </AriaSwitch>
  );
}

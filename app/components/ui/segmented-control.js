'use client';

import * as React from 'react';
import { cn } from '@/app/utils/cn';

/**
 * Control segmentado unificado para elegir entre 2 o mas opciones mutuamente excluyentes.
 * Mantiene una identidad visual diferenciada de Tabs (pildora neutra elevada con borde sutil).
 */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}) {
  const handleKeyDown = (e, idx) => {
    if (options.length < 2) return;
    let nextIdx = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = (idx + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = (idx - 1 + options.length) % options.length;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      onChange?.(options[nextIdx].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-grid w-full p-1 rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] border border-[var(--border)] gap-1',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange?.(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] font-semibold transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
              size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-xs',
              isSelected
                ? 'bg-[var(--surface-elevated)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs dark:border-white/10'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

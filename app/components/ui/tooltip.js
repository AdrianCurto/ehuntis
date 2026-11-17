'use client';

import * as React from 'react';
import {
  TooltipTrigger as AriaTooltipTrigger,
  Tooltip as AriaTooltip,
  OverlayArrow,
} from 'react-aria-components';
import { cn } from '@/app/utils/cn';

export function Tooltip({
  content,
  children,
  delay = 350,
  closeDelay = 100,
  placement = 'top',
  offset = 6,
  className,
}) {
  if (!content) return children;

  return (
    <AriaTooltipTrigger delay={delay} closeDelay={closeDelay}>
      {children}
      <AriaTooltip
        placement={placement}
        offset={offset}
        className={cn(
          'z-[120] max-w-xs rounded-[var(--radius-md)] border border-[var(--border)] bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-50 shadow-lg dark:bg-slate-800 dark:text-slate-100',
          'data-[entering]:animate-[fadeIn_0.12s_ease] motion-reduce:data-[entering]:animate-none',
          className
        )}
      >
        <OverlayArrow>
          <svg
            width={8}
            height={8}
            viewBox="0 0 8 8"
            className="fill-slate-900 dark:fill-slate-800"
          >
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        {content}
      </AriaTooltip>
    </AriaTooltipTrigger>
  );
}

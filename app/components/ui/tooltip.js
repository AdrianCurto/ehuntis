'use client';

import * as React from 'react';
import {
  TooltipTrigger as AriaTooltipTrigger,
  Tooltip as AriaTooltip,
  OverlayArrow,
} from 'react-aria-components';
import { Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
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

/**
 * Toggletip accesible (icono "i") que funciona tanto con toque en móvil como con hover/clic/teclado en escritorio.
 * Detiene la propagación de clic para poder colocarse dentro de cabeceras desplegables sin abrir el acordeón.
 */
export function InfoToggletip({
  content,
  ariaLabel = 'Más información',
  side = 'top',
  align = 'start',
  className,
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimerRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!content) return null;

  const supportsHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (!supportsHover()) return;
    cancelClose();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    if (!supportsHover()) return;
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 120);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
            }
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            'touch-target-44 inline-flex items-center justify-center w-5 h-5 rounded-full text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
            open && 'text-[var(--accent)] bg-[var(--accent-light)]',
            className
          )}
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="tooltip"
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="z-[120] max-w-[min(280px,calc(100vw-32px))] rounded-[var(--radius-md)] border border-[var(--border)] dark:border-white/12 bg-[var(--surface-elevated)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--text-primary)] shadow-lg"
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}

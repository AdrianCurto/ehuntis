'use client';

import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import posthog from 'posthog-js';
import {
  dismissWidgetsBanner,
  isWidgetsBannerDismissed,
  shouldShowWidgetsBanner,
} from '@/app/utils/widgetsBanner';
import { cn } from '@/app/utils/cn';

const COLLAPSE_DURATION_MS = 180;
const emptySubscribe = () => () => {};

function useStoredBannerDismissed() {
  return useSyncExternalStore(
    emptySubscribe,
    () => isWidgetsBannerDismissed(),
    () => true
  );
}

function WidgetsLaunchBanner({ hasSchedule, isSwapModeActive }) {
  const storedDismissed = useStoredBannerDismissed();
  const [localDismissed, setLocalDismissed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const isVisible = shouldShowWidgetsBanner({
    hasSchedule,
    isSwapModeActive,
    isDismissed: storedDismissed || localDismissed,
  });

  if (!isVisible) return null;

  const handleDismiss = () => {
    if (isClosing) return;

    dismissWidgetsBanner();
    try {
      posthog?.capture?.('widgets_banner_dismissed');
    } catch (_) {}

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (prefersReducedMotion) {
      setLocalDismissed(true);
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setLocalDismissed(true);
    }, COLLAPSE_DURATION_MS);
  };

  const handleGuideClick = () => {
    dismissWidgetsBanner();
    try {
      posthog?.capture?.('widgets_banner_clicked');
    } catch (_) {}
    setLocalDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Novedad de widgets"
      className={cn(
        'shrink-0 grid transition-[grid-template-rows,opacity] duration-[180ms] ease-out motion-reduce:transition-none',
        isClosing ? 'grid-rows-[0fr] opacity-0 pointer-events-none' : 'grid-rows-[1fr] opacity-100'
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 min-w-0',
            'bg-[#4F6EF7]/[0.08] border-b border-[#4F6EF7]/20 text-[var(--text-primary)]',
            'dark:bg-[#6366F1]/[0.14] dark:border-[#6366F1]/25'
          )}
        >
          <span className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white leading-none select-none">
            NUEVO
          </span>

          <p className="flex-1 min-w-0 text-xs font-medium leading-snug text-[var(--text-primary)]">
            <span className="sm:hidden">Widgets ya disponibles para Android e iOS</span>
            <span className="hidden sm:inline">
              Ya puedes llevar tu horario como widget en Android e iOS.
            </span>
          </p>

          <Link
            href="/widgets"
            onClick={handleGuideClick}
            className="shrink-0 whitespace-nowrap rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
          >
            Ver guía
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar aviso de widgets"
            className="shrink-0 -mr-1 p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(WidgetsLaunchBanner);

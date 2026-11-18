'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/app/utils/cn';
import {
  SHEET_DRAG_DEADZONE_PX,
  shouldDismissSheet,
  getSheetExitDurationMs,
} from '@/app/utils/sheetGestures';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 animate-[fadeIn_0.15s_ease] motion-reduce:animate-none',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

export const SheetContent = React.forwardRef(
  ({ className, children, showCloseButton = true, showHandle = true, onOpenAutoFocus, style, ...props }, ref) => {
    const contentRef = React.useRef(null);
    const overlayRef = React.useRef(null);
    const settleTimerRef = React.useRef(null);
    const dragRef = React.useRef({
      active: false,
      dragging: false,
      fromHandle: false,
      startX: 0,
      startY: 0,
      currentY: 0,
      lastY: 0,
      lastTime: 0,
      velocityY: 0,
      closing: false,
    });

    React.useEffect(() => {
      return () => {
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
        }
      };
    }, []);

    const mergedRef = React.useCallback(
      (node) => {
        contentRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    const triggerClose = () => {
      const closeBtn = contentRef.current?.querySelector('[data-sheet-close]');
      if (closeBtn) {
        closeBtn.click();
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    };

    const isInsideScrollableOrNoDrag = (target) => {
      if (!target || !contentRef.current) return false;
      if (target.closest?.('[data-sheet-no-drag]')) return true;
      let node = target;
      while (node && node !== contentRef.current) {
        if (node instanceof HTMLElement) {
          const { overflowY } = window.getComputedStyle(node);
          const canScrollY =
            (overflowY === 'auto' || overflowY === 'scroll') &&
            node.scrollHeight > node.clientHeight + 1;
          if (canScrollY && node.scrollTop > 0) {
            return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    };

    const resetInlineMotion = () => {
      if (contentRef.current) {
        contentRef.current.style.transform = '';
        contentRef.current.style.transition = '';
        contentRef.current.style.willChange = '';
      }
      if (overlayRef.current) {
        overlayRef.current.style.opacity = '';
        overlayRef.current.style.transition = '';
      }
    };

    const handleTouchStart = (e) => {
      e.stopPropagation();
      const drag = dragRef.current;
      if (drag.closing || e.touches.length !== 1) return;

      const fromHandle = Boolean(e.target.closest?.('[data-sheet-handle]'));
      if (!fromHandle && isInsideScrollableOrNoDrag(e.target)) {
        drag.active = false;
        drag.dragging = false;
        return;
      }

      const scrollable = contentRef.current?.querySelector('[data-sheet-scroll]') || contentRef.current;
      const scrollTop = scrollable ? scrollable.scrollTop : 0;

      if (fromHandle || scrollTop <= 0) {
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
        const touch = e.touches[0];
        drag.active = true;
        drag.dragging = false;
        drag.fromHandle = fromHandle;
        drag.startX = touch.clientX;
        drag.startY = touch.clientY;
        drag.currentY = 0;
        drag.lastY = touch.clientY;
        drag.lastTime = performance.now();
        drag.velocityY = 0;
      } else {
        drag.active = false;
        drag.dragging = false;
      }
    };

    const handleTouchMove = (e) => {
      e.stopPropagation();
      const drag = dragRef.current;
      if (!drag.active || drag.closing || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - drag.startY;
      const deltaX = touch.clientX - drag.startX;

      if (!drag.dragging) {
        if (deltaY < -4 && !drag.fromHandle) {
          drag.active = false;
          return;
        }
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SHEET_DRAG_DEADZONE_PX) {
          drag.active = false;
          return;
        }
        if (deltaY <= SHEET_DRAG_DEADZONE_PX) {
          return;
        }
        drag.dragging = true;
        if (contentRef.current) {
          contentRef.current.style.animation = 'none';
          contentRef.current.style.willChange = 'transform';
        }
      }

      const offsetY = Math.max(0, deltaY - SHEET_DRAG_DEADZONE_PX);
      const now = performance.now();
      const dt = now - drag.lastTime;
      if (dt > 0) {
        const instantVelocity = (touch.clientY - drag.lastY) / dt;
        drag.velocityY = drag.velocityY * 0.4 + instantVelocity * 0.6;
      }
      drag.currentY = offsetY;
      drag.lastY = touch.clientY;
      drag.lastTime = now;

      const contentEl = contentRef.current;
      if (contentEl) {
        contentEl.style.transition = 'none';
        contentEl.style.transform = `translate3d(0, ${offsetY}px, 0)`;
      }

      const overlayEl = overlayRef.current;
      if (overlayEl) {
        const sheetHeight = contentEl?.offsetHeight || window.innerHeight * 0.6;
        const progress = Math.min(1, offsetY / Math.max(1, sheetHeight));
        overlayEl.style.transition = 'none';
        overlayEl.style.opacity = String(Math.max(0, 1 - progress * 0.9));
      }
    };

    const handleTouchEnd = (e) => {
      e.stopPropagation();
      const drag = dragRef.current;
      if (!drag.active || drag.closing) return;

      const wasDragging = drag.dragging;
      const offsetY = drag.currentY;
      const velocityY = drag.velocityY;

      drag.active = false;
      drag.dragging = false;
      drag.fromHandle = false;
      drag.currentY = 0;

      if (!wasDragging) return;

      const contentEl = contentRef.current;
      const overlayEl = overlayRef.current;
      const sheetHeight = contentEl?.offsetHeight || 400;

      if (shouldDismissSheet(offsetY, sheetHeight, velocityY)) {
        drag.closing = true;
        const durationMs = getSheetExitDurationMs(offsetY, sheetHeight, velocityY);
        if (contentEl) {
          contentEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.32, 0.72, 0, 1)`;
          contentEl.style.transform = 'translate3d(0, 100%, 0)';
        }
        if (overlayEl) {
          overlayEl.style.transition = `opacity ${durationMs}ms ease-out`;
          overlayEl.style.opacity = '0';
        }
        settleTimerRef.current = setTimeout(() => {
          settleTimerRef.current = null;
          triggerClose();
        }, durationMs);
      } else {
        if (contentEl) {
          contentEl.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
          contentEl.style.transform = 'translate3d(0, 0, 0)';
        }
        if (overlayEl) {
          overlayEl.style.transition = 'opacity 220ms ease-out';
          overlayEl.style.opacity = '1';
        }
        settleTimerRef.current = setTimeout(() => {
          settleTimerRef.current = null;
          resetInlineMotion();
        }, 270);
      }
    };

    return (
      <SheetPortal>
        <SheetOverlay ref={overlayRef} />
        <SheetPrimitive.Content
          ref={mergedRef}
          onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={style}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-[22px] border-t border-[var(--border)] dark:border-t-white/10 bg-[var(--surface-elevated)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl dark:shadow-[0_-16px_48px_rgba(0,0,0,0.75)] outline-none overflow-y-auto overscroll-contain animate-[slideUp_0.22s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none',
            className
          )}
          {...props}
        >
          {showHandle && (
            <div
              data-sheet-handle="true"
              className="flex w-full shrink-0 items-center justify-center pt-2 pb-2.5 cursor-grab active:cursor-grabbing select-none touch-none"
              aria-hidden="true"
            >
              <div className="h-1.5 w-11 rounded-full bg-current opacity-20" />
            </div>
          )}
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close
              data-sheet-close="true"
              className="touch-target-44 absolute right-4 top-4 z-20 rounded-full p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = 'SheetContent';

export const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 text-left mb-2', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

export const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col gap-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[var(--border-light)] mt-auto',
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

export const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold leading-snug tracking-tight text-[var(--text-primary)] font-[var(--font-display)]', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

export const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-secondary)]', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

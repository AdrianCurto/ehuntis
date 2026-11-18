'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/app/utils/cn';

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
    const touchStartY = React.useRef(null);
    const touchStartFromHandle = React.useRef(false);
    const contentRef = React.useRef(null);
    const [dragY, setDragY] = React.useState(0);
    const [isDragging, setIsDragging] = React.useState(false);

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

    const handleTouchStart = (e) => {
      e.stopPropagation();
      const fromHandle = Boolean(e.target.closest?.('[data-sheet-handle]'));
      if (!fromHandle && isInsideScrollableOrNoDrag(e.target)) {
        touchStartY.current = null;
        touchStartFromHandle.current = false;
        return;
      }

      const scrollable = contentRef.current?.querySelector('[data-sheet-scroll]') || contentRef.current;
      const scrollTop = scrollable ? scrollable.scrollTop : 0;

      if (fromHandle || scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY;
        touchStartFromHandle.current = fromHandle;
        setIsDragging(false);
      } else {
        touchStartY.current = null;
        touchStartFromHandle.current = false;
      }
    };

    const handleTouchMove = (e) => {
      e.stopPropagation();
      if (touchStartY.current === null) return;
      const deltaY = e.touches[0].clientY - touchStartY.current;
      if (deltaY > 8) {
        setIsDragging(true);
        setDragY(Math.min(deltaY, 240));
      } else if (deltaY < 0 && !touchStartFromHandle.current) {
        touchStartY.current = null;
        setDragY(0);
        setIsDragging(false);
      }
    };

    const handleTouchEnd = (e) => {
      e.stopPropagation();
      if (touchStartY.current === null) return;
      if (dragY > 68) {
        setDragY(0);
        setIsDragging(false);
        triggerClose();
      } else {
        setDragY(0);
        setIsDragging(false);
      }
      touchStartY.current = null;
      touchStartFromHandle.current = false;
    };

    const combinedStyle = {
      ...style,
      ...(dragY > 0
        ? {
            transform: `translateY(${dragY}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }
        : {}),
    };

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={mergedRef}
          onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={combinedStyle}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-[22px] border-t border-[var(--border)] dark:border-t-white/10 bg-[var(--surface-elevated)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl dark:shadow-[0_-16px_48px_rgba(0,0,0,0.75)] outline-none overflow-y-auto overscroll-contain animate-[slideUp_0.22s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none',
            className
          )}
          {...props}
        >
          {showHandle && (
            <div
              data-sheet-handle="true"
              className="flex w-full shrink-0 items-center justify-center pt-2 pb-2.5 cursor-grab active:cursor-grabbing select-none"
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

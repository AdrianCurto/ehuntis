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
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 animate-[fadeIn_0.15s_ease]',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

export const SheetContent = React.forwardRef(
  ({ className, children, showCloseButton = true, onOpenAutoFocus, ...props }, ref) => {
    const touchStartY = React.useRef(null);

    const handleTouchStart = (e) => {
      if (e.currentTarget.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
      } else {
        touchStartY.current = null;
      }
    };

    const handleTouchEnd = (e) => {
      if (touchStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY > 60 && e.currentTarget.scrollTop === 0) {
        const closeBtn = e.currentTarget.querySelector('[data-sheet-close]');
        if (closeBtn) {
          closeBtn.click();
        }
      }
      touchStartY.current = null;
    };

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={ref}
          onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] max-h-[85vh] flex-col rounded-t-[22px] border-t border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl outline-none overflow-y-auto overscroll-contain animate-[slideUp_0.22s_cubic-bezier(0.16,1,0.3,1)]',
            className
          )}
          {...props}
        >
          <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-current opacity-20 shrink-0 pointer-events-none" />
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close
              data-sheet-close="true"
              className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 cursor-pointer"
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
    className={cn('flex flex-col gap-2 pt-4 border-t border-[var(--border-light)] mt-auto', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

export const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold leading-none tracking-tight text-[var(--text-primary)] font-[var(--font-display)]', className)}
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

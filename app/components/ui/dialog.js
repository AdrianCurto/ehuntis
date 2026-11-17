'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/app/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 animate-[fadeIn_0.15s_ease] motion-reduce:animate-none',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef(
  ({ className, children, showCloseButton = true, onOpenAutoFocus, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-[var(--radius-xl)] border border-[var(--border)] dark:border-t-white/10 bg-[var(--surface-elevated)] p-6 shadow-2xl dark:shadow-[0_24px_60px_rgba(0,0,0,0.75)] transition-all duration-200 outline-none max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain animate-[fadeScaleIn_0.16s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="touch-target-44 absolute right-4 top-4 z-20 rounded-full p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-[var(--border-light)]', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold leading-snug tracking-tight text-[var(--text-primary)] font-[var(--font-display)]', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-secondary)]', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

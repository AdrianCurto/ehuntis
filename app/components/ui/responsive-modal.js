'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './sheet';
import { useIsDesktop } from '@/app/utils/useMediaQuery';

export function ResponsiveModal({
  open,
  onOpenChange,
  children,
  ...props
}) {
  const isDesktop = useIsDesktop();

  if (!open) return null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} {...props}>
        {children}
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} {...props}>
      {children}
    </Sheet>
  );
}

export function ResponsiveModalContent({ className, children, ...props }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogContent className={className} {...props}>
        {children}
      </DialogContent>
    );
  }

  return (
    <SheetContent className={className} {...props}>
      {children}
    </SheetContent>
  );
}

export function ResponsiveModalHeader({ className, children, ...props }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogHeader className={className} {...props}>
        {children}
      </DialogHeader>
    );
  }

  return (
    <SheetHeader className={className} {...props}>
      {children}
    </SheetHeader>
  );
}

export function ResponsiveModalTitle({ className, children, ...props }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogTitle className={className} {...props}>
        {children}
      </DialogTitle>
    );
  }

  return (
    <SheetTitle className={className} {...props}>
      {children}
    </SheetTitle>
  );
}

export function ResponsiveModalDescription({ className, children, ...props }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogDescription className={className} {...props}>
        {children}
      </DialogDescription>
    );
  }

  return (
    <SheetDescription className={className} {...props}>
      {children}
    </SheetDescription>
  );
}

export function ResponsiveModalFooter({ className, children, ...props }) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogFooter className={className} {...props}>
        {children}
      </DialogFooter>
    );
  }

  return (
    <SheetFooter className={className} {...props}>
      {children}
    </SheetFooter>
  );
}

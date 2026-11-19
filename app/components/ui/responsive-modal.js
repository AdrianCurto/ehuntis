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
import { cn } from '@/app/utils/cn';

export const ResponsiveModalScrollContext = React.createContext({
  isScrolledTop: false,
  isScrolledBottom: false,
  setIsScrolledTop: () => {},
  setIsScrolledBottom: () => {},
});

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

export function ResponsiveModalContent({ className, children, onBeforeDismiss, ...props }) {
  const isDesktop = useIsDesktop();
  const [isScrolledTop, setIsScrolledTop] = React.useState(false);
  const [isScrolledBottom, setIsScrolledBottom] = React.useState(false);

  const scrollContextValue = React.useMemo(
    () => ({
      isScrolledTop,
      isScrolledBottom,
      setIsScrolledTop,
      setIsScrolledBottom,
    }),
    [isScrolledTop, isScrolledBottom]
  );

  const content = (
    <ResponsiveModalScrollContext.Provider value={scrollContextValue}>
      {children}
    </ResponsiveModalScrollContext.Provider>
  );

  if (isDesktop) {
    return (
      <DialogContent className={className} {...props}>
        {content}
      </DialogContent>
    );
  }

  return (
    <SheetContent className={className} onBeforeDismiss={onBeforeDismiss} {...props}>
      {content}
    </SheetContent>
  );
}

export function ResponsiveModalHeader({ className, children, ...props }) {
  const { isScrolledTop } = React.useContext(ResponsiveModalScrollContext);
  const isDesktop = useIsDesktop();
  const headerClass = cn(
    'transition-shadow duration-150',
    isScrolledTop && 'shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
    className
  );

  if (isDesktop) {
    return (
      <DialogHeader className={headerClass} {...props}>
        {children}
      </DialogHeader>
    );
  }

  return (
    <SheetHeader className={headerClass} {...props}>
      {children}
    </SheetHeader>
  );
}

export const ResponsiveModalBody = React.forwardRef(
  ({ className, children, onScroll, ...props }, ref) => {
    const bodyRef = React.useRef(null);
    const { setIsScrolledTop, setIsScrolledBottom } = React.useContext(ResponsiveModalScrollContext);

    const updateScrollMetrics = React.useCallback(
      (el) => {
        if (!el) return;
        const scrolledTop = el.scrollTop > 2;
        const scrolledBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 2;
        setIsScrolledTop?.(scrolledTop);
        setIsScrolledBottom?.(scrolledBottom);
      },
      [setIsScrolledTop, setIsScrolledBottom]
    );

    const handleScroll = React.useCallback(
      (e) => {
        updateScrollMetrics(e.currentTarget);
        onScroll?.(e);
      },
      [updateScrollMetrics, onScroll]
    );

    React.useEffect(() => {
      const el = bodyRef.current;
      if (!el) return;
      updateScrollMetrics(el);
      const ro = new ResizeObserver(() => updateScrollMetrics(el));
      ro.observe(el);
      return () => ro.disconnect();
    }, [updateScrollMetrics]);

    return (
      <div
        ref={(node) => {
          bodyRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-sheet-scroll="true"
        onScroll={handleScroll}
        className={cn('flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ResponsiveModalBody.displayName = 'ResponsiveModalBody';

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
  const { isScrolledBottom } = React.useContext(ResponsiveModalScrollContext);
  const isDesktop = useIsDesktop();
  const footerClass = cn(
    'transition-shadow duration-150',
    isScrolledBottom && 'shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.35)]',
    className
  );

  if (isDesktop) {
    return (
      <DialogFooter className={footerClass} {...props}>
        {children}
      </DialogFooter>
    );
  }

  return (
    <SheetFooter className={footerClass} {...props}>
      {children}
    </SheetFooter>
  );
}

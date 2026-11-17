'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/app/utils/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-11 items-stretch justify-center rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] p-1 text-[var(--text-secondary)] border border-[var(--border)] gap-1',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex h-full w-full min-w-0 items-center justify-center text-center rounded-[var(--radius-md)] px-1.5 sm:px-3 py-1 text-[11.5px] sm:text-xs font-semibold leading-tight transition-all duration-150 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
      'border border-transparent hover:text-[var(--text-primary)]',
      'data-[state=active]:bg-[var(--accent)]/14 data-[state=active]:text-[var(--accent)] data-[state=active]:border-[var(--accent)]/30 dark:data-[state=active]:bg-indigo-500/22 dark:data-[state=active]:text-white dark:data-[state=active]:border-indigo-400/35 data-[state=active]:shadow-xs',
      'after:content-[""] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-0 after:border-b-2 after:border-[var(--accent)] after:rounded-full after:transition-all after:duration-200 data-[state=active]:after:w-7',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 rounded-[var(--radius-lg)]',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

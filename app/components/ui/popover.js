'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/app/utils/cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = React.forwardRef(
  ({ className, align = 'center', sideOffset = 4, collisionPadding = 12, sticky = 'always', ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        sticky={sticky}
        className={cn(
          'z-50 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text-primary)] shadow-xl outline-none transition-all duration-150',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

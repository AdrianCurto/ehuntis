'use client';

import * as React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from './responsive-modal';
import { Button } from './button';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'destructive',
  icon: CustomIcon,
  onConfirm,
  onCancel,
}) {
  const Icon = CustomIcon || (variant === 'destructive' ? AlertTriangle : Info);

  const handleConfirm = () => {
    onConfirm?.();
    onOpenChange?.(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-md p-6 overflow-hidden" showCloseButton={false}>
        <ResponsiveModalHeader className="gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                variant === 'destructive'
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-[var(--accent-light)] text-[var(--accent)]'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <ResponsiveModalTitle className="text-base font-semibold">
              {title}
            </ResponsiveModalTitle>
          </div>
          {description && (
            <ResponsiveModalDescription className="text-sm text-[var(--text-secondary)] pl-13 pt-1 leading-relaxed">
              {description}
            </ResponsiveModalDescription>
          )}
        </ResponsiveModalHeader>
        <ResponsiveModalFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-6 mt-2 border-t border-[var(--border-light)]">
          <Button variant="secondary" size="md" className="w-full sm:w-auto" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            size="md"
            className="w-full sm:w-auto"
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

'use client';

import * as React from 'react';
import { Plus, Check, X } from 'lucide-react';
import { cn } from '@/app/utils/cn';

export function InlineCategoryChip({ onAdd, className }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [value, setValue] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
    }
    setValue('');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue('');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div
        className={cn(
          'inline-flex items-center h-8 pl-3 pr-1 rounded-full border border-[var(--accent)] bg-[var(--surface)] shadow-xs transition-all duration-150',
          className
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nueva etiqueta..."
          maxLength={25}
          className="w-24 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] bg-transparent focus:outline-none border-none p-0"
        />
        <div className="flex items-center gap-0.5 ml-1">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors cursor-pointer"
            aria-label="Confirmar etiqueta"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            aria-label="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        'inline-flex items-center h-8 px-3 rounded-full border border-dashed border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)]/40 transition-all duration-150 cursor-pointer active:scale-[0.97]',
        className
      )}
    >
      <Plus className="w-3.5 h-3.5 mr-1" />
      <span>Nueva</span>
    </button>
  );
}

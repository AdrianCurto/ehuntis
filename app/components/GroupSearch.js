'use client';

import { useMemo, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from './ui/responsive-modal';

function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function GroupSearch({ allClasses, selectedGroups, onAdd, onRemove, onClose }) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const terms = normalizeStr(query).split(/[\s\-_]+/).filter(t => t.length > 0);
    const filtered = allClasses.filter(c => {
      const text = normalizeStr((c.longName || '') + ' ' + (c.name || ''));
      return terms.every(term => text.includes(term));
    });
    return filtered.slice(0, 30);
  }, [query, allClasses]);

  const isSelected = (c) => selectedGroups.some(g =>
    (g.uniqueId && g.uniqueId === c.uniqueId) || g.id === c.id
  );

  const toggle = (c) => {
    if (isSelected(c)) onRemove(c);
    else onAdd(c);
  };

  return (
    <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ResponsiveModalContent
        className="p-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-0 h-[88dvh] max-h-[92dvh] sm:h-[78vh] sm:max-h-[600px] sm:max-w-[560px] overflow-hidden flex flex-col"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveModalHeader className="px-12 pt-1 sm:pt-5 pb-3 mb-0 shrink-0">
          <ResponsiveModalTitle className="text-base font-bold text-center">
            Seleccionar grupo o titulación
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="group-picker-search">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchInputRef.current?.blur();
            }}
            className="search-icon-wrap"
          >
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <Search size={16} />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="group-search-input"
              placeholder="Buscar titulación, grado, GII..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                className="group-search-clear-btn"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        <div className="group-picker-list" data-sheet-scroll="true">
          {query.length < 2 && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Escribe al menos 2 caracteres para buscar tu grupo
            </div>
          )}
          {query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map(c => (
            <div
              key={c.uniqueId || c.id}
              className={`group-picker-item${isSelected(c) ? ' selected' : ''}`}
              onClick={() => toggle(c)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="group-picker-item-name">{c.longName || c.name}</div>
                {c.longName && c.name && (
                  <div className="group-picker-item-code">{c.name}</div>
                )}
              </div>
              {isSelected(c) && (
                <span className="group-picker-checkmark" style={{ display: 'flex', alignItems: 'center' }}>
                  <Check size={16} strokeWidth={2.5} />
                </span>
              )}
            </div>
          ))}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

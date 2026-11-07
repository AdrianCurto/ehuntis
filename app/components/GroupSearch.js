'use client';

import { useMemo, useState } from 'react';
import { Search, X, Check } from 'lucide-react';

function normalizeStr(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function GroupSearch({ allClasses, selectedGroups, onAdd, onRemove, onClose }) {
  const [query, setQuery] = useState('');
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
    <div className="group-picker-backdrop" onClick={onClose}>
      <div className="group-picker-sheet" onClick={e => e.stopPropagation()}>
        <div className="group-picker-handle" />

        <div className="group-picker-header">
          <button className="group-picker-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
          <span className="group-picker-title">Seleccionar grupo o titulación</span>
          <div style={{ width: 32 }} />
        </div>

        <div className="group-picker-search">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.querySelector('input');
              if (input) input.blur();
            }}
            className="search-icon-wrap"
          >
            <span className="search-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <Search size={16} />
            </span>
            <input
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
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Borrar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>

        <div className="group-picker-list">
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
      </div>
    </div>
  );
}

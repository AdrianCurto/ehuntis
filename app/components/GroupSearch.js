'use client';

import { useMemo, useState } from 'react';

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
          <button className="group-picker-close" onClick={onClose} aria-label="Cerrar">✕</button>
          <span className="group-picker-title">Seleccionar grupo</span>
          <div style={{ width: 32 }} />
        </div>

        <div className="group-picker-search">
          <div className="search-icon-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="group-search-input"
              placeholder="Buscar titulación, grado, GII..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="group-picker-list">
          {query.length < 2 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Escribe al menos 2 caracteres para buscar
            </div>
          )}
          {query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map(c => (
            <div
              key={c.uniqueId || c.id}
              className={`group-picker-item${isSelected(c) ? ' selected' : ''}`}
              onClick={() => toggle(c)}
            >
              <div style={{ flex: 1 }}>
                <div className="group-picker-item-name">{c.longName || c.name}</div>
                {c.longName && c.name && (
                  <div className="group-picker-item-code">{c.name}</div>
                )}
              </div>
              {isSelected(c) && <span className="group-picker-checkmark">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

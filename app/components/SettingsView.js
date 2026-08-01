'use client';

import { useState } from 'react';

// Toggle component
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}

export default function SettingsView({ selectedGroups, disabledSubjects, uniqueSubjects, onToggleGroup, onToggleSubject, onRemoveGroup, onAddGroup }) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleExpanded = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Subjects per group: we don't have per-group subject data yet, so show all unique subjects under each group
  // In the future this can be scoped per group. For now it shows global subject list.
  const groupKey = (g) => g.uniqueId || g.id;
  const isGroupActive = (g) => !disabledSubjects.includes('group_' + groupKey(g));

  return (
    <div className="settings-view">
      <div className="settings-header">
        <div className="settings-title">Ajustes</div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Tus grupos</div>
        <div className="settings-card">
          {selectedGroups.length === 0 && (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
              No tienes grupos. Añade uno abajo.
            </div>
          )}

          {selectedGroups.map(g => {
            const key = groupKey(g);
            const isExpanded = expandedGroups[key];
            // Group-level subjects from all unique subjects (simplified for now)
            const groupSubjects = uniqueSubjects; // TODO: scope per group

            return (
              <div key={key}>
                <div className="settings-row">
                  <Toggle
                    checked={isGroupActive(g)}
                    onChange={() => onToggleGroup(g)}
                  />
                  <div className="settings-row-label">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                    <div className="settings-row-sublabel" style={{ marginTop: 2 }}>
                      {g.longName ? (g.longName.length > 40 ? g.longName.substring(0, 40) + '…' : g.longName) : ''}
                    </div>
                  </div>
                  <button
                    className={`settings-expand-btn${isExpanded ? ' open' : ''}`}
                    onClick={() => toggleExpanded(key)}
                    aria-label="Ver asignaturas"
                  >
                    ›
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: '4px' }}
                    onClick={() => onRemoveGroup(g)}
                    aria-label="Eliminar grupo"
                  >
                    🗑
                  </button>
                </div>

                {/* Expandable subjects */}
                {isExpanded && (
                  <div>
                    {groupSubjects.length === 0 ? (
                      <div className="settings-subrow">
                        <span className="settings-subrow-label" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          Carga el horario para ver asignaturas
                        </span>
                      </div>
                    ) : (
                      groupSubjects.map(subj => (
                        <div key={subj.id} className="settings-subrow">
                          <Toggle
                            checked={!disabledSubjects.includes(subj.id)}
                            onChange={() => onToggleSubject(subj.id)}
                          />
                          <span className="settings-subrow-label">{subj.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="add-group-btn" onClick={onAddGroup}>
          <span>+</span> Añadir grupo
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Asignaturas</div>
        <div className="settings-card">
          {uniqueSubjects.length === 0 && (
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
              Añade un grupo y carga el horario para ver tus asignaturas.
            </div>
          )}
          {uniqueSubjects.map(subj => (
            <div key={subj.id} className="settings-row">
              <Toggle
                checked={!disabledSubjects.includes(subj.id)}
                onChange={() => onToggleSubject(subj.id)}
              />
              <span className="settings-row-label" style={{ fontSize: 14 }}>{subj.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
}

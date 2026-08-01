'use client';

import { useState } from 'react';
import { ChevronRight, Trash2, Library } from 'lucide-react';

function Toggle({ checked, onChange, id }) {
  return (
    <label className="toggle" htmlFor={id} onClick={(e) => e.stopPropagation()}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}

function ChevronIcon({ open }) {
  return (
    <ChevronRight
      size={18}
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
    />
  );
}

export default function SettingsView({
  selectedGroups,
  disabledGroupIds,
  disabledSubjectsByGroup,
  timetableByGroup,
  availableSubgroupsByGroup,
  disabledSubgroupNumbersByGroup,
  onToggleSubjectForGroup,
  onToggleSubgroupForGroup,
  onToggleGroupDisabled,
  onRemoveGroup,
  onAddGroup,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleExpanded = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupKey = (g) => String(g.uniqueId || g.id);

  return (
    <div className="settings-view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="settings-header">
        <div className="settings-title">Ajustes</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Gestiona tus grupos y asignaturas
        </div>
      </div>

      {/* ── Groups section ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-label">Mis grupos</div>

        {selectedGroups.length === 0 ? (
          <div className="settings-card">
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                <Library size={48} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                No tienes ningún grupo. Pulsa el botón para añadir.
              </div>
            </div>
          </div>
        ) : (
          <div className="settings-card">
            {selectedGroups.map((g, gIdx) => {
              const key = groupKey(g);
              const isExpanded = expandedGroups[key];
              const isGroupDisabled = disabledGroupIds.includes(key);
              const disabledForGroup = disabledSubjectsByGroup[key] || [];
              const subjectsForGroup = timetableByGroup[key] || [];
              const allEnabled = subjectsForGroup.every(s => !disabledForGroup.includes(s.id));

              return (
                <div key={key} style={{ opacity: isGroupDisabled ? 0.6 : 1, transition: 'opacity 0.2s ease' }}>
                  {/* Group row */}
                  <div
                    className="settings-row"
                    style={{ cursor: 'pointer', gap: '12px' }}
                    onClick={() => toggleExpanded(key)}
                  >
                    {/* Expand arrow */}
                    <span style={{ color: 'var(--text-muted)' }}>
                      <ChevronIcon open={isExpanded} />
                    </span>
                    
                    {/* Enable/Disable Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Toggle
                        id={`group-toggle-${key}`}
                        checked={!isGroupDisabled}
                        onChange={() => onToggleGroupDisabled(key)}
                      />
                    </div>

                    {/* Group info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {g.name}
                      </div>
                      {g.longName && (
                        <div style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {g.longName}
                        </div>
                      )}
                    </div>

                    {/* Subject count badge */}
                    {subjectsForGroup.length > 0 && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-secondary)',
                        padding: '2px 8px',
                        borderRadius: 20,
                        flexShrink: 0,
                      }}>
                        {subjectsForGroup.filter(s => !disabledForGroup.includes(s.id)).length}/{subjectsForGroup.length}
                      </span>
                    )}

                    {/* Delete btn - stop propagation */}
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      onClick={(e) => { e.stopPropagation(); onRemoveGroup(g); }}
                      aria-label="Eliminar grupo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Subjects expandable section */}
                  {isExpanded && (
                    <div style={{ background: 'var(--bg-secondary)', pointerEvents: isGroupDisabled ? 'none' : 'auto' }}>
                      {subjectsForGroup.length === 0 ? (
                        <div style={{ padding: '12px 20px 12px 44px', fontSize: 13, color: 'var(--text-muted)' }}>
                          Carga el horario para ver las asignaturas
                        </div>
                      ) : (
                        <>
                          {/* "All" toggle */}
                          <div className="settings-subrow" style={{ borderBottom: '1px solid var(--border)' }}>
                            <Toggle
                              id={`all-${key}`}
                              checked={allEnabled}
                              onChange={() => {
                                subjectsForGroup.forEach(s => {
                                  const isDisabled = disabledForGroup.includes(s.id);
                                  if (allEnabled && !isDisabled) onToggleSubjectForGroup(key, s.id);
                                  if (!allEnabled && isDisabled) onToggleSubjectForGroup(key, s.id);
                                });
                              }}
                            />
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)' }}>
                              Todas las asignaturas
                            </span>
                          </div>

                          {/* Individual subjects */}
                          {subjectsForGroup.map(subj => (
                            <div key={subj.id} className="settings-subrow">
                              <Toggle
                                id={`subj-${key}-${subj.id}`}
                                checked={!disabledForGroup.includes(subj.id)}
                                onChange={() => onToggleSubjectForGroup(key, subj.id)}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {subj.name}
                                </div>
                                {subj.shortName && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {subj.shortName}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {availableSubgroupsByGroup?.[key]?.length > 0 && (
                            <>
                              <div style={{ height: 1, background: 'var(--border)', margin: '4px 20px' }} />
                              <div className="settings-subrow" style={{ paddingBottom: 4 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                                  Subgrupos (Laboratorio, Ordenador, Seminario...)
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: 16, padding: '4px 20px 16px 44px', flexWrap: 'wrap' }}>
                                {availableSubgroupsByGroup[key].map(subNum => {
                                  const disabled = (disabledSubgroupNumbersByGroup?.[key] || []).includes(subNum);
                                  return (
                                    <div key={subNum} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <Toggle
                                        id={`subgroup-${key}-${subNum}`}
                                        checked={!disabled}
                                        onChange={() => onToggleSubgroupForGroup(key, subNum)}
                                      />
                                      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                                        Subgrupo {subNum}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {gIdx < selectedGroups.length - 1 && (
                    <div style={{ height: 1, background: 'var(--border)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button className="add-group-btn" onClick={onAddGroup}>
          + Añadir grupo
        </button>
      </div>

      <div style={{ height: 32 }} />
    </div>
  );
}

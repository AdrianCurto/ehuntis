'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Trash2, Library, RefreshCw, Plus, Edit2, Copy, AlertTriangle, Sun, Moon, Monitor, Palette, RotateCcw } from 'lucide-react';
import {
  PALETTE,
  PALETTE_DARK,
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  getSubjectColorStyle,
} from '../utils/colorLogic';

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
  theme = 'system',
  onThemeChange,

  configs = [],
  activeConfigId,
  onSelectConfig,
  onCreateConfig,
  onRenameConfig,
  onDuplicateConfig,
  onDeleteConfig,

  onForceRefresh,
  isRefreshingTimetable,
  timetableByGroup,
  availableSubgroupsBySubject = {},

  showDimmedSubgroups = false,
  onToggleShowDimmedSubgroups,
  onToggleAllSubgroupsForGroup,

  onToggleGroupDisabled,
  onToggleSubjectForGroup,
  onToggleSubgroupForSubject,
  onRemoveGroup,
  onAddGroup,

  customColors = {},
  resolvedSubjectColors = {},
  onSetSubjectColor,
  onResetSingleSubjectColor,
  onResetSubjectColors,
  isDark = false,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isRefreshPressed, setIsRefreshPressed] = useState(false);
  const [pickerSubjectId, setPickerSubjectId] = useState(null);

  useEffect(() => {
    if (!pickerSubjectId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.color-picker-popover') && !e.target.closest('.subject-color-btn')) {
        setPickerSubjectId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [pickerSubjectId]);

  // Modals state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const activeConfig = configs.find(c => c.id === activeConfigId) || configs[0] || {
    id: 'default',
    name: 'Configuración 1',
    selectedGroups: [],
    disabledGroupIds: [],
    disabledSubjectsByGroup: {},
    disabledSubgroupsBySubject: {},
  };

  const selectedGroups = activeConfig.selectedGroups || [];
  const disabledGroupIds = activeConfig.disabledGroupIds || [];
  const disabledSubjectsByGroup = activeConfig.disabledSubjectsByGroup || {};
  const disabledSubgroupsBySubject = activeConfig.disabledSubgroupsBySubject || {};

  const toggleExpanded = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupKey = (g) => String(g.uniqueId || g.id);
  const isRefreshing = isRefreshPressed || isRefreshingTimetable;

  const handleRefresh = async () => {
    if (isRefreshPressed) return;
    setIsRefreshPressed(true);
    try {
      await Promise.resolve(onForceRefresh?.());
    } finally {
      setTimeout(() => setIsRefreshPressed(false), 450);
    }
  };

  const openRenameModal = () => {
    setRenameValue(activeConfig.name);
    setRenameModalOpen(true);
  };

  const handleRenameSubmit = (e) => {
    e?.preventDefault();
    if (renameValue.trim()) {
      onRenameConfig(activeConfig.id, renameValue.trim());
      setRenameModalOpen(false);
    }
  };

  const handleDeleteClick = () => {
    if (selectedGroups.length === 0) {
      // Empty configuration, delete directly
      onDeleteConfig(activeConfig.id);
    } else {
      // Non-empty, ask for confirmation
      setDeleteModalOpen(true);
    }
  };

  const handleConfirmDelete = () => {
    onDeleteConfig(activeConfig.id);
    setDeleteModalOpen(false);
  };

  return (
    <div className="settings-view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div className="settings-title">Ajustes</div>
        <button
          className={`primary-btn refresh-btn${isRefreshing ? ' is-refreshing' : ''}`}
          onClick={handleRefresh}
          aria-busy={isRefreshing}
          style={{ flexShrink: 0 }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          Refrescar horarios
        </button>
      </div>

      {/* ── Appearance / Theme Section ─────────────────────────────── */}
      <div className="settings-section" style={{ paddingBottom: 0 }}>
        <div className="settings-section-label">Apariencia</div>
        <div className="theme-selector-card">
          <div
            className="theme-segmented-group"
            role="radiogroup"
            aria-label="Seleccionar tema"
          >
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`theme-segment-btn${theme === 'light' ? ' active' : ''}`}
              onClick={() => onThemeChange?.('light')}
            >
              <Sun size={15} />
              <span>Claro</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`theme-segment-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => onThemeChange?.('dark')}
            >
              <Moon size={15} />
              <span>Oscuro</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={theme === 'system'}
              className={`theme-segment-btn${theme === 'system' ? ' active' : ''}`}
              onClick={() => onThemeChange?.('system')}
            >
              <Monitor size={15} />
              <span>Sistema</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Configuration Selector & Manager ─────────────────────────────────── */}
      <div className="settings-section" style={{ paddingBottom: 0 }}>
        <div className="settings-section-label">Configuración activa</div>
        <div className="config-selector-card">
          <div className="config-selector-header">
            <select
              className="config-select-native"
              value={activeConfig.id}
              onChange={(e) => onSelectConfig(e.target.value)}
              aria-label="Seleccionar configuración activa"
            >
              {configs.map(cfg => (
                <option key={cfg.id} value={cfg.id}>
                  {cfg.name} ({cfg.selectedGroups?.length || 0} {cfg.selectedGroups?.length === 1 ? 'grupo' : 'grupos'})
                </option>
              ))}
            </select>
          </div>

          <div className="config-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                className="config-icon-btn"
                onClick={openRenameModal}
                title="Renombrar configuración"
              >
                <Edit2 size={13} />
                <span>Renombrar</span>
              </button>

              <button
                className="config-icon-btn"
                onClick={() => onDuplicateConfig(activeConfig.id)}
                title="Duplicar configuración"
              >
                <Copy size={13} />
                <span>Duplicar</span>
              </button>

              {configs.length > 1 && (
                <button
                  className="config-icon-btn destructive"
                  onClick={handleDeleteClick}
                  title="Eliminar configuración"
                >
                  <Trash2 size={13} />
                  <span>Eliminar</span>
                </button>
              )}

              {Boolean(activeConfig.customColors && Object.keys(activeConfig.customColors).length > 0) && (
                <button
                  className="config-icon-btn"
                  onClick={onResetSubjectColors}
                  title="Restablecer colores predeterminados"
                >
                  <RotateCcw size={13} />
                  <span>Restablecer colores</span>
                </button>
              )}
            </div>

            <button
              className="config-icon-btn"
              style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
              onClick={() => onCreateConfig()}
              title="Nueva configuración"
            >
              <Plus size={14} />
              <span>Nueva</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Display Options ────────────────────────────────────────────── */}
      <div className="settings-section" style={{ paddingBottom: 0 }}>
        <div className="settings-card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Mostrar otros subgrupos (atenuados)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Muestra los subgrupos no elegidos en gris para ver las clases de tus compañeros
              </div>
            </div>
            <Toggle
              id="toggle-dimmed-subgroups"
              checked={showDimmedSubgroups}
              onChange={onToggleShowDimmedSubgroups}
            />
          </div>
        </div>
      </div>

      {/* ── Groups section ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-label">Grupos en &quot;{activeConfig.name}&quot;</div>
          {Object.keys(customColors || {}).length > 0 && (
            <button
              type="button"
              className="reset-colors-btn"
              onClick={onResetSubjectColors}
              title="Restablecer todos los colores personalizados al modo automático"
            >
              <RotateCcw size={13} />
              <span>Restablecer colores</span>
            </button>
          )}
        </div>

        {selectedGroups.length === 0 ? (
          <div className="settings-card">
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text-muted)' }}>
                <Library size={48} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                No tienes ningún grupo en esta configuración. Pulsa el botón para añadir.
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
              const allEnabled = subjectsForGroup.length > 0 && subjectsForGroup.every(s => !disabledForGroup.includes(s.id));

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
                          {/* "All" toggles: subjects & subgroups */}
                          {(() => {
                            const groupAvailableSubgroups = availableSubgroupsBySubject[key] || {};
                            const hasAnySubgroups = Object.values(groupAvailableSubgroups).some(subs => subs && subs.length > 0);
                            const groupDisabledSubgroups = disabledSubgroupsBySubject[key] || {};
                            const allSubgroupsEnabled = hasAnySubgroups && Object.entries(groupAvailableSubgroups).every(([subjId, subs]) => {
                              const disabledForSubj = groupDisabledSubgroups[subjId] || [];
                              return subs.every(subKey => !disabledForSubj.includes(subKey));
                            });

                            return (
                              <div
                                className="settings-subrow"
                                style={{
                                  borderBottom: '1px solid var(--border)',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 16,
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                                    Todas las asignaturas
                                  </span>
                                </div>

                                {hasAnySubgroups && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Toggle
                                      id={`all-subgroups-${key}`}
                                      checked={allSubgroupsEnabled}
                                      onChange={() => onToggleAllSubgroupsForGroup(key, !allSubgroupsEnabled)}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                                      Todos los subgrupos
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Individual subjects */}
                          {subjectsForGroup.map(subj => {
                            const isSubjDisabled = disabledForGroup.includes(subj.id);
                            const subjectSubgroups = availableSubgroupsBySubject[key]?.[subj.id] || [];
                            const disabledSubgroups = disabledSubgroupsBySubject[key]?.[subj.id] || [];

                            const colorIdx = resolvedSubjectColors?.[subj.id] !== undefined
                              ? resolvedSubjectColors[subj.id]
                              : (Math.abs(Number(subj.id) || 0) % PALETTE.length);
                            const colStyle = getSubjectColorStyle(colorIdx, isDark);
                            const isCustomized = customColors && (customColors[subj.id] !== undefined || customColors[String(subj.id)] !== undefined);
                            const isPickerOpen = pickerSubjectId === subj.id;

                            return (
                              <div
                                key={subj.id}
                                className={`settings-subject-card${isSubjDisabled ? ' is-disabled' : ''}`}
                                style={{
                                  background: colStyle.bg,
                                  border: `1px solid ${colStyle.border || 'rgba(0,0,0,0.12)'}`,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                    <Toggle
                                      id={`subj-${key}-${subj.id}`}
                                      checked={!isSubjDisabled}
                                      onChange={() => onToggleSubjectForGroup(key, subj.id)}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 14, color: colStyle.text, fontWeight: 700, lineHeight: 1.25 }}>
                                        {subj.name}
                                      </div>
                                      {subj.shortName && (
                                        <div style={{ fontSize: 11, color: colStyle.text, opacity: 0.8, marginTop: 2 }}>
                                          {subj.shortName}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="subject-palette-btn subject-color-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPickerSubjectId(prev => (prev === subj.id ? null : subj.id));
                                    }}
                                    title="Personalizar color de la asignatura"
                                    style={{
                                      color: colStyle.text,
                                    }}
                                    aria-expanded={isPickerOpen}
                                    aria-label={`Personalizar color de ${subj.name}`}
                                  >
                                    <Palette size={16} />
                                  </button>
                                </div>

                                {/* Per-subject subgroup selector pills */}
                                {!isSubjDisabled && subjectSubgroups.length > 0 && (
                                  <div style={{ paddingLeft: 44, marginTop: 8, marginBottom: 2 }}>
                                    <div className="subgroups-pill-grid">
                                      {subjectSubgroups.map(subKey => {
                                        const isSubActive = !disabledSubgroups.includes(subKey);
                                        return (
                                          <button
                                            key={subKey}
                                            type="button"
                                            className={`subgroup-pill ${isSubActive ? 'active' : 'inactive'}`}
                                            onClick={() => onToggleSubgroupForSubject(key, subj.id, subKey)}
                                            title={`${isSubActive ? 'Ocultar' : 'Mostrar'} subgrupo ${subKey}`}
                                          >
                                            <span className="subgroup-pill-icon">{isSubActive ? '✓' : '✕'}</span>
                                            <span>{subKey}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Popover selector de colores (14 tonos divididos en principales y suaves) */}
                                {isPickerOpen && (
                                  <div
                                    className="color-picker-popover"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="color-picker-popover-header">
                                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Color de {subj.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setPickerSubjectId(null)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: 'var(--text-muted)',
                                          fontSize: 16,
                                          lineHeight: 1,
                                          padding: 4,
                                        }}
                                        aria-label="Cerrar selector"
                                      >
                                        ✕
                                      </button>
                                    </div>

                                    {/* Sección 1: Colores principales (8 tonos en cuadrícula 8x1 en PC / 4x2 en móvil) */}
                                    <div className="color-picker-section-label">
                                      Colores principales
                                    </div>
                                    <div className="color-picker-grid-main">
                                      {CHROMATIC_ORDER_MAIN.map((idx) => {
                                        const p = isDark ? PALETTE_DARK[idx] : PALETTE[idx];
                                        const isSelected = colorIdx === idx;
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            className="color-swatch-btn"
                                            onClick={() => {
                                              onSetSubjectColor?.(subj.id, idx);
                                              setPickerSubjectId(null);
                                            }}
                                            title={`Color ${idx + 1}`}
                                            style={{
                                              background: p.bg,
                                              border: isSelected
                                                ? '3px solid var(--accent)'
                                                : `1px solid ${p.border || 'rgba(0,0,0,0.2)'}`,
                                              boxShadow: isSelected
                                                ? '0 0 0 2px var(--surface), 0 2px 5px rgba(0,0,0,0.25)'
                                                : '0 1px 2px rgba(0,0,0,0.1)',
                                              color: p.text,
                                            }}
                                          >
                                            {isSelected ? '✓' : ''}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {/* Sección 2: Tonos complementarios (6 tonos en cuadrícula 6x1 en PC / 3x2 en móvil) */}
                                    <div className="color-picker-section-label" style={{ marginTop: 12 }}>
                                      Tonos complementarios
                                    </div>
                                    <div className="color-picker-grid-soft">
                                      {CHROMATIC_ORDER_SOFT.map((idx) => {
                                        const p = isDark ? PALETTE_DARK[idx] : PALETTE[idx];
                                        const isSelected = colorIdx === idx;
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            className="color-swatch-btn"
                                            onClick={() => {
                                              onSetSubjectColor?.(subj.id, idx);
                                              setPickerSubjectId(null);
                                            }}
                                            title={`Color suave ${idx + 1}`}
                                            style={{
                                              background: p.bg,
                                              border: isSelected
                                                ? '3px solid var(--accent)'
                                                : `1px solid ${p.border || 'rgba(0,0,0,0.2)'}`,
                                              boxShadow: isSelected
                                                ? '0 0 0 2px var(--surface), 0 2px 5px rgba(0,0,0,0.25)'
                                                : '0 1px 2px rgba(0,0,0,0.1)',
                                              color: p.text,
                                            }}
                                          >
                                            {isSelected ? '✓' : ''}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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

      {/* ── Modal: Rename Configuration ─────────────────────────────────────── */}
      {renameModalOpen && (
        <div className="settings-dialog-backdrop" onClick={() => setRenameModalOpen(false)}>
          <div className="settings-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="settings-dialog-title">Renombrar configuración</div>
            <form onSubmit={handleRenameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="text"
                className="settings-dialog-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Nombre de la configuración"
                autoFocus
                maxLength={40}
              />
              <div className="settings-dialog-actions">
                <button
                  type="button"
                  className="dialog-btn cancel"
                  onClick={() => setRenameModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="dialog-btn confirm"
                  disabled={!renameValue.trim()}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Confirmation ──────────────────────────────────────── */}
      {deleteModalOpen && (
        <div className="settings-dialog-backdrop" onClick={() => setDeleteModalOpen(false)}>
          <div className="settings-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: '#DC2626', display: 'flex' }}>
                <AlertTriangle size={24} />
              </div>
              <div className="settings-dialog-title">¿Eliminar &quot;{activeConfig.name}&quot;?</div>
            </div>
            <div className="settings-dialog-body">
              Esta configuración contiene <strong>{selectedGroups.length} grupo(s)</strong> y sus filtros de asignaturas y subgrupos. Esta acción no se puede deshacer.
            </div>
            <div className="settings-dialog-actions">
              <button
                type="button"
                className="dialog-btn cancel"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="dialog-btn danger"
                onClick={handleConfirmDelete}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 90 }} />
    </div>
  );
}


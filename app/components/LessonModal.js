'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  User,
  Pencil,
  ArrowUpDown,
  Undo2,
  Ban,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  FileText,
  MoreVertical,
} from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from './ui/responsive-modal';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Button } from './ui/button';
import { subjectColor } from './WeekCalendar';
import { formatTeacher } from '../utils/teachers';
import { formatTime } from '../utils/dateTimeUtils';
import { formatRooms } from '../utils/subgroups';
import { shouldShowLessonResetButton, hasNonSwapOverrides } from '../utils/lessonOverrides';
import { preloadEditLessonModal, preloadSwapLessonModal } from '../utils/modalPreload';
import { cn } from '../utils/cn';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseDate(dateNum) {
  if (!dateNum) return new Date();
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

export default function LessonModal({
  lesson,
  onClose,
  isDark = false,
  onToggleCancelled,
  onOpenEdit,
  onOpenSwap,
  onUnswap,
  onResetOverride,
  onResolveDrift,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    preloadEditLessonModal();
    preloadSwapLessonModal();
  }, []);

  if (!lesson) return null;

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const timeStr = `${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`;
  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);

  const subjectName = lesson.subjects?.[0] || 'Sin asignatura';
  const teacher = formatTeacher(lesson.teachers?.[0] || '');
  const room = formatRooms(lesson.rooms);
  const classes = lesson.classes || [];
  const subgroupStr = classes.length > 0 ? classes.join(', ') : '';

  const isUserCancelled = Boolean(lesson.isUserCancelled);
  const isWebUntisCancelled = lesson.code === 'cancelled' && !isUserCancelled;
  const isOverridden = Boolean(lesson.isOverridden);
  const isSwapped = Boolean(lesson.swappedWith);
  const isEdited = !isUserCancelled && (lesson.swappedWith ? hasNonSwapOverrides(lesson) : isOverridden);
  const showResetButton = shouldShowLessonResetButton(lesson);
  const hasDrift = Boolean(lesson.hasRemoteDrift && lesson.driftChanges && lesson.driftChanges.length > 0);

  const modalBorderColor = `color-mix(in oklab, ${color.text} 28%, transparent)`;

  const handleMenuKeyDown = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll('button[role="menuitem"]:not(:disabled)'));
    if (items.length === 0) return;
    const currentIdx = items.indexOf(document.activeElement);
    e.preventDefault();
    if (e.key === 'Home') {
      items[0].focus();
    } else if (e.key === 'End') {
      items[items.length - 1].focus();
    } else {
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const nextIdx = currentIdx < 0 ? 0 : (currentIdx + delta + items.length) % items.length;
      items[nextIdx].focus();
    }
  };

  const handleToggleCancelClick = () => {
    onToggleCancelled?.(lesson);
  };

  const handleUnswapClick = () => {
    onUnswap?.(lesson);
    onClose?.();
  };

  const handleResetClick = () => {
    onResetOverride?.(lesson);
    onClose?.();
  };

  return (
    <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose?.(); }}>
        <ResponsiveModalContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-md p-5 sm:p-6 overflow-y-auto overscroll-contain"
          style={{
            background: color.bg,
            color: color.text,
            borderColor: modalBorderColor,
            '--card-bg': color.bg,
            '--card-ink': color.text,
          }}
        >
          {/* Boton de opciones (3 puntos verticales) en la esquina superior izquierda */}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="touch-target-44 absolute left-4 top-3.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-current/15 bg-black/5 hover:bg-black/10 active:bg-black/15 dark:bg-white/10 dark:hover:bg-white/20 dark:active:bg-white/25 text-current transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 cursor-pointer"
                aria-label="Más acciones de la clase"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="Más acciones"
                onPointerEnter={() => {
                  preloadEditLessonModal();
                  preloadSwapLessonModal();
                }}
                onTouchStart={() => {
                  preloadEditLessonModal();
                  preloadSwapLessonModal();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="w-56 p-1.5"
              role="menu"
              aria-label="Acciones de la clase"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onKeyDown={handleMenuKeyDown}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenEdit?.(lesson);
                }}
                onPointerEnter={preloadEditLessonModal}
                onTouchStart={preloadEditLessonModal}
                className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                <span>Editar clase</span>
              </button>

              {isSwapped ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    handleUnswapClick();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                >
                  <Undo2 className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                  <span>Deshacer intercambio</span>
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSwap?.(lesson);
                  }}
                  onPointerEnter={preloadSwapLessonModal}
                  onTouchStart={preloadSwapLessonModal}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                  <span>Intercambiar horario</span>
                </button>
              )}

              {showResetButton && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    handleResetClick();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)] focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                  <span>Restablecer</span>
                </button>
              )}

              <hr className="my-1 border-0 border-t border-[var(--border)]" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  handleToggleCancelClick();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium focus:outline-none focus-visible:outline-none transition-colors cursor-pointer',
                  isUserCancelled
                    ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 focus-visible:bg-emerald-500/10'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 focus-visible:bg-rose-500/10'
                )}
              >
                {isUserCancelled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Reactivar clase</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>Cancelar clase</span>
                  </>
                )}
              </button>
            </PopoverContent>
          </Popover>

          {/* Cabecera: Asignatura primero, fecha y hora como subtitulo, todo centrado */}
          <div className="px-12 sm:px-14 pt-1 sm:pt-0 sm:-mt-3 mb-3.5 flex flex-col items-center text-center">
            {(subgroupStr || lesson.type) && (
              <div
                className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-3 sm:mb-3.5 text-center"
                style={{
                  color: color.text,
                  background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                }}
              >
                {subgroupStr ? `${subgroupStr}${lesson.type ? ` · ${lesson.type}` : ''}` : lesson.type}
              </div>
            )}
            <ResponsiveModalTitle
              className="text-xl font-bold leading-snug tracking-tight text-balance text-center font-[var(--font-display)]"
              style={{ color: color.text }}
            >
              {subjectName}
            </ResponsiveModalTitle>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm font-medium tabular-nums text-center" style={{ color: color.text, opacity: 0.85 }}>
              <span>{dayName} {dateStr}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold">{timeStr}</span>
            </div>
          </div>

          {/* Banner de drift remoto si WebUntis actualizo datos */}
          {hasDrift && (
            <div className="p-3.5 my-3 rounded-[var(--radius-lg)] bg-white/90 dark:bg-slate-950/80 border border-amber-500/40 text-slate-900 dark:text-slate-100 text-xs text-center shadow-sm backdrop-blur-xs">
              <div className="flex items-center justify-center gap-2 font-semibold text-amber-900 dark:text-amber-300 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>WebUntis ha actualizado esta clase</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 mb-3">
                {lesson.driftChanges.map((ch, idx) => (
                  <div key={idx} className="flex flex-wrap items-center justify-center gap-1.5 tabular-nums">
                    <span className="font-medium text-slate-600 dark:text-slate-400">{ch.label}:</span>
                    <span className="line-through text-slate-500 dark:text-slate-400">{ch.before}</span>
                    <span className="text-slate-400" aria-hidden="true">→</span>
                    <span className="font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-amber-500/15 dark:bg-amber-400/20 text-amber-950 dark:text-amber-200">
                      {ch.after}
                    </span>
                    {ch.userValue && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        (tu cambio: {ch.userValue})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="touch-target-44 bg-[#c2410c] hover:bg-[#9a3412] text-white border border-transparent h-8 px-3 text-xs font-semibold shadow-xs"
                  onClick={() => onResolveDrift?.(lesson, 'adopt_remote')}
                >
                  Adoptar cambio oficial
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="touch-target-44 h-8 px-3 text-xs font-medium bg-transparent border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => onResolveDrift?.(lesson, 'keep_local')}
                >
                  Mantener mi versión
                </Button>
              </div>
            </div>
          )}

          {/* Badges de estado / Swap */}
          {(isUserCancelled || isWebUntisCancelled || lesson.swappedWith || isEdited) && (
            <div className="flex flex-col items-center justify-center gap-1.5 mb-3">
              {isUserCancelled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/18 text-rose-800 dark:text-rose-200 border border-rose-500/30">
                  <Ban className="w-3.5 h-3.5" /> Cancelada por ti
                </span>
              )}

              {isWebUntisCancelled && !isUserCancelled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Cancelada por la universidad
                </span>
              )}

              {lesson.swappedWith && !isUserCancelled && !isWebUntisCancelled && (
                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-center bg-black/8 dark:bg-white/14 border border-current/15" style={{ color: color.text }}>
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0" /> Intercambiada con {lesson.swappedWith.subjectName}
                </span>
              )}

              {isEdited && !isWebUntisCancelled && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                    color: color.text,
                  }}
                >
                  <Pencil className="w-3 h-3" /> Personalizada
                </span>
              )}
            </div>
          )}

          {/* Detalles: Profesor y Aula */}
          {(teacher || room) && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
              {teacher && (
                <div
                  className="inline-flex items-center justify-center gap-1.5 max-w-full px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-center"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    color: color.text,
                  }}
                >
                  <User className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <span>{teacher}</span>
                </div>
              )}
              {room && (
                <div
                  className="inline-flex items-center justify-center gap-1.5 max-w-full px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold text-center"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    color: color.text,
                  }}
                >
                  <MapPin className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <span>{room}</span>
                </div>
              )}
            </div>
          )}

          {/* Notas personales */}
          {lesson.notes && (
            <div
              className="p-3 rounded-[var(--radius-md)] text-xs leading-relaxed mb-4 whitespace-pre-wrap break-words text-center"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: color.text,
              }}
            >
              <div className="flex items-center justify-center gap-1.5 font-semibold opacity-80 mb-1">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Notas personales</span>
              </div>
              <div className="text-pretty">{lesson.notes}</div>
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>
  );
}

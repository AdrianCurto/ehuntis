'use client';

import { useState, useEffect } from 'react';
import { Pencil, MapPin, Calendar, CalendarRange, Trash2, ArrowLeft, FileText, MoreVertical } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from './ui/responsive-modal';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { getSubjectColorStyle } from '../utils/colorLogic';
import { parseDateNumber, formatDateShort } from '../utils/dayLogic';
import { formatTime } from '../utils/dateTimeUtils';
import { formatRooms } from '../utils/subgroups';
import { preloadCustomEventModal } from '../utils/modalPreload';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };

export default function CustomEventDetailModal({
  event,
  onEdit,
  onDelete,
  onClose,
  isDark = false,
}) {
  const [viewMode, setViewMode] = useState('detail'); // 'detail' | 'scope-delete'
  const [confirmSingleDeleteOpen, setConfirmSingleDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    preloadCustomEventModal();
  }, []);

  if (!event) return null;

  const rawEvent = event.rawEvent || event;
  const date = parseDateNumber(event.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const timeStr = `${formatTime(event.startTime)}–${formatTime(event.endTime)}`;
  const color = getSubjectColorStyle(event.colorIndex ?? 4, isDark);
  const modalBorderColor = `color-mix(in oklab, ${color.text} 28%, transparent)`;

  const title = event.subjects?.[0] || rawEvent.title || 'Evento personal';
  const location = formatRooms(event.rooms) || formatRooms(rawEvent.location) || '';
  const notes = event.notes || rawEvent.notes || '';
  const category = event.category || rawEvent.category || '';
  const isRecurring = rawEvent.recurrence?.type === 'weekly';

  let recurrenceDescription = 'Evento puntual';
  if (isRecurring) {
    const days = (rawEvent.recurrence.daysOfWeek || []).map((d) => DAYS_SHORT[d] || '').filter(Boolean).join(', ');
    const endStr = rawEvent.recurrence.endDate
      ? `hasta ${formatDateShort(parseDateNumber(rawEvent.recurrence.endDate))}`
      : 'sin fecha límite';
    recurrenceDescription = `Repetición semanal: ${days} (${endStr})`;
  }

  const handleDeleteClick = () => {
    if (isRecurring) {
      setViewMode('scope-delete');
    } else {
      setConfirmSingleDeleteOpen(true);
    }
  };

  const handleConfirmDelete = (mode) => {
    onDelete(rawEvent.id, event.date, mode);
    onClose();
  };

  return (
    <>
      <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
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
          {viewMode === 'detail' && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="touch-target-44 absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-current/15 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-current transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 cursor-pointer"
                  aria-label="Más acciones del evento"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Más acciones"
                  onPointerEnter={preloadCustomEventModal}
                  onTouchStart={preloadCustomEventModal}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-52 p-1.5"
                role="menu"
                aria-label="Acciones del evento"
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit?.();
                  }}
                  onPointerEnter={preloadCustomEventModal}
                  onTouchStart={preloadCustomEventModal}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus:bg-[var(--bg-secondary)] focus:outline-none transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                  <span>Editar evento</span>
                </button>

                <hr className="my-1 border-0 border-t border-[var(--border)]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    handleDeleteClick();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:outline-none transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Eliminar evento</span>
                </button>
              </PopoverContent>
            </Popover>
          )}

          {viewMode === 'scope-delete' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pr-8">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('detail')}
                  style={{ color: color.text }}
                  className="touch-target-44 px-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span>Atrás</span>
                </Button>
                <ResponsiveModalTitle className="text-base font-bold" style={{ color: color.text }}>
                  Eliminar repeticiones
                </ResponsiveModalTitle>
              </div>

              <p className="text-xs leading-relaxed text-left text-pretty" style={{ color: color.text, opacity: 0.85 }}>
                Este evento se repite semanalmente. Elige qué instancias deseas eliminar:
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleConfirmDelete('single')}
                  className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: color.text }}>
                      Solo esta fecha
                    </div>
                    <div className="text-xs" style={{ color: color.text, opacity: 0.78 }}>
                      Se conservan las demás semanas del horario
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmDelete('series')}
                  className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    <CalendarRange className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: color.text }}>
                      Toda la serie semanal
                    </div>
                    <div className="text-xs" style={{ color: color.text, opacity: 0.78 }}>
                      Elimina todas las fechas pasadas y futuras
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full sm:w-auto"
                  onClick={() => setViewMode('detail')}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              {/* Cabecera: Categoria opcional + Titulo primero + Fecha y hora como subtitulo, todo centrado */}
              <div className="px-12 sm:px-14 flex flex-col items-center text-center space-y-1.5">
                {category && (
                  <div
                    className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      color: color.text,
                      background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                    }}
                  >
                    {category}
                  </div>
                )}

                <ResponsiveModalTitle
                  className="text-xl font-bold leading-snug tracking-tight text-balance text-center font-[var(--font-display)]"
                  style={{ color: color.text }}
                >
                  {title}
                </ResponsiveModalTitle>

                <div
                  className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm font-medium tabular-nums text-center"
                  style={{ color: color.text, opacity: 0.85 }}
                >
                  <span>{dayName} {dateStr}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold">{timeStr}</span>
                </div>
              </div>

              {/* Detalles adicionales centrados en pildoras consistentes con LessonModal */}
              <div className="flex flex-wrap items-center justify-center gap-2" style={{ color: color.text }}>
                {location && (
                  <div
                    className="inline-flex items-center justify-center gap-1.5 max-w-full px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold text-center"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                      color: color.text,
                    }}
                  >
                    <MapPin className="w-3.5 h-3.5 opacity-75 shrink-0" />
                    <span>{location}</span>
                  </div>
                )}

                <div
                  className="inline-flex items-center justify-center gap-1.5 max-w-full px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-center"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    color: color.text,
                  }}
                >
                  {isRecurring ? (
                    <CalendarRange className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  )}
                  <span>{recurrenceDescription}</span>
                </div>
              </div>

              {/* Notas centradas */}
              {notes && (
                <div
                  className="w-full p-3 rounded-[var(--radius-md)] text-xs leading-relaxed whitespace-pre-wrap break-words text-center"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    color: color.text,
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5 font-semibold opacity-80 mb-1">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>Notas</span>
                  </div>
                  <div className="text-pretty">{notes}</div>
                </div>
              )}
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Confirmacion para borrado de evento puntual */}
      <ConfirmDialog
        open={confirmSingleDeleteOpen}
        onOpenChange={setConfirmSingleDeleteOpen}
        title="Eliminar evento"
        description={`¿Eliminar "${title}"? Podrás deshacerlo durante unos segundos.`}
        confirmText="Eliminar"
        variant="destructive"
        onConfirm={() => {
          onDelete(rawEvent.id, event.date, 'series');
          onClose();
        }}
      />
    </>
  );
}

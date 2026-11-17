'use client';

import { useState } from 'react';
import { Pencil, MapPin, Calendar, CalendarRange, Trash2, ArrowLeft } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { toast } from 'sonner';
import { getSubjectColorStyle } from '../utils/colorLogic';
import { parseDateNumber, formatDateShort } from '../utils/dayLogic';
import { formatTime } from '../utils/dateTimeUtils';
import { formatRooms } from '../utils/subgroups';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };

export default function CustomEventDetailModal({
  event,
  onEdit,
  onDelete,
  onRestore, // callback opcional para deshacer
  onClose,
  isDark = false,
}) {
  const [viewMode, setViewMode] = useState('detail'); // 'detail' | 'scope-delete'
  const [confirmSingleDeleteOpen, setConfirmSingleDeleteOpen] = useState(false);

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
    toast.success(mode === 'single' ? 'Instancia eliminada' : 'Serie semanal eliminada', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          onRestore?.(rawEvent, mode);
        },
      },
    });
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
            borderColor: modalBorderColor,
            '--card-bg': color.bg,
            '--card-ink': color.text,
          }}
        >
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
            <div className="space-y-4 text-left">
              {/* Cabecera: Categoria opcional + Titulo primero + Fecha y hora como subtitulo */}
              <div className="pr-8 space-y-1.5">
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

                <h2 className="text-xl font-bold leading-snug tracking-tight text-balance font-[var(--font-display)]" style={{ color: color.text }}>
                  {title}
                </h2>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium tabular-nums" style={{ color: color.text, opacity: 0.85 }}>
                  <span>{dayName} {dateStr}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold">{timeStr}</span>
                </div>
              </div>

              {/* Detalles adicionales alineados a la izquierda */}
              <div className="space-y-2.5 text-sm pt-0.5 flex flex-col items-start text-left" style={{ color: color.text }}>
                {location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 opacity-75 shrink-0" />
                    <span className="font-medium">{location}</span>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs opacity-85">
                  <Calendar className="w-3.5 h-3.5 mt-0.5 opacity-75 shrink-0" />
                  <span>{recurrenceDescription}</span>
                </div>

                {notes && (
                  <div
                    className="w-full p-3 rounded-[var(--radius-md)] text-xs leading-relaxed whitespace-pre-wrap break-words mt-1 text-left text-pretty"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    }}
                  >
                    {notes}
                  </div>
                )}
              </div>

              {/* Pie con acciones: contraste garantizado y tono integrado con la tarjeta */}
              <div
                className="pt-3.5 flex items-center justify-between gap-2 border-t"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="lesson-card-btn-danger touch-target-44 h-9 px-3.5 font-semibold transition-all duration-150"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Eliminar</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="lesson-card-btn-primary touch-target-44 h-9 px-4 font-semibold shadow-xs transition-all duration-150"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  <span>Editar</span>
                </Button>
              </div>
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Confirmacion para borrado de evento puntual */}
      <ConfirmDialog
        open={confirmSingleDeleteOpen}
        onOpenChange={setConfirmSingleDeleteOpen}
        title="Eliminar evento"
        description={`¿Eliminar "${title}"? Esta acción se puede deshacer.`}
        confirmText="Eliminar"
        variant="destructive"
        onConfirm={() => {
          onDelete(rawEvent.id, event.date, 'series');
          toast.success('Evento eliminado', {
            action: {
              label: 'Deshacer',
              onClick: () => {
                onRestore?.(rawEvent, 'series');
              },
            },
          });
          onClose();
        }}
      />
    </>
  );
}

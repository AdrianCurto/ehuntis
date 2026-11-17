'use client';

import { useState } from 'react';
import { Pencil, MapPin, AlignLeft, Calendar, CalendarRange, Trash2, X, ArrowLeft } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { toast } from 'sonner';
import { getSubjectColorStyle } from '../utils/colorLogic';
import { parseDateNumber, formatDateShort } from '../utils/dayLogic';
import { formatRooms } from '../utils/subgroups';
import { cn } from '../utils/cn';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAYS_SHORT = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo' };

function formatTime(t) {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, '0');
  return `${h}:${m}`;
}

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
      : 'hasta fin de curso';
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
          style={{ background: color.bg }}
        >
          {viewMode === 'scope-delete' ? (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('detail')}
                  style={{ color: color.text }}
                  className="px-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  <span>Atrás</span>
                </Button>
                <ResponsiveModalTitle className="text-base font-semibold" style={{ color: color.text }}>
                  Eliminar repeticiones
                </ResponsiveModalTitle>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: color.text, opacity: 0.85 }}>
                Este evento se repite semanalmente. Elige qué instancias deseas eliminar:
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleConfirmDelete('single')}
                  className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                  style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-rose-500/20 text-rose-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: color.text }}>
                      Solo esta fecha
                    </div>
                    <div className="text-xs" style={{ color: color.text, opacity: 0.75 }}>
                      Se conservan las demás semanas del horario
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmDelete('series')}
                  className="flex items-center gap-3 p-3.5 rounded-[var(--radius-lg)] border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
                  style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-rose-500/20 text-rose-500">
                    <CalendarRange className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: color.text }}>
                      Toda la serie semanal
                    </div>
                    <div className="text-xs" style={{ color: color.text, opacity: 0.75 }}>
                      Elimina todas las fechas pasadas y futuras
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setViewMode('detail')}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cabecera con fecha y hora */}
              <div className="flex flex-col items-center text-center px-6">
                <div className="text-sm font-semibold" style={{ color: color.text, opacity: 0.85 }}>
                  {dayName} {dateStr}
                </div>
                <div className="text-lg font-bold tabular-nums" style={{ color: color.text }}>
                  {timeStr}
                </div>
              </div>

              {/* Categoría si existe */}
              {category && (
                <div className="flex justify-center">
                  <div
                    className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      color: color.text,
                      background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
                    }}
                  >
                    {category}
                  </div>
                </div>
              )}

              {/* Título del evento */}
              <div className="text-xl font-bold leading-snug text-center text-balance" style={{ color: color.text }}>
                {title}
              </div>

              {/* Detalles adicionales */}
              <div className="space-y-2 text-sm pt-1 flex flex-col items-center text-center" style={{ color: color.text }}>
                {location && (
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="w-4 h-4 opacity-75 shrink-0" />
                    <span>{location}</span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-xs opacity-85">
                  <Calendar className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <span>{recurrenceDescription}</span>
                </div>

                {notes && (
                  <div
                    className="w-full p-3 rounded-[var(--radius-md)] text-xs leading-relaxed whitespace-pre-wrap break-words mt-3 text-center text-pretty"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    }}
                  >
                    {notes}
                  </div>
                )}
              </div>

              {/* Pie con botones de acción */}
              <div className="pt-4 flex items-center justify-between border-t border-black/10 dark:border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="font-semibold bg-rose-500/15 hover:bg-rose-500/25 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-500/30 dark:border-rose-400/35 transition-all duration-150"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
                  <span>Eliminar</span>
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEdit}
                    className="font-semibold bg-indigo-500/14 hover:bg-indigo-500/24 dark:bg-indigo-500/18 dark:hover:bg-indigo-500/28 text-indigo-800 dark:text-indigo-200 border border-indigo-500/25 dark:border-indigo-400/30 transition-all duration-150"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Editar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="font-medium bg-black/8 hover:bg-black/14 dark:bg-white/10 dark:hover:bg-white/18 text-black/80 dark:text-white/85 border border-black/12 dark:border-white/15 transition-all duration-150"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Confirmación para borrado de evento puntual */}
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

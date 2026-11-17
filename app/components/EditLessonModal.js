'use client';

import { useState } from 'react';
import { Calendar, Clock, MapPin, AlignLeft, AlertCircle, RotateCcw } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { TimePicker } from './ui/time-picker';
import { DatePicker } from './ui/date-picker';
import { toast } from 'sonner';
import { subjectColor } from './WeekCalendar';
import { formatRoom, formatRooms } from '../utils/subgroups';
import { formatTime } from '../utils/dateTimeUtils';

function timeNumberToString(t) {
  if (typeof t !== 'number') return '08:00';
  return formatTime(t) || '08:00';
}

function timeStringToNumber(s) {
  if (!s || typeof s !== 'string') return 0;
  const parts = s.split(':').map(Number);
  return (parts[0] || 0) * 100 + (parts[1] || 0);
}

function dateNumberToString(dateNum) {
  if (!dateNum || typeof dateNum !== 'number') return '';
  const y = Math.floor(dateNum / 10000);
  const m = String(Math.floor((dateNum % 10000) / 100)).padStart(2, '0');
  const d = String(dateNum % 100).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateStringToNumber(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return parts[0] * 10000 + parts[1] * 100 + parts[2];
  }
  return null;
}

function parseDate(dateNum) {
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

function normalizeRoomForCompare(str) {
  return (str || '').replace(/\s+/g, '').toLowerCase();
}

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function EditLessonModal({
  lesson,
  onSave,
  onResetOverride,
  onRestoreOverride,
  onClose,
  isDark = false,
}) {
  const [dateStr, setDateStr] = useState(() => dateNumberToString(lesson?.date));
  const [startTimeStr, setStartTimeStr] = useState(() => timeNumberToString(lesson?.startTime));
  const [endTimeStr, setEndTimeStr] = useState(() => timeNumberToString(lesson?.endTime));
  const [roomsStr, setRoomsStr] = useState(() => formatRooms(lesson?.rooms));
  const [notes, setNotes] = useState(() => lesson?.notes || '');
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null); // 'time' | 'date' | null

  if (!lesson) return null;

  const selectedDateNum = dateStringToNumber(dateStr) || lesson.date;
  const date = parseDate(selectedDateNum);
  const dayName = DAYS_LONG[date.getDay()];
  const dateFormatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const subjectName = lesson.subjects?.[0] || 'Clase';

  // Valores oficiales de WebUntis para indicador de diferencias
  const officialDateNum = lesson.rawDate ?? lesson.date;
  const officialStartNum = lesson.rawStartTime ?? lesson.startTime;
  const officialEndNum = lesson.rawEndTime ?? lesson.endTime;
  const officialRoomsStr = formatRooms(lesson.rawRooms ?? lesson.rooms);

  const currentStartNum = timeStringToNumber(startTimeStr);
  const currentEndNum = timeStringToNumber(endTimeStr);

  const isDateModified = selectedDateNum !== officialDateNum;
  const isTimeModified = currentStartNum !== officialStartNum || currentEndNum !== officialEndNum;
  const isRoomModified = normalizeRoomForCompare(roomsStr) !== normalizeRoomForCompare(officialRoomsStr);
  const isNotesModified = Boolean(notes.trim());
  const hasAnyDiffFromOfficial = Boolean(
    lesson.isOverridden || isDateModified || isTimeModified || isRoomModified || isNotesModified
  );

  const officialSummaryParts = [
    `${formatTime(officialStartNum)}–${formatTime(officialEndNum)}`,
    officialRoomsStr || null,
  ].filter(Boolean);

  const handleStartTimeChange = (newStart) => {
    setStartTimeStr(newStart);
    setError('');
    setErrorField(null);
    const startNum = timeStringToNumber(newStart);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      const nextHour = Math.min(2359, startNum + 100);
      setEndTimeStr(timeNumberToString(nextHour));
    }
  };

  const handleResetToOfficial = () => {
    if (lesson.isOverridden && onResetOverride) {
      const snapshot = onResetOverride(lesson);
      toast.success('Clase restablecida al horario oficial', {
        action: onRestoreOverride
          ? {
              label: 'Deshacer',
              onClick: () => onRestoreOverride(snapshot, lesson),
            }
          : undefined,
      });
      onClose();
      return;
    }

    setDateStr(dateNumberToString(officialDateNum));
    setStartTimeStr(timeNumberToString(officialStartNum));
    setEndTimeStr(timeNumberToString(officialEndNum));
    setRoomsStr(officialRoomsStr);
    setNotes('');
    setError('');
    setErrorField(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);

    if (endNum <= startNum) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      setErrorField('time');
      return;
    }

    const newDateNum = dateStringToNumber(dateStr);
    if (!newDateNum) {
      setError('Por favor, selecciona una fecha válida.');
      setErrorField('date');
      return;
    }

    const roomsArr = roomsStr
      .split(',')
      .map((r) => formatRoom(r.trim()))
      .filter(Boolean);

    onSave(lesson, {
      customDate: newDateNum,
      customStartTime: startNum,
      customEndTime: endNum,
      customRooms: roomsArr,
      customNotes: notes.trim(),
    });
    onClose();
  };

  return (
    <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ResponsiveModalContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-w-md p-5 sm:p-6 overflow-y-auto overscroll-contain"
      >
        <ResponsiveModalHeader className="mb-3 pr-8">
          <ResponsiveModalTitle className="text-base font-bold">
            Personalizar clase
          </ResponsiveModalTitle>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
            {dayName} {dateFormatted}
          </div>
        </ResponsiveModalHeader>

        {/* Tarjeta de asignatura (porta el color oficial sin barra arqueada superior) */}
        <div
          className="flex items-center justify-between p-3 rounded-[var(--radius-md)] text-sm font-bold mb-3"
          style={{ background: color.bg, color: color.text }}
        >
          <span>{subjectName}</span>
          {lesson.type && (
            <span className="text-xs font-normal opacity-85">
              {lesson.type}
            </span>
          )}
        </div>

        {/* Indicador respecto a WebUntis cuando la clase esta modificada */}
        {hasAnyDiffFromOfficial && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
            <div className="text-[var(--text-secondary)] tabular-nums">
              <span className="font-semibold text-[var(--text-primary)]">Oficial:</span>{' '}
              {officialSummaryParts.join(' · ')}
            </div>
            <button
              type="button"
              onClick={handleResetToOfficial}
              className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 rounded"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer esta clase</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Fecha de la clase */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]">
              <span className="flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                Fecha
              </span>
              {isDateModified && (
                <span className="text-[11px] font-medium text-[var(--accent)]">Modificado</span>
              )}
            </label>
            <DatePicker
              value={dateStr}
              error={errorField === 'date'}
              onChange={(newDate) => {
                setDateStr(newDate);
                setError('');
                setErrorField(null);
              }}
              ariaLabel="Fecha de la clase"
            />
          </div>

          {/* Horas de Inicio y Fin */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]">
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                  Inicio
                </span>
                {currentStartNum !== officialStartNum && (
                  <span className="text-[11px] font-medium text-[var(--accent)]">Modificado</span>
                )}
              </label>
              <TimePicker
                value={startTimeStr}
                step={30}
                error={errorField === 'time'}
                onChange={(str) => handleStartTimeChange(str)}
                ariaLabel="Hora de inicio"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]">
                <span className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                  Fin
                </span>
                {currentEndNum !== officialEndNum && (
                  <span className="text-[11px] font-medium text-[var(--accent)]">Modificado</span>
                )}
              </label>
              <TimePicker
                value={endTimeStr}
                step={30}
                error={errorField === 'time'}
                onChange={(str) => {
                  setEndTimeStr(str);
                  setError('');
                  setErrorField(null);
                }}
                ariaLabel="Hora de fin"
              />
            </div>
          </div>

          {/* Aula */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]">
              <span className="flex items-center">
                <MapPin className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
                Aula / Ubicación
                <span className="ml-1 font-normal text-[var(--text-muted)]">(opcional)</span>
              </span>
              {isRoomModified && (
                <span className="text-[11px] font-medium text-[var(--accent)]">Modificado</span>
              )}
            </label>
            <Input
              placeholder="Aula o ubicación..."
              value={roomsStr}
              onChange={(e) => setRoomsStr(e.target.value)}
            />
          </div>

          {/* Notas personales */}
          <div className="space-y-1.5">
            <label className="flex items-center text-[13px] font-medium text-[var(--text-primary)]">
              <AlignLeft className="w-3.5 h-3.5 mr-1.5 text-[var(--text-muted)]" />
              <span>Notas personales</span>
              <span className="ml-1 font-normal text-[var(--text-muted)]">(opcional)</span>
            </label>
            <Textarea
              placeholder="Detalles, enlaces o recordatorios..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="p-3 rounded-[var(--radius-md)] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de accion */}
          <ResponsiveModalFooter className="flex flex-row justify-end gap-2.5 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              className="flex-1 sm:flex-initial justify-center"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="default"
              size="md"
              className="flex-[2] sm:flex-initial justify-center"
            >
              Guardar cambios
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

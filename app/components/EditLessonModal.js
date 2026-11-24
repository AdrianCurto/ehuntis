'use client';

import { useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalBody,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { TimePicker } from './ui/time-picker';
import { DatePicker } from './ui/date-picker';
import { ConfirmDialog } from './ui/confirm-dialog';
import { subjectColor } from './WeekCalendar';
import { formatRoom, formatRooms } from '../utils/subgroups';
import {
  areRoomsEqual,
  getOfficialDiffSummaryParts,
  isEditLessonFormDirty,
} from '../utils/lessonOverrides';
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


export default function EditLessonModal({
  lesson,
  onSave,
  onResetOverride,
  onClose,
  isDark = false,
}) {
  const [initialFormSnapshot] = useState(() => ({
    date: lesson?.date,
    startTime: timeStringToNumber(timeNumberToString(lesson?.startTime)),
    endTime: timeStringToNumber(timeNumberToString(lesson?.endTime)),
    rooms: lesson?.rooms,
    notes: lesson?.notes || '',
  }));
  const [dateStr, setDateStr] = useState(() => dateNumberToString(lesson?.date));
  const [startTimeStr, setStartTimeStr] = useState(() => timeNumberToString(lesson?.startTime));
  const [endTimeStr, setEndTimeStr] = useState(() => timeNumberToString(lesson?.endTime));
  const [roomsStr, setRoomsStr] = useState(() => formatRooms(lesson?.rooms));
  const [notes, setNotes] = useState(() => lesson?.notes || '');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null); // 'time' | 'date' | null

  if (!lesson) return null;

  const selectedDateNum = dateStringToNumber(dateStr) || lesson.date;

  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const subjectName = lesson.subjects?.[0] || 'Clase';

  // Valores oficiales de WebUntis para indicador de diferencias
  const officialDateNum = lesson.rawDate ?? lesson.date;
  const officialStartNum = lesson.rawStartTime ?? lesson.startTime;
  const officialEndNum = lesson.rawEndTime ?? lesson.endTime;
  const officialRooms = lesson.rawRooms ?? lesson.rooms;
  const officialRoomsStr = formatRooms(officialRooms);

  const currentStartNum = timeStringToNumber(startTimeStr);
  const currentEndNum = timeStringToNumber(endTimeStr);

  const isDateModified = selectedDateNum !== officialDateNum;
  const isTimeModified = currentStartNum !== officialStartNum || currentEndNum !== officialEndNum;
  const isRoomModified = !areRoomsEqual(roomsStr, officialRooms);
  const isNotesModified = Boolean(notes.trim());
  const hasAnyDiffFromOfficial = Boolean(
    lesson.isOverridden || isDateModified || isTimeModified || isRoomModified || isNotesModified
  );

  const officialSummaryParts = getOfficialDiffSummaryParts({
    officialDate: officialDateNum,
    currentDate: selectedDateNum,
    officialStartTime: officialStartNum,
    officialEndTime: officialEndNum,
    currentStartTime: currentStartNum,
    currentEndTime: currentEndNum,
    officialRooms,
    currentRooms: roomsStr,
  });

  const isDirty = isEditLessonFormDirty(initialFormSnapshot, {
    date: selectedDateNum,
    startTime: currentStartNum,
    endTime: currentEndNum,
    rooms: roomsStr,
    notes,
  });

  const handleRequestClose = () => {
    if (confirmDiscardOpen) return false;
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return false;
    }
    onClose();
    return true;
  };

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
      onResetOverride(lesson);
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
    <>
      <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) handleRequestClose(); }}>
        <ResponsiveModalContent
          onBeforeDismiss={handleRequestClose}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-md p-0 pb-0 overflow-hidden max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col"
        >
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden" noValidate>
            <ResponsiveModalHeader className="px-5 sm:px-6 min-h-[52px] sm:min-h-[56px] justify-center shrink-0 border-b border-[var(--border-light)] bg-[var(--surface-elevated)] pr-14 mb-0">
              <ResponsiveModalTitle className="text-base font-bold">
                Personalizar clase
              </ResponsiveModalTitle>
            </ResponsiveModalHeader>

            <ResponsiveModalBody className="px-5 sm:px-6 pt-4 pb-4 space-y-4">
              {/* Tarjeta de asignatura (porta el color oficial sin barra arqueada superior) */}
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-[var(--radius-md)] text-sm font-bold"
                style={{ background: color.bg, color: color.text }}
              >
                <span className="min-w-0">{subjectName}</span>
                {lesson.type && (
                  <span className="text-xs font-normal opacity-85 shrink-0 whitespace-nowrap">
                    {lesson.type}
                  </span>
                )}
              </div>

              {/* Indicador respecto a WebUntis cuando la clase esta modificada */}
              {hasAnyDiffFromOfficial && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
                  <div className="text-[var(--text-secondary)] tabular-nums">
                    {officialSummaryParts.length > 0 ? (
                      <>
                        <span className="font-semibold text-[var(--text-primary)]">Oficial:</span>{' '}
                        {officialSummaryParts.join(' · ')}
                      </>
                    ) : (
                      <span>
                        {isNotesModified
                          ? 'Solo notas personales'
                          : lesson.isUserCancelled
                            ? 'Clase cancelada por ti'
                            : 'Sin diferencias con el horario oficial'}
                      </span>
                    )}
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

              {/* Horas de Inicio y Fin */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]">
                    <span>Inicio</span>
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
                    <span>Fin</span>
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

              {/* Fecha de la clase */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]">
                  <span>Fecha</span>
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

              {/* Aula */}
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-lesson-room"
                  className="flex items-center justify-between text-[13px] font-medium text-[var(--text-primary)]"
                >
                  <span>Aula</span>
                  {isRoomModified && (
                    <span className="text-[11px] font-medium text-[var(--accent)]">Modificado</span>
                  )}
                </label>
                <Input
                  id="edit-lesson-room"
                  placeholder="Aula"
                  value={roomsStr}
                  onChange={(e) => setRoomsStr(e.target.value)}
                />
              </div>

              {/* Notas personales */}
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-lesson-notes"
                  className="flex items-center text-[13px] font-medium text-[var(--text-primary)]"
                >
                  <span>Notas personales</span>
                </label>
                <Textarea
                  id="edit-lesson-notes"
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
            </ResponsiveModalBody>

            {/* Botones de accion fijos */}
            <ResponsiveModalFooter className="flex flex-row items-center justify-end gap-2.5 px-5 sm:px-6 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-[var(--border-light)] bg-[var(--surface-elevated)] shrink-0 z-10 mt-auto">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleRequestClose}
                className="flex-1 sm:flex-initial justify-center"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="default"
                size="md"
                className="flex-[2] sm:flex-initial sm:min-w-[132px] justify-center"
              >
                Guardar cambios
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ConfirmDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        title="¿Salir sin guardar?"
        description="Tienes cambios sin guardar. Si sales ahora, se perderán."
        cancelText="Seguir editando"
        confirmText="Descartar cambios"
        variant="destructive"
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onClose();
        }}
      />
    </>
  );
}

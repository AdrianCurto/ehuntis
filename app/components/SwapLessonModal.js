'use client';

import { useState } from 'react';
import {
  ArrowUpDown,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Check,
  User,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalBody,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { subjectColor } from './WeekCalendar';
import { formatTime } from '../utils/dateTimeUtils';
import { toMinutes } from '../utils/dayLogic';
import { formatRooms } from '../utils/subgroups';
import { formatTeacher } from '../utils/teachers';

function parseDate(dateNum) {
  if (!dateNum) return new Date();
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const fromMinutes = (m) => Math.floor(m / 60) * 100 + (m % 60);

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function SwapLessonModal({
  lesson,
  targetLesson,
  onSwap,
  onSelectAnother,
  onClose,
  isDark = false,
}) {
  const [keepDuration, setKeepDuration] = useState(true);
  const [swapRooms, setSwapRooms] = useState(false);

  if (!lesson || !targetLesson) return null;

  const originDuration = toMinutes(lesson.endTime) - toMinutes(lesson.startTime);
  const originDate = parseDate(lesson.date);
  const originDayName = DAYS_LONG[originDate.getDay()];
  const originDateFormatted = `${String(originDate.getDate()).padStart(2, '0')}/${String(originDate.getMonth() + 1).padStart(2, '0')}/${originDate.getFullYear()}`;
  const originColor = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const originSubject = lesson.subjects?.[0] || 'Clase';
  const originRoom = formatRooms(lesson.rooms) || 'Sin aula';
  const originTeacher = formatTeacher(lesson.teachers?.[0] || '');

  const targetDuration = toMinutes(targetLesson.endTime) - toMinutes(targetLesson.startTime);
  const targetDate = parseDate(targetLesson.date);
  const targetDayName = DAYS_LONG[targetDate.getDay()];
  const targetDateFormatted = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;
  const targetColor = subjectColor(targetLesson.subjectIds?.[0] || 0, isDark);
  const targetSubject = targetLesson.subjects?.[0] || 'Clase';
  const targetRoom = formatRooms(targetLesson.rooms) || 'Sin aula';
  const targetTeacher = formatTeacher(targetLesson.teachers?.[0] || '');

  const isDifferentDay = lesson.date !== targetLesson.date;
  const diffDuration = originDuration !== targetDuration;
  const roomA = originRoom.trim().toLowerCase();
  const roomB = targetRoom.trim().toLowerCase();
  const diffRooms = roomA !== roomB;

  const newStartForOrigin = targetLesson.startTime;
  const newEndForOrigin = keepDuration
    ? fromMinutes(toMinutes(targetLesson.startTime) + originDuration)
    : targetLesson.endTime;

  const newStartForTarget = lesson.startTime;
  const newEndForTarget = keepDuration
    ? fromMinutes(toMinutes(lesson.startTime) + targetDuration)
    : lesson.endTime;

  const handleConfirm = () => {
    onSwap(lesson, targetLesson, { keepDuration, swapRooms });
    onClose();
  };

  return (
    <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ResponsiveModalContent
        className="max-w-lg p-0 pb-0 overflow-hidden max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] flex flex-col"
      >
        <ResponsiveModalHeader className="px-5 sm:px-6 min-h-[52px] sm:min-h-[56px] justify-center shrink-0 border-b border-[var(--border-light)] bg-[var(--surface-elevated)] pr-14 mb-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] shrink-0">
              <ArrowUpDown className="w-4 h-4" />
            </span>
            <ResponsiveModalTitle className="text-base font-bold">
              Confirmar intercambio
            </ResponsiveModalTitle>
          </div>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="px-5 sm:px-6 pt-4 pb-4 space-y-4">
          {isDifferentDay && (
            <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius-md)] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 text-xs font-semibold">
              <CalendarIcon className="w-4 h-4 shrink-0" />
              <span>Intercambio entre días distintos ({originDayName} ⇄ {targetDayName})</span>
            </div>
          )}

        {/* Comparativa visual de las dos clases (Antes → Después) */}
        <div className="space-y-2 mb-4">
          {/* Clase A (Origen) */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div
              className="p-2.5 px-3.5 flex items-center justify-between font-bold text-xs"
              style={{ background: originColor.bg, color: originColor.text }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{originSubject}</span>
                {lesson.type && (
                  <span className="opacity-80 font-normal text-[11px] shrink-0">
                    ({lesson.type})
                  </span>
                )}
              </div>
              <span className="opacity-85 font-medium tabular-nums text-[11px] shrink-0 ml-2">
                {originDayName} {originDateFormatted}
              </span>
            </div>

            <div className="p-3 text-xs space-y-2">
              {/* Horario Antes → Después */}
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Horario:</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium text-right">
                  <span className="line-through opacity-75">{formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}</span>
                  <ArrowRight className="w-3 h-3 text-[var(--accent)] shrink-0" />
                  <strong className="text-[var(--text-primary)]">
                    {isDifferentDay ? `${targetDayName} ` : ''}{formatTime(newStartForOrigin)}–{formatTime(newEndForOrigin)}
                  </strong>
                </span>
              </div>

              {/* Aula */}
              <div className="flex items-center justify-between gap-2 min-h-[20px]">
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Aula:</span>
                </span>
                <span className="font-medium text-right">
                  {diffRooms && swapRooms ? (
                    <span className="flex items-center gap-1.5">
                      <span className="line-through opacity-75">{originRoom}</span>
                      <ArrowRight className="w-3 h-3 text-[var(--accent)] shrink-0" />
                      <strong className="text-[var(--text-primary)]">{targetRoom}</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <strong className="text-[var(--text-primary)]">{originRoom}</strong>
                      {diffRooms && <span className="text-[var(--text-muted)] text-[11px]">(se mantiene)</span>}
                    </span>
                  )}
                </span>
              </div>

              {/* Profesor */}
              {originTeacher && (
                <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3 h-3 shrink-0" />
                    <span>Profesor/a:</span>
                  </span>
                  <span className="truncate text-right">{originTeacher}</span>
                </div>
              )}
            </div>
          </div>

          {/* Icono central de intercambio */}
          <div className="flex justify-center -my-2 relative z-10">
            <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Clase B (Destino) */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div
              className="p-2.5 px-3.5 flex items-center justify-between font-bold text-xs"
              style={{ background: targetColor.bg, color: targetColor.text }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate">{targetSubject}</span>
                {targetLesson.type && (
                  <span className="opacity-80 font-normal text-[11px] shrink-0">
                    ({targetLesson.type})
                  </span>
                )}
              </div>
              <span className="opacity-85 font-medium tabular-nums text-[11px] shrink-0 ml-2">
                {targetDayName} {targetDateFormatted}
              </span>
            </div>

            <div className="p-3 text-xs space-y-2">
              {/* Horario Antes → Después */}
              <div className="flex items-center justify-between gap-2 tabular-nums">
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Horario:</span>
                </span>
                <span className="flex items-center gap-1.5 font-medium text-right">
                  <span className="line-through opacity-75">{formatTime(targetLesson.startTime)}–{formatTime(targetLesson.endTime)}</span>
                  <ArrowRight className="w-3 h-3 text-[var(--accent)] shrink-0" />
                  <strong className="text-[var(--text-primary)]">
                    {isDifferentDay ? `${originDayName} ` : ''}{formatTime(newStartForTarget)}–{formatTime(newEndForTarget)}
                  </strong>
                </span>
              </div>

              {/* Aula */}
              <div className="flex items-center justify-between gap-2 min-h-[20px]">
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Aula:</span>
                </span>
                <span className="font-medium text-right">
                  {diffRooms && swapRooms ? (
                    <span className="flex items-center gap-1.5">
                      <span className="line-through opacity-75">{targetRoom}</span>
                      <ArrowRight className="w-3 h-3 text-[var(--accent)] shrink-0" />
                      <strong className="text-[var(--text-primary)]">{originRoom}</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <strong className="text-[var(--text-primary)]">{targetRoom}</strong>
                      {diffRooms && <span className="text-[var(--text-muted)] text-[11px]">(se mantiene)</span>}
                    </span>
                  )}
                </span>
              </div>

              {/* Profesor */}
              {targetTeacher && (
                <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3 h-3 shrink-0" />
                    <span>Profesor/a:</span>
                  </span>
                  <span className="truncate text-right">{targetTeacher}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Opción: cambiar también las aulas */}
        {diffRooms && (
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] mb-3 flex flex-col justify-center">
            <Checkbox
              checked={swapRooms}
              onChange={setSwapRooms}
              className="flex items-start w-full"
            >
              <div className="flex-1 text-xs">
                <div className="font-semibold text-[var(--text-primary)] leading-normal">
                  Intercambiar también las aulas
                </div>
                <div className="text-[var(--text-secondary)] mt-0.5 leading-normal">
                  Por defecto cada clase permanece en su aula habitual.
                </div>
              </div>
            </Checkbox>
          </div>
        )}

        {/* Opción: mantener duración original */}
        {diffDuration && (
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] mb-4 flex flex-col justify-center">
            <Checkbox
              checked={keepDuration}
              onChange={setKeepDuration}
              className="flex items-start w-full"
            >
              <div className="flex-1 text-xs">
                <div className="font-semibold text-[var(--text-primary)]">
                  Mantener la duración original de cada clase
                </div>
                <div className="text-[var(--text-secondary)] mt-0.5 leading-relaxed tabular-nums">
                  {keepDuration ? (
                    <>
                      • <strong>{originSubject}</strong> mantendrá {originDuration} min ({formatTime(newStartForOrigin)}–{formatTime(newEndForOrigin)})<br />
                      • <strong>{targetSubject}</strong> mantendrá {targetDuration} min ({formatTime(newStartForTarget)}–{formatTime(newEndForTarget)})
                    </>
                  ) : (
                    'Cada clase adoptará exactamente las horas de inicio y fin del bloque de destino.'
                  )}
                </div>
              </div>
            </Checkbox>
          </div>
        )}
      </ResponsiveModalBody>

      <ResponsiveModalFooter className="flex flex-row items-center justify-end gap-2.5 px-5 sm:px-6 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:py-3.5 border-t border-[var(--border-light)] bg-[var(--surface-elevated)] shrink-0 z-10 mt-auto">
        <Button
          variant="secondary"
          size="md"
          className="flex-1 sm:flex-initial justify-center"
          onClick={() => {
            if (onSelectAnother) {
              onSelectAnother();
            } else {
              onClose();
            }
          }}
        >
          Elegir otra clase
        </Button>
        <Button
          variant="default"
          size="md"
          className="flex-[2] sm:flex-initial sm:min-w-[132px] justify-center"
          onClick={handleConfirm}
        >
          <Check className="w-4 h-4 mr-1.5" />
          Confirmar intercambio
        </Button>
      </ResponsiveModalFooter>
    </ResponsiveModalContent>
  </ResponsiveModal>
  );
}

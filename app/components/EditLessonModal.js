'use client';

import { useState } from 'react';
import { X, Clock, MapPin, AlignLeft, AlertCircle } from 'lucide-react';
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
import { subjectColor } from './WeekCalendar';
import { formatRoom, formatRooms } from '../utils/subgroups';
import { cn } from '../utils/cn';

function timeNumberToString(t) {
  if (typeof t !== 'number') return '08:00';
  const h = Math.floor(t / 100);
  const m = t % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeStringToNumber(s) {
  if (!s || typeof s !== 'string') return 0;
  const parts = s.split(':').map(Number);
  return (parts[0] || 0) * 100 + (parts[1] || 0);
}

function parseDate(dateNum) {
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function EditLessonModal({ lesson, onSave, onClose, isDark = false }) {
  const [startTimeStr, setStartTimeStr] = useState(() => timeNumberToString(lesson?.startTime));
  const [endTimeStr, setEndTimeStr] = useState(() => timeNumberToString(lesson?.endTime));
  const [roomsStr, setRoomsStr] = useState(() => formatRooms(lesson?.rooms));
  const [notes, setNotes] = useState(() => lesson?.notes || '');
  const [error, setError] = useState('');

  if (!lesson) return null;

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateFormatted = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const subjectName = lesson.subjects?.[0] || 'Clase';

  const handleStartTimeChange = (newStart) => {
    setStartTimeStr(newStart);
    setError('');
    const startNum = timeStringToNumber(newStart);
    const endNum = timeStringToNumber(endTimeStr);
    if (endNum <= startNum) {
      const nextHour = Math.min(2359, startNum + 100);
      setEndTimeStr(timeNumberToString(nextHour));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const startNum = timeStringToNumber(startTimeStr);
    const endNum = timeStringToNumber(endTimeStr);

    if (endNum <= startNum) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    const roomsArr = roomsStr
      .split(',')
      .map((r) => formatRoom(r.trim()))
      .filter(Boolean);

    onSave(lesson, {
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
        className="max-w-md p-6 overflow-y-auto max-h-[90vh] overflow-hidden"
      >
        {/* Barra interior de acento de color */}
        <div
          className="absolute top-0 inset-x-0 h-1.5 rounded-t-[inherit] pointer-events-none z-10"
          style={{ backgroundColor: color.bg }}
        />

        <ResponsiveModalHeader className="mb-4">
          <ResponsiveModalTitle className="text-base font-bold">
            Personalizar clase
          </ResponsiveModalTitle>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {dayName} {dateFormatted}
          </div>
        </ResponsiveModalHeader>

        {/* Tarjeta de asignatura */}
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Horas de Inicio y Fin con saltos de 30 minutos lectivos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Inicio
              </label>
              <TimePicker
                value={startTimeStr}
                step={30}
                onChange={(str) => handleStartTimeChange(str)}
                ariaLabel="Hora de inicio"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Fin
              </label>
              <TimePicker
                value={endTimeStr}
                step={30}
                onChange={(str) => {
                  setEndTimeStr(str);
                  setError('');
                }}
                ariaLabel="Hora de fin"
              />
            </div>
          </div>

          {/* Aula */}
          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Aula / Ubicación (opcional)
            </label>
            <Input
              placeholder="Aula o ubicación..."
              value={roomsStr}
              onChange={(e) => setRoomsStr(e.target.value)}
            />
          </div>

          {/* Notas personales */}
          <div className="space-y-1.5">
            <label className="flex items-center text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <AlignLeft className="w-3.5 h-3.5 mr-1 text-[var(--text-muted)]" /> Notas personales (opcional)
            </label>
            <Textarea
              placeholder="Detalles, enlaces o recordatorios..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Error banner */}
          {error && (
            <div className="p-3 rounded-[var(--radius-md)] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botones de acción */}
          <ResponsiveModalFooter className="flex-row justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="default" size="md">
              Guardar cambios
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

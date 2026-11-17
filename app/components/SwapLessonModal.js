'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ArrowUpDown,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Check,
  Search,
  SearchX,
  MousePointerClick,
} from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { SegmentedControl } from './ui/segmented-control';
import { subjectColor } from './WeekCalendar';
import { formatTime } from '../utils/dateTimeUtils';
import { toMinutes } from '../utils/dayLogic';
import { formatRooms } from '../utils/subgroups';
import { cn } from '../utils/cn';

function parseDate(dateNum) {
  if (!dateNum) return new Date();
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

const fromMinutes = (m) => Math.floor(m / 60) * 100 + (m % 60);

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const SWAP_FILTER_OPTIONS = [
  { value: 'same_day', label: 'Mismo día' },
  { value: 'all', label: 'Cualquier día' },
];

export default function SwapLessonModal({
  lesson,
  targetLesson = null,
  candidateLessons = [],
  onSelectFromCalendar,
  onSwap,
  onClose,
  isDark = false,
}) {
  const [selectedTarget, setSelectedTarget] = useState(targetLesson);
  const [keepDuration, setKeepDuration] = useState(true);
  const [swapRooms, setSwapRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'same_day' | 'all'

  useEffect(() => {
    setSelectedTarget(targetLesson);
    setSwapRooms(false);
  }, [targetLesson]);

  const validCandidates = useMemo(() => {
    if (!lesson) return [];
    return candidateLessons.filter((c) => {
      if (!c || c.isCustomEvent) return false;
      if (c.lessonKey && c.lessonKey === lesson.lessonKey) return false;
      if (c.id && lesson.id && c.id === lesson.id) return false;
      if (filterMode === 'same_day' && c.date !== lesson.date) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sub = (c.subjects?.[0] || '').toLowerCase();
        const rm = formatRooms(c.rooms).toLowerCase();
        const tp = (c.type || '').toLowerCase();
        return sub.includes(q) || rm.includes(q) || tp.includes(q);
      }
      return true;
    });
  }, [candidateLessons, lesson, filterMode, searchQuery]);

  if (!lesson) return null;

  const originDuration = toMinutes(lesson.endTime) - toMinutes(lesson.startTime);
  const originDate = parseDate(lesson.date);
  const originDayName = DAYS_LONG[originDate.getDay()];
  const originDateFormatted = `${String(originDate.getDate()).padStart(2, '0')}/${String(originDate.getMonth() + 1).padStart(2, '0')}/${originDate.getFullYear()}`;
  const originColor = subjectColor(lesson.subjectIds?.[0] || 0, isDark);
  const originSubject = lesson.subjects?.[0] || 'Clase';
  const originRoom = formatRooms(lesson.rooms) || 'Sin aula';

  // Vista de confirmacion de intercambio
  if (selectedTarget) {
    const targetDuration = toMinutes(selectedTarget.endTime) - toMinutes(selectedTarget.startTime);
    const targetDate = parseDate(selectedTarget.date);
    const targetDayName = DAYS_LONG[targetDate.getDay()];
    const targetDateFormatted = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;
    const targetColor = subjectColor(selectedTarget.subjectIds?.[0] || 0, isDark);
    const targetSubject = selectedTarget.subjects?.[0] || 'Clase';
    const targetRoom = formatRooms(selectedTarget.rooms) || 'Sin aula';

    const isDifferentDay = lesson.date !== selectedTarget.date;
    const diffDuration = originDuration !== targetDuration;
    const roomA = (formatRooms(lesson.rooms) || '').trim().toLowerCase();
    const roomB = (formatRooms(selectedTarget.rooms) || '').trim().toLowerCase();
    const diffRooms = roomA !== roomB;

    const newEndForOrigin = fromMinutes(toMinutes(selectedTarget.startTime) + originDuration);
    const newEndForTarget = fromMinutes(toMinutes(lesson.startTime) + targetDuration);

    const handleConfirm = () => {
      onSwap(lesson, selectedTarget, { keepDuration, swapRooms });
      onClose();
    };

    return (
      <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
        <ResponsiveModalContent
          className="max-w-lg p-5 sm:p-6 overflow-y-auto overscroll-contain"
        >
          <ResponsiveModalHeader className="mb-4 pr-8">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] shrink-0">
                <ArrowUpDown className="w-4 h-4" />
              </span>
              <div>
                <ResponsiveModalTitle className="text-base font-bold">
                  Confirmar intercambio
                </ResponsiveModalTitle>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Las dos clases intercambiarán sus horarios
                </div>
              </div>
            </div>
          </ResponsiveModalHeader>

          {isDifferentDay && (
            <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius-md)] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 text-xs font-semibold mb-3">
              <CalendarIcon className="w-4 h-4 shrink-0" />
              <span>Intercambio entre días distintos ({originDayName} ⇄ {targetDayName})</span>
            </div>
          )}

          {/* Comparativa visual de las dos clases */}
          <div className="space-y-2 mb-4">
            {/* Clase A */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div
                className="p-2.5 px-3.5 flex items-center justify-between font-bold text-xs"
                style={{ background: originColor.bg, color: originColor.text }}
              >
                <span>Clase A: {originSubject}</span>
                <span className="opacity-85 font-medium tabular-nums">{originDayName} {originDateFormatted}</span>
              </div>
              <div className="p-3 text-xs text-[var(--text-secondary)] flex justify-between flex-wrap gap-2 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Horario actual: <strong className="text-[var(--text-primary)]">{formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Aula: <strong className="text-[var(--text-primary)]">{swapRooms ? targetRoom : originRoom}</strong>
                  {diffRooms && !swapRooms && <span className="opacity-75">(se mantiene)</span>}
                </span>
              </div>
            </div>

            {/* Icono central de intercambio */}
            <div className="flex justify-center -my-2 relative z-10">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--accent)] flex items-center justify-center shadow-xs">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Clase B */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div
                className="p-2.5 px-3.5 flex items-center justify-between font-bold text-xs"
                style={{ background: targetColor.bg, color: targetColor.text }}
              >
                <span>Clase B: {targetSubject}</span>
                <span className="opacity-85 font-medium tabular-nums">{targetDayName} {targetDateFormatted}</span>
              </div>
              <div className="p-3 text-xs text-[var(--text-secondary)] flex justify-between flex-wrap gap-2 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Horario actual: <strong className="text-[var(--text-primary)]">{formatTime(selectedTarget.startTime)}–{formatTime(selectedTarget.endTime)}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Aula: <strong className="text-[var(--text-primary)]">{swapRooms ? originRoom : targetRoom}</strong>
                  {diffRooms && !swapRooms && <span className="opacity-75">(se mantiene)</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Opcion cambiar tambien las aulas */}
          {diffRooms && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] mb-3">
              <Checkbox
                checked={swapRooms}
                onChange={setSwapRooms}
                className="items-start w-full"
              >
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Intercambiar también las aulas
                  </div>
                  <div className="text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    {swapRooms ? (
                      <>
                        • <strong>{originSubject}</strong> pasará a <strong>{targetRoom}</strong><br />
                        • <strong>{targetSubject}</strong> pasará a <strong>{originRoom}</strong>
                      </>
                    ) : (
                      `Por defecto se mantiene cada clase en su aula habitual (${originSubject} en ${originRoom}, ${targetSubject} en ${targetRoom}).`
                    )}
                  </div>
                </div>
              </Checkbox>
            </div>
          )}

          {/* Mantener duracion original */}
          {diffDuration && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] mb-4">
              <Checkbox
                checked={keepDuration}
                onChange={setKeepDuration}
                className="items-start w-full"
              >
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Mantener la duración original de cada clase
                  </div>
                  <div className="text-[var(--text-secondary)] mt-0.5 leading-relaxed tabular-nums">
                    {keepDuration ? (
                      <>
                        • <strong>{originSubject}</strong> mantendrá {originDuration} min ({formatTime(selectedTarget.startTime)}–{formatTime(newEndForOrigin)})<br />
                        • <strong>{targetSubject}</strong> mantendrá {targetDuration} min ({formatTime(lesson.startTime)}–{formatTime(newEndForTarget)})
                      </>
                    ) : (
                      'Cada clase adoptará exactamente las horas de inicio y fin del bloque de destino.'
                    )}
                  </div>
                </div>
              </Checkbox>
            </div>
          )}

          <ResponsiveModalFooter className="flex flex-row justify-end gap-2.5 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
            <Button
              variant="secondary"
              size="md"
              className="flex-1 sm:flex-initial justify-center"
              onClick={() => {
                if (targetLesson) {
                  onSelectFromCalendar?.(lesson);
                  onClose();
                } else {
                  setSelectedTarget(null);
                }
              }}
            >
              Elegir otra clase
            </Button>
            <Button variant="default" size="md" className="flex-[2] sm:flex-initial justify-center" onClick={handleConfirm}>
              <Check className="w-4 h-4 mr-1.5" />
              Confirmar intercambio
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    );
  }

  // Vista interactiva para seleccionar clase de destino
  const hasActiveFilters = Boolean(searchQuery.trim() || filterMode === 'same_day');

  return (
    <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ResponsiveModalContent
        className="max-w-lg p-5 sm:p-6 overflow-y-auto overscroll-contain"
      >
        <ResponsiveModalHeader className="mb-3 pr-8">
          <ResponsiveModalTitle className="text-base font-bold flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[var(--accent)]" />
            <span>Intercambiar clase</span>
          </ResponsiveModalTitle>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
            {originDayName} {originDateFormatted} · {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
          </div>
        </ResponsiveModalHeader>

        {/* Clase actual origen */}
        <div
          className="p-3 rounded-[var(--radius-md)] flex items-center justify-between text-xs font-bold mb-3 shadow-xs"
          style={{ background: originColor.bg, color: originColor.text }}
        >
          <div>
            <span>{originSubject}</span>
            {lesson.type && <span className="opacity-80 font-normal ml-1.5">({lesson.type})</span>}
          </div>
          <div>{originRoom}</div>
        </div>

        {/* Boton destacado: Seleccionar directamente en el calendario */}
        <button
          type="button"
          onClick={() => {
            onSelectFromCalendar?.(lesson);
            onClose();
          }}
          className="w-full p-3 rounded-[var(--radius-lg)] bg-[var(--accent-light)] border border-[var(--accent)] text-[var(--accent)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
        >
          <MousePointerClick className="w-4 h-4" />
          <span>Seleccionar clase directamente en el horario</span>
        </button>

        <div className="flex items-center gap-2 my-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span>O selecciona de la lista</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Filtros y buscador con SegmentedControl unificado */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
          <div className="w-full sm:flex-1">
            <Input
              startIcon={Search}
              placeholder="Buscar por asignatura, aula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-xs w-full"
            />
          </div>

          <SegmentedControl
            options={SWAP_FILTER_OPTIONS}
            value={filterMode}
            onChange={setFilterMode}
            size="sm"
            ariaLabel="Filtrar clases por día"
            className="sm:w-auto sm:min-w-[205px] shrink-0"
          />
        </div>

        {/* Lista de candidatos con scrollbar-gutter estable y franja izquierda de 3px */}
        <div
          className="space-y-2 max-h-64 overflow-y-auto overscroll-contain mb-4"
          style={{ scrollbarGutter: 'stable' }}
        >
          {validCandidates.length === 0 ? (
            <div className="p-6 text-center bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                <SearchX className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                No hay clases coincidentes
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs text-pretty">
                {hasActiveFilters
                  ? 'Prueba a cambiar la búsqueda o ampliar el filtro a cualquier día de la semana.'
                  : 'No hay otras clases disponibles en esta semana para intercambiar.'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('all');
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            validCandidates.map((cand, idx) => {
              const candColor = subjectColor(cand.subjectIds?.[0] || 0, isDark);
              const stripeColor = isDark ? candColor.text : candColor.bg;
              const candSubject = cand.subjects?.[0] || 'Clase';
              const candRoom = formatRooms(cand.rooms) || 'Sin aula';
              const candDate = parseDate(cand.date);
              const candDayName = DAYS_LONG[candDate.getDay()];
              const candDateFormatted = `${String(candDate.getDate()).padStart(2, '0')}/${String(candDate.getMonth() + 1).padStart(2, '0')}`;
              const isDifferentDay = cand.date !== lesson.date;

              return (
                <div
                  key={cand.lessonKey || cand.id || idx}
                  onClick={() => setSelectedTarget(cand)}
                  className="relative overflow-hidden flex items-center justify-between gap-3 p-2.5 pl-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] transition-all cursor-pointer"
                >
                  {/* Franja izquierda de 3px con color visible de la asignatura */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: stripeColor }}
                  />

                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <span className="truncate">{candSubject}</span>
                      {cand.type && <span className="text-[11px] font-normal text-[var(--text-muted)]">({cand.type})</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)] tabular-nums">
                      <span className={cn('flex items-center gap-1', isDifferentDay && 'text-[var(--accent)] font-semibold')}>
                        <CalendarIcon className="w-3 h-3" /> {candDayName} {candDateFormatted}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(cand.startTime)}–{formatTime(cand.endTime)}
                      </span>
                      {candRoom && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {candRoom}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button variant="default" size="sm" className="h-8 px-3 text-xs shrink-0">
                    Elegir
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <ResponsiveModalFooter className="flex flex-row sm:justify-end pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
          <Button variant="secondary" size="md" className="w-full sm:w-auto justify-center" onClick={onClose}>
            Cancelar
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

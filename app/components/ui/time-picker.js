'use client';

import * as React from 'react';
import { Clock, Keyboard, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { cn } from '@/app/utils/cn';
import { useIsDesktop } from '@/app/utils/useMediaQuery';
import { parseValueToTime, formatTime } from '@/app/utils/dateTimeUtils';

export { parseValueToTime };

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export function TimePicker({
  value,
  onChange,
  disabled = false,
  error = false,
  className,
  ariaLabel = 'Hora',
  step = 5,
  ...props
}) {
  const parsedTime = React.useMemo(() => parseValueToTime(value), [value]);
  const [uncontrolledTime, setUncontrolledTime] = React.useState(() => parsedTime);
  const effectiveTime = value !== undefined ? parsedTime : uncontrolledTime;

  const hour = effectiveTime?.hour ?? 8;
  const minute = effectiveTime?.minute ?? 0;
  const hasValue = effectiveTime !== null;

  const [isOpen, setIsOpen] = React.useState(false);
  const isDesktop = useIsDesktop();
  const [mode, setMode] = React.useState('visual'); // 'visual' | 'keyboard'
  const [activeSegment, setActiveSegment] = React.useState('hour'); // 'hour' | 'minute'

  const [tempHour, setTempHour] = React.useState(() => String(hour).padStart(2, '0'));
  const [tempMinute, setTempMinute] = React.useState(() => String(minute).padStart(2, '0'));

  const activeHourRef = React.useRef(null);
  const activeMinuteRef = React.useRef(null);
  const hourInputRef = React.useRef(null);
  const minuteInputRef = React.useRef(null);

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      setTempHour(String(hour).padStart(2, '0'));
      setTempMinute(String(minute).padStart(2, '0'));
    }
    setIsOpen(nextOpen);
  };

  // Lista de minutos: múltiplos de 5 más el minuto actual si es impar
  const minutesList = React.useMemo(() => {
    const baseMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    if (minute !== undefined && !baseMinutes.includes(minute)) {
      return [...baseMinutes, minute].sort((a, b) => a - b).map((m) => String(m).padStart(2, '0'));
    }
    return baseMinutes.map((m) => String(m).padStart(2, '0'));
  }, [minute]);

  const emitTimeChange = (h, m) => {
    if (value === undefined) {
      setUncontrolledTime({ hour: h, minute: m });
    }
    const str = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const num = h * 100 + m;
    onChange?.(str, num);
  };

  // Scroll automático a los elementos activos al abrir en modo visual
  React.useEffect(() => {
    if (!isOpen) return;

    if (mode === 'visual') {
      const id = setTimeout(() => {
        activeHourRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        activeMinuteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(id);
    }

    if (mode === 'keyboard') {
      const id = setTimeout(() => {
        hourInputRef.current?.focus();
        hourInputRef.current?.select();
      }, 60);
      return () => clearTimeout(id);
    }
  }, [isOpen, mode]);

  const handleHourSelect = (selectedHour) => {
    const h = Number(selectedHour);
    emitTimeChange(h, minute);
    setActiveSegment('minute');
    setTimeout(() => {
      activeMinuteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 40);
  };

  const handleMinuteSelect = (selectedMinute) => {
    const m = Number(selectedMinute);
    emitTimeChange(hour, m);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    emitTimeChange(now.getHours(), now.getMinutes());
    setTempHour(String(now.getHours()).padStart(2, '0'));
    setTempMinute(String(now.getMinutes()).padStart(2, '0'));
  };

  const handleHourInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setTempHour(raw);
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') {
      const clamped = Math.min(23, Math.max(0, num));
      emitTimeChange(clamped, minute);
      if (raw.length === 2 || num >= 3) {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }
    }
  };

  const handleMinuteInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setTempMinute(raw);
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') {
      const clamped = Math.min(59, Math.max(0, num));
      emitTimeChange(hour, clamped);
    }
  };

  const displayTime = hasValue
    ? formatTime(hour * 100 + minute)
    : '--:--';

  const pickerContent = (
    <div className="w-[260px] p-1 flex flex-col select-none">
      {/* Cabecera superior con título y botón de modo */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {mode === 'visual' ? 'Selector de hora' : 'Entrada manual'}
        </span>
        <button
          type="button"
          onClick={() => {
            const nextMode = mode === 'visual' ? 'keyboard' : 'visual';
            setTempHour(String(hour).padStart(2, '0'));
            setTempMinute(String(minute).padStart(2, '0'));
            setMode(nextMode);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          title={mode === 'visual' ? 'Escribir con teclado' : 'Volver a selector visual'}
        >
          {mode === 'visual' ? (
            <>
              <Keyboard className="w-3.5 h-3.5" />
              <span>Teclado</span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5" />
              <span>Visual</span>
            </>
          )}
        </button>
      </div>

      {/* Pantalla digital destacada (Samsung One UI style) */}
      <div className="py-3 flex items-center justify-center gap-2">
        {mode === 'visual' ? (
          <>
            <button
              type="button"
              onClick={() => {
                setActiveSegment('hour');
                activeHourRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }}
              className={cn(
                'w-16 h-13 rounded-xl flex items-center justify-center text-3xl font-bold tabular-nums tracking-tight transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                activeSegment === 'hour'
                  ? 'bg-[var(--accent)] text-white shadow-md ring-2 ring-[var(--accent)]/30'
                  : 'bg-[var(--surface-hover)] text-[var(--text-primary)] hover:bg-[var(--surface-active)]'
              )}
              aria-label={`Hora ${String(hour).padStart(2, '0')}`}
            >
              {String(hour).padStart(2, '0')}
            </button>
            <span className="text-2xl font-bold text-[var(--text-muted)]">:</span>
            <button
              type="button"
              onClick={() => {
                setActiveSegment('minute');
                activeMinuteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }}
              className={cn(
                'w-16 h-13 rounded-xl flex items-center justify-center text-3xl font-bold tabular-nums tracking-tight transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                activeSegment === 'minute'
                  ? 'bg-[var(--accent)] text-white shadow-md ring-2 ring-[var(--accent)]/30'
                  : 'bg-[var(--surface-hover)] text-[var(--text-primary)] hover:bg-[var(--surface-active)]'
              )}
              aria-label={`Minuto ${String(minute).padStart(2, '0')}`}
            >
              {String(minute).padStart(2, '0')}
            </button>
          </>
        ) : (
          <>
            <input
              ref={hourInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={tempHour}
              onChange={handleHourInputChange}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'Tab' || e.key === ':') {
                  e.preventDefault();
                  minuteInputRef.current?.focus();
                  minuteInputRef.current?.select();
                } else if (e.key === 'Enter') {
                  setIsOpen(false);
                }
              }}
              placeholder="08"
              className="w-16 h-13 rounded-xl text-center text-3xl font-bold tabular-nums tracking-tight bg-[var(--surface-hover)] text-[var(--text-primary)] border-2 border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              aria-label="Horas"
            />
            <span className="text-2xl font-bold text-[var(--text-muted)]">:</span>
            <input
              ref={minuteInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={tempMinute}
              onChange={handleMinuteInputChange}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
                  e.preventDefault();
                  hourInputRef.current?.focus();
                  hourInputRef.current?.select();
                } else if (e.key === 'Enter') {
                  setIsOpen(false);
                }
              }}
              placeholder="00"
              className="w-16 h-13 rounded-xl text-center text-3xl font-bold tabular-nums tracking-tight bg-[var(--surface-hover)] text-[var(--text-primary)] border-2 border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              aria-label="Minutos"
            />
          </>
        )}
      </div>

      {/* Modo visual: dos columnas limpias (Horas y Minutos) */}
      {mode === 'visual' && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border)]">
          {/* Columna Horas */}
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] text-center pb-1">
              Hora
            </span>
            <div className="h-44 overflow-y-auto space-y-1 pr-0.5 scroll-smooth overscroll-contain">
              {HOURS.map((hStr) => {
                const isSelected = Number(hStr) === hour;
                return (
                  <button
                    key={hStr}
                    ref={isSelected ? activeHourRef : null}
                    type="button"
                    onClick={() => handleHourSelect(hStr)}
                    className={cn(
                      'w-full py-1.5 rounded-lg text-xs tabular-nums font-medium text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50',
                      isSelected
                        ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    )}
                  >
                    {hStr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Columna Minutos */}
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] text-center pb-1">
              Minutos
            </span>
            <div className="h-44 overflow-y-auto space-y-1 pr-0.5 scroll-smooth overscroll-contain">
              {minutesList.map((mStr) => {
                const isSelected = Number(mStr) === minute;
                return (
                  <button
                    key={mStr}
                    ref={isSelected ? activeMinuteRef : null}
                    type="button"
                    onClick={() => handleMinuteSelect(mStr)}
                    className={cn(
                      'w-full py-1.5 rounded-lg text-xs tabular-nums font-medium text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50',
                      isSelected
                        ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                        : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    )}
                  >
                    {mStr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pie de acciones rápidas */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={handleSetCurrentTime}
          className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
        >
          Ahora
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold shadow-xs hover:opacity-95 transition-opacity cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Listo</span>
        </button>
      </div>
    </div>
  );

  const triggerContent = (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      data-invalid={Boolean(error) || undefined}
      onClick={() => {
        if (!disabled) handleOpenChange(true);
      }}
      className={cn(
        'group flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm font-medium text-[var(--text-primary)] transition-colors cursor-pointer select-none',
        'hover:border-[var(--accent)]/50 focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50',
        error && 'border-[var(--destructive)] focus-visible:border-[var(--destructive)] focus-visible:ring-[var(--destructive)]/50',
        disabled && 'cursor-not-allowed opacity-50 pointer-events-none',
        className
      )}
      {...props}
    >
      <span className={cn('font-sans text-sm font-medium tabular-nums', !hasValue && 'text-[var(--text-muted)]')}>
        {displayTime}
      </span>
      <span className="flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors p-0.5 rounded-md">
        <Clock className="w-4 h-4" />
      </span>
    </button>
  );

  return (
    <div className="relative flex items-center w-full">
      {isDesktop ? (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            {triggerContent}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            {pickerContent}
          </PopoverContent>
        </Popover>
      ) : (
        <>
          {triggerContent}
          <Sheet open={isOpen} onOpenChange={handleOpenChange}>
            <SheetContent className="p-4 pb-8 flex flex-col items-center">
              <SheetHeader className="mb-2 w-full">
                <SheetTitle className="text-base text-center">Seleccionar hora</SheetTitle>
              </SheetHeader>
              {pickerContent}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

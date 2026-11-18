'use client';

import * as React from 'react';
import { Clock, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { Button } from './button';
import { cn } from '@/app/utils/cn';
import { useIsDesktop } from '@/app/utils/useMediaQuery';
import {
  parseValueToTime,
  formatTime,
  resolveDateSegmentInput,
} from '@/app/utils/dateTimeUtils';

export { parseValueToTime };

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

function selectAllText(el) {
  if (!el) return;
  try {
    el.setSelectionRange(0, el.value.length);
  } catch {
    el.select();
  }
}

function centerOptionInList(listEl, optionEl, behavior = 'smooth') {
  if (!listEl || !optionEl) return;
  const targetTop = optionEl.offsetTop - listEl.clientHeight / 2 + optionEl.clientHeight / 2;
  listEl.scrollTo({ top: Math.max(0, targetTop), behavior });
}

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

  const [tempHour, setTempHour] = React.useState(() => String(hour).padStart(2, '0'));
  const [tempMinute, setTempMinute] = React.useState(() => String(minute).padStart(2, '0'));

  const hourListRef = React.useRef(null);
  const minuteListRef = React.useRef(null);
  const activeHourRef = React.useRef(null);
  const activeMinuteRef = React.useRef(null);
  const hourInputRef = React.useRef(null);
  const minuteInputRef = React.useRef(null);
  const freshEntryRef = React.useRef(null); // 'hour' | 'minute' | null
  const skipBlurPadRef = React.useRef(null); // 'hour' | 'minute' | null

  const handleOpenChange = (nextOpen) => {
    if (nextOpen) {
      setTempHour(String(hour).padStart(2, '0'));
      setTempMinute(String(minute).padStart(2, '0'));
      freshEntryRef.current = null;
      skipBlurPadRef.current = null;
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

  // Centrar las columnas en la hora/minuto activos al abrir
  React.useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      centerOptionInList(hourListRef.current, activeHourRef.current, 'auto');
      centerOptionInList(minuteListRef.current, activeMinuteRef.current, 'auto');
    }, 40);
    return () => clearTimeout(id);
  }, [isOpen]);

  const focusAndSelect = (ref, segmentName) => {
    const el = ref.current;
    if (!el) return;
    freshEntryRef.current = segmentName;
    el.focus();
    requestAnimationFrame(() => selectAllText(el));
  };

  const isDeleteEvent = (e) =>
    typeof e.nativeEvent?.inputType === 'string' && e.nativeEvent.inputType.startsWith('delete');

  const handleHourSelect = (selectedHour) => {
    const h = Number(selectedHour);
    setTempHour(selectedHour);
    emitTimeChange(h, minute);
    requestAnimationFrame(() => {
      centerOptionInList(hourListRef.current, activeHourRef.current, 'smooth');
    });
  };

  const handleMinuteSelect = (selectedMinute) => {
    const m = Number(selectedMinute);
    setTempMinute(selectedMinute);
    emitTimeChange(hour, m);
    requestAnimationFrame(() => {
      centerOptionInList(minuteListRef.current, activeMinuteRef.current, 'smooth');
    });
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    emitTimeChange(h, m);
    setTempHour(String(h).padStart(2, '0'));
    setTempMinute(String(m).padStart(2, '0'));
    requestAnimationFrame(() => {
      centerOptionInList(hourListRef.current, activeHourRef.current, 'smooth');
      centerOptionInList(minuteListRef.current, activeMinuteRef.current, 'smooth');
    });
  };

  const handleHourInputChange = (e) => {
    const isFresh = freshEntryRef.current === 'hour';
    const nextRaw = resolveDateSegmentInput(tempHour, e.target.value, 2, isFresh, isDeleteEvent(e));
    freshEntryRef.current = null;

    if (nextRaw === '') {
      setTempHour('');
      return;
    }

    const num = Number(nextRaw);
    const clamped = Math.min(23, Math.max(0, num));
    const displayVal = nextRaw.length === 2 ? String(clamped).padStart(2, '0') : nextRaw;
    setTempHour(displayVal);
    emitTimeChange(clamped, minute);

    requestAnimationFrame(() => {
      centerOptionInList(hourListRef.current, activeHourRef.current, 'smooth');
    });

    if (nextRaw.length === 2) {
      skipBlurPadRef.current = 'hour';
      focusAndSelect(minuteInputRef, 'minute');
    }
  };

  const handleMinuteInputChange = (e) => {
    const isFresh = freshEntryRef.current === 'minute';
    const nextRaw = resolveDateSegmentInput(tempMinute, e.target.value, 2, isFresh, isDeleteEvent(e));
    freshEntryRef.current = null;

    if (nextRaw === '') {
      setTempMinute('');
      return;
    }

    const num = Number(nextRaw);
    const clamped = Math.min(59, Math.max(0, num));
    const displayVal = nextRaw.length === 2 ? String(clamped).padStart(2, '0') : nextRaw;
    setTempMinute(displayVal);
    emitTimeChange(hour, clamped);

    requestAnimationFrame(() => {
      centerOptionInList(minuteListRef.current, activeMinuteRef.current, 'smooth');
    });
  };

  const displayTime = hasValue
    ? formatTime(hour * 100 + minute)
    : '--:--';

  const digitInputClass =
    'w-16 h-13 rounded-xl text-center text-3xl font-bold tabular-nums tracking-tight bg-[var(--surface-hover)] text-[var(--text-primary)] border-2 border-transparent hover:bg-[var(--surface-active)] focus:bg-[var(--surface)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25 focus:outline-none transition-all cursor-text';

  const pickerContent = (
    <div className="w-[260px] p-1 flex flex-col select-none">
      {/* Pantalla digital editable directa (pulsar abre teclado seleccionando todo) */}
      <div
        className="pt-1 pb-3 flex items-center justify-center gap-2"
        role="group"
        aria-label="Escribir hora"
      >
        <input
          ref={hourInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={tempHour}
          placeholder="08"
          aria-label="Horas"
          onFocus={(e) => {
            const el = e.currentTarget;
            freshEntryRef.current = 'hour';
            requestAnimationFrame(() => selectAllText(el));
          }}
          onMouseUp={(e) => {
            if (freshEntryRef.current === 'hour') {
              e.preventDefault();
              selectAllText(e.currentTarget);
            }
          }}
          onClick={(e) => {
            freshEntryRef.current = 'hour';
            selectAllText(e.currentTarget);
          }}
          onBlur={() => {
            if (freshEntryRef.current === 'hour') freshEntryRef.current = null;
            if (skipBlurPadRef.current === 'hour') {
              skipBlurPadRef.current = null;
              return;
            }
            setTempHour(String(hour).padStart(2, '0'));
          }}
          onChange={handleHourInputChange}
          onKeyDown={(e) => {
            if (
              e.key === ':' ||
              (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length)
            ) {
              e.preventDefault();
              focusAndSelect(minuteInputRef, 'minute');
            } else if (e.key === 'Enter') {
              e.preventDefault();
              setTempHour(String(hour).padStart(2, '0'));
              setIsOpen(false);
            }
          }}
          className={digitInputClass}
        />
        <span className="text-2xl font-bold text-[var(--text-muted)]">:</span>
        <input
          ref={minuteInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={tempMinute}
          placeholder="00"
          aria-label="Minutos"
          onFocus={(e) => {
            const el = e.currentTarget;
            freshEntryRef.current = 'minute';
            requestAnimationFrame(() => selectAllText(el));
          }}
          onMouseUp={(e) => {
            if (freshEntryRef.current === 'minute') {
              e.preventDefault();
              selectAllText(e.currentTarget);
            }
          }}
          onClick={(e) => {
            freshEntryRef.current = 'minute';
            selectAllText(e.currentTarget);
          }}
          onBlur={() => {
            if (freshEntryRef.current === 'minute') freshEntryRef.current = null;
            if (skipBlurPadRef.current === 'minute') {
              skipBlurPadRef.current = null;
              return;
            }
            setTempMinute(String(minute).padStart(2, '0'));
          }}
          onChange={handleMinuteInputChange}
          onKeyDown={(e) => {
            if (
              (e.key === 'ArrowLeft' || e.key === 'Backspace') &&
              e.currentTarget.selectionStart === 0 &&
              (e.key === 'ArrowLeft' || e.currentTarget.value === '')
            ) {
              e.preventDefault();
              focusAndSelect(hourInputRef, 'hour');
            } else if (e.key === 'Enter') {
              e.preventDefault();
              setTempMinute(String(minute).padStart(2, '0'));
              setIsOpen(false);
            }
          }}
          className={digitInputClass}
        />
      </div>

      {/* Dos columnas visuales (Horas y Minutos) protegidas contra swipe-to-dismiss */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border)]">
        {/* Columna Horas */}
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] text-center pb-1">
            Hora
          </span>
          <div
            ref={hourListRef}
            data-sheet-no-drag="true"
            className="relative h-44 overflow-y-auto space-y-1 pr-0.5 overscroll-contain touch-pan-y"
          >
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
          <div
            ref={minuteListRef}
            data-sheet-no-drag="true"
            className="relative h-44 overflow-y-auto space-y-1 pr-0.5 overscroll-contain touch-pan-y"
          >
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

      {/* Pie de acciones rápidas (alineado con DatePicker) */}
      <div className="flex items-center justify-between px-1 pt-3 mt-2 border-t border-[var(--border)]">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSetCurrentTime}
          className="rounded-lg font-semibold"
        >
          Ahora
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="rounded-lg font-semibold"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Listo</span>
        </Button>
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
          <PopoverContent
            className="w-auto p-2"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
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

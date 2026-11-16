'use client';

import * as React from 'react';
import { Time } from '@internationalized/date';
import {
  Group,
  TimeField,
  DateInput,
  DateSegment,
} from 'react-aria-components';
import { Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { cn } from '@/app/utils/cn';

function parseValueToTime(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const h = Math.floor(val / 100);
    const m = val % 100;
    return new Time(h, m);
  }
  if (typeof val === 'string') {
    if (val.includes(':')) {
      const parts = val.split(':').map(Number);
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        return new Time(parts[0], parts[1]);
      }
    }
    const num = Number(val);
    if (!isNaN(num)) return parseValueToTime(num);
  }
  return null;
}

function generateTimeSlots(step = 15, minTime = '08:00', maxTime = '22:00') {
  const [minH, minM] = minTime.split(':').map(Number);
  const [maxH, maxM] = maxTime.split(':').map(Number);
  const startMinutes = minH * 60 + minM;
  const endMinutes = maxH * 60 + maxM;
  const slots = [];
  for (let m = startMinutes; m <= endMinutes; m += step) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const str = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const num = h * 100 + min;
    slots.push({ str, num, hour: h, minute: min });
  }
  return slots;
}

export function TimePicker({
  value,
  onChange,
  step = 15,
  minTime = '08:00',
  maxTime = '22:00',
  disabled = false,
  className,
  ariaLabel = 'Hora',
  ...props
}) {
  const [ariaTime, setAriaTime] = React.useState(() => parseValueToTime(value));
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const activeSlotRef = React.useRef(null);

  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 641px)');
    setIsDesktop(media.matches);
    const handler = (e) => setIsDesktop(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  React.useEffect(() => {
    setAriaTime(parseValueToTime(value));
  }, [value]);

  React.useEffect(() => {
    if (isOpen && activeSlotRef.current) {
      setTimeout(() => {
        activeSlotRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    }
  }, [isOpen]);

  const handleTimeChange = (newTime) => {
    setAriaTime(newTime);
    if (!newTime) {
      onChange?.('', null);
      return;
    }
    const str = `${String(newTime.hour).padStart(2, '0')}:${String(newTime.minute).padStart(2, '0')}`;
    const num = newTime.hour * 100 + newTime.minute;
    onChange?.(str, num);
  };

  const handleSlotSelect = (slot) => {
    const newTime = new Time(slot.hour, slot.minute);
    setAriaTime(newTime);
    onChange?.(slot.str, slot.num);
    setIsOpen(false);
  };

  const slots = React.useMemo(() => generateTimeSlots(step, minTime, maxTime), [step, minTime, maxTime]);

  const currentTimeStr = ariaTime
    ? `${String(ariaTime.hour).padStart(2, '0')}:${String(ariaTime.minute).padStart(2, '0')}`
    : '';

  const timeList = (
    <div className="max-h-60 overflow-y-auto py-1 scroll-smooth">
      <div className="grid grid-cols-3 sm:grid-cols-2 gap-1.5 p-1">
        {slots.map((slot) => {
          const isSelected = slot.str === currentTimeStr;
          return (
            <button
              key={slot.str}
              ref={isSelected ? activeSlotRef : null}
              type="button"
              onClick={() => handleSlotSelect(slot)}
              className={cn(
                'flex items-center justify-center py-2 px-3 rounded-[var(--radius-md)] text-xs font-medium tabular-nums cursor-pointer transition-colors',
                isSelected
                  ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                  : 'hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-light)]'
              )}
            >
              {slot.str}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn('relative flex items-center w-full', className)} {...props}>
      <TimeField
        value={ariaTime}
        onChange={handleTimeChange}
        isDisabled={disabled}
        hourCycle={24}
        aria-label={ariaLabel}
        className="w-full"
      >
        <Group className="flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50">
          <DateInput className="flex items-center font-mono text-sm">
            {(segment) => (
              <DateSegment
                segment={segment}
                className="rounded px-0.5 outline-none focus:bg-[var(--accent)] focus:text-white data-[placeholder]:text-[var(--text-muted)]"
              />
            )}
          </DateInput>
          {isDesktop ? (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-md cursor-pointer disabled:pointer-events-none"
                  aria-label="Abrir selección de hora"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-light)] mb-1">
                  Seleccionar hora
                </div>
                {timeList}
              </PopoverContent>
            </Popover>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen(true)}
              className="flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-md cursor-pointer disabled:pointer-events-none"
              aria-label="Abrir selección de hora"
            >
              <Clock className="w-4 h-4" />
            </button>
          )}
        </Group>
      </TimeField>

      {!isDesktop && (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent className="p-4 pb-8">
            <SheetHeader className="mb-2">
              <SheetTitle className="text-base">Seleccionar hora</SheetTitle>
            </SheetHeader>
            {timeList}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

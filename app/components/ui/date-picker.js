'use client';

import * as React from 'react';
import { CalendarDate } from '@internationalized/date';
import {
  Group,
  DateField,
  DateInput,
  DateSegment,
  Calendar as AriaCalendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  CalendarHeading,
  Button as AriaButton,
} from 'react-aria-components';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { cn } from '@/app/utils/cn';

function parseValueToCalendarDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const y = Math.floor(val / 10000);
    const m = Math.floor((val % 10000) / 100);
    const d = val % 100;
    return new CalendarDate(y, m, d);
  }
  if (typeof val === 'string') {
    if (val.includes('-')) {
      const parts = val.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        return new CalendarDate(parts[0], parts[1], parts[2]);
      }
    }
    const num = Number(val);
    if (!isNaN(num)) return parseValueToCalendarDate(num);
  }
  if (val instanceof Date) {
    return new CalendarDate(val.getFullYear(), val.getMonth() + 1, val.getDate());
  }
  return null;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  className,
  ariaLabel = 'Fecha',
  ...props
}) {
  const [calendarDate, setCalendarDate] = React.useState(() => parseValueToCalendarDate(value));
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 641px)');
    setIsDesktop(media.matches);
    const handler = (e) => setIsDesktop(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  React.useEffect(() => {
    const parsed = parseValueToCalendarDate(value);
    setCalendarDate(parsed);
  }, [value]);

  const handleDateChange = (newDate) => {
    setCalendarDate(newDate);
    if (!newDate) {
      onChange?.(null, null);
      return;
    }
    const str = `${newDate.year}-${String(newDate.month).padStart(2, '0')}-${String(newDate.day).padStart(2, '0')}`;
    const num = newDate.year * 10000 + newDate.month * 100 + newDate.day;
    onChange?.(str, num);
  };

  const handleCalendarSelect = (newDate) => {
    handleDateChange(newDate);
    setIsOpen(false);
  };

  const calendarBody = (
    <div className="p-1">
      <AriaCalendar
        aria-label={ariaLabel}
        value={calendarDate}
        onChange={handleCalendarSelect}
        className="w-full select-none"
      >
        <header className="flex items-center justify-between pb-3 px-1">
          <AriaButton
            slot="previous"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </AriaButton>
          <CalendarHeading className="text-sm font-semibold text-[var(--text-primary)] capitalize font-[var(--font-display)]" />
          <AriaButton
            slot="next"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none"
          >
            <ChevronRight className="w-4 h-4" />
          </AriaButton>
        </header>
        <CalendarGrid className="w-full border-collapse">
          <CalendarGridHeader>
            {(day) => (
              <CalendarHeaderCell className="text-[11px] font-semibold text-[var(--text-muted)] text-center pb-2">
                {day}
              </CalendarHeaderCell>
            )}
          </CalendarGridHeader>
          <CalendarGridBody>
            {(date) => (
              <CalendarCell
                date={date}
                className={({ isSelected, isToday, isDisabled }) =>
                  cn(
                    'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium cursor-pointer transition-colors outline-none my-0.5',
                    isSelected && 'bg-[var(--accent)] text-white font-bold shadow-xs',
                    !isSelected && isToday && 'border border-[var(--accent)] text-[var(--accent)] font-semibold',
                    !isSelected && !isToday && 'hover:bg-[var(--surface-hover)] text-[var(--text-primary)]',
                    isDisabled && 'opacity-30 pointer-events-none'
                  )
                }
              />
            )}
          </CalendarGridBody>
        </CalendarGrid>
      </AriaCalendar>
    </div>
  );

  return (
    <div className={cn('relative flex items-center w-full', className)} {...props}>
      <DateField
        value={calendarDate}
        onChange={handleDateChange}
        isDisabled={disabled}
        shouldForceLeadingZeros
        aria-label={ariaLabel}
        className="w-full"
      >
        <Group className="flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50">
          <DateInput className="flex items-center">
            {(segment) => (
              <DateSegment
                segment={segment}
                className={cn(
                  'rounded outline-none focus:bg-[var(--accent)] focus:text-white data-[placeholder]:text-[var(--text-muted)] text-sm',
                  segment.type === 'literal' ? 'px-0 text-[var(--text-muted)]' : 'px-0.5'
                )}
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
                  aria-label="Abrir calendario"
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                {calendarBody}
              </PopoverContent>
            </Popover>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen(true)}
              className="flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 rounded-md cursor-pointer disabled:pointer-events-none"
              aria-label="Abrir calendario"
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          )}
        </Group>
      </DateField>

      {!isDesktop && (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent className="p-4 pb-8">
            <SheetHeader className="mb-2">
              <SheetTitle className="text-base">Seleccionar fecha</SheetTitle>
            </SheetHeader>
            {calendarBody}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import {
  DateField,
  DateInput,
  DateSegment,
  Calendar as AriaCalendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  CalendarStateContext,
  Button as AriaButton,
} from 'react-aria-components';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { cn } from '@/app/utils/cn';
import {
  parseValueToCalendarDate,
  calculateMonthGridPadding,
  formatMonthYearHeading,
} from '@/app/utils/dateTimeUtils';

export { parseValueToCalendarDate };

function CalendarCustomHeading() {
  const state = React.useContext(CalendarStateContext);
  if (!state) return null;
  const startDate = state.visibleRange.start;
  const text = formatMonthYearHeading(startDate.year, startDate.month);
  return (
    <h2 className="text-sm font-semibold text-[var(--text-primary)] font-[var(--font-display)] select-none">
      {text}
    </h2>
  );
}

function CalendarGridPadding() {
  const state = React.useContext(CalendarStateContext);
  if (!state) return null;
  const { year, month } = state.visibleRange.start;
  const { paddingWeeks } = calculateMonthGridPadding(year, month);

  if (paddingWeeks === 0) return null;

  return (
    <tbody aria-hidden="true" className="pointer-events-none select-none opacity-0">
      {Array.from({ length: paddingWeeks }).map((_, rIdx) => (
        <tr key={`pad-${rIdx}`}>
          {Array.from({ length: 7 }).map((_, cIdx) => (
            <td key={cIdx} className="w-8 h-8 mx-auto my-0.5 p-0" />
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function CalendarView({
  value,
  onSelect,
  ariaLabel = 'Fecha',
  className
}) {
  const [calendarDate, setCalendarDate] = React.useState(() => parseValueToCalendarDate(value));

  React.useEffect(() => {
    setCalendarDate(parseValueToCalendarDate(value));
  }, [value]);

  const handleSelect = (newDate) => {
    setCalendarDate(newDate);
    if (!newDate) {
      onSelect?.(null, null, null);
      return;
    }
    const str = `${newDate.year}-${String(newDate.month).padStart(2, '0')}-${String(newDate.day).padStart(2, '0')}`;
    const num = newDate.year * 10000 + newDate.month * 100 + newDate.day;
    const jsDate = new Date(newDate.year, newDate.month - 1, newDate.day);
    onSelect?.(str, num, jsDate);
  };

  return (
    <div className={cn('p-1 w-[280px]', className)}>
      <AriaCalendar
        aria-label={ariaLabel}
        value={calendarDate}
        onChange={handleSelect}
        className="w-full select-none"
      >
        <header className="flex items-center justify-between pb-3 px-1">
          <AriaButton
            slot="previous"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </AriaButton>
          <CalendarCustomHeading />
          <AriaButton
            slot="next"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none"
            aria-label="Mes siguiente"
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
          <CalendarGridPadding />
        </CalendarGrid>
      </AriaCalendar>
    </div>
  );
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

  const handleCalendarSelect = (str, num) => {
    onChange?.(str, num);
    setIsOpen(false);
  };

  const triggerContent = (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) setIsOpen(true);
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setIsOpen(true);
        }
      }}
      className={cn(
        'group flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors cursor-pointer select-none',
        'hover:border-[var(--border-hover)] focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
        disabled && 'cursor-not-allowed opacity-50 pointer-events-none'
      )}
    >
      <DateField
        value={calendarDate}
        onChange={handleDateChange}
        isDisabled={disabled}
        shouldForceLeadingZeros
        aria-label={ariaLabel}
        className="flex items-center pointer-events-none sm:pointer-events-auto"
      >
        <DateInput className="flex items-center text-sm tabular-nums">
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
      </DateField>
      <div className="flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors p-0.5 rounded-md">
        <CalendarIcon className="w-4 h-4" />
      </div>
    </div>
  );

  return (
    <div className={cn('relative flex items-center w-full', className)} {...props}>
      {isDesktop ? (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            {triggerContent}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <CalendarView
              value={calendarDate}
              onSelect={handleCalendarSelect}
              ariaLabel={ariaLabel}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <>
          {triggerContent}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetContent className="p-4 pb-8 flex flex-col items-center">
              <SheetHeader className="mb-2 w-full">
                <SheetTitle className="text-base text-center">Seleccionar fecha</SheetTitle>
              </SheetHeader>
              <CalendarView
                value={calendarDate}
                onSelect={handleCalendarSelect}
                ariaLabel={ariaLabel}
              />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

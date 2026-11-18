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
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './sheet';
import { cn } from '@/app/utils/cn';
import { useIsDesktop } from '@/app/utils/useMediaQuery';
import {
  SPANISH_MONTHS_SHORT,
  parseValueToCalendarDate,
  calculateMonthGridPadding,
  formatMonthYearHeading,
  buildValidCalendarDate,
  clampDayToMonth,
} from '@/app/utils/dateTimeUtils';

export { parseValueToCalendarDate };

function getTodayCalendarDate() {
  const now = new Date();
  return parseValueToCalendarDate(now);
}

function formatDateParts(date) {
  if (!date) return { day: '', month: '', year: '' };
  return {
    day: String(date.day).padStart(2, '0'),
    month: String(date.month).padStart(2, '0'),
    year: String(date.year).padStart(4, '0'),
  };
}

function CalendarHeadingToggle({ onOpenMonthPicker }) {
  const state = React.useContext(CalendarStateContext);
  if (!state) return null;
  const startDate = state.visibleRange.start;
  const text = formatMonthYearHeading(startDate.year, startDate.month);
  return (
    <button
      type="button"
      onClick={onOpenMonthPicker}
      aria-label={`Cambiar mes o año (${text})`}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold text-[var(--text-primary)] font-[var(--font-display)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
    >
      <span>{text}</span>
      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
    </button>
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
            <td key={cIdx} className="p-0">
              <div className="w-8 h-8 mx-auto my-0.5" />
            </td>
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
  const parsedValue = React.useMemo(() => parseValueToCalendarDate(value), [value]);
  const todayDate = React.useMemo(() => getTodayCalendarDate(), []);

  const [draftDate, setDraftDate] = React.useState(() => parsedValue);
  const [focusedDate, setFocusedDate] = React.useState(() => parsedValue || todayDate);
  const [viewMode, setViewMode] = React.useState('days'); // 'days' | 'months'

  const initialParts = React.useMemo(() => formatDateParts(parsedValue), [parsedValue]);
  const [dayInput, setDayInput] = React.useState(() => initialParts.day);
  const [monthInput, setMonthInput] = React.useState(() => initialParts.month);
  const [yearInput, setYearInput] = React.useState(() => initialParts.year);
  const [isInputInvalid, setIsInputInvalid] = React.useState(false);

  const dayInputRef = React.useRef(null);
  const monthInputRef = React.useRef(null);
  const yearInputRef = React.useRef(null);

  const parsedValueKey = parsedValue
    ? `${parsedValue.year}-${parsedValue.month}-${parsedValue.day}`
    : '';

  const [prevValueKey, setPrevValueKey] = React.useState(parsedValueKey);
  if (parsedValueKey !== prevValueKey) {
    setPrevValueKey(parsedValueKey);
    setDraftDate(parsedValue);
    if (parsedValue) {
      setFocusedDate(parsedValue);
    }
    const parts = formatDateParts(parsedValue);
    setDayInput(parts.day);
    setMonthInput(parts.month);
    setYearInput(parts.year);
    setIsInputInvalid(false);
  }

  const commitDate = (date) => {
    if (!date) {
      onSelect?.(null, null, null);
      return;
    }
    const str = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const num = date.year * 10000 + date.month * 100 + date.day;
    const jsDate = new Date(date.year, date.month - 1, date.day);
    onSelect?.(str, num, jsDate);
  };

  const syncInputsFromDate = (date) => {
    const parts = formatDateParts(date);
    setDayInput(parts.day);
    setMonthInput(parts.month);
    setYearInput(parts.year);
    setIsInputInvalid(false);
  };

  const tryApplyTypedDate = (nextDay, nextMonth, nextYear) => {
    if (!nextDay && !nextMonth && !nextYear) {
      setIsInputInvalid(false);
      return null;
    }
    if (nextDay.length >= 1 && nextMonth.length >= 1 && nextYear.length === 4) {
      const valid = buildValidCalendarDate(nextDay, nextMonth, nextYear);
      if (valid) {
        setDraftDate(valid);
        setFocusedDate(valid);
        setIsInputInvalid(false);
        return valid;
      }
      setIsInputInvalid(true);
      return null;
    }
    setIsInputInvalid(false);
    return null;
  };

  const focusAndSelect = (ref) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => el.select());
  };

  const handleDayInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    const num = Number(raw);
    let nextVal = raw;
    let shouldAdvance = false;

    if (raw.length === 1 && num >= 4) {
      nextVal = `0${raw}`;
      shouldAdvance = true;
    } else if (raw.length === 2) {
      shouldAdvance = true;
    }

    setDayInput(nextVal);
    tryApplyTypedDate(nextVal, monthInput, yearInput);

    if (shouldAdvance) {
      focusAndSelect(monthInputRef);
    }
  };

  const handleMonthInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    const num = Number(raw);
    let nextVal = raw;
    let shouldAdvance = false;

    if (raw.length === 1 && num >= 2) {
      nextVal = `0${raw}`;
      shouldAdvance = true;
    } else if (raw.length === 2) {
      shouldAdvance = true;
    }

    setMonthInput(nextVal);
    tryApplyTypedDate(dayInput, nextVal, yearInput);

    if (shouldAdvance) {
      focusAndSelect(yearInputRef);
    }
  };

  const handleYearInputChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYearInput(raw);
    tryApplyTypedDate(dayInput, monthInput, raw);
  };

  const handleConfirmTyped = () => {
    const hasAnyInput = Boolean(dayInput || monthInput || yearInput);
    if (hasAnyInput) {
      const valid = buildValidCalendarDate(dayInput, monthInput, yearInput);
      if (!valid) {
        setIsInputInvalid(true);
        return;
      }
      setDraftDate(valid);
      setFocusedDate(valid);
      setIsInputInvalid(false);
      commitDate(valid);
      return;
    }
    if (draftDate) {
      commitDate(draftDate);
    }
  };

  const handleGridSelect = (newDate) => {
    setDraftDate(newDate);
    if (newDate) {
      setFocusedDate(newDate);
      syncInputsFromDate(newDate);
    }
    commitDate(newDate);
  };

  const handleSetToday = () => {
    const nowDate = getTodayCalendarDate();
    if (!nowDate) return;
    setDraftDate(nowDate);
    setFocusedDate(nowDate);
    syncInputsFromDate(nowDate);
    setViewMode('days');
  };

  const handleMonthGridSelect = (monthIndex) => {
    const targetYear = focusedDate?.year ?? todayDate.year;
    const baseDay = focusedDate?.day ?? 1;
    const clampedDay = clampDayToMonth(baseDay, monthIndex, targetYear);
    const nextFocused = buildValidCalendarDate(clampedDay, monthIndex, targetYear);
    if (nextFocused) {
      setFocusedDate(nextFocused);
    }
    setViewMode('days');
  };

  const handleYearStep = (delta) => {
    const currentYear = focusedDate?.year ?? todayDate.year;
    const nextYear = Math.min(2100, Math.max(1900, currentYear + delta));
    const month = focusedDate?.month ?? 1;
    const clampedDay = clampDayToMonth(focusedDate?.day ?? 1, month, nextYear);
    const nextFocused = buildValidCalendarDate(clampedDay, month, nextYear);
    if (nextFocused) {
      setFocusedDate(nextFocused);
    }
  };

  const segmentInputClass = cn(
    'h-10 rounded-xl text-center text-base font-bold tabular-nums tracking-tight bg-[var(--surface-hover)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:font-medium border-2 transition-colors focus:outline-none focus:bg-[var(--surface)]',
    isInputInvalid
      ? 'border-[var(--destructive)] focus:border-[var(--destructive)]'
      : 'border-transparent focus:border-[var(--accent)]'
  );

  const canConfirm = Boolean(draftDate) && !isInputInvalid;

  return (
    <div className={cn('p-1 w-[280px] flex flex-col select-none', className)}>
      {/* Display digital editable DD / MM / AAAA */}
      <div
        className="flex items-center justify-center gap-1.5 pb-3 mb-2 border-b border-[var(--border)]"
        role="group"
        aria-label="Escribir fecha"
      >
        <input
          ref={dayInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={dayInput}
          placeholder="DD"
          aria-label="Día"
          aria-invalid={isInputInvalid || undefined}
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }}
          onBlur={() => {
            if (dayInput.length === 1 && Number(dayInput) >= 1) {
              const padded = `0${dayInput}`;
              setDayInput(padded);
              tryApplyTypedDate(padded, monthInput, yearInput);
            }
          }}
          onChange={handleDayInputChange}
          onKeyDown={(e) => {
            if (e.key === '/' || e.key === '-' || (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length)) {
              e.preventDefault();
              focusAndSelect(monthInputRef);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmTyped();
            }
          }}
          className={cn(segmentInputClass, 'w-12')}
        />
        <span className="text-base font-bold text-[var(--text-muted)]">/</span>
        <input
          ref={monthInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={monthInput}
          placeholder="MM"
          aria-label="Mes"
          aria-invalid={isInputInvalid || undefined}
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }}
          onBlur={() => {
            if (monthInput.length === 1 && Number(monthInput) >= 1) {
              const padded = `0${monthInput}`;
              setMonthInput(padded);
              tryApplyTypedDate(dayInput, padded, yearInput);
            }
          }}
          onChange={handleMonthInputChange}
          onKeyDown={(e) => {
            if (e.key === '/' || e.key === '-' || (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length)) {
              e.preventDefault();
              focusAndSelect(yearInputRef);
            } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && e.currentTarget.selectionStart === 0 && (e.key === 'ArrowLeft' || e.currentTarget.value === '')) {
              e.preventDefault();
              focusAndSelect(dayInputRef);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmTyped();
            }
          }}
          className={cn(segmentInputClass, 'w-12')}
        />
        <span className="text-base font-bold text-[var(--text-muted)]">/</span>
        <input
          ref={yearInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={yearInput}
          placeholder="AAAA"
          aria-label="Año"
          aria-invalid={isInputInvalid || undefined}
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.select());
          }}
          onChange={handleYearInputChange}
          onKeyDown={(e) => {
            if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && e.currentTarget.selectionStart === 0 && (e.key === 'ArrowLeft' || e.currentTarget.value === '')) {
              e.preventDefault();
              focusAndSelect(monthInputRef);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmTyped();
            }
          }}
          className={cn(segmentInputClass, 'w-16')}
        />
      </div>

      <AriaCalendar
        aria-label={ariaLabel}
        value={draftDate}
        focusedValue={focusedDate}
        onFocusChange={setFocusedDate}
        onChange={handleGridSelect}
        className="w-full select-none"
      >
        {viewMode === 'days' ? (
          <>
            <header className="flex items-center justify-between pb-2 px-1">
              <AriaButton
                slot="previous"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </AriaButton>
              <CalendarHeadingToggle onOpenMonthPicker={() => setViewMode('months')} />
              <AriaButton
                slot="next"
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </AriaButton>
            </header>
            <div className="h-[244px]">
              <CalendarGrid className="w-full border-collapse table-fixed [&_td]:p-0 [&_th]:p-0">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className="h-7 text-[11px] font-semibold text-[var(--text-muted)] text-center align-middle">
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
                          'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium cursor-pointer transition-colors outline-none my-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
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
            </div>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between pb-2 px-1">
              <button
                type="button"
                onClick={() => handleYearStep(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                aria-label="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('days')}
                aria-label={`Volver al calendario (${focusedDate?.year ?? todayDate.year})`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold text-[var(--text-primary)] font-[var(--font-display)] tabular-nums hover:bg-[var(--surface-hover)] transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
              >
                <span>{focusedDate?.year ?? todayDate.year}</span>
                <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
              <button
                type="button"
                onClick={() => handleYearStep(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
                aria-label="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </header>
            <div className="h-[244px] grid grid-cols-3 gap-2 py-2 content-center">
              {SPANISH_MONTHS_SHORT.map((label, idx) => {
                const monthNum = idx + 1;
                const activeYear = focusedDate?.year ?? todayDate.year;
                const isSelectedMonth = focusedDate?.month === monthNum;
                const isCurrentRealMonth = todayDate.year === activeYear && todayDate.month === monthNum;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleMonthGridSelect(monthNum)}
                    className={cn(
                      'h-11 rounded-xl text-xs font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                      isSelectedMonth && 'bg-[var(--accent)] text-white shadow-xs',
                      !isSelectedMonth && isCurrentRealMonth && 'border border-[var(--accent)] text-[var(--accent)]',
                      !isSelectedMonth && !isCurrentRealMonth && 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </AriaCalendar>

      {/* Pie de acciones rápidas (alineado con TimePicker) */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={handleSetToday}
          className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={handleConfirmTyped}
          disabled={!canConfirm}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold shadow-xs hover:opacity-95 transition-opacity cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Listo</span>
        </button>
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  error = false,
  className,
  ariaLabel = 'Fecha',
  ...props
}) {
  const parsedValue = React.useMemo(() => parseValueToCalendarDate(value), [value]);
  const [uncontrolledDate, setUncontrolledDate] = React.useState(() => parsedValue);
  const calendarDate = value !== undefined ? parsedValue : uncontrolledDate;
  const [isOpen, setIsOpen] = React.useState(false);
  const isDesktop = useIsDesktop();

  const handleDateChange = (newDate) => {
    if (value === undefined) setUncontrolledDate(newDate);
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
      data-invalid={Boolean(error) || undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget || !e.target.closest('[role="spinbutton"]')) {
          e.preventDefault();
        }
      }}
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
        'group flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-sans text-sm font-medium text-[var(--text-primary)] transition-colors cursor-pointer select-none',
        'hover:border-[var(--accent)]/50 focus:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50',
        error && 'border-[var(--destructive)] focus-visible:border-[var(--destructive)] focus-visible:ring-[var(--destructive)]/50',
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
        <DateInput className="flex items-center font-sans text-sm font-medium tabular-nums">
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                'rounded outline-none focus-visible:bg-[var(--accent)] focus-visible:text-white data-[placeholder]:text-[var(--text-muted)] font-sans text-sm font-medium tabular-nums',
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

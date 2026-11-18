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
import { Button } from './button';
import { cn } from '@/app/utils/cn';
import { useIsDesktop } from '@/app/utils/useMediaQuery';
import {
  SPANISH_MONTHS_SHORT,
  parseValueToCalendarDate,
  calculateMonthGridPadding,
  formatMonthYearHeading,
  buildValidCalendarDate,
  clampDayToMonth,
  resolveDateSegmentInput,
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
  const [anchorDay, setAnchorDay] = React.useState(() => parsedValue?.day ?? todayDate.day);
  const [viewMode, setViewMode] = React.useState('days'); // 'days' | 'months'

  const initialParts = React.useMemo(() => formatDateParts(parsedValue), [parsedValue]);
  const [dayInput, setDayInput] = React.useState(() => initialParts.day);
  const [monthInput, setMonthInput] = React.useState(() => initialParts.month);
  const [yearInput, setYearInput] = React.useState(() => initialParts.year);
  const [isInputInvalid, setIsInputInvalid] = React.useState(false);

  const dayInputRef = React.useRef(null);
  const monthInputRef = React.useRef(null);
  const yearInputRef = React.useRef(null);
  const freshEntryRef = React.useRef(null); // 'day' | 'month' | 'year' | null
  const skipBlurPadRef = React.useRef(null); // 'day' | 'month' | null

  const parsedValueKey = parsedValue
    ? `${parsedValue.year}-${parsedValue.month}-${parsedValue.day}`
    : '';

  const [prevValueKey, setPrevValueKey] = React.useState(parsedValueKey);
  if (parsedValueKey !== prevValueKey) {
    setPrevValueKey(parsedValueKey);
    setDraftDate(parsedValue);
    if (parsedValue) {
      setFocusedDate(parsedValue);
      setAnchorDay(parsedValue.day);
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

  const selectAllText = (el) => {
    if (!el) return;
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      el.select();
    }
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
        setAnchorDay(valid.day);
        setIsInputInvalid(false);
        return valid;
      }
      setIsInputInvalid(true);
      return null;
    }
    setIsInputInvalid(false);
    return null;
  };

  const focusAndSelect = (ref, segmentName) => {
    const el = ref.current;
    if (!el) return;
    freshEntryRef.current = segmentName;
    el.focus();
    requestAnimationFrame(() => selectAllText(el));
  };

  const isDeleteEvent = (e) =>
    typeof e.nativeEvent?.inputType === 'string' && e.nativeEvent.inputType.startsWith('delete');

  const handleDayInputChange = (e) => {
    const isFresh = freshEntryRef.current === 'day';
    const nextVal = resolveDateSegmentInput(dayInput, e.target.value, 2, isFresh, isDeleteEvent(e));
    freshEntryRef.current = null;

    setDayInput(nextVal);
    tryApplyTypedDate(nextVal, monthInput, yearInput);

    if (nextVal.length === 2) {
      skipBlurPadRef.current = 'day';
      focusAndSelect(monthInputRef, 'month');
    }
  };

  const handleMonthInputChange = (e) => {
    const isFresh = freshEntryRef.current === 'month';
    const nextVal = resolveDateSegmentInput(monthInput, e.target.value, 2, isFresh, isDeleteEvent(e));
    freshEntryRef.current = null;

    setMonthInput(nextVal);
    tryApplyTypedDate(dayInput, nextVal, yearInput);

    if (nextVal.length === 2) {
      skipBlurPadRef.current = 'month';
      focusAndSelect(yearInputRef, 'year');
    }
  };

  const handleYearInputChange = (e) => {
    const isFresh = freshEntryRef.current === 'year';
    const nextVal = resolveDateSegmentInput(yearInput, e.target.value, 4, isFresh, isDeleteEvent(e));
    freshEntryRef.current = null;

    setYearInput(nextVal);
    tryApplyTypedDate(dayInput, monthInput, nextVal);
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
      setAnchorDay(valid.day);
      setIsInputInvalid(false);
      commitDate(valid);
      return;
    }
    if (draftDate) {
      commitDate(draftDate);
    }
  };

  const moveToMonthYear = (targetYear, targetMonth) => {
    const preferredDay = anchorDay || draftDate?.day || todayDate.day;
    const clampedDay = clampDayToMonth(preferredDay, targetMonth, targetYear);
    const nextDate = buildValidCalendarDate(clampedDay, targetMonth, targetYear);
    if (!nextDate) return;
    setFocusedDate(nextDate);
    setDraftDate(nextDate);
    syncInputsFromDate(nextDate);
  };

  const handleCalendarFocusChange = (nextFocused) => {
    if (!nextFocused) return;
    const monthOrYearChanged =
      !focusedDate ||
      nextFocused.year !== focusedDate.year ||
      nextFocused.month !== focusedDate.month;
    if (monthOrYearChanged) {
      moveToMonthYear(nextFocused.year, nextFocused.month);
    } else {
      setFocusedDate(nextFocused);
    }
  };

  const handleGridSelect = (newDate) => {
    setDraftDate(newDate);
    if (newDate) {
      setFocusedDate(newDate);
      setAnchorDay(newDate.day);
      syncInputsFromDate(newDate);
    }
    commitDate(newDate);
  };

  const handleSetToday = () => {
    const nowDate = getTodayCalendarDate();
    if (!nowDate) return;
    setDraftDate(nowDate);
    setFocusedDate(nowDate);
    setAnchorDay(nowDate.day);
    syncInputsFromDate(nowDate);
    setViewMode('days');
  };

  const handleMonthGridSelect = (monthIndex) => {
    const targetYear = focusedDate?.year ?? todayDate.year;
    moveToMonthYear(targetYear, monthIndex);
    setViewMode('days');
  };

  const handleYearStep = (delta) => {
    const currentYear = focusedDate?.year ?? todayDate.year;
    const nextYear = Math.min(2100, Math.max(1900, currentYear + delta));
    const month = focusedDate?.month ?? todayDate.month;
    moveToMonthYear(nextYear, month);
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
          value={dayInput}
          placeholder="DD"
          aria-label="Día"
          aria-invalid={isInputInvalid || undefined}
          onFocus={(e) => {
            const el = e.currentTarget;
            freshEntryRef.current = 'day';
            requestAnimationFrame(() => selectAllText(el));
          }}
          onMouseUp={(e) => {
            if (freshEntryRef.current === 'day') {
              e.preventDefault();
              selectAllText(e.currentTarget);
            }
          }}
          onClick={(e) => {
            freshEntryRef.current = 'day';
            selectAllText(e.currentTarget);
          }}
          onBlur={() => {
            if (freshEntryRef.current === 'day') freshEntryRef.current = null;
            if (skipBlurPadRef.current === 'day') {
              skipBlurPadRef.current = null;
              return;
            }
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
              focusAndSelect(monthInputRef, 'month');
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
          value={monthInput}
          placeholder="MM"
          aria-label="Mes"
          aria-invalid={isInputInvalid || undefined}
          onFocus={(e) => {
            const el = e.currentTarget;
            freshEntryRef.current = 'month';
            requestAnimationFrame(() => selectAllText(el));
          }}
          onMouseUp={(e) => {
            if (freshEntryRef.current === 'month') {
              e.preventDefault();
              selectAllText(e.currentTarget);
            }
          }}
          onClick={(e) => {
            freshEntryRef.current = 'month';
            selectAllText(e.currentTarget);
          }}
          onBlur={() => {
            if (freshEntryRef.current === 'month') freshEntryRef.current = null;
            if (skipBlurPadRef.current === 'month') {
              skipBlurPadRef.current = null;
              return;
            }
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
              focusAndSelect(yearInputRef, 'year');
            } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && e.currentTarget.selectionStart === 0 && (e.key === 'ArrowLeft' || e.currentTarget.value === '')) {
              e.preventDefault();
              focusAndSelect(dayInputRef, 'day');
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
          value={yearInput}
          placeholder="AAAA"
          aria-label="Año"
          aria-invalid={isInputInvalid || undefined}
          onFocus={(e) => {
            const el = e.currentTarget;
            freshEntryRef.current = 'year';
            requestAnimationFrame(() => selectAllText(el));
          }}
          onMouseUp={(e) => {
            if (freshEntryRef.current === 'year') {
              e.preventDefault();
              selectAllText(e.currentTarget);
            }
          }}
          onClick={(e) => {
            freshEntryRef.current = 'year';
            selectAllText(e.currentTarget);
          }}
          onBlur={() => {
            if (freshEntryRef.current === 'year') freshEntryRef.current = null;
          }}
          onChange={handleYearInputChange}
          onKeyDown={(e) => {
            if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && e.currentTarget.selectionStart === 0 && (e.key === 'ArrowLeft' || e.currentTarget.value === '')) {
              e.preventDefault();
              focusAndSelect(monthInputRef, 'month');
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
        onFocusChange={handleCalendarFocusChange}
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
      <div className="flex items-center justify-between px-1 pt-3 mt-2 border-t border-[var(--border)]">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSetToday}
          className="rounded-lg font-semibold"
        >
          Hoy
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleConfirmTyped}
          disabled={!canConfirm}
          className="rounded-lg font-semibold"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Listo</span>
        </Button>
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
        className="flex items-center pointer-events-none"
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
          <PopoverContent
            className="w-auto p-2"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
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

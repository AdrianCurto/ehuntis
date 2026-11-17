'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarView } from './ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';

const DAYS_SHORT = ['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isPastDay(date, today) {
  if (!date || !today) return false;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return d < t;
}

function toInputDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function WeekHeader({
  weekDates,
  selectedDay,
  isDayView,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  onPrevDay,
  onNextDay,
  onPickDate,
  minDate,
  maxDate,
  prevWeekDates: prevWeekDatesProp = null,
  nextWeekDates: nextWeekDatesProp = null,
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 641px)');
    setIsDesktop(media.matches);
    const handler = (e) => setIsDesktop(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const today = new Date();
  const firstDay = weekDates?.[0] || new Date();
  const lastDay = weekDates?.[weekDates.length - 1] || firstDay;
  const prevHandler = isDayView ? onPrevDay : onPrevWeek;
  const nextHandler = isDayView ? onNextDay : onNextWeek;

  const m1 = MONTHS_SHORT[firstDay.getMonth()]?.toUpperCase() || '';
  const m2 = MONTHS_SHORT[lastDay.getMonth()]?.toUpperCase() || '';
  const pickerDate = isDayView && selectedDay ? selectedDay : firstDay;

  const prevWeekDates = prevWeekDatesProp || (weekDates || []).map(d => {
    const p = new Date(d);
    p.setDate(p.getDate() - 7);
    return p;
  });
  const nextWeekDates = nextWeekDatesProp || (weekDates || []).map(d => {
    const n = new Date(d);
    n.setDate(n.getDate() + 7);
    return n;
  });

  const monthBoxButton = (
    <button
      type="button"
      className="week-nav-month-box cursor-pointer hover:opacity-80 transition-opacity"
      aria-label="Elegir fecha del curso"
    >
      <div className="week-nav-month" aria-hidden="true">
        <span>{m1}</span>
        <span className={m1 === m2 ? 'week-nav-month-placeholder' : ''}>{m2}</span>
      </div>
    </button>
  );

  return (
    <div className="week-nav">
      {/* Month + Arrows */}
      <div className="week-nav-range">
        {isDesktop ? (
          <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <PopoverTrigger asChild>
              {monthBoxButton}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <CalendarView
                value={pickerDate}
                onSelect={(str, num, jsDate) => {
                  if (jsDate) onPickDate?.(jsDate);
                  setIsPickerOpen(false);
                }}
                ariaLabel="Ir a fecha del curso"
              />
            </PopoverContent>
          </Popover>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="week-nav-month-box cursor-pointer active:opacity-75 transition-opacity"
              aria-label="Elegir fecha del curso"
            >
              <div className="week-nav-month" aria-hidden="true">
                <span>{m1}</span>
                <span className={m1 === m2 ? 'week-nav-month-placeholder' : ''}>{m2}</span>
              </div>
            </button>
            <Sheet open={isPickerOpen} onOpenChange={setIsPickerOpen}>
              <SheetContent className="p-4 pb-8 flex flex-col items-center">
                <SheetHeader className="mb-2 w-full">
                  <SheetTitle className="text-base text-center">Ir a fecha</SheetTitle>
                </SheetHeader>
                <CalendarView
                  value={pickerDate}
                  onSelect={(str, num, jsDate) => {
                    if (jsDate) onPickDate?.(jsDate);
                    setIsPickerOpen(false);
                  }}
                  ariaLabel="Ir a fecha del curso"
                />
              </SheetContent>
            </Sheet>
          </>
        )}

        <div className="week-nav-arrows">
          <button className="week-nav-arrow-mini" onClick={prevHandler} aria-label={isDayView ? "Día anterior" : "Semana anterior"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={16} strokeWidth={2.5} /></button>
          <button className="week-nav-arrow-mini" onClick={nextHandler} aria-label={isDayView ? "Día siguiente" : "Semana siguiente"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={16} strokeWidth={2.5} /></button>
        </div>
      </div>

      {/* Day buttons viewport & track */}
      <div className="week-nav-viewport">
        <div className="week-nav-track">
          {!isDayView && (
            <div className="week-nav-panel panel-prev">
              {prevWeekDates.map((date, i) => {
                const isToday = isSameDay(date, today);
                const isPast = isPastDay(date, today);
                const isWeekend = date.getDay() === 6 || date.getDay() === 0;
                return (
                  <div
                    key={toInputDate(date)}
                    className={`week-day-btn${isToday ? ' today' : ''}${isPast ? ' is-past' : ''}${isWeekend ? ' is-weekend' : ''}`}
                  >
                    <span className="week-day-name">{DAYS_SHORT[i]}</span>
                    <span className="week-day-num">{date.getDate()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {(() => {
            const selectedDayIndex = isDayView && selectedDay
              ? weekDates.findIndex(d => isSameDay(d, selectedDay))
              : -1;
            const isSelectedToday = selectedDayIndex !== -1 && isSameDay(weekDates[selectedDayIndex], today);
            const colsCount = weekDates?.length || 5;

            return (
              <div className={`week-nav-panel panel-current${isDayView && selectedDayIndex !== -1 ? ' has-day-indicator' : ''}`}>
                {isDayView && selectedDayIndex !== -1 && (
                  <div className="week-day-indicator-track" aria-hidden="true">
                    <div
                      className="week-day-indicator-thumb"
                      style={{
                        width: `calc(100% / ${colsCount})`,
                        transform: `translate3d(${selectedDayIndex * 100}%, 0, 0)`
                      }}
                    >
                      <div className={`week-day-indicator-circle${isSelectedToday ? ' is-today' : ''}`} />
                    </div>
                  </div>
                )}

                {weekDates.map((date, i) => {
                  const isToday = isSameDay(date, today);
                  const isSelected = isDayView && selectedDay && isSameDay(date, selectedDay);
                  const isPast = isPastDay(date, today);
                  const isWeekend = date.getDay() === 6 || date.getDay() === 0;
                  return (
                    <button
                      key={toInputDate(date)}
                      className={`week-day-btn${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${isPast ? ' is-past' : ''}${isWeekend ? ' is-weekend' : ''}`}
                      onClick={() => onSelectDay(date)}
                    >
                      <span className="week-day-name">{DAYS_SHORT[i]}</span>
                      <span className="week-day-num">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {!isDayView && (
            <div className="week-nav-panel panel-next">
              {nextWeekDates.map((date, i) => {
                const isToday = isSameDay(date, today);
                const isPast = isPastDay(date, today);
                const isWeekend = date.getDay() === 6 || date.getDay() === 0;
                return (
                  <div
                    key={toInputDate(date)}
                    className={`week-day-btn${isToday ? ' today' : ''}${isPast ? ' is-past' : ''}${isWeekend ? ' is-weekend' : ''}`}
                  >
                    <span className="week-day-name">{DAYS_SHORT[i]}</span>
                    <span className="week-day-num">{date.getDate()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

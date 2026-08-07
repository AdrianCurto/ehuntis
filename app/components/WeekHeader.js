'use client';

import { useRef } from 'react';

const DAYS_SHORT = ['LU', 'MA', 'MI', 'JU', 'VI'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toInputDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromInputDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
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
}) {
  const dateInputRef = useRef(null);
  const today = new Date();
  const firstDay = weekDates[0];
  const lastDay = weekDates[weekDates.length - 1];
  const prevHandler = isDayView ? onPrevDay : onPrevWeek;
  const nextHandler = isDayView ? onNextDay : onNextWeek;

  const m1 = MONTHS_SHORT[firstDay.getMonth()].toUpperCase();
  const m2 = MONTHS_SHORT[lastDay.getMonth()].toUpperCase();
  const pickerDate = isDayView && selectedDay ? selectedDay : firstDay;

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  };

  return (
    <div className="week-nav">
      {/* Month + Arrows */}
      <div className="week-nav-range">
          <>
            <button
              type="button"
              className="week-nav-month"
              onClick={openDatePicker}
              aria-label="Elegir fecha"
            >
              <span>{m1}</span>
              <span className={m1 === m2 ? 'week-nav-month-placeholder' : ''}>{m2}</span>
            </button>
            <input
              ref={dateInputRef}
              className="week-nav-date-input"
              type="date"
              value={toInputDate(pickerDate)}
              min={toInputDate(minDate)}
              max={toInputDate(maxDate)}
              onChange={(e) => {
                const picked = fromInputDate(e.target.value);
                if (picked) onPickDate?.(picked);
              }}
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="week-nav-arrows">
              <button className="week-nav-arrow-mini" onClick={prevHandler} aria-label={isDayView ? "Día anterior" : "Semana anterior"}>‹</button>
              <button className="week-nav-arrow-mini" onClick={nextHandler} aria-label={isDayView ? "Día siguiente" : "Semana siguiente"}>›</button>
            </div>
          </>
      </div>

      {/* Day buttons */}
      <div className="week-nav-days">
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          const isSelected = isDayView && selectedDay && isSameDay(date, selectedDay);
          return (
            <button
              key={i}
              className={`week-day-btn${isToday ? ' today' : ''}${isSelected && !isToday ? ' selected' : ''}`}
              onClick={() => onSelectDay(date)}
            >
              <span className="week-day-name">{DAYS_SHORT[i]}</span>
              <span className="week-day-num">{date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

const DAYS_SHORT = ['LU', 'MA', 'MI', 'JU', 'VI'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function WeekHeader({ weekDates, selectedDay, onSelectDay, onPrevWeek, onNextWeek }) {
  const today = new Date();
  const firstDay = weekDates[0];
  const lastDay = weekDates[weekDates.length - 1];

  const m1 = MONTHS_SHORT[firstDay.getMonth()].toUpperCase();
  const m2 = MONTHS_SHORT[lastDay.getMonth()].toUpperCase();

  return (
    <div className="week-nav">
      {/* Month + Arrows */}
      <div className="week-nav-range">
        <div className="week-nav-month">
          {m1 === m2 ? (
            <span>{m1}</span>
          ) : (
            <>
              <span>{m1}</span>
              <span>{m2}</span>
            </>
          )}
        </div>
        <div className="week-nav-arrows">
          <button className="week-nav-arrow-mini" onClick={onPrevWeek} aria-label="Semana anterior">‹</button>
          <button className="week-nav-arrow-mini" onClick={onNextWeek} aria-label="Semana siguiente">›</button>
        </div>
      </div>

      {/* Day buttons */}
      <div className="week-nav-days">
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDay);
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

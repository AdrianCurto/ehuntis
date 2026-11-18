import { CalendarDate } from '@internationalized/date';
import { formatTime } from './timeFormat.js';

export { formatTime };

export const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const SPANISH_MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function getDaysInMonth(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0;
  }
  return new Date(year, month, 0).getDate();
}

export function clampDayToMonth(day, month, year) {
  const maxDay = getDaysInMonth(year, month);
  if (maxDay === 0) return 1;
  return Math.min(maxDay, Math.max(1, day));
}

export function buildValidCalendarDate(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  const maxDay = getDaysInMonth(y, m);
  if (d < 1 || d > maxDay) return null;
  return new CalendarDate(y, m, d);
}

export function resolveDateSegmentInput(prevValue, rawNextValue, maxDigits, isFreshEntry, isDeletion = false) {
  const digits = String(rawNextValue ?? '').replace(/\D/g, '');
  if (!digits) return '';

  if (isFreshEntry) {
    if (isDeletion) return '';
    const prev = String(prevValue ?? '').replace(/\D/g, '');
    if (prev && digits.length > prev.length) {
      if (digits.startsWith(prev)) {
        return digits.slice(prev.length, prev.length + maxDigits);
      }
      if (digits.endsWith(prev)) {
        return digits.slice(0, digits.length - prev.length).slice(0, maxDigits);
      }
    }
    return digits.slice(0, maxDigits);
  }

  return digits.slice(0, maxDigits);
}

export function parseValueToCalendarDate(val) {
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

export function parseValueToTime(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const h = Math.floor(val / 100);
    const m = val % 100;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { hour: h, minute: m };
    }
  }
  if (typeof val === 'string') {
    if (val.includes(':')) {
      const parts = val.split(':').map(Number);
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        const h = Math.min(23, Math.max(0, parts[0]));
        const m = Math.min(59, Math.max(0, parts[1]));
        return { hour: h, minute: m };
      }
    }
    const num = Number(val);
    if (!isNaN(num)) return parseValueToTime(num);
  }
  return null;
}

export function calculateMonthGridPadding(year, month) {
  const jsFirstDay = new Date(year, month - 1, 1).getDay();
  // ISO Monday start: Lun=0, Mar=1, ..., Dom=6
  const startOffset = (jsFirstDay + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalSlots = startOffset + daysInMonth;
  const weeksCount = Math.ceil(totalSlots / 7);
  const paddingWeeks = Math.max(0, 6 - weeksCount);
  return { weeksCount, paddingWeeks, totalRows: weeksCount + paddingWeeks };
}

export function formatMonthYearHeading(year, month) {
  const monthName = SPANISH_MONTHS[month - 1] || '';
  return `${monthName} ${year}`;
}

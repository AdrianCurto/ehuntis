const TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Formatea una hora (numero HHMM, string "H:MM"/"HH:MM" o Date) a formato 24h con cero inicial ("09:00").
 * @param {number|string|Date} value
 * @returns {string}
 */
function formatTime(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return TIME_FORMATTER.format(value);
  }

  let h;
  let m;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    h = Math.floor(value / 100);
    m = value % 100;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.includes(':')) return '';
    const parts = trimmed.split(':');
    if (parts.length !== 2) return '';
    h = Number(parts[0]);
    m = Number(parts[1]);
  } else {
    return '';
  }

  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return '';
  }

  return TIME_FORMATTER.format(new Date(2000, 0, 1, h, m));
}

module.exports = {
  formatTime,
};

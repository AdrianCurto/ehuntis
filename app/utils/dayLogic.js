/**
 * Módulo de funciones matemáticas puras para la lógica de fechas, horarios,
 * resolución de día a mostrar y análisis de rachas sin clase (vacaciones/puentes).
 *
 * Diseñado sin dependencias de UI ni entorno, apto para Next.js, Node.js y
 * como especificación exacta para portar a Kotlin (Android) y Swift/JS (Scriptable iOS).
 */

const DAYS_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Devuelve los límites del curso académico para una fecha dada.
 * Curso académico UPV/EHU: del 1 de septiembre al 30 de junio del año siguiente.
 * @param {Date} [date=new Date()]
 * @returns {{ start: Date, end: Date, minDate: Date, maxDate: Date }}
 */
function getAcademicYearBounds(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = d.getMonth(); // 0 = ene, 7 = ago, 8 = sep
  const startYear = m >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  const start = new Date(startYear, 8, 1, 0, 0, 0, 0); // 1 sept
  const end = new Date(startYear + 1, 5, 30, 23, 59, 59, 999); // 30 junio
  return {
    start,
    end,
    minDate: start,
    maxDate: end,
  };
}

/**
 * Convierte un objeto Date a entero YYYYMMDD en hora local.
 * Ej: new Date(2025, 2, 15) -> 20250315
 * @param {Date} date
 * @returns {number}
 */
function toDateNumber(date) {
  if (!date || isNaN(new Date(date).getTime())) return 0;
  const d = date instanceof Date ? date : new Date(date);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Convierte un entero YYYYMMDD a objeto Date (medianoche local).
 * @param {number|string} dateNum
 * @returns {Date}
 */
function parseDateNumber(dateNum) {
  const num = typeof dateNum === 'number' ? dateNum : parseInt(dateNum, 10);
  if (!num || isNaN(num) || num < 10000101) return new Date();
  const y = Math.floor(num / 10000);
  const m = Math.floor((num % 10000) / 100) - 1;
  const d = num % 100;
  return new Date(y, m, d, 0, 0, 0, 0);
}

/**
 * Convierte una hora WebUntis (830, 1430) o string ("08:30") a minutos desde medianoche.
 * Ej: 830 -> 510, 1430 -> 870
 * @param {number|string} timeVal
 * @returns {number}
 */
function toMinutes(timeVal) {
  if (timeVal === undefined || timeVal === null) return 0;
  if (typeof timeVal === 'number') {
    const hour = Math.floor(timeVal / 100);
    const min = timeVal % 100;
    return hour * 60 + min;
  }
  if (typeof timeVal === 'string') {
    if (timeVal.includes(':')) {
      const [h, m] = timeVal.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    }
    const num = parseInt(timeVal, 10);
    if (!isNaN(num)) {
      return Math.floor(num / 100) * 60 + (num % 100);
    }
  }
  return 0;
}

/**
 * Calcula la diferencia en días enteros entre dos fechas (dateA - dateB),
 * blindado con UTC medianoche para evitar desajustes por DST (cambio de hora).
 * @param {Date} dateA
 * @param {Date} dateB
 * @returns {number}
 */
function differenceInDays(dateA, dateB) {
  const d1 = dateA instanceof Date ? dateA : new Date(dateA);
  const d2 = dateB instanceof Date ? dateB : new Date(dateB);
  const utcA = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utcB = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((utcA - utcB) / (1000 * 60 * 60 * 24));
}

/**
 * Nombre del día de la semana en español en minúsculas.
 * @param {Date} date
 * @returns {string} 'lunes', 'martes', etc.
 */
function getDayOfWeekName(date) {
  const d = date instanceof Date ? date : new Date(date);
  return DAYS_FULL[d.getDay()] || '';
}

/**
 * Formato de fecha corto en español. Ej: '15 sep', '20 abr'.
 * @param {Date} date
 * @returns {string}
 */
function formatDateShort(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()] || ''}`.trim();
}

/**
 * Añade o resta días a una fecha devolviendo un nuevo objeto Date a medianoche.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Filtra las lecciones activas (no canceladas ni dimmed) correspondientes a una fecha dada.
 * @param {Array} timetable - Array de lecciones del horario
 * @param {number} dateNum - Entero YYYYMMDD
 * @returns {Array}
 */
function getLessonsForDate(timetable, dateNum) {
  if (!Array.isArray(timetable) || timetable.length === 0) return [];
  return timetable.filter(l => {
    if (!l) return false;
    const lDate = typeof l.date === 'number' ? l.date : toDateNumber(l.date);
    if (lDate !== dateNum) return false;
    if (l.code === 'cancelled') return false;
    if (l.isDimmed) return false;
    return true;
  });
}

/**
 * Obtiene la hora de finalización de la última clase de una lista de lecciones en minutos desde 00:00.
 * @param {Array} lessons
 * @returns {number|null}
 */
function getLastLessonEndMinutes(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) return null;
  let maxMinutes = -1;
  for (const l of lessons) {
    const end = toMinutes(l.endTime);
    if (end > maxMinutes) {
      maxMinutes = end;
    }
  }
  return maxMinutes >= 0 ? maxMinutes : null;
}

/**
 * Algoritmo universal de decisión: ¿Qué día mostrar?
 *
 * @param {Date} [now=new Date()] - Fecha y hora actual a evaluar
 * @param {Array} [timetable=[]] - Horario completo de lecciones
 * @returns {Date} Fecha resuelta a medianoche local
 */
function getResolvedTargetDate(now = new Date(), timetable = []) {
  const currentDate = now instanceof Date ? now : new Date(now);

  // CASO ESPECIAL 1: Sin caché o timetable vacío
  if (!Array.isArray(timetable) || timetable.length === 0) {
    const fallback = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
    if (fallback.getDay() === 0) {
      fallback.setDate(fallback.getDate() + 1); // domingo -> lunes (+1)
    } else if (fallback.getDay() === 6) {
      fallback.setDate(fallback.getDate() + 2); // sábado -> lunes (+2)
    }
    const m = fallback.getMonth();
    if (m === 6 || m === 7 || (m === 8 && fallback.getDate() < 7)) {
      return new Date(fallback.getFullYear(), 8, 7, 0, 0, 0, 0);
    }
    return fallback;
  }

  // CASO ESPECIAL 2: Verano (julio, agosto o antes del 7 de septiembre)
  const currentMonth = currentDate.getMonth();
  if (currentMonth === 6 || currentMonth === 7 || (currentMonth === 8 && currentDate.getDate() < 7)) {
    const todayNum = toDateNumber(currentDate);
    const todayLessons = getLessonsForDate(timetable, todayNum);
    if (todayLessons.length === 0) {
      const tomorrow = addDays(currentDate, 1);
      const tomorrowLessons = getLessonsForDate(timetable, toDateNumber(tomorrow));
      if (tomorrowLessons.length === 0) {
        return new Date(currentDate.getFullYear(), 8, 7, 0, 0, 0, 0);
      }
    }
  }

  const todayNum = toDateNumber(currentDate);
  const todayLessons = getLessonsForDate(timetable, todayNum);

  // CASO A: Hoy TIENE clases propias
  if (todayLessons.length > 0) {
    const lastEnd = getLastLessonEndMinutes(todayLessons);
    const nowM = currentDate.getHours() * 60 + currentDate.getMinutes();
    const minutesSinceLast = lastEnd !== null ? nowM - lastEnd : 0;
    const nowH = currentDate.getHours();

    const shouldJump = (nowH >= 16 && minutesSinceLast >= 60) || (nowH >= 21);

    if (!shouldJump) {
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
    }

    // Al cumplirse el salto, buscar el próximo día con clase lectiva
    const nextClassDate = findClosestClassDate(currentDate, 1, timetable);
    if (!nextClassDate) {
      return addDays(currentDate, 1);
    }

    const gapDays = differenceInDays(nextClassDate, currentDate) - 1;

    if (gapDays < 5) {
      // Brecha corta (< 5 días: mañana, día libre suelto, finde o puente 3-4 días): salto directo al próximo día lectivo
      return nextClassDate;
    } else {
      // Vacaciones largas (>= 5 días): pasar a la cuenta atrás del periodo vacacional
      const eveOfReturn = addDays(nextClassDate, -1);
      if (
        currentDate.getDate() === eveOfReturn.getDate() &&
        currentDate.getMonth() === eveOfReturn.getMonth() &&
        currentDate.getFullYear() === eveOfReturn.getFullYear() &&
        nowH >= 16
      ) {
        return nextClassDate;
      } else {
        return addDays(currentDate, 1);
      }
    }
  }

  // CASO B: Hoy NO tiene clases propias (fin de semana, día libre o vacaciones)
  const nextClassDate = findClosestClassDate(currentDate, 1, timetable);
  if (!nextClassDate) {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
  }

  const pastClassDate = findClosestClassDate(currentDate, -1, timetable);
  const totalGap = pastClassDate
    ? differenceInDays(nextClassDate, pastClassDate) - 1
    : differenceInDays(nextClassDate, currentDate);

  if (totalGap < 5) {
    // Periodo no vacacional (< 5 días): mostrar siempre el próximo día con clase
    return nextClassDate;
  } else {
    // Vacaciones largas (>= 5 días): solo mostrar horario a partir de las 16:00 del día anterior
    const eveOfReturn = addDays(nextClassDate, -1);
    if (
      currentDate.getDate() === eveOfReturn.getDate() &&
      currentDate.getMonth() === eveOfReturn.getMonth() &&
      currentDate.getFullYear() === eveOfReturn.getFullYear() &&
      currentDate.getHours() >= 16
    ) {
      return nextClassDate;
    } else {
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
    }
  }
}

/**
 * Calcula la fecha y hora exacta del próximo evento temporal que requiere actualizar la interfaz
 * (Fin de clase para sombrear, salto de día según DayLogic o medianoche).
 *
 * @param {Date} [now=new Date()]
 * @param {Array} [timetable=[]]
 * @returns {Date|null}
 */
function computeNextEventTime(now = new Date(), timetable = []) {
  const currentDate = now instanceof Date ? now : new Date(now);
  const nowMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const todayNum = toDateNumber(currentDate);
  const ownTodayLessons = getLessonsForDate(timetable, todayNum);
  const allTodayLessons = Array.isArray(timetable)
    ? timetable.filter((l) => {
        if (!l) return false;
        const lDate = typeof l.date === 'number' ? l.date : toDateNumber(l.date);
        return lDate === todayNum && l.code !== 'cancelled';
      })
    : [];

  const candidates = [];

  // 1. Fin de cada clase de hoy (para actualizar sombreado)
  for (const lesson of allTodayLessons) {
    const endM = toMinutes(lesson.endTime);
    if (endM > nowMinutes) {
      candidates.push(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Math.floor(endM / 60), endM % 60, 2)
      );
    }
  }

  // 2. Momento de salto de día si hoy hay clases propias
  if (ownTodayLessons.length > 0) {
    const lastEnd = getLastLessonEndMinutes(ownTodayLessons) || 0;
    const jumpMinute = Math.min(21 * 60, Math.max(16 * 60, lastEnd + 60));
    if (jumpMinute > nowMinutes) {
      candidates.push(
        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), Math.floor(jumpMinute / 60), jumpMinute % 60, 2)
      );
    }
  }

  // 3. Víspera de regreso de vacaciones largas (>= 5 días) a las 16:00
  const nextClass = findClosestClassDate(currentDate, 1, timetable);
  if (nextClass) {
    const pastClass = findClosestClassDate(currentDate, -1, timetable);
    const gap = pastClass
      ? differenceInDays(nextClass, pastClass) - 1
      : differenceInDays(nextClass, currentDate);
    if (gap >= 5) {
      const eve = addDays(nextClass, -1);
      const eveJump = new Date(eve.getFullYear(), eve.getMonth(), eve.getDate(), 16, 0, 2);
      if (eveJump.getTime() > currentDate.getTime()) {
        candidates.push(eveJump);
      }
    }
  }

  // 4. Medianoche (00:00:05 del día siguiente)
  const tomorrowMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1, 0, 0, 5);
  candidates.push(tomorrowMidnight);

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] || null;
}

/**
 * Busca el día lectivo más cercano en una dirección (+1 hacia adelante, -1 hacia atrás)
 * dentro de los límites del curso académico.
 *
 * @param {Date} fromDate - Fecha de inicio de búsqueda
 * @param {number} direction - +1 (adelante) o -1 (atrás)
 * @param {Array} timetable - Horario completo de lecciones
 * @param {{ start: Date, end: Date }} [bounds]
 * @returns {Date|null}
 */
function findClosestClassDate(fromDate, direction, timetable, bounds) {
  if (!Array.isArray(timetable) || timetable.length === 0) return null;
  const b = bounds || getAcademicYearBounds(fromDate);
  const step = direction >= 0 ? 1 : -1;

  let curr = addDays(fromDate, step);
  let iterations = 0;

  while (iterations < 365) {
    iterations++;

    if (curr < b.start || curr > b.end) {
      return null;
    }

    const dateNum = toDateNumber(curr);
    const lessons = getLessonsForDate(timetable, dateNum);
    if (lessons.length > 0) {
      return curr;
    }

    curr = addDays(curr, step);
  }

  return null;
}

/**
 * Analiza la racha de días sin clase en torno a targetDate.
 * Diseñado exclusivamente para el widget (en la web no se muestra en navegación manual).
 *
 * @param {Date} targetDate - Fecha evaluada (ej. día actual del widget)
 * @param {Array} timetable - Horario completo de lecciones
 * @param {Date} [schoolYearEndDate] - Límite de fin de curso (30 junio por defecto)
 * @returns {{ type: 'END_OF_YEAR'|'EXTENDED_BREAK'|'NO_CLASS_TODAY', message: string, totalDays?: number, daysRemaining?: number, returnDate?: Date }}
 */
function analyzeBreakStreak(targetDate, timetable, schoolYearEndDate) {
  const d = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const bounds = getAcademicYearBounds(d);
  const end = schoolYearEndDate instanceof Date ? schoolYearEndDate : bounds.end;

  const pastClassDate = findClosestClassDate(d, -1, timetable, bounds);
  const futureClassDate = findClosestClassDate(d, +1, timetable, bounds);

  // Fin de curso
  if (!futureClassDate || futureClassDate > end) {
    return {
      type: 'END_OF_YEAR',
      message: 'No hay más clases programadas para este curso',
    };
  }

  // Días consecutivos sin clase en el tramo
  const totalDaysWithoutClass = pastClassDate
    ? differenceInDays(futureClassDate, pastClassDate) - 1
    : differenceInDays(futureClassDate, d);

  // Brecha larga (>= 3 días, ej. puentes, Semana Santa, Navidad)
  if (totalDaysWithoutClass >= 3) {
    const daysRemaining = Math.max(1, differenceInDays(futureClassDate, d));
    const dayName = getDayOfWeekName(futureClassDate);
    const dateStr = formatDateShort(futureClassDate);
    const plural = daysRemaining === 1 ? 'Falta' : 'Faltan';
    const unit = daysRemaining === 1 ? 'día' : 'días';

    return {
      type: 'EXTENDED_BREAK',
      totalDays: totalDaysWithoutClass,
      daysRemaining,
      returnDate: futureClassDate,
      message: `${plural} ${daysRemaining} ${unit} para volver a clase (Vuelves el ${dayName} ${dateStr})`,
    };
  }

  // Brecha corta (< 3 días, ej. fin de semana estándar)
  return {
    type: 'NO_CLASS_TODAY',
    message: 'Sin clases hoy',
  };
}

/**
 * Devuelve el array de fechas de la semana (5, 6 o 7 días) de forma dinámica:
 * - 5 días (L-V) por defecto
 * - 6 días (L-S) si hay alguna clase/evento el sábado
 * - 7 días (L-D) si hay alguna clase/evento el domingo (o sábado y domingo)
 *
 * @param {Date} monday - Lunes de la semana
 * @param {Array} lessons - Lista de lecciones / eventos combinados
 * @returns {Date[]} Array de 5, 6 o 7 objetos Date
 */
function getDynamicWeekDates(monday, lessons = []) {
  if (!monday) return [];
  const base = new Date(monday);
  base.setHours(0, 0, 0, 0);

  const satDate = new Date(base);
  satDate.setDate(base.getDate() + 5);
  const sunDate = new Date(base);
  sunDate.setDate(base.getDate() + 6);

  const satNum = toDateNumber(satDate);
  const sunNum = toDateNumber(sunDate);

  let hasSat = false;
  let hasSun = false;

  if (Array.isArray(lessons)) {
    for (const l of lessons) {
      if (!l) continue;
      const lDate = typeof l.date === 'number' ? l.date : toDateNumber(l.date);
      if (lDate === sunNum) {
        hasSun = true;
        break; // Con domingo ya son 7 días
      } else if (lDate === satNum) {
        hasSat = true;
      }
    }
  }

  const count = hasSun ? 7 : (hasSat ? 6 : 5);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

module.exports = {
  getAcademicYearBounds,
  toDateNumber,
  parseDateNumber,
  toMinutes,
  differenceInDays,
  getDayOfWeekName,
  formatDateShort,
  getLessonsForDate,
  getLastLessonEndMinutes,
  getResolvedTargetDate,
  findClosestClassDate,
  analyzeBreakStreak,
  computeNextEventTime,
  getDynamicWeekDates,
};


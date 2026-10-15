/**
 * Módulo de utilidades y persistencia para los Eventos Personalizados de EHUntis.
 * Incluye almacenamiento local-first, expansión de recurrencias (L-V),
 * gestión de excepciones por fecha (estilo Google Calendar) y sugerencia de color.
 */

const { toDateNumber, parseDateNumber, getAcademicYearBounds } = require('./dayLogic');
const { PALETTE } = require('./colorLogic');

const CUSTOM_EVENTS_STORAGE_KEY = 'ehuntis_custom_events_v1';
const CUSTOM_CATEGORIES_STORAGE_KEY = 'ehuntis_custom_categories_v1';

const DEFAULT_CATEGORIES = ['Estudio', 'Deporte', 'Trabajo', 'Ocio', 'Personal'];

/**
 * Lee las categorías personalizadas desde localStorage.
 * @returns {string[]} Lista de nombres de categorías personalizadas creadas por el usuario
 */
function getStoredCustomCategories() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Guarda las categorías personalizadas en localStorage.
 * @param {string[]} categories
 */
function saveStoredCustomCategories(categories) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(categories || []));
  } catch (err) {
    console.error('Error al guardar categorías personalizadas:', err);
  }
}

/**
 * Calcula las horas por defecto para un nuevo evento:
 * La siguiente hora en punto para inicio (ej. 16:30 -> 17:00) y 1 hora después para fin (18:00).
 * Si es tarde por la noche (>= 22h) o de madrugada (< 7h), sugiere 08:00 - 09:00.
 */
function getDefaultEventTimes() {
  const now = new Date();
  const currentHour = now.getHours();
  let nextHour = currentHour + 1;
  let endHour = nextHour + 1;

  if (currentHour >= 22 || currentHour < 7) {
    nextHour = 8;
    endHour = 9;
  }

  const startStr = `${String(nextHour).padStart(2, '0')}:00`;
  const endStr = `${String(endHour).padStart(2, '0')}:00`;
  return { startStr, endStr };
}

/**
 * Lee los eventos personalizados desde localStorage de forma segura.
 * @returns {Array} Lista de eventos
 */
function getStoredCustomEvents() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Guarda los eventos personalizados en localStorage.
 * @param {Array} events
 */
function saveStoredCustomEvents(events) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_EVENTS_STORAGE_KEY, JSON.stringify(events || []));
  } catch (err) {
    console.error('Error al guardar eventos personalizados:', err);
  }
}

/**
 * Sugiere un índice de color (0..13) de la paleta oficial que NO esté
 * en uso por ninguna asignatura de las clases visibles ni por otros eventos.
 *
 * @param {Array} timetableLessons Clases del horario
 * @param {Array} customEvents Eventos personalizados existentes
 * @param {Object} [customColors={}] Mapeo de colores personalizados de asignaturas
 * @returns {number} Índice de paleta recomendado
 */
function suggestEventColor(timetableLessons = [], customEvents = [], customColors = {}) {
  const usedIndices = new Set();

  // 1. Recoger colores usados por clases
  if (Array.isArray(timetableLessons)) {
    timetableLessons.forEach(l => {
      const subjId = l?.subjectIds?.[0];
      if (subjId !== undefined && subjId !== null) {
        if (customColors[subjId] !== undefined) {
          usedIndices.add(Number(customColors[subjId]));
        } else if (typeof l.colorIndex === 'number') {
          usedIndices.add(l.colorIndex);
        }
      }
    });
  }

  // 2. Recoger colores ya usados por otros eventos personalizados
  if (Array.isArray(customEvents)) {
    customEvents.forEach(e => {
      if (typeof e.colorIndex === 'number') {
        usedIndices.add(e.colorIndex);
      }
    });
  }

  // 3. Buscar el primer color libre de la paleta oficial
  for (let i = 0; i < PALETTE.length; i++) {
    if (!usedIndices.has(i)) {
      return i;
    }
  }

  // Si todos los 14 colores están en uso, elegir el color 4 (Lavanda/Púrpura) o 0
  return 4;
}

/**
 * Convierte un string de hora "HH:MM" a número entero HHMM (ej. "14:35" -> 1435).
 * @param {string} timeStr
 * @returns {number}
 */
function timeStringToNumber(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 800;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 100 + (m || 0);
}

/**
 * Convierte un número entero HHMM a string "HH:MM" (ej. 1435 -> "14:35").
 * @param {number} timeNum
 * @returns {string}
 */
function timeNumberToString(timeNum) {
  const num = typeof timeNum === 'number' ? timeNum : 800;
  const h = Math.floor(num / 100);
  const m = num % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Expande la lista de definiciones de eventos personalizados en ocurrencias
 * concretas para un array de fechas (típicamente las fechas de la semana visible).
 * Genera objetos compatibles con la estructura que renderiza WeekCalendar.
 *
 * @param {Array} customEvents Lista de eventos
 * @param {Date[]} targetDates Array de fechas (ej. [Lunes, Martes, ..., Viernes])
 * @returns {Array} Lista de ocurrencias de eventos listas para el calendario
 */
function expandCustomEventsForDates(customEvents = [], targetDates = []) {
  if (!Array.isArray(customEvents) || customEvents.length === 0) return [];
  if (!Array.isArray(targetDates) || targetDates.length === 0) return [];

  const instances = [];

  for (const dateObj of targetDates) {
    if (!dateObj || isNaN(dateObj.getTime())) continue;

    const dateNum = toDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado


    for (const event of customEvents) {
      if (!event || !event.recurrence) continue;

      const exceptions = Array.isArray(event.recurrence.exceptions) ? event.recurrence.exceptions : [];
      // Si esta fecha está en la lista de excepciones, se omite
      if (exceptions.includes(dateNum)) continue;

      let matches = false;

      if (event.recurrence.type === 'none') {
        // Evento puntual: debe coincidir exactamente con la fecha
        matches = event.recurrence.date === dateNum;
      } else if (event.recurrence.type === 'weekly') {
        const days = Array.isArray(event.recurrence.daysOfWeek) ? event.recurrence.daysOfWeek : [];
        const isDayMatched = days.includes(dayOfWeek);
        const isAfterStart = !event.recurrence.startDate || dateNum >= event.recurrence.startDate;
        const isBeforeEnd = !event.recurrence.endDate || dateNum <= event.recurrence.endDate;

        matches = isDayMatched && isAfterStart && isBeforeEnd;
      }

      if (matches) {
        // Crear instancia compatible con el motor de WeekCalendar
        instances.push({
          id: `${event.id}_${dateNum}`,
          eventId: event.id,
          isCustomEvent: true,
          date: dateNum,
          startTime: event.startTime,
          endTime: event.endTime,
          subjects: [event.title || 'Evento personal'],
          subjectShortNames: [event.title || 'Evento personal'],
          subjectIds: [`custom_${event.id}`],
          rooms: event.location ? [event.location] : [],
          teachers: [],
          notes: event.notes || '',
          category: event.category || '',
          colorIndex: typeof event.colorIndex === 'number' ? event.colorIndex : 4,
          type: event.category ? event.category.toUpperCase() : 'PERSONAL',
          recurrenceType: event.recurrence.type,
          isDimmed: false,
          rawEvent: event,
        });
      }
    }
  }

  return instances;
}

/**
 * Elimina una instancia o serie completa de un evento personalizado.
 *
 * @param {Array} events Lista actual de eventos
 * @param {string} eventId ID del evento
 * @param {number} dateNum Fecha YYYYMMDD de la instancia a eliminar
 * @param {'single' | 'series'} mode Modo de eliminación
 * @returns {Array} Nueva lista de eventos actualizada
 */
function deleteCustomEventInstance(events, eventId, dateNum, mode = 'series') {
  if (!Array.isArray(events)) return [];

  return events.reduce((acc, ev) => {
    if (ev.id !== eventId) {
      acc.push(ev);
      return acc;
    }

    // Si es puntual o se elimina toda la serie, se retira del todo
    if (mode === 'series' || ev.recurrence?.type === 'none') {
      return acc;
    }

    // Si es 'single' sobre un evento recurrente, agregamos la fecha a sus excepciones
    const currentExceptions = Array.isArray(ev.recurrence?.exceptions) ? [...ev.recurrence.exceptions] : [];
    if (!currentExceptions.includes(dateNum)) {
      currentExceptions.push(dateNum);
    }

    acc.push({
      ...ev,
      recurrence: {
        ...ev.recurrence,
        exceptions: currentExceptions,
      },
      updatedAt: Date.now(),
    });
    return acc;
  }, []);
}

/**
 * Edita un evento personalizado, gestionando si la edición afecta a solo esta fecha
 * o a toda la repetición.
 *
 * @param {Array} events Lista actual de eventos
 * @param {Object} updatedFields Campos editados del evento
 * @param {number} targetDateNum Fecha YYYYMMDD de la instancia editada
 * @param {'single' | 'series'} mode
 * @returns {Array} Nueva lista de eventos actualizada
 */
function saveCustomEventInstance(events, updatedFields, targetDateNum, mode = 'series') {
  const eventId = updatedFields.id;
  const currentEvents = Array.isArray(events) ? events : [];

  // 1. Si es un nuevo evento (no existe aún)
  const existingIdx = currentEvents.findIndex(e => e.id === eventId);
  if (existingIdx === -1) {
    const newEvent = {
      ...updatedFields,
      id: eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return [...currentEvents, newEvent];
  }

  const existing = currentEvents[existingIdx];

  // 2. Si se edita toda la serie o el evento era puntual:
  if (mode === 'series' || existing.recurrence?.type === 'none') {
    return currentEvents.map(e => (e.id === eventId ? { ...existing, ...updatedFields, updatedAt: Date.now() } : e));
  }

  // 3. Si se edita "Solo esta fecha" de una serie recurrente:
  // - Marcamos targetDateNum como excepción en el evento original recurrente
  // - Creamos un nuevo evento puntual (recurrence.type = 'none') para esa fecha específica con los datos modificados
  const exceptions = Array.isArray(existing.recurrence?.exceptions) ? [...existing.recurrence.exceptions] : [];
  if (!exceptions.includes(targetDateNum)) {
    exceptions.push(targetDateNum);
  }

  const modifiedOriginal = {
    ...existing,
    recurrence: {
      ...existing.recurrence,
      exceptions,
    },
    updatedAt: Date.now(),
  };

  const detachedSingleEvent = {
    ...updatedFields,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    recurrence: {
      type: 'none',
      date: targetDateNum,
      startDate: targetDateNum,
      exceptions: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return [
    ...currentEvents.filter(e => e.id !== eventId),
    modifiedOriginal,
    detachedSingleEvent,
  ];
}

module.exports = {
  CUSTOM_EVENTS_STORAGE_KEY,
  CUSTOM_CATEGORIES_STORAGE_KEY,
  DEFAULT_CATEGORIES,
  getStoredCustomCategories,
  saveStoredCustomCategories,
  getDefaultEventTimes,
  getStoredCustomEvents,
  saveStoredCustomEvents,
  suggestEventColor,
  timeStringToNumber,
  timeNumberToString,
  expandCustomEventsForDates,
  deleteCustomEventInstance,
  saveCustomEventInstance,
};

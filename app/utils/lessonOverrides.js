/**
 * Módulo de utilidades y persistencia para la personalización de clases de WebUntis (Overrides).
 * Permite marcar como cancelada, modificar horas, aula o profesor, intercambiar clases (swap),
 * y detectar automáticamente discrepancias (drift) si la universidad actualiza datos después.
 */

const { formatRoom, formatRooms } = require('./subgroups');
const { formatTime } = require('./timeFormat');

const LESSON_OVERRIDES_STORAGE_KEY = 'ehuntis_lesson_overrides_v1';

/**
 * Genera una clave compuesta determinista y estable para identificar una clase de WebUntis.
 * Prefiere ${date}_${lesson.id} si existe lesson.id.
 * Fallback a ${date}_${subjectId}_${rawStartTime}_${type}
 *
 * @param {Object} lesson
 * @returns {string}
 */
function getLessonKey(lesson) {
  if (!lesson) return '';
  if (lesson.lessonKey) return lesson.lessonKey;

  const date = lesson.rawDate !== undefined ? lesson.rawDate : (lesson.date || '');
  if (lesson.id !== undefined && lesson.id !== null) {
    return `${date}_${lesson.id}`;
  }

  const subjId = lesson.subjectIds?.[0] !== undefined ? lesson.subjectIds[0] : (lesson.subjects?.[0] || 'nosubj');
  const start = lesson.rawStartTime !== undefined ? lesson.rawStartTime : lesson.startTime;
  const type = (lesson.type || '').trim().toLowerCase();
  return `${date}_${subjId}_${start}_${type}`;
}

/**
 * Lee los overrides guardados desde localStorage.
 * @returns {Object} Mapa de { [lessonKey]: LessonOverride }
 */
function getStoredLessonOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LESSON_OVERRIDES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

/**
 * Guarda los overrides en localStorage.
 * @param {Object} overrides Mapa de overrides
 */
function saveStoredLessonOverrides(overrides) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LESSON_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides || {}));
  } catch (err) {
    console.error('Error al guardar lesson overrides:', err);
  }
}

/**
 * Comprueba si la información actual de WebUntis difiere del snapshot original
 * guardado en el momento en que el usuario realizó la personalización.
 *
 * @param {Object} lesson Lección fresca de WebUntis
 * @param {Object} override Personalización del usuario
 * @returns {Array|null} Lista de cambios detectados o null si coincide
 */
function checkRemoteDrift(lesson, override) {
  if (!override || !override.originalSnapshot) return null;
  const snap = override.originalSnapshot;

  const changes = [];

  // Cambio de fecha oficial
  const rawDate = lesson.rawDate ?? lesson.date;
  if (snap.date && rawDate && snap.date !== rawDate) {
    changes.push({
      field: 'date',
      label: 'Fecha oficial',
      before: String(snap.date),
      after: String(rawDate),
    });
  }

  // Cambio de horario oficial
  const rawStart = lesson.rawStartTime ?? lesson.startTime;
  const rawEnd = lesson.rawEndTime ?? lesson.endTime;
  if (snap.startTime !== rawStart || snap.endTime !== rawEnd) {
    changes.push({
      field: 'time',
      label: 'Horario oficial',
      before: `${formatTime(snap.startTime)}–${formatTime(snap.endTime)}`,
      after: `${formatTime(rawStart)}–${formatTime(rawEnd)}`,
    });
  }

  // Cambio de aula oficial
  const rawRooms = lesson.rawRooms ?? lesson.rooms ?? [];
  const snapRooms = snap.rooms ?? [];
  if (!areRoomsEqual(rawRooms, snapRooms)) {
    const rawRoomsStr = formatRooms(rawRooms);
    const snapRoomsStr = formatRooms(snapRooms);
    changes.push({
      field: 'room',
      label: 'Aula oficial',
      before: snapRoomsStr || 'Sin aula',
      after: rawRoomsStr || 'Sin aula',
    });
  }

  // Cambio de estado de cancelación oficial
  const rawCode = lesson.rawCode ?? lesson.code;
  if ((snap.code === 'cancelled') !== (rawCode === 'cancelled')) {
    changes.push({
      field: 'code',
      label: 'Cancelación oficial',
      before: snap.code === 'cancelled' ? 'Cancelada por la universidad' : 'Activa',
      after: rawCode === 'cancelled' ? 'Cancelada por la universidad' : 'Activa',
    });
  }

  return changes.length > 0 ? changes : null;
}

/**
 * Normaliza una lista de aulas para comparación fiable (espacios limpios, ordenadas, minúsculas).
 * Aplica formatRoom para eliminar discrepancias de espaciado o identificadores internos en códigos de aula (ej. "P2 G3A" vs "P2G3A").
 *
 * @param {Array|string} rooms
 * @returns {Array<string>}
 */
function normalizeRooms(rooms) {
  if (!rooms) return [];
  const list = Array.isArray(rooms) ? rooms : [rooms];
  return list
    .map(r => (typeof r === 'string' ? formatRoom(r) : formatRoom(String(r))))
    .map(r => (typeof r === 'string' ? r.replace(/\s+/g, ' ').trim() : String(r).trim()))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Comprueba si dos listas o strings de aulas son equivalentes.
 * @param {Array|string} roomsA
 * @param {Array|string} roomsB
 * @returns {boolean}
 */
function areRoomsEqual(roomsA, roomsB) {
  const normA = normalizeRooms(roomsA);
  const normB = normalizeRooms(roomsB);
  if (normA.length !== normB.length) return false;
  return normA.every((r, idx) => r.toLowerCase() === normB[idx].toLowerCase());
}

/**
 * Comprueba si un override contiene alguna modificación real respecto al estado oficial de WebUntis.
 * Devuelve false si todos los campos son idénticos a los oficiales (o vacíos en el caso de notas).
 *
 * @param {Object} override
 * @param {Object} [snapshot] Snapshot original
 * @param {Object} [lesson] Lección actual de WebUntis
 * @returns {boolean} true si hay diferencias con el estado oficial, false si es idéntica a la oficial
 */
function hasLessonOverrideChanges(override, snapshot, lesson) {
  if (!override || typeof override !== 'object') return false;

  const snap = snapshot || override.originalSnapshot || {};
  const rawLesson = lesson || {};
  const isOverriddenLesson = Boolean(rawLesson.isOverridden);

  // 1. Cancelación manual por el usuario
  if (Boolean(override.userCancelled)) {
    return true;
  }

  // 2. Intercambio (swap) activo con otra clase
  if (override.swappedWith) {
    return true;
  }

  // 3. Notas personales no vacías
  if (typeof override.customNotes === 'string' && override.customNotes.trim() !== '') {
    return true;
  }

  // 4. Fecha modificada
  const officialDate = isOverriddenLesson
    ? (rawLesson.rawDate ?? snap.date)
    : (rawLesson.date ?? snap.date);

  if (
    override.customDate !== undefined &&
    override.customDate !== null &&
    officialDate !== undefined &&
    override.customDate !== officialDate
  ) {
    return true;
  }

  // 5. Horario de inicio modificado
  const officialStart = isOverriddenLesson
    ? (rawLesson.rawStartTime ?? snap.startTime)
    : (rawLesson.startTime ?? snap.startTime);

  if (
    override.customStartTime !== undefined &&
    override.customStartTime !== null &&
    officialStart !== undefined &&
    override.customStartTime !== officialStart
  ) {
    return true;
  }

  // 6. Horario de fin modificado
  const officialEnd = isOverriddenLesson
    ? (rawLesson.rawEndTime ?? snap.endTime)
    : (rawLesson.endTime ?? snap.endTime);

  if (
    override.customEndTime !== undefined &&
    override.customEndTime !== null &&
    officialEnd !== undefined &&
    override.customEndTime !== officialEnd
  ) {
    return true;
  }

  // 7. Aulas modificadas
  const officialRooms = isOverriddenLesson
    ? (rawLesson.rawRooms ?? snap.rooms ?? [])
    : (rawLesson.rooms ?? snap.rooms ?? []);

  if (override.customRooms !== undefined && override.customRooms !== null) {
    if (!areRoomsEqual(override.customRooms, officialRooms)) {
      return true;
    }
  }

  return false;
}

/**
 * Aplica los overrides sobre la lista de lecciones obtenidas de WebUntis.
 * Devuelve un nuevo array de lecciones enriquecidas con las modificaciones del usuario
 * y los metadatos de drift.
 *
 * @param {Array} lessons Lista de clases de WebUntis
 * @param {Object} overrides Mapa de overrides { [lessonKey]: LessonOverride }
 * @returns {Array} Lecciones con overrides aplicados
 */
function applyLessonOverrides(lessons = [], overrides = {}) {
  if (!Array.isArray(lessons)) return [];
  if (!overrides || typeof overrides !== 'object' || Object.keys(overrides).length === 0) {
    return lessons.map(lesson => ({
      ...lesson,
      lessonKey: getLessonKey(lesson),
      isOverridden: false,
      isUserCancelled: false,
      hasRemoteDrift: false,
      driftChanges: null,
      swappedWith: null,
      rawStartTime: lesson.startTime,
      rawEndTime: lesson.endTime,
      rawRooms: lesson.rooms,
      rawCode: lesson.code,
    }));
  }

  const overridesList = Object.values(overrides);

  return lessons.map(lesson => {
    if (!lesson || lesson.isCustomEvent) return lesson;

    const key = getLessonKey(lesson);
    // Buscar primero por clave exacta y si no por ID de WebUntis
    let ov = overrides[key];
    if (!ov && lesson.id !== undefined && lesson.id !== null) {
      ov = overridesList.find(o => o.lessonId === lesson.id);
    }

    if (!ov || !hasLessonOverrideChanges(ov, ov.originalSnapshot, lesson)) {
      return {
        ...lesson,
        lessonKey: key,
        isOverridden: false,
        isUserCancelled: false,
        hasRemoteDrift: false,
        driftChanges: null,
        swappedWith: null,
        rawStartTime: lesson.startTime,
        rawEndTime: lesson.endTime,
        rawRooms: lesson.rooms,
        rawCode: lesson.code,
      };
    }

    const driftChanges = checkRemoteDrift(lesson, ov);
    const isUserCancelled = Boolean(ov.userCancelled);

    return {
      ...lesson,
      lessonKey: key,
      isOverridden: true,
      overrideData: ov,
      rawStartTime: lesson.startTime,
      rawEndTime: lesson.endTime,
      rawRooms: lesson.rooms,
      rawCode: lesson.code,

      // Valores modificados (o fallback a los originales si no se alteró ese campo)
      date: ov.customDate !== undefined ? ov.customDate : lesson.date,
      rawDate: lesson.rawDate ?? lesson.date,
      startTime: ov.customStartTime !== undefined ? ov.customStartTime : lesson.startTime,
      endTime: ov.customEndTime !== undefined ? ov.customEndTime : lesson.endTime,
      rooms: ov.customRooms !== undefined ? ov.customRooms : lesson.rooms,
      notes: ov.customNotes !== undefined ? ov.customNotes : (lesson.notes || ''),
      isUserCancelled,
      code: isUserCancelled ? 'cancelled' : lesson.code,

      // Detección de drift y swap
      hasRemoteDrift: Boolean(driftChanges),
      driftChanges,
      swappedWith: ov.swappedWith || null,
    };
  });
}

/**
 * Crea o actualiza un override para una lección concreta.
 *
 * @param {Object} currentOverrides Mapa actual de overrides
 * @param {Object} lesson Lección original
 * @param {Object} patch Modificaciones (userCancelled, customStartTime, customEndTime, customRooms, customNotes)
 * @returns {Object} Nuevo mapa de overrides actualizado
 */
function setLessonOverride(currentOverrides = {}, lesson, patch = {}) {
  const key = getLessonKey(lesson);
  if (!key) return currentOverrides;

  const existing = currentOverrides[key] || {};
  const snap = existing.originalSnapshot || {
    id: lesson.id,
    date: lesson.rawDate ?? lesson.date,
    startTime: lesson.rawStartTime ?? lesson.startTime,
    endTime: lesson.rawEndTime ?? lesson.endTime,
    rooms: lesson.rawRooms ?? lesson.rooms ?? [],
    teachers: lesson.teachers ?? [],
    code: lesson.rawCode ?? lesson.code ?? null,
  };

  const updatedOverride = {
    ...existing,
    lessonKey: key,
    lessonId: lesson.id,
    date: lesson.date,
    ...patch,
    originalSnapshot: snap,
    updatedAt: Date.now(),
  };

  // Si tras aplicar el parche todos los campos vuelven a coincidir exactamente con el estado oficial,
  // se elimina el override para que la clase deje de figurar como personalizada
  if (!hasLessonOverrideChanges(updatedOverride, snap, lesson)) {
    return removeLessonOverride(currentOverrides, key);
  }

  return {
    ...currentOverrides,
    [key]: updatedOverride,
  };
}

/**
 * Elimina un override y devuelve la lección a su estado oficial original de WebUntis.
 *
 * @param {Object} currentOverrides
 * @param {string} lessonKey
 * @returns {Object}
 */
function removeLessonOverride(currentOverrides = {}, lessonKey) {
  if (!currentOverrides || !lessonKey || !currentOverrides[lessonKey]) {
    return currentOverrides;
  }
  const next = { ...currentOverrides };
  delete next[lessonKey];
  return next;
}

/**
 * Resuelve una discrepancia (drift):
 * - 'adopt_remote': descarta el override y asume el nuevo estado oficial de WebUntis.
 * - 'keep_local': actualiza el snapshot original con los nuevos datos oficiales de WebUntis para silenciar el aviso y conservar la versión del usuario.
 *
 * @param {Object} currentOverrides
 * @param {Object} lesson Lección con override y drift
 * @param {'adopt_remote'|'keep_local'} action
 * @returns {Object}
 */
function resolveDrift(currentOverrides = {}, lesson, action) {
  const key = getLessonKey(lesson);
  if (!currentOverrides[key]) return currentOverrides;

  if (action === 'adopt_remote') {
    return removeLessonOverride(currentOverrides, key);
  }

  // keep_local: actualizar snapshot al estado actual de WebUntis
  const existing = currentOverrides[key];
  const newSnapshot = {
    id: lesson.id,
    date: lesson.rawDate ?? lesson.date,
    startTime: lesson.rawStartTime ?? lesson.startTime,
    endTime: lesson.rawEndTime ?? lesson.endTime,
    rooms: lesson.rawRooms ?? lesson.rooms ?? [],
    teachers: lesson.teachers ?? [],
    code: lesson.rawCode ?? lesson.code ?? null,
  };

  return {
    ...currentOverrides,
    [key]: {
      ...existing,
      originalSnapshot: newSnapshot,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Intercambia (Swap) de forma atómica los horarios y aulas de dos lecciones.
 *
 * @param {Object} currentOverrides
 * @param {Object} lessonA
 * @param {Object} lessonB
 * @returns {Object} Nuevo mapa de overrides con las dos clases intercambiadas
 */
function swapLessons(currentOverrides = {}, lessonA, lessonB, options = {}) {
  if (!lessonA || !lessonB) return currentOverrides;
  const keyA = getLessonKey(lessonA);
  const keyB = getLessonKey(lessonB);
  if (!keyA || !keyB || keyA === keyB) return currentOverrides;

  const snapA = currentOverrides[keyA]?.originalSnapshot || {
    id: lessonA.id,
    date: lessonA.rawDate ?? lessonA.date,
    startTime: lessonA.rawStartTime ?? lessonA.startTime,
    endTime: lessonA.rawEndTime ?? lessonA.endTime,
    rooms: lessonA.rawRooms ?? lessonA.rooms ?? [],
    teachers: lessonA.teachers ?? [],
    code: lessonA.rawCode ?? lessonA.code ?? null,
  };

  const snapB = currentOverrides[keyB]?.originalSnapshot || {
    id: lessonB.id,
    date: lessonB.rawDate ?? lessonB.date,
    startTime: lessonB.rawStartTime ?? lessonB.startTime,
    endTime: lessonB.rawEndTime ?? lessonB.endTime,
    rooms: lessonB.rawRooms ?? lessonB.rooms ?? [],
    teachers: lessonB.teachers ?? [],
    code: lessonB.rawCode ?? lessonB.code ?? null,
  };

  const subjectNameA = lessonA.subjects?.[0] || 'Clase';
  const subjectNameB = lessonB.subjects?.[0] || 'Clase';

  const keepDuration = options.keepDuration !== false;
  const swapRooms = options.swapRooms === true;

  let customStartA = lessonB.startTime;
  let customEndA = lessonB.endTime;
  let customStartB = lessonA.startTime;
  let customEndB = lessonA.endTime;

  if (keepDuration) {
    const toMinutes = (t) => Math.floor(t / 100) * 60 + (t % 100);
    const fromMinutes = (m) => Math.floor(m / 60) * 100 + (m % 60);

    const durA = toMinutes(lessonA.endTime) - toMinutes(lessonA.startTime);
    const durB = toMinutes(lessonB.endTime) - toMinutes(lessonB.startTime);

    customStartA = lessonB.startTime;
    customEndA = fromMinutes(toMinutes(lessonB.startTime) + durA);

    customStartB = lessonA.startTime;
    customEndB = fromMinutes(toMinutes(lessonA.startTime) + durB);
  }

  // Si swapRooms es true: intercambian aulas (A adopta el aula de B y B adopta la de A)
  // Si swapRooms es false (por defecto): cada clase se mantiene en su propia aula
  const customRoomsA = swapRooms ? (lessonB.rooms ?? snapB.rooms ?? []) : (lessonA.rooms ?? snapA.rooms ?? []);
  const customRoomsB = swapRooms ? (lessonA.rooms ?? snapA.rooms ?? []) : (lessonB.rooms ?? snapB.rooms ?? []);

  // Override para clase A: horario correspondiente y aula según opción
  const overrideA = {
    ...(currentOverrides[keyA] || {}),
    lessonKey: keyA,
    lessonId: lessonA.id,
    date: lessonA.date,
    customDate: lessonB.date,
    customStartTime: customStartA,
    customEndTime: customEndA,
    customRooms: customRoomsA,
    swappedWith: {
      lessonKey: keyB,
      subjectName: subjectNameB,
      date: lessonB.date,
    },
    originalSnapshot: snapA,
    updatedAt: Date.now(),
  };

  // Override para clase B: horario correspondiente y aula según opción
  const overrideB = {
    ...(currentOverrides[keyB] || {}),
    lessonKey: keyB,
    lessonId: lessonB.id,
    date: lessonB.date,
    customDate: lessonA.date,
    customStartTime: customStartB,
    customEndTime: customEndB,
    customRooms: customRoomsB,
    swappedWith: {
      lessonKey: keyA,
      subjectName: subjectNameA,
      date: lessonA.date,
    },
    originalSnapshot: snapB,
    updatedAt: Date.now(),
  };

  // Comprobar si al hacer swap ambas clases vuelven a coincidir con su estado oficial original
  const isBackToOfficialA =
    overrideA.customDate === snapA.date &&
    overrideA.customStartTime === snapA.startTime &&
    overrideA.customEndTime === snapA.endTime &&
    areRoomsEqual(overrideA.customRooms, snapA.rooms);

  const isBackToOfficialB =
    overrideB.customDate === snapB.date &&
    overrideB.customStartTime === snapB.startTime &&
    overrideB.customEndTime === snapB.endTime &&
    areRoomsEqual(overrideB.customRooms, snapB.rooms);

  if (isBackToOfficialA && isBackToOfficialB) {
    const nextOverrides = { ...currentOverrides };

    // Limpiar swap de A
    delete overrideA.swappedWith;
    delete overrideA.customDate;
    delete overrideA.customStartTime;
    delete overrideA.customEndTime;
    delete overrideA.customRooms;

    if (!hasLessonOverrideChanges(overrideA, snapA, lessonA)) {
      delete nextOverrides[keyA];
    } else {
      nextOverrides[keyA] = overrideA;
    }

    // Limpiar swap de B
    delete overrideB.swappedWith;
    delete overrideB.customDate;
    delete overrideB.customStartTime;
    delete overrideB.customEndTime;
    delete overrideB.customRooms;

    if (!hasLessonOverrideChanges(overrideB, snapB, lessonB)) {
      delete nextOverrides[keyB];
    } else {
      nextOverrides[keyB] = overrideB;
    }

    return nextOverrides;
  }

  return {
    ...currentOverrides,
    [keyA]: overrideA,
    [keyB]: overrideB,
  };
}

/**
 * Limpia y devuelve un nuevo mapa de overrides eliminando aquellos que ya no contienen
 * ninguna modificación real respecto al horario oficial cargado de WebUntis.
 * Se invoca automáticamente cuando WebUntis actualiza clases oficiales para que dejen de figurar
 * como personalizadas si ahora coinciden con lo que el usuario tenía fijado.
 *
 * @param {Object} currentOverrides Mapa actual de overrides
 * @param {Array} lessons Lista de lecciones oficiales de WebUntis
 * @returns {Object} Overrides limpios sin entradas obsoletas
 */
function cleanObsoleteLessonOverrides(currentOverrides = {}, lessons = []) {
  if (!currentOverrides || typeof currentOverrides !== 'object' || Object.keys(currentOverrides).length === 0) {
    return currentOverrides;
  }
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return currentOverrides;
  }

  let hasChanges = false;
  const next = { ...currentOverrides };

  for (const [key, ov] of Object.entries(currentOverrides)) {
    if (!ov || typeof ov !== 'object') {
      delete next[key];
      hasChanges = true;
      continue;
    }

    // Buscar la lección correspondiente en la lista oficial
    const matched = lessons.find(l => {
      if (!l || l.isCustomEvent) return false;
      const lKey = l.lessonKey || getLessonKey(l);
      if (lKey === key) return true;
      if (ov.lessonId !== undefined && ov.lessonId !== null && l.id === ov.lessonId) return true;
      return false;
    });

    if (!matched) {
      // Si la lección no está en este conjunto de lecciones, no la eliminamos para no borrar overrides de otros grupos/fechas
      continue;
    }

    // Comprobar si tras la actualización oficial de WebUntis la lección ya no difiere del estado oficial
    if (!hasLessonOverrideChanges(ov, ov.originalSnapshot, matched)) {
      delete next[key];
      hasChanges = true;
    }
  }

  return hasChanges ? next : currentOverrides;
}

module.exports = {
  LESSON_OVERRIDES_STORAGE_KEY,
  formatTime,
  getLessonKey,
  getStoredLessonOverrides,
  saveStoredLessonOverrides,
  checkRemoteDrift,
  applyLessonOverrides,
  setLessonOverride,
  removeLessonOverride,
  resolveDrift,
  swapLessons,
  hasLessonOverrideChanges,
  areRoomsEqual,
  cleanObsoleteLessonOverrides,
};

/**
 * Módulo de utilidades y persistencia para la personalización de clases de WebUntis (Overrides).
 * Permite marcar como cancelada, modificar horas, aula o profesor, intercambiar clases (swap),
 * y detectar automáticamente discrepancias (drift) si la universidad actualiza datos después.
 */

const LESSON_OVERRIDES_STORAGE_KEY = 'ehuntis_lesson_overrides_v1';

/**
 * Formatea número HHMM a string "HH:MM"
 * @param {number} t
 * @returns {string}
 */
function formatTime(t) {
  if (typeof t !== 'number') return '';
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, '0');
  return `${h}:${m}`;
}

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

  const date = lesson.date || '';
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
  const rawRoomsStr = rawRooms.join(', ').trim();
  const snapRoomsStr = snapRooms.join(', ').trim();
  if (rawRoomsStr !== snapRoomsStr) {
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

    if (!ov) {
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

  // Override para clase A: adopta aula de B y horario correspondiente
  const overrideA = {
    ...(currentOverrides[keyA] || {}),
    lessonKey: keyA,
    lessonId: lessonA.id,
    date: lessonA.date,
    customDate: lessonB.date,
    customStartTime: customStartA,
    customEndTime: customEndA,
    customRooms: lessonB.rooms,
    swappedWith: {
      lessonKey: keyB,
      subjectName: subjectNameB,
      date: lessonB.date,
    },
    originalSnapshot: snapA,
    updatedAt: Date.now(),
  };

  // Override para clase B: adopta aula de A y horario correspondiente
  const overrideB = {
    ...(currentOverrides[keyB] || {}),
    lessonKey: keyB,
    lessonId: lessonB.id,
    date: lessonB.date,
    customDate: lessonA.date,
    customStartTime: customStartB,
    customEndTime: customEndB,
    customRooms: lessonA.rooms,
    swappedWith: {
      lessonKey: keyA,
      subjectName: subjectNameA,
      date: lessonA.date,
    },
    originalSnapshot: snapB,
    updatedAt: Date.now(),
  };

  return {
    ...currentOverrides,
    [keyA]: overrideA,
    [keyB]: overrideB,
  };
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
};

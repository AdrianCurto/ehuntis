/**
 * Módulo de utilidades y persistencia para la personalización de clases de WebUntis (Overrides).
 * Permite marcar como cancelada, modificar fecha, horas, aula o notas, intercambiar clases (swap),
 * reconciliar automáticamente en 3-way (Base snapshot vs Local vs Remoto WebUntis) y detectar
 * conflictos reales únicamente cuando usuario y universidad modifican el mismo campo con distinto valor.
 */

const { formatRoom, formatRooms } = require('./subgroups');
const { formatTime } = require('./timeFormat');

const LESSON_OVERRIDES_STORAGE_KEY = 'ehuntis_lesson_overrides_v1';

/**
 * Formatea una fecha numérica YYYYMMDD a DD/MM/YYYY para mensajes legibles de conflicto.
 * @param {number|string} dateNum
 * @returns {string}
 */
function formatDateDisplay(dateNum) {
  const n = Number(dateNum);
  if (!Number.isFinite(n) || n < 10000101) return String(dateNum ?? '');
  const y = Math.floor(n / 10000);
  const m = String(Math.floor((n % 10000) / 100)).padStart(2, '0');
  const d = String(n % 100).padStart(2, '0');
  return `${d}/${m}/${y}`;
}

/**
 * Construye la clave canónica de una lección oficial (ignorando un lessonKey previo ya asignado).
 * Prefiere ${rawDate}_${lesson.id} si existe lesson.id.
 * Fallback a ${rawDate}_${subjectId}_${rawStartTime}_${type}
 *
 * @param {Object} lesson
 * @returns {string}
 */
function buildCanonicalLessonKey(lesson) {
  if (!lesson || typeof lesson !== 'object') return '';

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
 * Genera una clave compuesta determinista y estable para identificar una clase de WebUntis.
 * Prefiere lesson.lessonKey si ya existe; si no, ${date}_${lesson.id} o clave compuesta.
 *
 * @param {Object} lesson
 * @returns {string}
 */
function getLessonKey(lesson) {
  if (!lesson) return '';
  if (lesson.lessonKey) return lesson.lessonKey;
  return buildCanonicalLessonKey(lesson);
}

/**
 * Busca la entrada de override correspondiente a una lección en el mapa de overrides,
 * intentando primero por lesson.lessonKey, luego por clave canónica y por último por lessonId.
 * Esto evita perder la referencia o duplicar claves cuando WebUntis cambia la fecha oficial.
 *
 * @param {Object} overrides
 * @param {Object} lesson
 * @returns {{ key: string, override: Object } | null}
 */
function findOverrideEntry(overrides, lesson) {
  if (!overrides || typeof overrides !== 'object' || !lesson || typeof lesson !== 'object') {
    return null;
  }

  if (lesson.lessonKey && overrides[lesson.lessonKey]) {
    return { key: lesson.lessonKey, override: overrides[lesson.lessonKey] };
  }

  const canonical = buildCanonicalLessonKey(lesson);
  if (canonical && overrides[canonical]) {
    return { key: canonical, override: overrides[canonical] };
  }

  if (lesson.id !== undefined && lesson.id !== null) {
    for (const [k, ov] of Object.entries(overrides)) {
      if (ov && typeof ov === 'object' && ov.lessonId === lesson.id) {
        return { key: k, override: ov };
      }
    }
  }

  return null;
}

/**
 * Extrae los valores oficiales puros de una lección (esté o no enriquecida previamente con raw*).
 *
 * @param {Object} lesson
 * @returns {Object}
 */
function extractOfficialState(lesson) {
  if (!lesson || typeof lesson !== 'object') {
    return {
      id: undefined,
      date: undefined,
      startTime: undefined,
      endTime: undefined,
      rooms: [],
      teachers: [],
      code: null,
    };
  }
  return {
    id: lesson.id,
    date: lesson.rawDate !== undefined ? lesson.rawDate : lesson.date,
    startTime: lesson.rawStartTime !== undefined ? lesson.rawStartTime : lesson.startTime,
    endTime: lesson.rawEndTime !== undefined ? lesson.rawEndTime : lesson.endTime,
    rooms: lesson.rawRooms !== undefined ? (lesson.rawRooms ?? []) : (lesson.rooms ?? []),
    teachers: Array.isArray(lesson.teachers) ? lesson.teachers : [],
    code: lesson.rawCode !== undefined ? (lesson.rawCode ?? null) : (lesson.code ?? null),
  };
}

/**
 * Compara dos listas de strings de forma estricta (p. ej. profesores).
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
function areStringArraysEqual(a, b) {
  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];
  if (listA.length !== listB.length) return false;
  for (let i = 0; i < listA.length; i++) {
    if (String(listA[i]) !== String(listB[i])) return false;
  }
  return true;
}

/**
 * Migra referencias `swappedWith.lessonKey` si la clave de una clase cambió por cambio de fecha oficial.
 * @param {Object} overridesMap
 * @param {string} oldKey
 * @param {string} newKey
 */
function migrateSwapReferences(overridesMap, oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  for (const [k, ov] of Object.entries(overridesMap)) {
    if (ov && ov.swappedWith && ov.swappedWith.lessonKey === oldKey) {
      overridesMap[k] = {
        ...ov,
        swappedWith: {
          ...ov.swappedWith,
          lessonKey: newKey,
        },
      };
    }
  }
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
 * Normaliza una lista o string de aulas para comparación fiable:
 * - Aplica formatRoom (quita sufijos internos `_14838` y limpia bordes).
 * - Divide elementos separados por comas.
 * - Elimina diacríticos/tildes, elimina TODOS los espacios internos y pasa a minúsculas.
 * - Deduplica y ordena alfabéticamente.
 * Ejemplos equivalentes: "P3 G2A" == "P3G2A", "P2G3A_14838" == "P2 G3A", "A 1.2" == "A1.2",
 * "Aula 1.4" == "Aula1.4", "Lab Física" == "Lab Fisica".
 *
 * @param {Array|string} rooms
 * @returns {Array<string>}
 */
function normalizeRooms(rooms) {
  if (!rooms) return [];
  const list = Array.isArray(rooms) ? rooms : [rooms];
  const seen = new Set();
  const result = [];

  for (const entry of list) {
    if (entry === null || entry === undefined) continue;
    const parts = String(entry).split(',');
    for (const part of parts) {
      const formatted = formatRoom(part);
      if (!formatted) continue;
      const token = formatted
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();
      if (token && !seen.has(token)) {
        seen.add(token);
        result.push(token);
      }
    }
  }

  result.sort();
  return result;
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
  return normA.every((r, idx) => r === normB[idx]);
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

  const officialCode = isOverriddenLesson
    ? (rawLesson.rawCode ?? snap.code ?? null)
    : (rawLesson.code ?? snap.code ?? null);
  const isOfficialCancelled = officialCode === 'cancelled';

  // 1. Cancelación manual por el usuario (solo es cambio si la oficial NO está ya cancelada)
  if (Boolean(override.userCancelled) && !isOfficialCancelled) {
    return true;
  }

  // 1b. El usuario eligió mantener activa una clase cancelada oficialmente
  if (Boolean(override.ignoreOfficialCancellation) && isOfficialCancelled) {
    return true;
  }

  // 2. Notas personales no vacías
  if (typeof override.customNotes === 'string' && override.customNotes.trim() !== '') {
    return true;
  }

  // 3. Fecha modificada
  const officialDate = isOverriddenLesson
    ? (rawLesson.rawDate ?? snap.date)
    : (rawLesson.date ?? snap.date);

  const hasDateDiff =
    override.customDate !== undefined &&
    override.customDate !== null &&
    officialDate !== undefined &&
    Number(override.customDate) !== Number(officialDate);

  if (hasDateDiff) {
    return true;
  }

  // 4. Horario de inicio modificado
  const officialStart = isOverriddenLesson
    ? (rawLesson.rawStartTime ?? snap.startTime)
    : (rawLesson.startTime ?? snap.startTime);

  const hasStartDiff =
    override.customStartTime !== undefined &&
    override.customStartTime !== null &&
    officialStart !== undefined &&
    override.customStartTime !== officialStart;

  if (hasStartDiff) {
    return true;
  }

  // 5. Horario de fin modificado
  const officialEnd = isOverriddenLesson
    ? (rawLesson.rawEndTime ?? snap.endTime)
    : (rawLesson.endTime ?? snap.endTime);

  const hasEndDiff =
    override.customEndTime !== undefined &&
    override.customEndTime !== null &&
    officialEnd !== undefined &&
    override.customEndTime !== officialEnd;

  if (hasEndDiff) {
    return true;
  }

  // 6. Aulas modificadas
  const officialRooms = isOverriddenLesson
    ? (rawLesson.rawRooms ?? snap.rooms ?? [])
    : (rawLesson.rooms ?? snap.rooms ?? []);

  const hasRoomsDiff =
    override.customRooms !== undefined &&
    override.customRooms !== null &&
    !areRoomsEqual(override.customRooms, officialRooms);

  if (hasRoomsDiff) {
    return true;
  }

  // 7. Intercambio (swap): solo sigue activo si aún difiere algún campo posicional,
  // o si no se dispone de datos de lección/snapshot con los que contrastar la convergencia
  if (override.swappedWith) {
    const hasPositionalBaseline =
      officialDate !== undefined ||
      officialStart !== undefined ||
      officialEnd !== undefined ||
      (Array.isArray(officialRooms) && officialRooms.length > 0);
    const hasAnyCustomPositionalField =
      override.customDate !== undefined ||
      override.customStartTime !== undefined ||
      override.customEndTime !== undefined ||
      override.customRooms !== undefined;

    if (!hasPositionalBaseline || !hasAnyCustomPositionalField) {
      return true;
    }
  }

  return false;
}

/**
 * Comprueba si una lección personalizada tiene modificaciones distintas a la cancelación manual
 * (p. ej. cambio de fecha, horario, aula, notas personales, intercambio o ignorar cancelación oficial).
 * Devuelve false si la clase no tiene override o si su única modificación es `userCancelled: true`.
 *
 * @param {Object} lesson Lección enriquecida por applyLessonOverrides
 * @returns {boolean}
 */
function hasNonCancellationOverrideChanges(lesson) {
  if (!lesson || typeof lesson !== 'object' || !lesson.isOverridden) {
    return false;
  }

  if (lesson.overrideData && typeof lesson.overrideData === 'object') {
    return hasLessonOverrideChanges(
      { ...lesson.overrideData, userCancelled: false },
      lesson.overrideData.originalSnapshot,
      lesson
    );
  }

  if (lesson.swappedWith) return true;
  if (lesson.ignoresOfficialCancellation) return true;
  if (typeof lesson.notes === 'string' && lesson.notes.trim() !== '') return true;
  if (lesson.rawDate !== undefined && Number(lesson.date) !== Number(lesson.rawDate)) return true;
  if (lesson.rawStartTime !== undefined && lesson.startTime !== lesson.rawStartTime) return true;
  if (lesson.rawEndTime !== undefined && lesson.endTime !== lesson.rawEndTime) return true;
  if (lesson.rawRooms !== undefined && !areRoomsEqual(lesson.rooms, lesson.rawRooms)) return true;

  return false;
}

/**
 * Reconcilia en 3-way un override de usuario contra la lección oficial fresca de WebUntis:
 * - Si WebUntis cambió un campo que el usuario NO modificó: aplica el cambio oficial y avanza el snapshot (sin conflicto).
 * - Si WebUntis cambió un campo al MISMO valor que el usuario había fijado (convergencia): elimina el custom* y avanza el snapshot (sin conflicto).
 * - Si WebUntis y el usuario modificaron el MISMO campo a valores DISTINTOS (o WebUntis canceló una clase movida/editada): reporta conflicto real.
 * - Si tras la reconciliación no queda ninguna modificación del usuario, indica shouldRemove: true.
 *
 * Es estrictamente idempotente: ejecutarla dos veces seguidas produce changed: false en la segunda pasada.
 *
 * @param {Object} lesson Lección oficial de WebUntis
 * @param {Object} override Override guardado del usuario
 * @returns {{ reconciledOverride: Object|null, conflicts: Array|null, shouldRemove: boolean, changed: boolean, pendingCancelConflict: boolean }}
 */
function reconcileOverrideWithLesson(lesson, override) {
  if (!override || typeof override !== 'object') {
    return {
      reconciledOverride: null,
      conflicts: null,
      shouldRemove: true,
      changed: true,
      pendingCancelConflict: false,
    };
  }
  if (!lesson || typeof lesson !== 'object') {
    return {
      reconciledOverride: override,
      conflicts: null,
      shouldRemove: false,
      changed: false,
      pendingCancelConflict: false,
    };
  }

  const official = extractOfficialState(lesson);
  const hasSnap = Boolean(override.originalSnapshot && typeof override.originalSnapshot === 'object');
  const snap = hasSnap ? override.originalSnapshot : null;

  const nextOv = { ...override };
  const nextSnap = hasSnap ? { ...snap } : null;
  const conflicts = [];
  let changed = false;

  const deleteField = (fieldName) => {
    if (Object.prototype.hasOwnProperty.call(nextOv, fieldName)) {
      delete nextOv[fieldName];
      changed = true;
    }
  };

  // ── 1. Fecha (date) ────────────────────────────────────────────────────────
  const baseDate = hasSnap && snap.date != null ? snap.date : official.date;
  const hasCustomDate = override.customDate !== undefined && override.customDate !== null;
  const userModifiedDate =
    hasCustomDate && baseDate != null && Number(override.customDate) !== Number(baseDate);
  const remoteChangedDate =
    hasSnap && snap.date != null && official.date != null && Number(snap.date) !== Number(official.date);

  let hasActiveDate = false;
  if (!userModifiedDate) {
    deleteField('customDate');
    if (nextSnap && official.date !== undefined && Number(nextSnap.date) !== Number(official.date)) {
      nextSnap.date = official.date;
      changed = true;
    }
  } else if (official.date !== undefined && Number(override.customDate) === Number(official.date)) {
    // Convergencia: WebUntis actualizó la fecha para coincidir con la del usuario
    deleteField('customDate');
    if (nextSnap && Number(nextSnap.date) !== Number(official.date)) {
      nextSnap.date = official.date;
      changed = true;
    }
  } else if (remoteChangedDate) {
    // Conflicto real en fecha
    hasActiveDate = true;
    conflicts.push({
      field: 'date',
      label: 'Fecha oficial',
      before: formatDateDisplay(snap.date),
      after: formatDateDisplay(official.date),
      userValue: formatDateDisplay(override.customDate),
    });
  } else {
    hasActiveDate = true;
  }

  // ── 2. Horario (time: par atómico startTime + endTime) ─────────────────────
  const baseStart = hasSnap && snap.startTime != null ? snap.startTime : official.startTime;
  const baseEnd = hasSnap && snap.endTime != null ? snap.endTime : official.endTime;
  const hasCustomStart = override.customStartTime !== undefined && override.customStartTime !== null;
  const hasCustomEnd = override.customEndTime !== undefined && override.customEndTime !== null;
  const userStart = hasCustomStart ? override.customStartTime : baseStart;
  const userEnd = hasCustomEnd ? override.customEndTime : baseEnd;

  const userModifiedTime =
    (hasCustomStart && baseStart != null && override.customStartTime !== baseStart) ||
    (hasCustomEnd && baseEnd != null && override.customEndTime !== baseEnd);
  const remoteChangedTime =
    hasSnap &&
    ((snap.startTime != null && official.startTime != null && snap.startTime !== official.startTime) ||
      (snap.endTime != null && official.endTime != null && snap.endTime !== official.endTime));

  let hasActiveTime = false;
  if (!userModifiedTime) {
    deleteField('customStartTime');
    deleteField('customEndTime');
    if (nextSnap) {
      if (official.startTime !== undefined && nextSnap.startTime !== official.startTime) {
        nextSnap.startTime = official.startTime;
        changed = true;
      }
      if (official.endTime !== undefined && nextSnap.endTime !== official.endTime) {
        nextSnap.endTime = official.endTime;
        changed = true;
      }
    }
  } else if (userStart === official.startTime && userEnd === official.endTime) {
    // Convergencia: WebUntis actualizó el horario al mismo tramo del usuario
    deleteField('customStartTime');
    deleteField('customEndTime');
    if (nextSnap) {
      if (nextSnap.startTime !== official.startTime) {
        nextSnap.startTime = official.startTime;
        changed = true;
      }
      if (nextSnap.endTime !== official.endTime) {
        nextSnap.endTime = official.endTime;
        changed = true;
      }
    }
  } else if (remoteChangedTime) {
    // Conflicto real en horario: fijar ambos extremos atómicamente para no mezclar inicio oficial con fin local
    hasActiveTime = true;
    if (userStart !== undefined && nextOv.customStartTime !== userStart) {
      nextOv.customStartTime = userStart;
      changed = true;
    }
    if (userEnd !== undefined && nextOv.customEndTime !== userEnd) {
      nextOv.customEndTime = userEnd;
      changed = true;
    }
    conflicts.push({
      field: 'time',
      label: 'Horario oficial',
      before: `${formatTime(snap.startTime)}–${formatTime(snap.endTime)}`,
      after: `${formatTime(official.startTime)}–${formatTime(official.endTime)}`,
      userValue: `${formatTime(userStart)}–${formatTime(userEnd)}`,
    });
  } else {
    hasActiveTime = true;
  }

  // ── 3. Aula (room) ─────────────────────────────────────────────────────────
  const baseRooms = hasSnap && snap.rooms != null ? snap.rooms : official.rooms;
  const hasCustomRooms = override.customRooms !== undefined && override.customRooms !== null;
  const userModifiedRoom = hasCustomRooms && !areRoomsEqual(override.customRooms, baseRooms);
  const remoteChangedRoom = hasSnap && !areRoomsEqual(snap.rooms ?? [], official.rooms);

  let hasActiveRoom = false;
  if (!userModifiedRoom) {
    deleteField('customRooms');
    if (nextSnap && !areRoomsEqual(nextSnap.rooms ?? [], official.rooms)) {
      nextSnap.rooms = official.rooms;
      changed = true;
    }
  } else if (areRoomsEqual(override.customRooms, official.rooms)) {
    // Convergencia (p. ej. usuario puso P3G2A y WebUntis puso P3 G2A)
    deleteField('customRooms');
    if (nextSnap && !areRoomsEqual(nextSnap.rooms ?? [], official.rooms)) {
      nextSnap.rooms = official.rooms;
      changed = true;
    }
  } else if (remoteChangedRoom) {
    // Conflicto real en aula
    hasActiveRoom = true;
    conflicts.push({
      field: 'room',
      label: 'Aula oficial',
      before: formatRooms(snap.rooms ?? []) || 'Sin aula',
      after: formatRooms(official.rooms) || 'Sin aula',
      userValue: formatRooms(override.customRooms) || 'Sin aula',
    });
  } else {
    hasActiveRoom = true;
  }

  // ── 4. Metadato de swap ────────────────────────────────────────────────────
  // Si todos los campos posicionales convergieron con el estado oficial, el swap ya está reflejado
  if (nextOv.swappedWith && !hasActiveDate && !hasActiveTime && !hasActiveRoom) {
    deleteField('swappedWith');
  }

  // ── 5. Cancelación oficial vs cancelación local (code) ─────────────────────
  const isOfficialCancelled = official.code === 'cancelled';
  const wasOfficialCancelled = hasSnap ? snap.code === 'cancelled' : false;
  const remoteChangedCode = hasSnap && wasOfficialCancelled !== isOfficialCancelled;
  const isUserCancelled = Boolean(override.userCancelled);
  const ignoresOfficialCancel = Boolean(override.ignoreOfficialCancellation);
  const hasPositionalEdits = hasActiveDate || hasActiveTime || hasActiveRoom || Boolean(nextOv.swappedWith);
  let pendingCancelConflict = false;

  if (isUserCancelled && isOfficialCancelled) {
    // Convergencia: usuario canceló y WebUntis también la canceló oficialmente
    deleteField('userCancelled');
    deleteField('ignoreOfficialCancellation');
    if (nextSnap && nextSnap.code !== official.code) {
      nextSnap.code = official.code;
      changed = true;
    }
  } else if (!isOfficialCancelled && ignoresOfficialCancel) {
    // WebUntis reactivó la clase: ya no hace falta ignorar cancelación oficial
    deleteField('ignoreOfficialCancellation');
    if (nextSnap && nextSnap.code !== official.code) {
      nextSnap.code = official.code;
      changed = true;
    }
  } else if (remoteChangedCode && isOfficialCancelled && !isUserCancelled && !ignoresOfficialCancel && hasPositionalEdits) {
    // Conflicto real: el usuario movió o editó la clase (fecha/hora/aula/swap) y WebUntis la canceló oficialmente
    pendingCancelConflict = true;
    conflicts.push({
      field: 'code',
      label: 'Cancelación oficial',
      before: 'Activa',
      after: 'Cancelada por la universidad',
      userValue: 'Activa (modificada)',
    });
  } else {
    if (!isUserCancelled) {
      deleteField('userCancelled');
    }
    if (!ignoresOfficialCancel) {
      deleteField('ignoreOfficialCancellation');
    }
    if (nextSnap && (nextSnap.code === 'cancelled') !== isOfficialCancelled) {
      nextSnap.code = official.code;
      changed = true;
    }
  }

  // ── 6. Notas personales ────────────────────────────────────────────────────
  if (typeof nextOv.customNotes === 'string' && nextOv.customNotes.trim() === '') {
    deleteField('customNotes');
  }

  // ── 7. Profesores en snapshot (el usuario no edita profesores, siempre al día)
  if (nextSnap && !areStringArraysEqual(nextSnap.teachers ?? [], official.teachers)) {
    nextSnap.teachers = official.teachers;
    changed = true;
  }

  if (nextSnap) {
    nextOv.originalSnapshot = nextSnap;
  }

  // ── 8. Comprobar si queda algún cambio real respecto a la lección oficial ──
  const hasRemainingChanges = hasLessonOverrideChanges(nextOv, nextSnap, lesson);
  if (!hasRemainingChanges && conflicts.length === 0) {
    return {
      reconciledOverride: null,
      conflicts: null,
      shouldRemove: true,
      changed: true,
      pendingCancelConflict: false,
    };
  }

  return {
    reconciledOverride: changed ? { ...nextOv, updatedAt: Date.now() } : override,
    conflicts: conflicts.length > 0 ? conflicts : null,
    shouldRemove: false,
    changed,
    pendingCancelConflict,
  };
}

/**
 * Comprueba si existen conflictos reales entre la información actual de WebUntis
 * y las modificaciones realizadas por el usuario.
 * Solo devuelve cambios cuando WebUntis y el usuario modificaron el mismo campo a valores distintos
 * (o cuando WebUntis cancela oficialmente una clase que el usuario movió/editó).
 *
 * @param {Object} lesson Lección fresca de WebUntis
 * @param {Object} override Personalización del usuario
 * @returns {Array|null} Lista de conflictos detectados o null si no hay conflicto
 */
function checkRemoteDrift(lesson, override) {
  if (!override || !override.originalSnapshot) return null;
  const { conflicts } = reconcileOverrideWithLesson(lesson, override);
  return conflicts;
}

/**
 * Aplica los overrides sobre la lista de lecciones obtenidas de WebUntis,
 * ejecutando la reconciliación 3-way en memoria para aplicar cambios oficiales no conflictivos,
 * desmarcar clases convergentes y señalar únicamente conflictos reales.
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
      ignoresOfficialCancellation: false,
      hasRemoteDrift: false,
      driftChanges: null,
      swappedWith: null,
      rawDate: lesson.rawDate ?? lesson.date,
      rawStartTime: lesson.startTime,
      rawEndTime: lesson.endTime,
      rawRooms: lesson.rooms,
      rawCode: lesson.code,
    }));
  }

  return lessons.map(lesson => {
    if (!lesson || lesson.isCustomEvent) return lesson;

    const canonicalKey = buildCanonicalLessonKey(lesson);
    const found = findOverrideEntry(overrides, lesson);

    if (!found) {
      return {
        ...lesson,
        lessonKey: canonicalKey,
        isOverridden: false,
        isUserCancelled: false,
        ignoresOfficialCancellation: false,
        hasRemoteDrift: false,
        driftChanges: null,
        swappedWith: null,
        rawDate: lesson.rawDate ?? lesson.date,
        rawStartTime: lesson.startTime,
        rawEndTime: lesson.endTime,
        rawRooms: lesson.rooms,
        rawCode: lesson.code,
      };
    }

    const { reconciledOverride, conflicts, shouldRemove, pendingCancelConflict } =
      reconcileOverrideWithLesson(lesson, found.override);

    if (shouldRemove || !reconciledOverride) {
      return {
        ...lesson,
        lessonKey: canonicalKey,
        isOverridden: false,
        isUserCancelled: false,
        ignoresOfficialCancellation: false,
        hasRemoteDrift: false,
        driftChanges: null,
        swappedWith: null,
        rawDate: lesson.rawDate ?? lesson.date,
        rawStartTime: lesson.startTime,
        rawEndTime: lesson.endTime,
        rawRooms: lesson.rooms,
        rawCode: lesson.code,
      };
    }

    const ov = reconciledOverride;
    const isUserCancelled = Boolean(ov.userCancelled);
    const ignoresOfficialCancellation = Boolean(ov.ignoreOfficialCancellation) || pendingCancelConflict;

    let effectiveCode = lesson.code;
    if (isUserCancelled) {
      effectiveCode = 'cancelled';
    } else if (ignoresOfficialCancellation && lesson.code === 'cancelled') {
      effectiveCode = null;
    }

    return {
      ...lesson,
      lessonKey: found.key,
      isOverridden: true,
      overrideData: ov,
      rawDate: lesson.rawDate ?? lesson.date,
      rawStartTime: lesson.startTime,
      rawEndTime: lesson.endTime,
      rawRooms: lesson.rooms,
      rawCode: lesson.code,

      // Valores modificados (o fallback a los oficiales si el usuario no alteró ese campo)
      date: ov.customDate !== undefined && ov.customDate !== null ? ov.customDate : lesson.date,
      startTime: ov.customStartTime !== undefined && ov.customStartTime !== null ? ov.customStartTime : lesson.startTime,
      endTime: ov.customEndTime !== undefined && ov.customEndTime !== null ? ov.customEndTime : lesson.endTime,
      rooms: ov.customRooms !== undefined && ov.customRooms !== null ? ov.customRooms : lesson.rooms,
      notes: ov.customNotes !== undefined ? ov.customNotes : (lesson.notes || ''),
      isUserCancelled,
      ignoresOfficialCancellation: Boolean(ov.ignoreOfficialCancellation),
      code: effectiveCode,

      // Detección de conflicto real y swap
      hasRemoteDrift: Boolean(conflicts && conflicts.length > 0),
      driftChanges: conflicts,
      swappedWith: ov.swappedWith || null,
    };
  });
}

/**
 * Normaliza un override para que sea disperso (sparse): solo conserva los campos que
 * difieren realmente del estado oficial de la lección.
 *
 * @param {Object} ov
 * @param {Object} official
 * @returns {Object}
 */
function pruneRedundantOverrideFields(ov, official, patch = {}) {
  const clean = { ...ov };

  // Fecha
  if (
    clean.customDate === undefined ||
    clean.customDate === null ||
    (official.date !== undefined && Number(clean.customDate) === Number(official.date))
  ) {
    delete clean.customDate;
  }

  // Horario (atómico)
  const hasStart = clean.customStartTime !== undefined && clean.customStartTime !== null;
  const hasEnd = clean.customEndTime !== undefined && clean.customEndTime !== null;
  const effStart = hasStart ? clean.customStartTime : official.startTime;
  const effEnd = hasEnd ? clean.customEndTime : official.endTime;

  if ((!hasStart && !hasEnd) || (effStart === official.startTime && effEnd === official.endTime)) {
    delete clean.customStartTime;
    delete clean.customEndTime;
  } else if ('customStartTime' in patch || 'customEndTime' in patch) {
    // Asegurar par atómico cuando el usuario edita el horario
    if (effStart !== undefined) clean.customStartTime = effStart;
    if (effEnd !== undefined) clean.customEndTime = effEnd;
  }

  // Aulas
  if (
    clean.customRooms === undefined ||
    clean.customRooms === null ||
    areRoomsEqual(clean.customRooms, official.rooms)
  ) {
    delete clean.customRooms;
  }

  // Notas
  if (typeof clean.customNotes !== 'string' || clean.customNotes.trim() === '') {
    delete clean.customNotes;
  }

  // Cancelación
  const isOfficialCancelled = official.code === 'cancelled';
  if (clean.userCancelled) {
    if (isOfficialCancelled) {
      delete clean.userCancelled;
      delete clean.ignoreOfficialCancellation;
    } else {
      delete clean.ignoreOfficialCancellation;
    }
  } else {
    delete clean.userCancelled;
  }

  if (!clean.ignoreOfficialCancellation || !isOfficialCancelled) {
    delete clean.ignoreOfficialCancellation;
  }

  // Swap: si todos los campos posicionales volvieron al oficial, limpiar swappedWith
  const hasAnyPositional =
    clean.customDate !== undefined ||
    clean.customStartTime !== undefined ||
    clean.customEndTime !== undefined ||
    clean.customRooms !== undefined;
  if (clean.swappedWith && !hasAnyPositional) {
    delete clean.swappedWith;
  }

  return clean;
}

/**
 * Crea o actualiza un override para una lección concreta en formato disperso (sparse):
 * solo guarda los campos que difieren realmente del estado oficial actual de WebUntis.
 *
 * @param {Object} currentOverrides Mapa actual de overrides
 * @param {Object} lesson Lección original o enriquecida
 * @param {Object} patch Modificaciones (userCancelled, customDate, customStartTime, customEndTime, customRooms, customNotes)
 * @returns {Object} Nuevo mapa de overrides actualizado
 */
function setLessonOverride(currentOverrides = {}, lesson, patch = {}) {
  const canonicalKey = buildCanonicalLessonKey(lesson) || getLessonKey(lesson);
  if (!canonicalKey) return currentOverrides;

  const found = findOverrideEntry(currentOverrides, lesson);
  const storedKey = found ? found.key : canonicalKey;
  const existing = found ? found.override : {};
  const official = extractOfficialState(lesson);

  const snap = existing.originalSnapshot
    ? { ...existing.originalSnapshot }
    : {
        id: official.id,
        date: official.date,
        startTime: official.startTime,
        endTime: official.endTime,
        rooms: official.rooms,
        teachers: official.teachers,
        code: official.code,
      };

  // Actualizar snapshot solo para los campos explícitamente incluidos en este parche
  if ('customDate' in patch && official.date !== undefined) {
    snap.date = official.date;
  }
  if ('customStartTime' in patch || 'customEndTime' in patch) {
    if (official.startTime !== undefined) snap.startTime = official.startTime;
    if (official.endTime !== undefined) snap.endTime = official.endTime;
  }
  if ('customRooms' in patch) {
    snap.rooms = official.rooms;
  }
  if ('userCancelled' in patch) {
    snap.code = official.code;
  }
  snap.teachers = official.teachers;

  const targetKey = snap.date !== undefined && official.date !== undefined && Number(snap.date) === Number(official.date)
    ? canonicalKey
    : storedKey;

  const mergedOverride = {
    ...existing,
    lessonKey: targetKey,
    lessonId: official.id,
    date: official.date,
    ...patch,
    originalSnapshot: snap,
    updatedAt: Date.now(),
  };

  const prunedOverride = pruneRedundantOverrideFields(mergedOverride, official, patch);

  // Si tras aplicar el parche todos los campos coinciden con el estado oficial, eliminar el override
  if (!hasLessonOverrideChanges(prunedOverride, snap, lesson)) {
    const next = { ...currentOverrides };
    delete next[storedKey];
    if (canonicalKey !== storedKey) delete next[canonicalKey];
    return next;
  }

  const next = { ...currentOverrides };
  if (storedKey !== targetKey) {
    delete next[storedKey];
    migrateSwapReferences(next, storedKey, targetKey);
  }
  next[targetKey] = prunedOverride;
  return next;
}

/**
 * Elimina un override y devuelve la lección a su estado oficial original de WebUntis.
 * Acepta tanto una clave string como un objeto lección (con búsqueda por lessonId si la clave migró).
 *
 * @param {Object} currentOverrides
 * @param {string|Object} lessonKeyOrLesson
 * @returns {Object}
 */
function removeLessonOverride(currentOverrides = {}, lessonKeyOrLesson) {
  if (!currentOverrides || !lessonKeyOrLesson) {
    return currentOverrides;
  }

  let targetKey = null;
  if (typeof lessonKeyOrLesson === 'string') {
    if (currentOverrides[lessonKeyOrLesson]) {
      targetKey = lessonKeyOrLesson;
    } else {
      for (const [k, ov] of Object.entries(currentOverrides)) {
        if (ov && ov.lessonKey === lessonKeyOrLesson) {
          targetKey = k;
          break;
        }
      }
    }
  } else if (typeof lessonKeyOrLesson === 'object') {
    const found = findOverrideEntry(currentOverrides, lessonKeyOrLesson);
    if (found) targetKey = found.key;
  }

  if (!targetKey || !currentOverrides[targetKey]) {
    return currentOverrides;
  }

  const next = { ...currentOverrides };
  delete next[targetKey];
  return next;
}

/**
 * Resuelve una discrepancia (conflicto real):
 * - 'adopt_remote': adopta los valores oficiales SOLO en los campos en conflicto (conservando
 *   notas personales y otros cambios del usuario sin conflicto) y actualiza el snapshot.
 *   Si tras adoptar no queda ningún cambio local, elimina el override.
 * - 'keep_local': conserva la versión del usuario en los campos en conflicto (incluyendo
 *   `ignoreOfficialCancellation: true` si la universidad la canceló) y actualiza el snapshot
 *   al estado oficial actual para silenciar el aviso.
 *
 * @param {Object} currentOverrides
 * @param {Object} lesson Lección con override y conflicto
 * @param {'adopt_remote'|'keep_local'} action
 * @returns {Object}
 */
function resolveDrift(currentOverrides = {}, lesson, action) {
  const found = findOverrideEntry(currentOverrides, lesson);
  if (!found) return currentOverrides;

  const { key: storedKey, override: existing } = found;
  const official = extractOfficialState(lesson);
  const canonicalKey = buildCanonicalLessonKey(lesson) || storedKey;

  const { reconciledOverride, conflicts } = reconcileOverrideWithLesson(lesson, existing);
  const conflictFields = new Set((conflicts || []).map(c => c.field));

  const newSnapshot = {
    id: official.id,
    date: official.date,
    startTime: official.startTime,
    endTime: official.endTime,
    rooms: official.rooms,
    teachers: official.teachers,
    code: official.code,
  };

  if (action === 'adopt_remote') {
    // Si no había snapshot o conflictos detectados (compatibilidad con overrides mínimos sin snapshot)
    if (conflictFields.size === 0) {
      return removeLessonOverride(currentOverrides, storedKey);
    }

    const nextOv = {
      ...(reconciledOverride || existing),
      lessonKey: canonicalKey,
      lessonId: official.id,
      date: official.date,
      originalSnapshot: newSnapshot,
      updatedAt: Date.now(),
    };

    if (conflictFields.has('date')) {
      delete nextOv.customDate;
    }
    if (conflictFields.has('time')) {
      delete nextOv.customStartTime;
      delete nextOv.customEndTime;
    }
    if (conflictFields.has('room')) {
      delete nextOv.customRooms;
    }
    if (conflictFields.has('code')) {
      // Adoptar cancelación oficial descarta el reposicionamiento pero conserva notas personales
      delete nextOv.customDate;
      delete nextOv.customStartTime;
      delete nextOv.customEndTime;
      delete nextOv.customRooms;
      delete nextOv.swappedWith;
      delete nextOv.userCancelled;
      delete nextOv.ignoreOfficialCancellation;
    }
    if (nextOv.swappedWith && (conflictFields.has('date') || conflictFields.has('time'))) {
      delete nextOv.swappedWith;
    }

    const cleanedOv = pruneRedundantOverrideFields(nextOv, official);
    if (!hasLessonOverrideChanges(cleanedOv, newSnapshot, lesson)) {
      const next = { ...currentOverrides };
      delete next[storedKey];
      if (canonicalKey !== storedKey) delete next[canonicalKey];
      return next;
    }

    const next = { ...currentOverrides };
    if (storedKey !== canonicalKey) {
      delete next[storedKey];
      migrateSwapReferences(next, storedKey, canonicalKey);
    }
    next[canonicalKey] = cleanedOv;
    return next;
  }

  // keep_local: conservar campos conflictivos del usuario y actualizar snapshot al estado oficial actual
  const nextOv = {
    ...(reconciledOverride || existing),
    lessonKey: canonicalKey,
    lessonId: official.id,
    date: official.date,
    originalSnapshot: newSnapshot,
    updatedAt: Date.now(),
  };

  if (conflictFields.has('code') && official.code === 'cancelled') {
    nextOv.ignoreOfficialCancellation = true;
  }

  const cleanedOv = pruneRedundantOverrideFields(nextOv, official);
  if (!hasLessonOverrideChanges(cleanedOv, newSnapshot, lesson)) {
    const next = { ...currentOverrides };
    delete next[storedKey];
    if (canonicalKey !== storedKey) delete next[canonicalKey];
    return next;
  }

  const next = { ...currentOverrides };
  if (storedKey !== canonicalKey) {
    delete next[storedKey];
    migrateSwapReferences(next, storedKey, canonicalKey);
  }
  next[canonicalKey] = cleanedOv;
  return next;
}

/**
 * Intercambia (Swap) de forma atómica los horarios (y opcionalmente aulas) de dos lecciones,
 * almacenando solo los campos que difieren del estado oficial (formato disperso).
 *
 * @param {Object} currentOverrides
 * @param {Object} lessonA
 * @param {Object} lessonB
 * @param {Object} [options]
 * @returns {Object} Nuevo mapa de overrides con las dos clases intercambiadas
 */
function swapLessons(currentOverrides = {}, lessonA, lessonB, options = {}) {
  if (!lessonA || !lessonB) return currentOverrides;
  const foundA = findOverrideEntry(currentOverrides, lessonA);
  const foundB = findOverrideEntry(currentOverrides, lessonB);
  const keyA = foundA ? foundA.key : getLessonKey(lessonA);
  const keyB = foundB ? foundB.key : getLessonKey(lessonB);
  if (!keyA || !keyB || keyA === keyB) return currentOverrides;

  const officialA = extractOfficialState(lessonA);
  const officialB = extractOfficialState(lessonB);

  const snapA = foundA?.override?.originalSnapshot || {
    id: officialA.id,
    date: officialA.date,
    startTime: officialA.startTime,
    endTime: officialA.endTime,
    rooms: officialA.rooms,
    teachers: officialA.teachers,
    code: officialA.code,
  };

  const snapB = foundB?.override?.originalSnapshot || {
    id: officialB.id,
    date: officialB.date,
    startTime: officialB.startTime,
    endTime: officialB.endTime,
    rooms: officialB.rooms,
    teachers: officialB.teachers,
    code: officialB.code,
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
  // Si swapRooms es false (por defecto): cada clase mantiene su aula actual (sin congelar si coincide con la oficial)
  const targetRoomsA = swapRooms ? (lessonB.rooms ?? snapB.rooms ?? []) : (lessonA.rooms ?? snapA.rooms ?? []);
  const targetRoomsB = swapRooms ? (lessonA.rooms ?? snapA.rooms ?? []) : (lessonB.rooms ?? snapB.rooms ?? []);

  const targetDateA = lessonB.date;
  const targetDateB = lessonA.date;

  // Comprobar si al hacer swap ambas clases vuelven a coincidir con su estado oficial original
  const isBackToOfficialA =
    Number(targetDateA) === Number(officialA.date) &&
    customStartA === officialA.startTime &&
    customEndA === officialA.endTime &&
    areRoomsEqual(targetRoomsA, officialA.rooms);

  const isBackToOfficialB =
    Number(targetDateB) === Number(officialB.date) &&
    customStartB === officialB.startTime &&
    customEndB === officialB.endTime &&
    areRoomsEqual(targetRoomsB, officialB.rooms);

  const nextOverrides = { ...currentOverrides };

  if (isBackToOfficialA && isBackToOfficialB) {
    const cleanedA = pruneRedundantOverrideFields(
      {
        ...(foundA?.override || {}),
        lessonKey: keyA,
        lessonId: officialA.id,
        date: officialA.date,
        customDate: undefined,
        customStartTime: undefined,
        customEndTime: undefined,
        customRooms: undefined,
        swappedWith: undefined,
        originalSnapshot: snapA,
        updatedAt: Date.now(),
      },
      officialA
    );
    delete cleanedA.swappedWith;

    if (!hasLessonOverrideChanges(cleanedA, snapA, lessonA)) {
      delete nextOverrides[keyA];
    } else {
      nextOverrides[keyA] = cleanedA;
    }

    const cleanedB = pruneRedundantOverrideFields(
      {
        ...(foundB?.override || {}),
        lessonKey: keyB,
        lessonId: officialB.id,
        date: officialB.date,
        customDate: undefined,
        customStartTime: undefined,
        customEndTime: undefined,
        customRooms: undefined,
        swappedWith: undefined,
        originalSnapshot: snapB,
        updatedAt: Date.now(),
      },
      officialB
    );
    delete cleanedB.swappedWith;

    if (!hasLessonOverrideChanges(cleanedB, snapB, lessonB)) {
      delete nextOverrides[keyB];
    } else {
      nextOverrides[keyB] = cleanedB;
    }

    return nextOverrides;
  }

  const overrideA = pruneRedundantOverrideFields(
    {
      ...(foundA?.override || {}),
      lessonKey: keyA,
      lessonId: officialA.id,
      date: officialA.date,
      customDate: targetDateA,
      customStartTime: customStartA,
      customEndTime: customEndA,
      customRooms: targetRoomsA,
      swappedWith: {
        lessonKey: keyB,
        subjectName: subjectNameB,
        date: lessonB.date,
      },
      originalSnapshot: snapA,
      updatedAt: Date.now(),
    },
    officialA,
    { customDate: targetDateA, customStartTime: customStartA, customEndTime: customEndA, customRooms: targetRoomsA }
  );

  const overrideB = pruneRedundantOverrideFields(
    {
      ...(foundB?.override || {}),
      lessonKey: keyB,
      lessonId: officialB.id,
      date: officialB.date,
      customDate: targetDateB,
      customStartTime: customStartB,
      customEndTime: customEndB,
      customRooms: targetRoomsB,
      swappedWith: {
        lessonKey: keyA,
        subjectName: subjectNameA,
        date: lessonA.date,
      },
      originalSnapshot: snapB,
      updatedAt: Date.now(),
    },
    officialB,
    { customDate: targetDateB, customStartTime: customStartB, customEndTime: customEndB, customRooms: targetRoomsB }
  );

  nextOverrides[keyA] = overrideA;
  nextOverrides[keyB] = overrideB;
  return nextOverrides;
}

/**
 * Reconcilia todo el mapa de overrides contra la lista fresca de lecciones oficiales de WebUntis:
 * - Elimina overrides cuyas diferencias convergieron totalmente con WebUntis.
 * - Limpia campos parciales convergentes o redundantes (p. ej. aula actualizada por WebUntis al mismo valor
 *   o campos congelados en overrides antiguos) y avanza `originalSnapshot` en campos no conflictivos.
 * - Migra la clave del mapa si WebUntis movió la fecha oficial de la clase (sin conflicto en fecha).
 *
 * Es estrictamente idempotente: si nada cambió, devuelve la misma referencia `currentOverrides`.
 *
 * @param {Object} currentOverrides Mapa actual de overrides
 * @param {Array} lessons Lista de lecciones oficiales de WebUntis
 * @returns {Object} Overrides reconciliados (misma referencia si no hubo cambios)
 */
function reconcileLessonOverrides(currentOverrides = {}, lessons = []) {
  if (!currentOverrides || typeof currentOverrides !== 'object' || Object.keys(currentOverrides).length === 0) {
    return currentOverrides;
  }
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return currentOverrides;
  }

  let hasChanges = false;
  const next = { ...currentOverrides };

  for (const key of Object.keys(currentOverrides)) {
    const ov = next[key];
    if (!ov || typeof ov !== 'object') {
      delete next[key];
      hasChanges = true;
      continue;
    }

    // Buscar la lección correspondiente en la lista oficial
    const matched = lessons.find(l => {
      if (!l || l.isCustomEvent) return false;
      const canonical = buildCanonicalLessonKey(l);
      if (canonical === key || (l.lessonKey && l.lessonKey === key)) return true;
      if (ov.lessonId !== undefined && ov.lessonId !== null && l.id === ov.lessonId) return true;
      return false;
    });

    if (!matched) {
      // No borrar overrides de otros grupos/fechas que no estén en este conjunto
      continue;
    }

    const { reconciledOverride, conflicts, shouldRemove, changed } = reconcileOverrideWithLesson(matched, ov);

    if (shouldRemove || !reconciledOverride) {
      delete next[key];
      hasChanges = true;
      continue;
    }

    const official = extractOfficialState(matched);
    const canonicalKey = buildCanonicalLessonKey(matched);
    const hasDateConflict = Boolean(conflicts && conflicts.some(c => c.field === 'date'));
    const shouldMigrateKey = Boolean(!hasDateConflict && canonicalKey && canonicalKey !== key);

    if (shouldMigrateKey) {
      delete next[key];
      next[canonicalKey] = {
        ...reconciledOverride,
        lessonKey: canonicalKey,
        date: official.date,
        updatedAt: Date.now(),
      };
      migrateSwapReferences(next, key, canonicalKey);
      hasChanges = true;
    } else if (changed) {
      next[key] = reconciledOverride;
      hasChanges = true;
    }
  }

  return hasChanges ? next : currentOverrides;
}

/**
 * Alias retrocompatible para `reconcileLessonOverrides`.
 *
 * @param {Object} currentOverrides
 * @param {Array} lessons
 * @returns {Object}
 */
function cleanObsoleteLessonOverrides(currentOverrides = {}, lessons = []) {
  return reconcileLessonOverrides(currentOverrides, lessons);
}

/**
 * Devuelve las partes de texto de los valores oficiales de WebUntis que difieren
 * respecto a los valores actuales en edición (fecha, horario y/o aula).
 *
 * @param {Object} params
 * @param {number} [params.officialDate]
 * @param {number} [params.currentDate]
 * @param {number} [params.officialStartTime]
 * @param {number} [params.officialEndTime]
 * @param {number} [params.currentStartTime]
 * @param {number} [params.currentEndTime]
 * @param {Array<string>|string} [params.officialRooms]
 * @param {Array<string>|string} [params.currentRooms]
 * @returns {Array<string>}
 */
function getOfficialDiffSummaryParts({
  officialDate,
  currentDate,
  officialStartTime,
  officialEndTime,
  currentStartTime,
  currentEndTime,
  officialRooms,
  currentRooms,
} = {}) {
  const parts = [];

  if (officialDate != null && currentDate != null && Number(currentDate) !== Number(officialDate)) {
    parts.push(formatDateDisplay(officialDate));
  }

  const timeChanged =
    (officialStartTime != null && currentStartTime != null && Number(currentStartTime) !== Number(officialStartTime)) ||
    (officialEndTime != null && currentEndTime != null && Number(currentEndTime) !== Number(officialEndTime));

  if (timeChanged && officialStartTime != null && officialEndTime != null) {
    parts.push(`${formatTime(officialStartTime)}–${formatTime(officialEndTime)}`);
  }

  if (!areRoomsEqual(currentRooms, officialRooms)) {
    const officialRoomList = Array.isArray(officialRooms)
      ? officialRooms
      : typeof officialRooms === 'string'
        ? officialRooms.split(',')
        : [];
    const officialRoomsStr = formatRooms(officialRoomList);
    parts.push(officialRoomsStr || 'Sin aula');
  }

  return parts;
}

module.exports = {
  LESSON_OVERRIDES_STORAGE_KEY,
  formatTime,
  formatDateDisplay,
  getOfficialDiffSummaryParts,
  buildCanonicalLessonKey,
  getLessonKey,
  findOverrideEntry,
  getStoredLessonOverrides,
  saveStoredLessonOverrides,
  reconcileOverrideWithLesson,
  reconcileLessonOverrides,
  checkRemoteDrift,
  applyLessonOverrides,
  setLessonOverride,
  removeLessonOverride,
  resolveDrift,
  swapLessons,
  hasLessonOverrideChanges,
  hasNonCancellationOverrideChanges,
  normalizeRooms,
  areRoomsEqual,
  cleanObsoleteLessonOverrides,
};

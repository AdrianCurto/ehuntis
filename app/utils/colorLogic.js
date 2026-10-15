/**
 * Módulo de lógica de colores para asignaturas de EHUntis.
 * Incluye la paleta oficial (16 tonos claro/oscuro), clasificación temporal (anual, Q1, Q2),
 * cálculo determinista por defecto, resolución de colores personalizados y regla de intercambio (swap).
 */

// Paleta oficial de 14 colores pastel distintivos para modo claro:
// - 8 colores principales con contraste y tonos diferenciados
// - 6 tonos suaves complementarios que van aparte con variedad definida
const PALETTE = [
  // 8 Colores principales
  { bg: '#BAE1FF', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 0: Azul cielo
  { bg: '#FFDFBA', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 1: Albaricoque / Naranja
  { bg: '#BAFFC9', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 2: Verde menta
  { bg: '#FFB3BA', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 3: Coral / Rosa cálido
  { bg: '#D9BAFF', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 4: Lavanda / Púrpura
  { bg: '#FFF6BA', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 5: Amarillo mantequilla
  { bg: '#BAFFFF', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 6: Cian / Aqua
  { bg: '#FFC8DD', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 7: Rosa pastel

  // 6 Tonos suaves / complementarios con verdadera variedad cromática
  { bg: '#F4B69C', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 8: Terracota suave / Melocotón
  { bg: '#DCB5DE', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 9: Malva suave / Orquídea
  { bg: '#A2D5C6', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 10: Verde Salvia / Jade
  { bg: '#CCE3A3', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 11: Pistacho / Lima suave
  { bg: '#F5D580', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 12: Miel / Ocre suave
  { bg: '#BDC7EC', text: '#0F172A', border: 'rgba(0,0,0,0.1)' }, // 13: Pervinca / Pizarra
];

// Paleta de 14 colores oscuros emparejados con alto contraste y texto vibrante
const PALETTE_DARK = [
  // 8 Colores principales
  { bg: '#163B60', text: '#BAE6FD', border: 'rgba(56, 189, 248, 0.35)' }, // 0: Azul cielo oscuro
  { bg: '#4A2A14', text: '#FED7AA', border: 'rgba(251, 146, 60, 0.35)' }, // 1: Albaricoque oscuro
  { bg: '#133E2B', text: '#BBF7D0', border: 'rgba(74, 222, 128, 0.35)' }, // 2: Verde menta oscuro
  { bg: '#4C1D24', text: '#FECDD3', border: 'rgba(251, 113, 133, 0.35)' }, // 3: Coral oscuro
  { bg: '#351F54', text: '#E9D5FF', border: 'rgba(192, 132, 252, 0.35)' }, // 4: Lavanda oscuro
  { bg: '#42360E', text: '#FEF08A', border: 'rgba(250, 204, 21, 0.35)' }, // 5: Amarillo oscuro
  { bg: '#0F3942', text: '#A5F3FC', border: 'rgba(34, 211, 238, 0.35)' }, // 6: Cian oscuro
  { bg: '#4A1D36', text: '#FBCFE8', border: 'rgba(244, 114, 182, 0.35)' }, // 7: Rosa oscuro

  // 6 Tonos suaves / complementarios: con tonos bien diferenciados, mayor saturación y contraste visible en modo oscuro
  { bg: '#542517', text: '#FED7AA', border: 'rgba(251, 146, 60, 0.45)' }, // 8: Terracota suave oscuro
  { bg: '#441B42', text: '#F5D0FE', border: 'rgba(240, 171, 252, 0.45)' }, // 9: Malva suave oscuro
  { bg: '#143F37', text: '#99F6E4', border: 'rgba(94, 234, 212, 0.45)' }, // 10: Jade / Salvia oscuro
  { bg: '#2E3A14', text: '#ECFCCB', border: 'rgba(190, 242, 100, 0.45)' }, // 11: Pistacho / Lima oscuro
  { bg: '#463311', text: '#FEF08A', border: 'rgba(250, 204, 21, 0.45)' }, // 12: Miel / Ocre oscuro
  { bg: '#1E2548', text: '#C7D2FE', border: 'rgba(165, 180, 252, 0.45)' }, // 13: Pervinca oscuro
];

// Índices ordenados cromáticamente para el selector de colores de la UI:
// - Principales: Coral -> Albaricoque -> Amarillo -> Menta -> Cian -> Azul -> Lavanda -> Rosa
const CHROMATIC_ORDER_MAIN = [3, 1, 5, 2, 6, 0, 4, 7];
// - Suaves (apartes): Terracota -> Miel -> Pistacho -> Jade -> Pervinca -> Malva
const CHROMATIC_ORDER_SOFT = [8, 12, 11, 10, 13, 9];

/**
 * Determina si un conjunto de fechas lectivas corresponde a 'annual', 'q1' o 'q2'.
 * Q1: Meses 9 a 12 (Septiembre a Diciembre)
 * Q2: Meses 2 a 6 (Febrero a Junio)
 */
function classifySubjectPeriod(datesSet) {
  let q1CoreCount = 0;
  let q2CoreCount = 0;

  if (datesSet) {
    for (const dateVal of datesSet) {
      if (!dateVal) continue;
      let month = 0;
      if (typeof dateVal === 'number') {
        // YYYYMMDD -> el mes son los 2 dígitos centrales
        month = Math.floor((dateVal % 10000) / 100);
      } else if (dateVal instanceof Date) {
        month = dateVal.getMonth() + 1;
      } else if (typeof dateVal === 'string') {
        const num = parseInt(dateVal, 10);
        if (!isNaN(num) && num > 10000000) {
          month = Math.floor((num % 10000) / 100);
        } else {
          const d = new Date(dateVal);
          month = !isNaN(d.getTime()) ? d.getMonth() + 1 : 0;
        }
      }

      if (month >= 9 && month <= 12) {
        q1CoreCount++;
      } else if (month >= 2 && month <= 6) {
        q2CoreCount++;
      }
    }
  }

  if (q1CoreCount >= 3 && q2CoreCount >= 3) {
    return 'annual';
  }
  if (q1CoreCount > 0) {
    return 'q1';
  }
  if (q2CoreCount > 0) {
    return 'q2';
  }
  return 'q1';
}

/**
 * Obtiene el mapa de periodos { [subjectId]: 'annual' | 'q1' | 'q2' } a partir de las lecciones.
 */
function getSubjectPeriods(lessons) {
  const subjectDatesMap = new Map();
  if (Array.isArray(lessons)) {
    lessons.filter(Boolean).forEach(l => {
      const id = l.subjectIds?.[0];
      if (id === undefined || id === null) return;
      if (!subjectDatesMap.has(id)) {
        subjectDatesMap.set(id, new Set());
      }
      if (l.date) {
        subjectDatesMap.get(id).add(l.date);
      }
    });
  }

  const periodMap = {};
  for (const [id, dates] of subjectDatesMap.entries()) {
    periodMap[id] = classifySubjectPeriod(dates);
  }
  return periodMap;
}

/**
 * Comprueba si dos asignaturas coinciden temporalmente en clases:
 * - Anual con Anual: sí
 * - Anual con Q1 o Q2: sí
 * - Q1 con Q1: sí
 * - Q2 con Q2: sí
 * - Q1 con Q2: NO coinciden
 */
function doSubjectsCoincide(periodA, periodB) {
  if (!periodA || !periodB) return true;
  if (periodA === 'annual' || periodB === 'annual') return true;
  return periodA === periodB;
}

/**
 * Calcula el mapa de colores por defecto determinista según el algoritmo original.
 * Garantiza 100% de compatibilidad con la visualización existente.
 */
function computeDefaultSubjectColors(lessons) {
  const subjectDatesMap = new Map();
  if (Array.isArray(lessons)) {
    lessons.filter(Boolean).forEach(l => {
      const id = l.subjectIds?.[0];
      if (id === undefined || id === null) return;
      if (!subjectDatesMap.has(id)) {
        subjectDatesMap.set(id, new Set());
      }
      if (l.date) {
        subjectDatesMap.get(id).add(l.date);
      }
    });
  }

  const annualSubjects = [];
  const q1Subjects = [];
  const q2Subjects = [];

  const uniqueIds = Array.from(subjectDatesMap.keys()).sort((a, b) => a - b);
  uniqueIds.forEach(id => {
    const dates = subjectDatesMap.get(id);
    const period = classifySubjectPeriod(dates);
    if (period === 'annual') {
      annualSubjects.push(id);
    } else if (period === 'q1') {
      q1Subjects.push(id);
    } else if (period === 'q2') {
      q2Subjects.push(id);
    }
  });

  const defaultMapping = {};

  annualSubjects.forEach((id, i) => {
    defaultMapping[id] = i % PALETTE.length;
  });

  const numAnnual = annualSubjects.length;
  const cuatPoolSize = Math.max(1, PALETTE.length - numAnnual);

  q1Subjects.forEach((id, i) => {
    const colorIdx = numAnnual < PALETTE.length
      ? (numAnnual + (i % cuatPoolSize)) % PALETTE.length
      : i % PALETTE.length;
    defaultMapping[id] = colorIdx;
  });

  q2Subjects.forEach((id, i) => {
    const colorIdx = numAnnual < PALETTE.length
      ? (numAnnual + (i % cuatPoolSize)) % PALETTE.length
      : i % PALETTE.length;
    defaultMapping[id] = colorIdx;
  });

  return defaultMapping;
}

/**
 * Consolida el mapa final de colores aplicando los overrides personalizados del usuario
 * sobre los colores por defecto.
 *
 * @param {Array} lessons - Lecciones del horario
 * @param {Object} customColors - { [subjectId]: colorIndex }
 * @returns {Object} { [subjectId]: colorIndex }
 */
function resolveSubjectColors(lessons, customColors = {}) {
  const defaultMapping = computeDefaultSubjectColors(lessons);
  const resolved = { ...defaultMapping };

  if (customColors && typeof customColors === 'object') {
    Object.entries(customColors).forEach(([subjId, colorIdx]) => {
      const idNum = Number(subjId);
      const idx = Number(colorIdx);
      if (!isNaN(idNum) && !isNaN(idx) && idx >= 0 && idx < PALETTE.length) {
        resolved[idNum] = idx;
      }
    });
  }

  return resolved;
}

/**
 * Obtiene el objeto de estilo { bg, text, border } para un color y tema.
 */
function getSubjectColorStyle(colorIndex, isDark = false) {
  const palette = isDark ? PALETTE_DARK : PALETTE;
  const idx = Math.abs(Number(colorIndex) || 0) % palette.length;
  return palette[idx];
}

/**
 * Realiza un cambio de color con regla de intercambio (swap) para asignaturas coincidentes.
 *
 * @param {Object} params
 * @param {number|string} params.targetSubjectId - Asignatura a la que se le asigna el nuevo color
 * @param {number} params.newColorIndex - Índice del color deseado (0..15)
 * @param {Array} params.lessons - Lecciones para conocer periodos y fechas
 * @param {Object} params.customColors - Mapa de customColors actual del perfil
 * @returns {Object} Nuevo mapa customColors actualizado con los swaps necesarios
 */
function swapSubjectColor({
  targetSubjectId,
  newColorIndex,
  lessons = [],
  customColors = {},
}) {
  const targetId = Number(targetSubjectId);
  const newIdx = Math.abs(Number(newColorIndex) || 0) % PALETTE.length;

  const currentResolved = resolveSubjectColors(lessons, customColors);
  const periodMap = getSubjectPeriods(lessons);

  const currentTargetColor = currentResolved[targetId] !== undefined
    ? currentResolved[targetId]
    : (Math.abs(targetId) % PALETTE.length);

  // Si ya tiene este color, no hay nada que cambiar
  if (currentTargetColor === newIdx) {
    return { ...customColors };
  }

  const targetPeriod = periodMap[targetId] || 'q1';

  // Buscar todas las asignaturas coincidentes con targetId
  const allSubjectIds = Object.keys(currentResolved).map(Number);
  const coincidingSubjectsWithNewColor = [];

  for (const sId of allSubjectIds) {
    if (sId === targetId) continue;
    const sPeriod = periodMap[sId] || 'q1';
    if (doSubjectsCoincide(targetPeriod, sPeriod)) {
      if (currentResolved[sId] === newIdx) {
        coincidingSubjectsWithNewColor.push(sId);
      }
    }
  }

  const nextCustom = { ...customColors };

  if (coincidingSubjectsWithNewColor.length > 0) {
    // Hay al menos una asignatura coincidente con el color objetivo -> Intercambio (swap)
    // En caso de multiplicidad, intercambiamos con la primera coincidente
    const swappedSubjectId = coincidingSubjectsWithNewColor[0];

    nextCustom[targetId] = newIdx;
    nextCustom[swappedSubjectId] = currentTargetColor;
  } else {
    // Ninguna asignatura coincidente tiene este color -> Asignación directa limpia
    nextCustom[targetId] = newIdx;
  }

  return nextCustom;
}

module.exports = {
  PALETTE,
  PALETTE_DARK,
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  classifySubjectPeriod,
  getSubjectPeriods,
  doSubjectsCoincide,
  computeDefaultSubjectColors,
  resolveSubjectColors,
  getSubjectColorStyle,
  swapSubjectColor,
};

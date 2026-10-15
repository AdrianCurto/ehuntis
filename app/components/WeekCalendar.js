'use client';

import { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { extractSubgroupNumber, isMagistralType, extractSubgroupKey } from '../utils/subgroups';
import { formatTeacher, getTeacherCandidates } from '../utils/teachers';

import {
  PALETTE,
  PALETTE_DARK,
  resolveSubjectColors,
  getSubjectColorStyle,
} from '../utils/colorLogic';

export { PALETTE, PALETTE_DARK, getSubjectColorStyle };

// Helper to assign a color index dynamically based on a semester-aware unique list of subjects and customColors
let subjectColorIndexMap = new Map();
export function updateSubjectColors(lessons, customColors = {}) {
  if (!Array.isArray(lessons)) return;
  const resolved = resolveSubjectColors(lessons, customColors);
  subjectColorIndexMap = new Map();
  Object.entries(resolved).forEach(([id, idx]) => {
    subjectColorIndexMap.set(Number(id), idx);
  });
}

export function getSubjectColorIndex(subjectId) {
  const id = typeof subjectId === 'number' ? subjectId : parseInt(subjectId, 10) || 0;
  return subjectColorIndexMap.has(id) ? subjectColorIndexMap.get(id) : Math.abs(id) % PALETTE.length;
}

export function subjectColor(subjectId, isDark) {
  const isDarkMode = isDark !== undefined
    ? isDark
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const idx = getSubjectColorIndex(subjectId);
  return getSubjectColorStyle(idx, isDarkMode);
}

function blockDisplayName(lesson) {
  return lesson.subjects?.[0] || '';
}

const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'i', 'eta', 'a', 'o', 'd', 'para', 'por', 'con', 'al', 'da'
]);

export function getSignificantWords(fullName) {
  if (!fullName) return [];
  const clean = fullName.replace(/[(),.\-:/]/g, ' ');
  const words = clean
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) {
    return clean.split(/\s+/).filter(w => w.length > 0);
  }
  return words;
}

export function buildSubjectTiers(fullName, lesson = null) {
  if (!fullName) return [];
  const clean = fullName.replace(/[(),.\-:/]/g, ' ').trim();
  const allTokens = clean.split(/\s+/).filter(Boolean);
  if (allTokens.length === 0) return [];

  const tiers = [];

  // 1. Full Original Name (Words as is, keeping all conjunctions and prepositions)
  tiers.push({ name: 'full', words: allTokens });

  function shorten(w, len) {
    if (w.length <= len) return w;
    return w.charAt(0).toUpperCase() + w.slice(1, len).toLowerCase();
  }

  const sigTokens = allTokens.filter(t => !STOP_WORDS.has(t.toLowerCase()));
  const hasMultipleWords = allTokens.length > 1;

  // 2. 3-chars WITH conjunctions (e.g. "Ela y Res de Mat")
  if (allTokens.some(t => t.length > 3)) {
    const w3_with = allTokens.map(t => {
      if (STOP_WORDS.has(t.toLowerCase())) return t.toLowerCase();
      return shorten(t, 3);
    });
    tiers.push({ name: '3-chars-with', words: w3_with });
  }

  // 3. 3-chars WITHOUT conjunctions (e.g. "Ela Res Mat")
  if (hasMultipleWords && sigTokens.length > 0) {
    const w3_no = sigTokens.map(t => shorten(t, 3));
    tiers.push({ name: '3-chars-no', words: w3_no });
  }

  // 4. 2-chars WITH conjunctions (e.g. "El y Re de Ma")
  if (allTokens.some(t => t.length > 2)) {
    const w2_with = allTokens.map(t => {
      if (STOP_WORDS.has(t.toLowerCase())) {
        return t.toLowerCase();
      }
      return shorten(t, 2);
    });
    tiers.push({ name: '2-chars-with', words: w2_with });
  }

  // 5. 2-chars WITHOUT conjunctions (e.g. "El Re Ma")
  if (hasMultipleWords && sigTokens.length > 0) {
    const w2_no = sigTokens.map(t => shorten(t, 2));
    tiers.push({ name: '2-chars-no', words: w2_no });
  }

  // 6. Siglas Inline (e.g. "ERM", "SO")
  const initials = (sigTokens.length > 0 ? sigTokens : allTokens).map(t => t.charAt(0).toUpperCase()).join('');
  const officialShort = lesson?.subjectShortNames?.[0]?.trim();
  const siglas = (officialShort && officialShort.length <= 4 && officialShort.toLowerCase() !== fullName.toLowerCase())
    ? officialShort
    : initials;

  if (siglas.length > 1) {
    tiers.push({ name: 'siglas-inline', words: [siglas], isSiglas: true });
  }

  // 7. Siglas Stacked (1 char per line)
  tiers.push({ name: 'siglas-stacked', words: Array.from(siglas), isStacked: true });

  return tiers;
}

export function getRoomCandidates(rawRoom) {
  if (!rawRoom) return [];
  const raw = rawRoom.trim().replace(/\s+/g, '');
  const candidates = [raw];

  // EHU room codes like P2G1A, P1I2S, P2E3A, S1A8A -> allow dropping the last letter (A, S, I)
  if (/[0-9][A-Za-z]$/i.test(raw)) {
    candidates.push(raw.slice(0, -1));
  }
  return candidates;
}

let _measureCtx = null;
function getMeasureCtx() {
  if (!_measureCtx && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    _measureCtx = canvas.getContext('2d');
  }
  return _measureCtx;
}

function measureText(text, fontPx, weight = '600', letterSpacingEm = 0) {
  if (!text) return 0;
  const ctx = getMeasureCtx();
  let baseWidth = 0;
  if (!ctx) {
    baseWidth = text.length * fontPx * 0.6;
  } else {
    ctx.font = `${weight} ${fontPx}px Inter, sans-serif`;
    baseWidth = ctx.measureText(text).width;
  }
  if (letterSpacingEm && text.length > 1) {
    baseWidth += (text.length - 1) * fontPx * letterSpacingEm;
  }
  return baseWidth;
}

function partitionBalanced(words, numLines, fontPx, maxWidth) {
  if (numLines === 1) {
    const text = words.join(' ');
    const w = measureText(text, fontPx, '700', 0.02);
    return w <= maxWidth ? [text] : null;
  }
  if (words.length < numLines) return null;

  let bestPartition = null;
  let minCost = Infinity;

  const totalWidth = words.reduce((acc, w) => acc + measureText(w, fontPx, '700', 0.01), 0) +
                     (words.length - 1) * measureText(' ', fontPx, '700', 0.01);
  const targetWidthPerLine = totalWidth / numLines;

  function recurse(wordIdx, currentLines, currentCost) {
    const linesLeft = numLines - currentLines.length;
    const wordsLeft = words.length - wordIdx;
    if (wordsLeft < linesLeft) return;

    if (linesLeft === 1) {
      const lastLineWords = words.slice(wordIdx);
      const lineStr = lastLineWords.join(' ');
      const w = measureText(lineStr, fontPx, '700', 0.01);
      if (w > maxWidth) return;

      let lineCost = Math.pow(w - targetWidthPerLine, 2);
      // Heavy penalty for a single orphan word on the last line when there are multiple words
      if (lastLineWords.length === 1 && words.length >= 4) {
        lineCost += Math.pow(fontPx * 4, 2);
      }
      const totalCost = currentCost + lineCost;
      if (totalCost < minCost) {
        minCost = totalCost;
        bestPartition = [...currentLines, lineStr];
      }
      return;
    }

    for (let i = wordIdx + 1; i <= words.length - linesLeft + 1; i++) {
      const lineWords = words.slice(wordIdx, i);
      const lineStr = lineWords.join(' ');
      const w = measureText(lineStr, fontPx, '700', 0.01);
      if (w > maxWidth) break;

      let lineCost = Math.pow(w - targetWidthPerLine, 2);
      if (lineWords.length === 1 && words.length >= 4 && currentLines.length > 0) {
        lineCost += Math.pow(fontPx * 3, 2);
      }
      recurse(i, [...currentLines, lineStr], currentCost + lineCost);
    }
  }

  recurse(0, [], 0);
  return bestPartition;
}

function wrapWords(words, fontPx, maxWidth, remainingHeight, isDayView) {
  if (!words || words.length === 0) return null;

  const lineHeight = fontPx >= 11 ? 1.14 : 1.1;
  const singleLineH = Math.round(fontPx * lineHeight);
  const maxPossibleLines = remainingHeight !== undefined
    ? Math.max(1, Math.floor((remainingHeight + 1) / singleLineH))
    : 4;

  const fullText = words.join(' ');
  const singleLineWidth = measureText(fullText, fontPx, '700', 0.02);

  // In Day View, leave comfortable margins (4px). In Week View, every pixel counts (0.5px margin).
  const singleMargin = isDayView ? 4 : 0.5;
  const partitionMargin = isDayView ? 2 : 0;

  if (words.length === 1) {
    return singleLineWidth <= maxWidth - (isDayView ? 2 : 0) ? [fullText] : null;
  }

  // Safe single line check
  const fitsSingleSafely = singleLineWidth <= maxWidth - singleMargin;
  const isLongOrMultiWord = isDayView && (
    (fullText.length > 25 && singleLineWidth > maxWidth * 0.72) ||
    (words.length >= 4 && singleLineWidth > maxWidth * 0.72) ||
    (fullText.length > 32)
  );

  // If 1 line fits safely AND we don't prefer 2 lines due to length/multi-words:
  if (fitsSingleSafely && (!isLongOrMultiWord || maxPossibleLines < 2)) {
    return [fullText];
  }

  // Try 2 lines
  if (maxPossibleLines >= 2) {
    const p2 = partitionBalanced(words, 2, fontPx, maxWidth - partitionMargin);
    if (p2) return p2;
  }

  // Try 3 lines if height allows
  if (maxPossibleLines >= 3) {
    const p3 = partitionBalanced(words, 3, fontPx, maxWidth - partitionMargin);
    if (p3) return p3;
  }

  // Try 4 lines if height allows
  if (maxPossibleLines >= 4 && words.length >= 4) {
    const p4 = partitionBalanced(words, 4, fontPx, maxWidth - partitionMargin);
    if (p4) return p4;
  }

  // If multi-line did not fit (e.g. words too long) but 1 line fits safely
  if (fitsSingleSafely) {
    return [fullText];
  }

  return null;
}

const BADGE_STYLES = [
  { font: 10, padY: 1, padX: 4, mb: 1.5 },
  { font: 10, padY: 0.5, padX: 2.5, mb: 1 },
  { font: 9,  padY: 0.5, padX: 2, mb: 1 },
  { font: 8,  padY: 0, padX: 1.5, mb: 0.5 },
  { font: 7,  padY: 0, padX: 1, mb: 0.5 },
];

export function generateAlternatingSteps(sLen, rLen, tLen) {
  const steps = [];
  let s = 0;
  let r = 0;
  let t = 0;
  steps.push({ s, r, t });
  const order = ['s', 'r', 't'];
  let orderIdx = 0;

  while (s < sLen - 1 || r < rLen - 1 || t < tLen - 1) {
    let advanced = false;
    for (let i = 0; i < order.length; i++) {
      const turn = order[(orderIdx + i) % order.length];
      if (turn === 's' && s < sLen - 1) {
        s++;
        advanced = true;
        orderIdx = (orderIdx + i + 1) % order.length;
        break;
      } else if (turn === 'r' && r < rLen - 1) {
        r++;
        advanced = true;
        orderIdx = (orderIdx + i + 1) % order.length;
        break;
      } else if (turn === 't' && t < tLen - 1) {
        t++;
        advanced = true;
        orderIdx = (orderIdx + i + 1) % order.length;
        break;
      }
    }
    if (!advanced) break;
    steps.push({ s, r, t });
  }
  return steps;
}

export function computeBlockLayout(lesson, blockWidth, blockHeight, isDayView) {
  const padX = isDayView ? (blockWidth < 140 ? 4 : 6) : (blockWidth < 28 ? 1 : (blockWidth < 45 ? 1.5 : 2.5));
  const padY = isDayView ? 8 : (blockHeight < 40 ? 3 : 5);
  const padTop = isDayView ? (blockHeight < 45 ? 2 : 4) : (blockHeight < 32 ? 1 : Math.floor(padY / 2));
  const padBottom = isDayView ? (blockHeight < 45 ? 2 : 4) : (blockHeight < 32 ? 1 : Math.floor(padY / 2));
  const padding = `${padTop}px ${padX}px ${padBottom}px ${padX}px`;
  const availWidth = Math.max(0, blockWidth - padX * 2 - (isDayView ? 2 : 0));
  const availHeight = Math.max(0, blockHeight - padTop - padBottom - (isDayView ? 2 : 0));

  const isMagistral = !lesson.isCustomEvent && isMagistralType(lesson.type);

  // 1. Badge candidate options
  const subNum = !lesson.isCustomEvent ? extractSubgroupNumber(lesson.type) : null;
  const badgeCandidates = [];

  if (lesson.isCustomEvent) {
    if (lesson.category) {
      const catText = lesson.category.charAt(0).toUpperCase() + lesson.category.slice(1).toLowerCase();
      for (const style of BADGE_STYLES) {
        if (measureText(catText, style.font, '800') + style.padX * 2 <= availWidth) {
          const height = Math.round(style.font * 1.1) + style.padY * 2 + style.mb;
          badgeCandidates.push({
            hide: false,
            text: catText,
            font: style.font,
            padding: `${style.padY}px ${style.padX}px`,
            lineHeight: 1.1,
            height,
          });
          break;
        }
      }
    }
  } else if (lesson.type && lesson.type.trim()) {
    const raw = lesson.type.trim();
    const upper = raw.toUpperCase();
    const texts = [];

    if (isMagistral) {
      if (upper.includes('MAGIS')) {
        texts.push('Magistral', 'Magis', 'M');
      } else if (upper.startsWith('GA') || upper.startsWith('G.A.')) {
        texts.push('GA');
      } else if (upper === 'T' || upper.startsWith('T0') || upper.includes('TEOR')) {
        texts.push('Teoría', 'Teor', 'T');
      } else {
        texts.push(raw);
      }
    } else {
      texts.push(raw);
      if (upper.includes('LAB')) {
        if (subNum !== null) texts.push(`P. Lab ${subNum}`);
        texts.push('P. Lab', 'PLab');
      } else if (upper.includes('ORD')) {
        if (subNum !== null) texts.push(`P. Ord ${subNum}`);
        texts.push('P. Ord', 'POrd');
      } else if (upper.includes('SEM')) {
        if (subNum !== null) texts.push(`Sem. ${subNum}`);
        texts.push('Seminario', 'Sem.');
      }
      const subKey = extractSubgroupKey(raw);
      if (subKey && !texts.includes(subKey)) {
        texts.push(subKey);
      }
      if (subNum !== null && !texts.includes(String(subNum))) {
        texts.push(String(subNum));
      }
      const cleaned = raw.replace(/[.\-,\s]/g, '');
      if (cleaned && !texts.includes(cleaned)) {
        texts.push(cleaned);
      }
    }

    const uniqueTexts = Array.from(new Set(texts));
    for (const text of uniqueTexts) {
      for (const style of BADGE_STYLES) {
        if (measureText(text, style.font, '800') + style.padX * 2 <= availWidth) {
          const height = Math.round(style.font * 1.1) + style.padY * 2 + style.mb;
          badgeCandidates.push({
            hide: false,
            text,
            font: style.font,
            padding: `${style.padY}px ${style.padX}px`,
            lineHeight: 1.1,
            height,
          });
          break;
        }
      }
    }
  }

  const bestBadge = badgeCandidates[0] || null;
  const hiddenBadge = { hide: true, height: 0, text: '', font: 0 };

  // 2. Room candidate options - genera opciones con distintos tamaños de fuente
  // para que si hay compresión vertical, el aula reduzca su fuente antes de desaparecer
  const roomCandidates = [];
  if (lesson.rooms?.[0]) {
    const texts = getRoomCandidates(lesson.rooms[0]);
    const baseFonts = isDayView ? [12, 11, 10, 9, 8] : [10, 9, 8, 7, 6.5];
    for (const font of baseFonts) {
      for (const text of texts) {
        if (measureText(text, font, '500') <= availWidth) {
          const height = Math.round(font * (font <= 8 ? 1.05 : 1.1)) + (blockHeight < 36 ? 0.5 : 1);
          roomCandidates.push({ show: true, text, font, height });
          break;
        }
      }
    }
  }
  const validRoomCandidates = roomCandidates.filter(r => r.show);
  const hiddenRoom = { show: false, height: 0, text: '', font: 0 };

  // 3. Teacher candidate options (Day View)
  const teacherCandidates = [];
  if (isDayView && lesson.teachers?.[0]) {
    const formatted = formatTeacher(lesson.teachers[0]);
    const tTexts = getTeacherCandidates(formatted);
    const baseTeacherFonts = [11.5, 11, 10.5, 10, 9.5, 9, 8.5];

    // Find the preferred text representation that fits within availWidth
    let chosenText = null;
    for (const text of tTexts) {
      if (baseTeacherFonts.some(f => measureText(text, f, '600') <= availWidth)) {
        chosenText = text;
        break;
      }
    }

    if (chosenText) {
      for (const font of baseTeacherFonts) {
        if (measureText(chosenText, font, '600') <= availWidth) {
          const height = Math.round(font * 1.1) + 2;
          teacherCandidates.push({ show: true, text: chosenText, font, height });
        }
      }
    }
  }
  const validTeacherCandidates = teacherCandidates.filter(t => t.show);
  const hiddenTeacher = { show: false, height: 0, text: '', font: 0 };

  // Control de visibilidad física para asegurar legibilidad
  const canTeacher = Boolean(validTeacherCandidates.length > 0 && blockHeight >= 44);
  const canRoom = validRoomCandidates.length > 0 && blockHeight >= (isDayView ? 24 : 20);
  const canBadge = Boolean(bestBadge && blockHeight >= (isMagistral ? (isDayView ? 55 : 45) : 18));

  const attempts = [];
  if (isMagistral) {
    // CLASES MAGISTRALES / GA: El Aula tiene PRIORIDAD ABSOLUTA frente a la insignia
    // 1. Todo completo (si cabe de sobra)
    if (canBadge && canRoom && canTeacher) {
      attempts.push({ allowBadge: true, allowRoom: true, allowTeacher: true });
    }
    // 2. Badge + Aula
    if (canBadge && canRoom) {
      attempts.push({ allowBadge: true, allowRoom: true, allowTeacher: false });
    }
    // 3. Aula + Profesor (el badge desaparece primero)
    if (canRoom && canTeacher) {
      attempts.push({ allowBadge: false, allowRoom: true, allowTeacher: true });
    }
    // 4. Aula SOLA (el aula persiste ante la falta de espacio)
    if (canRoom) {
      attempts.push({ allowBadge: false, allowRoom: true, allowTeacher: false });
    }
    // 5. Badge + Profesor (cuando no hay aula asignada en los datos)
    if (canBadge && canTeacher) {
      attempts.push({ allowBadge: true, allowRoom: false, allowTeacher: true });
    }
    // 6. Badge solo (por si no hubiera aula asignada en los datos)
    if (canBadge) {
      attempts.push({ allowBadge: true, allowRoom: false, allowTeacher: false });
    }
    // 7. Profesor solo (por si no hubiera aula ni badge)
    if (canTeacher) {
      attempts.push({ allowBadge: false, allowRoom: false, allowTeacher: true });
    }
    // 8. Solo asignatura
    attempts.push({ allowBadge: false, allowRoom: false, allowTeacher: false });
  } else {
    // SUBGRUPOS (PL, S, GL, GO, Seminarios...): La Insignia de subgrupo tiene PRIORIDAD MÁXIMA
    // 1. Todo completo
    if (canBadge && canRoom && canTeacher) {
      attempts.push({ allowBadge: true, allowRoom: true, allowTeacher: true });
    }
    // 2. Badge + Aula
    if (canBadge && canRoom) {
      attempts.push({ allowBadge: true, allowRoom: true, allowTeacher: false });
    }
    // 3. Badge + Profesor
    if (canBadge && canTeacher) {
      attempts.push({ allowBadge: true, allowRoom: false, allowTeacher: true });
    }
    // 4. Badge SOLO (¡Prioridad absoluta! Se mantiene el subgrupo y desaparece el aula)
    if (canBadge) {
      attempts.push({ allowBadge: true, allowRoom: false, allowTeacher: false });
    }
    // 5. Aula + Profesor (si no hubo badge)
    if (canRoom && canTeacher) {
      attempts.push({ allowBadge: false, allowRoom: true, allowTeacher: true });
    }
    // 6. Aula SOLA
    if (canRoom) {
      attempts.push({ allowBadge: false, allowRoom: true, allowTeacher: false });
    }
    // 7. Profesor solo (si no hubo badge ni aula)
    if (canTeacher) {
      attempts.push({ allowBadge: false, allowRoom: false, allowTeacher: true });
    }
    // 8. Solo asignatura
    attempts.push({ allowBadge: false, allowRoom: false, allowTeacher: false });
  }

  // 4. Subject candidate options
  const fullName = lesson.subjects?.[0] || '';
  const tiers = buildSubjectTiers(fullName, lesson);

  // Proceso iterativo: probar combinaciones de elementos secundarios en orden de prioridad,
  // y para cada una alternar proporcionalmente la reducción de asignatura, aula y profesor.
  for (const attempt of attempts) {
    const curBadge = attempt.allowBadge && bestBadge ? bestBadge : hiddenBadge;
    const curBadgeHeight = curBadge.height;

    const candidateTeachers = attempt.allowTeacher && validTeacherCandidates.length > 0 ? validTeacherCandidates : [hiddenTeacher];
    const candidateRooms = attempt.allowRoom && validRoomCandidates.length > 0 ? validRoomCandidates : [hiddenRoom];

    for (const tier of tiers) {
      const fonts = isDayView
        ? [14, 13, 12, 11, 10]
        : (tier.isStacked ? [10, 9, 8] : [11, 10, 9, 8]);

      const steps = generateAlternatingSteps(fonts.length, candidateRooms.length, candidateTeachers.length);

      for (const step of steps) {
        const font = fonts[step.s];
        const roomCandidate = candidateRooms[step.r];
        const teacherCandidate = candidateTeachers[step.t];

        const roomHeight = roomCandidate.height;
        const curTeacherHeight = teacherCandidate.height;
        const remainingHeight = availHeight - curBadgeHeight - roomHeight - curTeacherHeight;

        if (remainingHeight < 10) {
          continue;
        }

        let lines = null;
        if (tier.isStacked) {
          if (tier.words.every(l => measureText(l, font, '700', 0.01) <= availWidth - (isDayView ? 2 : 0))) {
            lines = tier.words;
          }
        } else {
          lines = wrapWords(tier.words, font, availWidth, remainingHeight, isDayView);
        }
        if (!lines) continue;

        const lineHeight = font >= 11 ? 1.14 : 1.1;
        const subjectHeight = lines.length * Math.round(font * lineHeight);

        if (subjectHeight <= remainingHeight + 1) {
          return {
            padding,
            badge: curBadge,
            room: roomCandidate,
            teacher: teacherCandidate,
            subject: { mode: 'lines', lines, font, lineHeight, tier: tier.name },
            totalHeight: curBadgeHeight + roomHeight + curTeacherHeight + subjectHeight,
          };
        }
      }
    }
  }

  // Fallback garantizado: si hay subgrupo, priorizamos la insignia; si es magistral, priorizamos el aula
  const fallbackTier = tiers.find(t => t.isSiglas) || tiers[tiers.length - 1] || { words: [fullName.slice(0, 10)] };
  const fallbackFont = isDayView ? 11 : 9;

  let fallbackBadge = hiddenBadge;
  let fallbackRoom = hiddenRoom;

  const mostCompactRoom = validRoomCandidates.length > 0 
    ? validRoomCandidates[validRoomCandidates.length - 1] 
    : null;

  if (isMagistral) {
    if (canRoom && mostCompactRoom && blockHeight >= 22) {
      fallbackRoom = mostCompactRoom;
    } else if (canBadge && bestBadge) {
      fallbackBadge = bestBadge;
    }
  } else {
    if (canBadge && bestBadge) {
      fallbackBadge = bestBadge;
    } else if (canRoom && mostCompactRoom && blockHeight >= 22) {
      fallbackRoom = mostCompactRoom;
    }
  }

  return {
    padding,
    badge: fallbackBadge,
    room: fallbackRoom,
    teacher: { show: false, height: 0, text: '', font: 0 },
    subject: {
      mode: 'lines',
      lines: fallbackTier.words,
      font: fallbackFont,
      lineHeight: 1.1,
      tier: fallbackTier.name || 'fallback',
    },
    totalHeight: availHeight,
  };
}

const START_MINUTES = 7 * 60 + 30; // 7:30 AM
const END_MINUTES = 22 * 60;       // 22:00 PM
const DEFAULT_SLOT_HEIGHT = 80;    // px per hour
const MIN_SLOT_HEIGHT = 38;        // Compact view
const MAX_SLOT_HEIGHT = 140;       // Expanded view
const TOTAL_HOURS = (END_MINUTES - START_MINUTES) / 60;

function toMinutes(t) {
  return Math.floor(t / 100) * 60 + (t % 100);
}

function minutesSinceStart(t, startMin = START_MINUTES) {
  return toMinutes(t) - startMin;
}

export function getTimeInterval(slotHeight) {
  if (slotHeight >= 115) return 15;
  if (slotHeight >= 55) return 30;
  return 60;
}

export function getGridLines(slotHeight, interval, startMinutes = START_MINUTES, endMinutes = END_MINUTES) {
  const lines = [];
  const remainder = startMinutes % interval;
  const firstMinute = remainder === 0 ? startMinutes : startMinutes + (interval - remainder);

  for (let m = firstMinute; m <= endMinutes; m += interval) {
    const top = ((m - startMinutes) / 60) * slotHeight;
    const isHour = m % 60 === 0;
    const isHalf = !isHour && m % 30 === 0;
    const type = isHour ? 'hour' : (isHalf ? 'half' : 'quarter');
    lines.push({ minute: m, top, isHour, isHalf, type });
  }
  return lines;
}

export function getTimeLabels(slotHeight, interval, startMinutes = START_MINUTES, endMinutes = END_MINUTES) {
  const labels = [];
  const startMinute = Math.ceil(startMinutes / 60) * 60;
  const endMinute = endMinutes > 1320 ? Math.floor(endMinutes / 60) * 60 : 21 * 60;

  for (let m = startMinute; m <= endMinute; m += interval) {
    const top = ((m - startMinutes) / 60) * slotHeight;
    const isHour = m % 60 === 0;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const text = `${h}:${mm < 10 ? '0' + mm : mm}`;
    labels.push({ minute: m, top, isMajor: isHour, text });
  }
  return labels;
}

function arrangeColumns(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) return new Map();
  const valid = lessons.filter(l => l && typeof l.startTime === 'number' && typeof l.endTime === 'number');
  if (valid.length === 0) return new Map();

  const sorted = [...valid].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return b.endTime - a.endTime; // Longer first
  });

  const clusters = [];
  let currentCluster = [];
  let clusterEnd = 0;

  for (const lesson of sorted) {
    const startMins = toMinutes(lesson.startTime);
    const endMins = toMinutes(lesson.endTime);
    if (currentCluster.length === 0) {
      currentCluster.push(lesson);
      clusterEnd = endMins;
    } else if (startMins < clusterEnd) {
      currentCluster.push(lesson);
      clusterEnd = Math.max(clusterEnd, endMins);
    } else {
      clusters.push(currentCluster);
      currentCluster = [lesson];
      clusterEnd = endMins;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result = new Map();

  for (const cluster of clusters) {
    const columns = [];
    for (const lesson of cluster) {
      let placed = false;
      for (const col of columns) {
        const lastInCol = col[col.length - 1];
        if (toMinutes(lastInCol.endTime) <= toMinutes(lesson.startTime)) {
          col.push(lesson);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([lesson]);
    }

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      for (const lesson of columns[colIdx]) {
        let span = 1;
        for (let nextColIdx = colIdx + 1; nextColIdx < columns.length; nextColIdx++) {
          const hasOverlap = columns[nextColIdx].some(other => {
            return toMinutes(other.startTime) < toMinutes(lesson.endTime) &&
                   toMinutes(other.endTime) > toMinutes(lesson.startTime);
          });
          if (!hasOverlap) {
            span++;
          } else {
            break;
          }
        }
        result.set(lesson.id, {
          colIdx,
          span,
          total: columns.length,
        });
      }
    }
  }
  return result;
}

// ─── Touch / swipe handling ──────────────────────────────────────────────────
const SWIPE_MIN_DISTANCE = 42;
const SWIPE_MAX_OFF_AXIS = 70;
const SWIPE_MAX_DURATION = 700;
const SWIPE_DOMINANCE_RATIO = 1.35;

const getPrevDay = (d) => {
  if (!d) return new Date();
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  if (prev.getDay() === 0) prev.setDate(prev.getDate() - 2);
  else if (prev.getDay() === 6) prev.setDate(prev.getDate() - 1);
  return prev;
};

const getNextDay = (d) => {
  if (!d) return new Date();
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  if (next.getDay() === 6) next.setDate(next.getDate() + 2);
  else if (next.getDay() === 0) next.setDate(next.getDate() + 1);
  return next;
};

const getPrevWeek = (dates) => {
  if (!Array.isArray(dates)) return [];
  return dates.map(d => {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 7);
    return prev;
  });
};

const getNextWeek = (dates) => {
  if (!Array.isArray(dates)) return [];
  return dates.map(d => {
    const next = new Date(d);
    next.setDate(next.getDate() + 7);
    return next;
  });
};

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const DEFAULT_FIT = {
  padding: '2px 4px',
  badge: { hide: true, height: 0, text: '', font: 8 },
  room: { show: false, text: '', font: 8 },
  teacher: { show: false, text: '', font: 8 },
  subject: { mode: 'lines', lines: [''], font: 10, lineHeight: 1.1 },
  totalHeight: 40,
};

const layoutCache = new Map();

export function computeBlockLayoutMemo(lesson, blockWidth, blockHeight, isDayView) {
  if (!lesson) return DEFAULT_FIT;
  const roundedW = Math.round(blockWidth || 60);
  const roundedH = Math.round(blockHeight || 80);
  const key = `${lesson.id || 0}_${roundedW}_${roundedH}_${isDayView ? 1 : 0}_${lesson.type || ''}_${lesson.rooms?.[0] || ''}`;
  if (layoutCache.has(key)) {
    return layoutCache.get(key);
  }
  try {
    const result = computeBlockLayout(lesson, blockWidth, blockHeight, isDayView) || DEFAULT_FIT;
    if (layoutCache.size > 2000) layoutCache.clear();
    layoutCache.set(key, result);
    return result;
  } catch (e) {
    return DEFAULT_FIT;
  }
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

const WeekCalendar = forwardRef(function WeekCalendar({
  lessons,
  customColors,
  onLessonClick,
  weekDates,
  onSwipeLeft,
  onSwipeRight,
  isDayView: propIsDayView,
  selectedDay,
  isDark,
  canSwipeNext,
  canSwipePrev,
}, ref) {
  const calendarScrollRef = useRef(null);
  const pinchRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const daysTrackRef = useRef(null);
  const currentTimeOverlayRef = useRef(null);
  const swipeDragRef = useRef(null);
  const isSlidingRef = useRef(false);
  const [slidePlan, setSlidePlan] = useState(null); // { dir: 'next' | 'prev', dates: Date[], targetDayIdx: number, onComplete: () => void, isMounted: boolean }
  const [slotHeight, setSlotHeight] = useState(DEFAULT_SLOT_HEIGHT);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.max(200, window.innerWidth - 52);
    }
    return 360;
  });

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    const timer = setInterval(updateNow, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateNow();
      }
    };
    window.addEventListener('focus', updateNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeLeftRef.current = onSwipeLeft;
  onSwipeRightRef.current = onSwipeRight;

  const canSwipeNextRef = useRef(canSwipeNext !== false);
  const canSwipePrevRef = useRef(canSwipePrev !== false);
  canSwipeNextRef.current = canSwipeNext !== false;
  canSwipePrevRef.current = canSwipePrev !== false;

  const isDayView = propIsDayView !== undefined ? propIsDayView : (weekDates.length === 1);
  const isDayViewRef = useRef(isDayView);
  isDayViewRef.current = isDayView;

  // Track selected day index in the current week (0 to 4)
  const selectedDateObj = isDayView ? (selectedDay || weekDates[0]) : null;
  const selectedDayIndex = selectedDateObj ? ((selectedDateObj.getDay() + 6) % 7) : -1;
  const selectedDayIndexRef = useRef(selectedDayIndex);
  selectedDayIndexRef.current = selectedDayIndex;

  // Track container width for synchronous column width calculation
  useEffect(() => {
    const el = calendarScrollRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth - 52; // subtract sticky time-col width
      if (w > 50) {
        setContainerWidth(w);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resetZoom = useCallback(() => {
    if (slotHeight === DEFAULT_SLOT_HEIGHT) return;
    const el = calendarScrollRef.current;
    if (el) {
      el.scrollTop = (el.scrollTop / slotHeight) * DEFAULT_SLOT_HEIGHT;
    }
    try {
      localStorage.setItem('ehuntis_slot_height', String(DEFAULT_SLOT_HEIGHT));
    } catch (e) {}
    setSlotHeight(DEFAULT_SLOT_HEIGHT);
  }, [slotHeight]);

  // Load saved zoom preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ehuntis_slot_height');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= MIN_SLOT_HEIGHT && val <= MAX_SLOT_HEIGHT) {
          setSlotHeight(val);
        }
      }
    } catch (e) {}
  }, []);

  const getPanels = useCallback(() => {
    const daysTrackEl = daysTrackRef.current;
    const prevPanel = daysTrackEl?.querySelector('.days-panel.panel-prev');
    const currPanel = daysTrackEl?.querySelector('.days-panel.panel-current');
    const nextPanel = daysTrackEl?.querySelector('.days-panel.panel-next');

    const headerTrackEl = typeof document !== 'undefined' ? document.querySelector('.week-nav-track') : null;
    const prevHeader = headerTrackEl?.querySelector('.week-nav-panel.panel-prev');
    const currHeader = headerTrackEl?.querySelector('.week-nav-panel.panel-current');
    const nextHeader = headerTrackEl?.querySelector('.week-nav-panel.panel-next');
    const thumbEl = typeof document !== 'undefined' ? document.querySelector('.week-day-indicator-thumb') : null;
    const currentTimeOverlayEl = currentTimeOverlayRef.current;
    const prevTimePanel = currentTimeOverlayEl?.querySelector('.current-time-panel.panel-prev');
    const currTimePanel = currentTimeOverlayEl?.querySelector('.current-time-panel.panel-current');
    const nextTimePanel = currentTimeOverlayEl?.querySelector('.current-time-panel.panel-next');

    return {
      daysTrackEl,
      prevPanel,
      currPanel,
      nextPanel,
      headerTrackEl,
      prevHeader,
      currHeader,
      nextHeader,
      thumbEl,
      currentTimeOverlayEl,
      prevTimePanel,
      currTimePanel,
      nextTimePanel,
    };
  }, []);

  // Helper: clear all inline drag styles from track + panels + header + thumb
  const clearDragStyles = useCallback(() => {
    const {
      daysTrackEl, prevPanel, currPanel, nextPanel,
      headerTrackEl, prevHeader, currHeader, nextHeader,
      thumbEl,
      currentTimeOverlayEl, prevTimePanel, currTimePanel, nextTimePanel
    } = getPanels();
    if (daysTrackEl) {
      daysTrackEl.style.transition = 'none';
      daysTrackEl.style.transform = 'translate3d(0, 0, 0)';
    }
    if (prevPanel) { prevPanel.style.transition = 'none'; prevPanel.style.opacity = ''; }
    if (currPanel) { currPanel.style.transition = 'none'; currPanel.style.opacity = ''; }
    if (nextPanel) { nextPanel.style.transition = 'none'; nextPanel.style.opacity = ''; }

    if (currentTimeOverlayEl) {
      currentTimeOverlayEl.classList.remove('is-moving');
      currentTimeOverlayEl.style.transition = 'none';
      currentTimeOverlayEl.style.transform = 'translate3d(0, 0, 0)';
      currentTimeOverlayEl.style.opacity = '';
    }
    if (prevTimePanel) { prevTimePanel.style.transition = 'none'; prevTimePanel.style.opacity = ''; }
    if (currTimePanel) { currTimePanel.style.transition = 'none'; currTimePanel.style.opacity = ''; }
    if (nextTimePanel) { nextTimePanel.style.transition = 'none'; nextTimePanel.style.opacity = ''; }

    if (headerTrackEl) {
      headerTrackEl.style.transition = 'none';
      headerTrackEl.style.transform = 'translate3d(0, 0, 0)';
    }
    if (prevHeader) { prevHeader.style.transition = 'none'; prevHeader.style.opacity = ''; }
    if (currHeader) { currHeader.style.transition = 'none'; currHeader.style.opacity = ''; }
    if (nextHeader) { nextHeader.style.transition = 'none'; nextHeader.style.opacity = ''; }

    if (thumbEl && isDayViewRef.current) {
      const currentIdx = selectedDayIndexRef.current;
      if (currentIdx >= 0) {
        thumbEl.style.transition = 'none';
        thumbEl.style.transform = `translate3d(${currentIdx * 100}%, 0, 0)`;
      }
    }
  }, [getPanels]);

  // Step 1: When slidePlan is set, React renders the target panel. useIsomorphicLayoutEffect starts the animation.
  useIsomorphicLayoutEffect(() => {
    if (!slidePlan || !slidePlan.isMounted) return;

    const { dir, targetDayIdx, onComplete } = slidePlan;
    const isNext = dir === 'next';
    const targetX = isNext ? '-100%' : '100%';

    const {
      daysTrackEl, prevPanel, currPanel, nextPanel,
      headerTrackEl, prevHeader, currHeader, nextHeader,
      thumbEl,
      currentTimeOverlayEl, prevTimePanel, currTimePanel, nextTimePanel
    } = getPanels();

    if (daysTrackEl) {
      daysTrackEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      daysTrackEl.style.transform = `translate3d(${targetX}, 0, 0)`;
    }
    if (currPanel) {
      currPanel.style.transition = 'opacity 0.24s ease';
      currPanel.style.opacity = '0';
    }
    if (currentTimeOverlayEl) {
      currentTimeOverlayEl.classList.add('is-moving');
      currentTimeOverlayEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      currentTimeOverlayEl.style.transform = `translate3d(${targetX}, 0, 0)`;
    }
    if (currTimePanel) {
      currTimePanel.style.transition = 'opacity 0.24s ease';
      currTimePanel.style.opacity = '0';
    }
    if (isNext && nextTimePanel) {
      nextTimePanel.style.transition = 'opacity 0.24s ease';
      nextTimePanel.style.opacity = '1';
    }
    if (!isNext && prevTimePanel) {
      prevTimePanel.style.transition = 'opacity 0.24s ease';
      prevTimePanel.style.opacity = '1';
    }
    if (isNext && nextPanel) {
      nextPanel.style.transition = 'opacity 0.24s ease';
      nextPanel.style.opacity = '1';
    }
    if (!isNext && prevPanel) {
      prevPanel.style.transition = 'opacity 0.24s ease';
      prevPanel.style.opacity = '1';
    }

    if (headerTrackEl && !isDayViewRef.current) {
      headerTrackEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      headerTrackEl.style.transform = `translate3d(${targetX}, 0, 0)`;
      if (currHeader) {
        currHeader.style.transition = 'opacity 0.24s ease';
        currHeader.style.opacity = '0';
      }
      if (isNext && nextHeader) {
        nextHeader.style.transition = 'opacity 0.24s ease';
        nextHeader.style.opacity = '1';
      }
      if (!isNext && prevHeader) {
        prevHeader.style.transition = 'opacity 0.24s ease';
        prevHeader.style.opacity = '1';
      }
    }

    if (thumbEl && isDayViewRef.current) {
      if (targetDayIdx >= 0 && targetDayIdx < 5) {
        thumbEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        thumbEl.style.transform = `translate3d(${targetDayIdx * 100}%, 0, 0)`;
      }
    }

    const timer = setTimeout(() => {
      isSlidingRef.current = false;
      onComplete?.();
    }, 245);

    return () => {
      clearTimeout(timer);
    };
  }, [slidePlan, getPanels]);

  // Step 2: Whenever weekDates or selectedDay changes, reset all drag styles and clear sliding flags
  useIsomorphicLayoutEffect(() => {
    clearDragStyles();
    isSlidingRef.current = false;
    setSlidePlan(null);
  }, [weekDates, selectedDay, clearDragStyles]);

  // Imperative handle for arrow button clicks, date picker jumps & keyboard navigation
  useImperativeHandle(ref, () => ({
    isSliding: () => Boolean(isSlidingRef.current),

    triggerSlideTo: (targetDates, onComplete) => {
      if (isSlidingRef.current || !targetDates || targetDates.length === 0) {
        return false;
      }
      isSlidingRef.current = true;

      const baseDate = weekDates[0];
      const targetDate = targetDates[0];
      const isNext = targetDate.getTime() >= baseDate.getTime();
      const dir = isNext ? 'next' : 'prev';
      const targetDayIdx = (targetDate.getDay() + 6) % 7;

      // Set slidePlan. React will render targetDates into the incoming panel first,
      // and useLayoutEffect above will initiate the hardware animation immediately.
      setSlidePlan({
        dir,
        dates: targetDates,
        targetDayIdx,
        onComplete,
        isMounted: true,
      });
      return true;
    },

    triggerSlide: (direction, onComplete) => {
      if (isSlidingRef.current) return;
      const isNext = direction === 'next';
      const targetDates = isDayViewRef.current
        ? [isNext ? getNextDay(weekDates[0]) : getPrevDay(weekDates[0])]
        : (isNext ? getNextWeek(weekDates) : getPrevWeek(weekDates));

      if (ref.current?.triggerSlideTo) {
        ref.current.triggerSlideTo(targetDates, onComplete);
      } else {
        onComplete?.();
      }
    }
  }), [weekDates]);

  // Unified touch gestures: Pinch-to-zoom (2 fingers) & 1:1 real-time swipe (1 finger)
  useEffect(() => {
    const el = calendarScrollRef.current;
    if (!el) return;

    // ─── SINGLE-FINGER DRAG ──────────────────────────────────
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Two fingers: init pinch zoom, cancel any ongoing swipe
        swipeDragRef.current = null;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchRef.current = {
          startDistX: Math.abs(t1.clientX - t2.clientX),
          startDistY: Math.max(Math.abs(t1.clientY - t2.clientY), 15),
          startSlotHeight: slotHeight,
          startScrollTop: el.scrollTop,
          isPinching: false,
          gestureType: null,
        };
        return;
      }

      if (e.touches.length !== 1 || pinchRef.current?.isPinching || isSlidingRef.current) return;

      clearDragStyles();

      const t = e.touches[0];
      swipeDragRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        startTime: Date.now(),
        lastX: t.clientX,
        dragOffset: 0,
        direction: 'none',
      };
    };

    const onTouchMove = (e) => {
      // ── Pinch zoom ──
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDistX = Math.abs(t1.clientX - t2.clientX);
        const currentDistY = Math.abs(t1.clientY - t2.clientY);

        if (!pinchRef.current.gestureType) {
          const deltaX = Math.abs(currentDistX - pinchRef.current.startDistX);
          const deltaY = Math.abs(currentDistY - pinchRef.current.startDistY);
          if (deltaX >= 5 || deltaY >= 5) {
            pinchRef.current.gestureType = (deltaY >= deltaX * 1.2 && pinchRef.current.startDistY >= 25)
              ? 'vertical' : 'ignored';
            if (pinchRef.current.gestureType === 'vertical') pinchRef.current.isPinching = true;
          }
          return;
        }

        if (pinchRef.current.gestureType === 'vertical') {
          const scale = currentDistY / pinchRef.current.startDistY;
          const targetHeight = Math.min(MAX_SLOT_HEIGHT, Math.max(MIN_SLOT_HEIGHT,
            Math.round(pinchRef.current.startSlotHeight * scale)));
          setSlotHeight(prev => {
            if (prev !== targetHeight) {
              el.scrollTop = (pinchRef.current.startScrollTop / pinchRef.current.startSlotHeight) * targetHeight;
              return targetHeight;
            }
            return prev;
          });
        }
        return;
      }

      // ── Single-finger drag ──
      if (e.touches.length !== 1 || !swipeDragRef.current || pinchRef.current?.isPinching) return;

      const drag = swipeDragRef.current;
      const t = e.touches[0];
      const dx = t.clientX - drag.startX;
      const dy = t.clientY - drag.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Determine swipe direction after 6px of movement
      if (drag.direction === 'none' && (absX >= 6 || absY >= 6)) {
        drag.direction = (absX >= absY * 1.1) ? 'horizontal' : 'vertical';
      }

      if (drag.direction !== 'horizontal') return;

      // Prevent vertical scroll during horizontal swipe
      e.preventDefault();
      drag.lastX = t.clientX;
      drag.dragOffset = dx;

      const {
        daysTrackEl, prevPanel, currPanel, nextPanel,
        headerTrackEl, prevHeader, currHeader, nextHeader,
        thumbEl,
        currentTimeOverlayEl, prevTimePanel, currTimePanel, nextTimePanel
      } = getPanels();
      const viewportWidth = el.clientWidth || 360;
      const progress = Math.min(1, absX / (viewportWidth * 0.7));

      if (daysTrackEl) {
        daysTrackEl.style.transition = 'none';
        daysTrackEl.style.transform = `translate3d(${dx}px, 0, 0)`;

        // Outgoing panel loses opacity
        const currOpacity = Math.max(0.15, 1 - progress * 0.85);
        if (currPanel) {
          currPanel.style.transition = 'none';
          currPanel.style.opacity = String(currOpacity);
        }
        if (currentTimeOverlayEl) {
          currentTimeOverlayEl.classList.add('is-moving');
          currentTimeOverlayEl.style.transition = 'none';
          currentTimeOverlayEl.style.transform = `translate3d(${dx}px, 0, 0)`;
        }
        if (currTimePanel) {
          currTimePanel.style.transition = 'none';
          currTimePanel.style.opacity = String(currOpacity);
        }

        // Incoming panel gains opacity
        if (dx < 0) {
          const nextOpacity = Math.min(1, 0.2 + progress * 0.8);
          if (nextPanel) {
            nextPanel.style.transition = 'none';
            nextPanel.style.opacity = String(nextOpacity);
          }
          if (nextTimePanel) {
            nextTimePanel.style.transition = 'none';
            nextTimePanel.style.opacity = String(nextOpacity);
          }
          if (prevPanel) {
            prevPanel.style.transition = 'none';
            prevPanel.style.opacity = '0.2';
          }
          if (prevTimePanel) {
            prevTimePanel.style.transition = 'none';
            prevTimePanel.style.opacity = '0';
          }
        } else {
          const prevOpacity = Math.min(1, 0.2 + progress * 0.8);
          if (prevPanel) {
            prevPanel.style.transition = 'none';
            prevPanel.style.opacity = String(prevOpacity);
          }
          if (prevTimePanel) {
            prevTimePanel.style.transition = 'none';
            prevTimePanel.style.opacity = String(prevOpacity);
          }
          if (nextPanel) {
            nextPanel.style.transition = 'none';
            nextPanel.style.opacity = '0.2';
          }
          if (nextTimePanel) {
            nextTimePanel.style.transition = 'none';
            nextTimePanel.style.opacity = '0';
          }
        }
      }

      // In Week View: header track moves 1:1 and panels fade simultaneously
      // In Day View: header track stays fixed and static
      if (headerTrackEl && !isDayViewRef.current) {
        headerTrackEl.style.transition = 'none';
        headerTrackEl.style.transform = `translate3d(${dx}px, 0, 0)`;

        const currOpacity = Math.max(0.15, 1 - progress * 0.85);
        if (currHeader) {
          currHeader.style.transition = 'none';
          currHeader.style.opacity = String(currOpacity);
        }
        if (dx < 0) {
          const nextOpacity = Math.min(1, 0.2 + progress * 0.8);
          if (nextHeader) {
            nextHeader.style.transition = 'none';
            nextHeader.style.opacity = String(nextOpacity);
          }
          if (prevHeader) {
            prevHeader.style.transition = 'none';
            prevHeader.style.opacity = '0.2';
          }
        } else {
          const prevOpacity = Math.min(1, 0.2 + progress * 0.8);
          if (prevHeader) {
            prevHeader.style.transition = 'none';
            prevHeader.style.opacity = String(prevOpacity);
          }
          if (nextHeader) {
            nextHeader.style.transition = 'none';
            nextHeader.style.opacity = '0.2';
          }
        }
      }

      // In Day View: blue circle thumb glides in real-time with finger
      if (thumbEl && isDayViewRef.current) {
        const currentIdx = selectedDayIndexRef.current;
        const dragRatio = (dx / viewportWidth);
        const targetPercent = (currentIdx * 100) - (dragRatio * 100);
        thumbEl.style.transition = 'none';
        thumbEl.style.transform = `translate3d(${targetPercent}%, 0, 0)`;
      }
    };

    const onTouchEnd = (e) => {
      // ── End pinch zoom ──
      if (pinchRef.current && e.touches.length < 2) {
        const wasVertical = pinchRef.current.gestureType === 'vertical';
        pinchRef.current = null;
        if (wasVertical) {
          setSlotHeight(current => {
            try { localStorage.setItem('ehuntis_slot_height', String(current)); } catch (_) {}
            return current;
          });
        }
        return;
      }

      // ── End single-finger drag ──
      if (!swipeDragRef.current) return;
      const drag = swipeDragRef.current;
      swipeDragRef.current = null;

      // ── Horizontal drag: decide commit or snap-back ──
      if (drag.direction === 'horizontal' && Math.abs(drag.dragOffset) > 0) {
        const elapsed = Date.now() - drag.startTime;
        const absOffset = Math.abs(drag.dragOffset);
        const velocity = absOffset / Math.max(elapsed, 1);

        let shouldCommit = false;
        if (elapsed < 320 && velocity > 0.45 && absOffset >= 25) {
          shouldCommit = true;
        } else if (elapsed < 420 && velocity > 0.28 && absOffset >= 45) {
          shouldCommit = true;
        } else if (absOffset >= 70) {
          shouldCommit = true;
        }

        const {
          daysTrackEl, prevPanel, currPanel, nextPanel,
          headerTrackEl, prevHeader, currHeader, nextHeader,
          thumbEl,
          currentTimeOverlayEl, prevTimePanel, currTimePanel, nextTimePanel
        } = getPanels();

        if (shouldCommit) {
          const isNext = drag.dragOffset < 0;
          // Respect academic year bounds — if the direction is blocked, snap back instead
          if ((isNext && !canSwipeNextRef.current) || (!isNext && !canSwipePrevRef.current)) {
            shouldCommit = false;
          }
        }

        if (shouldCommit) {
          isSlidingRef.current = true;
          const isNext = drag.dragOffset < 0;
          const targetX = isNext ? '-100%' : '100%';

          if (daysTrackEl) {
            daysTrackEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
            daysTrackEl.style.transform = `translate3d(${targetX}, 0, 0)`;
          }
          if (currPanel) {
            currPanel.style.transition = 'opacity 0.22s ease';
            currPanel.style.opacity = '0';
          }
          if (currentTimeOverlayEl) {
            currentTimeOverlayEl.classList.add('is-moving');
            currentTimeOverlayEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
            currentTimeOverlayEl.style.transform = `translate3d(${targetX}, 0, 0)`;
          }
          if (currTimePanel) {
            currTimePanel.style.transition = 'opacity 0.22s ease';
            currTimePanel.style.opacity = '0';
          }
          if (isNext && nextTimePanel) {
            nextTimePanel.style.transition = 'opacity 0.22s ease';
            nextTimePanel.style.opacity = '1';
          }
          if (!isNext && prevTimePanel) {
            prevTimePanel.style.transition = 'opacity 0.22s ease';
            prevTimePanel.style.opacity = '1';
          }
          if (isNext && nextPanel) {
            nextPanel.style.transition = 'opacity 0.22s ease';
            nextPanel.style.opacity = '1';
          }
          if (!isNext && prevPanel) {
            prevPanel.style.transition = 'opacity 0.22s ease';
            prevPanel.style.opacity = '1';
          }

          if (headerTrackEl && !isDayViewRef.current) {
            headerTrackEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
            headerTrackEl.style.transform = `translate3d(${targetX}, 0, 0)`;
            if (currHeader) {
              currHeader.style.transition = 'opacity 0.22s ease';
              currHeader.style.opacity = '0';
            }
            if (isNext && nextHeader) {
              nextHeader.style.transition = 'opacity 0.22s ease';
              nextHeader.style.opacity = '1';
            }
            if (!isNext && prevHeader) {
              prevHeader.style.transition = 'opacity 0.22s ease';
              prevHeader.style.opacity = '1';
            }
          }

          if (thumbEl && isDayViewRef.current) {
            const currentIdx = selectedDayIndexRef.current;
            if (currentIdx >= 0) {
              const targetIdx = isNext ? currentIdx + 1 : currentIdx - 1;
              thumbEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
              thumbEl.style.transform = `translate3d(${targetIdx * 100}%, 0, 0)`;
            }
          }

          setTimeout(() => {
            if (isNext) onSwipeLeftRef.current?.();
            else onSwipeRightRef.current?.();
          }, 225);
          return;
        }

        // Cancel: Snap back smoothly to 0 with opacities restoring
        if (daysTrackEl) {
          daysTrackEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
          daysTrackEl.style.transform = 'translate3d(0, 0, 0)';
        }
        if (currPanel) {
          currPanel.style.transition = 'opacity 0.24s ease';
          currPanel.style.opacity = '1';
        }
        if (currentTimeOverlayEl) {
          currentTimeOverlayEl.classList.add('is-moving');
          currentTimeOverlayEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
          currentTimeOverlayEl.style.transform = 'translate3d(0, 0, 0)';
        }
        if (currTimePanel) {
          currTimePanel.style.transition = 'opacity 0.24s ease';
          currTimePanel.style.opacity = '1';
        }
        if (nextTimePanel) {
          nextTimePanel.style.transition = 'opacity 0.24s ease';
          nextTimePanel.style.opacity = '0';
        }
        if (prevTimePanel) {
          prevTimePanel.style.transition = 'opacity 0.24s ease';
          prevTimePanel.style.opacity = '0';
        }
        if (nextPanel) {
          nextPanel.style.transition = 'opacity 0.24s ease';
          nextPanel.style.opacity = '0.2';
        }
        if (prevPanel) {
          prevPanel.style.transition = 'opacity 0.24s ease';
          prevPanel.style.opacity = '0.2';
        }

        if (headerTrackEl && !isDayViewRef.current) {
          headerTrackEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
          headerTrackEl.style.transform = 'translate3d(0, 0, 0)';
          if (currHeader) {
            currHeader.style.transition = 'opacity 0.24s ease';
            currHeader.style.opacity = '1';
          }
          if (nextHeader) {
            nextHeader.style.transition = 'opacity 0.24s ease';
            nextHeader.style.opacity = '0.2';
          }
          if (prevHeader) {
            prevHeader.style.transition = 'opacity 0.24s ease';
            prevHeader.style.opacity = '0.2';
          }
        }

        if (thumbEl && isDayViewRef.current) {
          const currentIdx = selectedDayIndexRef.current;
          if (currentIdx >= 0) {
            thumbEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
            thumbEl.style.transform = `translate3d(${currentIdx * 100}%, 0, 0)`;
          }
        }

        setTimeout(() => {
          clearDragStyles();
        }, 245);
        return;
      }

      // ── Double-tap detection ──
      const touchEndObj = e.changedTouches?.[0];
      if (!touchEndObj) return;
      const absX = Math.abs(touchEndObj.clientX - drag.startX);
      const absY = Math.abs(touchEndObj.clientY - drag.startY);
      const elapsed = Date.now() - drag.startTime;

      if (absX < 15 && absY < 15 && elapsed < 300) {
        const now = Date.now();
        const prevTap = lastTapRef.current;
        const timeDiff = now - prevTap.time;
        const distFromLast = Math.hypot(drag.startX - prevTap.x, drag.startY - prevTap.y);
        if (timeDiff > 40 && timeDiff < 320 && distFromLast < 35) {
          resetZoom();
          lastTapRef.current = { time: 0, x: 0, y: 0 };
          return;
        }
        lastTapRef.current = { time: now, x: drag.startX, y: drag.startY };
      } else {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      }
    };

    // Smooth Ctrl+Wheel zoom on desktop
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.001);
      setSlotHeight(prev => {
        const next = Math.min(MAX_SLOT_HEIGHT, Math.max(MIN_SLOT_HEIGHT, Math.round(prev * factor)));
        if (next !== prev) {
          el.scrollTop = (el.scrollTop / prev) * next;
          try { localStorage.setItem('ehuntis_slot_height', String(next)); } catch (_) {}
          return next;
        }
        return prev;
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [slotHeight, clearDragStyles, getPanels, resetZoom]);

  const visibleDayNumbers = useMemo(() => {
    return (weekDates || []).map(d => {
      if (!d) return 0;
      const dt = d instanceof Date ? d : new Date(d);
      return isNaN(dt.getTime()) ? 0 : dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
    }).filter(Boolean);
  }, [weekDates]);

  const { startMinutes, endMinutes, totalHours } = useMemo(() => {
    let minStart = 7 * 60 + 30; // 7:30 AM por defecto
    let maxEnd = 22 * 60;       // 22:00 PM por defecto

    const visibleLessons = (lessons || []).filter(l => l && visibleDayNumbers.includes(l.date));

    for (const l of visibleLessons) {
      if (typeof l.startTime === 'number') {
        const startM = toMinutes(l.startTime);
        if (startM < 8 * 60) {
          // Dejar margen de 30 min antes del evento más temprano
          const paddedStart = Math.floor((startM - 30) / 30) * 30;
          if (paddedStart < minStart) {
            minStart = Math.max(0, paddedStart);
          }
        }
      }
      if (typeof l.endTime === 'number') {
        const endM = toMinutes(l.endTime);
        if (endM > 21 * 60 + 30) {
          // Dejar margen de 30 min después del evento más tardío
          const paddedEnd = Math.ceil((endM + 30) / 30) * 30;
          if (paddedEnd > maxEnd) {
            maxEnd = Math.min(24 * 60, paddedEnd);
          }
        }
      }
    }

    return {
      startMinutes: minStart,
      endMinutes: maxEnd,
      totalHours: (maxEnd - minStart) / 60,
    };
  }, [lessons, visibleDayNumbers]);

  const totalHeight = totalHours * slotHeight;

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const todayNum = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const isTimeInRange = nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  const currentTimeTop = isTimeInRange ? ((nowMinutes - startMinutes) / 60) * slotHeight : null;

  // Compute 3 panels dates: previous, current, next
  const currentDates = weekDates;
  const prevDates = useMemo(() => {
    if (slidePlan && slidePlan.dir === 'prev') {
      return slidePlan.dates;
    }
    return isDayView ? [getPrevDay(weekDates[0])] : getPrevWeek(weekDates);
  }, [isDayView, weekDates, slidePlan]);

  const nextDates = useMemo(() => {
    if (slidePlan && slidePlan.dir === 'next') {
      return slidePlan.dates;
    }
    return isDayView ? [getNextDay(weekDates[0])] : getNextWeek(weekDates);
  }, [isDayView, weekDates, slidePlan]);

  // Adapt interval, grid lines, and time labels dynamically to vertical zoom and hours range
  const interval = useMemo(() => getTimeInterval(slotHeight), [slotHeight]);
  const gridLines = useMemo(() => getGridLines(slotHeight, interval, startMinutes, endMinutes), [slotHeight, interval, startMinutes, endMinutes]);
  const timeLabels = useMemo(() => getTimeLabels(slotHeight, interval, startMinutes, endMinutes), [slotHeight, interval, startMinutes, endMinutes]);

  // Assign distinct colors to the unique subjects in this week's timetable
  updateSubjectColors(lessons, customColors);

  const dayColWidth = isDayView ? (containerWidth || 360) : ((containerWidth || 360) / 5);

  // Helper to render columns for any panel (prev, current, next) with 100% precomputed layouts
  const renderDayColumns = (datesList, panelKey) => {
    if (!Array.isArray(datesList)) return null;

    // ── Supresión en cascada de badges magistrales (ámbito de la vista actual) ──
    let weekSuppressedMagistralIds = null;
    if (!isDayView) {
      let anyMissingInWeek = false;
      const allMagistralInWeek = [];
      for (const date of datesList) {
        if (!date) continue;
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) continue;
        const dateNum = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        const dayLessons = (lessons || []).filter(l => l && l.date === dateNum);
        const layout = arrangeColumns(dayLessons);
        for (const lesson of dayLessons) {
          if (!isMagistralType(lesson.type)) continue;
          allMagistralInWeek.push(lesson.id);
          const col = layout.get(lesson.id) || { colIdx: 0, total: 1, span: 1 };
          const startMin = minutesSinceStart(lesson.startTime, startMinutes);
          const endMin = minutesSinceStart(lesson.endTime, startMinutes);
          const height = Math.max(((endMin - startMin) / 60) * slotHeight - 2, 22);
          const blockWidth = Math.max(16, (dayColWidth / col.total) * col.span - 2);
          const fit = computeBlockLayoutMemo(lesson, blockWidth, height, false) || DEFAULT_FIT;
          if (fit.badge?.hide !== false) {
            anyMissingInWeek = true;
          }
        }
      }
      if (anyMissingInWeek) {
        weekSuppressedMagistralIds = new Set(allMagistralInWeek);
      }
    }

    return datesList.map((date, dayIdx) => {
      if (!date) return null;
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return null;
      const dateNum = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      const dayLessons = (lessons || []).filter(l => l && l.date === dateNum);
      const layout = arrangeColumns(dayLessons);
      const isToday = isSameDay(d, now);

      // En vista de día: evaluar cascada para el día actual
      let daySuppressedMagistralIds = null;
      if (isDayView) {
        const magistralLessons = dayLessons.filter(l => isMagistralType(l.type));
        if (magistralLessons.length > 0) {
          let anyMissingBadge = false;
          const magistralFits = magistralLessons.map(lesson => {
            const col = layout.get(lesson.id) || { colIdx: 0, total: 1, span: 1 };
            const startMin = minutesSinceStart(lesson.startTime, startMinutes);
            const endMin = minutesSinceStart(lesson.endTime, startMinutes);
            const height = Math.max(((endMin - startMin) / 60) * slotHeight - 2, 22);
            const blockWidth = Math.max(16, (dayColWidth / col.total) * col.span - 4);
            const fit = computeBlockLayoutMemo(lesson, blockWidth, height, true) || DEFAULT_FIT;
            if (fit.badge?.hide !== false) anyMissingBadge = true;
            return { id: lesson.id, hideBadge: fit.badge?.hide !== false };
          });
          if (anyMissingBadge) {
            daySuppressedMagistralIds = new Set(magistralFits.map(f => f.id));
          }
        }
      }

      const activeSuppressedIds = isDayView ? daySuppressedMagistralIds : weekSuppressedMagistralIds;

      return (
        <div key={dayIdx} className="day-col">
          <div
            className="day-col-inner"
            style={{ height: totalHeight + 'px' }}
          >

            {dayLessons.map((lesson, idx) => {
              const startMin = minutesSinceStart(lesson.startTime, startMinutes);
              const endMin = minutesSinceStart(lesson.endTime, startMinutes);
              const top = (startMin / 60) * slotHeight;
              const height = Math.max(((endMin - startMin) / 60) * slotHeight - 2, 22);
              const isPastLesson = dateNum < todayNum || (dateNum === todayNum && toMinutes(lesson.endTime) <= nowMinutes);

              const blockKey = `${lesson.id}-${idx}`;
              const col = layout.get(lesson.id) || { colIdx: 0, total: 1, span: 1 };
              const widthPct = 100 / col.total;
              const leftPct = col.colIdx * widthPct;

              const color = (lesson.isCustomEvent && typeof lesson.colorIndex === 'number')
                ? getSubjectColorStyle(lesson.colorIndex, isDark)
                : subjectColor(lesson.subjectIds?.[0] || 0, isDark);
              const blockWidth = Math.max(16, (dayColWidth / col.total) * col.span - (isDayView ? 4 : 2));
              let fit = computeBlockLayoutMemo(lesson, blockWidth, height, isDayView) || DEFAULT_FIT;

              // Aplicar supresión en cascada: si este magistral debe ser suprimido en la vista actual, ocultar badge
              if (activeSuppressedIds && activeSuppressedIds.has(lesson.id) && isMagistralType(lesson.type)) {
                fit = { ...fit, badge: { ...(fit.badge || {}), hide: true } };
              }

              return (
                <div
                  key={blockKey}
                  className={`lesson-block${lesson.isCustomEvent ? ' is-custom-event' : ''}${lesson.code === 'cancelled' ? ' cancelled' : ''}${lesson.isDimmed ? ' is-dimmed' : ''}${isPastLesson ? ' is-past' : ''}`}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `${leftPct + 0.5}%`,
                    width: `${(widthPct * col.span) - 1}%`,
                    background: color.bg,
                    color: color.text,
                    border: color.border ? `1px solid ${color.border}` : undefined,
                    position: 'absolute',
                    padding: fit.padding,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                  onClick={() => onLessonClick(lesson)}
                >
                  {/* Subgroup Badge */}
                  {!fit.badge?.hide && (
                    <div
                      style={{
                        fontSize: fit.badge?.font || 8,
                        fontWeight: 800,
                        background: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.15)',
                        color: isDark ? '#FFFFFF' : 'inherit',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.35)' : 'none',
                        padding: fit.badge?.padding || '0px 2px',
                        borderRadius: 3,
                        marginBottom: 1,
                        display: 'inline-block',
                        lineHeight: fit.badge?.lineHeight || 1.1,
                        flexShrink: 0,
                        maxWidth: '100%',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        alignSelf: 'center',
                        boxShadow: isDark ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none',
                      }}
                    >
                      {fit.badge?.text}
                    </div>
                  )}

                  {/* Center Area: Vertically centered Subject Name */}
                  {fit.subject?.mode === 'lines' && Array.isArray(fit.subject?.lines) && (
                    <div
                      className="lesson-block-center"
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        minHeight: 0,
                        overflow: 'hidden',
                        paddingTop: fit.badge?.hide ? '0px' : '1px',
                        paddingBottom: (fit.room?.show || (isDayView && fit.teacher?.show)) ? '1px' : '0px',
                      }}
                    >
                      <div
                        className="lesson-block-subject"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: fit.subject.font,
                          lineHeight: fit.subject.lineHeight,
                          fontWeight: 700,
                          letterSpacing: fit.subject.lines.length === 1 ? '0.02em' : '0.01em',
                          width: '100%',
                          textAlign: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {fit.subject.lines.map((line, lineIdx) => (
                          <span
                            key={lineIdx}
                            style={{
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: fit.subject?.lineHeight || 1.1,
                              textAlign: 'center',
                            }}
                          >
                            {line}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Area: Room & Teacher pinned at base */}
                  {(fit.room?.show || (isDayView && fit.teacher?.show)) && (
                    <div
                      className="lesson-block-bottom"
                      style={{
                        marginTop: 'auto',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {fit.room?.show && (
                        <div
                          className="lesson-block-room"
                          style={{
                            fontSize: `${fit.room.font}px`,
                            opacity: 0.75,
                            fontWeight: 500,
                            marginBottom: '0px',
                            paddingBottom: '0px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            lineHeight: fit.room.font <= 8 ? 1.05 : 1.1,
                            flexShrink: 0,
                          }}
                        >
                          {fit.room.text}
                        </div>
                      )}

                      {isDayView && fit.teacher?.show && (
                        <div
                          className="lesson-block-teacher"
                          style={{
                            fontSize: `${fit.teacher.font}px`,
                            opacity: 0.85,
                            fontWeight: 600,
                            marginBottom: '1px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            lineHeight: 1.1,
                            flexShrink: 0,
                          }}
                        >
                          {fit.teacher.text}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancelled badge */}
                  {lesson.code === 'cancelled' && (
                    <div className="cancelled-badge">Cancelada</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const hasTodayInCurr = isDayView
    ? isSameDay(selectedDay || weekDates[0], now)
    : (currentDates || []).some(d => d && isSameDay(d, now));

  const hasTodayInPrev = isDayView
    ? (prevDates?.[0] ? isSameDay(prevDates[0], now) : false)
    : (prevDates || []).some(d => d && isSameDay(d, now));

  const hasTodayInNext = isDayView
    ? (nextDates?.[0] ? isSameDay(nextDates[0], now) : false)
    : (nextDates || []).some(d => d && isSameDay(d, now));

  const showCurrentTimeOverlay = isTimeInRange && currentTimeTop !== null && (hasTodayInCurr || hasTodayInPrev || hasTodayInNext);

  const renderTimeIndicatorPanel = (datesList) => {
    if (isDayView) {
      return (
        <div className="current-time-col-segment is-today">
          <div className="current-time-line-bar" />
        </div>
      );
    }
    const todayIdx = (datesList || []).findIndex(d => d && isSameDay(d, now));
    return (datesList || []).map((date, i) => {
      const isToday = i === todayIdx;
      return (
        <div
          key={i}
          className={`current-time-col-segment ${isToday ? 'is-today' : 'is-other-day'}`}
        >
          <div className="current-time-line-bar" />
        </div>
      );
    });
  };

  return (
    <div
      ref={calendarScrollRef}
      className="calendar-scroll"
      onDoubleClick={resetZoom}
    >
      <div className="calendar-grid" style={{ minHeight: totalHeight + 'px' }}>
        {/* Time labels column */}
        <div className="time-col">
          {timeLabels.map(l => (
            <div
              key={l.minute}
              className={`time-label-abs ${l.isMajor ? 'is-major' : 'is-minor'}`}
              style={{ top: `${l.top}px` }}
            >
              <span>{l.text}</span>
            </div>
          ))}
        </div>

        {/* Days Viewport containing the 3-panel virtual track */}
        <div className="days-viewport" style={{ height: totalHeight + 'px' }}>
          {/* Background grid lines */}
          <div className="calendar-grid-lines" aria-hidden="true">
            {gridLines.map(line => (
              <div
                key={line.minute}
                className={`grid-line grid-line-${line.type}`}
                style={{ top: `${line.top}px` }}
              />
            ))}
          </div>

          <div
            ref={daysTrackRef}
            className="days-track"
            style={{ height: totalHeight + 'px' }}
          >
            <div className="days-panel panel-prev">
              {renderDayColumns(prevDates, 'prev')}
            </div>

            <div className="days-panel panel-current">
              {renderDayColumns(currentDates, 'curr')}
            </div>

            <div className="days-panel panel-next">
              {renderDayColumns(nextDates, 'next')}
            </div>
          </div>
        </div>

        {/* Current Time Indicator Track (sits above time-col border, never clipped) */}
        {showCurrentTimeOverlay && (
          <div
            ref={currentTimeOverlayRef}
            className="current-time-track"
            style={{ top: `${currentTimeTop}px` }}
            aria-hidden="true"
          >
            <div className="current-time-panel panel-prev">
              {hasTodayInPrev && renderTimeIndicatorPanel(prevDates)}
            </div>

            <div className="current-time-panel panel-current">
              {hasTodayInCurr && renderTimeIndicatorPanel(currentDates)}
            </div>

            <div className="current-time-panel panel-next">
              {hasTodayInNext && renderTimeIndicatorPanel(nextDates)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default WeekCalendar;

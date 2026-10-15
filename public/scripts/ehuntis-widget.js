// ===========================================================================
//  EHUntis Widget para iOS — Scriptable
//  Port fiel del widget Android (Kotlin) a JavaScript/Scriptable
//  Versión: 1.0.0
// ===========================================================================
//
//  INSTALACIÓN:
//  1. Instala Scriptable en la App Store (gratuito)
//  2. Crea un nuevo script, pega este código y nómbralo "EHUntis"
//  3. Añade el widget a la pantalla de inicio (Mediano, Grande o Extra Grande)
//  4. Pulsa el widget para abrirlo en Scriptable y configura tu cuenta
//
// ===========================================================================

// ── CONSTANTES GLOBALES ─────────────────────────────────────────────────────

const BASE_URL = "https://ehuntis.vercel.app";

function getScriptName(settings) {
  try {
    if (typeof Script !== 'undefined' && typeof Script.name === 'function') {
      const n = Script.name();
      if (n && n.trim().length > 0) return n.trim();
    }
  } catch(_) {}
  if (settings && settings.scriptName && settings.scriptName.trim().length > 0) {
    return settings.scriptName.trim();
  }
  return "EHUntis";
}

function getSettingsDeeplink(settings, instanceId) {
  let url = `scriptable:///run?scriptName=${encodeURIComponent(getScriptName(settings))}&openSettings=true`;
  if (instanceId && typeof instanceId === 'string' && instanceId.trim().length > 0) {
    url += `&instance=${encodeURIComponent(instanceId.trim())}`;
  }
  return url;
}

const SCRIPT_NAME = getScriptName();
const SETTINGS_DEEPLINK = getSettingsDeeplink();

const FILES = {
  settings: "ehuntis_settings.json",
  user:     "ehuntis_user.json",
  timetable:"ehuntis_timetable.json",
};

// Tamaños de widget en puntos calculados dinámicamente según el dispositivo físico (iOS)
// Previene el escalado / aspect-fill de iOS que distorsiona proporciones y recorta bordes.
function getDeviceWidgetSize(family) {
  let sw = 390, sh = 844;
  try {
    if (typeof Device !== 'undefined' && typeof Device.screenSize === 'function') {
      const screen = Device.screenSize();
      if (screen && screen.width) {
        sw = Math.min(screen.width, screen.height);
        sh = Math.max(screen.width, screen.height);
      }
    }
  } catch(_) {}

  const isPad = (typeof Device !== 'undefined' && typeof Device.model === 'function' && Device.model().toLowerCase().includes('ipad')) || sw >= 600;

  if (isPad) {
    // iPad Pro 12.9" / 13" (sw >= 1000)
    if (sw >= 1000) {
      if (family === "small")      return { w: 170, h: 170 };
      if (family === "medium")     return { w: 382, h: 170 };
      if (family === "large")      return { w: 382, h: 382 };
      if (family === "extraLarge") return { w: 792, h: 382 };
    }
    // iPad Pro 11" / iPad Air (sw >= 820)
    if (sw >= 820) {
      if (family === "small")      return { w: 158, h: 158 };
      if (family === "medium")     return { w: 345, h: 158 };
      if (family === "large")      return { w: 345, h: 345 };
      if (family === "extraLarge") return { w: 715, h: 345 };
    }
    // iPad 10.2" / 9.7" / mini (sw >= 600)
    if (family === "small")      return { w: 148, h: 148 };
    if (family === "medium")     return { w: 324, h: 148 };
    if (family === "large")      return { w: 324, h: 324 };
    if (family === "extraLarge") return { w: 682, h: 324 };
  }

  // iPhones
  // 1. Max / Plus (sw >= 428 pt: iPhone 12/13/14 Pro Max, 14/15/16 Plus, 15/16 Pro Max)
  if (sw >= 428) {
    if (family === "small")      return { w: 170, h: 170 };
    if (family === "medium")     return { w: 364, h: 170 };
    if (family === "large")      return { w: 364, h: 382 };
    if (family === "extraLarge") return { w: 364, h: 382 };
  }
  // 2. Dispositivos estándar (sw >= 390 pt: iPhone 12, 13, 14, 15, 16 estándar y Pro)
  if (sw >= 390) {
    if (family === "small")      return { w: 158, h: 158 };
    if (family === "medium")     return { w: 338, h: 158 };
    if (family === "large")      return { w: 338, h: 354 };
    if (family === "extraLarge") return { w: 736, h: 354 };
  }
  // 3. SE / 8 (sw <= 375 && sh <= 667)
  if (sh <= 667) {
    if (family === "small")      return { w: 148, h: 148 };
    if (family === "medium")     return { w: 321, h: 148 };
    if (family === "large")      return { w: 321, h: 324 };
    if (family === "extraLarge") return { w: 700, h: 324 };
  }
  // 4. Default / Mini / X (sw ~ 375 pt)
  if (family === "small")      return { w: 155, h: 155 };
  if (family === "medium")     return { w: 329, h: 155 };
  if (family === "large")      return { w: 329, h: 345 };
  if (family === "extraLarge") return { w: 715, h: 345 };
  return { w: 338, h: 354 };
}

const WIDGET_SIZES = {
  small:      { w: 158,  h: 158  },
  medium:     { w: 338,  h: 158  },
  large:      { w: 338,  h: 354  },
  extraLarge: { w: 736,  h: 354  },
  accessoryCircular:    { w: 44, h: 44 },
  accessoryRectangular: { w: 150, h: 44 },
  accessoryInline:      { w: 200, h: 16 },
};

// Cabecera dibujada: altura en puntos con margen superior seguro para evitar clipping
const HEADER_HEIGHT = 32;

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO A — CACHÉ LOCAL (FileManager)
//  Equivalente a: LocalCacheManager.kt
// ════════════════════════════════════════════════════════════════════════════

const FM = FileManager.local();

function getSettingsFileName(instanceId) {
  if (instanceId && typeof instanceId === 'string' && instanceId.trim().length > 0) {
    const cleanId = instanceId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    if (cleanId !== "semanal" && cleanId !== "diario" && cleanId !== "weekly" && cleanId !== "daily" && cleanId !== "settings" && cleanId !== "opensettings") {
      return `ehuntis_settings_${cleanId}.json`;
    }
  }
  const scriptName = getScriptName();
  const cleanName = scriptName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (cleanName && cleanName !== "ehuntis" && cleanName !== "scriptable") {
    return `ehuntis_settings_${cleanName}.json`;
  }
  return FILES.settings;
}

function settingsPath(instanceId) {
  return FM.joinPath(FM.documentsDirectory(), getSettingsFileName(instanceId));
}

function userPath(username) {
  if (username && typeof username === 'string' && username.trim().length > 0) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    return FM.joinPath(FM.documentsDirectory(), `ehuntis_user_${clean}.json`);
  }
  return FM.joinPath(FM.documentsDirectory(), FILES.user);
}

function timetablePath(username) {
  if (username && typeof username === 'string' && username.trim().length > 0) {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    return FM.joinPath(FM.documentsDirectory(), `ehuntis_timetable_${clean}.json`);
  }
  return FM.joinPath(FM.documentsDirectory(), FILES.timetable);
}

function defaultSettings() {
  let initialSys = "light";
  try {
    if (typeof Device !== 'undefined' && typeof Device.isUsingDarkAppearance === 'function') {
      if (Device.isUsingDarkAppearance() === true) {
        initialSys = "dark";
      }
    }
  } catch(_) {}

  if (initialSys === "light") {
    try {
      const now = new Date();
      const timeDec = now.getHours() + now.getMinutes() / 60;
      if (timeDec >= 20.75 || timeDec < 7.5) {
        initialSys = "dark";
      }
    } catch(_) {}
  }

  return {
    username: null,
    theme: "system",
    systemThemeCached: initialSys,
    viewMode: "daily",
    configId: null,
    lastSync: 0
  };
}

function applyWidgetParameterOverrides(settings, instanceId) {
  if (!instanceId || typeof instanceId !== 'string') return settings;
  const param = instanceId.trim().toLowerCase();
  let updated = { ...settings };

  // Modo de vista: semanal o diario
  if (param.includes("semanal") || param.includes("weekly") || param === "week") {
    updated.viewMode = "weekly";
  } else if (param.includes("diario") || param.includes("daily") || param === "day") {
    updated.viewMode = "daily";
  }

  // Sobrescritura de tema por parámetro del widget: ej. "oscuro", "dark", "claro", "light"
  if (param.includes("oscuro") || param.includes("dark")) {
    updated.theme = "dark";
  } else if (param.includes("claro") || param.includes("light")) {
    updated.theme = "light";
  } else if (param.includes("sistema") || param.includes("system") || param.includes("auto")) {
    updated.theme = "system";
  }

  return updated;
}

function loadSettings(instanceId) {
  try {
    const p = settingsPath(instanceId);
    if (!FM.fileExists(p)) {
      // Si es un widget secundario sin archivo propio, clonar ajustes principales
      const mainP = FM.joinPath(FM.documentsDirectory(), FILES.settings);
      if (FM.fileExists(mainP)) {
        try {
          const s = JSON.parse(FM.readString(mainP));
          return applyWidgetParameterOverrides(s, instanceId);
        } catch(_) {}
      }
      return applyWidgetParameterOverrides(defaultSettings(), instanceId);
    }
    const s = JSON.parse(FM.readString(p));

    // Si la app está abierta en primer plano (no en widget), refrescar la caché del tema del sistema real
    try {
      if (typeof config !== 'undefined' && !config.runsInWidget && !config.runsInAccessoryWidget) {
        if (typeof Device !== 'undefined' && typeof Device.isUsingDarkAppearance === 'function') {
          const isDevDark = Device.isUsingDarkAppearance() === true;
          const freshSys = isDevDark ? "dark" : "light";
          if (s.systemThemeCached !== freshSys) {
            s.systemThemeCached = freshSys;
            saveSettings(s, instanceId);
          }
        }
      }
    } catch(_) {}

    return applyWidgetParameterOverrides(s, instanceId);
  } catch(_) {
    return applyWidgetParameterOverrides(defaultSettings(), instanceId);
  }
}

function saveSettings(s, instanceId) {
  try {
    if (typeof Script !== 'undefined' && typeof Script.name === 'function') {
      const n = Script.name();
      if (n && n.trim().length > 0) s.scriptName = n.trim();
    }
  } catch(_) {}
  try {
    FM.writeString(settingsPath(instanceId), JSON.stringify(s));
    if (instanceId && s && s.systemThemeCached) {
      const mainP = FM.joinPath(FM.documentsDirectory(), FILES.settings);
      if (FM.fileExists(mainP)) {
        try {
          const mainS = JSON.parse(FM.readString(mainP));
          if (mainS.systemThemeCached !== s.systemThemeCached) {
            mainS.systemThemeCached = s.systemThemeCached;
            FM.writeString(mainP, JSON.stringify(mainS));
          }
        } catch(_) {}
      }
    }
  } catch(_) {}
}

function loadUserData(username) {
  try {
    const p = userPath(username);
    if (FM.fileExists(p)) return JSON.parse(FM.readString(p));
    const mainP = FM.joinPath(FM.documentsDirectory(), FILES.user);
    if (FM.fileExists(mainP)) return JSON.parse(FM.readString(mainP));
    return null;
  } catch(_) { return null; }
}

function saveUserData(u, username) {
  try {
    FM.writeString(userPath(username), JSON.stringify(u));
    FM.writeString(FM.joinPath(FM.documentsDirectory(), FILES.user), JSON.stringify(u));
  } catch(_) {}
}

function loadTimetable(username) {
  try {
    const p = timetablePath(username);
    if (FM.fileExists(p)) return JSON.parse(FM.readString(p));
    const mainP = FM.joinPath(FM.documentsDirectory(), FILES.timetable);
    if (FM.fileExists(mainP)) return JSON.parse(FM.readString(mainP));
    return [];
  } catch(_) { return []; }
}

function saveTimetable(t, username) {
  try {
    FM.writeString(timetablePath(username), JSON.stringify(t));
    FM.writeString(FM.joinPath(FM.documentsDirectory(), FILES.timetable), JSON.stringify(t));
  } catch(_) {}
}

// Fallback en cascada, igual que LocalCacheManager.resolveConfig
function resolveConfig(configs, assignedId, activeId) {
  if (!configs || configs.length === 0) return null;
  if (assignedId != null) {
    const found = configs.find(c => c && String(c.id) === String(assignedId));
    if (found) return found;
  }
  if (activeId != null) {
    const found = configs.find(c => c && String(c.id) === String(activeId));
    if (found) return found;
  }
  return configs[0];
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO B — CLIENTE DE RED
//  Equivalente a: ApiClient.kt
// ════════════════════════════════════════════════════════════════════════════

async function fetchUserData(username) {
  const url = `${BASE_URL}/api/user/${encodeURIComponent(username.trim())}?t=${Date.now()}`;
  const req = new Request(url);
  req.headers = { "Cache-Control": "no-cache", "Pragma": "no-cache" };
  try {
    const data = await req.loadJSON();
    return data;
  } catch(e) {
    throw new Error(`Error al cargar usuario: ${e.message}`);
  }
}

async function fetchTimetable(classIds, force = false) {
  if (!classIds || classIds.length === 0) return [];
  const now = new Date();
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const startStr = `${startYear}-09-01T00:00:00.000Z`;
  const endStr   = `${startYear + 1}-06-30T23:59:59.000Z`;
  const forceParam = force ? `&force=1&t=${Date.now()}` : "";
  const url = `${BASE_URL}/api/timetable?classIds=${classIds.join(",")}&startDate=${startStr}&endDate=${endStr}${forceParam}`;
  const req = new Request(url);
  req.headers = { "Cache-Control": "no-cache" };
  req.timeoutInterval = 15;
  try {
    const data = await req.loadJSON();
    return Array.isArray(data) ? data : [];
  } catch(e) {
    return [];
  }
}

// Extraer todos los IDs de asignaturas de las configuraciones de usuario
function extractAllClassIds(uData) {
  const allClassIds = [];
  if (uData && Array.isArray(uData.configs)) {
    for (const cfg of uData.configs) {
      if (cfg && Array.isArray(cfg.selectedGroups)) {
        for (const g of cfg.selectedGroups) {
          const ids = Array.isArray(g.ids)
            ? g.ids
            : (Array.isArray(g.id) ? g.id : (g.id != null ? [g.id] : []));
          for (const id of ids) {
            const num = Number(id);
            if (!isNaN(num) && !allClassIds.includes(num)) allClassIds.push(num);
          }
        }
      }
    }
  }
  return allClassIds;
}

// Sincronización inteligente de usuario y horario
async function syncIfNeeded(settings, force = false, instanceId) {
  if (!settings.username) return;
  const elapsed = Date.now() - (settings.lastSync || 0);
  const MIN_INTERVAL = 30 * 60 * 1000; // 30 min como Android
  const hasTimetable = loadTimetable(settings.username).length > 0;
  if (!force && elapsed < MIN_INTERVAL && hasTimetable) return;

  try {
    const userData = await fetchUserData(settings.username);
    const prevUserData = loadUserData(settings.username);
    saveUserData(userData, settings.username);
    if (userData.active_config_id && !settings.configId) {
      settings.configId = null; // Mantener "seguir activo"
    }

    const allClassIds = extractAllClassIds(userData);

    // Detectar si el usuario modificó la configuración activa o los grupos en la web
    const userChanged = !prevUserData ||
      prevUserData.active_config_id !== userData.active_config_id ||
      prevUserData.updated_at !== userData.updated_at ||
      JSON.stringify(prevUserData.configs || []) !== JSON.stringify(userData.configs || []);

    const shouldForceTt = force || userChanged || !hasTimetable || elapsed >= 6 * 3600 * 1000;

    if (allClassIds.length > 0) {
      const lessons = await fetchTimetable(allClassIds, shouldForceTt);
      if (lessons.length > 0) {
        saveTimetable(lessons, settings.username);
        settings.lastSync = Date.now();
        saveSettings(settings, instanceId);
      }
    }
  } catch(_) {
    // Fallo silencioso — usamos caché
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO C — LÓGICA DE DÍAS
//  Port 1:1 de: DayLogic.kt
// ════════════════════════════════════════════════════════════════════════════

const DAYS_FULL   = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MONTHS_SHORT= ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function getAcademicYearBounds(date) {
  const d = date || new Date();
  const startYear = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  const start = new Date(startYear, 8, 1);  // 1 sep
  const end   = new Date(startYear + 1, 5, 30); // 30 jun
  return { start, end };
}

// LocalDate → YYYYMMDD Int
function toDateNumber(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

// YYYYMMDD Int → Date
function parseDateNumber(n) {
  if (n < 10000101) return new Date();
  const y = Math.floor(n / 10000);
  const m = Math.floor((n % 10000) / 100) - 1;
  const d = n % 100;
  try { return new Date(y, m, d); } catch(_) { return new Date(); }
}

// WebUntis time (830, 1430) → minutos desde medianoche
function toMinutes(timeVal) {
  const h = Math.floor(timeVal / 100);
  const m = timeVal % 100;
  return h * 60 + m;
}

// Diferencia en días enteros (a - b)
function differenceInDays(dateA, dateB) {
  const msPerDay = 24 * 3600 * 1000;
  return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay);
}

function getDayOfWeekName(date) {
  return DAYS_FULL[date.getDay()];
}

function formatDateShort(date) {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

// Filtra lecciones para una fecha YYYYMMDD
function getLessonsForDate(timetable, dateNum, includeDimmed = false) {
  if (!timetable || timetable.length === 0) return [];
  return timetable.filter(l =>
    l.date === dateNum &&
    l.code !== "cancelled" &&
    (includeDimmed || !l.isDimmed)
  );
}

function getLastLessonEndMinutes(lessons) {
  if (!lessons || lessons.length === 0) return null;
  return Math.max(...lessons.map(l => toMinutes(l.endTime)));
}

// Rango temporal visible adaptado — sin mínimo artificial de 6h para que las clases cortas expandan su tamaño
function computeVisibleTimeRange(dayLessons, isToday = false, nowMinutes = 0) {
  if (!dayLessons || dayLessons.length === 0) {
    return { firstHour:8, lastHour:21, startMinutes:450, endMinutes:1290, totalMinutes:840 };
  }
  const minClassMins = Math.min(...dayLessons.map(l => toMinutes(l.startTime)));
  const maxClassMins = Math.max(...dayLessons.map(l => toMinutes(l.endTime)));

  let firstHour = Math.floor(minClassMins / 60);
  let lastHour  = Math.ceil(maxClassMins / 60);

  // Redondear a horas en punto dentro de la franja lectiva [8, 21]
  firstHour = Math.max(8, Math.min(20, firstHour));
  lastHour  = Math.max(firstHour + 1, Math.min(21, lastHour));

  const startMins = firstHour * 60 - 10;
  const endMins   = lastHour  * 60 + 15;
  return { firstHour, lastHour, startMinutes: startMins, endMinutes: endMins, totalMinutes: endMins - startMins };
}

// Busca el día lectivo más cercano en una dirección (+1 adelante, -1 atrás)
function findClosestClassDate(fromDate, direction, timetable, bounds) {
  if (!timetable || timetable.length === 0) return null;
  const b = bounds || getAcademicYearBounds(fromDate);
  const step = direction >= 0 ? 1 : -1;
  let curr = addDays(fromDate, step);
  for (let i = 0; i < 365; i++) {
    if (curr < b.start || curr > b.end) return null;
    const lessons = getLessonsForDate(timetable, toDateNumber(curr));
    if (lessons.length > 0) return curr;
    curr = addDays(curr, step);
  }
  return null;
}

// analyzeBreakStreak — port 1:1 de DayLogic.kt
function analyzeBreakStreak(targetDate, timetable, schoolYearEndDate) {
  const bounds = getAcademicYearBounds(targetDate);
  const end = schoolYearEndDate || bounds.end;

  const pastClassDate   = findClosestClassDate(targetDate, -1, timetable, bounds);
  const futureClassDate = findClosestClassDate(targetDate,  1, timetable, bounds);

  if (!futureClassDate || futureClassDate > end) {
    return { type: "END_OF_YEAR", message: "No hay más clases programadas para este curso" };
  }

  const totalDays = pastClassDate
    ? differenceInDays(futureClassDate, pastClassDate) - 1
    : differenceInDays(futureClassDate, targetDate);

  if (totalDays >= 3) {
    const daysRemaining = Math.max(1, differenceInDays(futureClassDate, targetDate));
    const dayName = getDayOfWeekName(futureClassDate);
    const dateStr = formatDateShort(futureClassDate);
    const plural = daysRemaining === 1 ? "Falta" : "Faltan";
    const unit   = daysRemaining === 1 ? "día"   : "días";
    return {
      type: "EXTENDED_BREAK",
      message: `${plural} ${daysRemaining} ${unit} para volver a clase (Vuelves el ${dayName} ${dateStr})`,
      totalDays, daysRemaining, returnDate: futureClassDate
    };
  }

  return { type: "NO_CLASS_TODAY", message: "Sin clases hoy" };
}

// getResolvedTargetDate — port 1:1 de DayLogic.kt (algoritmo completo)
function getResolvedTargetDate(now, timetable) {
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (typeof PREVIEW_FORCE_TODAY !== "undefined" && PREVIEW_FORCE_TODAY) {
    return currentDate;
  }
  const m = now.getMonth() + 1; // 1-12

  // CASO ESPECIAL 1: Sin timetable
  if (!timetable || timetable.length === 0) {
    let fallback = new Date(currentDate);
    if (fallback.getDay() === 0) fallback = addDays(fallback, 1);
    else if (fallback.getDay() === 6) fallback = addDays(fallback, 2);
    const fm = fallback.getMonth() + 1;
    if (fm === 7 || fm === 8 || (fm === 9 && fallback.getDate() < 7)) {
      return new Date(fallback.getFullYear(), 8, 7);
    }
    return fallback;
  }

  // CASO ESPECIAL 2: Verano (julio, agosto, antes del 7 sep)
  if (m === 7 || m === 8 || (m === 9 && currentDate.getDate() < 7)) {
    const todayNum = toDateNumber(currentDate);
    const todayLessons = getLessonsForDate(timetable, todayNum);
    if (todayLessons.length === 0) {
      const tomorrow = addDays(currentDate, 1);
      const tomorrowLessons = getLessonsForDate(timetable, toDateNumber(tomorrow));
      if (tomorrowLessons.length === 0) {
        return new Date(currentDate.getFullYear(), 8, 7);
      }
    }
  }

  const todayNum    = toDateNumber(currentDate);
  const todayLessons= getLessonsForDate(timetable, todayNum, false);

  // CASO A: Hoy TIENE clases
  if (todayLessons.length > 0) {
    const lastEnd = getLastLessonEndMinutes(todayLessons);
    const nowM = now.getHours() * 60 + now.getMinutes();
    const minutesSinceLast = lastEnd != null ? nowM - lastEnd : 0;
    const nowH = now.getHours();

    const shouldJump = (nowH >= 16 && minutesSinceLast >= 60) || (nowH >= 21);
    if (!shouldJump) return currentDate;

    const nextClassDate = findClosestClassDate(currentDate, 1, timetable);
    if (!nextClassDate) return addDays(currentDate, 1);
    const gapDays = differenceInDays(nextClassDate, currentDate) - 1;

    if (gapDays < 5) {
      return nextClassDate;
    } else {
      if (sameDay(currentDate, addDays(nextClassDate, -1)) && nowH >= 16) {
        return nextClassDate;
      } else {
        return addDays(currentDate, 1);
      }
    }
  }

  // CASO B: Hoy NO tiene clases
  const nextClassDate = findClosestClassDate(currentDate, 1, timetable);
  if (!nextClassDate) return currentDate;

  const pastClassDate = findClosestClassDate(currentDate, -1, timetable);
  const totalGap = pastClassDate
    ? differenceInDays(nextClassDate, pastClassDate) - 1
    : differenceInDays(nextClassDate, currentDate);

  if (totalGap < 5) {
    return nextClassDate;
  } else {
    if (sameDay(currentDate, addDays(nextClassDate, -1)) && now.getHours() >= 16) {
      return nextClassDate;
    } else {
      return currentDate;
    }
  }
}

// computeNextEventTime — determina cuándo el widget debe refrescarse
function computeNextEventTime(now, timetable) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayNum = toDateNumber(today);
  const ownTodayLessons = getLessonsForDate(timetable, todayNum, false);
  const allTodayLessons = getLessonsForDate(timetable, todayNum, true);

  const candidates = [];

  // 1. Fin de clases de hoy que aún no hayan terminado
  const upcomingEnds = allTodayLessons
    .map(l => toMinutes(l.endTime))
    .filter(m => m > nowMinutes);
  for (const endMin of upcomingEnds) {
    const t = new Date(today);
    t.setHours(Math.floor(endMin / 60), endMin % 60, 2);
    candidates.push(t);
  }

  // 2. Momento del salto de día
  if (ownTodayLessons.length > 0) {
    const lastEnd = getLastLessonEndMinutes(ownTodayLessons);
    if (lastEnd != null) {
      const jumpMinute = Math.min(21 * 60, Math.max(16 * 60, lastEnd + 60));
      if (jumpMinute > nowMinutes) {
        const t = new Date(today);
        t.setHours(Math.floor(jumpMinute / 60), jumpMinute % 60, 2);
        candidates.push(t);
      }
    }
  } else {
    const nextClass = findClosestClassDate(today, 1, timetable);
    if (nextClass) {
      const dayBefore = addDays(nextClass, -1);
      if (sameDay(today, dayBefore) && now.getHours() < 16) {
        const t = new Date(today);
        t.setHours(16, 0, 2);
        candidates.push(t);
      }
    }
  }

  // 3. Medianoche
  const midnight = new Date(today);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 2);
  candidates.push(midnight);

  // 4. Momentos de transición solar / cambio de tema (amanecer ~07:30, atardecer ~20:45)
  // Para que los widgets en modo automático se refresquen cerca del cambio de ciclo de iOS
  const dawn = new Date(today);
  dawn.setHours(7, 30, 2);
  if (dawn > now) candidates.push(dawn);

  const dusk = new Date(today);
  dusk.setHours(20, 45, 2);
  if (dusk > now) candidates.push(dusk);

  const future = candidates.filter(t => t > now);
  if (future.length === 0) return new Date(now.getTime() + 15 * 60 * 1000);
  return future.reduce((a, b) => a < b ? a : b);
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO D — FILTRADO DE SUBGRUPOS
//  Port 1:1 de: Subgroups.kt
// ════════════════════════════════════════════════════════════════════════════

const PREFIX_REGEX      = /^(?:G\.?L\.?|G\.?O\.?|G\.?C\.?A\.?|T\.?I\.?|T\.?A\.?|P\.?A\.?|P\.?L\.?|S)[,\-.\s]*(\d+)/i;
const RAW_PREFIX_REGEX  = /^(G\.?L\.?|G\.?O\.?|G\.?C\.?A\.?|T\.?I\.?|T\.?A\.?|P\.?A\.?|P\.?L\.?|S)/i;
const FALLBACK_SUBGRP   = /^([A-Z]{1,4})[,\-.\s]*(\d+)/;

function extractSubgroupKey(lstext) {
  if (!lstext) return null;
  const upper = String(lstext).trim().toUpperCase();
  if (upper.includes("MAGIS") || upper === "M" ||
      upper.startsWith("GA ") || upper === "GA" || upper.startsWith("G.A.") ||
      upper === "T" || upper.startsWith("T0") ||
      upper.includes("EM/CM") || upper.includes("EXAMEN") ||
      upper.includes("BERRESKUR") || upper.includes("RECUPER") ||
      upper.includes("CLASE ADICIONAL")) return null;

  const prefixMatch = PREFIX_REGEX.exec(upper);
  if (prefixMatch) {
    const rawPrefixMatch = RAW_PREFIX_REGEX.exec(upper);
    const rawPrefix = rawPrefixMatch ? rawPrefixMatch[1] : "";
    const normPrefix = rawPrefix.replace(/\./g, "");
    return normPrefix + prefixMatch[1];
  }

  const fallback = FALLBACK_SUBGRP.exec(upper);
  if (fallback) return fallback[1] + fallback[2];
  return null;
}

function extractSubgroupNumber(lstext) {
  const key = extractSubgroupKey(lstext);
  if (!key) return null;
  const m = key.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function getMergeType(lstext) {
  if (!lstext) return "";
  const upper = String(lstext).trim().toUpperCase();
  if (upper.includes("MAGIS") || upper === "M" ||
      upper.startsWith("GA") || upper.startsWith("G.A.") ||
      upper === "T" || upper.startsWith("T0")) return "MAGISTRAL_GA";
  return upper;
}

function isGroupDisabled(g, disabledGroupIds) {
  if (!g || !disabledGroupIds) return false;
  const keys = getGroupCandidateKeys(g);
  for (const k of keys) {
    if (disabledGroupIds.has(k) || disabledGroupIds.has(String(k))) return true;
  }
  return false;
}

function getGroupCandidateKeys(g) {
  if (!g) return [];
  const keys = new Set();
  if (g.uniqueId) keys.add(String(g.uniqueId));
  if (g.id != null) {
    if (Array.isArray(g.id)) {
      keys.add(g.id.join(","));
      g.id.forEach(id => { if (id != null) keys.add(String(id)); });
    } else {
      keys.add(String(g.id));
    }
  }
  if (Array.isArray(g.ids)) {
    keys.add(g.ids.join(","));
    g.ids.forEach(id => { if (id != null) keys.add(String(id)); });
  }
  if (g.name) keys.add(String(g.name));
  return Array.from(keys);
}

function filterLessonsForConfig(lessons, config) {
  if (!config) return lessons || [];
  const selectedGroups = Array.isArray(config.selectedGroups) ? config.selectedGroups : [];
  const disabledGroupIds = new Set(
    Array.isArray(config.disabledGroupIds)
      ? config.disabledGroupIds.map(id => String(id))
      : (config.disabledGroupIds ? Object.keys(config.disabledGroupIds).map(id => String(id)) : [])
  );
  const disabledSubjectsByGroup = config.disabledSubjectsByGroup || {};
  const disabledSubgroupsBySubject = config.disabledSubgroupsBySubject || {};
  const showDimmed = config.showDimmedSubgroups !== false;

  const activeGroups = selectedGroups.filter(g => !isGroupDisabled(g, disabledGroupIds));

  return (lessons || []).reduce((acc, lesson) => {
    if (!lesson) return acc;
    const lessonGroupIds = (lesson.classIds && lesson.classIds.length > 0)
      ? lesson.classIds
      : (lesson.classId != null ? [lesson.classId] : []);

    if (selectedGroups.length > 0) {
      const belongs = selectedGroups.some(g => {
        const ids = Array.isArray(g.ids)
          ? g.ids
          : (Array.isArray(g.id) ? g.id : (g.id != null ? [g.id] : []));
        return lessonGroupIds.some(id => ids.includes(id) || ids.includes(Number(id)) || ids.includes(String(id)));
      });
      if (!belongs) return acc;
    }

    const ownerGroups = selectedGroups.length === 0 ? [] : activeGroups.filter(g => {
      const ids = Array.isArray(g.ids)
        ? g.ids
        : (Array.isArray(g.id) ? g.id : (g.id != null ? [g.id] : []));
      return lessonGroupIds.some(id => ids.includes(id) || ids.includes(Number(id)) || ids.includes(String(id)));
    });

    if (selectedGroups.length > 0 && ownerGroups.length === 0) return acc;

    const groupsToEval = ownerGroups.length > 0
      ? ownerGroups
      : [{ id: lessonGroupIds }];

    let isVisible = false;
    let isDimmed  = false;

    for (const g of groupsToEval) {
      const candidateKeys = getGroupCandidateKeys(g);

      // Asignaturas deshabilitadas para este grupo
      const disabledSubjects = new Set();
      for (const k of candidateKeys) {
        const list = disabledSubjectsByGroup[k];
        if (list) {
          const arr = Array.isArray(list) ? list : (typeof list === "object" ? Object.keys(list) : [list]);
          for (const s of arr) {
            if (s != null) {
              const str = String(s).trim().toLowerCase();
              if (str) disabledSubjects.add(str);
            }
          }
        }
      }

      const subjectIds    = (lesson.subjectIds || []).filter(x => x != null);
      const subjectNames  = lesson.subjects || [];
      const subjectShorts = lesson.subjectShortNames || [];

      const isSubjDisabled =
        subjectIds.some(id  => id != null && disabledSubjects.has(String(id).trim().toLowerCase())) ||
        subjectNames.some(s  => s != null && disabledSubjects.has(String(s).trim().toLowerCase())) ||
        subjectShorts.some(s => s != null && disabledSubjects.has(String(s).trim().toLowerCase()));

      if (isSubjDisabled) continue;

      // Subgrupos deshabilitados
      const subKey = extractSubgroupKey(lesson.type);
      let isSubgroupDisabled = false;

      if (subKey) {
        const normSubKey = String(subKey).replace(/[.\-,\s]/g,"").toUpperCase();
        const subjectKeys = [
          ...subjectIds.map(id => String(id)),
          ...subjectNames.filter(s => s != null).map(s => String(s)),
          ...subjectShorts.filter(s => s != null).map(s => String(s)),
        ];

        const disabledSubgroupLists = [];
        for (const subjKey of subjectKeys) {
          for (const grpKey of candidateKeys) {
            const map = disabledSubgroupsBySubject[grpKey];
            if (map && map[subjKey]) disabledSubgroupLists.push(map[subjKey]);
          }
          const allMap = disabledSubgroupsBySubject["_all_"];
          if (allMap && allMap[subjKey]) disabledSubgroupLists.push(allMap[subjKey]);
          const directMap = disabledSubgroupsBySubject[subjKey];
          if (directMap) {
            if (Array.isArray(directMap)) disabledSubgroupLists.push(directMap);
            else if (typeof directMap === 'object') disabledSubgroupLists.push(Object.values(directMap).flat());
          }
        }

        isSubgroupDisabled = disabledSubgroupLists.some(list => {
          if (!list) return false;
          const arr = Array.isArray(list) ? list : (typeof list === 'object' ? Object.keys(list) : [list]);
          return arr.some(item => {
            if (item == null) return false;
            const strItem = String(item).trim();
            const normItem = strItem.replace(/[.\-,\s]/g,"").toUpperCase();
            return normItem === normSubKey || strItem.toLowerCase() === String(subKey).trim().toLowerCase();
          });
        });
      }

      if (!isSubgroupDisabled) { isVisible = true; isDimmed = false; break; }
      else if (showDimmed)     { isVisible = true; isDimmed = true; }
    }

    if (!isVisible) return acc;
    acc.push({ ...lesson, isDimmed });
    return acc;
  }, []);
}

// Fusiona bloques horarios consecutivos que pertenecen a la misma clase/actividad
// (por ejemplo: Magistral + GA continuos, o bloques partidos de seminario/laboratorio)
function mergeConsecutiveBlocks(lessons) {
  if (!lessons || lessons.length === 0) return [];
  const cleanRoom = (r) => (r != null ? String(r) : "").replace(/_\d+$/, "").trim();
  const stableStringify = (arr) => JSON.stringify([...(arr || [])].sort());

  const deduplicated = [];
  const seen = new Map();
  for (const lesson of lessons) {
    const mergeType = getMergeType(lesson.type);
    const subKey = extractSubgroupKey(lesson.type) || "";
    const roomsClean = (lesson.rooms || []).map(cleanRoom);
    const key = `${lesson.date}_${lesson.startTime}_${lesson.endTime}_${stableStringify(lesson.subjectIds)}_${stableStringify(roomsClean)}_${mergeType}_${subKey}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      const cIds = lesson.classIds || (lesson.classId ? [lesson.classId] : []);
      for (const id of cIds) {
        if (!existing.classIds.includes(id)) existing.classIds.push(id);
      }
      if (lesson.code) existing.code = lesson.code;
    } else {
      const cIds = lesson.classIds ? [...lesson.classIds] : (lesson.classId ? [lesson.classId] : []);
      const newLesson = { ...lesson, classIds: cIds, rooms: roomsClean };
      seen.set(key, newLesson);
      deduplicated.push(newLesson);
    }
  }

  const groups = new Map();
  for (const lesson of deduplicated) {
    const mergeType = getMergeType(lesson.type);
    const subKey = extractSubgroupKey(lesson.type) || "";
    const typeKey = (mergeType === "MAGISTRAL_GA") ? "MAGISTRAL_GA" : (subKey || mergeType || "UNKNOWN");
    const subjKey = stableStringify(lesson.subjectIds && lesson.subjectIds.length > 0 ? lesson.subjectIds : lesson.subjects);
    const roomKey = stableStringify(lesson.rooms);
    const groupKey = `${lesson.date}_${subjKey}_${roomKey}_${typeKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(lesson);
  }

  const merged = [];
  for (const groupLessons of groups.values()) {
    groupLessons.sort((a, b) => a.startTime - b.startTime);
    let current = { ...groupLessons[0] };

    for (let i = 1; i < groupLessons.length; i++) {
      const next = groupLessons[i];
      if (current.endTime === next.startTime) {
        current.endTime = next.endTime;
        if (next.code) current.code = next.code;
        if ((!current.teachers || current.teachers.length === 0) && next.teachers && next.teachers.length > 0) {
          current.teachers = next.teachers;
        }
        if (current.type && String(current.type).toUpperCase().includes("MAGIS") && next.type && !String(next.type).toUpperCase().includes("MAGIS")) {
          current.type = next.type;
        }
        if (next.isDimmed) current.isDimmed = true;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    if (current) {
      merged.push(current);
    }
  }

  merged.sort((a, b) => (a.date - b.date) || (a.startTime - b.startTime));
  return merged;
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO E — PALETA DE COLORES
//  Port 1:1 de: Palette.kt
// ════════════════════════════════════════════════════════════════════════════

// Cada entrada: { bg, text, borderHex, borderAlpha }
// Extraídos 1:1 de Palette.kt / colorLogic.js (14 colores: 8 principales + 6 complementarios)
const PALETTE_LIGHT = [
  { bg:"#BAE1FF", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 0 Azul cielo
  { bg:"#FFDFBA", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 1 Albaricoque
  { bg:"#BAFFC9", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 2 Verde menta
  { bg:"#FFB3BA", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 3 Coral
  { bg:"#D9BAFF", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 4 Lavanda
  { bg:"#FFF6BA", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 5 Amarillo
  { bg:"#BAFFFF", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 6 Cian
  { bg:"#FFC8DD", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 7 Rosa pastel
  { bg:"#F4B69C", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 8 Terracota
  { bg:"#DCB5DE", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 9 Malva
  { bg:"#A2D5C6", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 10 Jade
  { bg:"#CCE3A3", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 11 Pistacho
  { bg:"#F5D580", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 12 Miel
  { bg:"#BDC7EC", text:"#0F172A", borderHex:"#000000", borderAlpha:0.20 }, // 13 Pervinca
];

const PALETTE_DARK = [
  { bg:"#163B60", text:"#BAE6FD", borderHex:"#38BDF8", borderAlpha:0.349 }, // 0
  { bg:"#4A2A14", text:"#FED7AA", borderHex:"#FB923C", borderAlpha:0.349 }, // 1
  { bg:"#133E2B", text:"#BBF7D0", borderHex:"#4ADE80", borderAlpha:0.349 }, // 2
  { bg:"#4C1D24", text:"#FECDD3", borderHex:"#FB7185", borderAlpha:0.349 }, // 3
  { bg:"#351F54", text:"#E9D5FF", borderHex:"#C084FC", borderAlpha:0.349 }, // 4
  { bg:"#42360E", text:"#FEF08A", borderHex:"#FACC15", borderAlpha:0.349 }, // 5
  { bg:"#0F3942", text:"#A5F3FC", borderHex:"#22D3EE", borderAlpha:0.349 }, // 6
  { bg:"#4A1D36", text:"#FBCFE8", borderHex:"#F472B6", borderAlpha:0.349 }, // 7
  { bg:"#542517", text:"#FED7AA", borderHex:"#FB923C", borderAlpha:0.349 }, // 8
  { bg:"#441B42", text:"#F5D0FE", borderHex:"#F0ABFC", borderAlpha:0.349 }, // 9
  { bg:"#143F37", text:"#99F6E4", borderHex:"#5EEAD4", borderAlpha:0.349 }, // 10
  { bg:"#2E3A14", text:"#ECFCCB", borderHex:"#BEF264", borderAlpha:0.349 }, // 11
  { bg:"#463311", text:"#FEF08A", borderHex:"#FACC15", borderAlpha:0.349 }, // 12
  { bg:"#1E2548", text:"#C7D2FE", borderHex:"#A5B4FC", borderAlpha:0.349 }, // 13
];

let _apiPalette = null;
function updatePaletteFromApi(apiPal) {
  _apiPalette = apiPal;
}

function getResolvedPalette(isDark) {
  if (_apiPalette && Array.isArray(isDark ? _apiPalette.dark : _apiPalette.light)) {
    const list = isDark ? _apiPalette.dark : _apiPalette.light;
    if (list.length > 0) {
      return list.map(item => ({
        bg: item.bg,
        text: item.text,
        borderHex: isDark ? "#FFFFFF" : "#000000",
        borderAlpha: isDark ? 0.349 : 0.20
      }));
    }
  }
  return isDark ? PALETTE_DARK : PALETTE_LIGHT;
}

// Convierte hex color a Color de Scriptable
function hexToColor(hex, alpha) {
  if (!hex) return new Color("#000000");
  const cleanHex = hex.startsWith("#") ? hex : "#" + hex;
  return new Color(cleanHex, alpha !== undefined ? alpha : 1.0);
}

const _subjectColorMap = new Map();

function classifyPeriod(dates) {
  let q1 = 0, q2 = 0;
  for (const d of dates) {
    const m = Math.floor((d % 10000) / 100);
    if (m >= 9 && m <= 12) q1++;
    else if (m >= 2 && m <= 6) q2++;
  }
  if (q1 >= 3 && q2 >= 3) return "annual";
  if (q1 > 0) return "q1";
  if (q2 > 0) return "q2";
  return "q1";
}

function updateSubjectColors(allLessons) {
  const subjectDates = new Map();
  for (const l of allLessons) {
    const id = l.subjectIds && l.subjectIds[0] != null ? l.subjectIds[0] : null;
    if (id == null || l.date <= 0) continue;
    if (!subjectDates.has(id)) subjectDates.set(id, new Set());
    subjectDates.get(id).add(l.date);
  }

  const annual = [], q1 = [], q2 = [];
  const uniqueIds = [...subjectDates.keys()].sort((a, b) => a - b);
  for (const id of uniqueIds) {
    const period = classifyPeriod(subjectDates.get(id));
    if (period === "annual") annual.push(id);
    else if (period === "q1") q1.push(id);
    else q2.push(id);
  }

  _subjectColorMap.clear();
  const paletteSize = PALETTE_LIGHT.length; // 14

  annual.forEach((id, i) => _subjectColorMap.set(id, i % paletteSize));

  const numAnnual = annual.length;
  const cuatPool  = Math.max(1, paletteSize - numAnnual);

  q1.forEach((id, i) => {
    const idx = numAnnual < paletteSize ? numAnnual + (i % cuatPool) : i % paletteSize;
    _subjectColorMap.set(id, idx);
  });
  q2.forEach((id, i) => {
    const idx = numAnnual < paletteSize ? numAnnual + (i % cuatPool) : i % paletteSize;
    _subjectColorMap.set(id, idx);
  });
}

function getColorForSubject(subjectId, isDark, customColors = {}) {
  const palette = getResolvedPalette(isDark);
  const paletteSize = palette.length;

  // 1. Color personalizado si el usuario lo asignó en la web
  if (customColors) {
    const rawCustom = customColors[String(subjectId)] != null
      ? customColors[String(subjectId)]
      : (customColors[Number(subjectId)] != null ? customColors[Number(subjectId)] : null);
    if (rawCustom != null) {
      const customIdx = Number(rawCustom);
      if (!isNaN(customIdx)) {
        return palette[Math.max(0, Math.min(paletteSize - 1, customIdx))];
      }
    }
  }

  // 2. Color automático calculado por periodos
  const idx = _subjectColorMap.has(subjectId)
    ? _subjectColorMap.get(subjectId)
    : (Math.abs(subjectId || 0) % paletteSize);
  return palette[idx % paletteSize]; // { bg, text, borderHex, borderAlpha }
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO F — MOTOR DE LAYOUT
//  Port 1:1 de: LayoutEngine.kt
// ════════════════════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  "de","del","la","las","el","los","y","e","en","i","eta","a","o","d","para","por","con","al","da"
]);

function getLessonKey(l) {
  return `${l.id || 0}_${l.date}_${l.startTime}_${l.endTime}`;
}

// arrangeColumns — port 1:1 de LayoutEngine.arrangeColumns
function arrangeColumns(lessons) {
  if (!lessons || lessons.length === 0) return new Map();
  const valid = lessons.filter(l => l.startTime > 0 && l.endTime > 0);
  if (valid.length === 0) return new Map();

  const sorted = [...valid].sort((a, b) => {
    const ds = toMinutes(a.startTime) - toMinutes(b.startTime);
    if (ds !== 0) return ds;
    return toMinutes(b.endTime) - toMinutes(a.endTime);
  });

  const clusters = [];
  let cluster = [];
  let clusterEnd = 0;

  for (const lesson of sorted) {
    const s = toMinutes(lesson.startTime);
    const e = toMinutes(lesson.endTime);
    if (cluster.length === 0) { cluster.push(lesson); clusterEnd = e; }
    else if (s < clusterEnd)  { cluster.push(lesson); clusterEnd = Math.max(clusterEnd, e); }
    else { clusters.push(cluster); cluster = [lesson]; clusterEnd = e; }
  }
  if (cluster.length > 0) clusters.push(cluster);

  const result = new Map();

  for (const cl of clusters) {
    const columns = [];
    for (const lesson of cl) {
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (toMinutes(last.endTime) <= toMinutes(lesson.startTime)) {
          col.push(lesson); placed = true; break;
        }
      }
      if (!placed) columns.push([lesson]);
    }

    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      for (const lesson of columns[colIdx]) {
        let span = 1;
        for (let next = colIdx + 1; next < columns.length; next++) {
          const hasOverlap = columns[next].some(other =>
            toMinutes(other.startTime) < toMinutes(lesson.endTime) &&
            toMinutes(other.endTime)   > toMinutes(lesson.startTime)
          );
          if (!hasOverlap) span++;
          else break;
        }
        result.set(getLessonKey(lesson), { colIdx, span, totalColumns: columns.length });
      }
    }
  }
  return result;
}

// buildSubjectTiers — port 1:1 de LayoutEngine.buildSubjectTiers
function buildSubjectTiers(fullName, lesson) {
  if (!fullName) return [];
  const clean = fullName.replace(/[(),.:\-\/]/g, " ").trim();
  const allTokens = clean.split(/\s+/).filter(t => t.length > 0);
  if (allTokens.length === 0) return [];

  const tiers = [];

  function shorten(w, len) {
    if (w.length <= len) return w;
    return w[0].toUpperCase() + w.substring(1, len).toLowerCase();
  }

  const sigTokens = allTokens.filter(t => !STOP_WORDS.has(t.toLowerCase()));
  const hasMultiple = allTokens.length > 1;

  // 1. Full
  tiers.push({ name: "full", words: allTokens, isSiglas: false, isStacked: false });

  // 2. 3-chars with stop words
  if (allTokens.some(t => t.length > 3)) {
    const w3With = allTokens.map(t => STOP_WORDS.has(t.toLowerCase()) ? t.toLowerCase() : shorten(t,3));
    tiers.push({ name: "3-chars-with", words: w3With });
  }

  // 3. 3-chars without stop words
  if (hasMultiple && sigTokens.length > 0) {
    tiers.push({ name: "3-chars-no", words: sigTokens.map(t => shorten(t,3)) });
  }

  // 4. 2-chars with stop words
  if (allTokens.some(t => t.length > 2)) {
    const w2With = allTokens.map(t => STOP_WORDS.has(t.toLowerCase()) ? t.toLowerCase() : shorten(t,2));
    tiers.push({ name: "2-chars-with", words: w2With });
  }

  // 5. 2-chars without stop words
  if (hasMultiple && sigTokens.length > 0) {
    tiers.push({ name: "2-chars-no", words: sigTokens.map(t => shorten(t,2)) });
  }

  // 6. Siglas inline
  const sigBase = sigTokens.length > 0 ? sigTokens : allTokens;
  const initials = sigBase.map(t => t[0].toUpperCase()).join("");
  const officialShort = lesson && lesson.subjectShortNames && lesson.subjectShortNames[0] != null
    ? String(lesson.subjectShortNames[0]).trim() : null;
  const siglas = (officialShort && officialShort.length <= 4 &&
    officialShort.toLowerCase() !== String(fullName).toLowerCase())
    ? officialShort : initials;

  if (siglas.length > 1) {
    tiers.push({ name: "siglas-inline", words: [siglas], isSiglas: true, isStacked: false });
  }

  // 7. Siglas stacked
  tiers.push({ name: "siglas-stacked", words: siglas.split(""), isSiglas: false, isStacked: true });

  return tiers;
}

function getRoomCandidates(rawRoom) {
  if (!rawRoom) return [];
  // Quitar cualquier sufijo tipo _345 o _código numérico si viene de WebUntis
  const clean = String(rawRoom).replace(/_\d+$/, "").trim().replace(/\s+/g, "");
  if (!clean) return [];
  const candidates = [clean];
  if (/[0-9][A-Za-z]$/.test(clean)) candidates.push(clean.slice(0, -1));
  return candidates;
}

function getTeacherCandidates(rawTeacher) {
  if (!rawTeacher) return [];
  const clean = String(rawTeacher).replace(/-\d+$/, "").trim();
  if (!clean || clean.toUpperCase().startsWith("PGD")) return [];

  const parts = clean.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return [];
  if (parts.length === 1) return [clean];

  // Detect compound surname prefix at the end (e.g., "de la Cruz", "San Martin", "del Rio")
  const prefixes = ["de la", "de las", "del", "de", "la", "las", "los", "san", "santa"];
  let surname = parts[parts.length - 1];
  let firstNameParts = parts.slice(0, -1);

  if (parts.length >= 3) {
    const twoBefore = parts.slice(-3, -1).join(" ").toLowerCase();
    if (twoBefore === "de la" || twoBefore === "de las") {
      surname = parts.slice(-3).join(" ");
      firstNameParts = parts.slice(0, -3);
    }
  }
  if (firstNameParts.length === parts.slice(0, -1).length && parts.length >= 2) {
    const oneBefore = parts[parts.length - 2].toLowerCase();
    if (prefixes.includes(oneBefore)) {
      surname = parts.slice(-2).join(" ");
      firstNameParts = parts.slice(0, -2);
    }
  }

  if (firstNameParts.length === 0) {
    firstNameParts = [parts[0]];
    surname = parts.slice(1).join(" ");
  }

  const candidates = [];
  // 1. Nombre completo
  candidates.push(clean);

  // 2. Iniciales de nombres + apellido ("F. J. Velasco")
  if (firstNameParts.length >= 2) {
    const inits = firstNameParts.map(p => `${p[0].toUpperCase()}.`).join(" ");
    candidates.push(`${inits} ${surname}`);
  }

  // 3. Inicial de primer nombre + apellido ("A. Ercoreca")
  const firstInit = firstNameParts[0][0].toUpperCase();
  candidates.push(`${firstInit}. ${surname}`);

  // 4. Solo apellido ("Ercoreca")
  candidates.push(surname);

  return [...new Set(candidates.filter(Boolean))];
}

function getBadgeCandidates(rawType) {
  if (!rawType) return [];
  const raw = String(rawType).trim();
  const upper = raw.toUpperCase();

  if (isMagistralType(raw)) {
    const candidates = [];
    if (upper.includes("MAGIS"))         { candidates.push("Magistral","Magis","M"); }
    else if (upper.startsWith("GA") || upper.startsWith("G.A.")) { candidates.push("GA"); }
    else if (upper === "T" || upper.startsWith("T0") || upper.includes("TEOR")) { candidates.push("Teoría","Teor","T"); }
    else candidates.push(raw);
    return [...new Set(candidates)];
  }

  const candidates = [raw];
  const numMatch = raw.match(/\d+/);
  const subNum = extractSubgroupNumber(raw) ?? (numMatch ? parseInt(numMatch[0],10) : null);

  if (upper.includes("LAB")) {
    if (subNum != null) candidates.push(`P. Lab ${subNum}`);
    candidates.push("P. Lab","PLab");
  } else if (upper.includes("ORD")) {
    if (subNum != null) candidates.push(`P. Ord ${subNum}`);
    candidates.push("P. Ord","POrd");
  } else if (upper.includes("SEM")) {
    if (subNum != null) candidates.push(`Sem. ${subNum}`);
    candidates.push("Seminario","Sem.");
  }

  const subKey = extractSubgroupKey(raw);
  if (subKey) {
    candidates.push(subKey);
    const letters = subKey.match(/^[A-Za-z]+/)?.[0] || "";
    const digits  = subKey.match(/\d+$/)?.[0] || "";
    if (letters && digits) candidates.push(`${letters} ${digits}`);
  }

  if (subNum != null) candidates.push(String(subNum));

  const cleaned = raw.replace(/[.\-,\s]/g, "");
  if (cleaned && cleaned.length <= 8) candidates.push(cleaned);

  return [...new Set(candidates)];
}

function isMagistralType(rawType) {
  if (!rawType) return false;
  const raw = String(rawType).trim();
  const upper = raw.toUpperCase();
  const subNum = extractSubgroupNumber(raw);
  return (
    upper.includes("MAGIS") || upper === "M" || upper === "GA" ||
    upper.startsWith("GA ") || upper.startsWith("G.A.") ||
    upper === "T" || upper.startsWith("T0") || upper.includes("TEOR")
  ) && subNum == null;
}

let _measureCanvas = null;
let _measureCtx = null;

// Mide el ancho en fuentes proporcionales (San Francisco / Roboto)
function measureText(text, fontSize, bold = false) {
  if (!text) return 0;
  if (typeof document !== 'undefined') {
    if (!_measureCanvas) {
      _measureCanvas = document.createElement('canvas');
      _measureCtx = _measureCanvas.getContext('2d');
    }
    const weight = bold ? 'bold' : 'normal';
    _measureCtx.font = `${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    return _measureCtx.measureText(text).width;
  }
  const factor = bold ? 1.05 : 1.0;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ("mwMW".includes(ch)) total += 0.88;
    else if ("ijlrtfI .,:;!\'-|()".includes(ch)) total += 0.31;
    else if (ch >= 'A' && ch <= 'Z') total += 0.67;
    else if (ch >= '0' && ch <= '9') total += 0.57;
    else total += 0.52;
  }
  return total * fontSize * factor;
}

// Intenta ajustar palabras en líneas que caben en maxWidth
function wrapWords(words, fontSize, maxWidth, bold = false) {
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    const wordW = measureText(word, fontSize, bold);
    if (wordW > maxWidth + 1) return null;
    const testLine = currentLine === "" ? word : `${currentLine} ${word}`;
    if (measureText(testLine, fontSize, bold) <= maxWidth + 1) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// computeFullBlockLayout — port 1:1 de LayoutEngine.computeFullBlockLayout
function computeFullBlockLayout(lesson, blockW, blockH, scale, isDayView, widgetWidthDp = 260) {
  const padX    = isDayView ? 4 * scale : 2.5 * scale;
  const availW  = Math.max(0, blockW - padX * 2);
  const availH  = Math.max(0, blockH - 4 * scale);

  // Escala de fuente adaptativa: base generosa para móvil y extra grande para iPad (XXL)
  const t = Math.max(0, Math.min(1, ((widgetWidthDp || 260) - 180) / (400 - 180)));
  const extraIpadScale = widgetWidthDp > 450 ? Math.min(0.35, ((widgetWidthDp - 450) / 300) * 0.35) : 0;
  const fontScale = isDayView
    ? (1.05 + 0.15 * Math.sqrt(t) + extraIpadScale)
    : (1.0 + extraIpadScale * 0.7);

  const isMagistral = isMagistralType(lesson.type);

  // — Badge (cápsula equilibrada con padding simétrico) —
  let bestBadgeText = null;
  let bestBadgeFont = (isDayView ? 9 : 8) * scale;
  let bestBadgeHeight = 0;

  // Si la lección tiene la flag de supresión de badge magistral en cascada, no calcular badge
  const suppressBadge = !!(lesson._suppressMagistralBadge && isMagistral);

  const badgeCandidates = suppressBadge ? [] : getBadgeCandidates(lesson.type);

  const badgeFonts = isDayView
    ? (blockH < 55 * scale ? [8.5, 8, 7.5] : [9.5, 9, 8.5, 8]).map(f => f * scale * fontScale)
    : [8, 7.5, 7, 6.5].map(f => f * scale);

  badgeLoop: for (const bText of badgeCandidates) {
    for (const bFont of badgeFonts) {
      const badgePadX = (isDayView ? 5.5 : 4.5) * scale;
      const w = measureText(bText, bFont, true) + badgePadX * 2;
      if (w <= availW) {
        bestBadgeText = bText;
        bestBadgeFont = bFont;
        bestBadgeHeight = Math.round(bFont + 5 * scale);
        break badgeLoop;
      }
    }
  }

  // — Profesor —
  let rawTeacher = null;
  if (lesson.teachers && lesson.teachers[0] != null) {
    const t0 = lesson.teachers[0];
    rawTeacher = typeof t0 === 'string' ? t0.trim() : (t0.name || t0.longName || String(t0));
  }
  const teacherCandidates = isDayView && rawTeacher ? getTeacherCandidates(String(rawTeacher).trim()) : [];
  const teacherFonts = (blockH < 50 * scale ? [8, 7.5, 7] : [9, 8.5, 8, 7.5]).map(f => f * scale * fontScale);

  // — Aula —
  const rawRoom = lesson.rooms && lesson.rooms[0] != null ? String(lesson.rooms[0]).trim() : null;
  const roomCandidates = getRoomCandidates(rawRoom);
  const roomFonts = isDayView
    ? (blockH < 50 * scale ? [8, 7.5, 7] : [9, 8.5, 8, 7.5]).map(f => f * scale * fontScale)
    : [7.5, 7, 6.5, 6].map(f => f * scale);

  // — Asignatura —
  const fullName = (lesson.subjects && lesson.subjects[0] != null)
    ? String(lesson.subjects[0])
    : ((lesson.subjectShortNames && lesson.subjectShortNames[0] != null) ? String(lesson.subjectShortNames[0]) : "");
  const tiers = buildSubjectTiers(fullName, lesson);
  const subjectFonts = isDayView
    ? (blockH < 32 * scale
        ? [10, 9.5, 9, 8.5, 8]
        : (blockH < 52 * scale
            ? [12, 11.5, 11, 10.5, 10, 9.5, 9]
            : (blockH < 75 * scale
                ? [14, 13.5, 13, 12, 11, 10.5, 10]
                : [16, 15, 14, 13, 12, 11, 10.5]))
      ).map(f => f * scale * fontScale)
    : (blockH < 45 * scale
        ? [9, 8.5, 8, 7.5, 7]
        : (blockH < 70 * scale
            ? [10.5, 10, 9.5, 9, 8.5]
            : [12, 11.5, 11, 10.5, 10])
      ).map(f => f * scale * (1.0 + extraIpadScale * 0.5));

  // Tolerancias estrictas para el badge: si no hay suficiente espacio vertical, se oculta para priorizar texto grande.
  // IMPORTANTE: Esto SOLO se aplica a badges de formato genérico (Magistral o GA sin subgrupo).
  // Los subgrupos específicos (S-1, S-2, PLab, Sem, GL, etc.) son críticos y NUNCA se ocultan voluntariamente.
  const canTeacher = isDayView && blockH >= 48 * scale && teacherCandidates.length > 0;
  const canRoom    = roomCandidates.length > 0 && blockH >= (isDayView ? 24 : 20) * scale;
  const canBadge   = isMagistral
    ? (bestBadgeText != null && blockH >= (isDayView ? 56 * scale : 50 * scale))
    : (bestBadgeText != null && blockH >= 20 * scale);

  const attempts = [];

  if (isMagistral) {
    // Para clases magistrales o GA genéricas: se prioriza ganar espacio y agrandar el texto del título
    if (canBadge && canRoom && canTeacher) attempts.push({badge:true,  room:true,  teacher:true});
    if (canBadge && canRoom)               attempts.push({badge:true,  room:true,  teacher:false});
    if (canRoom  && canTeacher)            attempts.push({badge:false, room:true,  teacher:true});
    if (canRoom)                           attempts.push({badge:false, room:true,  teacher:false});
    if (canBadge && canTeacher)            attempts.push({badge:true,  room:false, teacher:true});
    if (canBadge)                          attempts.push({badge:true,  room:false, teacher:false});
    if (canTeacher)                        attempts.push({badge:false, room:false, teacher:true});
                                           attempts.push({badge:false, room:false, teacher:false});
  } else {
    // Para subgrupos (S-1, S-2, PLab, etc.): el subgrupo es indispensable y NUNCA se omite si cabe en el bloque
    if (canBadge && canRoom && canTeacher) attempts.push({badge:true,  room:true,  teacher:true});
    if (canBadge && canRoom)               attempts.push({badge:true,  room:true,  teacher:false});
    if (canBadge && canTeacher)            attempts.push({badge:true,  room:false, teacher:true});
    if (canBadge)                          attempts.push({badge:true,  room:false, teacher:false});
    // Solo si el badge no cabe físicamente de ningún modo (bloque diminuto < 20pt)
    if (canRoom  && canTeacher)            attempts.push({badge:false, room:true,  teacher:true});
    if (canRoom)                           attempts.push({badge:false, room:true,  teacher:false});
    if (canTeacher)                        attempts.push({badge:false, room:false, teacher:true});
                                           attempts.push({badge:false, room:false, teacher:false});
  }

  for (const attempt of attempts) {
    const badgeMarginTop = (blockH < 55 * scale ? 1.5 : 2.5) * scale;
    const badgeMarginBottom = (blockH < 55 * scale ? 1.5 : 2.5) * scale;
    const curBadgeOccupied = (attempt.badge && bestBadgeText)
      ? (badgeMarginTop + bestBadgeHeight + badgeMarginBottom)
      : (blockH < 30 * scale ? 1 : (blockH < 45 * scale ? 2 : 4)) * scale;
    const curBadgeText = attempt.badge ? bestBadgeText : null;

    // Profesor
    let chosenTeacher = null, chosenTeacherFont = 8 * scale, curTeacherH = 0;
    if (attempt.teacher && teacherCandidates.length > 0) {
      let found = false;
      for (const tText of teacherCandidates) {
        for (const tFont of teacherFonts) {
          if (measureText(tText, tFont, true) <= availW) {
            chosenTeacher = tText; chosenTeacherFont = tFont;
            const tLineH = Math.round(tFont * 1.15);
            const tMarginB = (blockH < 45 * scale ? 2 : 3) * scale;
            curTeacherH = tLineH + tMarginB;
            found = true; break;
          }
        }
        if (found) break;
      }
      if (!found) continue;
    }

    // Aula
    let chosenRoom = null, chosenRoomFont = 8 * scale, curRoomH = 0;
    if (attempt.room && roomCandidates.length > 0) {
      let found = false;
      for (const rText of roomCandidates) {
        for (const rFont of roomFonts) {
          if (measureText(rText, rFont, false) <= availW) {
            chosenRoom = rText; chosenRoomFont = rFont;
            const rLineH = Math.round(rFont * 1.15);
            const rMarginB = (blockH < 45 * scale ? 2 : 3) * scale;
            const rTeacherGap = (blockH < 45 * scale ? 1.5 : 2.5) * scale;
            curRoomH = rLineH + (attempt.teacher && chosenTeacher ? rTeacherGap : rMarginB);
            found = true; break;
          }
        }
        if (found) break;
      }
      if (!found) continue;
    }

    const bottomMarginTop = (blockH < 45 * scale ? 2.5 : 4) * scale;
    const curBottomOccupied = (curTeacherH > 0 || curRoomH > 0)
      ? (curTeacherH + curRoomH + bottomMarginTop)
      : (blockH < 30 * scale ? 1 : (blockH < 45 * scale ? 3 : 5)) * scale;

    const remainingMiddleH = blockH - curBadgeOccupied - curBottomOccupied;
    if (remainingMiddleH < (blockH < 30 * scale ? 4 : (blockH < 45 * scale ? 7 : 10)) * scale) continue;

    // Si se propone badge genérico (Magistral o GA sin subgrupo) pero el espacio restante para la asignatura queda muy apretado (< 26pt),
    // descartar el intento con badge para que entre el intento sin badge con texto mucho más grande.
    // Los subgrupos específicos (S-1, PLab, etc.) JAMÁS se descartan por este motivo.
    if (isMagistral && attempt.badge && remainingMiddleH < (blockH < 55 * scale ? 26 : 22) * scale) continue;

    for (const tier of tiers) {
      const tierFonts = (!isDayView && tier.isStacked)
        ? [9, 8.5, 8, 7.5, 7].map(f => f * scale)
        : subjectFonts;

      // Priorizar 1 sola línea si cabe con un tamaño de fuente legible (≥ 9)
      if (isDayView && !tier.isStacked) {
        const fullTierText = tier.words.join(" ");
        for (const sFont of tierFonts) {
          if (blockH >= 32 * scale && sFont < 9 * scale * fontScale) break;
          if (measureText(fullTierText, sFont, true) <= availW) {
            const lineH = Math.round(sFont * 1.22);
            if (lineH <= remainingMiddleH) {
              return {
                badgeText: curBadgeText, badgeFont: bestBadgeFont, badgeHeight: bestBadgeHeight,
                subjectLines: [fullTierText], subjectFont: sFont, subjectLineH: lineH,
                roomText: chosenRoom, roomFont: chosenRoomFont,
                teacherText: chosenTeacher, teacherFont: chosenTeacherFont
              };
            }
          }
        }
      }

      for (const sFont of tierFonts) {
        let lines;
        if (tier.isStacked) {
          lines = tier.words.every(w => measureText(w, sFont, true) <= availW) ? tier.words : null;
        } else {
          lines = wrapWords(tier.words, sFont, availW, true);
        }
        if (lines) {
          if (!isDayView && lines.length > (blockH < 50 * scale ? 2 : (blockH < 75 * scale ? 2 : 3))) continue;
          const lineH = Math.round(sFont * 1.22);
          if (lines.length * lineH <= remainingMiddleH) {
            return {
              badgeText: curBadgeText, badgeFont: bestBadgeFont, badgeHeight: bestBadgeHeight,
              subjectLines: lines, subjectFont: sFont, subjectLineH: lineH,
              roomText: chosenRoom, roomFont: chosenRoomFont,
              teacherText: chosenTeacher, teacherFont: chosenTeacherFont
            };
          }
        }
      }
    }
  }

  // Fallback garantizado
  const fallbackTier = tiers.find(t => t.isSiglas) || tiers[tiers.length - 1];
  const fallbackLines = fallbackTier ? fallbackTier.words : [fullName.substring(0,10)];

  let fallbackBadge = null, fallbackBadgeH = 0, fallbackRoom = null;
  if (!isMagistral) {
    if (canBadge && blockH >= 52 * scale) { fallbackBadge = bestBadgeText; fallbackBadgeH = bestBadgeHeight; }
    else if (canRoom && roomCandidates.length > 0 && blockH >= 24 * scale) fallbackRoom = roomCandidates[0];
  } else {
    if (canRoom && roomCandidates.length > 0 && blockH >= 24 * scale) fallbackRoom = roomCandidates[0];
    else if (canBadge && blockH >= 56 * scale) { fallbackBadge = bestBadgeText; fallbackBadgeH = bestBadgeHeight; }
  }

  const fbSFont = (blockH < 30 * scale ? 8.5 : (isDayView ? 10 : 8)) * scale * fontScale;
  return {
    badgeText: fallbackBadge, badgeFont: bestBadgeFont, badgeHeight: fallbackBadgeH,
    subjectLines: fallbackLines, subjectFont: fbSFont, subjectLineH: Math.round(fbSFont * 1.22),
    roomText: fallbackRoom, roomFont: (isDayView ? 8 : 6.5) * scale,
    teacherText: null, teacherFont: (isDayView ? 8 : 6.5) * scale
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO G — MOTOR DE RENDERIZADO (DrawContext)
//  Port 1:1 de: TimetableRenderEngine.kt
// ════════════════════════════════════════════════════════════════════════════

// Desatura un color hex (aproximación)
function desaturateHex(hex, amount = 0.55) {
  const r = parseInt(hex.slice(1,3), 16) / 255;
  const g = parseInt(hex.slice(3,5), 16) / 255;
  const b = parseInt(hex.slice(5,7), 16) / 255;
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const nr = r + (gray - r) * amount;
  const ng = g + (gray - g) * amount;
  const nb = b + (gray - b) * amount;
  const toHex = v => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

// Dibuja rectángulo redondeado en DrawContext usando addRoundedRect nativo de iOS
function drawRoundRect(dc, x, y, w, h, r) {
  const path = new Path();
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  path.addRoundedRect(new Rect(x, y, w, h), radius, radius);
  dc.addPath(path);
}

// Calcula el punto exacto a distancia d a lo largo del perímetro cerrado de un rectángulo redondeado.
// Permite trazar un borde discontinuo continuo y uniforme cubriendo rectas y las 4 curvas de esquina.
function getRoundRectPoint(d, x, y, w, h, rad) {
  const lTop = Math.max(0, w - 2 * rad);
  const lArc = 0.5 * Math.PI * rad;
  const lSide = Math.max(0, h - 2 * rad);

  let rem = d;

  // 0. Borde superior (izq a der)
  if (rem <= lTop) {
    return new Point(x + rad + rem, y);
  }
  rem -= lTop;

  // 1. Esquina superior-derecha (-PI/2 a 0)
  if (rem <= lArc) {
    const angle = -Math.PI / 2 + (rem / rad);
    return new Point(x + w - rad + rad * Math.cos(angle), y + rad + rad * Math.sin(angle));
  }
  rem -= lArc;

  // 2. Borde derecho (arriba a abajo)
  if (rem <= lSide) {
    return new Point(x + w, y + rad + rem);
  }
  rem -= lSide;

  // 3. Esquina inferior-derecha (0 a PI/2)
  if (rem <= lArc) {
    const angle = rem / rad;
    return new Point(x + w - rad + rad * Math.cos(angle), y + h - rad + rad * Math.sin(angle));
  }
  rem -= lArc;

  // 4. Borde inferior (der a izq)
  if (rem <= lTop) {
    return new Point(x + w - rad - rem, y + h);
  }
  rem -= lTop;

  // 5. Esquina inferior-izquierda (PI/2 a PI)
  if (rem <= lArc) {
    const angle = Math.PI / 2 + (rem / rad);
    return new Point(x + rad + rad * Math.cos(angle), y + h - rad + rad * Math.sin(angle));
  }
  rem -= lArc;

  // 6. Borde izquierdo (abajo a arriba)
  if (rem <= lSide) {
    return new Point(x, y + h - rad - rem);
  }
  rem -= lSide;

  // 7. Esquina superior-izquierda (PI a 3*PI/2)
  const angle = Math.PI + (Math.min(rem, lArc) / rad);
  return new Point(x + rad + rad * Math.cos(angle), y + rad + rad * Math.sin(angle));
}

// Dibuja borde discontinuo continuo (dashed) alrededor de un rect redondeado.
// Traza el perímetro completo al 100%, curvando perfectamente en las 4 esquinas redondeadas.
// Equivalente exacto de Android DashPathEffect(floatArrayOf(4dp, 3dp), 0f).
function drawDashedRoundRect(dc, x, y, w, h, r, dashLen, gapLen, color, alpha, lineWidth) {
  dc.setStrokeColor(new Color(color, alpha));
  dc.setLineWidth(lineWidth);

  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  const lTop = Math.max(0, w - 2 * rad);
  const lSide = Math.max(0, h - 2 * rad);
  const lArc = 0.5 * Math.PI * rad;
  const totalP = 2 * lTop + 2 * lSide + 4 * lArc;
  if (totalP <= 0) return;

  const path = new Path();
  let currentDist = 0;
  let isDash = true;

  while (currentDist < totalP) {
    const segLen = isDash ? dashLen : gapLen;
    const nextDist = Math.min(totalP, currentDist + segLen);

    if (isDash) {
      const ptStart = getRoundRectPoint(currentDist, x, y, w, h, rad);
      path.move(ptStart);
      const step = 1.5;
      for (let s = currentDist + step; s < nextDist; s += step) {
        path.addLine(getRoundRectPoint(s, x, y, w, h, rad));
      }
      path.addLine(getRoundRectPoint(nextDist, x, y, w, h, rad));
    }

    currentDist = nextDist;
    isDash = !isDash;
  }

  dc.addPath(path);
  dc.strokePath();
}


// Dibuja texto centrado horizontalmente en DrawContext
function drawCenteredText(dc, text, fontSize, isBold, color, alpha, cx, topY, maxW, lineH) {
  if (!text) return;
  dc.setFont(isBold ? Font.boldSystemFont(fontSize) : Font.systemFont(fontSize));
  dc.setTextColor(new Color(color, alpha !== undefined ? alpha : 1.0));
  const w = measureText(text, fontSize, isBold);
  const drawW = Math.min(w + 2, maxW || 9999);
  const drawX = Math.max(0, cx - drawW / 2);
  dc.drawTextInRect(text, new Rect(drawX, topY, drawW, lineH || fontSize * 1.3));
}

// Renderiza la cabecera (franja superior: texto a la izquierda y centrado en la vertical)
function drawHeader(dc, w, scale, isDark, headerText, settings) {
  const textColor = isDark ? new Color("#F8FAFC") : new Color("#0F172A");

  const fontSize = 11.5 * scale;
  const padX = 16 * scale;
  // Centrado vertical exacto en la franja superior (zona de 36pt hasta la cuadrícula horaria):
  // Con topY = 13.5pt, el texto queda a 13.5pt del borde superior del widget y a 13pt de la
  // primera línea horaria (36pt), logrando una simetría vertical perfecta y alineándose
  // de forma natural con el centro visual de la barra y el icono de ajustes.
  const topY = 13.5 * scale;
  const textH = 16 * scale;

  dc.setFont(Font.boldSystemFont(fontSize));
  dc.setTextColor(textColor);
  dc.setTextAlignedLeft();
  dc.drawTextInRect(headerText, new Rect(padX, topY, Math.max(10, w - padX - 44 * scale), textH));

  // En vista previa web (HTML/browser donde los stacks de Scriptable no existen),
  // dibujamos el icono de la rueda de ajustes directamente en el canvas.
  // En Scriptable nativo, la rueda se renderiza a través del WidgetStack settingsBtn
  // para ser 100% interactiva y clickable sin riesgo de solapamiento visual o ghosting.
  const isWebPreview = (typeof window !== 'undefined' || typeof document !== 'undefined');
  if (isWebPreview) {
    const gearImg = getAndroidGearImage(isDark);
    if (gearImg) {
      const gearSize = 16 * scale;
      const gearX = w - 14 * scale - gearSize;
      const gearY = 13.5 * scale;
      dc.drawImageInRect(gearImg, new Rect(gearX, gearY, gearSize, gearSize));
    }
  }
}

// Estado vacío / vacaciones / fin de curso (port 1:1 de TimetableRenderEngine.kt)
function drawEmptyOrBreakState(dc, w, h, scale, isDark, breakInfo, targetDate) {
  const textColor   = isDark ? "#F8FAFC" : "#0F172A";
  const subColor    = isDark ? "#94A3B8" : "#64748B";
  const accentColor = "#4F6EF7";

  // El centro vertical exacto del canvas recibido (h ya es la altura útil bajo la cabecera)
  const centerX = w / 2;
  const centerY = h / 2;

  dc.setTextAlignedCenter();

  if (breakInfo.type === "EXTENDED_BREAK") {
    // Número grande de días (Android: 34dp bold, baseline centerY - 10dp)
    const numStr = String(breakInfo.daysRemaining);
    dc.setFont(Font.boldSystemFont(34 * scale));
    dc.setTextColor(new Color(accentColor));
    dc.drawTextInRect(numStr, new Rect(0, centerY - 38 * scale, w, 40 * scale));

    // Texto de días (Android: 14dp bold, baseline centerY + 8dp)
    const unit = breakInfo.daysRemaining === 1 ? "día para volver a clase" : "días para volver a clase";
    dc.setFont(Font.boldSystemFont(14 * scale));
    dc.setTextColor(new Color(textColor));
    dc.drawTextInRect(unit, new Rect(0, centerY + 2 * scale, w, 18 * scale));

    // Fecha de retorno (Android: 11dp normal, baseline centerY + 26dp)
    if (breakInfo.returnDate) {
      const returnDay = getDayOfWeekName(breakInfo.returnDate);
      const returnStr = `Vuelves el ${returnDay[0].toUpperCase() + returnDay.slice(1)} ${formatDateShort(breakInfo.returnDate)}`;
      dc.setFont(Font.systemFont(11 * scale));
      dc.setTextColor(new Color(subColor));
      dc.drawTextInRect(returnStr, new Rect(0, centerY + 22 * scale, w, 16 * scale));
    }

  } else if (breakInfo.type === "END_OF_YEAR") {
    dc.setFont(Font.boldSystemFont(14 * scale));
    dc.setTextColor(new Color(textColor));
    dc.drawTextInRect("Fin de curso", new Rect(0, centerY - 15 * scale, w, 18 * scale));

    dc.setFont(Font.systemFont(11 * scale));
    dc.setTextColor(new Color(subColor));
    dc.drawTextInRect("No hay más clases programadas", new Rect(0, centerY + 5 * scale, w, 16 * scale));

  } else {
    // NO_CLASS_TODAY
    const dayName = getDayOfWeekName(targetDate);
    const dateStr = formatDateShort(targetDate);
    dc.setFont(Font.boldSystemFont(14 * scale));
    dc.setTextColor(new Color(textColor));
    dc.drawTextInRect("Sin clases hoy", new Rect(0, centerY - 15 * scale, w, 18 * scale));

    dc.setFont(Font.systemFont(11 * scale));
    dc.setTextColor(new Color(subColor));
    dc.drawTextInRect(`${dayName[0].toUpperCase() + dayName.slice(1)}, ${dateStr}`, new Rect(0, centerY + 5 * scale, w, 16 * scale));
  }
}

// Dibuja una tarjeta de lección individual (equivalente a drawLessonCard en Kotlin)
function drawLessonCard(dc, lesson, rect, isToday, nowMinutes, startMins, endMins, scale, isDark, accentColor, cornerRadius, isDayView, widgetWidthDp = 260, customColors = {}) {
  const bW = rect.width;
  const bH = rect.height;
  const cx = rect.x + bW / 2;
  const isPast = isToday && nowMinutes >= endMins;

  const subjectId = lesson.subjectIds && lesson.subjectIds[0] != null ? lesson.subjectIds[0] : 0;
  const rawColor  = getColorForSubject(subjectId, isDark, customColors);

  let bgHex     = rawColor.bg;
  let textHex   = rawColor.text;
  let bdHex     = rawColor.borderHex;
  let bdAlpha   = rawColor.borderAlpha;

  if (lesson.isDimmed) {
    bgHex   = desaturateHex(bgHex, 0.55);
    textHex = isDark ? "#94A3B8" : "#475569";
    bdHex   = desaturateHex(bdHex, 0.55);
    bdAlpha = isDark ? 0.25 : 0.20;
  }

  // Alpha del fondo: igual que Android (isDimmed: 115/255≈0.45; isPast dark: 133/255≈0.52, light: 148/255≈0.58)
  const bgAlpha = lesson.isDimmed ? (115/255) : (isPast ? (isDark ? 133/255 : 148/255) : 1.0);
  const contentAlpha = bgAlpha;

  // Fondo redondeado
  dc.setFillColor(new Color(bgHex, bgAlpha));
  drawRoundRect(dc, rect.x, rect.y, bW, bH, cornerRadius);
  dc.fillPath();

  // Borde
  if (lesson.isDimmed) {
    const dashColor = isDark ? "#FFFFFF" : "#000000";
    drawDashedRoundRect(dc, rect.x, rect.y, bW, bH, cornerRadius,
      4 * scale, 3 * scale, dashColor, 0.251, 1.2 * scale);
  } else {
    dc.setStrokeColor(new Color(bdHex, bdAlpha));
    dc.setLineWidth(1 * scale);
    drawRoundRect(dc, rect.x, rect.y, bW, bH, cornerRadius);
    dc.strokePath();
  }

  // Layout interno
  const layout = computeFullBlockLayout(lesson, bW, bH, scale, isDayView, widgetWidthDp);

  const top    = rect.y;
  const bottom = rect.y + bH;
  const padX   = (isDayView ? 4 : 2.5) * scale;
  const availW = Math.max(0, bW - padX * 2);

  // A) Badge superior centrado (cápsula equilibrada con padding y centrado vertical exacto)
  const badgeMarginTop = (bH < 55 * scale ? 1.5 : 2.5) * scale;
  const badgeMarginBottom = (bH < 55 * scale ? 1.5 : 2.5) * scale;

  if (layout.badgeText && layout.badgeHeight > 0) {
    const bText  = layout.badgeText;
    const bFont  = layout.badgeFont;
    const textW  = measureText(bText, bFont, true);
    const badgePadX = (isDayView ? 5.5 : 4.5) * scale;
    const badgeW = Math.round(textW + badgePadX * 2);
    const badgeH = layout.badgeHeight;
    const badgeTop = top + badgeMarginTop;
    const badgeX = Math.round(cx - badgeW / 2);
    const baseBadgeAlpha = isDark ? (0x38 / 255) : (0x26 / 255);
    const badgeAlpha = baseBadgeAlpha * contentAlpha;

    dc.setFillColor(isDark ? new Color("#FFFFFF", badgeAlpha) : new Color("#000000", badgeAlpha));
    drawRoundRect(dc, badgeX, badgeTop, badgeW, badgeH, Math.min(3.5 * scale, badgeH / 2));
    dc.fillPath();

    dc.setFont(Font.boldSystemFont(bFont));
    dc.setTextColor(new Color(lesson.isDimmed ? textHex : (isDark ? "#FFFFFF" : "#0F172A"), contentAlpha));
    dc.setTextAlignedCenter();

    // Centrado vertical exacto del glifo tipográfico en la cápsula
    const textY = badgeTop + Math.max(0.5, (badgeH - bFont * 1.15) / 2);
    dc.drawTextInRect(bText, new Rect(badgeX, textY, badgeW, bFont * 1.25));
  }

  // B) Profesor y Aula en la base con espaciado vertical respirable
  let teacherY = 0;
  let roomY = 0;

  if (layout.teacherText && layout.roomText) {
    const tFont = layout.teacherFont;
    const rFont = layout.roomFont;
    const tLineH = Math.round(tFont * 1.15);
    const rLineH = Math.round(rFont * 1.15);
    const teacherMarginB = (bH < 45 * scale ? 2 : 3) * scale;
    const roomTeacherGap = (bH < 45 * scale ? 1.5 : 2.5) * scale;

    teacherY = bottom - teacherMarginB - tLineH;
    roomY = teacherY - roomTeacherGap - rLineH;

    // Draw Teacher
    dc.setFont(Font.systemFont(tFont));
    dc.setTextColor(new Color(textHex, contentAlpha * 0.85));
    dc.setTextAlignedCenter();
    dc.drawTextInRect(layout.teacherText, new Rect(rect.x + padX, teacherY, availW, tLineH * 1.1));

    // Draw Room
    dc.setFont(Font.systemFont(rFont));
    dc.setTextColor(new Color(textHex, contentAlpha * 0.75));
    dc.setTextAlignedCenter();
    dc.drawTextInRect(layout.roomText, new Rect(rect.x + padX, roomY, availW, rLineH * 1.1));
  } else if (layout.teacherText) {
    const tFont = layout.teacherFont;
    const tLineH = Math.round(tFont * 1.15);
    const teacherMarginB = (bH < 45 * scale ? 2.5 : 3.5) * scale;
    teacherY = bottom - teacherMarginB - tLineH;

    dc.setFont(Font.systemFont(tFont));
    dc.setTextColor(new Color(textHex, contentAlpha * 0.85));
    dc.setTextAlignedCenter();
    dc.drawTextInRect(layout.teacherText, new Rect(rect.x + padX, teacherY, availW, tLineH * 1.1));
  } else if (layout.roomText) {
    const rFont = layout.roomFont;
    const rLineH = Math.round(rFont * 1.15);
    const roomMarginB = (bH < 45 * scale ? 2.5 : 3.5) * scale;
    roomY = bottom - roomMarginB - rLineH;

    dc.setFont(Font.systemFont(rFont));
    dc.setTextColor(new Color(textHex, contentAlpha * 0.75));
    dc.setTextAlignedCenter();
    dc.drawTextInRect(layout.roomText, new Rect(rect.x + padX, roomY, availW, rLineH * 1.1));
  }

  // C) Asignatura centrada vertical y horizontalmente en el espacio libre intermedio
  const topOccupied = (layout.badgeText && layout.badgeHeight > 0)
    ? (badgeMarginTop + layout.badgeHeight + badgeMarginBottom)
    : (bH < 30 * scale ? 1.5 : (bH < 45 * scale ? 2.5 : 4)) * scale;

  const bottomMarginTop = (bH < 45 * scale ? 2.5 : 4) * scale;
  const bottomOccupied = (layout.roomText || layout.teacherText)
    ? (bottom - (layout.roomText ? roomY : teacherY) + bottomMarginTop)
    : (bH < 30 * scale ? 1.5 : (bH < 45 * scale ? 2.5 : 4)) * scale;

  const availMiddleH = bottom - top - topOccupied - bottomOccupied;

  if (layout.subjectLines && layout.subjectLines.length > 0 && availMiddleH >= layout.subjectFont * 0.5) {
    dc.setFont(Font.boldSystemFont(layout.subjectFont));
    dc.setTextColor(new Color(textHex, contentAlpha));
    dc.setTextAlignedCenter();

    const totalSubjectH = layout.subjectLines.length * layout.subjectLineH;
    const verticalMiddleOffset = Math.max(0, (availMiddleH - totalSubjectH) / 2);
    let lineY = top + topOccupied + verticalMiddleOffset;
    const maxBottomLimit = bottom - bottomOccupied + bottomMarginTop;

    for (const line of layout.subjectLines) {
      if (lineY + layout.subjectFont > maxBottomLimit + 1 * scale) break;
      dc.drawTextInRect(line, new Rect(rect.x + padX, lineY, availW, layout.subjectLineH));
      lineY += layout.subjectLineH;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO G2 — SUPRESIÓN EN CASCADA DE BADGES MAGISTRALES
//  Cuando alguna lección GA/Magistral del período (día o semana) no puede
//  mostrar su badge por falta de espacio, se suprimen TODOS los badges
//  magistrales del mismo período para mantener coherencia visual.
//  Las etiquetas de subgrupos (GL, S, GO, etc.) NUNCA se ven afectadas.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Pre-calcula los layouts de un conjunto de lecciones y determina si los
 * badges magistrales deben suprimirse en cascada.
 * Retorna un Set de lessonKeys cuyo badge magistral debe ocultarse.
 */
function computeMagistralBadgeSuppression(lessons, getRect, scale, isDark, isDayView = true) {
  if (!lessons || lessons.length === 0) return new Set();

  // Paso 1: Calcular layout para cada lección magistral
  const magistralResults = []; // { key, hasBadge }

  for (const lesson of lessons) {
    if (!isMagistralType(lesson.type)) continue;
    const key = getLessonKey(lesson);
    const rect = getRect(lesson);
    if (!rect) continue;
    const layout = computeFullBlockLayout(lesson, rect.width, rect.height, scale, isDayView, rect.width / scale);
    magistralResults.push({ key, hasBadge: !!(layout.badgeText) });
  }

  // Paso 2: Si alguno NO tiene badge, suprimir TODOS
  const anyMissingBadge = magistralResults.some(r => !r.hasBadge);
  if (!anyMissingBadge) return new Set(); // Todos tienen badge → no suprimir

  // Retornar el conjunto de keys cuyos badges deben ocultarse
  return new Set(magistralResults.map(r => r.key));
}


function renderTimetable(dc, w, h, targetDate, allLessons, isDark, nowTime, scale, customColors = {}) {
  const safeW = Math.max(200, w);
  const safeH = Math.max(100, h);

  const isToday   = sameDay(targetDate, nowTime);
  const nowMinutes= nowTime.getHours() * 60 + nowTime.getMinutes();
  const accentColor = new Color("#4F6EF7");

  const targetDateNum = toDateNumber(targetDate);
  const mergedLessons = mergeConsecutiveBlocks(allLessons);
  const dayLessons = getLessonsForDate(mergedLessons, targetDateNum, true);

  if (dayLessons.length === 0) {
    const breakInfo = analyzeBreakStreak(targetDate, mergedLessons);
    drawEmptyOrBreakState(dc, safeW, safeH, scale, isDark, breakInfo, targetDate);
    return;
  }

  const timeRange    = computeVisibleTimeRange(dayLessons, isToday, nowMinutes);
  const timeAxisW    = 38 * scale;
  const rightMargin  = 8 * scale;
  const topPad       = 4 * scale;
  const bottomPad    = 18 * scale; // Margen inferior calculado para que la última hora (14:00) y tarjetas liberen la curva de esquina de 22pt
  const contentH     = safeH - topPad - bottomPad;

  function getY(mins) {
    const clamped = Math.max(timeRange.startMinutes, Math.min(timeRange.endMinutes, mins));
    return topPad + ((clamped - timeRange.startMinutes) / timeRange.totalMinutes) * contentH;
  }

  const dividerColor   = isDark ? new Color("#1C2940") : new Color("#E2E8F0");
  const gridHourColor  = isDark ? new Color("#1C2940") : new Color("#EEF2F6");
  const gridHalfColor  = isDark ? new Color("#152033") : new Color("#F8FAFC");
  const textMajorColor = isDark ? new Color("#94A3B8") : new Color("#334155");
  const textMinorColor = isDark ? new Color("#64748B") : new Color("#64748B");

  // Línea divisoria vertical
  dc.setFillColor(dividerColor);
  dc.fillRect(new Rect(timeAxisW - 0.5 * scale, topPad, 0.5 * scale, safeH - topPad - bottomPad));

  // Cuadrícula y etiquetas de horas
  for (let h2 = timeRange.firstHour; h2 <= timeRange.lastHour; h2++) {
    const y = getY(h2 * 60);

    // Línea hora entera
    dc.setFillColor(gridHourColor);
    dc.fillRect(new Rect(timeAxisW, y, safeW - timeAxisW - rightMargin, 0.5 * scale));

    // Etiqueta hora (alineada a la derecha del eje con margen izquierdo seguro)
    dc.setTextAlignedRight();
    dc.setFont(Font.boldSystemFont(9.5 * scale));
    dc.setTextColor(textMajorColor);
    const label = `${h2}:00`;
    dc.drawTextInRect(label, new Rect(4 * scale, y - 5 * scale, timeAxisW - 8 * scale, 11 * scale));

    // Media hora
    const halfMins = h2 * 60 + 30;
    if (halfMins < timeRange.endMinutes && h2 < timeRange.lastHour) {
      const halfY = getY(halfMins);
      dc.setFillColor(gridHalfColor);
      dc.fillRect(new Rect(timeAxisW, halfY, safeW - timeAxisW - rightMargin, 0.5 * scale));

      // Solo dibujar texto de media hora si hay suficiente espacio vertical para no solaparse con las horas
      const nextHourY = getY((h2 + 1) * 60);
      if (nextHourY - y >= 20 * scale) {
        dc.setTextAlignedRight();
        dc.setFont(Font.systemFont(7.5 * scale));
        dc.setTextColor(textMinorColor);
        const hLabel = `${h2}:30`;
        dc.drawTextInRect(hLabel, new Rect(4 * scale, halfY - 4 * scale, timeAxisW - 8 * scale, 10 * scale));
      }
    }
  }

  // Renderizar tarjetas de lección
  updateSubjectColors(allLessons);
  const placements = arrangeColumns(dayLessons);
  const contentW   = safeW - timeAxisW - rightMargin;

  const vMargin      = 2 * scale;
  const hMargin      = 2 * scale;
  const cornerRadius = 10 * scale; // Android: 10f * density

  // Función para calcular el rect de un bloque (necesario para la supresión en cascada)
  function getDayRect(lesson) {
    const key = getLessonKey(lesson);
    const placement = placements.get(key) || { colIdx:0, span:1, totalColumns:1 };
    const colW = contentW / Math.max(1, placement.totalColumns);
    const left = timeAxisW + placement.colIdx * colW + hMargin;
    const right = left + colW * placement.span - hMargin * 2;
    const sM = toMinutes(lesson.startTime);
    const eM = toMinutes(lesson.endTime);
    const top2 = getY(sM) + vMargin;
    const bot = Math.max(top2 + 1, getY(eM) - vMargin);
    const blockH = bot - top2;
    return new Rect(left, top2, right - left, blockH);
  }

  // Supresión en cascada: si algún magistral del día no tiene badge, quitar todos
  const suppressedMagistralKeys = computeMagistralBadgeSuppression(dayLessons, getDayRect, scale, isDark);

  for (const lesson of dayLessons) {
    const rect = getDayRect(lesson);
    const key  = getLessonKey(lesson);
    const actualRadius = Math.min(cornerRadius, rect.height * 0.4);

    // Aplicar supresión de badge magistral si corresponde
    const lessonToRender = suppressedMagistralKeys.has(key)
      ? { ...lesson, _suppressMagistralBadge: true }
      : lesson;

    const sM = toMinutes(lesson.startTime);
    const eM = toMinutes(lesson.endTime);
    drawLessonCard(dc, lessonToRender, rect, isToday, nowMinutes, sM, eM, scale, isDark, accentColor, actualRadius, true, safeW / scale, customColors);
  }
}


// renderWeekTimetable — vista semanal (port de TimetableRenderEngine.renderWeekTimetable)
function renderWeekTimetable(dc, w, h, weekStartDate, allLessons, isDark, nowTime, scale, customColors = {}) {
  const safeW = Math.max(300, w);
  const safeH = Math.max(100, h);

  const todayDate  = new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate());
  const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
  const accentColor= new Color("#4F6EF7");

  const weekDates   = [0,1,2,3,4].map(i => addDays(weekStartDate, i));
  const weekDateNums= weekDates.map(toDateNumber);

  const lessonsByDate = {};
  const mergedLessons = mergeConsecutiveBlocks(allLessons);
  for (const dateNum of weekDateNums) {
    lessonsByDate[dateNum] = getLessonsForDate(mergedLessons, dateNum, true);
  }
  const allWeekLessons = Object.values(lessonsByDate).flat();

  if (allWeekLessons.length === 0) {
    const breakInfo = analyzeBreakStreak(weekStartDate, mergedLessons);
    drawEmptyOrBreakState(dc, safeW, safeH, scale, isDark, breakInfo, weekStartDate);
    return;
  }

  const isCurrentWeek = weekDates.some(d => sameDay(d, todayDate));
  const timeRange = computeVisibleTimeRange(allWeekLessons, isCurrentWeek, nowMinutes);

  const timeAxisW  = 30 * scale;
  const dayHeaderH = 20 * scale;
  const topPad     = dayHeaderH + 4 * scale;
  const bottomPad  = 18 * scale;
  const rightMargin= 8 * scale;
  const contentH   = safeH - topPad - bottomPad;

  function getY(mins) {
    const clamped = Math.max(timeRange.startMinutes, Math.min(timeRange.endMinutes, mins));
    return topPad + ((clamped - timeRange.startMinutes) / timeRange.totalMinutes) * contentH;
  }

  const dividerColor   = isDark ? new Color("#1C2940") : new Color("#E2E8F0");
  const gridHourColor  = isDark ? new Color("#1C2940") : new Color("#EEF2F6");
  const textMajorColor = isDark ? new Color("#94A3B8") : new Color("#334155");
  const textSecColor   = isDark ? new Color("#94A3B8") : new Color("#64748B");
  const colDivColor    = isDark ? new Color("#152033") : new Color("#F1F5F9");

  const totalDaysW = safeW - timeAxisW - rightMargin;
  const colW       = totalDaysW / 5;
  const dayNames   = ["L","M","X","J","V"];

  // Línea horizontal bajo cabeceras
  dc.setFillColor(dividerColor);
  dc.fillRect(new Rect(timeAxisW, dayHeaderH - 0.5 * scale, safeW - timeAxisW - rightMargin, 0.5 * scale));
  // Línea vertical tras eje horario
  dc.fillRect(new Rect(timeAxisW - 0.5 * scale, 0, 0.5 * scale, safeH - bottomPad));

  // Cabeceras de días
  for (let i = 0; i < 5; i++) {
    const date      = weekDates[i];
    const colLeft   = timeAxisW + i * colW;
    const isToday2  = sameDay(date, todayDate);
    const headerCX  = colLeft + colW / 2;
    const headerCY  = dayHeaderH / 2;
    const dayText   = `${dayNames[i]} ${date.getDate()}`;

    if (isToday2) {
      // Cápsula azul para el día actual
      const textW   = measureText(dayText, 9 * scale, true);
      const pillW   = Math.max(textW + 10 * scale, 22 * scale);
      const pillH   = 14 * scale;
      const pillX   = headerCX - pillW / 2;
      const pillY   = headerCY - pillH / 2 - 2 * scale;
      dc.setFillColor(accentColor);
      drawRoundRect(dc, pillX, pillY, pillW, pillH, 7 * scale);
      dc.fillPath();
      dc.setTextAlignedCenter();
      dc.setFont(Font.boldSystemFont(9 * scale));
      dc.setTextColor(new Color("#FFFFFF"));
      dc.drawTextInRect(dayText, new Rect(pillX, pillY + 1.5 * scale, pillW, pillH));
    } else {
      dc.setTextAlignedCenter();
      dc.setFont(Font.systemFont(9 * scale));
      dc.setTextColor(textSecColor);
      dc.drawTextInRect(dayText, new Rect(colLeft, headerCY - 5 * scale, colW, 11 * scale));
    }

    // Divisores verticales entre columnas
    if (i > 0) {
      dc.setFillColor(colDivColor);
      dc.fillRect(new Rect(colLeft, dayHeaderH, 0.5 * scale, safeH - dayHeaderH - bottomPad));
    }
  }

  // Cuadrícula y etiquetas de horas
  for (let h2 = timeRange.firstHour; h2 <= timeRange.lastHour; h2++) {
    const y = getY(h2 * 60);
    dc.setFillColor(gridHourColor);
    dc.fillRect(new Rect(timeAxisW, y, safeW - timeAxisW - rightMargin, 0.5 * scale));
    dc.setTextAlignedRight();
    dc.setFont(Font.boldSystemFont(7.5 * scale));
    dc.setTextColor(textMajorColor);
    const label = `${h2}:00`;
    dc.drawTextInRect(label, new Rect(0, y - 4.5 * scale, timeAxisW - 3 * scale, 10 * scale));
  }


  // Tarjetas por día
  updateSubjectColors(allLessons);
  const vMargin      = 1.5 * scale;
  const hMargin      = 1.5 * scale;
  const cornerRadius = 7 * scale; // Android: 7f * density

  // Pre-calcular posiciones de todos los bloques de la semana y evaluar cascada semanal:
  // Si cualquier bloque GA/Magistral de la semana no cabe, se suprimen todos los de la semana.
  const lessonRects = new Map();
  const allWeekMagistrals = [];
  let anyMagistralMissingInWeek = false;

  for (let i = 0; i < 5; i++) {
    const dateNum   = weekDateNums[i];
    const dayLess   = lessonsByDate[dateNum] || [];
    const dayColX0  = timeAxisW + i * colW;
    const placements= arrangeColumns(dayLess);

    for (const lesson of dayLess) {
      const key       = getLessonKey(lesson);
      const placement = placements.get(key) || { colIdx:0, span:1, totalColumns:1 };
      const subColW   = (colW - hMargin * 2) / Math.max(1, placement.totalColumns);
      const left      = dayColX0 + hMargin + placement.colIdx * subColW;
      const right     = left + subColW * placement.span - hMargin * 2;
      const sM        = toMinutes(lesson.startTime);
      const eM        = toMinutes(lesson.endTime);
      const top2      = getY(sM) + vMargin;
      const bot       = Math.max(top2 + 1, getY(eM) - vMargin);
      const blockH    = bot - top2;
      const rect      = new Rect(left, top2, right - left, blockH);
      lessonRects.set(key, rect);

      if (isMagistralType(lesson.type)) {
        allWeekMagistrals.push(key);
        const layout = computeFullBlockLayout(lesson, rect.width, rect.height, scale, false, safeW / scale);
        if (!layout.badgeText) {
          anyMagistralMissingInWeek = true;
        }
      }
    }
  }

  const suppressedWeekKeys = anyMagistralMissingInWeek ? new Set(allWeekMagistrals) : new Set();

  for (let i = 0; i < 5; i++) {
    const date      = weekDates[i];
    const dateNum   = weekDateNums[i];
    const dayLess   = lessonsByDate[dateNum] || [];
    const isToday2  = sameDay(date, todayDate);

    for (const lesson of dayLess) {
      const key  = getLessonKey(lesson);
      const rect = lessonRects.get(key);
      if (!rect) continue;
      const actualRadius = Math.min(cornerRadius, rect.height * 0.4);

      const lessonToRender = suppressedWeekKeys.has(key)
        ? { ...lesson, _suppressMagistralBadge: true }
        : lesson;

      const sM = toMinutes(lesson.startTime);
      const eM = toMinutes(lesson.endTime);
      drawLessonCard(dc, lessonToRender, rect, isToday2, nowMinutes, sM, eM, scale, isDark, accentColor, actualRadius, false, safeW / scale, customColors);
    }
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO H — PANTALLA DE AJUSTES (UITable)
//  Equivalente funcional a: WidgetConfigureActivity.kt
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO H — PANTALLA DE AJUSTES (WebView — Diseño fiel 1:1 de Android)
//  Equivalente visual y funcional a: WidgetConfigureActivity.kt
// ════════════════════════════════════════════════════════════════════════════

function getSettingsHTML(settings, userData, scriptName, instanceId) {
  const safeSettings = JSON.stringify(settings || defaultSettings()).replace(/<\/script/gi, '<\\/script');
  const safeUserData = JSON.stringify(userData || null).replace(/<\/script/gi, '<\\/script');
  const safeScriptName = encodeURIComponent(scriptName || "EHUntis");
  const safeInstanceId = JSON.stringify(instanceId || null);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Ajustes del Widget</title>
  <style>
    :root {
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --surface-variant: #F1F5F9;
      --border: rgba(226, 232, 240, 0.9);
      --text: #0F172A;
      --text-muted: #64748B;
      --primary: #4F6EF7;
      --primary-active: #3B5BDB;
      --primary-light: rgba(79, 110, 247, 0.08);
      --primary-tint: rgba(79, 110, 247, 0.12);
      --success: #10B981;
      --danger: #EF4444;
      --card-radius: 16px;
      --elem-radius: 12px;
      --btn-radius: 14px;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    @media (prefers-color-scheme: dark) {
      :root[data-theme="system"] {
        --bg: #0B0F17;
        --surface: #1E293B;
        --surface-variant: #0F172A;
        --border: #334155;
        --text: #F8FAFC;
        --text-muted: #94A3B8;
        --primary-light: rgba(79, 110, 247, 0.18);
        --primary-tint: rgba(79, 110, 247, 0.22);
      }
    }

    :root[data-theme="dark"] {
      --bg: #0B0F17;
      --surface: #1E293B;
      --surface-variant: #0F172A;
      --border: #334155;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --primary-light: rgba(79, 110, 247, 0.18);
      --primary-tint: rgba(79, 110, 247, 0.22);
    }

    :root[data-theme="light"] {
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --surface-variant: #F1F5F9;
      --border: rgba(226, 232, 240, 0.9);
      --text: #0F172A;
      --text-muted: #64748B;
      --primary-light: rgba(79, 110, 247, 0.08);
      --primary-tint: rgba(79, 110, 247, 0.12);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-family);
      font-size: 14px;
      line-height: 1.4;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
      -webkit-user-select: none;
    }

    .header {
      padding: 18px 16px 12px 16px;
      text-align: center;
      background: var(--bg);
    }
    .header h1 {
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.2px;
    }
    .header p {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 2px;
      font-weight: 500;
    }

    .container {
      flex: 1;
      padding: 0 16px 110px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--card-radius);
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .card-title {
      font-size: 14.5px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 10px;
    }

    .account-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .account-logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #FFFFFF;
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .account-logo img {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      object-fit: contain;
    }
    .account-info {
      flex: 1;
      min-width: 0;
    }
    .account-status-line {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--success);
      flex-shrink: 0;
    }
    .status-dot.disconnected {
      background: var(--danger);
    }
    .account-subtitle {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 1px;
    }
    .btn-text {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 8px;
      font-family: inherit;
    }
    .btn-text:active {
      opacity: 0.7;
    }

    .input-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 4px;
      display: block;
    }
    .text-input {
      width: 100%;
      height: 46px;
      background: var(--surface-variant);
      border: 1px solid var(--border);
      border-radius: var(--elem-radius);
      padding: 0 14px;
      font-size: 14.5px;
      color: var(--text);
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    .text-input:focus {
      border-color: var(--primary);
      background: var(--surface);
    }
    .form-buttons {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .btn-outlined {
      flex: 1;
      height: 42px;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: var(--elem-radius);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-outlined:active {
      background: var(--surface-variant);
    }
    .btn-filled {
      flex: 1.5;
      height: 42px;
      background: var(--primary);
      border: none;
      color: #FFFFFF;
      border-radius: var(--elem-radius);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
    }
    .btn-filled:active {
      background: var(--primary-active);
    }
    .btn-filled:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-msg {
      color: var(--danger);
      font-size: 11.5px;
      margin-top: 6px;
    }

    .radio-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .radio-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-radius: var(--elem-radius);
      background: var(--surface-variant);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .radio-item.selected {
      background: var(--primary-light);
      border: 1.5px solid var(--primary);
    }
    .radio-circle {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 10px;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .radio-item.selected .radio-circle {
      border-color: var(--primary);
    }
    .radio-circle-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--primary);
      opacity: 0;
      transform: scale(0.4);
      transition: all 0.15s ease;
    }
    .radio-item.selected .radio-circle-dot {
      opacity: 1;
      transform: scale(1);
    }
    .radio-label {
      flex: 1;
      min-width: 0;
    }
    .radio-title {
      font-size: 13.5px;
      font-weight: 500;
      color: var(--text);
    }
    .radio-item.selected .radio-title {
      font-weight: 700;
    }
    .radio-subtitle {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .segmented-grid {
      display: flex;
      gap: 8px;
    }
    .segmented-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 6px;
      border-radius: var(--elem-radius);
      background: var(--surface-variant);
      border: 1px solid var(--border);
      cursor: pointer;
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    .segmented-btn svg {
      width: 17px;
      height: 17px;
      fill: var(--text-muted);
      flex-shrink: 0;
      transition: fill 0.15s ease;
    }
    .segmented-btn.selected {
      background: var(--primary-tint);
      border: 1.5px solid var(--primary);
      color: var(--primary);
      font-weight: 700;
    }
    .segmented-btn.selected svg {
      fill: var(--primary);
    }

    .bottom-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 12px 16px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
      z-index: 100;
    }
    .bottom-content {
      max-width: 480px;
      margin: 0 auto;
    }
    .btn-primary {
      width: 100%;
      height: 50px;
      background: var(--primary);
      color: #FFFFFF;
      border: none;
      border-radius: var(--btn-radius);
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(79, 110, 247, 0.3);
      font-family: inherit;
      transition: background 0.15s;
    }
    .btn-primary:active {
      background: var(--primary-active);
    }
    .btn-primary:disabled {
      background: #94A3B8;
      box-shadow: none;
      cursor: not-allowed;
    }

    .toast {
      position: fixed;
      top: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: #0F172A;
      color: #FFFFFF;
      padding: 10px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      z-index: 200;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(4px);
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <div id="toast" class="toast">✓ Ajustes guardados</div>

  <div class="header">
    <h1>Ajustes del Widget</h1>
    <p>EHUntis para UPV/EHU</p>
  </div>

  <div class="container" id="app"></div>

  <div class="bottom-bar">
    <div class="bottom-content">
      <button id="btn-save" class="btn-primary" onclick="handleSave()">Guardar y actualizar widget</button>
    </div>
  </div>

  <script>
    const SCRIPT_NAME = decodeURIComponent("${safeScriptName}");
    const INSTANCE_ID = ${safeInstanceId};
    let state = {
      settings: ${safeSettings},
      userData: ${safeUserData},
      isEditingUser: ${(!userData || !settings.username || !String(settings.username).trim()) ? 'true' : 'false'},
      isLoading: false,
      errorMessage: null
    };

    function notifyScriptable(action, payload) {
      try {
        const dataStr = encodeURIComponent(JSON.stringify(payload || {}));
        window.location.href = "ehuntis://" + action + "?data=" + dataStr;
      } catch(_) {}
    }

    function showToast(msg) {
      const t = document.getElementById("toast");
      if (!t) return;
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2200);
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }

    function render() {
      applyTheme(state.settings.theme || "system");
      const app = document.getElementById("app");
      const uData = state.userData;
      const isConnected = !!(state.settings.username && state.settings.username.trim() && uData);
      const configs = (isConnected && uData && Array.isArray(uData.configs)) ? uData.configs : [];
      const activeId = uData ? uData.active_config_id : null;
      const activeName = (configs.find(c => c && c.id === activeId) || {}).name || "Principal";

      let html = "";

      // ── CARD 1: CUENTA ──
      html += '<div class="card">';
      if (isConnected && !state.isEditingUser) {
        html += \`
          <div class="account-row">
            <div class="account-logo">
              <img src="https://ehuntis.vercel.app/apple-touch-icon.png" alt="EHUntis"/>
            </div>
            <div class="account-info">
              <div class="account-status-line">
                <span class="status-dot"></span>
                <span>Conectado · \${escapeHtml(state.settings.username)}</span>
              </div>
              <div class="account-subtitle">\${configs.length} horario(s) sincronizado(s)</div>
            </div>
            <button class="btn-text" onclick="setEditingUser(true)">Cambiar</button>
          </div>
        \`;
      } else {
        html += \`
          <div class="card-title">Cuenta de EHUntis</div>
          <label class="input-label">Identificador de alumno</label>
          <input type="text" id="username-input" class="text-input" placeholder="ej. 1234567" value="\${escapeHtml(state.settings.username || '')}" \${state.isLoading ? 'disabled' : ''} onkeydown="if(event.key==='Enter') connectUser()"/>
          \${state.errorMessage ? \`<div class="error-msg">\${escapeHtml(state.errorMessage)}</div>\` : ''}
          <div class="form-buttons">
            \${isConnected ? \`<button class="btn-outlined" onclick="setEditingUser(false)" \${state.isLoading ? 'disabled' : ''}>Cancelar</button>\` : ''}
            <button class="btn-filled" onclick="connectUser()" \${state.isLoading ? 'disabled' : ''}>
              \${state.isLoading ? '<div class="spinner"></div>' : 'Conectar y cargar'}
            </button>
          </div>
        \`;
      }
      html += '</div>';

      // ── CARD 2: HORARIO DEL WIDGET (solo si la cuenta está conectada y no en edición) ──
      if (isConnected && !state.isEditingUser && configs.length > 0) {
        const isFollowActive = (state.settings.configId == null);
        html += '<div class="card">';
        html += '<div class="card-title">Horario del widget</div>';
        html += '<div class="radio-list">';

        // Seguir horario activo
        html += \`
          <div class="radio-item \${isFollowActive ? 'selected' : ''}" onclick="selectConfig(null)">
            <div class="radio-circle">
              <div class="radio-circle-dot"></div>
            </div>
            <div class="radio-label">
              <div class="radio-title">Seguir horario activo</div>
              <div class="radio-subtitle">Activo ahora: \${escapeHtml(activeName)}</div>
            </div>
          </div>
        \`;

        // Cada horario
        for (const cfg of configs) {
          const isSelected = (state.settings.configId === cfg.id);
          const grpCount = (cfg.selectedGroups && Array.isArray(cfg.selectedGroups)) ? cfg.selectedGroups.length : 0;
          html += \`
            <div class="radio-item \${isSelected ? 'selected' : ''}" onclick="selectConfig('\${cfg.id}')">
              <div class="radio-circle">
                <div class="radio-circle-dot"></div>
              </div>
              <div class="radio-label">
                <div class="radio-title">\${escapeHtml(cfg.name)}</div>
                <div class="radio-subtitle">\${grpCount} grupo(s) configurado(s)</div>
              </div>
            </div>
          \`;
        }

        html += '</div>';
        html += '</div>';
      }

      // ── CARD 3: MODO DE VISUALIZACIÓN ──
      const isDay = (state.settings.viewMode !== 'weekly');
      const isWeek = (state.settings.viewMode === 'weekly');
      html += '<div class="card">';
      html += '<div class="card-title">Modo de visualización</div>';
      html += '<div class="segmented-grid">';

      // Vista diaria
      html += \`
        <div class="segmented-btn \${isDay ? 'selected' : ''}" onclick="selectViewMode('daily')">
          <svg viewBox="0 0 24 24"><path d="M19,3h-1V1h-2v2H8V1H6v2H5C3.89,3 3,3.9 3,5v14c0,1.1 0.89,2 2,2h14c1.1,0 2,-0.9 2,-2V5C21,3.9 20.1,3 19,3z M19,19H5V8h14V19z M7,10h10v5H7V10z"/></svg>
          <span>Vista diaria</span>
        </div>
      \`;

      // Semana completa
      html += \`
        <div class="segmented-btn \${isWeek ? 'selected' : ''}" onclick="selectViewMode('weekly')">
          <svg viewBox="0 0 24 24"><path d="M19,3h-1V1h-2v2H8V1H6v2H5C3.89,3 3,3.9 3,5v14c0,1.1 0.89,2 2,2h14c1.1,0 2,-0.9 2,-2V5C21,3.9 20.1,3 19,3z M19,19H5V8h14V19z M7,10h2v7H7V10z M11,10h2v7h-2V10z M15,10h2v7h-2V10z"/></svg>
          <span>Semana completa</span>
        </div>
      \`;

      html += '</div>';
      html += '</div>';

      // ── CARD 4: TEMA Y APARIENCIA ──
      const currentTheme = state.settings.theme || 'system';
      html += '<div class="card">';
      html += '<div class="card-title">Tema y apariencia</div>';
      html += '<div class="segmented-grid">';

      // Sistema
      html += \`
        <div class="segmented-btn \${currentTheme === 'system' ? 'selected' : ''}" onclick="selectTheme('system')">
          <svg viewBox="0 0 24 24"><path d="M12,2a10,10 0 1,0 10,10A10,10 0 0,0 12,2z M12,20V4a8,8 0 0,1 0,16z"/></svg>
          <span>Sistema</span>
        </div>
      \`;

      // Claro
      html += \`
        <div class="segmented-btn \${currentTheme === 'light' ? 'selected' : ''}" onclick="selectTheme('light')">
          <svg viewBox="0 0 24 24"><path d="M12,7c-2.76,0 -5,2.24 -5,5s2.24,5 5,5 5,-2.24 5,-5 -2.24,-5 -5,-5zM2,13h2c0.55,0 1,-0.45 1,-1s-0.45,-1 -1,-1H2c-0.55,0 -1,0.45 -1,1s0.45,1 1,1zm18,0h2c0.55,0 1,-0.45 1,-1s-0.45,-1 -1,-1h-2c-0.55,0 -1,0.45 -1,1s0.45,1 1,1zM11,2v2c0,0.55 0.45,1 1,1s1,-0.45 1,-1V2c0,-0.55 -0.45,-1 -1,-1s-1,0.45 -1,1zm0,18v2c0,0.55 0.45,1 1,1s1,-0.45 1,-1v-2c0,-0.55 -0.45,-1 -1,-1s-1,0.45 -1,1zM5.99,4.58c-0.39,-0.39 -1.03,-0.39 -1.41,0s-0.39,1.03 0,1.41l1.06,1.06c0.39,0.39 1.03,0.39 1.41,0s0.39,-1.03 0,-1.41L5.99,4.58zm12.37,12.37c-0.39,-0.39 -1.03,-0.39 -1.41,0s-0.39,1.03 0,1.41l1.06,1.06c0.39,0.39 1.03,0.39 1.41,0s0.39,-1.03 0,-1.41l-1.06,-1.06zm1.06,-10.96c0.39,-0.39 0.39,-1.03 0,-1.41s-1.03,-0.39 -1.41,0l-1.06,1.06c-0.39,0.39 -0.39,1.03 0,1.41s1.03,0.39 1.41,0l1.06,-1.06zM7.05,18.36c0.39,-0.39 0.39,-1.03 0,-1.41s-1.03,-0.39 -1.41,0l-1.06,1.06c-0.39,0.39 -0.39,1.03 0,1.41s1.03,0.39 1.41,0l1.06,-1.06z"/></svg>
          <span>Claro</span>
        </div>
      \`;

      // Oscuro
      html += \`
        <div class="segmented-btn \${currentTheme === 'dark' ? 'selected' : ''}" onclick="selectTheme('dark')">
          <svg viewBox="0 0 24 24"><path d="M12.3,2a10,10 0 0,0 -1.9,0.18 10,10 0 1,1 -8.22,8.22A10,10 0 0,0 12.3,2z"/></svg>
          <span>Oscuro</span>
        </div>
      \`;

      html += '</div>';
      html += '</div>';

      app.innerHTML = html;

      const btnSave = document.getElementById("btn-save");
      if (btnSave) {
        btnSave.disabled = !isConnected;
      }
    }

    function setEditingUser(val) {
      state.isEditingUser = val;
      state.errorMessage = null;
      render();
      if (val) {
        setTimeout(() => {
          const inp = document.getElementById("username-input");
          if (inp) inp.focus();
        }, 50);
      }
    }

    async function connectUser() {
      const inp = document.getElementById("username-input");
      const user = (inp ? inp.value : "").trim();
      if (!user) {
        state.errorMessage = "Introduce un identificador válido";
        render();
        return;
      }

      state.isLoading = true;
      state.errorMessage = null;
      render();

      try {
        const res = await fetch("https://ehuntis.vercel.app/api/user/" + encodeURIComponent(user) + "?t=" + Date.now(), {
          headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || ("Error " + res.status + ": Usuario no encontrado"));
        }
        const data = await res.json();
        onConnectSuccess(user, data);
      } catch(err) {
        notifyScriptable("request_connect", { username: user });
        setTimeout(() => {
          if (state.isLoading) {
            state.isLoading = false;
            state.errorMessage = err.message || "Error al conectar con el servidor";
            render();
          }
        }, 3500);
      }
    }

    function onConnectSuccess(user, data) {
      state.userData = data;
      state.settings.username = user;
      state.isEditingUser = false;
      state.isLoading = false;
      state.errorMessage = null;
      try {
        if (window.matchMedia) {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          state.settings.systemThemeCached = isDark ? 'dark' : 'light';
        }
      } catch(_) {}
      render();
      showToast("✓ Conectado correctamente");

      notifyScriptable("update_user", {
        username: user,
        userData: data,
        settings: state.settings
      });
    }

    function onConnectError(msg) {
      state.isLoading = false;
      state.errorMessage = msg;
      render();
    }

    window.onConnectSuccess = onConnectSuccess;
    window.onConnectError = onConnectError;

    function selectConfig(cfgId) {
      state.settings.configId = cfgId;
      render();
      notifyScriptable("update_settings", { settings: state.settings });
    }

    function selectViewMode(mode) {
      state.settings.viewMode = mode;
      render();
      notifyScriptable("update_settings", { settings: state.settings });
    }

    function selectTheme(thm) {
      state.settings.theme = thm;
      try {
        if (window.matchMedia) {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          state.settings.systemThemeCached = isDark ? 'dark' : 'light';
        }
      } catch(_) {}
      render();
      notifyScriptable("update_settings", { settings: state.settings });
    }

    function handleSave() {
      const isConnected = !!(state.settings.username && state.settings.username.trim() && state.userData);
      if (!isConnected || state.isEditingUser) {
        showToast("⚠️ Conecta tu cuenta primero");
        return;
      }
      try {
        if (window.matchMedia) {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          state.settings.systemThemeCached = isDark ? 'dark' : 'light';
        }
      } catch(_) {}
      showToast("✓ Guardando ajustes...");
      notifyScriptable("save", {
        settings: state.settings,
        userData: state.userData
      });
      setTimeout(() => {
        let closeUrl = "scriptable:///run?scriptName=" + encodeURIComponent(SCRIPT_NAME) + "&close=true";
        if (INSTANCE_ID) closeUrl += "&instance=" + encodeURIComponent(INSTANCE_ID);
        window.location.href = closeUrl;
      }, 350);
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Actualizar estado del botón guardar al renderizar
    const origRender = render;
    render = function() {
      origRender();
      const uData = state.userData;
      const isConnected = !!(state.settings.username && state.settings.username.trim() && uData);
      const btnSave = document.getElementById("btn-save");
      if (btnSave) {
        if (!isConnected || state.isEditingUser) {
          btnSave.disabled = true;
          btnSave.style.opacity = "0.45";
          btnSave.style.cursor = "not-allowed";
        } else {
          btnSave.disabled = false;
          btnSave.style.opacity = "1";
          btnSave.style.cursor = "pointer";
        }
      }
    };

    render();
  </script>
</body>
</html>`;
}

async function showSettingsScreen(settings, instanceId) {
  let currentSettings = { ...settings };

  // Refrescar tema del sistema real al abrir la pantalla de ajustes en la app
  try {
    if (typeof Device !== 'undefined' && typeof Device.isUsingDarkAppearance === 'function') {
      currentSettings.systemThemeCached = Device.isUsingDarkAppearance() === true ? "dark" : "light";
      saveSettings(currentSettings, instanceId);
    }
  } catch(_) {}

  let userData = (currentSettings.username && currentSettings.username.trim()) ? loadUserData(currentSettings.username) : null;

  const wv = new WebView();

  wv.shouldAllowRequest = (request) => {
    const url = request.url;
    if (url.startsWith("ehuntis://")) {
      handleBridgeAction(url);
      return false;
    }
    return true;
  };

  async function handleBridgeAction(url) {
    try {
      const qIdx = url.indexOf("?");
      const action = url.slice(10, qIdx !== -1 ? qIdx : undefined).replace(/^\/+/, "");
      let payload = {};
      if (qIdx !== -1) {
        const queryStr = url.slice(qIdx + 1);
        const dataMatch = queryStr.match(/(?:^|&)data=([^&]*)/);
        if (dataMatch) {
          try {
            payload = JSON.parse(decodeURIComponent(dataMatch[1]));
          } catch(_) {}
        }
      }

      // Obtener estado fresco del sistema si está disponible
      let freshSys = null;
      try {
        if (typeof Device !== 'undefined' && typeof Device.isUsingDarkAppearance === 'function') {
          freshSys = Device.isUsingDarkAppearance() === true ? "dark" : "light";
        }
      } catch(_) {}

      if (action === "update_settings") {
        if (payload.settings) {
          currentSettings = { ...currentSettings, ...payload.settings };
          if (freshSys) currentSettings.systemThemeCached = freshSys;
          saveSettings(currentSettings, instanceId);
        }
      } else if (action === "update_user") {
        if (payload.username) currentSettings.username = payload.username;
        if (payload.userData) {
          userData = payload.userData;
          saveUserData(payload.userData, currentSettings.username);
        }
        if (payload.settings) {
          currentSettings = { ...currentSettings, ...payload.settings };
        }
        if (freshSys) currentSettings.systemThemeCached = freshSys;
        saveSettings(currentSettings, instanceId);

        if (payload.userData) {
          const allClassIds = extractAllClassIds(payload.userData);
          if (allClassIds.length > 0) {
            fetchTimetable(allClassIds, true).then(lessons => {
              if (lessons && lessons.length > 0) {
                saveTimetable(lessons, currentSettings.username);
                currentSettings.lastSync = Date.now();
                saveSettings(currentSettings, instanceId);
              }
            }).catch(() => {});
          }
        }
      } else if (action === "request_connect") {
        const targetUser = payload.username;
        try {
          const uData = await fetchUserData(targetUser);
          userData = uData;
          currentSettings.username = targetUser;
          if (freshSys) currentSettings.systemThemeCached = freshSys;
          saveUserData(uData, targetUser);
          saveSettings(currentSettings, instanceId);

          const allClassIds = extractAllClassIds(uData);
          if (allClassIds.length > 0) {
            fetchTimetable(allClassIds, true).then(lessons => {
              if (lessons && lessons.length > 0) {
                saveTimetable(lessons, targetUser);
                currentSettings.lastSync = Date.now();
                saveSettings(currentSettings, instanceId);
              }
            }).catch(() => {});
          }

          const safeUser = JSON.stringify(targetUser);
          const safeData = JSON.stringify(uData);
          await wv.evaluateJavaScript(`if (window.onConnectSuccess) window.onConnectSuccess(${safeUser}, ${safeData});`);
        } catch(e) {
          const safeErr = JSON.stringify(e.message || "Error al conectar");
          await wv.evaluateJavaScript(`if (window.onConnectError) window.onConnectError(${safeErr});`);
        }
      } else if (action === "save") {
        if (payload.settings) {
          currentSettings = { ...currentSettings, ...payload.settings };
        }
        if (freshSys) currentSettings.systemThemeCached = freshSys;
        if (payload.userData) {
          userData = payload.userData;
          saveUserData(payload.userData, currentSettings.username);
        }
        saveSettings(currentSettings, instanceId);
        if (currentSettings.username) {
          syncIfNeeded(currentSettings, true, instanceId).catch(() => {});
        }
      }
    } catch(err) {
      console.error("Bridge action error: " + err);
    }
  }

  const html = getSettingsHTML(currentSettings, userData, SCRIPT_NAME, instanceId);
  await wv.loadHTML(html, "https://ehuntis.vercel.app");
  await wv.present(false);

  // Asegurar persistencia completa al cerrar
  try {
    if (typeof Device !== 'undefined' && typeof Device.isUsingDarkAppearance === 'function') {
      currentSettings.systemThemeCached = Device.isUsingDarkAppearance() === true ? "dark" : "light";
    }
  } catch(_) {}
  saveSettings(currentSettings, instanceId);
  if (currentSettings.username) {
    await syncIfNeeded(currentSettings, true, instanceId);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MÓDULO I — PUNTO DE ENTRADA / ORQUESTADOR
// ════════════════════════════════════════════════════════════════════════════
//  ICONO DE AJUSTES ANDROID MATERIAL (ic_settings)
// ════════════════════════════════════════════════════════════════════════════

const ANDROID_GEAR_B64 = {
  dark: "iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAYAAAA6RwvCAAAACXBIWXMAAAsTAAALEwEAmpwYAAACb0lEQVR4nO1XS2sUQRAeAwZ8oCeF3IzGaH6D/g9RkRwM/gNFT4Mg5CCRzXTvmIEEnerdyxyFTNVs8IksCP4JQcHgyRcKYlZqZnXXdfoxy2YOkg/q0kxVf13VVf2N5+3hf8L9B3hCKAylwmjYeC2AbLY2IgHgDamop7GbtRGReQa0RNZrIyIAn+iICEXPJrrZ6sP0VADp1SjZOjq6LhRua4kAfWi0O6f/8lHpEY4lgeYqkej1evukom4RHL8IwA0Zp+eFwnsS8IehLIXxN0CNoJWd41JxjP76K9/3p5yJSKDL1s3GNKGyRScSK0lyQCp8s1tEJOB7LpVDNvB2pRMCfmar6LNsJLG6kR4Tir46BPspFcnhSynizXkeaAJwx8H/e6RwRkskih4dlEAvbCSCFl3QZlThxT5RU4zuXcgOGbMSRa/3592hDyIt1fWK8a/395Nk2hbjD2SMV8oCjc6IMoQKz5R3DC55VRG06ey/N54+uvoLRZ9G/ZtxZ6EykWbcWSjrEGciJZ00FhGhcKk0vfHm/FjZzA+SXXMm4CfJNF8o/WTE0HoIoDWDv7BeVpk8PTx4Y7TDaIdbVEuiRZesswTwpbF9I4UzPGxcBhpnhrtjuBycCZeBJhR+CyE7bkkrLjsQGTJ+Wfuvq6sB3rFU1yvKA/iuGhl3E4reWqfqb/BTvVtEWGJ4rvB9f4pFzCD1tJ6LHKBGBWG0kospFlWD0nVZdHlVIIHmWN6Nagce8SwHDRdxm+XksA/LTY4VtrdOepOEAHxuuLyPJ7qZCUW6dXOG1ry6IABvGTJyvTYiAWSzpb+cQE3+Ha2NyB68GvALQ5UvPl4p5JsAAAAASUVORK5CYII=",
  light: "iVBORw0KGgoAAAANSUhEUgAAACIAAAAiCAYAAAA6RwvCAAAACXBIWXMAAAsTAAALEwEAmpwYAAACZklEQVR4nO2X32tTMRTH48CBP9Anhb05f0z3N+i/MUSnyEzIZCC096SdewqC0jYnLRNr2cD9KYqKFPwzBAWHT+pEYbjJ6Va9rblJbunug+xAXu5tTj79Jufkexk7jP8pFpdr5wRgRyizPjDoGeB0YSBcmapQuOsaXJkHhYGIngKZIM+LAwF8mQkC+Gqsi0llLghALpfrp4efc2U2PYp8Xqw0LqXnzN9/copy8XLzYk6M3SMCsLuX3GwJwA2Z2GtCmRYH3M6CSKmyzZVZ5cpcpa3q5aB3gO+01hPRGCKx86HFRh0c8E4URLncPMYB3x8UiFDmE21VWA1lHub6h8p8o5ELBrDmhVhYeXyGA36PkPcXB2ynD6VI7Mx+k9uJgP8pS62pTBCp9XEO+CYIUWlcz1Q0sTfoNwFFurcAT3hVkXL9KFWHB6Qd0Wc6vvlzWk+y2LgLeNuVaLhHOOdWGpedEIkVLG/IxF5xnPgvsfMF4Nd/QKr12dwgvFqfdVVI9HxHJY0Gkljh3OfEzoymJh1SK6MB5rSepAPlOfGdUA4BuOZpaE+Dh3VpqX3y7x2TmWiHSjQrB1fmZrCXAL71lq8staao2cQ0NFKGqmNgO3pKhBuaAPxxD/BsSNZaMNGgQlt/btfYAfgosLusvz0f88HED67Mh2BX7Qdd1QcFQhaDxYbWeoJMTF96Mjf7Jmc12hgBNntmCnAjZYy6ZLqiQSjI1pG9G/YO1OLJDnqk3yQ7mZ5DdpNyLZRa59k4Qyjz2gPyYqyL+WJP7syKWGNFBQdc8YBUCgMRgNOuT06uzDP6HC0M5DBYAfEbfy0nHFw9RBwAAAAASUVORK5CYII="
};

function getAndroidGearImage(isDark) {
  try {
    if (typeof Data !== 'undefined' && typeof Image !== 'undefined' && Data.fromBase64String && Image.fromData) {
      const b64 = isDark ? ANDROID_GEAR_B64.dark : ANDROID_GEAR_B64.light;
      return Image.fromData(Data.fromBase64String(b64));
    }
  } catch(_) {}
  return null;
}

// Renderiza el widget en estado NO CONFIGURADO (cuando no hay identificador de alumno)
function buildUnconfiguredWidget(settings, family, dims, scale, isDark, instanceId) {
  const widget = new ListWidget();
  widget.setPadding(0, 0, 0, 0);
  const bgHex = isDark ? "#0B0F17" : "#F8FAFC";
  widget.backgroundColor = new Color(bgHex);
  const deeplink = getSettingsDeeplink(settings, instanceId);
  widget.url = deeplink;

  const wPt = dims.w;
  const hPt = dims.h;

  const dc = new DrawContext();
  dc.size = new Size(wPt, hPt);
  dc.opaque = false;
  dc.respectScreenScale = true;

  dc.setFillColor(new Color(bgHex));
  dc.fillRect(new Rect(0, 0, wPt, hPt));

  // Cabecera superior segura
  drawHeader(dc, wPt, scale, isDark, "EHUntis · Pulsa para configurar", settings);

  // Tarjeta central de configuración
  const cardPadX = 16 * scale;
  const cardW = wPt - cardPadX * 2;
  const cardH = Math.min(160 * scale, Math.max(80 * scale, hPt - (HEADER_HEIGHT + 24) * scale));
  const cardY = HEADER_HEIGHT * scale + (hPt - HEADER_HEIGHT * scale - cardH) / 2;

  const cardBg = isDark ? "#131C2E" : "#FFFFFF";
  const cardBorder = isDark ? "#1E293B" : "#E2E8F0";
  dc.setFillColor(new Color(cardBg));
  drawRoundRect(dc, cardPadX, cardY, cardW, cardH, 14 * scale);
  dc.fillPath();

  dc.setStrokeColor(new Color(cardBorder));
  dc.setLineWidth(1 * scale);
  drawRoundRect(dc, cardPadX, cardY, cardW, cardH, 14 * scale);
  dc.strokePath();

  const textPad = 14 * scale;
  const titleY = cardY + (cardH < 120 * scale ? 14 * scale : 20 * scale);
  dc.setTextAlignedCenter();

  // Título
  dc.setFont(Font.boldSystemFont(13.5 * scale));
  dc.setTextColor(isDark ? new Color("#F8FAFC") : new Color("#0F172A"));
  dc.drawTextInRect("Configura tu horario", new Rect(cardPadX + textPad, titleY, cardW - textPad * 2, 20 * scale));

  // Subtítulo
  dc.setFont(Font.systemFont(11 * scale));
  dc.setTextColor(isDark ? new Color("#94A3B8") : new Color("#64748B"));
  dc.drawTextInRect(
    "Toca aquí para introducir tu identificador de alumno y ver tus clases.",
    new Rect(cardPadX + textPad, titleY + 24 * scale, cardW - textPad * 2, 38 * scale)
  );

  // Botón "Configurar ahora" (si hay suficiente altura vertical)
  const btnW = 130 * scale;
  const btnH = 28 * scale;
  const btnX = (wPt - btnW) / 2;
  const btnY = titleY + 68 * scale;
  if (btnY + btnH <= cardY + cardH - 10 * scale) {
    dc.setFillColor(new Color("#4F6EF7"));
    drawRoundRect(dc, btnX, btnY, btnW, btnH, 8 * scale);
    dc.fillPath();

    dc.setFont(Font.boldSystemFont(11.5 * scale));
    dc.setTextColor(new Color("#FFFFFF"));
    dc.drawTextInRect("Configurar ahora", new Rect(btnX, btnY + 5 * scale, btnW, btnH));
  }

  widget.backgroundImage = dc.getImage();

  // Stack interactivo con botón de ajustes ergonómico
  const topBarStack = widget.addStack();
  topBarStack.layoutHorizontally();
  topBarStack.size = new Size(0, HEADER_HEIGHT * scale);
  topBarStack.setPadding(0, 0, 0, 0);

  // Espaciador para alinear el botón a la derecha
  topBarStack.addSpacer();

  const settingsBtn = topBarStack.addStack();
  settingsBtn.size = new Size(40 * scale, HEADER_HEIGHT * scale);
  settingsBtn.layoutHorizontally();
  settingsBtn.centerAlignContent();
  settingsBtn.setPadding(0, 0, 0, 14 * scale);
  settingsBtn.url = deeplink;

  const gearImg = getAndroidGearImage(isDark);
  if (gearImg) {
    const gearWidgetImg = settingsBtn.addImage(gearImg);
    gearWidgetImg.imageSize = new Size(16 * scale, 16 * scale);
  } else {
    try {
      const gearSymbol = SFSymbol.named("gearshape.fill");
      gearSymbol.applyFont(Font.systemFont(16));
      const gearWidgetImg = settingsBtn.addImage(gearSymbol.image);
      gearWidgetImg.imageSize = new Size(16 * scale, 16 * scale);
      gearWidgetImg.tintColor = isDark ? new Color("#94A3B8", 0.9) : new Color("#64748B", 0.9);
    } catch(_) {
      const fallbackText = settingsBtn.addText("⚙");
      fallbackText.font = Font.systemFont(16);
      fallbackText.textColor = isDark ? new Color("#94A3B8", 0.9) : new Color("#64748B", 0.9);
    }
  }

  widget.addSpacer();
  return widget;
}

/**
 * Detecta si el widget debe renderizarse en modo oscuro.
 * 
 * En Scriptable (iOS), existen varias peculiaridades:
 * 1. Device.isUsingDarkAppearance() está soportado en la app y en ciertas versiones de iOS.
 * 2. La sonda Color.dynamic(white, black).red < 0.5 inspecciona el trait nativo resuelto.
 * 3. En segundo plano (WidgetKit timeline refresh con pantalla bloqueada o en reposo),
 *    iOS a menudo asigna un UITraitCollection no especificado (.unspecified), que resuelve
 *    por defecto a blanco (red = 1).
 * 4. Por ello, si estamos en modo 'system', añadimos una heurística horaria nocturna (20:45 - 07:30)
 *    de modo que un refresco silencioso en mitad de la noche no dibuje el widget en modo claro.
 */
function isDarkModeActive(settings) {
  if (settings && settings.theme === "dark") return true;
  if (settings && settings.theme === "light") return false;

  // 1. Probar con Device.isUsingDarkAppearance() si devuelve explícitamente true
  try {
    if (typeof Device !== "undefined" && typeof Device.isUsingDarkAppearance === "function") {
      if (Device.isUsingDarkAppearance() === true) {
        return true;
      }
    }
  } catch(_) {}

  // 2. Probar con la sonda Color.dynamic nativa
  try {
    if (typeof Color !== "undefined" && typeof Color.dynamic === "function") {
      const probe = Color.dynamic(Color.white(), Color.black());
      if (probe && typeof probe.red === "number") {
        if (probe.red < 0.5) return true;
      }
    }
  } catch(_) {}

  // 3. Caché del tema del sistema detectada al configurar o abrir la app en Scriptable
  if (settings && settings.systemThemeCached === "dark") {
    return true;
  }

  // 4. Heurística horaria para widgets en segundo plano:
  // Si estamos en horario nocturno (>= 20:45 o < 07:30) y ninguna de las APIs nativas
  // pudo confirmar el estado (habitual en tareas de fondo de WidgetKit), asumimos modo oscuro
  // para evitar deslumbrar al usuario en la oscuridad.
  try {
    const now = new Date();
    const timeDec = now.getHours() + now.getMinutes() / 60;
    if (timeDec >= 20.75 || timeDec < 7.5) {
      return true;
    }
  } catch(_) {}

  return false;
}

async function buildWidget(settings, instanceId) {
  const isDark = isDarkModeActive(settings);

  // Familia del widget
  const family = config.widgetFamily || "medium";


  // Dimensiones en puntos según el dispositivo físico exacto
  const dims  = getDeviceWidgetSize(family);
  const wPt   = dims.w;
  const hPt   = dims.h;
  const scale = 1.0;

  // Si no hay cuenta configurada, mostrar estado de bienvenida (sin datos ni horarios)
  const isConfigured = !!(settings && settings.username && settings.username.trim().length > 0);
  if (!isConfigured) {
    return buildUnconfiguredWidget(settings, family, dims, scale, isDark, instanceId);
  }

  const widget = new ListWidget();
  widget.setPadding(0, 0, 0, 0);

  const bgHex = isDark ? "#0B0F17" : "#FFFFFF";
  // Para modo "system": usar Color.dynamic() para que iOS aplique el color correcto
  // automáticamente al renderizar, sin depender del momento de ejecución del script
  if (settings.theme === "system" && typeof Color.dynamic === "function") {
    try {
      widget.backgroundColor = Color.dynamic(new Color("#FFFFFF"), new Color("#0B0F17"));
    } catch(_) {
      widget.backgroundColor = new Color(bgHex);
    }
  } else {
    widget.backgroundColor = new Color(bgHex);
  }

  // Cargar datos del usuario configurado
  const userData = loadUserData(settings.username);
  const allLessons = loadTimetable(settings.username);
  const configs  = userData && userData.configs ? userData.configs : [];
  const activeId = userData && userData.active_config_id ? userData.active_config_id : null;
  const config2  = resolveConfig(configs, settings.configId, activeId);

  // Filtrar lecciones y fusionar bloques consecutivos de forma segura
  let finalLessons = [];
  try {
    const filteredLessons = (!config2 || !config2.selectedGroups || config2.selectedGroups.length === 0)
      ? allLessons
      : filterLessonsForConfig(allLessons, config2);
    finalLessons = mergeConsecutiveBlocks(filteredLessons);
  } catch(e) {
    console.error("Error filtering lessons: " + e);
    finalLessons = mergeConsecutiveBlocks(allLessons);
  }

  const now        = new Date();
  const todayDate  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowDate = addDays(todayDate, 1);
  const targetDate = (typeof PREVIEW_FORCE_TODAY !== 'undefined' && PREVIEW_FORCE_TODAY)
    ? todayDate
    : getResolvedTargetDate(now, finalLessons);

  // Título de la cabecera
  let headerText;
  const isWeekMode = settings.viewMode === "weekly" && family !== "small";

  if (isWeekMode) {
    // Semana: Lun-Vie de la semana del targetDate
    const dow = targetDate.getDay(); // 0=dom
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = addDays(targetDate, mondayOffset);
    const friday = addDays(monday, 4);
    headerText = `Semana · ${formatDateShort(monday)} - ${formatDateShort(friday)}`;
    if (config2 && configs.length > 1) headerText += ` · ${config2.name}`;
  } else {
    const dayNameShort = getDayOfWeekName(targetDate).substring(0,3);
    const dayNameShortCap = dayNameShort[0].toUpperCase() + dayNameShort.slice(1);
    const dateFormatted = formatDateShort(targetDate);
    let prefix;
    if (sameDay(targetDate, todayDate))     prefix = "Hoy";
    else if (sameDay(targetDate, tomorrowDate)) prefix = "Mañana";
    else {
      const dn = getDayOfWeekName(targetDate);
      prefix = dn[0].toUpperCase() + dn.slice(1);
    }
    if (sameDay(targetDate, todayDate) || sameDay(targetDate, tomorrowDate)) {
      headerText = `${prefix} · ${dayNameShortCap}, ${dateFormatted}`;
    } else {
      headerText = `${prefix}, ${dateFormatted}`;
    }
    if (config2 && configs.length > 1) headerText += ` · ${config2.name}`;
  }

  // Crear DrawContext para el CANVAS COMPLETO (cabecera + horario)
  const dc = new DrawContext();
  dc.size = new Size(wPt, hPt);
  dc.opaque = false;
  dc.respectScreenScale = true;

  // Fondo global
  dc.setFillColor(new Color(bgHex));
  dc.fillRect(new Rect(0, 0, wPt, hPt));

  // Cabecera (HEADER_HEIGHT puntos)
  drawHeader(dc, wPt, scale, isDark, headerText, settings);

  // Horario (debajo de la cabecera)
  const timetableY = HEADER_HEIGHT * scale;
  const timetableH = hPt - timetableY;

  // Creamos un segundo DrawContext solo para el horario (sin cabecera)
  const dcTimetable = new DrawContext();
  dcTimetable.size = new Size(wPt, timetableH);
  dcTimetable.opaque = false;
  dcTimetable.respectScreenScale = true;

  // Actualizar paleta desde API y extraer colores personalizados del perfil
  updatePaletteFromApi(userData && userData.palette ? userData.palette : null);
  const customColors = (config2 && config2.customColors) ? config2.customColors : {};

  if (isWeekMode) {
    const dow = targetDate.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = addDays(targetDate, mondayOffset);
    renderWeekTimetable(dcTimetable, wPt, timetableH, monday, finalLessons, isDark, now, scale, customColors);
  } else {
    renderTimetable(dcTimetable, wPt, timetableH, targetDate, finalLessons, isDark, now, scale, customColors);
  }

  // Dibujar el canvas del horario sobre el canvas principal debajo de la cabecera
  const timetableImg = dcTimetable.getImage();
  dc.drawImageInRect(timetableImg, new Rect(0, timetableY, wPt, timetableH));

  widget.backgroundImage = dc.getImage();

  // Stack interactivo sobre el fondo: permite que la rueda de ajustes sea CLICKABLE
  // individualmente con SETTINGS_DEEPLINK, mientras que el resto del widget abre la web / PWA
  const topBarStack = widget.addStack();
  topBarStack.layoutHorizontally();
  topBarStack.size = new Size(0, HEADER_HEIGHT * scale);
  topBarStack.setPadding(0, 0, 0, 0);

  // Espaciador para empujar el botón de ajustes a la derecha
  topBarStack.addSpacer();

  // Botón táctil ergonómico de ajustes:
  // Contiene el icono Material de Android auténtico con padding y hit-test táctil fiable
  const settingsBtn = topBarStack.addStack();
  settingsBtn.size = new Size(40 * scale, HEADER_HEIGHT * scale);
  settingsBtn.layoutHorizontally();
  settingsBtn.centerAlignContent();
  settingsBtn.setPadding(0, 0, 0, 14 * scale);
  settingsBtn.url  = getSettingsDeeplink(settings, instanceId);

  const gearImg = getAndroidGearImage(isDark);
  if (gearImg) {
    const gearWidgetImg = settingsBtn.addImage(gearImg);
    gearWidgetImg.imageSize = new Size(16 * scale, 16 * scale);
  } else {
    try {
      const gearSymbol = SFSymbol.named("gearshape.fill");
      gearSymbol.applyFont(Font.systemFont(16));
      const gearWidgetImg = settingsBtn.addImage(gearSymbol.image);
      gearWidgetImg.imageSize = new Size(16 * scale, 16 * scale);
      gearWidgetImg.tintColor = isDark ? new Color("#94A3B8", 0.9) : new Color("#64748B", 0.9);
    } catch(_) {
      const fallbackText = settingsBtn.addText("⚙");
      fallbackText.font = Font.systemFont(16);
      fallbackText.textColor = isDark ? new Color("#94A3B8", 0.9) : new Color("#64748B", 0.9);
    }
  }

  // Espaciador vertical para asegurar que topBarStack se queda arriba del widget
  widget.addSpacer();

  // refreshAfterDate — calculado con computeNextEventTime para minimizar actualizaciones innecesarias
  let refreshDate;
  try {
    refreshDate = computeNextEventTime(now, finalLessons);
  } catch(_) {
    refreshDate = new Date(now.getTime() + 15 * 60 * 1000);
  }
  // Mínimo 10 min, máximo 6h (mismo período que Android WorkManager)
  const minRefresh = new Date(now.getTime() + 10 * 60 * 1000);
  const maxRefresh = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  if (refreshDate < minRefresh) refreshDate = minRefresh;
  if (refreshDate > maxRefresh) refreshDate = maxRefresh;
  widget.refreshAfterDate = refreshDate;

  // URL al pulsar el widget: abre directamente la web de EHUntis
  widget.url = BASE_URL;

  return widget;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  let instanceId = null;
  if (typeof args !== 'undefined') {
    if (args.queryParameters && args.queryParameters.instance) {
      instanceId = args.queryParameters.instance;
    } else if (args.widgetParameter && typeof args.widgetParameter === 'string' && args.widgetParameter.trim().length > 0) {
      instanceId = args.widgetParameter.trim();
    }
  }
  if (instanceId && (instanceId.toLowerCase() === "settings" || instanceId.toLowerCase() === "opensettings")) {
    instanceId = null;
  }

  try {
    const settings = loadSettings(instanceId);

    // Guardar nombre del script si está disponible para asegurar que los deep links nunca fallen
    try {
      if (typeof Script !== 'undefined' && typeof Script.name === 'function') {
        const n = Script.name();
        if (n && n.trim().length > 0 && settings.scriptName !== n.trim()) {
          settings.scriptName = n.trim();
          saveSettings(settings, instanceId);
        }
      }
    } catch(_) {}

    // Detectar si se abrió desde el deep link de ajustes o acción de cierre
    const openSettings = (typeof args !== 'undefined' && (
      (args.queryParameters && (args.queryParameters.openSettings === "true" || args.queryParameters.openSettings === "1")) ||
      (args.widgetParameter && typeof args.widgetParameter === 'string' && args.widgetParameter.toLowerCase().includes("settings"))
    ));
    const closeAction = (typeof args !== 'undefined' && args.queryParameters && args.queryParameters.close === "true");

    if (closeAction) {
      Script.complete();
      return;
    }

    if (openSettings) {
      // Prioridad máxima: si viene el flag de ajustes, abrir la pantalla de ajustes siempre para esta instancia
      await showSettingsScreen(settings, instanceId);
      Script.complete();
      return;
    }

    if (config.runsInWidget || config.runsInAccessoryWidget) {
      // 1. INMEDIATO: Cache-first para garantizar que Script.setWidget() se llame en < 50ms
      // y prevenir el error "Call Script.setWidget() to set the content of the widget." de iOS
      let widget = await buildWidget(settings, instanceId);
      Script.setWidget(widget);

      // 2. Sincronización en segundo plano con margen de hasta 20 segundos
      // (iOS otorga ~30s para el proceso; como Script.setWidget() ya se ejecutó inmediatamente
      // con la caché en el paso 1, el widget nunca falla ni se queda en blanco, y 20s garantizan
      // tiempo suficiente incluso en redes móviles lentas o servidores sobrecargados)
      try {
        await Promise.race([
          syncIfNeeded(settings, false, instanceId),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000))
        ]);
        widget = await buildWidget(settings, instanceId);
        Script.setWidget(widget);
      } catch(_) {
        // En caso de timeout o fallo de red, el widget ya tiene el contenido en caché válido
      }
    } else {
      // Modo App (abierto directamente desde la lista de scripts de Scriptable)
      await showSettingsScreen(settings, instanceId);
    }
  } catch(err) {
    console.error("Fatal widget error: " + (err.stack || err.message || err));
    if (config.runsInWidget || config.runsInAccessoryWidget) {
      const fallback = new ListWidget();
      fallback.backgroundColor = new Color("#0B0F17");
      const pad = fallback.addStack();
      pad.layoutVertically();
      pad.setPadding(12, 12, 12, 12);
      const title = pad.addText("EHUntis");
      title.font = Font.boldSystemFont(13);
      title.textColor = new Color("#4F6EF7");
      pad.addSpacer(6);
      const msg = pad.addText("Pulsa aquí para revisar la configuración:\n" + (err.message || String(err)));
      msg.font = Font.systemFont(11);
      msg.textColor = new Color("#EF4444");
      fallback.url = getSettingsDeeplink(loadSettings(instanceId), instanceId);
      Script.setWidget(fallback);
    }
  }

  Script.complete();
}

await main();

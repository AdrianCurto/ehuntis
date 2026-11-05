/**
 * sync_upv_professors.mjs
 * 
 * Script autónomo para obtener mecánicamente el listado de profesorado
 * de todos los grados de la UPV/EHU desde su portal oficial (ehu.eus/es/web/graduak).
 * 
 * Características:
 * - Descarga el catálogo completo de grados oficiales (~113 titulaciones).
 * - Extrae para cada grado: título, campus, centro/facultad, slug y profesorado.
 * - Para cada profesor extrae: idPdi (identificador docente oficial) y nombre completo.
 * - Normaliza nombres para ehuntis (código corto, segundo apellido, display name).
 * - Opcionalmente actualiza directamente app/utils/teachersData.json con mapa byPdi y global.
 * - Opcionalmente exporta archivos .txt en Profesorado/ o directorio custom.
 * - Descarga blindada: reintentos con retroceso exponencial ante 429/5xx, segunda pasada de rescate
 *   y barrera de seguridad (Safety Guard) para evitar sobrescrituras corruptas si ehu.eus falla.
 * 
 * Uso:
 *   node scripts/sync_upv_professors.mjs [--update-app] [--save-txt] [--out-dir=Profesorado]
 */

import fs from 'fs';
import path from 'path';

// Decodificación de entidades HTML frecuentes en ehu.eus
function decodeHtmlEntities(str) {
  if (!str) return '';
  const entities = {
    '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú',
    '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú',
    '&ntilde;': 'ñ', '&Ntilde;': 'Ñ',
    '&uuml;': 'ü', '&Uuml;': 'Ü',
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
    '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&apos;': "'",
    '&#39;': "'", '&#34;': '"'
  };
  return str.replace(/&[a-zA-Z0-9#]+;/g, m => entities[m] || m).replace(/\s+/g, ' ').trim();
}

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function normalizeKey(str) {
  return removeAccents(str).replace(/[^A-Z]/g, '');
}

function titleCaseWord(w) {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function titleCasePhrase(phrase) {
  if (!phrase) return '';
  const lowercaseWords = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y', 'e', 'i', 'da', 'di']);
  const words = phrase.trim().split(/\s+/);
  return words.map((w, idx) => {
    const low = w.toLowerCase();
    if (idx > 0 && lowercaseWords.has(low)) return low;
    if (w.includes('-')) {
      return w.split('-').map(titleCaseWord).join('-');
    }
    return titleCaseWord(w);
  }).join(' ');
}

function extractFirstSurname(surnames) {
  if (!surnames) return '';
  const clean = surnames.trim();
  const upper = removeAccents(clean);
  const prefixes = ['DE LA ', 'DE LAS ', 'DEL ', 'DE ', 'LA ', 'LAS ', 'LOS ', 'SAN ', 'SANTA '];
  for (const p of prefixes) {
    if (upper.startsWith(p)) {
      const rest = clean.slice(p.length).trim().split(/\s+/);
      if (rest.length > 0) {
        return clean.slice(0, p.length) + rest[0];
      }
    }
  }
  return clean.split(/\s+/)[0];
}

function parseProfessorLine(rawLine, idPdi = null) {
  const parts = rawLine.split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  const [apellidos, nombres] = parts;
  const firstSurname = extractFirstSurname(apellidos);
  const initials = nombres.split(/\s+/).map(w => removeAccents(w)[0]).join('');
  const shortCode = initials + normalizeKey(firstSurname);
  const fullSurnamesKey = normalizeKey(apellidos);
  const firstSurnameKey = normalizeKey(firstSurname);
  const fullNameKey = normalizeKey(nombres + ' ' + apellidos);
  const reverseFullNameKey = normalizeKey(apellidos + ' ' + nombres);
  const displayName = titleCasePhrase(nombres) + ' ' + titleCasePhrase(firstSurname);
  
  return {
    idPdi,
    raw: rawLine,
    apellidos,
    nombres,
    firstSurname,
    initials,
    shortCode,
    fullSurnamesKey,
    firstSurnameKey,
    fullNameKey,
    reverseFullNameKey,
    displayName
  };
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

async function fetchWithRetry(url, retries = 4, delayMs = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,eu;q=0.8'
        }
      });
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        if (i < retries) {
          const wait = delayMs * Math.pow(2, i);
          console.warn(`[HTTP ${res.status}] en ${url}. Reintentando en ${wait}ms (${i + 1}/${retries})...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
      }
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
}

/**
 * 1. Obtiene la lista completa de grados ofertados por la UPV/EHU
 */
export async function getEhuDegreeCatalog() {
  const catalogUrl = 'https://www.ehu.eus/es/web/graduak';
  const res = await fetchWithRetry(catalogUrl);
  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al consultar el catálogo de grados: ${catalogUrl}`);
  }
  const html = await res.text();

  const regex = /<a[^>]*href="(https:\/\/www\.ehu\.eus\/es\/web\/graduak\/[^"#?]+)"[^>]*>([^<]+)(?:<small>([^<]*)<\/small>)?/g;
  
  const degrees = [];
  const seenUrls = new Set();
  let m;

  while ((m = regex.exec(html)) !== null) {
    const url = m[1].trim();
    const title = decodeHtmlEntities(m[2]);
    const details = decodeHtmlEntities(m[3] || '');

    if (seenUrls.has(url) || url.endsWith('/graduak') || url.includes('sarbidea')) {
      continue;
    }
    seenUrls.add(url);

    const campusMatch = details.match(/\((Bizkaia|Gipuzkoa|Álava|Alava)\)/i);
    const campus = campusMatch ? campusMatch[1] : '';

    const centerMatch = details.match(/\(([^)]+)\)\s*$/);
    const center = centerMatch && centerMatch[1] !== campus ? centerMatch[1] : '';

    degrees.push({
      url,
      slug: url.replace('https://www.ehu.eus/es/web/graduak/', ''),
      title,
      details,
      campus,
      center
    });
  }

  return degrees;
}

/**
 * 2. Descarga y analiza la lista de profesores de un grado específico
 */
export async function getDegreeProfessors(degreeUrl) {
  const profUrl = `${degreeUrl}/profesorado`;
  try {
    const res = await fetchWithRetry(profUrl);
    if (!res.ok) {
      return { success: false, status: res.status, professors: [] };
    }
    const html = await res.text();

    const pdiRegex = /<a[^>]*idPdi=(\d+)[^>]*>([^<]+)<\/a>/g;
    const professors = [];
    const seenPdi = new Set();
    let m;

    while ((m = pdiRegex.exec(html)) !== null) {
      const idPdi = m[1].trim();
      const rawName = decodeHtmlEntities(m[2].trim());
      
      if (!seenPdi.has(idPdi)) {
        seenPdi.add(idPdi);
        professors.push({ idPdi, rawName });
      }
    }

    return { success: true, status: res.status, professors };
  } catch (e) {
    return { success: false, status: 0, error: e.message, professors: [] };
  }
}

/**
 * 3. Ejecución del proceso de sincronización completa
 */
export async function syncAllDegrees(options = {}) {
  const {
    concurrency = 2,
    requestDelay = 350,
    saveTxt = false,
    outDir = 'Profesorado',
    saveJson = true,
    jsonPath = 'scripts/upv_professors_db.json',
    updateApp = false,
    appJsonPath = 'app/utils/teachersData.json',
    minSuccessRatio = 0.90 // Al menos el 90% de los grados deben tener listado docente
  } = options;

  console.log('=== SINCRONIZADOR DE PROFESORADO UPV/EHU ===');
  console.log('1. Obteniendo catálogo de grados desde ehu.eus...');
  const degrees = await getEhuDegreeCatalog();
  console.log(`-> Se encontraron ${degrees.length} grados oficiales.\r\n`);

  console.log(`2. Descargando profesorado (concurrencia: ${concurrency}, retardo: ${requestDelay}ms)...\r\n`);
  const results = [];

  async function fetchOneDegree(deg) {
    const data = await getDegreeProfessors(deg.url);
    return {
      ...deg,
      success: data.success,
      status: data.status,
      error: data.error,
      profCount: data.professors.length,
      professors: data.professors
    };
  }

  // Pase 1: Descarga estructurada con concurrencia controlada
  for (let i = 0; i < degrees.length; i += concurrency) {
    const chunk = degrees.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fetchOneDegree));
    results.push(...chunkResults);

    process.stdout.write(`Progreso: ${Math.min(results.length, degrees.length)} / ${degrees.length} grados procesados...\r`);
    if (requestDelay > 0) {
      await new Promise(r => setTimeout(r, requestDelay));
    }
  }

  // Pase 2: Ronda de rescate para grados que sufrieron error de red (HTTP !== 200 o fallo de fetch)
  const networkFailures = results.filter(r => !r.success || r.status !== 200);
  if (networkFailures.length > 0) {
    console.log(`\r\n\r\n-> ${networkFailures.length} grados fallaron por red. Iniciando ronda de rescate tras enfriamiento...`);
    await new Promise(r => setTimeout(r, 3000));

    for (let i = 0; i < networkFailures.length; i++) {
      const failed = networkFailures[i];
      console.log(`  Reintentando (${i + 1}/${networkFailures.length}): ${failed.title}...`);
      const retryResult = await fetchOneDegree(failed);
      if (retryResult.success && retryResult.status === 200) {
        const targetIdx = results.findIndex(r => r.url === failed.url);
        if (targetIdx !== -1) results[targetIdx] = retryResult;
        console.log(`  -> Rescatado exitosamente con ${retryResult.profCount} profesores.`);
      } else {
        console.warn(`  -> Persistió el fallo (status: ${retryResult.status}).`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Construcción limpia y no acumulativa de la plantilla activa del curso actual
  const globalProfMap = new Map(); // idPdi -> { idPdi, rawName, degrees: [] }
  const successful = results.filter(r => r.success && r.profCount > 0);
  const empty = results.filter(r => r.success && r.profCount === 0);
  const remainingErrors = results.filter(r => !r.success || r.status !== 200);

  for (const r of successful) {
    for (const p of r.professors) {
      if (!globalProfMap.has(p.idPdi)) {
        globalProfMap.set(p.idPdi, {
          idPdi: p.idPdi,
          rawName: p.rawName,
          degrees: [r.title]
        });
      } else {
        globalProfMap.get(p.idPdi).degrees.push(r.title);
      }
    }
  }

  console.log('\r\n\r\n--- RESUMEN DE LA DESCARGA ---');
  console.log(`- Grados analizados en el catálogo: ${degrees.length}`);
  console.log(`- Grados con profesorado obtenido: ${successful.length}`);
  console.log(`- Grados sin listado o no asignados (HTTP 200): ${empty.length}`);
  console.log(`- Grados con error HTTP / red no resuelto: ${remainingErrors.length}`);
  console.log(`- Total de profesores únicos activos encontrados: ${globalProfMap.size}`);

  // BARRERA DE SEGURIDAD (Safety Guard)
  // 1. Ratio de grados exitosos
  const successRatio = successful.length / degrees.length;
  console.log(`- Ratio de éxito de grados: ${(successRatio * 100).toFixed(1)}% (mínimo requerido: ${(minSuccessRatio * 100).toFixed(0)}%)`);

  // 2. Comprobación comparativa con el mes anterior para detectar caídas anómalas
  let prevDb = null;
  if (fs.existsSync(jsonPath)) {
    try {
      prevDb = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (_) {}
  }

  if (prevDb && prevDb.totalUniqueProfessors) {
    const minExpectedProfs = Math.floor(prevDb.totalUniqueProfessors * 0.85);
    console.log(`- Comparación con registro previo: ${globalProfMap.size} vs ${prevDb.totalUniqueProfessors} docentes (mínimo de seguridad: ${minExpectedProfs})`);
    if (globalProfMap.size < minExpectedProfs) {
      throw new Error(
        `[ABORTADO POR SEGURIDAD] Se detectó una caída anómala en el censo docente: ${globalProfMap.size} profesores obtenidos frente a los ${prevDb.totalUniqueProfessors} del mes anterior (umbral mínimo del 85%: ${minExpectedProfs}). Se aborta la actualización para no corromper la base de datos.`
      );
    }
  }

  if (successRatio < minSuccessRatio) {
    throw new Error(
      `[ABORTADO POR SEGURIDAD] Solo el ${(successRatio * 100).toFixed(1)}% de los grados pudieron resolverse con éxito (umbral mínimo: ${(minSuccessRatio * 100).toFixed(0)}%). No se sobrescribe la base de datos.`
    );
  }

  if (remainingErrors.length > 5) {
    throw new Error(
      `[ABORTADO POR SEGURIDAD] Demasiados errores de red (${remainingErrors.length}). Abortando para proteger los datos existentes.`
    );
  }

  // Exportar archivos .txt si se solicitó
  if (saveTxt) {
    console.log(`\r\n3. Exportando archivos .txt a la carpeta "${outDir}"...`);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (const r of successful) {
      let filename = sanitizeFilename(r.title);
      if (r.campus) filename += ` (${r.campus})`;
      const filePath = path.join(outDir, `${filename}.txt`);
      const lines = r.professors.map(p => p.rawName).sort((a, b) => a.localeCompare(b, 'es'));
      fs.writeFileSync(filePath, lines.join('\r\n'), 'utf-8');
    }

    const globalLines = Array.from(globalProfMap.values())
      .map(p => p.rawName)
      .sort((a, b) => a.localeCompare(b, 'es'));
    fs.writeFileSync(path.join(outDir, 'Profesorado.txt'), globalLines.join('\r\n'), 'utf-8');
    console.log(`-> Se exportaron ${successful.length} archivos de grado + Profesorado.txt.`);
  }

  // Guardar JSON maestro limpio del curso actual (no acumulativo)
  if (saveJson) {
    console.log(`\r\n4. Guardando base de datos JSON en "${jsonPath}"...`);
    const dbPayload = {
      updatedAt: new Date().toISOString(),
      academicYear: '2026/2027',
      totalDegrees: degrees.length,
      successfulDegrees: successful.length,
      totalUniqueProfessors: globalProfMap.size,
      professorsByPdi: Object.fromEntries(globalProfMap),
      degrees: successful.map(d => ({
        title: d.title,
        campus: d.campus,
        center: d.center,
        slug: d.slug,
        profCount: d.profCount,
        professors: d.professors
      }))
    };
    fs.writeFileSync(jsonPath, JSON.stringify(dbPayload, null, 2), 'utf-8');
    console.log(`-> JSON de catálogo guardado exitosamente (${successful.length} grados y ${globalProfMap.size} docentes).`);
  }

  // Actualizar app/utils/teachersData.json consumido por la aplicación
  if (updateApp) {
    console.log(`\r\n5. Compilando y actualizando "${appJsonPath}"...`);
    const byPdi = {};
    const globalLookup = {};
    const allKnownSurnames = new Set();

    function addToLookup(key, item) {
      if (!key) return;
      if (!globalLookup[key]) globalLookup[key] = [];
      const exists = globalLookup[key].some(x => x.displayName === item.displayName);
      if (!exists) {
        globalLookup[key].push(item);
      }
    }

    for (const [idPdi, pObj] of globalProfMap.entries()) {
      const parsed = parseProfessorLine(pObj.rawName, idPdi);
      if (!parsed) continue;

      byPdi[idPdi] = parsed.displayName;

      const item = {
        displayName: parsed.displayName,
        apellidos: parsed.apellidos,
        firstSurname: parsed.firstSurname,
        nombres: parsed.nombres,
        idPdi: idPdi
      };

      const keys = [
        parsed.shortCode,
        parsed.fullSurnamesKey,
        parsed.fullNameKey,
        parsed.reverseFullNameKey
      ];

      for (const k of keys) {
        addToLookup(k, item);
      }
      allKnownSurnames.add(normalizeKey(parsed.firstSurname));
    }

    const appData = {
      byPdi,
      global: globalLookup,
      surnames: Array.from(allKnownSurnames)
    };

    fs.writeFileSync(appJsonPath, JSON.stringify(appData, null, 2), 'utf-8');
    console.log(`-> "${appJsonPath}" actualizado con ${Object.keys(byPdi).length} docentes por idPdi y ${Object.keys(globalLookup).length} claves de búsqueda.`);
  }

  console.log('\r\n=== PROCESO COMPLETADO SATISFACTORIAMENTE ===\r\n');
  return {
    degrees,
    successful,
    empty,
    totalUniqueProfessors: globalProfMap.size
  };
}

// Ejecución directa si se invoca por CLI
if (process.argv[1] && process.argv[1].endsWith('sync_upv_professors.mjs')) {
  const saveTxt = process.argv.includes('--save-txt');
  const updateApp = process.argv.includes('--update-app');
  const saveJson = !process.argv.includes('--no-json');
  const outDirArg = process.argv.find(a => a.startsWith('--out-dir='));
  const outDir = outDirArg ? outDirArg.split('=')[1] : 'Profesorado';
  const jsonArg = process.argv.find(a => a.startsWith('--json-path='));
  const jsonPath = jsonArg ? jsonArg.split('=')[1] : 'scripts/upv_professors_db.json';
  const appJsonArg = process.argv.find(a => a.startsWith('--app-json='));
  const appJsonPath = appJsonArg ? appJsonArg.split('=')[1] : 'app/utils/teachersData.json';

  syncAllDegrees({ saveTxt, outDir, saveJson, jsonPath, updateApp, appJsonPath }).catch((err) => {
    console.error('\r\nERROR CRÍTICO EN LA SINCRONIZACIÓN:', err.message);
    process.exit(1);
  });
}

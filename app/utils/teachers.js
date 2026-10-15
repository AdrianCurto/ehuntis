import teachersData from './teachersData.json';

const LOWERCASE_PARTICLES = new Set([
  'de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y', 'e', 'i', 'da', 'di'
]);

export function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function normalizeKey(str) {
  return removeAccents(str).replace(/[^A-Z]/g, '');
}

export function titleCaseWord(w) {
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function titleCasePhrase(phrase) {
  if (!phrase) return '';
  const words = phrase.trim().split(/\s+/);
  return words.map((w, idx) => {
    const low = w.toLowerCase();
    if (idx > 0 && LOWERCASE_PARTICLES.has(low)) return low;
    if (w.includes('-')) {
      return w.split('-').map(titleCaseWord).join('-');
    }
    return titleCaseWord(w);
  }).join(' ');
}

export function extractFirstSurname(surnames) {
  if (!surnames) return '';
  const clean = surnames.trim();
  const upper = removeAccents(clean);
  const prefixes = [
    'DE LA ', 'DE LAS ', 'DEL ', 'DE ', 'LA ', 'LAS ', 'LOS ', 'SAN ', 'SANTA '
  ];
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

const surnameSet = new Set(teachersData?.surnames || []);

export function formatSmartFallback(rawCode, longname) {
  if (!rawCode && !longname) return '';
  const cleanCode = (rawCode || '').replace(/-\d+$/, '').trim();
  const upperCode = normalizeKey(cleanCode);

  if (longname && typeof longname === 'string' && longname.trim()) {
    const firstSurname = extractFirstSurname(longname);
    const cleanFirstSurname = normalizeKey(firstSurname);
    const cleanLong = normalizeKey(longname);

    // Check if upperCode ends with full longname (e.g. ALOPEZARRAIZA -> LOPEZARRAIZA)
    if (cleanLong && upperCode.endsWith(cleanLong)) {
      const initials = upperCode.slice(0, upperCode.length - cleanLong.length);
      const formattedInitials = initials.split('').map(c => `${c}.`).join(' ');
      const formattedSurname = titleCasePhrase(firstSurname);
      return (formattedInitials ? formattedInitials + ' ' : '') + formattedSurname;
    }

    // Check if upperCode ends with first surname (e.g. AERCORECA -> ERCORECA)
    if (cleanFirstSurname && upperCode.endsWith(cleanFirstSurname)) {
      const initials = upperCode.slice(0, upperCode.length - cleanFirstSurname.length);
      const formattedInitials = initials.split('').map(c => `${c}.`).join(' ');
      const formattedSurname = titleCasePhrase(firstSurname);
      return (formattedInitials ? formattedInitials + ' ' : '') + formattedSurname;
    }

    return titleCasePhrase(firstSurname);
  }

  // If no longname, check against known first surnames
  for (let i = 1; i <= Math.min(3, upperCode.length - 2); i++) {
    const possibleInitials = upperCode.slice(0, i);
    const possibleSurname = upperCode.slice(i);
    if (surnameSet.has(possibleSurname)) {
      const formattedInitials = possibleInitials.split('').map(c => `${c}.`).join(' ');
      const formattedSurname = titleCasePhrase(possibleSurname);
      return `${formattedInitials} ${formattedSurname}`;
    }
  }

  // Fallback: 1 initial + title-cased rest
  if (upperCode.length > 1) {
    const init = upperCode[0];
    const rest = titleCasePhrase(upperCode.slice(1));
    return `${init}. ${rest}`;
  }

  return cleanCode;
}

export function resolveTeacher(teacherInput, degreeName = null) {
  if (!teacherInput) return '';

  let rawCode = '';
  let longName = '';
  let externalkey = '';

  if (typeof teacherInput === 'object' && teacherInput !== null) {
    rawCode = teacherInput.name || teacherInput.code || teacherInput.id?.toString() || '';
    longName = teacherInput.longname || teacherInput.longName || '';
    externalkey = teacherInput.externalkey || teacherInput.externalKey || teacherInput.idPdi || '';
  } else if (typeof teacherInput === 'string') {
    rawCode = teacherInput;
  }

  const cleanCode = rawCode.replace(/-\d+$/, '').trim();

  // CASO SINGULAR: Plazas genéricas docentes (PGD) o sustituciones sin asignar
  if (
    cleanCode.toUpperCase().startsWith('PGD') ||
    (externalkey && externalkey.toString().toUpperCase().startsWith('PGD')) ||
    (longName && longName.toUpperCase().startsWith('PGD'))
  ) {
    return '';
  }

  // 1. Coincidencia directa e inequívoca por externalkey (idPdi de la UPV/EHU)
  if (externalkey && teachersData?.byPdi) {
    const pdiKey = externalkey.toString().trim();
    if (teachersData.byPdi[pdiKey]) {
      const match = teachersData.byPdi[pdiKey];
      return typeof match === 'string' ? match : match.displayName;
    }
  }

  const codeKey = normalizeKey(cleanCode);
  const longKey = normalizeKey(longName);

  // Candidate lookup keys
  const candidateKeys = [codeKey, longKey].filter(Boolean);

  // 1. Try degree-specific map if degreeName is provided
  if (degreeName && teachersData?.degrees) {
    const degreeKey = normalizeKey(degreeName);
    for (const [key, dMap] of Object.entries(teachersData.degrees)) {
      if (degreeKey.includes(key) || key.includes(degreeKey)) {
        for (const ck of candidateKeys) {
          if (dMap[ck] && dMap[ck].length === 1) {
            return dMap[ck][0].displayName;
          }
        }
      }
    }
  }

  // 2. Try global map
  if (teachersData?.global) {
    for (const ck of candidateKeys) {
      if (teachersData.global[ck]) {
        const matches = teachersData.global[ck];
        if (matches.length === 1) {
          return matches[0].displayName;
        }
        // Disambiguate if we have both code and longname
        if (longKey) {
          const exact = matches.find(m => {
            const normApe = normalizeKey(m.apellidos);
            const normFirst = normalizeKey(m.firstSurname);
            return normApe.includes(longKey) || longKey.includes(normFirst);
          });
          if (exact) return exact.displayName;
        }
      }
    }
  }

  // Check if string is already formatted (e.g. "Aitor Ercoreca" or "Mikel Palmero")
  if (
    typeof rawCode === 'string' &&
    /[a-z]/.test(rawCode) &&
    rawCode.includes(' ') &&
    !rawCode.includes('.') &&
    !rawCode.match(/-\d+$/)
  ) {
    return titleCasePhrase(rawCode);
  }

  // 3. Fallback
  return formatSmartFallback(cleanCode, longName);
}

export function formatTeacher(teacherInput, degreeName = null) {
  return resolveTeacher(teacherInput, degreeName);
}

export function getTeacherCandidates(rawTeacher) {
  if (!rawTeacher || typeof rawTeacher !== 'string') return [];
  const clean = rawTeacher.replace(/-\d+$/, '').trim();
  if (!clean || clean.toUpperCase().startsWith('PGD')) return [];

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1) return [clean];

  // Detect compound surname prefix at the end (e.g., "de la Cruz", "San Martin", "del Rio")
  const prefixes = ['de la', 'de las', 'del', 'de', 'la', 'las', 'los', 'san', 'santa'];
  let surname = parts[parts.length - 1];
  let firstNameParts = parts.slice(0, -1);

  if (parts.length >= 3) {
    const twoBefore = parts.slice(-3, -1).join(' ').toLowerCase();
    if (twoBefore === 'de la' || twoBefore === 'de las') {
      surname = parts.slice(-3).join(' ');
      firstNameParts = parts.slice(0, -3);
    }
  }
  if (firstNameParts.length === parts.slice(0, -1).length && parts.length >= 2) {
    const oneBefore = parts[parts.length - 2].toLowerCase();
    if (prefixes.includes(oneBefore)) {
      surname = parts.slice(-2).join(' ');
      firstNameParts = parts.slice(0, -2);
    }
  }

  if (firstNameParts.length === 0) {
    firstNameParts = [parts[0]];
    surname = parts.slice(1).join(' ');
  }

  const candidates = [];
  // 1. Full clean string: "Aitor Ercoreca" or "Francisco Javier Velasco"
  candidates.push(clean);

  // 2. All initials + surname: "F. J. Velasco" (if >= 2 first name parts)
  if (firstNameParts.length >= 2) {
    const inits = firstNameParts.map(p => `${p[0].toUpperCase()}.`).join(' ');
    candidates.push(`${inits} ${surname}`);
  }

  // 3. First initial + surname: "A. Ercoreca" or "F. Velasco"
  const firstInit = firstNameParts[0][0].toUpperCase();
  candidates.push(`${firstInit}. ${surname}`);

  // 4. Surname only: "Ercoreca" or "Velasco"
  candidates.push(surname);

  return [...new Set(candidates.filter(Boolean))];
}

const teachersModule = {
  resolveTeacher,
  formatTeacher,
  getTeacherCandidates,
  formatSmartFallback,
  extractFirstSurname,
  removeAccents,
  normalizeKey,
  titleCasePhrase,
  titleCaseWord
};

export default teachersModule;

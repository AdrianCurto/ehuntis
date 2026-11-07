/**
 * Utilities for analyzing and extracting subgroup information from WebUntis class types (lstext).
 */

/**
 * Normalizes the class type for merging blocks.
 * "Magistral", "M", "GA", "T" are all treated as "MAGISTRAL_GA".
 * Other types are returned as is (uppercase).
 * 
 * @param {string} lstext 
 * @returns {string} The normalized type for merging
 */
export function getMergeType(lstext) {
  if (!lstext) return "";
  const upper = lstext.toUpperCase();
  
  if (
    upper.includes("MAGIS") ||
    upper === "M" ||
    upper.startsWith("GA") ||
    upper.startsWith("G.A.") ||
    upper === "T" || 
    upper.startsWith("T0")
  ) {
    return "MAGISTRAL_GA";
  }
  
  return upper;
}

/**
 * Extracts a normalized subgroup key from a class type (e.g. "GL-1" -> "GL1", "S-2" -> "S2", "TI-1" -> "TI1").
 * Returns null if it's a base theory class (Magistral, GA) or not a subgroup.
 * 
 * @param {string} lstext 
 * @returns {string|null} The normalized subgroup key (e.g. "GL1", "S2") or null
 */
export function extractSubgroupKey(lstext) {
  if (!lstext) return null;
  const clean = lstext.trim();
  const upper = clean.toUpperCase();
  
  if (
    upper.includes('MAGIS') ||
    upper === 'M' ||
    upper.startsWith('GA ') ||
    upper === 'GA' ||
    upper.startsWith('G.A.') ||
    upper === 'T' ||
    upper.startsWith('T0') ||
    upper.includes('EM/CM') ||
    upper.includes('EXAMEN') ||
    upper.includes('BERRESKUR') ||
    upper.includes('RECUPER') ||
    upper.includes('CLASE ADICIONAL')
  ) {
    return null;
  }
  
  // Specific recognized prefixes: GL, GO, S, TI, TA, GCA, PA, PL
  const prefixMatch = upper.match(/^(?:G\.?L\.?|G\.?O\.?|G\.?C\.?A\.?|T\.?I\.?|T\.?A\.?|P\.?A\.?|P\.?L\.?|S)[,\-\.\s]*(\d+)/);
  if (prefixMatch) {
    const rawPrefix = upper.match(/^(G\.?L\.?|G\.?O\.?|G\.?C\.?A\.?|T\.?I\.?|T\.?A\.?|P\.?A\.?|P\.?L\.?|S)/)[1];
    const normPrefix = rawPrefix.replace(/\./g, '');
    return normPrefix + prefixMatch[1];
  }
  
  // Generic fallback: letters followed by digits (e.g., "P1", "LAB2")
  const fallback = upper.match(/^([A-Z]{1,4})[,\-\.\s]*(\d+)/);
  if (fallback) {
    return fallback[1] + fallback[2];
  }
  
  return null;
}

/**
 * Extracts the subgroup number from a class type.
 * e.g., "GL1.1" -> 1, "G.L.2" -> 2, "S,3" -> 3.
 * Returns null if it's a base class (Magistral) or no number is found.
 * 
 * @param {string} lstext 
 * @returns {number|null} The subgroup number, or null
 */
export function extractSubgroupNumber(lstext) {
  const key = extractSubgroupKey(lstext);
  if (!key) return null;
  const match = key.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Determines whether a class type represents a generic theory or magistral class
 * (Magistral, M, GA, T, Teoría) without specific subgroup designation.
 * 
 * @param {string} lstext 
 * @returns {boolean} True if it is a magistral/theory/GA class without a subgroup
 */
export function isMagistralType(lstext) {
  if (!lstext) return false;
  const raw = lstext.trim();
  const upper = raw.toUpperCase();
  const numMatch = raw.match(/\d+/);
  const subNum = extractSubgroupNumber(raw) || (numMatch ? parseInt(numMatch[0], 10) : null);
  return (
    upper.includes("MAGIS") ||
    upper === "M" ||
    upper === "GA" ||
    upper.startsWith("GA ") ||
    upper.startsWith("G.A.") ||
    upper === "T" ||
    upper.startsWith("T0") ||
    upper.includes("TEOR")
  ) && subNum === null;
}

/**
 * Normalizes and formats classroom codes.
 * Removes internal spaces in alphanumeric codes such as "P2 G3A" -> "P2G3A", "P1 I2S" -> "P1I2S", "S1 A8A" -> "S1A8A".
 * Preserves descriptive room names such as "Aula 1.4", "Lab Física", "Despacho 2.14".
 * 
 * @param {string} rawRoom 
 * @returns {string} Formatted room string
 */
export function formatRoom(rawRoom) {
  if (!rawRoom || typeof rawRoom !== 'string') return '';
  const trimmed = rawRoom.trim();
  // Strip trailing _id suffix if present (e.g. from WebUntis internals)
  const clean = trimmed.replace(/_\d+$/, '');
  
  // If it's a code with letters and numbers (like P2G3A, P2 G3A, P1 I2S, S1 A8A, P 2 G 3 A)
  // without descriptive words like "Aula", "Lab", "Despacho", "Sala", "Seminario", "Auditorio"
  const words = clean.split(/\s+/);
  const hasLetters = /[A-Za-z]/.test(clean);
  const hasDigits = /[0-9]/.test(clean);
  const isAlphaNumOnly = /^[A-Za-z0-9\s]+$/.test(clean);
  
  if (hasLetters && hasDigits && isAlphaNumOnly) {
    const isDescriptive = words.some(w => /^(aula|lab|laboratorio|despacho|sala|seminario|taller|auditorio)$/i.test(w));
    if (!isDescriptive) {
      return clean.replace(/\s+/g, '');
    }
  }
  return clean;
}

/**
 * Formats a list of rooms or a single room string into a clean string.
 * 
 * @param {string[]|string} rooms 
 * @returns {string}
 */
export function formatRooms(rooms) {
  if (!rooms) return '';
  if (Array.isArray(rooms)) {
    return rooms.map(formatRoom).filter(Boolean).join(', ');
  }
  return formatRoom(String(rooms));
}



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


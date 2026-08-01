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
 * Extracts the subgroup number from a class type.
 * e.g., "GL1.1" -> 1, "G.L.2" -> 2, "S,3" -> 3.
 * Returns null if it's a base class (Magistral) or no number is found.
 * 
 * @param {string} lstext 
 * @returns {number|null} The subgroup number, or null
 */
export function extractSubgroupNumber(lstext) {
  if (!lstext) return null;
  const upper = lstext.toUpperCase();
  
  // Base classes don't have user-selectable subgroups
  if (
    upper.includes("MAGIS") ||
    upper === "M" ||
    upper.startsWith("GA") ||
    upper.startsWith("G.A.") ||
    upper === "T" ||
    upper.startsWith("T0") ||
    upper.includes("EM/CM")
  ) {
    return null;
  }
  
  // Look for standard lab/seminar prefixes followed by anything non-numeric, then a digit
  // Matches: GL, G.L., GO, G.O., S, S., S,, GL,, GO,
  const match = upper.match(/(?:GL|G\.L\.|GO|G\.O\.|S|S\.|S,|GL,|GO,)[^\d]*(\d)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Fallback: if it has *any* digit after some letters and isn't magistral, return the first digit.
  // This helps catch "TA1", "PA2", etc.
  const fallbackMatch = upper.match(/[A-Z]+[^\d]*(\d)/);
  if (fallbackMatch) {
    return parseInt(fallbackMatch[1], 10);
  }
  
  return null;
}

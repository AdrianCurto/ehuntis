/**
 * Pure geometry helper that decides the size of the top-right status indicator
 * (edited pencil, swapped arrows, remote drift alert) on a calendar block so it
 * ALWAYS stays in the top-right corner, scales down smoothly to fit without
 * shifting centered subgroup badges (GA, Magistral, GL1...), and never moves
 * below the badge or into subject text.
 */

export const STATUS_ICON_GAP_PX = 2;
export const STATUS_CORNER_LG_WIDTH_PX = 13;
export const STATUS_CORNER_MD_WIDTH_PX = 11;
export const STATUS_CORNER_SM_WIDTH_PX = 9;
export const STATUS_CORNER_XS_WIDTH_PX = 8;

export function getStatusIconsWidth(showEditedIconOrOptions, maybeHasDrift, maybeUnitSize) {
  let showEdited = false;
  let isSwapped = false;
  let isEdited = false;
  let hasDrift = false;
  let unitSize = STATUS_CORNER_MD_WIDTH_PX;

  if (typeof showEditedIconOrOptions === 'object' && showEditedIconOrOptions !== null) {
    showEdited = Boolean(showEditedIconOrOptions.showEditedIcon);
    isSwapped = Boolean(showEditedIconOrOptions.isSwapped);
    isEdited = Boolean(showEditedIconOrOptions.isEdited);
    hasDrift = Boolean(showEditedIconOrOptions.hasDrift);
    unitSize = showEditedIconOrOptions.unitSize || STATUS_CORNER_MD_WIDTH_PX;
  } else {
    showEdited = Boolean(showEditedIconOrOptions);
    hasDrift = Boolean(maybeHasDrift);
    unitSize = maybeUnitSize || STATUS_CORNER_MD_WIDTH_PX;
  }

  // Cuando una clase está intercambiada y editada a la vez, ambas pestañas se apilan
  // verticalmente en una columna, por lo que en el eje horizontal ocupan exactamente 1 unidad.
  const hasVerticalPair = isSwapped && isEdited;
  const count = (hasVerticalPair || showEdited || isSwapped || isEdited ? 1 : 0) + (hasDrift ? 1 : 0);
  if (count === 0) return 0;
  return count * unitSize + (count > 1 ? STATUS_ICON_GAP_PX : 0);
}

/**
 * Maximum badge width that still leaves enough symmetric room on the right corner
 * for at least the smallest corner tab (corner-xs) without touching or shifting
 * the centered badge.
 */
export function getMaxCenteredBadgeWidthForCorner({
  showEditedIcon = false,
  isSwapped = false,
  isEdited = false,
  hasDrift = false,
  blockWidth = 0,
} = {}) {
  const safeBlockWidth = Number.isFinite(blockWidth) ? Math.max(0, blockWidth) : 0;
  const hasActiveSwapped = Boolean(isSwapped);
  const hasActiveEdited = Boolean(isEdited || (!isSwapped && showEditedIcon));
  if (!hasActiveSwapped && !hasActiveEdited && !hasDrift) return safeBlockWidth;

  const minCornerWidth = getStatusIconsWidth({
    showEditedIcon,
    isSwapped: hasActiveSwapped,
    isEdited: hasActiveEdited,
    hasDrift,
    unitSize: STATUS_CORNER_XS_WIDTH_PX,
  });
  return Math.max(0, safeBlockWidth - (minCornerWidth + 1) * 2);
}

/**
 * Returns one of:
 * - 'none': no status indicators to display
 * - 'corner-lg': 13px tab in top-right corner (icon 8px)
 * - 'corner-md': 11px tab in top-right corner (icon 7px)
 * - 'corner-sm': 9px tab in top-right corner (icon 6px)
 * - 'corner-xs': 8px tab in top-right corner (icon 5.5px)
 *
 * Always stays in the top-right corner, never below the badge.
 *
 * @param {Object} params
 * @param {boolean} [params.showEditedIcon]
 * @param {boolean} [params.isSwapped]
 * @param {boolean} [params.isEdited]
 * @param {boolean} [params.hasDrift]
 * @param {boolean} [params.hasBadge]
 * @param {number} [params.badgeWidth]
 * @param {number} [params.blockWidth]
 * @param {number} [params.blockHeight]
 * @returns {'none' | 'corner-lg' | 'corner-md' | 'corner-sm' | 'corner-xs'}
 */
export function resolveStatusIndicatorPlacement({
  showEditedIcon = false,
  isSwapped = false,
  isEdited = false,
  hasDrift = false,
  hasBadge = false,
  badgeWidth = 0,
  blockWidth = 0,
  blockHeight = 0,
} = {}) {
  const hasActiveSwapped = Boolean(isSwapped);
  const hasActiveEdited = Boolean(isEdited || (!isSwapped && showEditedIcon));
  const hasAnyIndicator = hasActiveSwapped || hasActiveEdited || Boolean(hasDrift);

  if (!hasAnyIndicator) {
    return 'none';
  }

  const safeBlockWidth = Number.isFinite(blockWidth) ? Math.max(0, blockWidth) : 0;
  const safeBadgeWidth = Number.isFinite(badgeWidth) ? Math.max(0, badgeWidth) : 0;
  const safeBlockHeight = Number.isFinite(blockHeight) ? Math.max(0, blockHeight) : 0;
  const isDualStack = hasActiveSwapped && hasActiveEdited;

  const lgWidth = getStatusIconsWidth({ isSwapped: hasActiveSwapped, isEdited: hasActiveEdited, hasDrift, unitSize: STATUS_CORNER_LG_WIDTH_PX });
  const mdWidth = getStatusIconsWidth({ isSwapped: hasActiveSwapped, isEdited: hasActiveEdited, hasDrift, unitSize: STATUS_CORNER_MD_WIDTH_PX });
  const smWidth = getStatusIconsWidth({ isSwapped: hasActiveSwapped, isEdited: hasActiveEdited, hasDrift, unitSize: STATUS_CORNER_SM_WIDTH_PX });

  // Without a visible badge: pick largest comfortable corner tab for this block width
  let candidate = 'corner-xs';
  if (!hasBadge) {
    if (safeBlockWidth >= 70) candidate = 'corner-lg';
    else if (safeBlockWidth >= mdWidth + 6) candidate = 'corner-md';
    else if (safeBlockWidth >= smWidth + 4) candidate = 'corner-sm';
    else candidate = 'corner-xs';
  } else {
    // With a centered badge: right corner gets (blockWidth - badgeWidth) / 2 symmetrically
    const symmetricCornerSpace = (safeBlockWidth - safeBadgeWidth) / 2;
    if (symmetricCornerSpace >= lgWidth + 2) {
      candidate = 'corner-lg';
    } else if (symmetricCornerSpace >= mdWidth + 1) {
      candidate = 'corner-md';
    } else if (symmetricCornerSpace >= smWidth + 0.5) {
      candidate = 'corner-sm';
    } else {
      candidate = 'corner-xs';
    }
  }

  // Si hay doble etiqueta vertical (intercambiada arriba + editada abajo),
  // ajustamos el tamaño cuando la altura vertical del bloque es reducida
  if (isDualStack && safeBlockHeight > 0) {
    if (safeBlockHeight < 36) {
      return 'corner-xs';
    }
    if (safeBlockHeight < 48 && candidate === 'corner-lg') {
      return 'corner-md';
    }
  }

  return candidate;
}

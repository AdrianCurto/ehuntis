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

export function getStatusIconsWidth(showEditedIcon, hasDrift, unitSize) {
  const count = (showEditedIcon ? 1 : 0) + (hasDrift ? 1 : 0);
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
  hasDrift = false,
  blockWidth = 0,
} = {}) {
  const safeBlockWidth = Number.isFinite(blockWidth) ? Math.max(0, blockWidth) : 0;
  if (!showEditedIcon && !hasDrift) return safeBlockWidth;
  const minCornerWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_XS_WIDTH_PX);
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
 * @param {boolean} [params.hasDrift]
 * @param {boolean} [params.hasBadge]
 * @param {number} [params.badgeWidth]
 * @param {number} [params.blockWidth]
 * @returns {'none' | 'corner-lg' | 'corner-md' | 'corner-sm' | 'corner-xs'}
 */
export function resolveStatusIndicatorPlacement({
  showEditedIcon = false,
  hasDrift = false,
  hasBadge = false,
  badgeWidth = 0,
  blockWidth = 0,
} = {}) {
  if (!showEditedIcon && !hasDrift) {
    return 'none';
  }

  const safeBlockWidth = Number.isFinite(blockWidth) ? Math.max(0, blockWidth) : 0;
  const safeBadgeWidth = Number.isFinite(badgeWidth) ? Math.max(0, badgeWidth) : 0;

  const lgWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_LG_WIDTH_PX);
  const mdWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_MD_WIDTH_PX);
  const smWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_SM_WIDTH_PX);

  // Without a visible badge: pick largest comfortable corner tab for this block width
  if (!hasBadge) {
    if (safeBlockWidth >= 70) return 'corner-lg';
    if (safeBlockWidth >= mdWidth + 6) return 'corner-md';
    if (safeBlockWidth >= smWidth + 4) return 'corner-sm';
    return 'corner-xs';
  }

  // With a centered badge: right corner gets (blockWidth - badgeWidth) / 2 symmetrically
  const symmetricCornerSpace = (safeBlockWidth - safeBadgeWidth) / 2;
  if (symmetricCornerSpace >= lgWidth + 2) {
    return 'corner-lg';
  }
  if (symmetricCornerSpace >= mdWidth + 1) {
    return 'corner-md';
  }
  if (symmetricCornerSpace >= smWidth + 0.5) {
    return 'corner-sm';
  }
  return 'corner-xs';
}

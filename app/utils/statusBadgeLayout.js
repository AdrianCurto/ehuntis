/**
 * Pure geometry helper that decides where and at what size to place lesson status
 * indicators (edited pencil, swapped arrows, remote drift alert) on a calendar block
 * so they stay in the top-right corner whenever possible, scale down progressively
 * without shifting centered subgroup badges (GA, Magistral, GL1...), and never
 * overlap badge or subject text.
 */

export const STATUS_ICON_GAP_PX = 2;
export const STATUS_SUBROW_HEIGHT_PX = 12;
export const STATUS_HEADER_SIDE_WIDTH_PX = 13;
export const STATUS_CORNER_MD_WIDTH_PX = 11;
export const STATUS_CORNER_SM_WIDTH_PX = 9;
export const STATUS_CORNER_XS_WIDTH_PX = 8;

export function getStatusIconsWidth(showEditedIcon, hasDrift, unitSize) {
  const count = (showEditedIcon ? 1 : 0) + (hasDrift ? 1 : 0);
  if (count === 0) return 0;
  return count * unitSize + (count > 1 ? STATUS_ICON_GAP_PX : 0);
}

/**
 * Returns one of:
 * - 'none': no status indicators to display
 * - 'header-side': normal 13px badge in the right track of a symmetric `1fr auto 1fr` grid
 * - 'corner-md': compact 11px tab tucked into top-right corner (top: 0, right: 0)
 * - 'corner-sm': mini 9px tab tucked into top-right corner (top: 0, right: 0)
 * - 'header-below': centered 11px mini-row right below the badge when the badge reaches the edge
 * - 'corner-xs': extreme micro-block fallback (8px tab with real icon at top: 0, right: 0)
 *
 * @param {Object} params
 * @param {boolean} [params.showEditedIcon]
 * @param {boolean} [params.hasDrift]
 * @param {boolean} [params.hasBadge]
 * @param {number} [params.badgeWidth]
 * @param {number} [params.blockWidth]
 * @param {number} [params.availWidth]
 * @param {number} [params.availHeight]
 * @param {number} [params.usedHeight]
 * @returns {'none' | 'header-side' | 'corner-md' | 'corner-sm' | 'header-below' | 'corner-xs'}
 */
export function resolveStatusIndicatorPlacement({
  showEditedIcon = false,
  hasDrift = false,
  hasBadge = false,
  badgeWidth = 0,
  blockWidth = 0,
  availWidth = 0,
  availHeight = 0,
  usedHeight = 0,
} = {}) {
  if (!showEditedIcon && !hasDrift) {
    return 'none';
  }

  const safeAvailWidth = Number.isFinite(availWidth) ? Math.max(0, availWidth) : 0;
  const safeBlockWidth = Number.isFinite(blockWidth) && blockWidth > 0 ? blockWidth : safeAvailWidth;
  const safeBadgeWidth = Number.isFinite(badgeWidth) ? Math.max(0, badgeWidth) : 0;
  const spareHeight =
    (Number.isFinite(availHeight) ? availHeight : 0) -
    (Number.isFinite(usedHeight) ? usedHeight : 0);

  const sideWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_HEADER_SIDE_WIDTH_PX);
  const mdWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_MD_WIDTH_PX);
  const smWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_SM_WIDTH_PX);

  // Without a visible badge: place consistently in the top-right corner (zero extra height cost)
  if (!hasBadge) {
    if (safeBlockWidth >= mdWidth + 6) {
      return 'corner-md';
    }
    if (safeBlockWidth >= smWidth + 4) {
      return 'corner-sm';
    }
    return 'corner-xs';
  }

  // 1. Normal size inside header padding without shifting the centered badge
  const symmetricInnerSpace = (safeAvailWidth - safeBadgeWidth) / 2;
  if (symmetricInnerSpace >= sideWidth + STATUS_ICON_GAP_PX) {
    return 'header-side';
  }

  // 2. Compact tab tucked into physical top-right corner (reclaims horizontal padding without touching badge)
  const symmetricCornerSpace = (safeBlockWidth - safeBadgeWidth) / 2;
  if (symmetricCornerSpace >= mdWidth + 1) {
    return 'corner-md';
  }

  // 3. Mini tab tucked into physical top-right corner
  if (symmetricCornerSpace >= smWidth + 0.5) {
    return 'corner-sm';
  }

  // 4. Badge reaches nearly edge-to-edge: drop to centered mini-row below badge if vertical room allows
  if (safeAvailWidth >= mdWidth && spareHeight >= STATUS_SUBROW_HEIGHT_PX) {
    return 'header-below';
  }

  // 5. Extreme micro-block fallback: tiny real-icon corner tab
  return 'corner-xs';
}

/**
 * Helper used inside computeBlockLayout to know whether a visible badge is too wide
 * for any top-right corner placement and should try reserving a centered mini-row below it.
 */
export function needsBelowStatusRow({
  showEditedIcon = false,
  hasDrift = false,
  hasBadge = false,
  badgeWidth = 0,
  blockWidth = 0,
} = {}) {
  if ((!showEditedIcon && !hasDrift) || !hasBadge) return false;
  const smWidth = getStatusIconsWidth(showEditedIcon, hasDrift, STATUS_CORNER_SM_WIDTH_PX);
  const safeBlockWidth = Number.isFinite(blockWidth) ? Math.max(0, blockWidth) : 0;
  const safeBadgeWidth = Number.isFinite(badgeWidth) ? Math.max(0, badgeWidth) : 0;
  return (safeBlockWidth - safeBadgeWidth) / 2 < smWidth + 0.5;
}

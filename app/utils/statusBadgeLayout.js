/**
 * Pure geometry helper that decides where to place lesson status indicators
 * (edited pencil, swapped arrows, remote drift alert) on a calendar block so
 * they never overlap text or push subgroup badges (GA, Magistral, GL1...) off-center.
 */

export const STATUS_ICON_GAP_PX = 2;
export const STATUS_SUBROW_HEIGHT_PX = 14;
export const STATUS_EDITED_ICON_WIDTH_PX = 13;
export const STATUS_DRIFT_ICON_WIDTH_PX = 12;

/**
 * Returns one of:
 * - 'none': no status indicators to display
 * - 'header-side': fits cleanly in the right track of a symmetric `1fr auto 1fr` grid
 *   without shifting the centered badge or overlapping it
 * - 'header-below': does not fit beside the centered badge, so renders centered on a
 *   dedicated mini-row directly below the badge when vertical spare space permits
 * - 'header-only': no visible badge, enough vertical/horizontal space for a top-right header icon
 * - 'border': neither lateral space nor spare vertical height -> corner/border accent with 0px text loss
 *
 * @param {Object} params
 * @param {boolean} [params.showEditedIcon]
 * @param {boolean} [params.hasDrift]
 * @param {boolean} [params.hasBadge]
 * @param {number} [params.badgeWidth]
 * @param {number} [params.availWidth]
 * @param {number} [params.availHeight]
 * @param {number} [params.usedHeight]
 * @returns {'none' | 'header-side' | 'header-below' | 'header-only' | 'border'}
 */
export function resolveStatusIndicatorPlacement({
  showEditedIcon = false,
  hasDrift = false,
  hasBadge = false,
  badgeWidth = 0,
  availWidth = 0,
  availHeight = 0,
  usedHeight = 0,
} = {}) {
  if (!showEditedIcon && !hasDrift) {
    return 'none';
  }

  const iconsWidth =
    (showEditedIcon ? STATUS_EDITED_ICON_WIDTH_PX : 0) +
    (hasDrift ? STATUS_DRIFT_ICON_WIDTH_PX : 0) +
    (showEditedIcon && hasDrift ? STATUS_ICON_GAP_PX : 0);

  const safeAvailWidth = Number.isFinite(availWidth) ? Math.max(0, availWidth) : 0;
  const safeBadgeWidth = Number.isFinite(badgeWidth) ? Math.max(0, badgeWidth) : 0;
  const spareHeight =
    (Number.isFinite(availHeight) ? availHeight : 0) -
    (Number.isFinite(usedHeight) ? usedHeight : 0);

  if (!hasBadge) {
    if (safeAvailWidth >= iconsWidth && spareHeight >= STATUS_SUBROW_HEIGHT_PX) {
      return 'header-only';
    }
    return 'border';
  }

  // Symmetric check: badge sits at exact horizontal center; right track gets (availWidth - badgeWidth) / 2.
  const symmetricSideSpace = (safeAvailWidth - safeBadgeWidth) / 2;
  if (symmetricSideSpace >= iconsWidth + STATUS_ICON_GAP_PX) {
    return 'header-side';
  }

  // Centered mini-row right below the badge if spare vertical room exists without shrinking subject/room.
  if (safeAvailWidth >= iconsWidth && spareHeight >= STATUS_SUBROW_HEIGHT_PX) {
    return 'header-below';
  }

  return 'border';
}

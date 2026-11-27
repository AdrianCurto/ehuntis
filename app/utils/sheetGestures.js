/**
 * Pure physics helpers for mobile bottom Sheet swipe-to-dismiss gestures.
 */

export const SHEET_DRAG_DEADZONE_PX = 10;
export const SHEET_MIN_DISMISS_PX = 120;
export const SHEET_MAX_DISMISS_PX = 200;
export const SHEET_DISMISS_RATIO = 0.3;
export const SHEET_FLICK_MIN_PX = 72;
export const SHEET_FLICK_VELOCITY_PX_MS = 0.65;

export function getSheetDismissThreshold(sheetHeight) {
  const height = Number.isFinite(sheetHeight) && sheetHeight > 0 ? sheetHeight : 400;
  return Math.min(SHEET_MAX_DISMISS_PX, Math.max(SHEET_MIN_DISMISS_PX, Math.round(height * SHEET_DISMISS_RATIO)));
}

export function shouldDismissSheet(offsetY, sheetHeight, velocityY = 0) {
  if (!Number.isFinite(offsetY) || offsetY <= 0) return false;
  const threshold = getSheetDismissThreshold(sheetHeight);
  if (offsetY >= threshold) return true;
  if (Number.isFinite(velocityY) && velocityY >= SHEET_FLICK_VELOCITY_PX_MS && offsetY >= SHEET_FLICK_MIN_PX) {
    return true;
  }
  return false;
}

export function getSheetExitDurationMs(offsetY, sheetHeight, velocityY = 0) {
  const height = Number.isFinite(sheetHeight) && sheetHeight > 0 ? sheetHeight : 400;
  const remaining = Math.max(0, height - Math.max(0, offsetY));
  const ratio = Math.min(1, remaining / height);
  const baseDuration = Math.round(140 + ratio * 90);
  if (Number.isFinite(velocityY) && velocityY > 0.5) {
    const projected = Math.round(remaining / velocityY);
    return Math.min(baseDuration, Math.max(110, projected));
  }
  return baseDuration;
}

/**
 * Decides whether a touchstart inside a mobile Sheet may initiate a swipe-to-dismiss gesture.
 *
 * Rules:
 * - Touching a `[data-sheet-no-drag]` zone (e.g. TimePicker scroll columns) or a form control
 *   never starts a sheet drag, regardless of whether the sheet has a `[data-sheet-scroll]` body.
 * - Touching `[data-sheet-handle]` always starts a fixed-zone drag.
 * - Touching outside `[data-sheet-scroll]` ONLY counts as a fixed header/footer drag when the
 *   sheet actually has a dedicated `[data-sheet-scroll]` body AND no scrollable ancestor of the
 *   touch target is scrolled.
 * - Otherwise, dragging is only allowed if no scrollable ancestor (including `contentEl`) has
 *   `scrollTop > 0`, and `isFixedDragZone` is false so upward swipes yield immediately to scroll.
 */
export function resolveSheetTouchStart({
  fromHandle = false,
  isNoDrag = false,
  isFormControl = false,
  hasDedicatedScroll = false,
  isInsideDedicatedScroll = false,
  hasScrolledAncestor = false,
} = {}) {
  if (isNoDrag || isFormControl) {
    return { canDrag: false, isFixedDragZone: false };
  }

  if (fromHandle) {
    return { canDrag: true, isFixedDragZone: true };
  }

  const isOutsideDedicatedScroll = Boolean(hasDedicatedScroll && !isInsideDedicatedScroll);
  if (isOutsideDedicatedScroll) {
    if (hasScrolledAncestor) {
      return { canDrag: false, isFixedDragZone: false };
    }
    return { canDrag: true, isFixedDragZone: true };
  }

  if (hasScrolledAncestor) {
    return { canDrag: false, isFixedDragZone: false };
  }

  return { canDrag: true, isFixedDragZone: false };
}

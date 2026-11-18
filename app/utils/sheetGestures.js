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

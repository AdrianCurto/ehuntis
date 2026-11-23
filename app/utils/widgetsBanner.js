export const WIDGETS_BANNER_STORAGE_KEY = 'ehuntis_widgets_banner_v1';
export const WIDGETS_BANNER_DISMISSED_VALUE = 'dismissed';

export function isWidgetsBannerDismissed(
  storage = typeof window !== 'undefined' ? window.localStorage : null
) {
  if (!storage) return true;
  try {
    return storage.getItem(WIDGETS_BANNER_STORAGE_KEY) === WIDGETS_BANNER_DISMISSED_VALUE;
  } catch (_) {
    return false;
  }
}

export function dismissWidgetsBanner(
  storage = typeof window !== 'undefined' ? window.localStorage : null
) {
  if (!storage) return false;
  try {
    storage.setItem(WIDGETS_BANNER_STORAGE_KEY, WIDGETS_BANNER_DISMISSED_VALUE);
    return true;
  } catch (_) {
    return false;
  }
}

export function shouldShowWidgetsBanner({
  hasSchedule,
  isSwapModeActive,
  isDismissed,
}) {
  return Boolean(hasSchedule) && !Boolean(isSwapModeActive) && !Boolean(isDismissed);
}

// Preload cache to prevent redundant dynamic import promises
let lessonModalPromise = null;
export const preloadLessonModal = () => {
  if (!lessonModalPromise) lessonModalPromise = import('../components/LessonModal');
  return lessonModalPromise;
};

let editLessonModalPromise = null;
export const preloadEditLessonModal = () => {
  if (!editLessonModalPromise) editLessonModalPromise = import('../components/EditLessonModal');
  return editLessonModalPromise;
};

let swapLessonModalPromise = null;
export const preloadSwapLessonModal = () => {
  if (!swapLessonModalPromise) swapLessonModalPromise = import('../components/SwapLessonModal');
  return swapLessonModalPromise;
};

let customEventModalPromise = null;
export const preloadCustomEventModal = () => {
  if (!customEventModalPromise) customEventModalPromise = import('../components/CustomEventModal');
  return customEventModalPromise;
};

let customEventDetailModalPromise = null;
export const preloadCustomEventDetailModal = () => {
  if (!customEventDetailModalPromise) customEventDetailModalPromise = import('../components/CustomEventDetailModal');
  return customEventDetailModalPromise;
};

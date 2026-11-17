'use client';

import { useSyncExternalStore } from 'react';

export function useMediaQuery(query, serverFallback = false) {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia(query);
      media.addEventListener('change', onStoreChange);
      return () => media.removeEventListener('change', onStoreChange);
    },
    () => {
      if (typeof window === 'undefined' || !window.matchMedia) return serverFallback;
      return window.matchMedia(query).matches;
    },
    () => serverFallback
  );
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 641px)', false);
}

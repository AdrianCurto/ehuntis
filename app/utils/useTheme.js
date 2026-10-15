'use client';

import { useState, useEffect, useCallback } from 'react';

export const THEME_STORAGE_KEY = 'ehuntis_theme';

export function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  if (typeof window === 'undefined') return;
  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark');

  // Apply theme to the app content as usual
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }

  // Use the actual resolved theme color — status bar (default style) matches the app background.
  const statusBarColor = isDark ? '#0B0F17' : '#FFFFFF';
  const statusBarScheme = isDark ? 'dark' : 'light';

  // Update theme-color meta tag safely without breaking iOS Safari
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.id = 'app-theme-color';
    document.head.appendChild(meta);
  }
  meta.content = statusBarColor;

  // Update color-scheme so the OS knows whether status bar icons should be dark or light.
  let schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (!schemeMeta) {
    schemeMeta = document.createElement('meta');
    schemeMeta.name = 'color-scheme';
    document.head.appendChild(schemeMeta);
  }
  schemeMeta.content = statusBarScheme;
}


export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch (_) {}
    return 'system';
  });

  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark' && newTheme !== 'system') return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (_) {}
    applyTheme(newTheme);
  }, []);

  // Listen to system changes + handle iOS wake-up from background/sleep
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const update = () => {
      const currentSys = getSystemTheme();
      setSystemTheme(currentSys);
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
        if (saved === 'system') {
          applyTheme('system');
        }
      } catch (_) {}
    };

    const handler = () => update();

    // Support both modern addEventListener and legacy addListener (older WebKit/Safari)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handler);
    }

    // Critical for iOS Safari & PWAs: when resuming from lock screen, background or BFCache,
    // matchMedia change events DO NOT fire. Re-evaluating on visibilitychange, pageshow and focus fixes this.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        update();
      }
    };

    window.addEventListener('pageshow', update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handler);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handler);
      }
      window.removeEventListener('pageshow', update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Sync on mount
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
  };
}

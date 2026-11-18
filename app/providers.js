'use client';

import { useSyncExternalStore } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { I18nProvider } from 'react-aria-components';
import { Toaster } from 'sonner';

function subscribeToDarkClass(callback) {
  if (typeof document === 'undefined') return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getDarkSnapshot() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function getDarkServerSnapshot() {
  return false;
}

function ThemeAwareToaster() {
  const isDark = useSyncExternalStore(
    subscribeToDarkClass,
    getDarkSnapshot,
    getDarkServerSnapshot
  );

  return (
    <Toaster
      theme={isDark ? 'dark' : 'light'}
      position="bottom-center"
      duration={5000}
      visibleToasts={3}
      swipeDirections={['bottom', 'right', 'left']}
      offset={{
        bottom: 'calc(var(--tab-bar-h, 72px) + 32px + env(safe-area-inset-bottom, 0px))',
      }}
      mobileOffset={{
        bottom: 'calc(var(--tab-bar-h, 72px) + 32px + env(safe-area-inset-bottom, 0px))',
        left: '16px',
        right: '16px',
      }}
      containerAriaLabel="Notificaciones"
      toastOptions={{
        style: {
          fontFamily: 'var(--font-body)',
          borderRadius: 'var(--radius-xl)',
        },
      }}
    />
  );
}

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  const isPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIpad = (navigator.platform === 'MacIntel' || (navigator.userAgent && navigator.userAgent.includes('Macintosh'))) && navigator.maxTouchPoints > 1;
  const isIphone = /iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  let detectedOs = 'Ordenador (PC/Mac)';
  if (isIphone) detectedOs = 'iPhone (iOS)';
  else if (isIpad) detectedOs = 'iPad (iPadOS)';
  else if (isAndroid) detectedOs = 'Android';
  else if (/Macintosh|Mac OS X/.test(navigator.userAgent)) detectedOs = 'Mac (macOS)';
  else if (/Windows/.test(navigator.userAgent)) detectedOs = 'Windows (PC)';

  posthog.init(
    process.env.NEXT_PUBLIC_POSTHOG_KEY,
    {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'always',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
      loaded: (ph) => {
        ph.register({
          is_pwa: isPwa,
          plataforma: isPwa ? '📱 App Móvil (PWA)' : '🌐 Navegador Web',
          dispositivo_real: detectedOs,
        });
      },
    }
  );
}

export function PostHogProvider({ children }) {
  return (
    <PHProvider client={posthog}>
      <I18nProvider locale="es-ES">
        {children}
        <ThemeAwareToaster />
      </I18nProvider>
    </PHProvider>
  );
}

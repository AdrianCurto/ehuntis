'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';

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
  return <PHProvider client={posthog}>{children}</PHProvider>;
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Apple,
  HelpCircle,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SegmentedControl } from '@/app/components/ui/segmented-control';
import { Button } from '@/app/components/ui/button';
import { IOS_WIDGET_LOADER_CODE } from '@/app/utils/iosWidgetLoader';

const USERNAME_STORAGE_KEY = 'ehuntis_username_v1';
const APK_DOWNLOAD_URL = 'https://github.com/AdrianCurto/ehuntis/releases/latest/download/ehuntis-widget.apk';
const GITHUB_RELEASES_URL = 'https://github.com/AdrianCurto/ehuntis/releases/latest';

export default function WidgetsPage() {
  const [platform, setPlatform] = useState(() => {
    if (typeof window === 'undefined') return 'android';
    try {
      const params = new URLSearchParams(window.location.search);
      const osParam = params.get('os')?.toLowerCase();
      if (osParam === 'android' || osParam === 'ios') return osParam;

      const ua = navigator.userAgent || '';
      const isIOS =
        /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return isIOS ? 'ios' : 'android';
    } catch (_) {
      return 'android';
    }
  });

  const [autoDetected, setAutoDetected] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const osParam = params.get('os')?.toLowerCase();
      if (osParam === 'android' || osParam === 'ios') return false;

      const ua = navigator.userAgent || '';
      const isIOS =
        /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/i.test(ua);
      return isIOS || isAndroid;
    } catch (_) {
      return false;
    }
  });

  const [savedUsername] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() || '';
    } catch (_) {
      return '';
    }
  });

  const [copiedId, setCopiedId] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const handleCopyId = async () => {
    if (!savedUsername) return;
    try {
      await navigator.clipboard.writeText(savedUsername);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (_) {}
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(IOS_WIDGET_LOADER_CODE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      {/* ── Contenedor principal ── */}
      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-20">
        {/* ── Botón Volver al horario ── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity p-1.5 -ml-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>Volver al horario</span>
          </Link>
        </div>

        {/* ── Cabecera ── */}
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2 font-display">
            Widgets para tu móvil
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Lleva tu horario, aulas y eventos en la pantalla de inicio de Android o iOS.
          </p>
        </header>

        {/* ── Selector de plataforma (Segmented Control) ── */}
        <div className="mb-6">
          <SegmentedControl
            ariaLabel="Selecciona tu plataforma"
            value={platform}
            onChange={(val) => {
              setPlatform(val);
              setAutoDetected(false);
            }}
            options={[
              {
                value: 'android',
                label: (
                  <span className="inline-flex items-center justify-center gap-2 font-semibold">
                    <Smartphone size={16} />
                    <span>Android</span>
                  </span>
                ),
              },
              {
                value: 'ios',
                label: (
                  <span className="inline-flex items-center justify-center gap-2 font-semibold">
                    <Apple size={16} />
                    <span>iOS</span>
                  </span>
                ),
              },
            ]}
          />
          {autoDetected && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-2">
              Hemos detectado tu dispositivo, pero puedes cambiar de plataforma arriba.
            </p>
          )}
        </div>

        {/* ── Bloque de requisito previo (común a Android e iOS) ── */}
        <section className="mb-8 p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Info size={17} strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
                <strong>Antes de empezar:</strong> el widget sincroniza tu horario desde la nube. Asegúrate de haber iniciado sesión con tu identificador en la pestaña <strong>Info</strong> de EHUntis (no requiere contraseña).
              </p>

              {savedUsername ? (
                <div className="inline-flex items-center gap-2 p-2 px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] max-w-full">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">
                    Tu identificador:
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-[var(--text-primary)] select-all truncate">
                    {savedUsername}
                  </span>
                  <Button
                    size="sm"
                    variant={copiedId ? 'default' : 'secondary'}
                    onClick={handleCopyId}
                    className="ml-1 h-7 px-2.5 text-xs shrink-0"
                  >
                    {copiedId ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copiar</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                  <span>No has iniciado sesión en este navegador. </span>
                  <Link href="/" className="font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 mt-0.5">
                    <span>Configura tu identificador en EHUntis primero</span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── CONTENIDO: Pestaña Android ── */}
        {platform === 'android' && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. Tarjeta de descarga principal */}
            <div className="p-5 sm:p-6 rounded-[var(--radius-xl)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                    EHUntis Widget para Android
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                    Vista diaria y semanal (3×2 a 5×5), sincronización con la nube y tema automático.
                  </p>
                </div>
                <div className="shrink-0">
                  <a
                    href={APK_DOWNLOAD_URL}
                    className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-semibold text-sm shadow-md hover:opacity-95 active:scale-[0.98] transition-all w-full sm:w-auto text-center"
                  >
                    <Download size={18} strokeWidth={2.2} />
                    <span>Descargar EHUntis Widget (.apk)</span>
                  </a>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-[var(--border)] text-right">
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span>Ver versiones y código fuente en GitHub</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* 2. Guía de instalación paso a paso */}
            <section>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-4">
                Guía de instalación
              </h2>

              <ol className="space-y-4">
                {/* Paso 1 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 1 — Descarga e instala el APK
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed mb-3">
                        Abre el archivo descargado (<code>ehuntis-widget.apk</code>). Si es tu primera vez instalando fuera de Google Play, Android te pedirá permitir <em>&quot;Instalar aplicaciones desconocidas&quot;</em> desde tu navegador.
                      </p>
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
                        <strong className="block font-semibold mb-0.5 flex items-center gap-1.5">
                          <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Nota sobre Google Play Protect</span>
                        </strong>
                        <span>
                          Al descargarse directamente desde GitHub y no desde Google Play, puede aparecer un aviso de seguridad. Pulsa <strong>Más detalles → Instalar de todas formas</strong>. Todo el código es público y verificable en GitHub.
                        </span>
                      </div>
                    </div>
                  </div>
                </li>

                {/* Paso 2 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 2 — Pulsa &quot;Listo&quot; (no busques icono de app)
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed mb-2">
                        Al terminar la instalación, pulsa el botón <strong>Listo</strong>.
                      </p>
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200">
                        <span>
                          <strong>EHUntis Widget</strong> no crea ningún icono en tu cajón de aplicaciones ni en el escritorio; funciona exclusivamente como widget para no ocupar espacio innecesario.
                        </span>
                      </div>
                    </div>
                  </div>
                </li>

                {/* Paso 3 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 3 — Añade el widget a tu pantalla de inicio
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                        Mantén pulsado un espacio vacío del escritorio → <strong>Widgets</strong> → busca <strong>EHUntis Widget</strong> → arrástralo donde quieras (puedes redimensionarlo de 3×2 a 5×5).
                      </p>
                    </div>
                  </div>
                </li>

                {/* Paso 4 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      4
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 4 — Configura tu horario
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                        Al soltarlo se abrirá la pantalla de ajustes. Introduce tu identificador de EHUntis, pulsa <strong>Conectar y cargar</strong>, elige tu horario (<em>Seguir horario activo</em> o uno concreto), el modo de vista (<em>Vista diaria</em> o <em>Semana completa</em>) y el tema (<em>Sistema</em>, <em>Claro</em> u <em>Oscuro</em>), y pulsa <strong>Guardar y actualizar widget</strong>.
                      </p>
                    </div>
                  </div>
                </li>
              </ol>
            </section>

            {/* 3. Acordeón de Preguntas Frecuentes (Android) */}
            <section className="pt-2">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <HelpCircle size={18} className="text-[var(--accent)]" />
                <span>Preguntas frecuentes (Android)</span>
              </h2>

              <div className="space-y-3">
                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Por qué no aparece la app en mi menú de aplicaciones?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Está diseñada para existir únicamente como widget. Si quieres abrir la web de EHUntis, solo tienes que tocar cualquier parte del horario en el widget.
                  </p>
                </details>

                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Cómo pongo varios widgets a la vez?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Repite el Paso 3 y añade otro widget de <strong>EHUntis Widget</strong>. Cada widget guarda su propio horario y modo de vista (por ejemplo, uno en vista diaria y otro en semana completa). La cuenta y el tema se comparten entre todos.
                  </p>
                </details>

                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Cómo se actualiza?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Vuelve a esta página, descarga la nueva versión del APK e instálala encima. Tus widgets y configuración se conservan automáticamente.
                  </p>
                </details>

                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Cómo se desinstala?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Quitar el widget del escritorio no desinstala la app. Ve a <strong>Ajustes del teléfono → Aplicaciones → EHUntis Widget → Desinstalar</strong>.
                  </p>
                </details>

                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿El widget no se actualiza automáticamente en mi móvil?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Algunos fabricantes (Xiaomi/MIUI/HyperOS, Huawei, Oppo, Realme) restringen apps en segundo plano. Si notas retrasos, ve a <strong>Ajustes → Aplicaciones → EHUntis Widget → Batería</strong> y selecciona <strong>Sin restricciones</strong> (también puedes tocar el botón de refresco <code>↻</code> en la cabecera del widget en cualquier momento).
                  </p>
                </details>
              </div>
            </section>
          </div>
        )}

        {/* ── CONTENIDO: Pestaña iOS ── */}
        {platform === 'ios' && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. Tarjeta de acción principal */}
            <div className="p-5 sm:p-6 rounded-[var(--radius-xl)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                    EHUntis Widget para iOS (Scriptable)
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                    Copia el código cargador una sola vez. Se mantendrá auto-actualizado en segundo plano.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button
                    size="lg"
                    onClick={handleCopyScript}
                    className="w-full sm:w-auto shadow-md"
                  >
                    {copiedScript ? (
                      <>
                        <Check size={18} className="text-emerald-300" />
                        <span>✓ ¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        <span>Copiar código del widget</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Desplegable colapsado: Ver código que se copia */}
              <div className="mt-4 pt-3.5 border-t border-[var(--border)]">
                <details className="group">
                  <summary className="text-xs font-semibold text-[var(--accent)] cursor-pointer list-none flex items-center gap-1.5 hover:underline">
                    <span>Ver código que se copia</span>
                    <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60 border border-slate-800 select-all">
                    <pre>{IOS_WIDGET_LOADER_CODE}</pre>
                  </div>
                </details>
              </div>
            </div>

            {/* 2. Guía de instalación paso a paso */}
            <section>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-4">
                Guía de instalación
              </h2>

              <ol className="space-y-4">
                {/* Paso 1 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 1 — Instala Scriptable
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed mb-2">
                        Descarga gratis <a href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-0.5">Scriptable <ExternalLink size={11} /></a> desde la App Store.
                      </p>
                    </div>
                  </div>
                </li>

                {/* Paso 2 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 2 — Crea el script una sola vez
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                        Pulsa <strong>Copiar código del widget</strong> arriba → abre <strong>Scriptable</strong> → pulsa <strong><code>+</code></strong> arriba a la derecha → pega el código → toca el título arriba del todo y renómbralo a <strong><code>EHUntis</code></strong> → pulsa <strong>Done</strong>.
                      </p>
                    </div>
                  </div>
                </li>

                {/* Paso 3 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 3 — Añade el widget a tu pantalla de inicio
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                        Mantén pulsado el fondo de pantalla → pulsa <strong><code>+</code></strong> arriba a la izquierda → busca <strong>Scriptable</strong> → elige tamaño <strong>Mediano</strong>, <strong>Grande</strong> (o <strong>Extra Grande</strong> en iPad) → <strong>Añadir widget</strong>.
                      </p>
                    </div>
                  </div>
                </li>

                {/* Paso 4 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      4
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 4 — Vincula el script
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed mb-2">
                        Mantén pulsado el widget recién añadido → <strong>Editar widget</strong>:
                      </p>
                      <ul className="list-disc list-inside text-xs sm:text-sm text-[var(--text-secondary)] space-y-1 pl-1">
                        <li>En <strong>Script</strong>, selecciona <strong><code>EHUntis</code></strong>.</li>
                        <li>Deja <strong>When Interacting</strong> en <strong>Open URL</strong> (así tocar el horario abrirá la web y tocar el icono de engranaje ⚙ abrirá los ajustes).</li>
                      </ul>
                    </div>
                  </div>
                </li>

                {/* Paso 5 */}
                <li className="p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-start gap-3.5">
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                      5
                    </span>
                    <div className="flex-1 text-sm">
                      <h3 className="font-bold text-[var(--text-primary)] mb-1">
                        Paso 5 — Configura tu horario
                      </h3>
                      <p className="text-[var(--text-secondary)] text-xs sm:text-sm leading-relaxed">
                        Toca el widget (o el icono ⚙ arriba a la derecha). Introduce tu identificador de EHUntis, pulsa <strong>Conectar y cargar</strong>, elige horario, vista (<em>Vista diaria</em> / <em>Semana completa</em>) y tema (<em>Sistema</em> / <em>Claro</em> / <em>Oscuro</em>), y pulsa <strong>Guardar y actualizar widget</strong>.
                      </p>
                    </div>
                  </div>
                </li>
              </ol>
            </section>

            {/* 3. Acordeón de Preguntas Frecuentes (iOS) */}
            <section className="pt-2">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <HelpCircle size={18} className="text-[var(--accent)]" />
                <span>Preguntas frecuentes (iOS)</span>
              </h2>

              <div className="space-y-3">
                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Cómo pongo varios widgets a la vez?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed space-y-2">
                    <p>
                      No hace falta duplicar el script. Añade otro widget de Scriptable, selecciona el mismo script <strong><code>EHUntis</code></strong> y rellena el campo <strong>Parameter</strong> dentro de <em>Editar widget</em>:
                    </p>
                    <ul className="list-disc list-inside pl-1 space-y-1">
                      <li><em>Atajo rápido (mismo horario, otra vista o tema):</em> escribe <code>semanal</code>, <code>diario</code>, <code>oscuro</code> o <code>claro</code> (puedes combinarlos, p. ej. <code>semanal oscuro</code>).</li>
                      <li><em>Widget totalmente independiente:</em> escribe cualquier nombre identificador (p. ej. <code>horario2</code>), guarda, y toca su icono ⚙ para elegir un horario o cuenta diferente.</li>
                    </ul>
                  </div>
                </details>

                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Cómo se actualiza?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    No tienes que hacer nada: el script comprueba automáticamente si hay mejoras una vez al día (y cada vez que abres sus ajustes ⚙) sin perder tu configuración.
                  </p>
                </details>

                <details className="group p-4 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)]">
                  <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between text-[var(--text-primary)]">
                    <span>¿Cómo se desinstala?</span>
                    <ChevronDown size={16} className="text-[var(--text-muted)] group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-3 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Elimina el widget de la pantalla de inicio y, dentro de Scriptable, desliza para borrar el script <code>EHUntis</code>.
                  </p>
                </details>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

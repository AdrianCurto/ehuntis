'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SegmentedControl } from '@/app/components/ui/segmented-control';
import { Button } from '@/app/components/ui/button';
import { IOS_WIDGET_LOADER_CODE } from '@/app/utils/iosWidgetLoader';
import { cn } from '@/app/utils/cn';

const USERNAME_STORAGE_KEY = 'ehuntis_username_v1';
const APK_DOWNLOAD_URL = 'https://github.com/AdrianCurto/ehuntis/releases/latest/download/ehuntis-widget.apk';
const GITHUB_RELEASES_URL = 'https://github.com/AdrianCurto/ehuntis/releases/latest';
const SCRIPTABLE_APP_STORE_URL = 'https://apps.apple.com/app/scriptable/id1405459188';
const LOADER_LINE_COUNT = IOS_WIDGET_LOADER_CODE.trim().split('\n').length;

// ── Iconos vectoriales auténticos (cero emojis) ──────────────────────────────
function AndroidIcon({ className, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5847 8.423 13.849 8.16 12 8.16s-3.5847.263-5.1368.7897L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
    </svg>
  );
}

function AppleIcon({ className, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.64-.78 1.08-1.86.96-2.95-1 .04-2.16.66-2.83 1.44-.59.67-1.11 1.77-.97 2.84 1.11.09 2.2-.57 2.84-1.33z" />
    </svg>
  );
}

function JsIcon({ className = '' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-extrabold font-mono rounded-[3px] bg-[#F7DF1E] text-[#000000] text-[9px] leading-none shrink-0 select-none tracking-tighter w-4 h-4 shadow-xs',
        className
      )}
      aria-label="JavaScript"
      title="JavaScript"
    >
      JS
    </span>
  );
}

// ── Componentes de apoyo visual y estructural ────────────────────────────────
function TimelineStep({ stepNumber, title, children, isLast = false }) {
  return (
    <li className="relative pl-9 sm:pl-10 pb-7 last:pb-1 list-none">
      {!isLast && (
        <div
          className="absolute left-[13px] top-8 bottom-0 w-px bg-[var(--border)]"
          aria-hidden="true"
        />
      )}
      <div
        className="absolute left-0 top-0.5 w-7 h-7 rounded-full bg-[var(--surface-elevated)] border-2 border-[var(--accent)] text-[var(--accent)] font-bold text-xs flex items-center justify-center shadow-xs select-none"
        aria-hidden="true"
      >
        {stepNumber}
      </div>
      <div>
        <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mb-1.5">
          {title}
        </h3>
        <div className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed space-y-2.5">
          {children}
        </div>
      </div>
    </li>
  );
}

function KeyTag({ children }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 mx-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded shadow-2xs select-all">
      {children}
    </kbd>
  );
}

function LateralCallout({ variant = 'info', title, children }) {
  const isWarning = variant === 'warning';
  return (
    <div
      className={cn(
        'rounded-r-[var(--radius-md)] rounded-l-xs p-3.5 sm:p-4 border-l-[3.5px] bg-[var(--bg-secondary)] text-xs sm:text-sm leading-relaxed border-t border-r border-b border-[var(--border)]/60 my-2.5',
        isWarning ? 'border-l-amber-500' : 'border-l-[var(--accent)]'
      )}
    >
      <div className="flex items-start gap-2.5">
        {isWarning ? (
          <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <Info size={16} className="text-[var(--accent)] shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <strong className="block font-semibold mb-1 text-[var(--text-primary)]">
              {title}
            </strong>
          )}
          <div className="text-[var(--text-secondary)] leading-relaxed space-y-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ question, children }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] overflow-hidden transition-colors hover:border-[var(--border-light)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full p-3.5 sm:p-4 text-left font-semibold text-xs sm:text-sm flex items-center justify-between text-[var(--text-primary)] cursor-pointer select-none transition-colors hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 touch-target-44"
      >
        <span className="pr-3 leading-snug">{question}</span>
        <ChevronDown
          size={16}
          className={cn(
            'text-[var(--text-muted)] shrink-0 transition-transform duration-200 ease-out',
            isOpen && 'rotate-180 text-[var(--accent)]'
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-1 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)]/60">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers de inicialización en cliente ─────────────────────────────────────
function getInitialPlatform() {
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
}

const emptySubscribe = () => () => {};

function useSavedUsername() {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        return localStorage.getItem(USERNAME_STORAGE_KEY)?.trim() || '';
      } catch (_) {
        return '';
      }
    },
    () => ''
  );
}

// ── Página principal /widgets ────────────────────────────────────────────────
export default function WidgetsPage() {
  const [platform, setPlatform] = useState(getInitialPlatform);
  const savedUsername = useSavedUsername();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

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
      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24">
        {/* ── Barra de navegación superior ── */}
        <header className="mb-6 pt-[env(safe-area-inset-top,0px)]">
          <div className="mb-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5 -ml-1 rounded-[var(--radius-md)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] shadow-xs touch-target-44"
            >
              <ArrowLeft size={15} strokeWidth={2.2} />
              <span>Volver al horario</span>
            </Link>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2 font-display">
            Widgets para tu móvil
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Consulta tus próximas clases, aulas y horarios en la pantalla de inicio de Android o iOS sin necesidad de abrir el navegador.
          </p>
        </header>

        {/* ── Selector de plataforma ── */}
        <div className="mb-6">
          <SegmentedControl
            ariaLabel="Selecciona tu plataforma móvil"
            value={platform}
            onChange={(val) => setPlatform(val)}
            options={[
              {
                value: 'android',
                label: (
                  <span className="inline-flex items-center justify-center gap-2 font-semibold">
                    <AndroidIcon size={16} />
                    <span>Android</span>
                  </span>
                ),
              },
              {
                value: 'ios',
                label: (
                  <span className="inline-flex items-center justify-center gap-2 font-semibold">
                    <AppleIcon size={16} />
                    <span>iOS (Scriptable)</span>
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* ── Tarjeta de requisito previo (Paso 0) ── */}
        <section
          aria-label="Requisito previo de sincronización"
          className="mb-8 p-4 sm:p-5 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Info size={17} strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  Paso previo
                </span>
                <span className="text-[var(--text-muted)] text-xs">·</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Identificador de cuenta
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
                Los widgets obtienen tu horario personalizado directamente desde la nube. Asegúrate de tener o conocer tu identificador de EHUntis para vincularlo.
              </p>

              {savedUsername ? (
                <div className="flex flex-wrap items-center gap-2 p-2.5 px-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">
                    Tu identificador guardado:
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-[var(--text-primary)] select-all truncate">
                    {savedUsername}
                  </span>
                  <Button
                    size="sm"
                    variant={copiedId ? 'default' : 'secondary'}
                    onClick={handleCopyId}
                    className="h-7 px-2.5 text-xs ml-auto shrink-0"
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
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>No hay identificador guardado en este navegador.</span>
                  <Link
                    href="/?tab=info"
                    className="font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Configurar en EHUntis</span>
                    <ChevronRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── PESTAÑA ANDROID ── */}
        {platform === 'android' && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. Tarjeta principal de descarga */}
            <section className="p-5 sm:p-6 rounded-[var(--radius-xl)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AndroidIcon size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] font-display">
                      EHUntis Widget para Android
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                      App nativa con vista diaria y semanal, aulas y sincronización manual y automática.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center gap-1.5">
                  <a
                    href={APK_DOWNLOAD_URL}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--accent)] text-white font-semibold text-sm shadow-sm hover:opacity-95 active:scale-[0.98] transition-all w-full sm:w-auto text-center touch-target-44"
                  >
                    <Download size={16} strokeWidth={2.2} />
                    <span>Descargar APK</span>
                  </a>
                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-0.5"
                  >
                    <span>Releases en GitHub</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </section>

            {/* 2. Guía paso a paso (Timeline vertical) */}
            <section aria-labelledby="android-steps-heading">
              <h2 id="android-steps-heading" className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-5">
                Guía de instalación
              </h2>

              <ol className="p-0 m-0">
                <TimelineStep
                  stepNumber="1"
                  title="Descarga e instala el APK"
                >
                  <p>
                    Abre el archivo descargado (<KeyTag>ehuntis-widget.apk</KeyTag>). Si tu navegador te solicita permisos para <em>Instalar aplicaciones desconocidas</em>, concédeselo para continuar.
                  </p>
                  <LateralCallout variant="warning" title="Aviso sobre Google Play Protect">
                    Al descargarse de forma directa desde GitHub y no mediante Google Play Store, Android puede mostrar una pantalla preventiva. Pulsa en <KeyTag>Más detalles</KeyTag> → <KeyTag>Instalar de todas formas</KeyTag>. Todo el código fuente es público y verificable en el repositorio del proyecto.
                  </LateralCallout>
                </TimelineStep>

                <TimelineStep
                  stepNumber="2"
                  title="Pulsa &quot;Listo&quot; al finalizar"
                >
                  <p>
                    Una vez concluida la instalación, pulsa el botón <KeyTag>Listo</KeyTag>.
                  </p>
                  <LateralCallout variant="info" title="Diseñado exclusivamente como widget">
                    <strong>EHUntis Widget</strong> no crea ningún icono en tu cajón de aplicaciones ni en el escritorio. Funciona 100% como widget de pantalla de inicio para no saturar tu lista de aplicaciones.
                  </LateralCallout>
                </TimelineStep>

                <TimelineStep
                  stepNumber="3"
                  title="Añade el widget a tu pantalla de inicio"
                >
                  <p>
                    Mantén pulsado un área libre de tu pantalla de inicio → pulsa <KeyTag>Widgets</KeyTag> → busca <KeyTag>EHUntis Widget</KeyTag> y arrástralo donde prefieras.
                  </p>
                  <p className="text-[var(--text-muted)] text-[11px]">
                    Tip: Puedes redimensionarlo desde 3×2 (tarjeta compacta) hasta 5×5 (vista semanal espaciosa).
                  </p>
                </TimelineStep>

                <TimelineStep
                  stepNumber="4"
                  title="Configura tu horario"
                  isLast={true}
                >
                  <p>
                    Al colocar el widget se abrirá la pantalla de ajustes (o toca el icono de engranaje arriba a la derecha). Introduce tu identificador de EHUntis, pulsa <KeyTag>Conectar y cargar</KeyTag>, elige tu horario, vista (<KeyTag>Vista diaria</KeyTag> o <KeyTag>Semana completa</KeyTag>) y tema, y guarda los cambios.
                  </p>
                </TimelineStep>
              </ol>
            </section>

            {/* 3. Preguntas frecuentes (Android) */}
            <section aria-labelledby="android-faq-heading" className="pt-2">
              <h2 id="android-faq-heading" className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <HelpCircle size={18} className="text-[var(--accent)]" />
                <span>Preguntas frecuentes (Android)</span>
              </h2>

              <div className="space-y-2.5">
                <FaqItem question="¿Por qué no aparece un icono en mi menú de aplicaciones?">
                  Está concebida para operar exclusivamente como widget en la pantalla de inicio. Si deseas abrir la web de EHUntis para editar clases o ver detalles, solo toca cualquier zona del horario en el widget.
                </FaqItem>

                <FaqItem question="¿Cómo puedo añadir varios widgets a la vez?">
                  Repite el Paso 3 y añade otro widget desde el menú. Cada widget almacena su propia configuración independiente (por ejemplo, uno en vista diaria para hoy y otro en vista semanal para toda la semana).
                </FaqItem>

                <FaqItem question="¿Cómo se actualiza la aplicación cuando sale una nueva versión?">
                  Vuelve a esta página, descarga la nueva versión del archivo APK e instálala encima sin desinstalar la anterior. Todos tus widgets y ajustes se mantendrán intactos.
                </FaqItem>

                <FaqItem question="¿Cómo se desinstala el widget por completo?">
                  Quitar el widget del escritorio solo retira la vista. Para desinstalar la app por completo, ve a <KeyTag>Ajustes del teléfono</KeyTag> → <KeyTag>Aplicaciones</KeyTag> → <KeyTag>EHUntis Widget</KeyTag> → <KeyTag>Desinstalar</KeyTag>.
                </FaqItem>

                <FaqItem question="¿Qué hacer si el widget no se actualiza automáticamente en segundo plano?">
                  Algunos fabricantes aplican restricciones estrictas en segundo plano para ahorrar batería. Si notas que no refresca, ve a <KeyTag>Ajustes → Aplicaciones → EHUntis Widget → Batería</KeyTag> y selecciona <KeyTag>Sin restricciones</KeyTag>. También puedes pulsar en cualquier momento el icono de refresco en la cabecera del widget.
                </FaqItem>
              </div>
            </section>
          </div>
        )}

        {/* ── PESTAÑA IOS ── */}
        {platform === 'ios' && (
          <div className="space-y-8 animate-fade-in">
            {/* 1. Tarjeta principal de acción */}
            <section className="p-5 sm:p-6 rounded-[var(--radius-xl)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AppleIcon size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] font-display">
                      EHUntis Widget para iOS
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                      Cargador para Scriptable. Se actualiza automáticamente sin volver a copiar código.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 sm:self-center">
                  <Button
                    size="md"
                    onClick={handleCopyScript}
                    className="w-full sm:w-[150px] shrink-0 shadow-sm touch-target-44"
                  >
                    {copiedScript ? (
                      <>
                        <Check size={16} className="text-emerald-300 shrink-0" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} className="shrink-0" />
                        <span>Copiar código</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Visor colapsable estilo editor de código */}
              <div className="mt-4 pt-3.5 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setCodeOpen(!codeOpen)}
                  aria-expanded={codeOpen}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:opacity-85 transition-opacity cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm"
                >
                  <span>{codeOpen ? 'Ocultar código' : 'Ver código'}</span>
                  <ChevronDown
                    size={14}
                    className={cn('transition-transform duration-200', codeOpen && 'rotate-180')}
                  />
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-200 ease-in-out',
                    codeOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="rounded-[var(--radius-lg)] bg-slate-950 text-slate-200 border border-slate-800 shadow-md overflow-hidden">
                      <div className="flex items-center px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <JsIcon />
                          <span className="font-mono text-slate-300 font-medium">iosWidgetLoader.js</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-[11px] text-slate-400">{LOADER_LINE_COUNT} líneas</span>
                        </div>
                      </div>
                      <div className="code-scroll-container p-3.5 font-mono text-[11px] leading-relaxed max-h-64 select-all text-slate-300">
                        <pre>{IOS_WIDGET_LOADER_CODE}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Guía paso a paso (Timeline vertical) */}
            <section aria-labelledby="ios-steps-heading">
              <h2 id="ios-steps-heading" className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-5">
                Guía de instalación
              </h2>

              <ol className="p-0 m-0">
                <TimelineStep
                  stepNumber="1"
                  title="Instala Scriptable"
                >
                  <p>
                    Instala gratis la app oficial de{' '}
                    <a
                      href={SCRIPTABLE_APP_STORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
                    >
                      Scriptable en la App Store
                      <ExternalLink size={11} />
                    </a>
                    . Es la plataforma que permite ejecutar widgets de JavaScript nativos en iOS sin certificados externos.
                  </p>
                </TimelineStep>

                <TimelineStep
                  stepNumber="2"
                  title="Crea el script una única vez"
                >
                  <p>
                    Pulsa en <KeyTag>Copiar código</KeyTag> arriba. Luego abre <strong>Scriptable</strong>:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    <li>Toca el botón <KeyTag>+</KeyTag> arriba a la derecha para crear un nuevo script.</li>
                    <li>Pega el código copiado en el editor.</li>
                    <li>Toca el título del script arriba del todo y renómbralo exactamente a <KeyTag>EHUntis</KeyTag>.</li>
                    <li>Pulsa <KeyTag>Done</KeyTag> para guardar.</li>
                  </ol>
                </TimelineStep>

                <TimelineStep
                  stepNumber="3"
                  title="Añade el widget a tu pantalla de inicio"
                >
                  <p>
                    Mantén pulsado cualquier espacio vacío del fondo de pantalla hasta que los iconos vibren → pulsa <KeyTag>+</KeyTag> arriba a la izquierda → busca <KeyTag>Scriptable</KeyTag> y elige tamaño <strong>Mediano</strong>, <strong>Grande</strong> (o <strong>Extra Grande</strong> en iPad) → pulsa <KeyTag>Añadir widget</KeyTag>.
                  </p>
                </TimelineStep>

                <TimelineStep
                  stepNumber="4"
                  title="Vincula el script en el widget"
                >
                  <p>
                    Mantén pulsado el widget recién añadido y selecciona <KeyTag>Editar widget</KeyTag>:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>En el campo <strong>Script</strong>, selecciona <KeyTag>EHUntis</KeyTag>.</li>
                    <li>En <strong>When Interacting</strong>, déjalo en <KeyTag>Open URL</KeyTag> (permite tocar las clases para abrir la web y el engranaje para configurar).</li>
                  </ul>
                </TimelineStep>

                <TimelineStep
                  stepNumber="5"
                  title="Configura tu horario"
                  isLast={true}
                >
                  <p>
                    Toca el widget recién colocado (o el icono de engranaje arriba a la derecha). Introduce tu identificador de EHUntis, pulsa <KeyTag>Conectar y cargar</KeyTag>, elige tu horario, vista (<KeyTag>Vista diaria</KeyTag> o <KeyTag>Semana completa</KeyTag>) y tema, y guarda los cambios.
                  </p>
                </TimelineStep>
              </ol>
            </section>

            {/* 3. Preguntas frecuentes (iOS) */}
            <section aria-labelledby="ios-faq-heading" className="pt-2">
              <h2 id="ios-faq-heading" className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <HelpCircle size={18} className="text-[var(--accent)]" />
                <span>Preguntas frecuentes (iOS)</span>
              </h2>

              <div className="space-y-2.5">
                <FaqItem question="¿Cómo puedo tener múltiples widgets a la vez en iOS?">
                  <div className="space-y-2">
                    <p>
                      No necesitas duplicar el script en Scriptable. Añade otro widget de Scriptable, selecciona el mismo script <KeyTag>EHUntis</KeyTag> y completa el campo <strong>Parameter</strong> dentro de <em>Editar widget</em>:
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      <li>
                        <strong>Parámetros rápidos (mismo usuario):</strong> escribe <KeyTag>semanal</KeyTag>, <KeyTag>diario</KeyTag>, <KeyTag>oscuro</KeyTag> o <KeyTag>claro</KeyTag> (por ejemplo: <KeyTag>semanal oscuro</KeyTag>).
                      </li>
                      <li>
                        <strong>Widget totalmente independiente:</strong> escribe cualquier identificador propio (por ejemplo <KeyTag>horario2</KeyTag>), guarda y toca el engranaje del widget para asociarlo a otro horario o cuenta.
                      </li>
                    </ul>
                  </div>
                </FaqItem>

                <FaqItem question="¿Cómo se actualiza en iOS?">
                  Es automático: el script comprueba y descarga las nuevas versiones en segundo plano sin que tengas que volver a copiar código ni rehacer tu configuración.
                </FaqItem>

                <FaqItem question="¿Cómo se desinstala el widget en iOS?">
                  Elimina el widget de tu pantalla de inicio como cualquier otro widget y borra el script <KeyTag>EHUntis</KeyTag> dentro de Scriptable. Si no utilizas Scriptable para nada más, también puedes desinstalar la app directamente.
                </FaqItem>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

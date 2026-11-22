'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalBody,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { SegmentedControl } from './ui/segmented-control';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import {
  Bug,
  Lightbulb,
  HelpCircle,
  Send,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

const COOLDOWN_KEY = 'ehuntis_feedback_cooldown_until';
const COOLDOWN_DURATION_MS = 30 * 1000; // 30 segundos

const TYPE_OPTIONS = [
  {
    value: 'bug',
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Bug size={14} className="shrink-0" />
        <span>Fallo</span>
      </span>
    ),
  },
  {
    value: 'suggestion',
    label: (
      <span className="inline-flex items-center gap-1.5">
        <Lightbulb size={14} className="shrink-0" />
        <span>Sugerencia</span>
      </span>
    ),
  },
  {
    value: 'question',
    label: (
      <span className="inline-flex items-center gap-1.5">
        <HelpCircle size={14} className="shrink-0" />
        <span>Pregunta</span>
      </span>
    ),
  },
];

const PLACEHOLDERS = {
  bug: '¿Qué ha fallado y qué estabas haciendo? (p. ej. una clase que no aparece o un problema con el widget)',
  suggestion: '¿Qué añadirías o mejorarías en EHUntis?',
  question: 'Escribe tu duda sobre la app o los widgets...',
};

function getStoredCooldownRemaining() {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = sessionStorage.getItem(COOLDOWN_KEY);
    if (stored) {
      const until = parseInt(stored, 10);
      return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    }
  } catch (_) {}
  return 0;
}

export default function FeedbackModal({
  open,
  onOpenChange,
  initialSource = 'info_tab',
  initialOs = null,
  context = {},
}) {
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(getStoredCooldownRemaining);

  // Ajustar estado si cambia open según las reglas de React
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setError(null);
      const remaining = getStoredCooldownRemaining();
      if (remaining !== cooldownRemaining) {
        setCooldownRemaining(remaining);
      }
    }
  }

  const mountedAtRef = useRef(0);
  const cooldownTimerRef = useRef(null);

  // Inicializar tiempo de apertura para control de spam cuando open es true
  useEffect(() => {
    if (open) {
      mountedAtRef.current = Date.now();
    }
  }, [open]);

  // Temporizador regresivo para el cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(cooldownTimerRef.current);
  }, [cooldownRemaining]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (isSubmitting || cooldownRemaining > 0) return;

      const trimmedMessage = message.trim();
      if (trimmedMessage.length < 10) {
        setError('El mensaje debe tener al menos 10 caracteres.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const elapsedMs = Date.now() - mountedAtRef.current;

      const payload = {
        type,
        message: trimmedMessage,
        contact: contact.trim() || null,
        website: website.trim(),
        elapsedMs,
        metadata: {
          source: initialSource || 'info_tab',
          os: initialOs || null,
          app_version: '0.1.0',
          username: context?.username || null,
          active_groups: Array.isArray(context?.activeGroups) ? context.activeGroups : [],
          view_mode: context?.viewMode || null,
          theme: context?.theme || null,
          viewport:
            typeof window !== 'undefined'
              ? `${window.innerWidth}x${window.innerHeight}`
              : null,
          is_pwa:
            typeof window !== 'undefined'
              ? window.matchMedia('(display-mode: standalone)').matches
              : false,
        },
      };

      try {
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(
            data.error || 'Ha ocurrido un error al enviar tu comentario. Inténtalo de nuevo.'
          );
          setIsSubmitting(false);
          return;
        }

        // Éxito: activar cooldown local de 30 segundos
        try {
          const cooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
          sessionStorage.setItem(COOLDOWN_KEY, String(cooldownUntil));
          setCooldownRemaining(30);
        } catch (_) {}

        // Telemetría segura en PostHog sin incluir texto ni contacto
        try {
          posthog?.capture('feedback_submitted', {
            type,
            source: initialSource || 'info_tab',
            os: initialOs || null,
          });
        } catch (_) {}

        // Limpiar formulario y cerrar
        setMessage('');
        setContact('');
        setWebsite('');
        setIsSubmitting(false);
        onOpenChange(false);
        toast.success('¡Gracias! Hemos recibido tu mensaje.');
      } catch (err) {
        console.error('Error de red al enviar feedback:', err);
        setError('Error de conexión. Comprueba tu conexión a internet.');
        setIsSubmitting(false);
      }
    },
    [
      isSubmitting,
      cooldownRemaining,
      message,
      contact,
      website,
      type,
      initialSource,
      initialOs,
      context,
      onOpenChange,
    ]
  );

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="max-w-[460px] p-0 overflow-hidden flex flex-col">
        {/* Cabecera fija */}
        <ResponsiveModalHeader className="px-5 sm:px-6 pt-5 pb-3">
          <ResponsiveModalTitle className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
            Enviar comentarios
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <ResponsiveModalBody className="px-5 sm:px-6 py-2 space-y-4 flex-1 overflow-y-auto">
            {/* 1. Selector de tipo de mensaje */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[var(--text-primary)] block">
                Tipo de comentario
              </label>
              <SegmentedControl
                options={TYPE_OPTIONS}
                value={type}
                onChange={setType}
                ariaLabel="Tipo de mensaje de feedback"
              />
            </div>

            {/* 2. Campo mensaje / descripción */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="feedback-message"
                  className="text-[13px] font-medium text-[var(--text-primary)]"
                >
                  Mensaje <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                  {message.length} / 2000
                </span>
              </div>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={PLACEHOLDERS[type]}
                rows={4}
                maxLength={2000}
                required
                className="resize-none"
              />
            </div>

            {/* 3. Contacto opcional */}
            <div className="space-y-1.5">
              <label
                htmlFor="feedback-contact"
                className="text-[13px] font-medium text-[var(--text-primary)] block"
              >
                Contacto <span className="text-xs text-[var(--text-secondary)] font-normal">(opcional)</span>
              </label>
              <Input
                id="feedback-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email, Telegram o Instagram (solo si quieres respuesta)"
                maxLength={200}
                autoComplete="off"
              />
              {type === 'question' && !contact.trim() && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Deja un contacto si necesitas que te respondamos.
                </p>
              )}
            </div>

            {/* 4. Campo Honeypot invisible para bots */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="absolute left-[-9999px] opacity-0 pointer-events-none"
              aria-hidden="true"
            />

            {/* 5. Nota informativa discreta sobre metadatos */}
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed pt-1">
              Se enviará información técnica básica (navegador, grupo activo e identificador si tienes sesión) para facilitar la revisión.
            </p>

            {/* 6. Banner de error si existe */}
            {error && (
              <div
                role="alert"
                className="p-3 rounded-[var(--radius-md)] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </ResponsiveModalBody>

          {/* Pie de acciones */}
          <ResponsiveModalFooter className="flex flex-col gap-2.5 px-5 sm:px-6 py-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-[var(--border-light)] bg-[var(--surface-elevated)] shrink-0 z-10 mt-auto">
            <Button
              type="submit"
              variant="default"
              size="md"
              disabled={isSubmitting || message.trim().length < 10 || cooldownRemaining > 0}
              className="w-full justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin shrink-0" />
                  <span>Enviando…</span>
                </>
              ) : cooldownRemaining > 0 ? (
                <span>Espera {cooldownRemaining}s para volver a enviar</span>
              ) : (
                <>
                  <Send size={15} className="shrink-0" />
                  <span>Enviar comentario</span>
                </>
              )}
            </Button>

            <a
              href="https://github.com/AdrianCurto/ehuntis/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1 touch-target-44 sm:touch-auto"
            >
              <span>¿Prefieres abrir un issue técnico? Ver en GitHub</span>
              <ExternalLink size={12} className="shrink-0" />
            </a>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

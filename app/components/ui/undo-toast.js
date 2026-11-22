'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Undo2, X, CheckCircle2 } from 'lucide-react';

export const DEFAULT_UNDO_TOAST_DURATION = 5000;

function announceToast(message, hasUndo) {
  if (typeof document === 'undefined' || typeof document.ariaNotify !== 'function') {
    return;
  }
  try {
    const text = hasUndo ? `${message}. Acciones disponibles.` : String(message);
    document.ariaNotify(text, { priority: 'normal' });
  } catch (_) {}
}

export function UndoToastCard({ toastId, message, onUndo, duration = DEFAULT_UNDO_TOAST_DURATION }) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const undoneRef = useRef(false);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedAtRef.current > 0) {
        const elapsed = performance.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        startedAtRef.current = 0;
      }
      return;
    }

    if (remainingRef.current <= 0) {
      toast.dismiss(toastId);
      return;
    }

    startedAtRef.current = performance.now();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      remainingRef.current = 0;
      toast.dismiss(toastId);
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedAtRef.current > 0) {
        const elapsed = performance.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        startedAtRef.current = 0;
      }
    };
  }, [isPaused, toastId]);

  const handleUndo = () => {
    if (undoneRef.current) return;
    undoneRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      onUndo?.();
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleDismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    toast.dismiss(toastId);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      onTouchCancel={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false);
        }
      }}
      className="w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] dark:border-white/12 bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_12px_32px_rgba(15,23,42,0.18)] dark:shadow-[0_16px_44px_rgba(0,0,0,0.65)] select-none"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Indicador visual sutil en movil para deslizar y descartar */}
      <div className="flex sm:hidden items-center justify-center pt-1.5 pb-0.5" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-[var(--text-muted)]/35" />
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5 sm:py-3">
        <p
          className="flex-1 min-w-0 text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-[var(--text-primary)] break-words"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {message}
        </p>

        {typeof onUndo === 'function' && (
          <button
            type="button"
            onClick={handleUndo}
            style={{ fontFamily: 'var(--font-display)' }}
            className="touch-target-44 inline-flex items-center gap-1.5 shrink-0 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-semibold tracking-[-0.01em] bg-[var(--accent-light)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white active:scale-[0.97] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            <Undo2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Deshacer</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar notificación"
          className="sr-only focus:not-sr-only sm:not-sr-only sm:inline-flex items-center justify-center shrink-0 h-7 w-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Barra inferior de cuenta atras sincronizada con la pausa */}
      <div className="h-[3px] w-full bg-[var(--accent)]/15 overflow-hidden" aria-hidden="true">
        <div
          className="h-full w-full origin-left bg-[var(--accent)] undo-toast-progress"
          style={{
            animationDuration: `${duration}ms`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Muestra un toast estilizado con boton de Deshacer y barra de tiempo sincronizada.
 *
 * @param {Object} options
 * @param {string} options.message Mensaje principal visible en el toast
 * @param {Function} [options.onUndo] Callback para revertir la accion
 * @param {number} [options.duration] Duracion en milisegundos (por defecto 5000)
 * @param {string|number} [options.id] Identificador opcional para reemplazar un toast existente
 */
export function showUndoToast({ message, onUndo, duration = DEFAULT_UNDO_TOAST_DURATION, id } = {}) {
  if (!message) return null;
  announceToast(message, typeof onUndo === 'function');
  return toast.custom(
    (toastId) => (
      <UndoToastCard
        toastId={toastId}
        message={message}
        onUndo={onUndo}
        duration={duration}
      />
    ),
    {
      id,
      duration: Infinity,
      dismissible: true,
    }
  );
}

export function SuccessToastCard({
  toastId,
  title = 'Mensaje enviado',
  message = 'Gracias por ayudarnos a mejorar EHUntis.',
  duration = 4000,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedAtRef.current > 0) {
        const elapsed = performance.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        startedAtRef.current = 0;
      }
      return;
    }

    if (remainingRef.current <= 0) {
      toast.dismiss(toastId);
      return;
    }

    startedAtRef.current = performance.now();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      remainingRef.current = 0;
      toast.dismiss(toastId);
    }, remainingRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedAtRef.current > 0) {
        const elapsed = performance.now() - startedAtRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
        startedAtRef.current = 0;
      }
    };
  }, [isPaused, toastId]);

  const handleDismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    toast.dismiss(toastId);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      onTouchCancel={() => setIsPaused(false)}
      className="w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] dark:border-white/12 bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-[0_12px_32px_rgba(15,23,42,0.18)] dark:shadow-[0_16px_44px_rgba(0,0,0,0.65)] select-none"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {/* Indicador visual en movil para deslizar y descartar */}
      <div className="flex sm:hidden items-center justify-center pt-1.5 pb-0.5" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-[var(--text-muted)]/35" />
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5 sm:py-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-[13.5px] font-bold leading-tight tracking-[-0.01em] text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </p>
          {message && (
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-snug">
              {message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar notificacion"
          className="inline-flex items-center justify-center shrink-0 h-7 w-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Barra inferior de cuenta atras sincronizada con la pausa */}
      <div className="h-[3px] w-full bg-emerald-500/15 overflow-hidden" aria-hidden="true">
        <div
          className="h-full w-full origin-left bg-emerald-500 undo-toast-progress"
          style={{
            animationDuration: `${duration}ms`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Muestra un toast de exito estructurado y coherente con el diseno de EHUntis.
 */
export function showSuccessToast({
  title = 'Mensaje enviado',
  message = 'Gracias por ayudarnos a mejorar EHUntis.',
  duration = 4000,
  id,
} = {}) {
  announceToast(`${title}. ${message}`, false);
  return toast.custom(
    (toastId) => (
      <SuccessToastCard
        toastId={toastId}
        title={title}
        message={message}
        duration={duration}
      />
    ),
    {
      id,
      duration: Infinity,
      dismissible: true,
    }
  );
}


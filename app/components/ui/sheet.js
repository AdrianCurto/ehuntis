'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/app/utils/cn';
import {
  SHEET_DRAG_DEADZONE_PX,
  shouldDismissSheet,
  getSheetExitDurationMs,
} from '@/app/utils/sheetGestures';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/55 will-change-[opacity] cursor-pointer select-none touch-manipulation',
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

export const SheetContent = React.forwardRef(
  ({ className, children, showCloseButton = true, showHandle = true, onOpenAutoFocus, onBeforeDismiss, style, ...props }, ref) => {
    const contentRef = React.useRef(null);
    const overlayRef = React.useRef(null);
    const onBeforeDismissRef = React.useRef(onBeforeDismiss);
    const [mountSeq, setMountSeq] = React.useState(0);
    const settleTimerRef = React.useRef(null);

    React.useEffect(() => {
      onBeforeDismissRef.current = onBeforeDismiss;
    }, [onBeforeDismiss]);
    const dragRef = React.useRef({
      active: false,
      dragging: false,
      fromHandle: false,
      scrollableEl: null,
      startX: 0,
      startY: 0,
      currentY: 0,
      lastY: 0,
      lastTime: 0,
      velocityY: 0,
      closing: false,
    });

    const clearInlineTransitions = React.useCallback(() => {
      if (contentRef.current) {
        contentRef.current.style.transition = '';
      }
      if (overlayRef.current) {
        overlayRef.current.style.transition = '';
      }
    }, []);

    const mergedRef = React.useCallback(
      (node) => {
        const changed = contentRef.current !== node;
        contentRef.current = node;
        if (changed) {
          setMountSeq((n) => n + 1);
        }
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    const handleOverlayRef = React.useCallback((node) => {
      overlayRef.current = node;
    }, []);

    // Entrada sincronizada tras commit + layout + pintura (doble rAF) vinculada al nodo real del portal.
    // Por defecto el Sheet es visible (translate3d(0,0,0)); solo se oculta justo antes del primer paint en useLayoutEffect.
    React.useLayoutEffect(() => {
      const contentEl = contentRef.current;
      if (!contentEl) return;
      const overlayEl = overlayRef.current;

      // Resetear estado de arrastre en cada apertura (importante para Sheets reutilizados como DatePicker/TimePicker)
      const drag = dragRef.current;
      drag.active = false;
      drag.dragging = false;
      drag.fromHandle = false;
      drag.scrollableEl = null;
      drag.currentY = 0;
      drag.closing = false;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        contentEl.style.transition = '';
        contentEl.style.transform = '';
        if (overlayEl) {
          overlayEl.style.transition = '';
          overlayEl.style.opacity = '';
        }
        return;
      }

      contentEl.style.transition = 'none';
      contentEl.style.transform = 'translate3d(0, 100%, 0)';
      if (overlayEl) {
        overlayEl.style.transition = 'none';
        overlayEl.style.opacity = '0';
      }

      let raf1 = 0;
      let raf2 = 0;
      let enterTimer = null;

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (dragRef.current.dragging || dragRef.current.closing) return;
          contentEl.style.transition = 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)';
          contentEl.style.transform = 'translate3d(0, 0, 0)';
          if (overlayEl) {
            overlayEl.style.transition = 'opacity 200ms ease-out';
            overlayEl.style.opacity = '1';
          }
          enterTimer = setTimeout(() => {
            enterTimer = null;
            if (!dragRef.current.dragging && !dragRef.current.closing) {
              contentEl.style.transition = '';
              contentEl.style.transform = '';
              if (overlayEl) {
                overlayEl.style.transition = '';
                overlayEl.style.opacity = '';
              }
            }
          }, 270);
        });
      });

      return () => {
        if (raf1) cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        if (enterTimer) clearTimeout(enterTimer);
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
          settleTimerRef.current = null;
        }
      };
    }, [mountSeq]);

    const triggerClose = React.useCallback(() => {
      const closeBtn = contentRef.current?.querySelector('[data-sheet-close]');
      if (closeBtn) {
        closeBtn.click();
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    }, []);

    // Listeners tactiles nativos ({ passive: false } en touchmove) para exclusion mutua estricta
    // entre arrastre del Sheet y scroll interno: si arranca uno, el otro queda bloqueado hasta soltar el dedo.
    React.useEffect(() => {
      const contentEl = contentRef.current;
      if (!contentEl) return;

      const isInsideScrollableOrNoDrag = (target) => {
        if (!target || !contentEl) return false;
        if (target.closest?.('[data-sheet-no-drag]')) return true;
        let node = target;
        while (node && node !== contentEl) {
          if (node instanceof HTMLElement) {
            const { overflowY } = window.getComputedStyle(node);
            const canScrollY =
              (overflowY === 'auto' || overflowY === 'scroll') &&
              node.scrollHeight > node.clientHeight + 1;
            if (canScrollY && node.scrollTop > 0) {
              return true;
            }
          }
          node = node.parentElement;
        }
        return false;
      };

      const onTouchStart = (e) => {
        e.stopPropagation();
        const drag = dragRef.current;
        if (drag.closing || e.touches.length !== 1) return;

        const fromHandle = Boolean(e.target?.closest?.('[data-sheet-handle]'));
        if (!fromHandle && isInsideScrollableOrNoDrag(e.target)) {
          drag.active = false;
          drag.dragging = false;
          drag.scrollableEl = null;
          return;
        }

        const scrollable = contentEl.querySelector('[data-sheet-scroll]') || contentEl;
        const scrollTop = scrollable ? scrollable.scrollTop : 0;

        if (fromHandle || scrollTop <= 0) {
          if (settleTimerRef.current) {
            clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
          }
          const touch = e.touches[0];
          drag.active = true;
          drag.dragging = false;
          drag.fromHandle = fromHandle;
          drag.scrollableEl = scrollable;
          drag.startX = touch.clientX;
          drag.startY = touch.clientY;
          drag.currentY = 0;
          drag.lastY = touch.clientY;
          drag.lastTime = performance.now();
          drag.velocityY = 0;
        } else {
          drag.active = false;
          drag.dragging = false;
          drag.scrollableEl = null;
        }
      };

      const onTouchMove = (e) => {
        e.stopPropagation();
        const drag = dragRef.current;
        if (!drag.active || drag.closing || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const deltaY = touch.clientY - drag.startY;
        const deltaX = touch.clientX - drag.startX;

        if (!drag.dragging) {
          // Si el usuario empieza a deslizar hacia arriba, cedemos el gesto completo al scroll interno
          if (deltaY < -4 && !drag.fromHandle) {
            drag.active = false;
            drag.scrollableEl = null;
            return;
          }
          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SHEET_DRAG_DEADZONE_PX) {
            drag.active = false;
            drag.scrollableEl = null;
            return;
          }
          // Desde scrollTop === 0, si el dedo baja, cancelar el scroll nativo antes del touch slop (~8px) de Chrome Android
          if (deltaY > 2 && Math.abs(deltaY) >= Math.abs(deltaX) && e.cancelable) {
            e.preventDefault();
          }
          if (deltaY <= SHEET_DRAG_DEADZONE_PX) {
            return;
          }
          drag.dragging = true;
        }

        // Bloquear scroll nativo del contenedor interno durante todo el resto del gesto de arrastre
        if (e.cancelable) {
          e.preventDefault();
        }
        if (drag.scrollableEl && drag.scrollableEl.scrollTop !== 0) {
          drag.scrollableEl.scrollTop = 0;
        }

        const offsetY = Math.max(0, deltaY - SHEET_DRAG_DEADZONE_PX);
        const now = performance.now();
        const dt = now - drag.lastTime;
        if (dt > 0) {
          const instantVelocity = (touch.clientY - drag.lastY) / dt;
          drag.velocityY = drag.velocityY * 0.4 + instantVelocity * 0.6;
        }
        drag.currentY = offsetY;
        drag.lastY = touch.clientY;
        drag.lastTime = now;

        contentEl.style.transition = 'none';
        contentEl.style.transform = `translate3d(0, ${offsetY}px, 0)`;

        const overlayEl = overlayRef.current;
        if (overlayEl) {
          const sheetHeight = contentEl.offsetHeight || window.innerHeight * 0.6;
          const progress = Math.min(1, offsetY / Math.max(1, sheetHeight));
          overlayEl.style.transition = 'none';
          overlayEl.style.opacity = String(Math.max(0, 1 - progress * 0.9));
        }
      };

      const onTouchEnd = (e) => {
        e.stopPropagation();
        const drag = dragRef.current;
        if (!drag.active || drag.closing) return;

        const wasDragging = drag.dragging;
        const offsetY = drag.currentY;
        const velocityY = drag.velocityY;

        drag.active = false;
        drag.dragging = false;
        drag.fromHandle = false;
        drag.scrollableEl = null;
        drag.currentY = 0;

        if (!wasDragging) return;

        const overlayEl = overlayRef.current;
        const sheetHeight = contentEl.offsetHeight || 400;

        const shouldDismiss =
          shouldDismissSheet(offsetY, sheetHeight, velocityY) &&
          onBeforeDismissRef.current?.() !== false;

        if (shouldDismiss) {
          drag.closing = true;
          const durationMs = getSheetExitDurationMs(offsetY, sheetHeight, velocityY);
          contentEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.32, 0.72, 0, 1)`;
          contentEl.style.transform = `translate3d(0, ${sheetHeight + 64}px, 0)`;
          if (overlayEl) {
            overlayEl.style.transition = `opacity ${durationMs}ms ease-out`;
            overlayEl.style.opacity = '0';
          }
          settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            triggerClose();
          }, durationMs);
        } else {
          contentEl.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
          contentEl.style.transform = 'translate3d(0, 0, 0)';
          if (overlayEl) {
            overlayEl.style.transition = 'opacity 220ms ease-out';
            overlayEl.style.opacity = '1';
          }
          settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            clearInlineTransitions();
            contentEl.style.transform = '';
            if (overlayEl) {
              overlayEl.style.opacity = '';
            }
          }, 270);
        }
      };

      contentEl.addEventListener('touchstart', onTouchStart, { passive: true });
      contentEl.addEventListener('touchmove', onTouchMove, { passive: false });
      contentEl.addEventListener('touchend', onTouchEnd, { passive: true });
      contentEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

      return () => {
        contentEl.removeEventListener('touchstart', onTouchStart);
        contentEl.removeEventListener('touchmove', onTouchMove);
        contentEl.removeEventListener('touchend', onTouchEnd);
        contentEl.removeEventListener('touchcancel', onTouchEnd);
      };
    }, [mountSeq, clearInlineTransitions, triggerClose]);

    const lastOverlayDismissTimeRef = React.useRef(0);
    const overlayTouchStartRef = React.useRef({ x: 0, y: 0, time: 0 });

    const handleOverlayDismiss = React.useCallback(
      (e) => {
        if (dragRef.current.dragging || dragRef.current.closing) return;

        const now = performance.now();
        if (now - lastOverlayDismissTimeRef.current < 400) return;
        lastOverlayDismissTimeRef.current = now;

        if (onBeforeDismissRef.current?.() === false) {
          e?.preventDefault?.();
          return;
        }

        // En iOS Safari, desenfocar el elemento activo inmediatamente para que el teclado virtual
        // no bloquee la salida ni retenga el foco.
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        triggerClose();
      },
      [triggerClose]
    );

    const handleOverlayTouchStart = React.useCallback((e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        overlayTouchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: performance.now(),
        };
      }
    }, []);

    const handleOverlayTouchEnd = React.useCallback(
      (e) => {
        if (dragRef.current.dragging || dragRef.current.closing) return;

        const start = overlayTouchStartRef.current;
        const touch = e.changedTouches?.[0];
        if (touch && start.time > 0) {
          const dist = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
          if (dist > 12) {
            return;
          }
        }

        // Cancelar el evento para evitar 'ghost clicks' en los elementos del calendario bajo el overlay
        if (e.cancelable) {
          e.preventDefault();
        }

        handleOverlayDismiss(e);
      },
      [handleOverlayDismiss]
    );

    const handleOverlayClick = React.useCallback(
      (e) => {
        handleOverlayDismiss(e);
      },
      [handleOverlayDismiss]
    );

    const stopReactTouchBubbling = (e) => {
      e.stopPropagation();
    };

    return (
      <SheetPortal>
        <SheetOverlay
          ref={handleOverlayRef}
          onClick={handleOverlayClick}
          onTouchStart={handleOverlayTouchStart}
          onTouchEnd={handleOverlayTouchEnd}
        />
        <SheetPrimitive.Content
          ref={mergedRef}
          onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
          onPointerDownOutside={(e) => {
            if (onBeforeDismissRef.current?.() === false) {
              e.preventDefault();
            }
            props.onPointerDownOutside?.(e);
          }}
          onTouchStart={stopReactTouchBubbling}
          onTouchMove={stopReactTouchBubbling}
          onTouchEnd={stopReactTouchBubbling}
          onTouchCancel={stopReactTouchBubbling}
          style={style}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col rounded-t-[22px] border-t border-[var(--border)] dark:border-t-white/10 bg-[var(--surface-elevated)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl dark:shadow-[0_-16px_48px_rgba(0,0,0,0.75)] outline-none overflow-y-auto overscroll-contain will-change-transform [transform:translate3d(0,0,0)]',
            className
          )}
          {...props}
        >
          {showHandle && (
            <div
              data-sheet-handle="true"
              className="flex w-full shrink-0 items-center justify-center -mt-2.5 pt-1 pb-2 cursor-grab active:cursor-grabbing select-none touch-none"
              aria-hidden="true"
            >
              <div className="h-1.5 w-11 rounded-full bg-current opacity-20" />
            </div>
          )}
          {children}
          {showCloseButton ? (
            <SheetPrimitive.Close
              data-sheet-close="true"
              className="touch-target-44 absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-current/15 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--card-ink,var(--text-secondary))] hover:text-[var(--card-ink,var(--text-primary))] transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </SheetPrimitive.Close>
          ) : (
            <SheetPrimitive.Close
              data-sheet-close="true"
              className="sr-only pointer-events-none"
              tabIndex={-1}
              aria-hidden="true"
            />
          )}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = 'SheetContent';

export const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 text-left mb-2', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

export const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'flex flex-col gap-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[var(--border-light)] mt-auto',
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

export const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-bold leading-snug tracking-tight text-[var(--text-primary)] font-[var(--font-display)]', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

export const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--text-secondary)]', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

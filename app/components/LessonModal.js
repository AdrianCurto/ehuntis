'use client';

import { useState } from 'react';
import {
  MapPin,
  User,
  Pencil,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { toast } from 'sonner';
import { subjectColor } from './WeekCalendar';
import { formatTeacher } from '../utils/teachers';
import { formatTime } from '../utils/dateTimeUtils';
import { formatRooms } from '../utils/subgroups';
import { cn } from '../utils/cn';

const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseDate(dateNum) {
  if (!dateNum) return new Date();
  const y = Math.floor(dateNum / 10000);
  const m = Math.floor((dateNum % 10000) / 100) - 1;
  const d = dateNum % 100;
  return new Date(y, m, d);
}

export default function LessonModal({
  lesson,
  onClose,
  isDark = false,
  onToggleCancelled,
  onOpenEdit,
  onOpenSwap,
  onResetOverride,
  onRestoreOverride,
  onResolveDrift,
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!lesson) return null;

  const date = parseDate(lesson.date);
  const dayName = DAYS_LONG[date.getDay()];
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const timeStr = `${formatTime(lesson.startTime)}–${formatTime(lesson.endTime)}`;
  const color = subjectColor(lesson.subjectIds?.[0] || 0, isDark);

  const subjectName = lesson.subjects?.[0] || 'Sin asignatura';
  const teacher = formatTeacher(lesson.teachers?.[0] || '');
  const room = formatRooms(lesson.rooms);
  const classes = lesson.classes || [];
  const subgroupStr = classes.length > 0 ? classes.join(', ') : '';

  const isUserCancelled = Boolean(lesson.isUserCancelled);
  const isWebUntisCancelled = lesson.code === 'cancelled' && !isUserCancelled;
  const isOverridden = Boolean(lesson.isOverridden);
  const hasDrift = Boolean(lesson.hasRemoteDrift && lesson.driftChanges && lesson.driftChanges.length > 0);

  const modalBorderColor = `color-mix(in oklab, ${color.text} 28%, transparent)`;

  const handleToggleCancelClick = () => {
    const nextCancelled = !isUserCancelled;
    onToggleCancelled?.(lesson);
    toast.success(nextCancelled ? 'Clase marcada como cancelada' : 'Clase reactivada', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          onToggleCancelled?.({ ...lesson, isUserCancelled: nextCancelled });
        },
      },
    });
  };

  const handleResetConfirm = () => {
    setShowResetConfirm(false);
    const snapshot = onResetOverride?.(lesson);
    toast.success('Clase restablecida al horario oficial', {
      action: onRestoreOverride
        ? {
            label: 'Deshacer',
            onClick: () => {
              onRestoreOverride(snapshot, lesson);
            },
          }
        : undefined,
    });
    onClose?.();
  };

  return (
    <>
      <ResponsiveModal open={true} onOpenChange={(open) => { if (!open) onClose?.(); }}>
        <ResponsiveModalContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-md p-5 sm:p-6 overflow-y-auto overscroll-contain"
          style={{
            background: color.bg,
            borderColor: modalBorderColor,
            '--card-bg': color.bg,
            '--card-ink': color.text,
          }}
        >
          {/* Cabecera: Asignatura primero, fecha y hora como subtitulo */}
          <div className="pr-8 mb-3 text-left">
            {subgroupStr && (
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 opacity-75" style={{ color: color.text }}>
                {subgroupStr}
                {lesson.type ? ` · ${lesson.type}` : ''}
              </div>
            )}
            <h2 className="text-xl font-bold leading-snug tracking-tight text-balance font-[var(--font-display)]" style={{ color: color.text }}>
              {subjectName}
            </h2>
            {!subgroupStr && lesson.type && (
              <div className="text-xs font-medium opacity-80 mt-0.5" style={{ color: color.text }}>
                {lesson.type}
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium tabular-nums" style={{ color: color.text, opacity: 0.85 }}>
              <span>{dayName} {dateStr}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold">{timeStr}</span>
            </div>
          </div>

          {/* Banner de drift remoto si WebUntis actualizo datos */}
          {hasDrift && (
            <div className="p-3.5 my-3 rounded-[var(--radius-lg)] bg-white/90 dark:bg-slate-950/80 border border-amber-500/40 text-slate-900 dark:text-slate-100 text-xs shadow-sm backdrop-blur-xs">
              <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>WebUntis ha actualizado esta clase</span>
              </div>
              <div className="flex flex-col gap-1.5 mb-3">
                {lesson.driftChanges.map((ch, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-1.5 tabular-nums">
                    <span className="font-medium text-slate-600 dark:text-slate-400">{ch.label}:</span>
                    <span className="line-through text-slate-500 dark:text-slate-400">{ch.before}</span>
                    <span className="text-slate-400" aria-hidden="true">→</span>
                    <span className="font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-amber-500/15 dark:bg-amber-400/20 text-amber-950 dark:text-amber-200">
                      {ch.after}
                    </span>
                    {ch.userValue && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        (tu cambio: {ch.userValue})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="touch-target-44 bg-[#c2410c] hover:bg-[#9a3412] text-white border border-transparent h-8 px-3 text-xs font-semibold shadow-xs"
                  onClick={() => onResolveDrift?.(lesson, 'adopt_remote')}
                >
                  Adoptar cambio oficial
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="touch-target-44 h-8 px-3 text-xs font-medium bg-transparent border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => onResolveDrift?.(lesson, 'keep_local')}
                >
                  Mantener mi versión
                </Button>
              </div>
            </div>
          )}

          {/* Badges de estado / Swap */}
          {(isUserCancelled || isWebUntisCancelled || lesson.swappedWith || isOverridden) && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {isUserCancelled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/18 text-rose-800 dark:text-rose-200 border border-rose-500/30">
                  <Ban className="w-3.5 h-3.5" /> Cancelada por ti
                </span>
              )}

              {isWebUntisCancelled && !isUserCancelled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Cancelada por la universidad
                </span>
              )}

              {lesson.swappedWith && !isUserCancelled && !isWebUntisCancelled && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/8 dark:bg-white/14 border border-current/15" style={{ color: color.text }}>
                  <ArrowUpDown className="w-3.5 h-3.5" /> Intercambiada con {lesson.swappedWith.subjectName}
                </span>
              )}

              {isOverridden && !isUserCancelled && !lesson.swappedWith && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                    color: color.text,
                  }}
                >
                  <Pencil className="w-3 h-3" /> Personalizada
                </span>
              )}
            </div>
          )}

          {/* Detalles: Profesor y Aula */}
          {(teacher || room) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {teacher && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    color: color.text,
                  }}
                >
                  <User className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <span>{teacher}</span>
                </div>
              )}
              {room && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                    color: color.text,
                  }}
                >
                  <MapPin className="w-3.5 h-3.5 opacity-75 shrink-0" />
                  <span>{room}</span>
                </div>
              )}
            </div>
          )}

          {/* Notas personales */}
          {lesson.notes && (
            <div
              className="p-3 rounded-[var(--radius-md)] text-xs leading-relaxed mb-4 whitespace-pre-wrap break-words text-left"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: color.text,
              }}
            >
              <div className="flex items-center gap-1.5 font-semibold opacity-80 mb-1">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Notas personales</span>
              </div>
              <div className="text-pretty">{lesson.notes}</div>
            </div>
          )}

          {/* Botones de accion: jerarquia tonal integrada y contraste garantizado en cualquier tarjeta */}
          <div
            className="space-y-2 pt-3.5 border-t"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }}
          >
            {/* Primario: Editar clase */}
            <Button
              variant="ghost"
              size="md"
              className="lesson-card-btn-primary w-full font-semibold shadow-xs transition-all duration-150"
              onClick={() => onOpenEdit?.(lesson)}
            >
              <Pencil className="w-4 h-4 mr-1.5" />
              <span>Editar clase</span>
            </Button>

            {/* Secundario neutro: Intercambiar horario */}
            <Button
              variant="ghost"
              size="md"
              className="lesson-card-btn-secondary w-full font-medium transition-all duration-150"
              onClick={() => onOpenSwap?.(lesson)}
            >
              <ArrowUpDown className="w-4 h-4 mr-1.5 opacity-85" />
              <span>Intercambiar horario</span>
            </Button>

            {/* Accion destructiva / de estado: superficie propia de alto contraste */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
              <Button
                variant="ghost"
                size="md"
                onClick={handleToggleCancelClick}
                className={cn(
                  'w-full font-semibold transition-all duration-150',
                  isUserCancelled ? 'lesson-card-btn-success' : 'lesson-card-btn-danger'
                )}
              >
                {isUserCancelled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    <span>Reactivar clase</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-1.5" />
                    <span>Cancelar clase</span>
                  </>
                )}
              </Button>

              {isOverridden && (
                <Button
                  variant="ghost"
                  size="md"
                  className="lesson-card-btn-secondary w-full font-medium transition-all duration-150"
                  onClick={() => setShowResetConfirm(true)}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  <span>Restablecer</span>
                </Button>
              )}
            </div>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Dialogo de confirmacion para restablecer clase a version original */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Restablecer clase"
        description="¿Restablecer esta clase a los datos oficiales de WebUntis? Se descartarán tus modificaciones."
        confirmText="Restablecer"
        variant="destructive"
        icon={RotateCcw}
        onConfirm={handleResetConfirm}
      />
    </>
  );
}

'use client';

import { useState } from 'react';
import {
  X,
  Clock,
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
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalFooter,
} from './ui/responsive-modal';
import { Button } from './ui/button';
import { ConfirmDialog } from './ui/confirm-dialog';
import { toast } from 'sonner';
import { subjectColor } from './WeekCalendar';
import { formatTeacher } from '../utils/teachers';
import { formatTime } from '../utils/lessonOverrides';
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
  const isWebUntisCancelled = lesson.rawCode === 'cancelled' || (lesson.code === 'cancelled' && !isUserCancelled);
  const isOverridden = Boolean(lesson.isOverridden);
  const hasDrift = Boolean(lesson.hasRemoteDrift && lesson.driftChanges && lesson.driftChanges.length > 0);

  const handleResetConfirm = () => {
    setShowResetConfirm(false);
    onResetOverride?.(lesson);
    toast.success('Clase restablecida al horario oficial');
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
          }}
        >
          {/* Cabecera */}
          <div className="flex flex-col items-center text-center px-6 mb-2">
            <div className="text-sm font-semibold" style={{ color: color.text, opacity: 0.85 }}>
              {dayName} {dateStr}
            </div>
            <div className="text-lg font-bold tabular-nums" style={{ color: color.text }}>
              {timeStr}
            </div>
          </div>

          {/* Banner de drift remoto si WebUntis actualizó datos */}
          {hasDrift && (
            <div className="p-3 my-2 rounded-[var(--radius-md)] bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>WebUntis ha actualizado esta clase:</span>
              </div>
              <div className="flex flex-col gap-1 mb-2.5">
                {lesson.driftChanges.map((ch, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="font-semibold">{ch.label}:</span>
                    <span className="line-through opacity-70">{ch.before}</span>
                    <span>→</span>
                    <span className="font-bold underline">{ch.after}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="bg-amber-600 text-white hover:bg-amber-700 h-7 text-xs"
                  onClick={() => onResolveDrift?.(lesson, 'adopt_remote')}
                >
                  Adoptar cambio oficial
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-amber-500/50"
                  onClick={() => onResolveDrift?.(lesson, 'keep_local')}
                >
                  Mantener mi versión
                </Button>
              </div>
            </div>
          )}

          {/* Subgrupo */}
          {subgroupStr && (
            <div className="text-xs font-semibold opacity-75 uppercase tracking-wider mb-1 text-center" style={{ color: color.text }}>
              {subgroupStr}
            </div>
          )}

          {/* Nombre Asignatura */}
          <div className="text-xl font-bold leading-snug mb-1 text-center text-balance" style={{ color: color.text }}>
            {subjectName}
          </div>

          {/* Tipo de clase */}
          {lesson.type && (
            <div className="text-xs opacity-85 mb-3 text-center" style={{ color: color.text }}>
              {lesson.type}
            </div>
          )}

          {/* Badges de estado / Swap */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {isUserCancelled && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <Ban className="w-3.5 h-3.5" /> Cancelada por ti
              </span>
            )}

            {isWebUntisCancelled && !isUserCancelled && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5" /> Cancelada por la universidad
              </span>
            )}

            {lesson.swappedWith && !isUserCancelled && !isWebUntisCancelled && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                <ArrowUpDown className="w-3.5 h-3.5" /> Intercambiada con {lesson.swappedWith.subjectName}
              </span>
            )}

            {isOverridden && !isUserCancelled && !lesson.swappedWith && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  color: color.text,
                }}
              >
                <Pencil className="w-3 h-3" /> Personalizada
              </span>
            )}
          </div>

          {/* Detalles: Profesor y Aula */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {teacher && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-md)] text-xs font-medium"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: color.text,
                }}
              >
                <User className="w-3.5 h-3.5 opacity-75" />
                <span>{teacher}</span>
              </div>
            )}
            {room && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-md)] text-xs font-bold"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: color.text,
                }}
              >
                <MapPin className="w-3.5 h-3.5 opacity-75" />
                <span>{room}</span>
              </div>
            )}
          </div>

          {/* Notas personales */}
          {lesson.notes && (
            <div
              className="p-3 rounded-[var(--radius-md)] text-xs leading-relaxed mb-4 whitespace-pre-wrap break-words text-center"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: color.text,
              }}
            >
              <div className="flex items-center justify-center gap-1 font-bold opacity-75 mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Notas personales:</span>
              </div>
              <div className="text-pretty">{lesson.notes}</div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-2 pt-3 border-t border-black/10 dark:border-white/10">
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => onToggleCancelled?.(lesson)}
                className={cn(
                  'w-full font-semibold transition-all duration-150',
                  isUserCancelled
                    ? 'bg-emerald-500/18 hover:bg-emerald-500/28 dark:bg-emerald-500/22 dark:hover:bg-emerald-500/32 text-emerald-800 dark:text-emerald-200 border border-emerald-600/30 dark:border-emerald-400/35'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-500/30 dark:border-rose-400/35'
                )}
              >
                {isUserCancelled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Reactivar clase</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-1.5 text-rose-600 dark:text-rose-400" />
                    <span>Cancelar clase</span>
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="md"
                className="w-full font-semibold bg-indigo-500/14 hover:bg-indigo-500/24 dark:bg-indigo-500/18 dark:hover:bg-indigo-500/28 text-indigo-800 dark:text-indigo-200 border border-indigo-500/25 dark:border-indigo-400/30 transition-all duration-150"
                onClick={() => onOpenEdit?.(lesson)}
              >
                <Pencil className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                <span>Editar clase</span>
              </Button>
            </div>

            <Button
              variant="ghost"
              size="md"
              className="w-full font-semibold bg-sky-500/14 hover:bg-sky-500/24 dark:bg-sky-500/18 dark:hover:bg-sky-500/28 text-sky-800 dark:text-sky-200 border border-sky-500/25 dark:border-sky-400/30 transition-all duration-150"
              onClick={() => onOpenSwap?.(lesson)}
            >
              <ArrowUpDown className="w-4 h-4 mr-1.5 text-sky-600 dark:text-sky-400" />
              <span>Intercambiar horario</span>
            </Button>

            {isOverridden && (
              <Button
                variant="ghost"
                size="md"
                className="w-full font-semibold bg-amber-500/12 hover:bg-amber-500/22 dark:bg-amber-500/16 dark:hover:bg-amber-500/26 text-amber-800 dark:text-amber-300 border border-amber-500/25 dark:border-amber-400/30 transition-all duration-150"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="w-4 h-4 mr-1.5 text-amber-600 dark:text-amber-400" />
                <span>Restablecer a versión original</span>
              </Button>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Diálogo de confirmación para restablecer clase a versión original */}
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

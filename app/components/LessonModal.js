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
          className="max-w-md p-6 overflow-hidden max-h-[90vh] overflow-y-auto"
          style={{
            background: color.bg,
          }}
        >
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: color.text, opacity: 0.85 }}>
                {dayName} {dateStr}
              </div>
              <div className="text-lg font-bold" style={{ color: color.text }}>
                {timeStr}
              </div>
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
            <div className="text-xs font-semibold opacity-75 uppercase tracking-wider mb-1" style={{ color: color.text }}>
              {subgroupStr}
            </div>
          )}

          {/* Nombre Asignatura */}
          <div className="text-xl font-bold leading-snug mb-1" style={{ color: color.text }}>
            {subjectName}
          </div>

          {/* Tipo de clase */}
          {lesson.type && (
            <div className="text-xs opacity-85 mb-3" style={{ color: color.text }}>
              {lesson.type}
            </div>
          )}

          {/* Badges de estado / Swap */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
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
          <div className="flex flex-wrap items-center gap-2 mb-4">
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
              className="p-3 rounded-[var(--radius-md)] text-xs leading-relaxed mb-4 whitespace-pre-wrap break-words"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                color: color.text,
              }}
            >
              <div className="flex items-center gap-1 font-bold opacity-75 mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Notas personales:</span>
              </div>
              <div>{lesson.notes}</div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-2 pt-3 border-t border-black/10 dark:border-white/10">
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2">
              <Button
                variant={isUserCancelled ? 'default' : 'secondary'}
                size="md"
                onClick={() => onToggleCancelled?.(lesson)}
                className={cn(
                  'w-full',
                  isUserCancelled && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
              >
                {isUserCancelled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    <span>Reactivar clase</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-1.5 text-rose-500" />
                    <span>Cancelar clase</span>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => onOpenEdit?.(lesson)}
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                <span>Editar clase</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => onOpenSwap?.(lesson)}
            >
              <ArrowUpDown className="w-4 h-4 mr-1.5" />
              <span>Intercambiar horario</span>
            </Button>

            {isOverridden && (
              <Button
                variant="destructiveOutline"
                size="md"
                className="w-full"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
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

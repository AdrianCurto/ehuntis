'use client';

import { useState } from 'react';
import {
  Sun,
  Moon,
  Search,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  ArrowUpDown,
  RotateCcw,
  Plus,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Switch } from '@/app/components/ui/switch';
import { Tooltip } from '@/app/components/ui/tooltip';
import { SegmentedControl } from '@/app/components/ui/segmented-control';
import { Badge, Chip } from '@/app/components/ui/badge';
import { InlineCategoryChip } from '@/app/components/ui/inline-category-chip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { DatePicker } from '@/app/components/ui/date-picker';
import { TimePicker } from '@/app/components/ui/time-picker';
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog';
import CustomEventModal from '@/app/components/CustomEventModal';
import CustomEventDetailModal from '@/app/components/CustomEventDetailModal';
import LessonModal from '@/app/components/LessonModal';
import EditLessonModal from '@/app/components/EditLessonModal';
import SwapLessonModal from '@/app/components/SwapLessonModal';
import {
  mockCustomEvent,
  mockRecurringCustomEvent,
  mockLesson,
  mockEditedLesson,
  mockSwapCandidates,
  mockCustomCategories,
} from './fixtures';
import {
  PALETTE,
  PALETTE_DARK,
  CHROMATIC_ORDER_MAIN,
  CHROMATIC_ORDER_SOFT,
  getSubjectColorStyle,
} from '@/app/utils/colorLogic';
import { useTheme } from '@/app/utils/useTheme';
import { toast } from 'sonner';

export default function CatalogClient() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [activeTab, setActiveTab] = useState('components');

  // Input states
  const [dateVal, setDateVal] = useState('2026-11-17');
  const [timeVal15, setTimeVal15] = useState('09:15');
  const [timeVal30, setTimeVal30] = useState('11:30');
  const [textVal, setTextVal] = useState('');
  const [textareaVal, setTextareaVal] = useState('Texto de ejemplo en textarea con auto-crecimiento reactivo.');
  const [selectedChip, setSelectedChip] = useState('Clases');
  const [categories, setCategories] = useState(mockCustomCategories);
  const [demoCheck, setDemoCheck] = useState(true);
  const [demoSwitch, setDemoSwitch] = useState(true);
  const [demoSegment, setDemoSegment] = useState('weekly');

  // Modal active states for showcase
  const [activeModal, setActiveModal] = useState(null); // 'custom-event-new' | 'custom-event-edit' | 'custom-detail' | 'lesson' | 'lesson-drift' | 'edit-lesson' | 'swap-lesson' | 'confirm'

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className={`min-h-screen bg-[var(--bg)] text-[var(--text-primary)] px-4 py-3 sm:p-8 font-[var(--font-body)] ${isDark ? 'dark' : ''}`}>
      <div className="max-w-5xl mx-auto space-y-5 sm:space-y-8">
        {/* Header compacto en movil */}
        <header className="flex items-center justify-between gap-3 pb-3 sm:pb-5 border-b border-[var(--border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-light)] text-[var(--accent)]">
                Dev UI
              </span>
              <span className="hidden sm:inline text-xs text-[var(--text-muted)]">· Banco de pruebas de componentes</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight mt-1 font-[var(--font-display)] truncate">
              Sistema de Diseño EHUntis
            </h1>
            <p className="hidden sm:block text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Catálogo visual de tokens, primitivas accesibles, selectores y modales unificados.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              aria-label={isDark ? 'Modo Claro' : 'Modo Oscuro'}
              className="gap-1.5 sm:h-10 sm:px-4 sm:text-sm"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              <span className="hidden sm:inline">{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </Button>
          </div>
        </header>

        {/* Tabs de Secciones sticky en movil y escritorio */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-30 -mx-4 px-4 py-2 sm:mx-0 sm:px-0 bg-[var(--bg)]/92 backdrop-blur-md mb-4 sm:mb-6">
            <TabsList className="w-full grid grid-cols-3 h-11">
              <TabsTrigger id="tab-components" value="components" className="px-2 text-xs sm:text-sm">
                <span className="sm:hidden">Base</span>
                <span className="hidden sm:inline">Componentes Base</span>
              </TabsTrigger>
              <TabsTrigger id="tab-pickers" value="pickers" className="px-2 text-xs sm:text-sm">
                <span className="sm:hidden">Selectores</span>
                <span className="hidden sm:inline">Selectores Fecha & Hora</span>
              </TabsTrigger>
              <TabsTrigger id="tab-modals" value="modals" className="px-2 text-xs sm:text-sm">
                <span className="sm:hidden">Modales</span>
                <span className="hidden sm:inline">Modales & Diálogos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB: COMPONENTES BASE */}
          <TabsContent value="components" className="space-y-10">
            {/* 1. Botones */}
            <section id="section-buttons" className="space-y-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border-light)] pb-2">
                <h2 className="text-lg font-bold font-[var(--font-display)]">Botones (`Button`)</h2>
                <p className="text-xs text-[var(--text-secondary)]">Variantes de estilo, tamaños y feedback táctil active:scale-[0.98]</p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Variantes</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="default">Default / Accent</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="accentSubtle">Accent Subtle</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="destructiveOutline">Destructive Outline</Button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tamaños & Estados</div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button size="sm">Small (sm)</Button>
                  <Button size="md">Medium (md)</Button>
                  <Button size="lg">Large (lg)</Button>
                  <Button size="icon" aria-label="Icono"><Plus className="w-4 h-4" /></Button>
                  <Button size="iconSm" variant="secondary" aria-label="Icono pequeño"><Trash2 className="w-3.5 h-3.5" /></Button>
                  <Button loading>Guardando...</Button>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
            </section>

            {/* 1b. Controles de seleccion y Tooltip */}
            <section id="section-controls" className="space-y-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border-light)] pb-2">
                <h2 className="text-lg font-bold font-[var(--font-display)]">Controles (`SegmentedControl`, `Checkbox`, `Switch`, `Tooltip`)</h2>
                <p className="text-xs text-[var(--text-secondary)]">Primitivas accesibles con React Aria y foco solo por teclado</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                <div className="space-y-2">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">SegmentedControl unificado</div>
                  <SegmentedControl
                    options={[
                      { value: 'once', label: 'Solo una vez' },
                      { value: 'weekly', label: 'Semanal' },
                    ]}
                    value={demoSegment}
                    onChange={setDemoSegment}
                    ariaLabel="Ejemplo de control segmentado"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <Checkbox checked={demoCheck} onChange={setDemoCheck}>
                    Sin fecha límite
                  </Checkbox>
                  <Switch checked={demoSwitch} onChange={setDemoSwitch}>
                    Notificaciones
                  </Switch>
                  <Tooltip content="Acción con ayuda contextual accesible">
                    <Button variant="outline" size="sm">Hover / Focus Tooltip</Button>
                  </Tooltip>
                </div>
              </div>
            </section>

            {/* 2. Inputs & Textareas */}
            <section id="section-inputs" className="space-y-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border-light)] pb-2">
                <h2 className="text-lg font-bold font-[var(--font-display)]">Campos de Texto (`Input` & `Textarea`)</h2>
                <p className="text-xs text-[var(--text-secondary)]">Bordes sutiles, focus rings y textarea auto-creciente</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Input Simple</label>
                  <Input
                    placeholder="Escribe algo..."
                    value={textVal}
                    onChange={(e) => setTextVal(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Input con Icono</label>
                  <Input
                    startIcon={Search}
                    placeholder="Buscar asignatura o aula..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[var(--text-primary)]">Estado de error y validación</label>
                  <Input
                    defaultValue="08:00"
                    error="La hora de fin debe ser posterior a la hora de inicio."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Textarea Auto-creciente (hasta 180px, sin tirador visible)</label>
                  <Textarea
                    value={textareaVal}
                    onChange={(e) => setTextareaVal(e.target.value)}
                    placeholder="Escribe varias líneas para comprobar la expansión automática..."
                  />
                </div>
              </div>
            </section>

            {/* 3. Badges, Chips & Inline Category Chip */}
            <section id="section-badges" className="space-y-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border-light)] pb-2">
                <h2 className="text-lg font-bold font-[var(--font-display)]">Badges & Chips</h2>
                <p className="text-xs text-[var(--text-secondary)]">Píldoras informativas y chips interactivos</p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Badges de Estado</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">En curso</Badge>
                  <Badge variant="secondary">Oficial</Badge>
                  <Badge variant="outline">Sin asignar</Badge>
                  <Badge variant="success">Confirmada</Badge>
                  <Badge variant="destructive">Cancelada</Badge>
                  <Badge variant="warning">Aviso de cambio</Badge>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Chips de Categoría & InlineCategoryChip</div>
                <div className="flex flex-wrap items-center gap-2">
                  {categories.map((cat) => (
                    <Chip
                      key={cat}
                      selected={selectedChip === cat}
                      onClick={() => setSelectedChip(cat)}
                    >
                      {cat}
                    </Chip>
                  ))}
                  <InlineCategoryChip
                    onAdd={(newCat) => {
                      setCategories((prev) => [...prev, newCat]);
                      setSelectedChip(newCat);
                      toast.success(`Etiqueta "${newCat}" añadida`);
                    }}
                  />
                </div>
              </div>
            </section>

            {/* 4. Tokens de Color del Horario */}
            <section id="section-palette" className="space-y-4 p-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border-light)] pb-2">
                <h2 className="text-lg font-bold font-[var(--font-display)]">Paleta Curada de Asignaturas</h2>
                <p className="text-xs text-[var(--text-secondary)]">14 tonos calibrados en orden cromático principal y secundario</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {CHROMATIC_ORDER_MAIN.concat(CHROMATIC_ORDER_SOFT).map((idx) => {
                  const style = getSubjectColorStyle(idx, isDark);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-[var(--radius-lg)] border text-xs font-bold flex flex-col justify-between h-20 shadow-xs"
                      style={{ background: style.bg, borderColor: style.border, color: style.text }}
                    >
                      <span>Color #{idx + 1}</span>
                      <span className="font-mono text-[10px] opacity-75">{style.bg}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>

          {/* TAB: SELECTORES FECHA & HORA */}
          <TabsContent value="pickers" className="space-y-8">
            <section id="section-pickers" className="space-y-6 p-6 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div>
                <h2 className="text-lg font-bold font-[var(--font-display)]">Selectores Unificados con React Aria Components</h2>
                <p className="text-xs text-[var(--text-secondary)]">Formato localizado en España (24h, semanas comenzando en lunes), tecleado directo y desplegables en popover/sheet</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" /> DatePicker
                  </label>
                  <DatePicker
                    value={dateVal}
                    onChange={(str) => setDateVal(str)}
                    ariaLabel="Fecha de prueba"
                  />
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums">Valor: {dateVal || '(vacío)'}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" /> TimePicker (15 min - Eventos)
                  </label>
                  <TimePicker
                    value={timeVal15}
                    step={15}
                    onChange={(str) => setTimeVal15(str)}
                    ariaLabel="Hora de evento"
                  />
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums">Valor: {timeVal15 || '(vacío)'}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" /> TimePicker (30 min - Clases)
                  </label>
                  <TimePicker
                    value={timeVal30}
                    step={30}
                    onChange={(str) => setTimeVal30(str)}
                    ariaLabel="Hora de clase"
                  />
                  <div className="text-[11px] text-[var(--text-muted)]">Valor: {timeVal30 || '(vacío)'}</div>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* TAB: MODALES & DIÁLOGOS */}
          <TabsContent value="modals" className="space-y-6">
            <section id="section-modals-launch" className="space-y-4 p-6 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
              <div>
                <h2 className="text-lg font-bold font-[var(--font-display)]">Catálogo Interactivo de Modales</h2>
                <p className="text-xs text-[var(--text-secondary)]">Pulsa para abrir cualquier modal en su estado real</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <Button
                  id="btn-modal-custom-new"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('custom-event-new')}
                >
                  <Plus className="w-4 h-4 text-[var(--accent)] shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Crear Evento</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Modal nuevo evento puntual</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-custom-edit"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('custom-event-edit')}
                >
                  <Edit2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Editar Evento Recurrente</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Sub-paso selección de ámbito</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-custom-detail"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('custom-detail')}
                >
                  <Info className="w-4 h-4 text-sky-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Detalle de Evento</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Visualización y borrado con undo</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-lesson"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('lesson')}
                >
                  <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Detalle de Clase</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Acciones rápidas y confirm dialog</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-lesson-drift"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('lesson-drift')}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Clase con Remote Drift</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Aviso de actualización oficial</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-lesson-edit"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('edit-lesson')}
                >
                  <Edit2 className="w-4 h-4 text-purple-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Editar Clase</div>
                    <div className="text-[11px] text-[var(--text-muted)]">TimePicker y notas autosize</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-lesson-swap"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('swap-lesson')}
                >
                  <ArrowUpDown className="w-4 h-4 text-cyan-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Intercambiar Clase</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Lista y vista de confirmación</div>
                  </div>
                </Button>

                <Button
                  id="btn-modal-confirm"
                  variant="outline"
                  size="md"
                  className="justify-start gap-2.5 h-auto py-3"
                  onClick={() => setActiveModal('confirm')}
                >
                  <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">ConfirmDialog Estándar</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Diálogo unificado compacto</div>
                  </div>
                </Button>
              </div>
            </section>
          </TabsContent>
        </Tabs>

        {/* ── Instancias activas de modales para verificación ── */}
        {activeModal === 'custom-event-new' && (
          <CustomEventModal
            targetDate={new Date('2026-11-17T09:00:00')}
            isDark={isDark}
            onSave={(payload) => {
              toast.success(`Evento "${payload.title}" guardado`);
              setActiveModal(null);
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'custom-event-edit' && (
          <CustomEventModal
            event={mockRecurringCustomEvent}
            isDark={isDark}
            onSave={(payload, mode) => {
              toast.success(`Serie semanal actualizada (${mode})`);
              setActiveModal(null);
            }}
            onDelete={(id, date, mode) => {
              toast.success(`Instancia eliminada (${mode})`);
              setActiveModal(null);
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'custom-detail' && (
          <CustomEventDetailModal
            event={{ ...mockCustomEvent, subjects: [mockCustomEvent.title] }}
            isDark={isDark}
            onEdit={() => setActiveModal('custom-event-edit')}
            onDelete={() => setActiveModal(null)}
            onRestore={() => toast.success('Evento restaurado')}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'lesson' && (
          <LessonModal
            lesson={mockLesson}
            isDark={isDark}
            onToggleCancelled={() => toast.success('Estado de cancelación cambiado')}
            onOpenEdit={() => setActiveModal('edit-lesson')}
            onOpenSwap={() => setActiveModal('swap-lesson')}
            onResetOverride={() => toast.success('Clase restablecida')}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'lesson-drift' && (
          <LessonModal
            lesson={{
              ...mockLesson,
              hasRemoteDrift: true,
              driftChanges: [
                { label: 'Aula', before: 'P1G2A', after: 'P2G4B' },
                { label: 'Horario', before: '09:00–11:00', after: '10:00–12:00' },
              ],
            }}
            isDark={isDark}
            onResolveDrift={(_, action) => {
              toast.success(`Drift resuelto: ${action}`);
              setActiveModal(null);
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'edit-lesson' && (
          <EditLessonModal
            lesson={mockEditedLesson}
            isDark={isDark}
            onSave={(_, edits) => {
              toast.success('Clase personalizada guardada');
              setActiveModal(null);
            }}
            onResetOverride={() => ({ restored: true })}
            onRestoreOverride={() => toast.success('Cambios restaurados')}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'swap-lesson' && (
          <SwapLessonModal
            lesson={mockLesson}
            targetLesson={mockSwapCandidates[0]}
            isDark={isDark}
            onSwap={() => {
              toast.success('Intercambio de horario completado');
              setActiveModal(null);
            }}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === 'confirm' && (
          <ConfirmDialog
            open={true}
            onOpenChange={() => setActiveModal(null)}
            title="¿Restablecer todas las clases?"
            description="Se descartarán tus personalizaciones de horario, aula y notas, volviendo a los datos oficiales de WebUntis."
            affectedSummary="3 clases personalizadas"
            confirmText="Restablecer"
            variant="destructive"
            icon={RotateCcw}
            onConfirm={() => {
              toast.success('Acción confirmada');
              setActiveModal(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

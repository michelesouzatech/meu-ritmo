import { useMemo, useState } from "react";
import { Check, Trash2, RotateCcw, Flame, Pencil, GripVertical, Repeat, Pill } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Sheet from "../components/Sheet.jsx";
import AddButton from "../components/AddButton.jsx";
import HabitWeekStrip from "../components/HabitWeekStrip.jsx";
import DateDropdown from "../components/DateDropdown.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import SupplementsTab from "./SupplementsTab.jsx";
import { todayISO, formatDatePtBr } from "../lib/date.js";
import { habitProgress } from "../lib/habitProgress.js";
import { buildHabitInsights } from "../lib/insights.js";

const TAB_KEY = "meuritmo:habits-screen-tab";
const TABS = [
  { id: "habits", label: "Hábitos", icon: Repeat },
  { id: "supplements", label: "Suplementos", icon: Pill },
];
const TAB_IDS = TABS.map((t) => t.id);

function readSavedTab() {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return TAB_IDS.includes(saved) ? saved : "habits";
  } catch {
    return "habits";
  }
}

function SubTabs({ active, onChange }) {
  return (
    <div className="ritmo-inset mb-4 flex rounded-full p-0.5">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active === id}
          className={`flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-colors ${
            active === id ? "ritmo-glass-pill text-ritmo-pink-deep" : "text-ritmo-muted"
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

export function HabitFormSheet({ habit, onClose, onSave }) {
  const isEditing = !!habit;
  const [name, setName] = useState(habit?.name ?? "");
  const [hasCycle, setHasCycle] = useState(!!habit?.periodDays);
  const [periodDays, setPeriodDays] = useState(habit?.periodDays ?? 7);
  const [startDate, setStartDate] = useState(habit?.startDate ?? todayISO());

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (hasCycle && !periodDays) return;
    onSave({
      name: name.trim(),
      periodDays: hasCycle ? Number(periodDays) : null,
      startDate,
      ...(isEditing ? {} : { completions: [] }),
    });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar hábito" : "Novo hábito"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Meta
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Beber 2L de água"
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>

        <label className="ritmo-field flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-3">
          <span className="text-sm font-medium text-ritmo-text/70">
            Definir um ciclo com prazo (opcional)
          </span>
          <input
            type="checkbox"
            checked={hasCycle}
            onChange={(e) => setHasCycle(e.target.checked)}
            className="h-5 w-5 accent-ritmo-pink"
          />
        </label>

        {hasCycle ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
                Duração do ciclo (dias)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={periodDays}
                onChange={(e) => setPeriodDays(e.target.value)}
                className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
                Início do ciclo
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-ritmo-muted">
            Sem ciclo definido, esse hábito é diário e não tem data pra terminar — você marca todo dia que cumprir.
          </p>
        )}

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Criar hábito"}
        </button>
      </form>
    </Sheet>
  );
}

function HabitCard({ habit, date, onToggleDate, onDelete, onRestart, onEdit }) {
  const progress = habitProgress(habit);
  const { isFinished, notStarted } = progress;
  const today = todayISO();
  const isEditingToday = date === today;
  const doneOnDate = habit.completions.includes(date);
  const canEdit = date <= today && (!habit.periodDays || date >= habit.startDate);

  return (
    <div className="ritmo-card rounded-2xl p-3.5">
      {!isEditingToday && (
        <p className="mb-2 text-xs font-medium text-ritmo-ink-soft">{formatDatePtBr(date)}</p>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => canEdit && onToggleDate(habit.id, date)}
          disabled={!canEdit}
          aria-label={doneOnDate ? "Desmarcar dia" : "Marcar dia"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors disabled:opacity-60 ${
            doneOnDate
              ? "border-ritmo-pink-deep bg-ritmo-pink-deep text-white"
              : "border-ritmo-line bg-white/60"
          }`}
        >
          {doneOnDate && <Check size={16} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ritmo-text">{habit.name}</p>
          {progress.isDaily ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ritmo-muted">
              {progress.streak > 0 ? (
                <>
                  <Flame size={12} className="text-ritmo-pink" />
                  {progress.streak} dia{progress.streak === 1 ? "" : "s"} seguido
                  {progress.streak === 1 ? "" : "s"}
                </>
              ) : (
                "Nenhum dia seguido ainda"
              )}
            </p>
          ) : notStarted ? (
            <p className="mt-0.5 text-xs text-ritmo-muted">
              Começa em {formatDatePtBr(habit.startDate)}
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-ritmo-muted">
                {isFinished
                  ? `${habit.completions.length} de ${habit.periodDays} dias cumpridos`
                  : `${progress.daysRemaining} dia${progress.daysRemaining === 1 ? "" : "s"} restante${progress.daysRemaining === 1 ? "" : "s"} no ciclo`}
              </p>
              {!isFinished && (
                <p className="mt-0.5 text-xs text-ritmo-text/40">
                  {habit.completions.length} de {habit.periodDays} dias marcados
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="ritmo-glass-pill rounded-full px-2.5 py-1 text-xs font-semibold text-ritmo-ink-soft">
            {progress.isDaily
              ? "diário"
              : notStarted
                ? "em breve"
                : isFinished
                  ? "ciclo concluído"
                  : `dia ${progress.currentDay} de ${habit.periodDays}`}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(habit)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
              aria-label="Editar hábito"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(habit.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
              aria-label="Excluir hábito"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {isFinished && (
            <button
              type="button"
              onClick={() => onRestart(habit.id)}
              className="ritmo-ghost flex min-h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-ritmo-pink-deep"
            >
              <RotateCcw size={12} /> Novo ciclo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableHabitItem({ habit, date, onToggleDate, onDelete, onRestart, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1">
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="mt-2.5 flex h-11 w-7 shrink-0 touch-none items-center justify-center rounded-lg text-ritmo-text/25 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <HabitCard
          habit={habit}
          date={date}
          onToggleDate={onToggleDate}
          onDelete={onDelete}
          onRestart={onRestart}
          onEdit={onEdit}
        />
      </div>
    </div>
  );
}

function HabitsTab({
  habits,
  ai = [],
  aiStatus,
  onToggleDate,
  onDelete,
  onRestart,
  onEdit,
  onReorder,
  onAdd,
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const insights = useMemo(() => buildHabitInsights(habits), [habits]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = habits.map((h) => h.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ritmo-muted">
          Diários ou com ciclo por período — do jeito que fizer sentido
        </p>
        <AddButton label="Novo" onClick={onAdd} />
      </header>

      {habits.length === 0 ? (
        <p className="ritmo-card rounded-2xl p-4 text-center text-sm text-ritmo-muted">
          Toque no botão + para criar seu primeiro hábito.
        </p>
      ) : (
        <>
          <DateDropdown
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            habits={habits}
          />
          <HabitWeekStrip
            habits={habits}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <InsightsPanel items={insights} ai={ai} aiStatus={aiStatus} className="mb-4" />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {habits.map((habit) => (
                  <SortableHabitItem
                    key={habit.id}
                    habit={habit}
                    date={selectedDate}
                    onToggleDate={onToggleDate}
                    onDelete={onDelete}
                    onRestart={onRestart}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function HabitsScreen({
  habits,
  ai,
  aiStatus,
  onToggleDate,
  onDelete,
  onRestart,
  onEdit,
  onReorder,
  onAdd,
  supplements,
  onToggleSupplementDate,
  onDeleteSupplement,
  onEditSupplement,
  onAddSupplement,
}) {
  const [tab, setTab] = useState(readSavedTab);

  function changeTab(next) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // Sem localStorage a aba só volta ao padrão na próxima abertura.
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-ritmo-text">Hábitos</h1>

      <SubTabs active={tab} onChange={changeTab} />

      {tab === "habits" && (
        <HabitsTab
          habits={habits}
          ai={ai}
          aiStatus={aiStatus}
          onToggleDate={onToggleDate}
          onDelete={onDelete}
          onRestart={onRestart}
          onEdit={onEdit}
          onReorder={onReorder}
          onAdd={onAdd}
        />
      )}
      {tab === "supplements" && (
        <SupplementsTab
          supplements={supplements}
          onToggleDate={onToggleSupplementDate}
          onDelete={onDeleteSupplement}
          onEdit={onEditSupplement}
          onAdd={onAddSupplement}
        />
      )}
    </div>
  );
}

export default HabitsScreen;

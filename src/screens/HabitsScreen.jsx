import { useState } from "react";
import { Check, Trash2, RotateCcw, Flame, ChevronDown, Pencil, GripVertical } from "lucide-react";
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
import HabitCalendar from "../components/HabitCalendar.jsx";
import HabitWeekStrip from "../components/HabitWeekStrip.jsx";
import { todayISO, daysBetween, toISODate, formatDatePtBr } from "../lib/date.js";

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
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3">
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
                className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
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
                className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-ritmo-text/45">
            Sem ciclo definido, esse hábito é diário e não tem data pra terminar — você marca todo dia que cumprir.
          </p>
        )}

        <button
          type="submit"
          className="min-h-11 w-full rounded-full bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98]"
        >
          {isEditing ? "Salvar alterações" : "Criar hábito"}
        </button>
      </form>
    </Sheet>
  );
}

function calcStreak(habit) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let cursor = toISODate(d);
  if (!habit.completions.includes(cursor)) {
    d.setDate(d.getDate() - 1);
    cursor = toISODate(d);
  }
  let streak = 0;
  while (habit.completions.includes(cursor)) {
    streak++;
    d.setDate(d.getDate() - 1);
    cursor = toISODate(d);
  }
  return streak;
}

export function habitProgress(habit) {
  const today = todayISO();
  const doneToday = habit.completions.includes(today);

  if (!habit.periodDays) {
    const d = new Date();
    let markedLast7 = 0;
    for (let i = 0; i < 7; i++) {
      if (habit.completions.includes(toISODate(d))) markedLast7++;
      d.setDate(d.getDate() - 1);
    }
    return {
      isDaily: true,
      isFinished: false,
      doneToday,
      ratio: markedLast7 / 7,
      streak: calcStreak(habit),
      totalDays: habit.completions.length,
    };
  }

  const daysSinceStart = daysBetween(habit.startDate, today);
  const notStarted = daysSinceStart < 0;
  const elapsed = Math.max(0, daysSinceStart);
  const isFinished = !notStarted && elapsed >= habit.periodDays;
  const currentDay = notStarted ? 0 : Math.min(elapsed + 1, habit.periodDays);
  const daysRemaining = notStarted ? habit.periodDays : Math.max(0, habit.periodDays - currentDay);
  const ratio = habit.completions.length / habit.periodDays;
  return { isDaily: false, currentDay, daysRemaining, isFinished, notStarted, doneToday, ratio };
}

function HabitCard({ habit, date, onToggleDate, onDelete, onRestart, onEdit }) {
  const progress = habitProgress(habit);
  const { isFinished, notStarted } = progress;
  const today = todayISO();
  const isEditingToday = date === today;
  const doneOnDate = habit.completions.includes(date);
  const canEdit = date <= today && (!habit.periodDays || date >= habit.startDate);

  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm shadow-ritmo-text/5">
      {!isEditingToday && (
        <p className="mb-2 text-xs font-medium text-ritmo-pink-deep">
          {formatDatePtBr(date)}
        </p>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => canEdit && onToggleDate(habit.id, date)}
          disabled={!canEdit}
          aria-label={doneOnDate ? "Desmarcar dia" : "Marcar dia"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors disabled:opacity-60 ${
            doneOnDate
              ? "border-ritmo-pink bg-ritmo-pink text-white"
              : "border-ritmo-pink-light bg-white"
          }`}
        >
          {doneOnDate && <Check size={16} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ritmo-text">{habit.name}</p>
          {progress.isDaily ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ritmo-text/50">
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
            <p className="mt-0.5 text-xs text-ritmo-text/50">
              Começa em {formatDatePtBr(habit.startDate)}
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-ritmo-text/50">
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
          <span className="ritmo-glass-pill rounded-full px-2.5 py-1 text-xs font-semibold text-ritmo-lilac-ink">
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
              className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
              aria-label="Editar hábito"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(habit.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
              aria-label="Excluir hábito"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {isFinished && (
            <button
              type="button"
              onClick={() => onRestart(habit.id)}
              className="flex min-h-7 items-center gap-1 rounded-full bg-ritmo-pink-light/60 px-2.5 text-[11px] font-medium text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light"
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
        className="mt-2.5 flex h-11 w-7 shrink-0 touch-none items-center justify-center rounded-lg text-ritmo-text/25 transition-colors hover:bg-ritmo-pink-tint hover:text-ritmo-pink-deep active:cursor-grabbing"
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

function DateDropdown({ selectedDate, onSelectDate, habits }) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const label = selectedDate === today ? "Hoje" : formatDatePtBr(selectedDate);

  return (
    <div className="relative mb-3 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ritmo-text shadow-sm shadow-ritmo-text/5"
      >
        {label}
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar calendário"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full z-50 mt-2 w-[300px] max-w-[calc(100vw-2.5rem)] rounded-2xl bg-white p-4 shadow-xl shadow-ritmo-text/15">
            <HabitCalendar
              habits={habits}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
            />
          </div>
        </>
      )}
    </div>
  );
}

function HabitsScreen({ habits, onToggleDate, onDelete, onRestart, onEdit, onReorder, onAdd }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
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
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">
            Hábitos
          </h1>
          <p className="mt-1 text-sm text-ritmo-text/60">
            Diários ou com ciclo por período — do jeito que fizer sentido
          </p>
        </div>
        <AddButton label="Novo" onClick={onAdd} />
      </header>

      {habits.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-center text-sm text-ritmo-text/50 shadow-sm shadow-ritmo-text/5">
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

export default HabitsScreen;

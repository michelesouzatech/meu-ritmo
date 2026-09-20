import { useMemo, useState } from "react";
import { Check, Trash2, Pencil, Flame, Archive, ArchiveRestore } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import AddButton from "../components/AddButton.jsx";
import HabitWeekStrip from "../components/HabitWeekStrip.jsx";
import DateDropdown from "../components/DateDropdown.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import { todayISO, formatDatePtBr } from "../lib/date.js";
import {
  supplementPeriod,
  supplementsOnDate,
  supplementTimelineItem,
} from "../lib/habitPeriod.js";
import { buildSupplementInsights } from "../lib/insights.js";

export function SupplementFormSheet({ supplement, onClose, onSave }) {
  const isEditing = !!supplement;
  const [name, setName] = useState(supplement?.name ?? "");
  const [scheduleLabel, setScheduleLabel] = useState(supplement?.scheduleLabel ?? "");
  const [dose, setDose] = useState(supplement?.dose ?? "");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      scheduleLabel: scheduleLabel.trim(),
      dose: dose.trim(),
      ...(isEditing ? {} : { takenDates: [] }),
    });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar suplemento" : "Novo suplemento"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Nome
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Vitamina D"
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Horário
          </label>
          <input
            value={scheduleLabel}
            onChange={(e) => setScheduleLabel(e.target.value)}
            placeholder="Ex: Depois do café da manhã"
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Dose (opcional)
          </label>
          <input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="Ex: 1 cápsula"
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Criar suplemento"}
        </button>
      </form>
    </Sheet>
  );
}

function streakFor(takenDates) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const toISO = (date) => date.toISOString().slice(0, 10);
  let cursor = toISO(d);
  if (!takenDates.includes(cursor)) {
    d.setDate(d.getDate() - 1);
    cursor = toISO(d);
  }
  let streak = 0;
  while (takenDates.includes(cursor)) {
    streak++;
    d.setDate(d.getDate() - 1);
    cursor = toISO(d);
  }
  return streak;
}

const ICON_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft";

function SupplementCard({ supplement, date, onToggleDate, onDelete, onFinish, onReactivate, onEdit }) {
  const today = todayISO();
  const isEditingToday = date === today;
  const takenOnDate = supplement.takenDates.includes(date);
  const isEnded = supplement.active === false;
  // A sequência é contada a partir de hoje — num suplemento encerrado ela
  // sempre diria zero, então ele mostra o total e a data do fim.
  const streak = isEnded ? 0 : streakFor(supplement.takenDates);
  const canEdit = date <= today;
  const total = supplement.takenDates.length;

  return (
    <div className="ritmo-card rounded-2xl p-3.5">
      {!isEditingToday && (
        <p className="mb-2 text-xs font-medium text-ritmo-ink-soft">{formatDatePtBr(date)}</p>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => canEdit && onToggleDate(supplement.id, date)}
          disabled={!canEdit}
          aria-label={takenOnDate ? "Desmarcar como tomado" : "Marcar como tomado"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors disabled:opacity-60 ${
            takenOnDate
              ? "border-ritmo-pink-deep bg-ritmo-pink-deep text-white"
              : "border-ritmo-line bg-white/60"
          }`}
        >
          {takenOnDate && <Check size={16} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ritmo-text">{supplement.name}</p>
          <p className="mt-0.5 truncate text-xs text-ritmo-ink-soft">
            {[supplement.scheduleLabel, supplement.dose].filter(Boolean).join(" · ") || "Sem horário definido"}
          </p>
          {streak > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ritmo-muted">
              <Flame size={12} className="text-ritmo-pink" />
              {streak} dia{streak === 1 ? "" : "s"} seguido{streak === 1 ? "" : "s"}
            </p>
          )}
          {isEnded && (
            <p className="mt-0.5 text-xs text-ritmo-muted">
              {total} dia{total === 1 ? "" : "s"} tomado{total === 1 ? "" : "s"} · encerrado em{" "}
              {formatDatePtBr(supplementPeriod(supplement).lastDay)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {isEnded ? (
            <button
              type="button"
              onClick={() => onReactivate(supplement.id)}
              className={ICON_BUTTON}
              aria-label="Reativar suplemento"
            >
              <ArchiveRestore size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onEdit(supplement)}
              className={ICON_BUTTON}
              aria-label="Editar suplemento"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(supplement.id)}
            className={ICON_BUTTON}
            aria-label="Excluir suplemento"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {!isEnded && (
        <button
          type="button"
          onClick={() => onFinish(supplement.id)}
          className="ritmo-ghost mt-2 flex min-h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-ritmo-pink-deep"
        >
          <Archive size={12} /> Encerrar
        </button>
      )}
    </div>
  );
}

function SupplementsTab({ supplements, onToggleDate, onDelete, onFinish, onReactivate, onEdit, onAdd }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const activeSupplements = useMemo(
    () => supplements.filter((s) => s.active !== false),
    [supplements],
  );
  // Faixa de dias e calendário olham TODOS os suplementos: um encerrado
  // continua contando nos dias em que estava valendo. HabitCalendar e
  // HabitWeekStrip leem o mesmo formato dos hábitos.
  const timeline = useMemo(() => supplements.map(supplementTimelineItem), [supplements]);
  // A lista mostra o que existia no dia escolhido; os encerrados vão depois.
  const daySupplements = useMemo(
    () => supplementsOnDate(supplements, selectedDate),
    [supplements, selectedDate],
  );
  const dayList = [
    ...daySupplements.filter((s) => s.active !== false),
    ...daySupplements.filter((s) => s.active === false),
  ];
  const insights = useMemo(() => buildSupplementInsights(activeSupplements), [activeSupplements]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ritmo-muted">Marque assim que tomar cada um</p>
        <AddButton label="Novo" onClick={onAdd} />
      </div>

      {supplements.length === 0 ? (
        <p className="ritmo-card rounded-2xl p-4 text-center text-sm text-ritmo-muted">
          Toque no botão + para cadastrar seu primeiro suplemento.
        </p>
      ) : (
        <>
          <DateDropdown
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            habits={timeline}
            emptyLabel="Nenhum suplemento tomado nesse dia."
          />
          <HabitWeekStrip
            habits={timeline}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <InsightsPanel items={insights} className="mb-4" />
          {dayList.length === 0 ? (
            <p className="ritmo-card rounded-2xl p-4 text-center text-sm text-ritmo-muted">
              Nenhum suplemento nesse dia.
            </p>
          ) : (
            <div className="space-y-3">
              {dayList.map((supplement) => (
                <SupplementCard
                  key={supplement.id}
                  supplement={supplement}
                  date={selectedDate}
                  onToggleDate={onToggleDate}
                  onDelete={onDelete}
                  onFinish={onFinish}
                  onReactivate={onReactivate}
                  onEdit={onEdit}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SupplementsTab;

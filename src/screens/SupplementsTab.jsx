import { useState } from "react";
import { Check, Trash2, Pencil, Flame } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import AddButton from "../components/AddButton.jsx";
import { todayISO } from "../lib/date.js";

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

function SupplementCard({ supplement, onToggleToday, onDelete, onEdit }) {
  const today = todayISO();
  const takenToday = supplement.takenDates.includes(today);
  const streak = streakFor(supplement.takenDates);

  return (
    <div className="ritmo-card rounded-2xl p-3.5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleToday(supplement.id, today)}
          aria-label={takenToday ? "Desmarcar como tomado hoje" : "Marcar como tomado hoje"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            takenToday
              ? "border-ritmo-pink-deep bg-ritmo-pink-deep text-white"
              : "border-ritmo-line bg-white/60"
          }`}
        >
          {takenToday && <Check size={16} strokeWidth={3} />}
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
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(supplement)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            aria-label="Editar suplemento"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(supplement.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            aria-label="Excluir suplemento"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplementsTab({ supplements, onToggleToday, onDelete, onEdit, onAdd }) {
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
        <div className="space-y-3">
          {supplements.map((supplement) => (
            <SupplementCard
              key={supplement.id}
              supplement={supplement}
              onToggleToday={onToggleToday}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SupplementsTab;

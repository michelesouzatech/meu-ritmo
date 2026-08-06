import { useState } from "react";
import { Dumbbell, Footprints, Moon, Sparkles } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import { todayISO } from "../lib/date.js";
import { FEELINGS, pastCustomActivities } from "../lib/journal.js";

const fieldClass = "ritmo-field min-h-11 w-full rounded-xl px-3 text-sm";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ritmo-text/70">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ritmo-muted">{hint}</p>}
    </div>
  );
}

function Choice({ active, icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
        active ? "ritmo-cta" : "ritmo-glass-pill text-ritmo-lilac-ink hover:brightness-95"
      }`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export function JournalEntryFormSheet({
  entry,
  dateISO,
  groups,
  allEntries,
  onClose,
  onSave,
  onDelete,
}) {
  const isEditing = !!entry;
  const suggestions = pastCustomActivities(allEntries);

  const [date, setDate] = useState(entry?.date ?? dateISO ?? todayISO());
  const [activityType, setActivityType] = useState(entry?.activityType ?? "");
  const [activityLabel, setActivityLabel] = useState(entry?.activityLabel ?? "");
  const [feeling, setFeeling] = useState(entry?.feeling ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [error, setError] = useState(null);

  function pickGym(group) {
    setActivityType("gym");
    setActivityLabel(group);
  }

  function pickSimple(type) {
    setActivityType(type);
    setActivityLabel("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!activityType) return setError("Escolha o que você fez.");
    if (activityType === "other" && !activityLabel.trim()) {
      return setError("Escreva qual foi a atividade.");
    }
    if (!feeling) return setError("Marque como você se sentiu.");

    setError(null);
    onSave({
      date,
      activityType,
      activityLabel: activityType === "gym" || activityType === "other" ? activityLabel.trim() : "",
      feeling,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar registro" : "Como foi o treino?"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Dia">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </Field>

        <Field
          label="O que você fez?"
          hint="Um registro por treino — se fez academia e corrida no mesmo dia, cadastre os dois separados."
        >
          <div className="flex flex-wrap gap-1.5">
            {groups.map((group) => (
              <Choice
                key={group}
                icon={Dumbbell}
                active={activityType === "gym" && activityLabel === group}
                onClick={() => pickGym(group)}
              >
                {group}
              </Choice>
            ))}
            <Choice
              icon={Footprints}
              active={activityType === "run"}
              onClick={() => pickSimple("run")}
            >
              Corrida
            </Choice>
            <Choice
              icon={Moon}
              active={activityType === "rest"}
              onClick={() => pickSimple("rest")}
            >
              Descanso
            </Choice>
            <Choice
              icon={Sparkles}
              active={activityType === "other"}
              onClick={() => {
                setActivityType("other");
                setActivityLabel("");
              }}
            >
              Outra
            </Choice>
          </div>

          {activityType === "other" && (
            <>
              <input
                autoFocus
                list="journal-activities"
                value={activityLabel}
                onChange={(e) => setActivityLabel(e.target.value)}
                placeholder="Ex: yoga, pilates, bike"
                className={`${fieldClass} mt-2`}
              />
              <datalist id="journal-activities">
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          )}

          {groups.length === 0 && (
            <p className="mt-2 text-xs text-ritmo-muted">
              Suas fichas aparecem aqui assim que você cadastrar o treino na aba
              Força.
            </p>
          )}
        </Field>

        <Field label="Como você se sentiu?">
          <div className="flex justify-between gap-1">
            {FEELINGS.map((option) => {
              const active = feeling === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeeling(option.value)}
                  aria-pressed={active}
                  aria-label={option.label}
                  className={`flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-transform ${
                    active ? "ritmo-glass-pill scale-105" : "opacity-45 hover:opacity-80"
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {option.emoji}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${active ? "text-ritmo-lilac-ink" : "text-ritmo-muted"}`}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Observação (opcional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ex: costas pesada, corrida leve pra soltar"
            className="ritmo-field w-full rounded-xl px-3 py-2 text-sm"
          />
        </Field>

        {error && <p className="text-xs text-ritmo-pink-deep">{error}</p>}

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Salvar registro"}
        </button>
      </form>

      {isEditing && (
        <button
          type="button"
          onClick={() => {
            onDelete(entry.id);
            onClose();
          }}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light"
        >
          Excluir registro
        </button>
      )}
    </Sheet>
  );
}

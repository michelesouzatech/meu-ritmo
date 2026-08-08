import { useMemo } from "react";
import { Plus, NotebookPen } from "lucide-react";
import AddButton from "../components/AddButton.jsx";
import SwipeToDelete from "../components/SwipeToDelete.jsx";
import JournalCalendar from "../components/JournalCalendar.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import { buildJournalInsights } from "../lib/insights.js";
import { todayISO } from "../lib/date.js";
import {
  activityName,
  averageFeeling,
  entriesOn,
  feelingEmoji,
  feelingLabel,
} from "../lib/journal.js";

const DAY_LABEL = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

function formatDayLabel(dateISO) {
  const text = DAY_LABEL.format(new Date(`${dateISO}T00:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function EntryRow({ entry, onEdit, onDelete }) {
  return (
    <SwipeToDelete onDelete={() => onDelete(entry.id)} deleteLabel="Excluir registro">
      <button
        type="button"
        onClick={() => onEdit(entry)}
        className="ritmo-card flex w-full items-start gap-3 p-3 text-left"
      >
        <span className="text-2xl leading-none" aria-hidden>
          {feelingEmoji(entry.feeling)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ritmo-text">
            {activityName(entry)}
          </p>
          <p className="mt-0.5 text-xs text-ritmo-ink-soft">{feelingLabel(entry.feeling)}</p>
          {entry.notes && (
            <p className="mt-1 text-xs text-ritmo-muted">{entry.notes}</p>
          )}
        </div>
      </button>
    </SwipeToDelete>
  );
}

function JournalTab({
  entries,
  workout,
  sessions,
  ai = [],
  aiStatus,
  selectedDate,
  onSelectDate,
  onAdd,
  onEdit,
  onDelete,
}) {
  const today = todayISO();
  const dayEntries = entriesOn(entries, selectedDate);
  const isToday = selectedDate === today;

  const monthAverage = averageFeeling(
    entries.filter((e) => e.date.slice(0, 7) === selectedDate.slice(0, 7)),
  );

  // O diário cruza com o treino e as corridas — os três vivem na mesma tela,
  // então "treinei e não registrei" continua sendo assunto daqui.
  const insights = useMemo(
    () => buildJournalInsights(entries, { workout, sessions }),
    [entries, workout, sessions],
  );

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ritmo-muted">
          {entries.length === 0
            ? "Nenhum treino registrado"
            : `${entries.length} registro${entries.length > 1 ? "s" : ""}`}
          {monthAverage !== null && (
            <span className="ml-1">
              · média do mês {feelingEmoji(Math.round(monthAverage))}
            </span>
          )}
        </p>
        <AddButton label="Registro" onClick={() => onAdd(selectedDate)} />
      </header>

      <section className="ritmo-card mb-4 rounded-2xl p-4">
        <JournalCalendar
          entries={entries}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      </section>

      <InsightsPanel items={insights} ai={ai} aiStatus={aiStatus} className="mb-4" />

      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ritmo-text">
          {isToday ? "Hoje" : formatDayLabel(selectedDate)}
        </h2>
        {dayEntries.length > 1 && (
          <span className="ritmo-glass-pill rounded-full px-2.5 py-1 text-xs font-semibold text-ritmo-ink-soft">
            {dayEntries.length} treinos
          </span>
        )}
      </div>

      {dayEntries.length === 0 ? (
        <section className="ritmo-card rounded-2xl p-4 text-center">
          <div className="ritmo-glass-pill mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full text-ritmo-ink-soft">
            <NotebookPen size={20} />
          </div>
          <p className="text-sm text-ritmo-muted">
            {isToday
              ? "Como foi seu treino hoje? Registre o que você fez e como se sentiu."
              : "Nenhum treino registrado nesse dia."}
          </p>
          <button
            type="button"
            onClick={() => onAdd(selectedDate)}
            className="ritmo-cta mx-auto mt-3 flex min-h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
          >
            <Plus size={14} />
            {isToday ? "Registrar treino de hoje" : "Registrar nesse dia"}
          </button>
        </section>
      ) : (
        <>
          <div className="space-y-2">
            {dayEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
          {/* Treinei superiores de manhã e corri à noite: cada um vira uma linha. */}
          <button
            type="button"
            onClick={() => onAdd(selectedDate)}
            className="ritmo-ghost mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-ritmo-ink-soft"
          >
            <Plus size={14} />
            Adicionar outro treino nesse dia
          </button>
        </>
      )}
    </div>
  );
}

export default JournalTab;

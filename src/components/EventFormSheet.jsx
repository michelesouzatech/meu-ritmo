import { useState } from "react";
import { Clock, Repeat, Trash2 } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { toISODate, daysBetween } from "../lib/date.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function timeOf(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Compromisso novo começa na próxima hora cheia e dura 1 hora.
function defaultTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return { startTime: timeOf(start), endTime: timeOf(end) };
}

// `startTime` chega quando a pessoa tocou direto num horário da grade da semana.
function initialForm(event, dateISO, startTime) {
  if (!event) {
    const hour = Number(startTime?.slice(0, 2));
    const times = startTime
      ? { startTime, endTime: hour >= 23 ? "23:59" : `${pad(hour + 1)}:00` }
      : defaultTimes();
    return { title: "", date: dateISO, allDay: false, location: "", ...times };
  }

  const startISO = toISODate(event.start);
  return {
    title: event.title === "(sem título)" ? "" : event.title,
    date: startISO,
    allDay: event.allDay,
    location: event.location ?? "",
    startTime: event.allDay ? defaultTimes().startTime : timeOf(event.start),
    endTime: event.allDay ? defaultTimes().endTime : timeOf(event.end),
  };
}

// Quantos dias o compromisso ocupa, pra não encolher um evento de vários dias.
function spanOf(event) {
  if (!event) return { days: 1, endDayOffset: 0 };
  const startISO = toISODate(event.start);
  if (event.allDay) {
    return { days: Math.max(1, daysBetween(startISO, toISODate(event.end))), endDayOffset: 0 };
  }
  return { days: 1, endDayOffset: Math.max(0, daysBetween(startISO, toISODate(event.end))) };
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ritmo-text/70">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ritmo-text/45">{hint}</p>}
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink disabled:opacity-60";

function EventFormSheet({ event, dateISO, startTime, onClose, onCreate, onUpdate, onDelete }) {
  const isEditing = !!event;
  // Agendas de leitura (aniversários, feriados, agenda de outra pessoa) só mudam no Google.
  const readOnly = isEditing && event.editable === false;
  const [form, setForm] = useState(() => initialForm(event, dateISO, startTime));
  const [busy, setBusy] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Dê um nome pro compromisso.");
      return;
    }
    if (!form.date) {
      setError("Escolha a data do compromisso.");
      return;
    }
    const span = spanOf(event);
    if (!form.allDay && span.endDayOffset === 0 && form.endTime <= form.startTime) {
      setError("O horário de término precisa ser depois do de início.");
      return;
    }

    setError(null);
    setBusy("saving");
    const payload = {
      title: form.title,
      dateISO: form.date,
      allDay: form.allDay,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      ...span,
    };

    try {
      if (isEditing) {
        await onUpdate({ id: event.rawId, calendarId: event.calendarId }, payload);
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Não deu pra salvar agora. Tenta de novo.");
      setBusy(null);
    }
  }

  async function handleDelete() {
    setError(null);
    setBusy("deleting");
    try {
      await onDelete({ id: event.rawId, calendarId: event.calendarId });
      onClose();
    } catch (deleteError) {
      setError(deleteError.message || "Não deu pra excluir agora. Tenta de novo.");
      setBusy(null);
    }
  }

  return (
    <Sheet title={isEditing ? "Editar compromisso" : "Novo compromisso"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditing && event.calendarName && (
          <p className="flex items-center gap-2 text-xs text-ritmo-text/50">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: event.color ?? "var(--color-ritmo-pink)" }}
              aria-hidden
            />
            Agenda: {event.calendarName}
          </p>
        )}

        <Field label="Título">
          <input
            autoFocus={!isEditing}
            disabled={readOnly}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex: Consulta médica"
            className={inputClass}
          />
        </Field>

        <Field label="Data">
          <input
            type="date"
            disabled={readOnly}
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={inputClass}
          />
        </Field>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={form.allDay}
            onChange={(e) => set("allDay", e.target.checked)}
            className="peer sr-only"
          />
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ritmo-pink transition-colors peer-checked:bg-ritmo-pink"
            aria-hidden
          >
            <Clock
              size={12}
              strokeWidth={3}
              className={form.allDay ? "text-white" : "text-transparent"}
            />
          </span>
          <span className="text-sm text-ritmo-text">Dia todo (sem horário)</span>
        </label>

        {!form.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <input
                type="time"
                disabled={readOnly}
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Término">
              <input
                type="time"
                disabled={readOnly}
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <Field label="Local (opcional)">
          <input
            disabled={readOnly}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ex: Clínica São Lucas"
            className={inputClass}
          />
        </Field>

        {event?.recurring && (
          <p className="flex items-start gap-2 rounded-xl bg-ritmo-pink-tint px-3 py-2 text-xs text-ritmo-text/60">
            <Repeat size={14} className="mt-0.5 shrink-0" />
            Esse compromisso se repete. O que você mudar aqui vale só para este dia.
          </p>
        )}

        {error && <p className="text-xs text-ritmo-pink-deep">{error}</p>}

        {readOnly ? (
          <p className="rounded-xl bg-ritmo-pink-tint px-3 py-2 text-xs text-ritmo-text/60">
            Essa agenda é só de leitura pra você — dá pra ver o compromisso aqui, mas alterar
            só no Google Agenda.
          </p>
        ) : (
          <button
            type="submit"
            disabled={!!busy}
            className="min-h-11 w-full rounded-full bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "saving"
              ? "Salvando..."
              : isEditing
                ? "Salvar alterações"
                : "Criar compromisso"}
          </button>
        )}
      </form>

      {isEditing &&
        !readOnly &&
        (confirmingDelete ? (
          <div className="mt-3 rounded-xl bg-ritmo-pink-tint p-3 text-center">
            <p className="text-sm text-ritmo-text">
              Excluir "{event.title}" da sua Google Agenda?
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={!!busy}
                className="min-h-11 flex-1 rounded-full bg-white text-sm font-semibold text-ritmo-text/70 transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!busy}
                className="min-h-11 flex-1 rounded-full bg-ritmo-pink-deep text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "deleting" ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={!!busy}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light/60 disabled:opacity-60"
          >
            <Trash2 size={16} />
            Excluir compromisso
          </button>
        ))}
    </Sheet>
  );
}

export default EventFormSheet;

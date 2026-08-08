import { useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import AddButton from "../components/AddButton.jsx";
import SwipeToDelete from "../components/SwipeToDelete.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import { todayISO, formatDatePtBr } from "../lib/date.js";
import { buildTaskInsights } from "../lib/insights.js";

export function TaskFormSheet({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [urgent, setUrgent] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), date: date || null, note: note.trim(), urgent });
    onClose();
  }

  return (
    <Sheet title="Nova tarefa" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Título
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Responder e-mails"
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Data (opcional)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ritmo-field min-h-11 w-full rounded-xl px-3 text-sm"
          />
          <p className="mt-1 text-xs text-ritmo-text/45">
            Deixe em branco para anotar sem uma data definida.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Observação (opcional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="ritmo-field w-full rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <label className="ritmo-field flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ritmo-line transition-colors peer-checked:border-ritmo-pink-deep peer-checked:bg-ritmo-pink-deep"
            aria-hidden
          >
            <AlertTriangle
              size={12}
              strokeWidth={3}
              className={urgent ? "text-white" : "text-transparent"}
            />
          </span>
          <span className="text-sm text-ritmo-text">Marcar como urgente</span>
        </label>
        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          Salvar tarefa
        </button>
      </form>
    </Sheet>
  );
}

function TaskItem({ task, onToggle, onDelete }) {
  const isOverdue = !task.done && !!task.date && task.date < todayISO();

  return (
    <SwipeToDelete onDelete={() => onDelete(task.id)} deleteLabel="Excluir tarefa">
      <div className="ritmo-card flex items-center gap-2 p-4">
        <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={task.done}
            onChange={() => onToggle(task.id)}
            className="peer sr-only"
          />
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ritmo-line transition-colors peer-checked:border-ritmo-pink-deep peer-checked:bg-ritmo-pink-deep"
            aria-hidden
          >
            <Check
              size={12}
              strokeWidth={3}
              className={task.done ? "text-white" : "text-transparent"}
            />
          </span>
          {task.urgent && !task.done && (
            <AlertTriangle size={16} className="shrink-0 text-ritmo-pink" aria-label="Urgente" />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-sm text-ritmo-text ${task.done ? "text-ritmo-text/40 line-through" : ""}`}
            >
              {task.title}
            </p>
            {task.note && <p className="truncate text-xs text-ritmo-muted">{task.note}</p>}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
              isOverdue
                ? "bg-ritmo-pink-light text-ritmo-pink-deep"
                : "ritmo-glass-pill text-ritmo-ink-soft"
            }`}
          >
            {isOverdue
              ? "atrasada"
              : task.date
                ? formatDatePtBr(task.date)
                : "sem data"}
          </span>
        </label>
      </div>
    </SwipeToDelete>
  );
}

function TasksScreen({ tasks, ai = [], aiStatus, onToggle, onDelete, onAdd }) {
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  const done = tasks.filter((t) => t.done);
  const insights = useMemo(() => buildTaskInsights(tasks), [tasks]);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">
            Tarefas
          </h1>
          <p className="mt-1 text-sm text-ritmo-muted">
            {pending.length === 0
              ? "Nenhuma tarefa pendente"
              : `${pending.length} pendente${pending.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <AddButton label="Nova" onClick={onAdd} />
      </header>

      {tasks.length === 0 && (
        <p className="ritmo-card rounded-2xl p-4 text-center text-sm text-ritmo-muted">
          Toque no botão + para adicionar sua primeira tarefa.
        </p>
      )}

      <InsightsPanel items={insights} ai={ai} aiStatus={aiStatus} className="mb-4" />

      {pending.length > 0 && (
        <div className="mb-6 space-y-3">
          {pending.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mb-3 text-base font-semibold text-ritmo-muted">Concluídas</h2>
          <div className="space-y-3">
            {done.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default TasksScreen;

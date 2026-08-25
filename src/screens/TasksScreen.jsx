import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Pencil } from "lucide-react";
import Sheet from "../components/Sheet.jsx";
import AddButton from "../components/AddButton.jsx";
import SwipeToDelete from "../components/SwipeToDelete.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import { todayISO, formatDatePtBr } from "../lib/date.js";
import { buildTaskInsights } from "../lib/insights.js";

export function TaskFormSheet({ task, onClose, onSave }) {
  const isEditing = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [date, setDate] = useState(task?.date ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [urgent, setUrgent] = useState(!!task?.urgent);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), date: date || null, note: note.trim(), urgent });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar tarefa" : "Nova tarefa"} onClose={onClose}>
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
          {isEditing ? "Salvar alterações" : "Salvar tarefa"}
        </button>
      </form>
    </Sheet>
  );
}

function TaskItem({ task, onToggle, onDelete, onEdit }) {
  const isOverdue = !task.done && !!task.date && task.date < todayISO();

  return (
    <SwipeToDelete onDelete={() => onDelete(task.id)} deleteLabel="Excluir tarefa">
      <div className="ritmo-card flex items-center gap-2 p-4">
        {/* Só o que marca a tarefa fica dentro do label — o lápis aqui dentro
            marcaria a tarefa como feita a cada toque. */}
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
        </label>
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
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
          aria-label="Editar tarefa"
        >
          <Pencil size={15} />
        </button>
      </div>
    </SwipeToDelete>
  );
}

// As concluídas ficam guardadas atrás de um menu que abre.
//
// Elas cresciam pra sempre embaixo das pendentes: depois de algumas semanas, a
// tela de tarefas era uma lista de coisas já feitas com as pendentes espremidas
// no topo. O que importa aqui é o que falta — o resto é arquivo, e arquivo abre
// quando ela quiser.
//
// Começa fechado, e o contador no cabeçalho é o que evita que a seção pareça
// vazia quando está.
function DoneTasksSection({ tasks, onToggle, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="ritmo-card flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl p-4 text-left"
      >
        <span className="text-base font-semibold text-ritmo-text">Concluídas</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="ritmo-glass-pill rounded-full px-2.5 py-1 text-xs font-semibold text-ritmo-ink-soft">
            {tasks.length}
          </span>
          <ChevronDown
            size={16}
            className={`text-ritmo-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TasksScreen({ tasks, onToggle, onDelete, onEdit, onAdd }) {
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
  // Da mais recente pra mais antiga: virou arquivo, e arquivo se lê de cima.
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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

      <InsightsPanel items={insights} className="mb-4" />

      {pending.length > 0 && (
        <div className="mb-6 space-y-3">
          {pending.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <DoneTasksSection
          tasks={done}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}

export default TasksScreen;

import { useState } from "react";
import {
  Plus,
  Trash2,
  Upload,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ChevronDown,
  GripVertical,
} from "lucide-react";
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
import SwipeToDelete from "../components/SwipeToDelete.jsx";
import { todayISO, daysBetween, formatDatePtBr } from "../lib/date.js";

export function ExerciseFormSheet({ onClose, onSave, groups }) {
  const [group, setGroup] = useState("");
  const [name, setName] = useState("");
  const [setsReps, setSetsReps] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !group.trim()) return;
    onSave({
      group: group.trim(),
      name: name.trim(),
      setsReps: setsReps.trim(),
    });
    onClose();
  }

  return (
    <Sheet title="Novo exercício" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Grupo / dia
          </label>
          <input
            autoFocus
            list="workout-groups"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Ex: Treino A – Foco em Costas e Bíceps"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
          <datalist id="workout-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Exercício
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Puxada frente pronada"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Séries x reps
          </label>
          <input
            value={setsReps}
            onChange={(e) => setSetsReps(e.target.value)}
            placeholder="Ex: 4x12 ou 3x1 min"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 w-full rounded-full bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98]"
        >
          Adicionar exercício
        </button>
      </form>
    </Sheet>
  );
}

export function CargaSheet({ exercise, onClose, onAdd, onDelete }) {
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!weight.trim()) return;
    onAdd({ date, weight: weight.trim() });
    setWeight("");
  }

  const sorted = [...exercise.cargaLogs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet title={`Carga — ${exercise.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-ritmo-text/70">
            Data
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-ritmo-text/70">
            Carga
          </label>
          <input
            autoFocus
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Ex: 25kg"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <button
          type="submit"
          aria-label="Adicionar registro"
          className="flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink px-3 text-white"
        >
          <Plus size={18} />
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="text-center text-sm text-ritmo-text/50">
          Nenhum registro ainda.
        </p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {sorted.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-xl bg-ritmo-bg px-3 py-2"
            >
              <span className="text-sm text-ritmo-text">{log.weight}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ritmo-text/45">
                  {formatDatePtBr(log.date)}
                </span>
                <button
                  type="button"
                  aria-label="Excluir registro"
                  onClick={() => onDelete(log.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export function BodyFatFormSheet({ onClose, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [percent, setPercent] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!percent) return;
    onSave({ date, percent: Number(percent) });
    onClose();
  }

  return (
    <Sheet title="Registrar % de gordura" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            Mês / data
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ritmo-text/70">
            % de gordura
          </label>
          <input
            autoFocus
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="Ex: 22.5"
            className="min-h-11 w-full rounded-xl border border-ritmo-pink-light bg-ritmo-bg px-3 text-sm text-ritmo-text outline-none focus:border-ritmo-pink"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 w-full rounded-full bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98]"
        >
          Salvar medição
        </button>
      </form>
    </Sheet>
  );
}

export function ImportReviewSheet({ groups: initialGroups, onClose, onConfirm }) {
  const [groups, setGroups] = useState(initialGroups);

  function updateRow(gi, ri, field, value) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i !== gi
          ? g
          : { ...g, rows: g.rows.map((r, j) => (j !== ri ? r : { ...r, [field]: value })) },
      ),
    );
  }

  function updateTitle(gi, value) {
    setGroups((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, title: value })));
  }

  function removeRow(gi, ri) {
    setGroups((prev) =>
      prev.map((g, i) => (i !== gi ? g : { ...g, rows: g.rows.filter((_, j) => j !== ri) })),
    );
  }

  function removeGroup(gi) {
    setGroups((prev) => prev.filter((_, i) => i !== gi));
  }

  function handleConfirm() {
    const cleaned = groups
      .map((g) => ({ title: g.title.trim(), rows: g.rows.filter((r) => r.name.trim()) }))
      .filter((g) => g.title && g.rows.length > 0);
    onConfirm(cleaned);
    onClose();
  }

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <Sheet title="Revisar treino importado" onClose={onClose}>
      <p className="mb-3 text-xs text-ritmo-text/50">
        Confira se ficou certo antes de salvar — {totalRows} exercício
        {totalRows === 1 ? "" : "s"} encontrado{totalRows === 1 ? "" : "s"}.
        Ajuste ou remova o que precisar.{" "}
        <strong className="text-ritmo-pink-deep">
          Isso vai substituir o treino atual
        </strong>{" "}
        pelos exercícios abaixo.
      </p>
      <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
        {groups.map((group, gi) => (
          <div key={gi} className="rounded-xl border border-ritmo-pink-light/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={group.title}
                onChange={(e) => updateTitle(gi, e.target.value)}
                className="min-h-9 flex-1 rounded-lg border border-ritmo-pink-light bg-ritmo-bg px-2 text-sm font-medium text-ritmo-text outline-none focus:border-ritmo-pink"
              />
              <button
                type="button"
                aria-label="Remover grupo"
                onClick={() => removeGroup(gi)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {group.rows.map((row, ri) => (
                <div
                  key={ri}
                  className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-ritmo-bg p-2"
                >
                  <div className="space-y-1">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(gi, ri, "name", e.target.value)}
                      placeholder="Exercício"
                      className="min-h-8 w-full rounded-md border border-ritmo-pink-light bg-white px-2 text-xs text-ritmo-text outline-none focus:border-ritmo-pink"
                    />
                    <div className="flex gap-1">
                      <input
                        value={row.setsReps}
                        onChange={(e) => updateRow(gi, ri, "setsReps", e.target.value)}
                        placeholder="Séries x reps"
                        className="min-h-8 w-1/2 rounded-md border border-ritmo-pink-light bg-white px-2 text-xs text-ritmo-text outline-none focus:border-ritmo-pink"
                      />
                      <input
                        value={row.weight}
                        onChange={(e) => updateRow(gi, ri, "weight", e.target.value)}
                        placeholder="Carga"
                        className="min-h-8 w-1/2 rounded-md border border-ritmo-pink-light bg-white px-2 text-xs text-ritmo-text outline-none focus:border-ritmo-pink"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover exercício"
                    onClick={() => removeRow(gi, ri)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        className="mt-4 min-h-11 w-full rounded-full bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink text-sm font-semibold text-white shadow-md shadow-ritmo-pink/30 transition-transform active:scale-[0.98]"
      >
        Salvar treino importado
      </button>
    </Sheet>
  );
}

function ExerciseItem({ exercise, onOpenCarga, onUpdate, onDelete }) {
  const sorted = [...exercise.cargaLogs].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  return (
    <div className="rounded-xl border border-ritmo-pink-light/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <input
          value={exercise.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ritmo-pink-deep underline decoration-ritmo-pink-light decoration-2 underline-offset-2 outline-none focus:decoration-ritmo-pink"
        />
        <button
          type="button"
          aria-label="Excluir exercício"
          onClick={onDelete}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={exercise.setsReps}
          onChange={(e) => onUpdate({ setsReps: e.target.value })}
          placeholder="Séries x reps"
          className="min-h-8 min-w-0 flex-1 rounded-lg border border-ritmo-pink-light bg-ritmo-bg px-2 text-xs text-ritmo-text outline-none focus:border-ritmo-pink"
        />
        <button
          type="button"
          onClick={onOpenCarga}
          className="flex min-h-8 max-w-[40%] shrink-0 items-center justify-center truncate whitespace-nowrap rounded-full bg-ritmo-pink-tint px-3 text-xs font-medium text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light"
        >
          {latest ? latest.weight : "+ carga"}
        </button>
      </div>
    </div>
  );
}

function SortableExerciseItem({ exercise, onOpenCarga, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: exercise.id });

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
        <ExerciseItem
          exercise={exercise}
          onOpenCarga={onOpenCarga}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function WorkoutGroupCard({
  group,
  exercises,
  onOpenCarga,
  onUpdateExercise,
  onDeleteExercise,
  onReorder,
  defaultOpen,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = exercises.map((e) => e.id);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    onReorder(group, arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm shadow-ritmo-text/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl p-4 text-left"
      >
        <span className="text-sm font-semibold text-ritmo-pink-deep">{group}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-ritmo-text/40">
          {exercises.length} exercício{exercises.length > 1 ? "s" : ""}
          <ChevronDown
            size={16}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-1 px-2 pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exercises.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {exercises.map((exercise) => (
                <SortableExerciseItem
                  key={exercise.id}
                  exercise={exercise}
                  onOpenCarga={() => onOpenCarga(exercise.id)}
                  onUpdate={(data) => onUpdateExercise(exercise.id, data)}
                  onDelete={() => onDeleteExercise(exercise.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function CargaHistoryDropdown({ exercises }) {
  const [open, setOpen] = useState(false);
  const withHistory = exercises.filter((e) => e.cargaLogs.length > 0);

  return (
    <div className="relative mb-4 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ritmo-text shadow-sm shadow-ritmo-text/5"
      >
        Histórico de carga
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar histórico"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full z-50 mt-2 max-h-80 w-[300px] max-w-[calc(100vw-2.5rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl shadow-ritmo-text/15">
            {withHistory.length === 0 ? (
              <p className="text-center text-sm text-ritmo-text/50">
                Nenhum registro de carga ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {withHistory.map((exercise) => {
                  const sorted = [...exercise.cargaLogs].sort((a, b) =>
                    b.date.localeCompare(a.date),
                  );
                  return (
                    <div key={exercise.id}>
                      <p className="mb-1 text-xs font-semibold text-ritmo-pink-deep">
                        {exercise.name}
                      </p>
                      <div className="space-y-1">
                        {sorted.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between text-xs text-ritmo-text/70"
                          >
                            <span>{log.weight}</span>
                            <span className="text-ritmo-text/40">
                              {formatDatePtBr(log.date)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function WorkoutScreen({
  workout,
  bodyFat,
  onAddExercise,
  onUpdateExercise,
  onDeleteExercise,
  onOpenCarga,
  onSetPhoto,
  onNewCycle,
  onAddBodyFat,
  onDeleteBodyFat,
  onImportParsed,
  onReorderExercises,
}) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(false);

  const { exercises, createdAt, photoName, photoDataUrl } = workout;
  const groups = [...new Set(exercises.map((e) => e.group))];
  const exercisesByGroup = groups.reduce((acc, g) => {
    acc[g] = exercises.filter((e) => e.group === g);
    return acc;
  }, {});

  const daysSinceSetup = createdAt ? daysBetween(createdAt, todayISO()) : null;
  const needsUpdate = daysSinceSetup !== null && daysSinceSetup >= 90;

  const sortedBodyFat = [...bodyFat].sort((a, b) => a.date.localeCompare(b.date));
  const bodyFatDesc = [...sortedBodyFat].reverse();

  // O arquivo pode vir como imagem carregada na hora ou como link salvo no banco.
  function isImageFile(url, name) {
    if (url?.startsWith("data:image")) return true;
    return /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name ?? "");
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportError(false);

    const reader = new FileReader();
    reader.onload = () => onSetPhoto({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);

    if (file.type === "application/pdf") {
      setImporting(true);
      try {
        const { extractWorkoutFromPdf } = await import("../lib/pdfParse.js");
        const parsedGroups = await extractWorkoutFromPdf(file);
        setImporting(false);
        if (parsedGroups.length === 0) {
          setImportError(true);
        } else {
          onImportParsed(parsedGroups);
        }
      } catch {
        setImporting(false);
        setImportError(true);
      }
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">
            Treino
          </h1>
          <p className="mt-1 text-sm text-ritmo-text/60">
            {exercises.length === 0
              ? "Nenhum exercício cadastrado"
              : `${exercises.length} exercício${exercises.length > 1 ? "s" : ""} cadastrado${exercises.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <AddButton label="Exercício" onClick={onAddExercise} />
      </header>

      {needsUpdate && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-ritmo-pink-deep/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-ritmo-pink-deep" />
          <div>
            <p className="text-sm font-medium text-ritmo-pink-deep">
              Hora de trocar de treino?
            </p>
            <p className="mt-0.5 text-xs text-ritmo-pink-deep/80">
              Já se passaram 3 meses desde que você cadastrou esse treino. Que
              tal pedir um novo pro seu personal?
            </p>
            <button
              type="button"
              onClick={onNewCycle}
              className="mt-2 text-xs font-semibold text-ritmo-pink-deep underline"
            >
              Cadastrei um treino novo
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm shadow-ritmo-text/5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ritmo-text">
              Foto ou PDF do treino
            </p>
            <p className="mt-0.5 truncate text-xs text-ritmo-text/50">
              {photoName ?? "Nenhum arquivo enviado ainda"}
            </p>
          </div>
          <label className="flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-ritmo-pink-light/70 px-3 text-xs font-medium text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light">
            <Upload size={14} />
            Enviar
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {importing && (
          <p className="mt-3 flex items-center gap-2 text-xs text-ritmo-pink-deep">
            <Loader2 size={14} className="animate-spin" />
            Lendo o PDF e organizando por grupo...
          </p>
        )}

        {importError && (
          <p className="mt-3 text-xs text-ritmo-pink-deep">
            Não consegui identificar a tabela automaticamente nesse arquivo.
            Cadastre os exercícios manualmente pelo botão "Exercício" — ou
            tente um PDF com texto selecionável (não uma foto escaneada).
          </p>
        )}

        {photoDataUrl && (
          <div className="mt-3">
            {isImageFile(photoDataUrl, photoName) ? (
              <img
                src={photoDataUrl}
                alt="Treino enviado"
                className="max-h-48 w-full rounded-xl object-cover"
              />
            ) : (
              <a
                href={photoDataUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-ritmo-bg px-3 py-2 text-xs text-ritmo-pink-deep"
              >
                <FileText size={14} /> Abrir arquivo enviado
              </a>
            )}
            <button
              type="button"
              onClick={() => onSetPhoto(null)}
              className="mt-2 text-xs text-ritmo-text/40 underline"
            >
              Remover arquivo
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ritmo-text/40">
          PDFs com texto selecionável são organizados automaticamente por
          grupo/dia — você revisa antes de salvar. Fotos ficam só como
          referência; o cadastro nesse caso é manual.
        </p>
      </div>

      {exercises.length === 0 ? (
        <p className="mb-6 rounded-2xl bg-white p-4 text-center text-sm text-ritmo-text/50 shadow-sm shadow-ritmo-text/5">
          Toque em "Exercício" ou envie o PDF do treino pra começar.
        </p>
      ) : (
        <div className="mb-4 space-y-3">
          {groups.map((group) => (
            <WorkoutGroupCard
              key={group}
              group={group}
              exercises={exercisesByGroup[group]}
              onOpenCarga={onOpenCarga}
              onUpdateExercise={onUpdateExercise}
              onDeleteExercise={onDeleteExercise}
              onReorder={onReorderExercises}
              defaultOpen={groups.length === 1}
            />
          ))}
        </div>
      )}

      {exercises.length > 0 && <CargaHistoryDropdown exercises={exercises} />}

      <section>
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ritmo-text">
              % de gordura
            </h2>
            <p className="text-xs text-ritmo-text/50">Acompanhamento mensal</p>
          </div>
          <AddButton label="Medição" onClick={onAddBodyFat} />
        </header>

        {bodyFatDesc.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-center text-sm text-ritmo-text/50 shadow-sm shadow-ritmo-text/5">
            Nenhuma medição registrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {bodyFatDesc.map((entry, idx) => {
              const prev = bodyFatDesc[idx + 1];
              const diff = prev ? entry.percent - prev.percent : null;
              return (
                <SwipeToDelete
                  key={entry.id}
                  onDelete={() => onDeleteBodyFat(entry.id)}
                  deleteLabel="Excluir medição"
                >
                  <div className="flex items-center justify-between gap-3 bg-white p-3 shadow-sm shadow-ritmo-text/5">
                    <div>
                      <p className="text-sm font-medium text-ritmo-text">
                        {entry.percent}%
                      </p>
                      <p className="text-xs text-ritmo-text/45">
                        {formatDatePtBr(entry.date)}
                      </p>
                    </div>
                    {diff !== null && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-ritmo-text/50">
                        {diff > 0 ? (
                          <TrendingUp size={13} />
                        ) : diff < 0 ? (
                          <TrendingDown size={13} />
                        ) : (
                          <Minus size={13} />
                        )}
                        {diff !== 0 ? `${Math.abs(diff).toFixed(1)}%` : "="}
                      </span>
                    )}
                  </div>
                </SwipeToDelete>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default WorkoutScreen;

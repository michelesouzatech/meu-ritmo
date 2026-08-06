import HabitRing from "./HabitRing.jsx";

function DayHabitsRing({ done, total }) {
  const percent = total > 0 ? done / total : 0;
  const pct = Math.round(percent * 100);
  const plural = total !== 1;

  return (
    <div className="ritmo-glass mb-6 flex items-center gap-4 rounded-2xl p-4">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
        <HabitRing progress={percent} size={96} stroke={10} />
        <span className="absolute text-lg font-semibold text-ritmo-pink-deep">{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ritmo-text">Progresso do dia</p>
        <p className="mt-0.5 text-xs text-ritmo-muted">
          {total === 0
            ? "Nenhum hábito ativo"
            : `${done} de ${total} hábito${plural ? "s" : ""} concluído${plural ? "s" : ""} hoje`}
        </p>
      </div>
    </div>
  );
}

export default DayHabitsRing;

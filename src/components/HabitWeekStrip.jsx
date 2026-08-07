import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { habitDayColor, HABIT_DAY_INK } from "../lib/habitColor.js";
import { toISODate, todayISO } from "../lib/date.js";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function HabitWeekStrip({ habits, selectedDate, onSelectDate }) {
  const today = todayISO();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const isCurrentWeek = toISODate(startOfWeek(new Date())) === toISODate(weekStart);

  function goToWeek(offset) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offset * 7);
    setWeekStart(next);
  }

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToWeek(-1)}
          aria-label="Semana anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-xs font-medium text-ritmo-muted">
          {isCurrentWeek ? "Esta semana" : "Voltar pra esta semana"}
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="ml-1 font-semibold text-ritmo-pink underline-offset-2 hover:underline"
            >
              hoje
            </button>
          )}
        </p>
        <button
          type="button"
          onClick={() => goToWeek(1)}
          disabled={isCurrentWeek}
          aria-label="Próxima semana"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = toISODate(d);
          const count = habits.reduce(
            (acc, h) => acc + (h.completions.includes(iso) ? 1 : 0),
            0,
          );
          const bg = habitDayColor(count, habits.length);
          const isFuture = iso > today;
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const isComplete = habits.length > 0 && count === habits.length;

          return (
            <div key={iso} className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-medium text-ritmo-muted">
                {WEEKDAY_LABELS[d.getDay()]}
              </span>
              <button
                type="button"
                disabled={isFuture}
                onClick={() => onSelectDate(iso)}
                aria-label={`Selecionar dia ${d.getDate()}`}
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-transform disabled:opacity-30 enabled:hover:scale-105"
                style={{
                  backgroundColor: bg ?? "transparent",
                  color: bg ? HABIT_DAY_INK : "var(--color-ritmo-text)",
                  border: isSelected
                    ? "2px solid var(--color-ritmo-pink-deep)"
                    : isToday
                      ? "1.5px solid var(--color-ritmo-pink)"
                      : "1.5px solid var(--color-ritmo-line)",
                }}
              >
                {isComplete ? <Check size={16} strokeWidth={3} /> : d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HabitWeekStrip;

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthGrid } from "../lib/calendarGrid.js";
import { habitDayColor } from "../lib/habitColor.js";
import { toISODate, todayISO } from "../lib/date.js";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function formatMonthLabel(date) {
  const text = MONTH_LABEL.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function HabitCalendar({ habits, selectedDate, onSelectDate }) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const completionsByDate = useMemo(() => {
    const map = new Map();
    for (const habit of habits) {
      for (const date of habit.completions) {
        if (!map.has(date)) map.set(date, []);
        map.get(date).push(habit.name);
      }
    }
    return map;
  }, [habits]);

  const selectedHabits = completionsByDate.get(selectedDate) ?? [];

  function goToMonth(offset) {
    setCursor(new Date(year, month + offset, 1));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          aria-label="Mês anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-lilac hover:text-ritmo-lilac-ink"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium text-ritmo-text">
          {formatMonthLabel(cursor)}
        </p>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label="Próximo mês"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-lilac hover:text-ritmo-lilac-ink"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-xs font-medium text-ritmo-muted">
            {label}
          </span>
        ))}

        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day === null) return <span key={`${wi}-${di}`} />;

            const iso = toISODate(new Date(year, month, day));
            const count = completionsByDate.get(iso)?.length ?? 0;
            const bg = habitDayColor(count, habits.length);
            const isToday = iso === today;
            const isSelected = iso === selectedDate;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDate(iso)}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-transform hover:scale-105"
                style={{
                  backgroundColor: bg ?? "transparent",
                  color: bg ? "#fff" : "var(--color-ritmo-text)",
                  border: isSelected
                    ? "2px solid var(--color-ritmo-pink-deep)"
                    : isToday
                      ? "1.5px solid var(--color-ritmo-pink)"
                      : "1.5px solid transparent",
                  opacity: bg ? 1 : 0.7,
                }}
              >
                {day}
              </button>
            );
          }),
        )}
      </div>

      <div className="ritmo-inset mt-4 rounded-2xl p-4">
        <p className="mb-2 text-sm font-medium text-ritmo-text">
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
          })}
        </p>
        {selectedHabits.length === 0 ? (
          <p className="text-xs text-ritmo-muted">Nenhum hábito marcado nesse dia.</p>
        ) : (
          <ul className="space-y-1">
            {selectedHabits.map((name, i) => (
              <li key={i} className="text-xs text-ritmo-text/70">
                • {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default HabitCalendar;

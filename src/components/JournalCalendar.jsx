import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthGrid } from "../lib/calendarGrid.js";
import { feelingByDate, feelingEmoji } from "../lib/journal.js";
import { toISODate, todayISO } from "../lib/date.js";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function formatMonthLabel(date) {
  const text = MONTH_LABEL.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Dia com registro mostra a carinha no lugar do número — mesmo padrão da faixa
// da semana dos hábitos, que troca o número por um check quando o dia fecha.
function JournalCalendar({ entries, selectedDate, onSelectDate }) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const byDate = useMemo(() => feelingByDate(entries), [entries]);

  function goToMonth(offset) {
    setCursor(new Date(year, month + offset, 1));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          aria-label="Mês anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium text-ritmo-text">{formatMonthLabel(cursor)}</p>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label="Próximo mês"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-xs font-medium text-ritmo-muted">
            {label}
          </span>
        ))}

        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day === null) return <span key={`${wi}-${di}`} />;

            const iso = toISODate(new Date(year, month, day));
            const feeling = byDate.get(iso) ?? null;
            const isToday = iso === today;
            const isSelected = iso === selectedDate;
            const isFuture = iso > today;

            return (
              <button
                key={iso}
                type="button"
                disabled={isFuture}
                onClick={() => onSelectDate(iso)}
                aria-label={`${day} — ${feeling ? "com registro" : "sem registro"}`}
                aria-current={isSelected ? "date" : undefined}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-transform disabled:opacity-25 enabled:hover:scale-105"
                style={{
                  backgroundColor: isSelected ? "var(--color-ritmo-hover)" : "transparent",
                  border: isSelected
                    ? "1.5px solid var(--color-ritmo-ink-soft)"
                    : isToday
                      ? "1.5px solid var(--color-ritmo-pink)"
                      : "1.5px solid transparent",
                  opacity: !feeling && !isFuture ? 0.65 : 1,
                }}
              >
                {feeling ? (
                  <span className="text-base leading-none">{feelingEmoji(feeling)}</span>
                ) : (
                  day
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

export default JournalCalendar;

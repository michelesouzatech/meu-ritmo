import { useState } from "react";
import { ChevronDown } from "lucide-react";
import HabitCalendar from "./HabitCalendar.jsx";
import { todayISO, formatDatePtBr } from "../lib/date.js";

// Botão com a data escolhida que abre um calendário do mês por cima —
// usado tanto em Hábitos quanto em Suplementos pra navegar o histórico.
function DateDropdown({ selectedDate, onSelectDate, habits, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const label = selectedDate === today ? "Hoje" : formatDatePtBr(selectedDate);

  return (
    <div className="relative mb-3 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ritmo-card flex min-h-9 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-ritmo-text"
      >
        {label}
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar calendário"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="ritmo-glass absolute left-0 top-full z-50 mt-2 w-[300px] max-w-[calc(100vw-2.5rem)] rounded-2xl p-4">
            <HabitCalendar
              habits={habits}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              {...(emptyLabel ? { emptyLabel } : {})}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default DateDropdown;

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCw,
  Repeat,
} from "lucide-react";
import { formatEventTime } from "../lib/googleCalendar.js";
import { buildMonthGrid } from "../lib/calendarGrid.js";
import { initialHour, layoutDay, weekDays, weekLabel } from "../lib/weekGrid.js";
import { addDays, toISODate } from "../lib/date.js";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const HOUR_HEIGHT = 44;
const DAY_HEIGHT = HOUR_HEIGHT * 24;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const VIEW_KEY = "meuritmo:agenda-view";

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DAY_LABEL = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "long",
});

function formatMonthLabel(dateISO) {
  const text = MONTH_LABEL.format(new Date(`${dateISO}T00:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDayLabel(dateISO) {
  const text = DAY_LABEL.format(new Date(`${dateISO}T00:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Cada agenda do Google tem sua cor; sem cor, cai no rosa do app. O texto fica
// escuro em cima do fundo clarinho pra continuar legível em qualquer cor.
function eventColors(event) {
  const color = event.color;
  return {
    line: color ?? "var(--color-ritmo-pink)",
    fill: color ? `${color}33` : "var(--color-ritmo-pink-light)",
  };
}

function readSavedView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "month" ? "month" : "week";
  } catch {
    return "week";
  }
}

// Relógio que anda de minuto em minuto, pra linha de "agora" não ficar parada.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function CardShell({ children, flush }) {
  return (
    <div className={`ritmo-card rounded-2xl ${flush ? "p-2" : "p-4"}`}>{children}</div>
  );
}

function ConnectPrompt({ isReconnect, onConnect }) {
  return (
    <CardShell>
      <div className="flex flex-col items-center text-center">
        <div className="ritmo-glass-pill mb-2 flex h-11 w-11 items-center justify-center rounded-full text-ritmo-ink-soft">
          <CalendarDays size={20} />
        </div>
        <p className="text-sm text-ritmo-muted">
          {isReconnect
            ? "A conexão com o Google expirou. Conecte de novo pra ver e mexer na sua agenda."
            : "Conecte sua Google Agenda pra ver e organizar seus compromissos aqui."}
        </p>
        <button
          type="button"
          onClick={onConnect}
          className="ritmo-cta mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <CalendarDays size={16} />
          {isReconnect ? "Reconectar Google Agenda" : "Conectar Google Agenda"}
        </button>
      </div>
    </CardShell>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="ritmo-inset flex rounded-full p-0.5">
      {[
        ["week", "Semana"],
        ["month", "Mês"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={view === value}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === value ? "ritmo-glass-pill text-ritmo-pink-deep" : "text-ritmo-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DayHeader({ dateISO, isToday, isSelected, onSelect }) {
  const date = new Date(`${dateISO}T00:00:00`);

  return (
    <button
      type="button"
      onClick={() => onSelect(dateISO)}
      className="flex flex-1 flex-col items-center gap-0.5 py-1"
      aria-current={isSelected ? "date" : undefined}
    >
      <span className="text-[9px] font-medium uppercase text-ritmo-text/40">
        {WEEKDAY_LABELS[date.getDay()]}
      </span>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
          isSelected
            ? "bg-ritmo-pink-deep text-white shadow-sm shadow-ritmo-text/10"
            : isToday
              ? "text-ritmo-pink-deep"
              : "text-ritmo-text/70"
        }`}
        style={isToday && !isSelected ? { border: "1.5px solid var(--color-ritmo-pink)" } : undefined}
      >
        {date.getDate()}
      </span>
    </button>
  );
}

function TaskChip({ task, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      title={`Tarefa: ${task.title}`}
      className={`block w-full truncate rounded bg-ritmo-text/10 px-1 py-0.5 text-left text-[9px] leading-tight text-ritmo-text/70 transition-opacity active:opacity-70 ${
        task.done ? "line-through opacity-50" : ""
      }`}
    >
      {task.done ? "✓ " : "○ "}
      {task.title}
    </button>
  );
}

function AllDayChip({ event, onOpen }) {
  const colors = eventColors(event);
  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      title={event.title}
      className="block w-full truncate rounded border-l-2 px-1 py-0.5 text-left text-[9px] leading-tight text-ritmo-text/80 transition-opacity active:opacity-70"
      style={{ backgroundColor: colors.fill, borderLeftColor: colors.line }}
    >
      {event.title}
    </button>
  );
}

function EventBlock({ block, onOpen }) {
  const { event, top, height, left, width } = block;
  const pixels = height * DAY_HEIGHT;
  const colors = eventColors(event);

  return (
    <button
      type="button"
      onClick={() => onOpen(event)}
      title={event.title}
      className="absolute overflow-hidden rounded border-l-2 px-1 py-0.5 text-left transition-opacity active:opacity-70"
      style={{
        top: `${top * DAY_HEIGHT}px`,
        height: `${pixels - 2}px`,
        left: `${left * 100}%`,
        width: `calc(${width * 100}% - 2px)`,
        backgroundColor: colors.fill,
        borderLeftColor: colors.line,
      }}
    >
      <span className="block truncate text-[9px] font-medium leading-tight text-ritmo-text/85">
        {event.title}
      </span>
      {pixels >= 34 && (
        <span className="block truncate text-[8px] leading-tight text-ritmo-text/55">
          {formatEventTime(event)}
        </span>
      )}
    </button>
  );
}

function WeekView({ days, events, tasks, today, focusDate, onSelect, onOpenEvent, onToggleTask, onNewEvent }) {
  const now = useNow();
  const scrollRef = useRef(null);
  const weekStart = days[0];

  const allDayByDate = useMemo(() => {
    const map = new Map(days.map((d) => [d, []]));
    for (const event of events) {
      if (event.allDay && map.has(event.dateISO)) {
        map.get(event.dateISO).push({ kind: "event", key: event.id, event });
      }
    }
    for (const task of tasks) {
      if (task.date && map.has(task.date)) {
        map.get(task.date).push({ kind: "task", key: task.id, task });
      }
    }
    return map;
  }, [days, events, tasks]);

  const layouts = useMemo(
    () => days.map((dateISO) => layoutDay(events, dateISO)),
    [days, events],
  );

  const hasAllDay = days.some((d) => allDayByDate.get(d).length > 0);

  // Abre a grade já na faixa de horário que interessa, sem a pessoa rolar.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = initialHour(days, events, new Date()) * HOUR_HEIGHT;
    // Só quando muda de semana — rolar sozinho a cada minuto seria irritante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const todayIndex = days.indexOf(today);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * DAY_HEIGHT;

  // Cria um compromisso na hora em que a pessoa tocou na coluna vazia.
  function handleColumnClick(dateISO, e) {
    const { top, height } = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - top) / height;
    const hour = Math.max(0, Math.min(23, Math.floor(ratio * 24)));
    onSelect(dateISO);
    onNewEvent(dateISO, `${String(hour).padStart(2, "0")}:00`);
  }

  return (
    <div>
      <div className="flex">
        <div className="w-7 shrink-0" />
        <div className="flex flex-1">
          {days.map((dateISO) => (
            <DayHeader
              key={dateISO}
              dateISO={dateISO}
              isToday={dateISO === today}
              isSelected={dateISO === focusDate}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      {hasAllDay && (
        <div className="flex border-t border-ritmo-line py-1">
          <span className="w-7 shrink-0 pr-1 text-right text-[8px] leading-4 text-ritmo-text/35">
            dia
          </span>
          <div className="flex flex-1">
            {days.map((dateISO) => (
              <div key={dateISO} className="flex-1 space-y-0.5 px-px">
                {allDayByDate.get(dateISO).map((item) =>
                  item.kind === "task" ? (
                    <TaskChip key={`t-${item.key}`} task={item.task} onToggle={onToggleTask} />
                  ) : (
                    <AllDayChip key={`e-${item.key}`} event={item.event} onOpen={onOpenEvent} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="relative max-h-72 overflow-y-auto border-t border-ritmo-line"
      >
        <div className="relative flex" style={{ height: `${DAY_HEIGHT}px` }}>
          <div className="relative w-7 shrink-0">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-1 text-[9px] leading-none text-ritmo-text/35"
                style={{ top: `${hour * HOUR_HEIGHT - 4}px` }}
              >
                {String(hour).padStart(2, "0")}
              </span>
            ))}
          </div>

          <div className="relative flex flex-1">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="pointer-events-none absolute inset-x-0 border-t border-ritmo-line"
                style={{ top: `${hour * HOUR_HEIGHT}px` }}
              />
            ))}

            {days.map((dateISO, index) => (
              <div key={dateISO} className="relative flex-1 border-l border-ritmo-line">
                <button
                  type="button"
                  onClick={(e) => handleColumnClick(dateISO, e)}
                  aria-label={`Novo compromisso em ${formatDayLabel(dateISO)}`}
                  className={`absolute inset-0 ${dateISO === focusDate ? "bg-ritmo-hover" : ""}`}
                />
                {layouts[index].map((block) => (
                  <EventBlock key={block.event.id} block={block} onOpen={onOpenEvent} />
                ))}
              </div>
            ))}

            {todayIndex !== -1 && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-red-500"
                style={{ top: `${nowTop}px` }}
              >
                <span
                  className="absolute -top-1 h-2 w-2 rounded-full bg-red-500"
                  style={{ left: `${(todayIndex / 7) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayCell({ dateISO, day, counts, isToday, isSelected, onSelect }) {
  const eventColorList = counts?.colors ?? [];
  const taskCount = counts?.tasks ?? 0;
  // Até 3 bolinhas: primeiro os compromissos (na cor da agenda), depois as tarefas.
  const dots = eventColorList.slice(0, 3).map((color) => color ?? "var(--color-ritmo-pink)");
  for (let i = 0; i < taskCount && dots.length < 3; i++) dots.push("rgba(36, 18, 32, 0.35)");
  const eventCount = eventColorList.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(dateISO)}
      aria-label={`${day}, ${eventCount} compromisso${eventCount === 1 ? "" : "s"} e ${taskCount} tarefa${taskCount === 1 ? "" : "s"}`}
      aria-current={isSelected ? "date" : undefined}
      className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors hover:bg-ritmo-hover"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
          isSelected
            ? "bg-ritmo-pink-deep text-white shadow-sm shadow-ritmo-text/10"
            : isToday
              ? "text-ritmo-pink-deep"
              : "text-ritmo-text/80"
        }`}
        style={
          isToday && !isSelected ? { border: "1.5px solid var(--color-ritmo-pink)" } : undefined
        }
      >
        {day}
      </span>
      <span className="flex h-1 items-center gap-0.5">
        {dots.map((color, i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
    </button>
  );
}

function MonthGrid({ focusDate, today, countByDate, onSelect }) {
  const cursor = new Date(`${focusDate}T00:00:00`);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <div className="grid grid-cols-7 text-center">
      {WEEKDAY_LABELS.map((label, i) => (
        <span key={i} className="pb-1 text-xs font-medium text-ritmo-text/40">
          {label}
        </span>
      ))}

      {weeks.map((week, wi) =>
        week.map((day, di) => {
          if (day === null) return <span key={`${wi}-${di}`} />;
          const dateISO = toISODate(new Date(year, month, day));
          return (
            <DayCell
              key={dateISO}
              dateISO={dateISO}
              day={day}
              counts={countByDate.get(dateISO)}
              isToday={dateISO === today}
              isSelected={dateISO === focusDate}
              onSelect={onSelect}
            />
          );
        }),
      )}
    </div>
  );
}

function EventRow({ event, isPast, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(event)}
        className={`flex w-full items-start gap-3 rounded-xl py-1 text-left transition-colors hover:bg-ritmo-hover ${
          isPast ? "opacity-45" : ""
        }`}
      >
        <span className="w-14 shrink-0 pt-0.5 text-xs font-semibold text-ritmo-ink-soft">
          {formatEventTime(event)}
        </span>
        <span
          className="min-w-0 flex-1 border-l-2 pl-3"
          style={{ borderLeftColor: eventColors(event).line }}
        >
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-ritmo-text">{event.title}</span>
            {event.recurring && (
              <Repeat size={12} className="shrink-0 text-ritmo-text/35" aria-label="Se repete" />
            )}
          </span>
          {event.location && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-ritmo-muted">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function TaskRow({ task, onToggle }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        className="flex w-full items-center gap-3 rounded-xl py-1 text-left transition-colors hover:bg-ritmo-hover"
      >
        <span className="w-14 shrink-0 text-xs font-medium text-ritmo-text/45">tarefa</span>
        <span className="min-w-0 flex-1 border-l-2 border-ritmo-text/15 pl-3">
          <span className="flex items-center gap-2">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-ritmo-pink ${
                task.done ? "bg-ritmo-pink-deep" : ""
              }`}
              aria-hidden
            >
              <Check
                size={10}
                strokeWidth={3}
                className={task.done ? "text-white" : "text-transparent"}
              />
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                task.done ? "text-ritmo-text/40 line-through" : "text-ritmo-text"
              }`}
            >
              {task.title}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

function AgendaCard({
  status,
  events,
  tasks,
  focusDate,
  today,
  onFocusDate,
  onConnect,
  onRefresh,
  onOpenEvent,
  onNewEvent,
  onToggleTask,
}) {
  const now = new Date();
  const isConnected = status === "ready";
  const [view, setView] = useState(readSavedView);

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Sem localStorage a visão só volta ao padrão na próxima abertura.
    }
  }

  const days = useMemo(() => weekDays(focusDate), [focusDate]);

  // Bolinhas da grade do mês: as cores das agendas dos compromissos + quantas tarefas.
  const countByDate = useMemo(() => {
    const map = new Map();
    const entry = (dateISO) => {
      const current = map.get(dateISO) ?? { colors: [], tasks: 0 };
      map.set(dateISO, current);
      return current;
    };
    for (const event of events) entry(event.dateISO).colors.push(event.color);
    for (const task of tasks) if (task.date) entry(task.date).tasks += 1;
    return map;
  }, [events, tasks]);

  const dayEvents = useMemo(
    () => events.filter((e) => e.dateISO === focusDate),
    [events, focusDate],
  );
  const dayTasks = useMemo(() => tasks.filter((t) => t.date === focusDate), [tasks, focusDate]);

  // Semana anda de 7 em 7 dias; mês mantém o mesmo dia, encolhendo quando o mês novo é mais curto.
  function goTo(offset) {
    if (view === "week") {
      onFocusDate(addDays(focusDate, offset * 7));
      return;
    }
    const current = new Date(`${focusDate}T00:00:00`);
    const target = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(current.getDate(), lastDay));
    onFocusDate(toISODate(target));
  }

  const counts = [];
  if (dayEvents.length > 0) {
    counts.push(`${dayEvents.length} compromisso${dayEvents.length === 1 ? "" : "s"}`);
  }
  if (dayTasks.length > 0) {
    counts.push(`${dayTasks.length} tarefa${dayTasks.length === 1 ? "" : "s"}`);
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ritmo-text">Agenda</h2>
        {isConnected && (
          <div className="flex items-center gap-1">
            {focusDate !== today && (
              <button
                type="button"
                onClick={() => onFocusDate(today)}
                className="min-h-11 rounded-full px-3 text-sm font-medium text-ritmo-ink-soft transition-colors hover:bg-ritmo-hover"
              >
                hoje
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Atualizar agenda"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}
      </div>

      {(status === "disconnected" || status === "expired") && (
        <ConnectPrompt isReconnect={status === "expired"} onConnect={onConnect} />
      )}

      {status === "loading" && (
        <CardShell>
          <p className="text-center text-sm text-ritmo-muted">Carregando sua agenda...</p>
        </CardShell>
      )}

      {status === "error" && (
        <CardShell>
          <p className="text-center text-sm text-ritmo-muted">
            Não deu pra carregar a agenda agora.
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ritmo-ink-soft transition-colors hover:bg-ritmo-hover"
          >
            <RefreshCw size={16} />
            Tentar de novo
          </button>
        </CardShell>
      )}

      {isConnected && (
        <CardShell flush>
          <div className="mb-1 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => goTo(-1)}
              aria-label={view === "week" ? "Semana anterior" : "Mês anterior"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="min-w-0 truncate text-sm font-semibold text-ritmo-text">
              {view === "week" ? weekLabel(focusDate) : formatMonthLabel(focusDate)}
            </p>
            <button
              type="button"
              onClick={() => goTo(1)}
              aria-label={view === "week" ? "Próxima semana" : "Próximo mês"}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 flex justify-center">
            <ViewToggle view={view} onChange={changeView} />
          </div>

          {view === "week" ? (
            <WeekView
              days={days}
              events={events}
              tasks={tasks}
              today={today}
              focusDate={focusDate}
              onSelect={onFocusDate}
              onOpenEvent={onOpenEvent}
              onToggleTask={onToggleTask}
              onNewEvent={onNewEvent}
            />
          ) : (
            <MonthGrid
              focusDate={focusDate}
              today={today}
              countByDate={countByDate}
              onSelect={onFocusDate}
            />
          )}

          <div className="mt-2 border-t border-ritmo-line px-2 pt-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-ritmo-text">
                {formatDayLabel(focusDate)}
              </p>
              {counts.length > 0 && (
                <span className="ritmo-glass-pill shrink-0 rounded-full px-2 py-1 text-xs font-medium text-ritmo-ink-soft">
                  {counts.join(" · ")}
                </span>
              )}
            </div>

            {dayEvents.length === 0 && dayTasks.length === 0 ? (
              <p className="py-2 text-center text-sm text-ritmo-muted">
                {focusDate === today
                  ? "Nada marcado pra hoje. Dia livre! 🎉"
                  : "Nada marcado nesse dia."}
              </p>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    isPast={focusDate === today && !event.allDay && event.end < now}
                    onOpen={onOpenEvent}
                  />
                ))}
                {dayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={onToggleTask} />
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => onNewEvent(focusDate)}
              className="ritmo-cta mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold"
            >
              <Plus size={16} />
              Novo compromisso
            </button>

            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-full text-xs font-medium text-ritmo-muted transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
            >
              Abrir no Google Agenda
              <ExternalLink size={12} />
            </a>
          </div>
        </CardShell>
      )}
    </section>
  );
}

export default AgendaCard;

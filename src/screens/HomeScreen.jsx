import { AlertTriangle, Bell, Check } from "lucide-react";
import DayHabitsRing from "../components/DayHabitsRing.jsx";
import AgendaCard from "../components/AgendaCard.jsx";
import { todayISO, daysBetween, addDays } from "../lib/date.js";
import { eventsOnDay } from "../lib/googleCalendar.js";
import { habitProgress } from "./HabitsScreen.jsx";
import { joinNamesCapped } from "../lib/text.js";

const NUMBER_WORDS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
function numberWord(n) {
  return NUMBER_WORDS[n] ?? String(n);
}

// Encurta o nome do hábito pra caber num resumo curto, tirando o que é
// duração ("30 min", "3x") ou reforço ("limpa", "certinho") do final —
// ex: "alimentação 100% limpa" -> "alimentação 100%", "cardio 30 min" -> "cardio".
const DURATION_UNITS = new Set([
  "min", "mins", "minuto", "minutos", "h", "hr", "hrs", "hora", "horas",
  "seg", "segs", "segundo", "segundos", "vez", "vezes",
  "kg", "kgs", "g", "gr", "gramas", "l", "lt", "litro", "litros", "km",
]);
const TRAILING_FILLERS = new Set([
  "limpa", "limpo", "saudável", "saudavel", "direitinho", "direitinha",
  "certinho", "certinha", "completo", "completa", "total", "extra",
  "direito", "certo", "certa",
]);
const CONNECTORS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "com", "em", "para", "pra", "no", "na", "nos", "nas",
]);

function shortHabitName(name, maxWords = 3) {
  let words = name.trim().split(/\s+/);

  if (words.length >= 2) {
    const last = words[words.length - 1].toLowerCase();
    const secondLast = words[words.length - 2];
    if (DURATION_UNITS.has(last) && /^\d+$/.test(secondLast)) {
      words = words.slice(0, -2);
    }
  }
  if (words.length >= 1 && /^\d+x$/i.test(words[words.length - 1])) {
    words = words.slice(0, -1);
  }
  if (words.length >= 2 && TRAILING_FILLERS.has(words[words.length - 1].toLowerCase())) {
    words = words.slice(0, -1);
  }

  if (words.length === 0) return name.trim();

  // não corta bem no meio de um conector solto ("de", "da"...): estica mais uma palavra
  let end = Math.min(maxWords, words.length);
  while (end < words.length && CONNECTORS.has(words[end - 1].toLowerCase())) {
    end++;
  }
  return words.slice(0, end).join(" ");
}

function agendaTodayLine(events, today) {
  const todayEvents = eventsOnDay(events, today);
  if (todayEvents.length === 0) return null;

  const now = new Date();
  const upcoming = todayEvents.filter((e) => e.allDay || e.end > now);
  if (upcoming.length === 0) return null;

  if (upcoming.length === todayEvents.length) {
    return `Hoje você tem ${todayEvents.length} compromisso${todayEvents.length === 1 ? "" : "s"}.`;
  }
  return `Você ainda tem ${numberWord(upcoming.length)} compromisso${upcoming.length === 1 ? "" : "s"} hoje, dá uma olhada na agenda pra não esquecer de nada.`;
}

function agendaTomorrowLine(events, today) {
  const tomorrowEvents = eventsOnDay(events, addDays(today, 1));
  if (tomorrowEvents.length === 0) return null;
  return `Não esquece que tem ${numberWord(tomorrowEvents.length)} compromisso${tomorrowEvents.length === 1 ? "" : "s"} amanhã na sua agenda, dá uma olhada nela pra não esquecer.`;
}

// Simples, mas não simples demais: uma linha curta por assunto que importa
// (tarefa urgente, hábito pendente, agenda de hoje e de amanhã). Cada linha
// já vem enxuta — nome de hábito encurtado, agenda resumida em contagem —
// então dá pra empilhar sem virar textão.
function summaryLines({ overdueTasks, dueTodayTasks, doneHabits, pendingHabits, events, today }) {
  const lines = [];

  if (overdueTasks.length === 1) {
    const daysLate = daysBetween(overdueTasks[0].date, today);
    lines.push(
      `A tarefa "${overdueTasks[0].title}" está atrasada há ${daysLate} dia${daysLate === 1 ? "" : "s"}.`,
    );
  } else if (overdueTasks.length > 1) {
    const oldest = overdueTasks[0];
    const daysLate = daysBetween(oldest.date, today);
    lines.push(
      `Você tem ${overdueTasks.length} tarefas atrasadas — a mais antiga é "${oldest.title}" (${daysLate} dia${daysLate === 1 ? "" : "s"}).`,
    );
  } else if (dueTodayTasks.length === 1) {
    lines.push(`A tarefa "${dueTodayTasks[0].title}" vence hoje.`);
  } else if (dueTodayTasks.length > 1) {
    lines.push(`Você tem ${dueTodayTasks.length} tarefas vencendo hoje.`);
  }

  if (pendingHabits.length > 0) {
    const names = joinNamesCapped(pendingHabits.map((h) => shortHabitName(h.name)));
    lines.push(`Hoje ainda falta ${names}.`);
  } else if (doneHabits.length > 0) {
    lines.push("Você já cuidou de todos os hábitos de hoje! 🎉");
  }

  const todayLine = agendaTodayLine(events, today);
  if (todayLine) lines.push(todayLine);

  const tomorrowLine = agendaTomorrowLine(events, today);
  if (tomorrowLine) lines.push(tomorrowLine);

  if (lines.length === 0) lines.push("Tudo em dia por aqui! Nenhuma pendência hoje. 🎉");

  return lines;
}

function firstName(user) {
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (fullName) return fullName.split(" ")[0];
  return user?.email ?? "";
}

function initial(user) {
  return firstName(user).charAt(0).toUpperCase() || "?";
}

function HomeScreen({
  tasks,
  habits,
  user,
  calendar,
  onToggleTask,
  onConnectCalendar,
  onRefreshCalendar,
  onOpenEvent,
  onNewEvent,
  onNavigate,
}) {
  const today = todayISO();
  const pendingTasks = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const overdueTasks = pendingTasks.filter((t) => t.date && t.date < today);
  const todaysTasks = pendingTasks.filter((t) => t.date === today);
  const urgentNoDateTasks = pendingTasks.filter((t) => t.urgent && !t.date);
  const upcomingTasks = [...overdueTasks, ...todaysTasks, ...urgentNoDateTasks];
  const activeHabits = habits.filter((h) => !habitProgress(h).isFinished);
  const habitsDoneTodayList = activeHabits.filter((h) => habitProgress(h).doneToday);
  const habitsPendingTodayList = activeHabits.filter((h) => !habitProgress(h).doneToday);
  const lines = summaryLines({
    overdueTasks,
    dueTodayTasks: todaysTasks,
    doneHabits: habitsDoneTodayList,
    pendingHabits: habitsPendingTodayList,
    events: calendar.status === "ready" ? calendar.events : [],
    today,
  });

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-ritmo-text/60">Olá, {firstName(user)}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">
            Meu Ritmo
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notificações"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ritmo-text/60 transition-colors hover:bg-ritmo-pink-light/60 hover:text-ritmo-pink-deep"
          >
            <Bell size={20} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-ritmo-pink-deep ring-2 ring-ritmo-bg" />
          </button>
          <button
            type="button"
            aria-label="Abrir perfil"
            onClick={() => onNavigate("profile")}
            className="rounded-full transition-transform active:scale-95"
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="h-11 w-11 rounded-full object-cover shadow-sm shadow-ritmo-pink/40"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ritmo-pink text-sm font-semibold text-white shadow-sm shadow-ritmo-pink/40">
                {initial(user)}
              </div>
            )}
          </button>
        </div>
      </header>

      <section className="mb-5 rounded-2xl bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink px-4 py-3 text-white shadow-md shadow-ritmo-pink/30">
        <p className="text-xs opacity-90">Seu resumo de hoje</p>
        {lines.map((line, i) => (
          <p key={i} className="mt-1 text-xs font-medium leading-snug">
            {line}
          </p>
        ))}
      </section>

      <AgendaCard
        status={calendar.status}
        events={calendar.events}
        tasks={tasks}
        focusDate={calendar.focusDate}
        today={today}
        onFocusDate={calendar.setFocusDate}
        onConnect={onConnectCalendar}
        onRefresh={onRefreshCalendar}
        onOpenEvent={onOpenEvent}
        onNewEvent={onNewEvent}
        onToggleTask={onToggleTask}
      />

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ritmo-text">Tarefas</h2>
        <button
          type="button"
          onClick={() => onNavigate("tasks")}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-ritmo-pink transition-colors hover:bg-ritmo-pink-light/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ritmo-pink"
        >
          ver todas
        </button>
      </div>

      {upcomingTasks.length === 0 ? (
        <p className="mb-6 rounded-2xl bg-white p-4 text-center text-sm text-ritmo-text/50 shadow-sm shadow-ritmo-text/5">
          Nenhuma tarefa pendente por hoje. 🎉
        </p>
      ) : (
        <div className="mb-6 space-y-3">
          {upcomingTasks.slice(0, 4).map((task) => {
            const isOverdue = !!task.date && task.date < today;
            return (
              <label
                key={task.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-ritmo-text/5 transition-shadow hover:shadow-md"
              >
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => onToggleTask(task.id)}
                  className="peer sr-only"
                />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ritmo-pink transition-colors peer-checked:bg-ritmo-pink">
                  <Check size={12} strokeWidth={3} className="text-transparent peer-checked:text-white" />
                </span>
                {task.urgent && (
                  <AlertTriangle size={16} className="shrink-0 text-ritmo-pink-deep" aria-label="Urgente" />
                )}
                <p className="min-w-0 flex-1 truncate text-sm text-ritmo-text">{task.title}</p>
                {isOverdue && (
                  <span className="shrink-0 rounded-full bg-ritmo-pink-deep/10 px-2 py-1 text-xs font-medium text-ritmo-pink-deep">
                    atrasada
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ritmo-text">Hábitos</h2>
        <button
          type="button"
          onClick={() => onNavigate("habits")}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-ritmo-pink transition-colors hover:bg-ritmo-pink-light/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ritmo-pink"
        >
          ver todos
        </button>
      </div>

      <DayHabitsRing done={habitsDoneTodayList.length} total={activeHabits.length} />
    </div>
  );
}

export default HomeScreen;

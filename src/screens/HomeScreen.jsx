import { AlertTriangle, Bell, Check } from "lucide-react";
import DayHabitsRing from "../components/DayHabitsRing.jsx";
import AgendaCard from "../components/AgendaCard.jsx";
import { todayISO, daysBetween } from "../lib/date.js";
import { eventsOnDay, formatEventTime } from "../lib/googleCalendar.js";
import { habitProgress } from "./HabitsScreen.jsx";
import { joinNames } from "../lib/text.js";

function taskSummary(overdueTasks, dueTodayTasks, today) {
  const sentences = [];

  if (overdueTasks.length === 1) {
    const daysLate = daysBetween(overdueTasks[0].date, today);
    sentences.push(
      `A tarefa "${overdueTasks[0].title}" está atrasada há ${daysLate} dia${daysLate === 1 ? "" : "s"}.`,
    );
  } else if (overdueTasks.length > 1) {
    const parts = overdueTasks.map((t) => {
      const daysLate = daysBetween(t.date, today);
      return `"${t.title}" (${daysLate} dia${daysLate === 1 ? "" : "s"})`;
    });
    sentences.push(`As tarefas ${joinNames(parts)} estão atrasadas.`);
  }

  if (dueTodayTasks.length === 1) {
    sentences.push(`A tarefa "${dueTodayTasks[0].title}" vence hoje.`);
  } else if (dueTodayTasks.length > 1) {
    const parts = dueTodayTasks.map((t) => `"${t.title}"`);
    sentences.push(`As tarefas ${joinNames(parts)} vencem hoje.`);
  }

  if (sentences.length === 0) return "Nenhuma tarefa pendente por hoje. 🎉";
  return sentences.join(" ");
}

function habitSummary(doneToday, pendingToday) {
  if (doneToday.length === 0 && pendingToday.length === 0) return null;

  const doneNames = joinNames(doneToday.map((h) => h.name));
  const pendingNames = joinNames(pendingToday.map((h) => h.name));

  if (doneToday.length > 0 && pendingToday.length > 0) {
    return `Hoje você já fez ${doneNames}, mas ainda faltam ${pendingNames}.`;
  }
  if (doneToday.length > 0) {
    return `Hoje você já fez todos os hábitos: ${doneNames}! 🎉`;
  }
  return `Hoje ainda faltam ${pendingNames}.`;
}

function agendaSummary(events, today) {
  const todayEvents = eventsOnDay(events, today);
  if (todayEvents.length === 0) return null;

  const now = new Date();
  const next = todayEvents.find((e) => e.allDay || e.end > now);
  const count = `${todayEvents.length} compromisso${todayEvents.length === 1 ? "" : "s"}`;

  if (!next) return `Seus ${count} de hoje já passaram.`;
  if (next.allDay) return `Hoje você tem ${count} na agenda, incluindo "${next.title}".`;
  return `Hoje você tem ${count} na agenda — o próximo é "${next.title}" às ${formatEventTime(next)}.`;
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
  const agendaLine = calendar.status === "ready" ? agendaSummary(calendar.events, today) : null;

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
        <p className="mt-1 text-xs font-medium leading-snug">
          {taskSummary(overdueTasks, todaysTasks, today)}
        </p>
        {habitSummary(habitsDoneTodayList, habitsPendingTodayList) && (
          <p className="mt-1 text-xs font-medium leading-snug">
            {habitSummary(habitsDoneTodayList, habitsPendingTodayList)}
          </p>
        )}
        {agendaLine && <p className="mt-1 text-xs font-medium leading-snug">{agendaLine}</p>}
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

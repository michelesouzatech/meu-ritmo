import { todayISO, addDays, daysBetween } from "./date.js";
import { joinNames } from "./text.js";
import { habitProgress } from "../screens/HabitsScreen.jsx";

function parseWeight(raw) {
  const match = String(raw).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function taskCompletionSummary(tasks, today) {
  const start = addDays(today, -6);
  const inRange = tasks.filter((t) => t.date >= start && t.date <= today);
  const total = inRange.length;
  const done = inRange.filter((t) => t.done).length;
  const rate = total > 0 ? done / total : null;
  return { total, done, rate, start, end: today };
}

function habitRatioInRange(habit, startISO, endISO) {
  const inRange = habit.completions.filter((d) => d >= startISO && d <= endISO);
  const totalDays = daysBetween(startISO, endISO) + 1;
  return inRange.length / totalDays;
}

function habitInsights(habits, today) {
  const evolutions = [];
  const improvements = [];
  const suggestions = [];

  habits.forEach((habit) => {
    const progress = habitProgress(habit);
    if (progress.isFinished) return;

    const habitAge = daysBetween(habit.startDate, today);
    const sortedCompletions = [...habit.completions].sort();
    const lastDone = sortedCompletions[sortedCompletions.length - 1];
    const daysSinceLast = lastDone ? daysBetween(lastDone, today) : null;

    if (progress.isDaily && progress.streak >= 3) {
      evolutions.push({
        id: `habit-streak-${habit.id}`,
        text: `Seu hábito "${habit.name}" está com ${progress.streak} dias seguidos.`,
      });
    }

    if (habit.completions.length === 0 && habitAge >= 3) {
      improvements.push({
        id: `habit-never-${habit.id}`,
        text: `Você ainda não marcou nenhum dia do hábito "${habit.name}".`,
      });
      suggestions.push({
        id: `habit-never-suggestion-${habit.id}`,
        text: `Comece pequeno: marque "${habit.name}" hoje pra criar o costume de registrar.`,
      });
      return;
    }

    const recentRatio = habitRatioInRange(habit, addDays(today, -6), today);
    const previousRatio = habitRatioInRange(habit, addDays(today, -13), addDays(today, -7));
    const droppedMeaningfully =
      habitAge >= 4 && previousRatio > 0 && recentRatio < previousRatio - 0.25;
    const goneQuiet = habitAge >= 4 && daysSinceLast !== null && daysSinceLast >= 3;

    if (droppedMeaningfully || goneQuiet) {
      const sinceText =
        daysSinceLast !== null ? `${daysSinceLast} dia${daysSinceLast === 1 ? "" : "s"}` : "um tempo";
      improvements.push({
        id: `habit-drop-${habit.id}`,
        text: `O hábito "${habit.name}" caiu nos últimos ${sinceText}.`,
      });
      suggestions.push({
        id: `habit-drop-suggestion-${habit.id}`,
        text: `Reduza a meta de "${habit.name}" essa semana e retome o ritmo aos poucos.`,
      });
    }
  });

  return { evolutions, improvements, suggestions };
}

function exerciseInsights(workout, today) {
  const evolutions = [];
  const improvements = [];
  const suggestions = [];

  workout.exercises.forEach((exercise) => {
    const numericLogs = exercise.cargaLogs
      .map((log) => ({ ...log, value: parseWeight(log.weight) }))
      .filter((log) => log.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (numericLogs.length < 2) return;

    let increaseStreak = 0;
    let decreaseStreak = 0;
    for (let i = numericLogs.length - 1; i > 0; i--) {
      if (numericLogs[i].value > numericLogs[i - 1].value) {
        if (decreaseStreak > 0) break;
        increaseStreak++;
      } else if (numericLogs[i].value < numericLogs[i - 1].value) {
        if (increaseStreak > 0) break;
        decreaseStreak++;
      } else {
        break;
      }
    }

    if (increaseStreak >= 2) {
      evolutions.push({
        id: `exercise-up-${exercise.id}`,
        text: `Sua carga em "${exercise.name}" subiu ${increaseStreak} vezes seguidas.`,
      });
    } else if (decreaseStreak >= 2) {
      improvements.push({
        id: `exercise-down-${exercise.id}`,
        text: `Sua carga em "${exercise.name}" caiu nos últimos registros.`,
      });
    }
  });

  const loggedRecently = workout.exercises.some((e) =>
    e.cargaLogs.some((l) => daysBetween(l.date, today) <= 13),
  );
  if (workout.exercises.length > 0 && !loggedRecently) {
    suggestions.push({
      id: "workout-log-reminder",
      text: "Faz tempo que você não registra carga nos exercícios. Que tal atualizar depois do próximo treino?",
    });
  }

  return { evolutions, improvements, suggestions };
}

function bodyFatInsights(bodyFat) {
  const evolutions = [];
  const improvements = [];
  if (bodyFat.length < 2) return { evolutions, improvements };

  const sorted = [...bodyFat].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const diff = last.percent - prev.percent;

  if (diff < 0) {
    evolutions.push({
      id: "bodyfat-down",
      text: `Seu % de gordura caiu ${Math.abs(diff).toFixed(1)} pontos desde a última medição.`,
    });
  } else if (diff > 0) {
    improvements.push({
      id: "bodyfat-up",
      text: `Seu % de gordura subiu ${diff.toFixed(1)} pontos desde a última medição.`,
    });
  }

  return { evolutions, improvements };
}

function dayName(dateISO, today) {
  if (dateISO === today) return "hoje";
  if (dateISO === addDays(today, 1)) return "amanhã";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
}

function shortDayName(dateISO, today) {
  if (dateISO === today) return "hoje";
  if (dateISO === addDays(today, 1)) return "amanhã";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short" });
}

// Cruza a Google Agenda com as tarefas: onde o dia aperta e onde sobra espaço.
function calendarInsights(events, tasks, today) {
  const evolutions = [];
  const improvements = [];
  const suggestions = [];
  const weekEnd = addDays(today, 6);

  const upcoming = events.filter((e) => e.dateISO >= today && e.dateISO <= weekEnd);
  const lastWeek = events.filter((e) => e.dateISO >= addDays(today, -7) && e.dateISO < today);

  const busyHours = upcoming
    .filter((e) => !e.allDay)
    .reduce((total, e) => total + (e.end - e.start) / 3600000, 0);

  const byDay = new Map();
  upcoming.forEach((e) => byDay.set(e.dateISO, (byDay.get(e.dateISO) ?? 0) + 1));

  let busiest = null;
  byDay.forEach((count, dateISO) => {
    if (!busiest || count > busiest.count) busiest = { dateISO, count };
  });

  const freeDays = [];
  for (let i = 0; i < 7; i++) {
    const dateISO = addDays(today, i);
    if (!byDay.has(dateISO)) freeDays.push(dateISO);
  }

  const pendingTasks = tasks.filter((t) => !t.done);
  const todayCount = byDay.get(today) ?? 0;
  const tasksToday = pendingTasks.filter((t) => t.date === today).length;

  if (todayCount >= 3 && tasksToday >= 2) {
    improvements.push({
      id: "calendar-today-full",
      text: `Hoje está cheio: ${todayCount} compromissos na agenda e ${tasksToday} tarefas pendentes.`,
    });
    suggestions.push({
      id: "calendar-today-full-suggestion",
      text: "Escolha só 1 tarefa pra fazer hoje entre os compromissos e passe o resto pra um dia mais livre.",
    });
  }

  if (busiest && busiest.count >= 3 && busiest.dateISO !== today) {
    improvements.push({
      id: "calendar-busiest",
      text: `Seu dia mais cheio da semana é ${dayName(busiest.dateISO, today)}: ${busiest.count} compromissos.`,
    });
    const tasksThatDay = pendingTasks.filter((t) => t.date === busiest.dateISO).length;
    if (tasksThatDay > 0) {
      suggestions.push({
        id: "calendar-busiest-clash",
        text: `Você tem ${tasksThatDay} tarefa${tasksThatDay === 1 ? "" : "s"} marcada${tasksThatDay === 1 ? "" : "s"} pra ${dayName(busiest.dateISO, today)}, que já tem ${busiest.count} compromissos — vale mover pra outro dia.`,
      });
    }
  }

  if (upcoming.length >= 3 && freeDays.length >= 2) {
    const names = joinNames(freeDays.slice(0, 3).map((d) => shortDayName(d, today)));
    const extra = freeDays.length > 3 ? " (e mais alguns dias)" : "";
    suggestions.push({
      id: "calendar-free-days",
      text: `Você não tem nada marcado ${names}${extra} — bons dias pra treinar ou adiantar tarefas.`,
    });
  }

  if (lastWeek.length >= 3 && upcoming.length <= lastWeek.length * 0.6) {
    evolutions.push({
      id: "calendar-lighter-week",
      text: `Sua semana está mais leve: ${upcoming.length} compromissos contra ${lastWeek.length} na semana passada.`,
    });
  }

  const summary = {
    upcomingCount: upcoming.length,
    lastWeekCount: lastWeek.length,
    todayCount,
    busyHours: Math.round(busyHours),
    freeDaysCount: freeDays.length,
  };

  return { evolutions, improvements, suggestions, summary };
}

function taskSuggestion(taskSummary) {
  if (taskSummary.rate === null || taskSummary.rate >= 0.5) return null;
  return {
    id: "task-suggestion",
    text: "Poucas tarefas concluídas essa semana — tente listar só 2 ou 3 prioridades por dia pra recuperar o ritmo.",
  };
}

export function buildInsights({ tasks, habits, workout, bodyFat, events = [], calendarConnected = false }) {
  const today = todayISO();
  const taskSummary = taskCompletionSummary(tasks, today);
  const habitData = habitInsights(habits, today);
  const exerciseData = exerciseInsights(workout, today);
  const bodyFatData = bodyFatInsights(bodyFat);
  const calendarData = calendarConnected
    ? calendarInsights(events, tasks, today)
    : { evolutions: [], improvements: [], suggestions: [], summary: null };

  const evolutions = [
    ...habitData.evolutions,
    ...exerciseData.evolutions,
    ...bodyFatData.evolutions,
    ...calendarData.evolutions,
  ];
  const improvements = [
    ...habitData.improvements,
    ...exerciseData.improvements,
    ...bodyFatData.improvements,
    ...calendarData.improvements,
  ];
  const suggestions = [
    ...habitData.suggestions,
    ...exerciseData.suggestions,
    ...calendarData.suggestions,
  ];

  const taskSug = taskSuggestion(taskSummary);
  if (taskSug) suggestions.push(taskSug);

  const hasAnyData =
    tasks.length > 0 ||
    habits.length > 0 ||
    workout.exercises.length > 0 ||
    bodyFat.length > 0 ||
    events.length > 0;

  return {
    today,
    taskSummary,
    calendarSummary: calendarData.summary,
    evolutions,
    improvements,
    suggestions,
    hasAnyData,
  };
}

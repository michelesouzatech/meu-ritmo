// Onde um hábito está: se é diário, quantos dias seguidos; se tem ciclo,
// em que dia do ciclo ele está e quanto falta pra fechar.
// Isso morava dentro da tela de Hábitos, mas quem usa não é só ela — a Home e
// os insights também precisam da mesma conta.
import { todayISO, toISODate, daysBetween } from "./date.js";

function calcStreak(habit) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let cursor = toISODate(d);
  // Ainda não marcou hoje não quebra a sequência — o dia não acabou.
  if (!habit.completions.includes(cursor)) {
    d.setDate(d.getDate() - 1);
    cursor = toISODate(d);
  }
  let streak = 0;
  while (habit.completions.includes(cursor)) {
    streak++;
    d.setDate(d.getDate() - 1);
    cursor = toISODate(d);
  }
  return streak;
}

export function habitProgress(habit) {
  const today = todayISO();
  const doneToday = habit.completions.includes(today);

  if (!habit.periodDays) {
    const d = new Date();
    let markedLast7 = 0;
    for (let i = 0; i < 7; i++) {
      if (habit.completions.includes(toISODate(d))) markedLast7++;
      d.setDate(d.getDate() - 1);
    }
    return {
      isDaily: true,
      isFinished: false,
      doneToday,
      ratio: markedLast7 / 7,
      streak: calcStreak(habit),
      totalDays: habit.completions.length,
    };
  }

  const daysSinceStart = daysBetween(habit.startDate, today);
  const notStarted = daysSinceStart < 0;
  const elapsed = Math.max(0, daysSinceStart);
  const isFinished = !notStarted && elapsed >= habit.periodDays;
  const currentDay = notStarted ? 0 : Math.min(elapsed + 1, habit.periodDays);
  const daysRemaining = notStarted ? habit.periodDays : Math.max(0, habit.periodDays - currentDay);
  const ratio = habit.completions.length / habit.periodDays;
  return { isDaily: false, currentDay, daysRemaining, isFinished, notStarted, doneToday, ratio };
}

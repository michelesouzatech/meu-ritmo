// As contas da aba Corrida: quanto falta pra prova, quantas corridas na
// semana e a consistência do mês contra a meta do plano.
import { todayISO, toISODate, addDays, daysBetween } from "./date.js";
import { paceFrom } from "./pace.js";

// Semana de domingo a sábado, igual ao resto do app.
export function weekStartISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return toISODate(d);
}

export function monthRange(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toISODate(first), end: toISODate(last) };
}

export function sessionsInRange(sessions, startISO, endISO) {
  return sessions.filter((s) => s.date >= startISO && s.date <= endISO);
}

export function sessionPace(session) {
  return paceFrom(session.distanceKm, session.duration);
}

// A prova que vem: a mais próxima que ainda não aconteceu.
export function nextRace(races, today = todayISO()) {
  return (
    races
      .filter((r) => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

// Provas que já passaram, da mais recente pra mais antiga.
export function pastRaces(races, today = todayISO()) {
  return races.filter((r) => r.date < today).sort((a, b) => b.date.localeCompare(a.date));
}

export function upcomingRaces(races, today = todayISO()) {
  return races.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

export function daysUntil(dateISO, today = todayISO()) {
  return daysBetween(today, dateISO);
}

export function activePlan(plans) {
  return plans.find((p) => !p.archived) ?? null;
}

// O plano vale de start_date até end_date (ou até a data da prova, quando
// vinculado). Sem fim definido, vale pra sempre.
function planEndISO(plan, race) {
  return plan.endDate ?? race?.date ?? null;
}

function clampRange(startISO, endISO, minISO, maxISO) {
  const start = startISO > minISO ? startISO : minISO;
  const end = maxISO && endISO > maxISO ? maxISO : endISO;
  return end < start ? null : { start, end };
}

// Quantas corridas nesta semana contra a meta semanal.
export function weekProgress(plan, sessions, today = todayISO()) {
  if (!plan) return null;
  const start = weekStartISO(today);
  const end = addDays(start, 6);
  const done = sessionsInRange(sessions, start, end).filter(
    (s) => s.planId === plan.id,
  ).length;
  return { done, target: plan.weeklyTarget, start, end };
}

// Consistência do mês: as corridas feitas contra a meta proporcional aos dias
// em que o plano de fato esteve valendo — e, no mês corrente, só até hoje.
// Sem isso, dia 6 de agosto uma meta de mês inteiro faria qualquer pessoa
// parecer atrasada.
export function monthConsistency(plan, sessions, race, monthISO = todayISO()) {
  if (!plan) return null;

  const today = todayISO();
  const { start: monthStart, end: monthEnd } = monthRange(monthISO);
  const cap = monthEnd > today ? today : monthEnd;
  const planEnd = planEndISO(plan, race);
  const rangeEnd = planEnd && planEnd < cap ? planEnd : cap;

  const range = clampRange(plan.startDate, rangeEnd, monthStart, null);
  if (!range) return { done: 0, target: 0, ratio: null, activeDays: 0 };

  const activeDays = daysBetween(range.start, range.end) + 1;
  const target = Math.round((plan.weeklyTarget * activeDays) / 7);
  const done = sessionsInRange(sessions, range.start, range.end).filter(
    (s) => s.planId === plan.id,
  ).length;

  return {
    done,
    target,
    ratio: target > 0 ? done / target : null,
    activeDays,
  };
}

// O melhor pace registrado nos treinos — é o que dá pra comparar com a meta.
export function bestTrainingPace(sessions) {
  const paces = sessions.map(sessionPace).filter((p) => p != null);
  return paces.length > 0 ? Math.min(...paces) : null;
}

export function lastSession(sessions) {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function daysSinceLastRun(sessions, today = todayISO()) {
  const last = lastSession(sessions);
  return last ? daysBetween(last.date, today) : null;
}

// O pace oficial sai do tempo que a pessoa digitou, não de um campo separado.
export function racePace(race) {
  return paceFrom(race.distanceKm, race.resultTime);
}

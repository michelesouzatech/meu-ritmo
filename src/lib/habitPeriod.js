// Em que dias um hábito (ou suplemento) existiu.
//
// Encerrar não apaga nada: o hábito continua aparecendo nos dias em que
// estava valendo. Começa no dia de início (ou na primeira marcação, se ela for
// mais antiga) e vai até o dia do encerramento, inclusive — marcado ou não,
// porque pode ser um ciclo que não foi cumprido no último dia.
import { toISODate, todayISO } from "./date.js";

function earliest(days) {
  return days.filter(Boolean).sort()[0] ?? null;
}

function latest(days) {
  return days.filter(Boolean).sort().at(-1) ?? null;
}

// `ended_at` chega do banco em UTC. O dia que conta é o do celular dela:
// encerrar às 22h em Brasília é 01h do dia seguinte em UTC.
function localDay(timestamp) {
  return timestamp ? toISODate(new Date(timestamp)) : null;
}

function buildPeriod({ startDay, marks, ended, endedAt }) {
  const firstDay = earliest([startDay, ...marks]);
  if (!ended) return { firstDay, lastDay: null };
  // Encerrado sem data gravada: o último sinal de vida é a última marcação.
  // A última marcação também segura o fim — marcação nunca fica de fora.
  const lastDay = latest([localDay(endedAt), ...marks]) ?? firstDay;
  return { firstDay, lastDay };
}

export function habitPeriod(habit) {
  return buildPeriod({
    startDay: habit.startDate,
    marks: habit.completions,
    ended: habit.status === "finished",
    endedAt: habit.endedAt,
  });
}

// Suplemento não tem data de início: vale o dia em que foi cadastrado.
export function supplementPeriod(supplement) {
  return buildPeriod({
    startDay: localDay(supplement.createdAt),
    marks: supplement.takenDates,
    ended: supplement.active === false,
    endedAt: supplement.endedAt,
  });
}

export function inPeriod({ firstDay, lastDay }, date) {
  if (firstDay && date < firstDay) return false;
  return lastDay === null || date <= lastDay;
}

// Lista do dia. Um hábito ativo que ainda vai começar (ciclo agendado pra
// frente) continua aparecendo em "hoje", como sempre apareceu — só some dos
// dias passados, em que ele não existia.
export function habitsOnDate(habits, date, today = todayISO()) {
  return habits.filter((h) => {
    const period = habitPeriod(h);
    if (inPeriod(period, date)) return true;
    return period.lastDay === null && date >= today;
  });
}

export function supplementsOnDate(supplements, date) {
  return supplements.filter((s) => inPeriod(supplementPeriod(s), date));
}

// Forma que a faixa de dias e o calendário leem: nome, marcações e período.
// Hábito e suplemento entram pelo mesmo formato, então os dois componentes
// servem pras duas abas.
export function habitTimelineItem(habit) {
  return { id: habit.id, name: habit.name, completions: habit.completions, ...habitPeriod(habit) };
}

export function supplementTimelineItem(supplement) {
  return {
    id: supplement.id,
    name: supplement.name,
    completions: supplement.takenDates,
    ...supplementPeriod(supplement),
  };
}

// Quantos itens existiam naquele dia — é a base da cor da bolinha.
export function timelineOnDate(items, date) {
  return items.filter((item) => inPeriod(item, date));
}

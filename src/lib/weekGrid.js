import { addDays, toISODate } from "./date.js";

export const MINUTES_IN_DAY = 24 * 60;
// Altura mínima de um bloco, senão um compromisso de 15 min some da grade.
const MIN_SLOT_MINUTES = 30;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// A semana começa no domingo, igual à Google Agenda em português.
export function startOfWeek(dateISO) {
  const weekday = new Date(`${dateISO}T00:00:00`).getDay();
  return addDays(dateISO, -weekday);
}

export function weekDays(dateISO) {
  const first = startOfWeek(dateISO);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function minutesOfDay(date, dateISO) {
  const dayStart = new Date(`${dateISO}T00:00:00`);
  return Math.round((date - dayStart) / 60000);
}

/**
 * Distribui os compromissos com horário de um dia na grade, do jeito que a
 * Google Agenda faz: quem se sobrepõe divide a largura da coluna.
 * Devolve `{ event, top, height, left, width }` em fração de 0 a 1 — quem
 * desenha decide a altura em pixels.
 */
export function layoutDay(events, dateISO) {
  const timed = events
    .filter((e) => !e.allDay && e.dateISO === dateISO)
    .map((event) => {
      const start = clamp(minutesOfDay(event.start, dateISO), 0, MINUTES_IN_DAY - MIN_SLOT_MINUTES);
      const end = clamp(
        Math.max(minutesOfDay(event.end, dateISO), start + MIN_SLOT_MINUTES),
        0,
        MINUTES_IN_DAY,
      );
      return { event, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed = [];
  let group = [];
  let groupEnd = -1;

  // Fecha um grupo de compromissos que se cruzam e reparte a largura entre eles.
  function flush() {
    const columnEnds = [];
    for (const item of group) {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column === -1) {
        columnEnds.push(item.end);
        column = columnEnds.length - 1;
      } else {
        columnEnds[column] = item.end;
      }
      item.column = column;
    }

    const total = columnEnds.length;
    for (const item of group) {
      placed.push({
        event: item.event,
        top: item.start / MINUTES_IN_DAY,
        height: (item.end - item.start) / MINUTES_IN_DAY,
        left: item.column / total,
        width: 1 / total,
      });
    }
    group = [];
    groupEnd = -1;
  }

  for (const item of timed) {
    if (group.length > 0 && item.start >= groupEnd) flush();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.end);
  }
  if (group.length > 0) flush();

  return placed;
}

// Título do topo: "Agosto 2026" quando a semana não muda de mês, "Jul. – ago. 2026" quando muda.
export function weekLabel(dateISO) {
  const days = weekDays(dateISO);
  const first = new Date(`${days[0]}T00:00:00`);
  const last = new Date(`${days[6]}T00:00:00`);
  const year = last.getFullYear();

  if (first.getMonth() === last.getMonth()) {
    const month = first.toLocaleDateString("pt-BR", { month: "long" });
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  }

  const short = (date) => date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${short(first)} – ${short(last)} ${year}`;
}

// Hora em que a grade abre: perto de agora quando a semana é a atual, senão no
// primeiro compromisso do período (com 7h como piso pra não abrir na madrugada).
export function initialHour(days, events, todayDate) {
  if (days.includes(toISODate(todayDate))) {
    return clamp(todayDate.getHours() - 1, 0, 22);
  }
  const inWeek = events.filter((e) => !e.allDay && days.includes(e.dateISO));
  if (inWeek.length === 0) return 7;
  const earliest = Math.min(...inWeek.map((e) => e.start.getHours()));
  return clamp(Math.min(earliest, 7) - 1, 0, 22);
}

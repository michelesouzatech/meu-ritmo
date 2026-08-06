// O diário de treino: cinco carinhas viram número por dentro, pra depois dar
// pra dizer "sua média subiu esse mês" ou "suas terças vêm caindo".

export const FEELINGS = [
  { value: 1, emoji: "😫", label: "acabada" },
  { value: 2, emoji: "😴", label: "cansada" },
  { value: 3, emoji: "😐", label: "normal" },
  { value: 4, emoji: "😊", label: "bem" },
  { value: 5, emoji: "🤩", label: "ótima" },
];

const BY_VALUE = new Map(FEELINGS.map((f) => [f.value, f]));

export function feelingOf(value) {
  return BY_VALUE.get(value) ?? null;
}

export function feelingEmoji(value) {
  return feelingOf(value)?.emoji ?? "";
}

export function feelingLabel(value) {
  return feelingOf(value)?.label ?? "";
}

// Como o registro aparece na lista: a ficha traz o próprio nome, corrida e
// descanso têm nome fixo, e "outra" é o que a pessoa escreveu.
export function activityName(entry) {
  if (entry.activityType === "run") return "Corrida";
  if (entry.activityType === "rest") return "Descanso";
  return entry.activityLabel || "Treino";
}

export function entriesOn(entries, dateISO) {
  return entries
    .filter((e) => e.date === dateISO)
    .sort((a, b) => a.activityType.localeCompare(b.activityType));
}

// Um dia pode ter vários registros, mas o calendário mostra uma carinha só.
// A média arredondada é o retrato mais honesto de um dia com treino bom e
// corrida sofrida.
export function dayFeeling(entries, dateISO) {
  const ofDay = entriesOn(entries, dateISO);
  if (ofDay.length === 0) return null;
  const total = ofDay.reduce((sum, e) => sum + e.feeling, 0);
  return Math.round(total / ofDay.length);
}

export function feelingByDate(entries) {
  const buckets = new Map();
  for (const entry of entries) {
    if (!buckets.has(entry.date)) buckets.set(entry.date, []);
    buckets.get(entry.date).push(entry.feeling);
  }
  const map = new Map();
  for (const [date, list] of buckets) {
    map.set(date, Math.round(list.reduce((a, b) => a + b, 0) / list.length));
  }
  return map;
}

// As atividades livres que ela já usou voltam como sugestão — quem escreveu
// "pilates" uma vez não devia digitar de novo.
export function pastCustomActivities(entries) {
  const seen = new Set();
  for (const entry of entries) {
    if (entry.activityType === "other" && entry.activityLabel.trim()) {
      seen.add(entry.activityLabel.trim());
    }
  }
  return [...seen].sort();
}

export function entriesInRange(entries, startISO, endISO) {
  return entries.filter((e) => e.date >= startISO && e.date <= endISO);
}

export function averageFeeling(entries) {
  if (entries.length === 0) return null;
  return entries.reduce((sum, e) => sum + e.feeling, 0) / entries.length;
}

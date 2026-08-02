import { supabase } from "./supabase.js";
import { addDays, toISODate } from "./date.js";

// Duas permissões: mexer nos compromissos (criar, editar, apagar) e enxergar a
// lista de agendas — sem a segunda o app só veria a agenda principal, e ficariam
// de fora as outras (Estudos, Exercícios, Pets...).
export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

const TOKEN_KEY = "meuritmo:google-token";
const CONNECTED_KEY = "meuritmo:google-connected";
// O token do Google vale 1 hora; guardamos com folga pra não usar um já vencido.
const TOKEN_TTL_MS = 55 * 60 * 1000;
const BASE_URL = "https://www.googleapis.com/calendar/v3";
const PRIMARY = "primary";

function eventsUrl(calendarId) {
  return `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events`;
}

// Erro de permissão: o jeito de resolver é a pessoa conectar o Google de novo.
export class CalendarAuthError extends Error {
  constructor(message = "Permissão do Google expirou") {
    super(message);
    this.name = "CalendarAuthError";
  }
}

// O Supabase entrega o token do Google só logo depois do login, e o perde quando
// renova a sessão — por isso guardamos por conta própria assim que ele aparece.
export function saveGoogleToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, savedAt: Date.now() }));
    localStorage.setItem(CONNECTED_KEY, "1");
  } catch {
    // Sem localStorage a agenda simplesmente pede pra conectar de novo.
  }
}

// Serve pra saber se é a primeira conexão ("Conectar") ou uma renovação ("Reconectar").
export function wasEverConnected() {
  try {
    return localStorage.getItem(CONNECTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function readGoogleToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, savedAt } = JSON.parse(raw);
    if (!token || !savedAt || Date.now() - savedAt > TOKEN_TTL_MS) return null;
    return token;
  } catch {
    return null;
  }
}

export function clearGoogleToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignora
  }
}

// Manda pro Google pedindo a permissão da agenda. A conta já tem a identidade
// Google ligada desde a época do login por Google, então o Supabase sempre
// reautentica essa mesma conta — nunca cria ou troca pra outra. Se a pessoa
// já autorizou antes, o Google devolve na hora, sem tela de consentimento.
export function connectGoogleCalendar() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: CALENDAR_SCOPE,
      redirectTo: window.location.origin,
      queryParams: { include_granted_scopes: "true" },
    },
  });
}

function isScopeProblem(body) {
  return /insufficient|scope|ACCESS_TOKEN/i.test(body);
}

function parseDate(value, allDay) {
  return allDay ? new Date(`${value}T00:00:00`) : new Date(value);
}

// Um compromisso de vários dias vira uma entrada por dia, senão ele sumiria da
// tela nos dias do meio.
function expandEvent(item, calendar) {
  const allDay = !!item.start?.date;
  const rawStart = item.start?.date ?? item.start?.dateTime;
  if (!rawStart) return [];

  const start = parseDate(rawStart, allDay);
  const rawEnd = item.end?.date ?? item.end?.dateTime;
  const end = rawEnd ? parseDate(rawEnd, allDay) : start;

  const base = {
    // rawId é o id de verdade no Google — o id abaixo pode ganhar sufixo de dia.
    rawId: item.id,
    calendarId: calendar.id,
    calendarName: calendar.name,
    color: calendar.color,
    editable: calendar.editable,
    title: item.summary?.trim() || "(sem título)",
    allDay,
    start,
    end,
    location: item.location ?? null,
    description: item.description ?? null,
    link: item.htmlLink ?? null,
    recurring: !!item.recurringEventId,
  };

  // Um id só do Google pode aparecer em duas agendas (convite compartilhado),
  // então a chave da tela leva a agenda junto.
  const key = `${calendar.id}:${item.id}`;
  if (!allDay) {
    return [{ ...base, id: key, dateISO: toISODate(start) }];
  }

  // Em evento de dia inteiro o Google manda a data final já no dia seguinte.
  const days = [];
  const cursor = new Date(start);
  while (cursor < end && days.length < 30) {
    const dateISO = toISODate(cursor);
    days.push({ ...base, id: `${key}:${dateISO}`, dateISO });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.length > 0 ? days : [{ ...base, id: key, dateISO: toISODate(start) }];
}

const PRIMARY_ONLY = [
  { id: PRIMARY, name: "Minha agenda", color: null, editable: true },
];

// Todas as agendas que estão marcadas na Google Agenda — é o que faz aparecerem
// no app os compromissos de "Estudos", "Exercícios", "Pets" e afins.
async function fetchCalendars(token) {
  const params = new URLSearchParams({ minAccessRole: "reader", maxResults: "250" });
  const response = await fetch(`${BASE_URL}/users/me/calendarList?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Sem a permissão de listar agendas o app ainda funciona, só com a principal.
  if (!response.ok) return PRIMARY_ONLY;

  const data = await response.json();
  const calendars = (data.items ?? [])
    .filter((item) => !item.deleted && !item.hidden && item.selected !== false)
    .map((item) => ({
      id: item.id,
      name: item.summaryOverride || item.summary || "Agenda",
      color: item.backgroundColor ?? null,
      editable: item.accessRole === "owner" || item.accessRole === "writer",
    }));

  return calendars.length > 0 ? calendars : PRIMARY_ONLY;
}

async function fetchEventsOf(calendar, token, params) {
  const response = await fetch(`${eventsUrl(calendar.id)}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 || (response.status === 403 && isScopeProblem(body))) {
      throw new CalendarAuthError();
    }
    // Uma agenda com problema não pode derrubar as outras.
    return [];
  }

  const data = await response.json();
  return (data.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .flatMap((item) => expandEvent(item, calendar));
}

export async function fetchCalendarEvents(token, { timeMin, timeMax }) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const calendars = await fetchCalendars(token);
  const lists = await Promise.all(calendars.map((c) => fetchEventsOf(c, token, params)));
  return lists.flat().sort((a, b) => a.start - b.start);
}

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Transforma o que a pessoa preencheu no formulário no formato do Google.
// `days` (dia inteiro) e `endDayOffset` (com horário) preservam a duração de
// compromissos que ocupam mais de um dia.
export function buildEventBody({
  title,
  dateISO,
  allDay,
  startTime,
  endTime,
  location,
  description,
  days = 1,
  endDayOffset = 0,
}) {
  const body = {
    summary: title.trim(),
    location: location?.trim() ?? "",
    description: description?.trim() ?? "",
  };

  if (allDay) {
    // No Google, a data final do evento de dia inteiro é o dia seguinte ao último.
    body.start = { date: dateISO };
    body.end = { date: addDays(dateISO, Math.max(1, days)) };
  } else {
    body.start = { dateTime: `${dateISO}T${startTime}:00`, timeZone: TIME_ZONE };
    body.end = {
      dateTime: `${addDays(dateISO, endDayOffset)}T${endTime}:00`,
      timeZone: TIME_ZONE,
    };
  }

  return body;
}

async function writeRequest(token, calendarId, path, method, body) {
  const response = await fetch(`${eventsUrl(calendarId)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Apagar devolve 204 sem conteúdo; apagar algo já apagado devolve 410.
  if (response.status === 204 || response.status === 410) return null;

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || (response.status === 403 && isScopeProblem(text))) {
      throw new CalendarAuthError();
    }
    if (response.status === 403) {
      throw new Error("Esse compromisso não pode ser alterado por aqui.");
    }
    throw new Error("Não deu pra salvar no Google Agenda agora.");
  }

  return response.json();
}

// `ref` é { id, calendarId } — o compromisso volta pra agenda de onde ele veio.
export function createCalendarEvent(token, form) {
  return writeRequest(token, form.calendarId ?? PRIMARY, "", "POST", buildEventBody(form));
}

export function updateCalendarEvent(token, ref, form) {
  return writeRequest(
    token,
    ref.calendarId ?? PRIMARY,
    `/${encodeURIComponent(ref.id)}`,
    "PATCH",
    buildEventBody(form),
  );
}

export function deleteCalendarEvent(token, ref) {
  return writeRequest(token, ref.calendarId ?? PRIMARY, `/${encodeURIComponent(ref.id)}`, "DELETE");
}

export function formatEventTime(event) {
  if (event.allDay) return "dia todo";
  return event.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function eventsOnDay(events, dateISO) {
  return events.filter((e) => e.dateISO === dateISO);
}

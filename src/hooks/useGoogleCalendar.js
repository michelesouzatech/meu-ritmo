import { useCallback, useEffect, useRef, useState } from "react";
import { todayISO, addDays, toISODate } from "../lib/date.js";
import {
  CalendarAuthError,
  clearGoogleToken,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  readGoogleToken,
  renewGoogleToken,
  saveGoogleRefreshToken,
  saveGoogleToken,
  updateCalendarEvent,
  wasEverConnected,
} from "../lib/googleCalendar.js";

// Janela mínima: a semana passada e a próxima, que é o que os insights usam.
const PAST_DAYS = 7;
const FUTURE_DAYS = 8;
// Folga em volta do mês aberto, pra cobrir os dias vizinhos que aparecem na grade.
const MONTH_MARGIN = 8;
// Ao voltar pro app, só busca de novo se os dados já estiverem velhos.
const STALE_MS = 5 * 60 * 1000;

function monthBounds(dateISO) {
  const date = new Date(`${dateISO}T00:00:00`);
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { firstISO: toISODate(first), lastISO: toISODate(last) };
}

// Carrega o mês inteiro que está na tela (pras bolinhas da grade) sem perder a
// semana passada e a próxima, que os insights precisam.
function windowFor(focusISO) {
  const today = todayISO();
  const { firstISO, lastISO } = monthBounds(focusISO);
  const starts = [addDays(today, -PAST_DAYS), addDays(firstISO, -MONTH_MARGIN)].sort();
  const ends = [addDays(today, FUTURE_DAYS), addDays(lastISO, MONTH_MARGIN)].sort();
  return { startISO: starts[0], endISO: ends[ends.length - 1] };
}

/**
 * Estados possíveis:
 * "disconnected" — nunca conectou a agenda
 * "loading"      — buscando os compromissos
 * "ready"        — deu certo (events preenchido)
 * "expired"      — precisa conectar o Google de novo
 * "error"        — deu problema de rede/API
 */
export function useGoogleCalendar(session) {
  const [status, setStatus] = useState("loading");
  const [events, setEvents] = useState([]);
  const [focusDate, setFocusDate] = useState(todayISO);
  const loadedRange = useRef(null);
  const fetchedAt = useRef(0);
  const providerToken = session?.provider_token ?? null;
  const providerRefreshToken = session?.provider_refresh_token ?? null;
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    if (providerToken) saveGoogleToken(providerToken);
  }, [providerToken]);

  // O refresh token aparece uma vez só, na volta do "Conectar Google Agenda".
  // É ele que faz a conexão durar — daqui vai direto pro servidor.
  useEffect(() => {
    if (providerRefreshToken) saveGoogleRefreshToken(providerRefreshToken);
  }, [providerRefreshToken]);

  // `jaRenovou` corta o vaivém: se o Google recusar até um token recém-nascido,
  // a segunda recusa é pra valer e a tela pede pra reconectar.
  const load = useCallback(async (focusISO, jaRenovou = false) => {
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    const token = readGoogleToken() ?? (await renewGoogleToken());
    if (!token) {
      setEvents([]);
      loadedRange.current = null;
      setStatus(wasEverConnected() ? "expired" : "disconnected");
      return;
    }

    const range = windowFor(focusISO);
    try {
      const list = await fetchCalendarEvents(token, {
        timeMin: new Date(`${range.startISO}T00:00:00`),
        timeMax: new Date(`${range.endISO}T00:00:00`),
      });
      loadedRange.current = range;
      fetchedAt.current = Date.now();
      setEvents(list);
      setStatus("ready");
    } catch (error) {
      loadedRange.current = null;
      if (!(error instanceof CalendarAuthError)) {
        setStatus("error");
        return;
      }
      clearGoogleToken();
      if (!jaRenovou && (await renewGoogleToken())) {
        await load(focusISO, true);
        return;
      }
      setEvents([]);
      setStatus("expired");
    }
  }, []);

  // Só busca de novo quando o dia escolhido sai da faixa já carregada.
  const ensureRange = useCallback(
    (focusISO) => {
      const wanted = windowFor(focusISO);
      const loaded = loadedRange.current;
      if (loaded && loaded.startISO <= wanted.startISO && loaded.endISO >= wanted.endISO) return;
      load(focusISO);
    },
    [load],
  );

  useEffect(() => {
    if (!isLoggedIn) return;
    ensureRange(focusDate);
  }, [ensureRange, focusDate, isLoggedIn, providerToken]);

  const refresh = useCallback(() => load(focusDate), [load, focusDate]);

  // Voltou pro app depois de um tempo: atualiza a agenda sem a pessoa pedir.
  useEffect(() => {
    if (!isLoggedIn) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAt.current < STALE_MS) return;
      refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh, isLoggedIn]);

  // Depois de criar/editar/apagar, recarrega pra tela mostrar o que o Google guardou.
  const runWrite = useCallback(
    async (action) => {
      const token = readGoogleToken() ?? (await renewGoogleToken());
      if (!token) {
        clearGoogleToken();
        setStatus("expired");
        throw new CalendarAuthError();
      }
      let result;
      try {
        result = await action(token);
      } catch (error) {
        if (!(error instanceof CalendarAuthError)) throw error;
        // Vencer bem na hora de salvar é o caso mais chato: a pessoa perderia o
        // que acabou de escrever. Renova e tenta de novo antes de desistir.
        clearGoogleToken();
        const novoToken = await renewGoogleToken();
        if (!novoToken) {
          setEvents([]);
          setStatus("expired");
          throw error;
        }
        try {
          result = await action(novoToken);
        } catch (segundoErro) {
          if (segundoErro instanceof CalendarAuthError) {
            clearGoogleToken();
            setEvents([]);
            setStatus("expired");
          }
          throw segundoErro;
        }
      }
      await load(focusDate);
      // Devolve o que o Google respondeu — quem cria uma prova precisa do id
      // do compromisso pra não criar duplicado depois.
      return result;
    },
    [load, focusDate],
  );

  const createEvent = useCallback(
    (form) => runWrite((token) => createCalendarEvent(token, form)),
    [runWrite],
  );

  // `ref` é { id, calendarId }: diz qual compromisso e em qual agenda do Google.
  const updateEvent = useCallback(
    (ref, form) => runWrite((token) => updateCalendarEvent(token, ref, form)),
    [runWrite],
  );

  const removeEvent = useCallback(
    (ref) => runWrite((token) => deleteCalendarEvent(token, ref)),
    [runWrite],
  );

  return {
    status,
    events,
    focusDate,
    setFocusDate,
    refresh,
    createEvent,
    updateEvent,
    removeEvent,
  };
}

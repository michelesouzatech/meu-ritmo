import { useCallback, useEffect, useRef, useState } from "react";

// Fila de gravação do app.
//
// Antes cada mudança disparava uma gravação solta: se a internet piscasse
// naquele segundo, o registro ficava só na tela e sumia no próximo reload —
// e o aviso de erro ainda era apagado pela próxima gravação que desse certo.
// Aqui o trabalho fica na fila até o banco confirmar, e a fila anda em ordem:
// enquanto o primeiro não passa, ninguém passa na frente e ninguém apaga o
// aviso por ele.
const RETRY_DELAYS = [1000, 3000, 8000, 20000, 60000];

function delayFor(attempts) {
  return RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)];
}

export function useSaveQueue() {
  const jobs = useRef([]);
  const running = useRef(false);
  const timer = useRef(null);
  // Quando a próxima tentativa pode acontecer — segura o backoff mesmo se
  // outra gravação chegar no meio.
  const nextTry = useRef(0);
  const flushRef = useRef(() => {});

  const [pending, setPending] = useState(0);
  const [failing, setFailing] = useState(false);

  const schedule = useCallback((ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), ms);
  }, []);

  const flush = useCallback(async () => {
    if (running.current || jobs.current.length === 0) return;

    const wait = nextTry.current - Date.now();
    if (wait > 0) return schedule(wait);

    running.current = true;
    try {
      while (jobs.current.length > 0) {
        const job = jobs.current[0];
        try {
          await job.run();
        } catch {
          // Não pula pro próximo: a ordem importa (o update de uma tarefa não
          // pode chegar antes do insert dela).
          job.attempts += 1;
          const ms = delayFor(job.attempts);
          nextTry.current = Date.now() + ms;
          setFailing(true);
          schedule(ms);
          return;
        }
        jobs.current.shift();
        nextTry.current = 0;
        setPending(jobs.current.length);
        setFailing(false);
      }
    } finally {
      running.current = false;
      setPending(jobs.current.length);
    }
  }, [schedule]);

  flushRef.current = flush;

  const save = useCallback((run) => {
    jobs.current.push({ run, attempts: 0 });
    setPending(jobs.current.length);
    flushRef.current();
  }, []);

  // Internet de volta ou app de volta pra frente: tenta na hora, sem esperar
  // o resto do backoff.
  useEffect(() => {
    function retryNow() {
      nextTry.current = 0;
      flushRef.current();
    }
    function onVisible() {
      if (document.visibilityState === "visible") retryNow();
    }
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Fechar o app com coisa na fila é exatamente como um registro se perde.
  useEffect(() => {
    if (pending === 0) return undefined;
    function onLeave(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [pending]);

  return { save, pending, failing };
}

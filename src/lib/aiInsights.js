// Ponte entre o app e a Edge Function que fala com o Gemini.
//
// A análise é gerada três vezes por dia, em horário fixo — 08h, 14h e 23h (ver
// lib/momento.js) — e guardada no navegador. Dentro do mesmo momento não há
// como pedir outra, de propósito: o plano gratuito do Gemini tem cota diária, e
// reler os mesmos registros renderia um texto levemente diferente sem ser mais
// verdadeiro, o que faria a leitura parecer opinião variável em vez de leitura
// dos dados.
//
// Três em vez de uma porque o mesmo dia muda de assunto conforme anda: de manhã
// o que importa é o que o dia pede, à noite é o que ele rendeu. Os dados que
// vão pro modelo são os mesmos; o que muda é a pergunta.
//
// O que muda entre um momento e outro continua aparecendo na hora: o motor de
// regras (lib/insights.js) recalcula a cada marcação, e é ele que segura os
// painéis enquanto a camada escrita fica parada até o próximo momento.
import { supabase } from "./supabase.js";

const CACHE_PREFIX = "meuritmo:aiInsights:";

// Pra onde cada destino leva. A aba Treino tem três sub-abas, então o destino
// carrega as duas informações — sem a sub-aba, um clique em "corrida" cairia
// em Força e pareceria botão quebrado.
export const DESTINO_ROTA = {
  habitos: { tab: "habits" },
  forca: { tab: "workout", sub: "gym" },
  corrida: { tab: "workout", sub: "running" },
  diario: { tab: "workout", sub: "journal" },
  tarefas: { tab: "tasks" },
  // A agenda mora no Perfil agora, não mais na Home.
  agenda: { tab: "profile" },
};

export const DESTINO_LABEL = {
  habitos: "Hábitos",
  forca: "Força",
  corrida: "Corrida",
  diario: "Diário",
  tarefas: "Tarefas",
  agenda: "Agenda",
};

// O cache leva o id da pessoa junto: duas contas no mesmo navegador não podem
// ver a leitura uma da outra.
const cacheKey = (userId) => `${CACHE_PREFIX}${userId ?? "anon"}`;

// Guarda só a leitura do momento corrente: assim que a tarde chega, a da manhã
// não tem mais pra onde voltar na tela e só ocuparia espaço no localStorage.
// `marca` é "dia:faixa" — a identidade da leitura, montada em lib/momento.js.
// Guardava-se o dia do relógio, e isso quebrava na virada da meia-noite: à
// 00h01 o dia mudava, a marca do cache não batia mais e o app gerava outra
// leitura da noite com os mesmos dados que tinha lido às 23h.
function readCache(userId, marca) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached?.marca === marca ? cached.analise : null;
  } catch {
    return null;
  }
}

function writeCache(userId, marca, analise) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ marca, analise }));
  } catch {
    // Navegador sem espaço ou em aba anônima: seguir sem cache é melhor que
    // quebrar a tela — só custa uma geração a mais na próxima abertura.
  }
}

// `invoke` embrulha respostas de erro num FunctionsHttpError e guarda o corpo
// original em `context`. Sem desembrulhar, a tela mostraria "Edge Function
// returned a non-2xx status code" no lugar da mensagem em português que a
// própria função escreveu.
async function readFunctionError(error) {
  const fallback = { code: "desconhecido", message: "Não consegui gerar a leitura agora." };
  try {
    const body = await error.context?.json();
    return body?.message ? { code: body.error ?? "desconhecido", message: body.message } : fallback;
  } catch {
    return fallback;
  }
}

// StrictMode roda os efeitos duas vezes em desenvolvimento, e a primeira
// abertura de cada momento ainda não tem cache pra segurar a segunda chamada —
// sem isso cada visita gastaria duas gerações da cota.
//
// A chamada em curso carrega a marca dela junto: se a virada das 14h pegar uma
// geração no meio, a leitura da tarde não pode receber de volta a promessa que
// estava buscando a da manhã.
let inFlight = null;

export function fetchAiInsights(summary, userId) {
  const marca = summary.momentoMarca;
  const cached = readCache(userId, marca);
  if (cached) return Promise.resolve({ ...cached, doCache: true });
  if (inFlight?.marca === marca) return inFlight.promise;

  const promise = requestAnalysis(summary, userId).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });

  inFlight = { marca, promise };
  return promise;
}

async function requestAnalysis(summary, userId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke("insights-ia", {
    body: { summary },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    const { code, message } = await readFunctionError(error);
    const failure = new Error(message);
    failure.code = code;
    throw failure;
  }

  writeCache(userId, summary.momentoMarca, data);
  return { ...data, doCache: false };
}

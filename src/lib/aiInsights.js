// Ponte entre o app e a Edge Function que fala com o Gemini.
//
// A análise é gerada três vezes por dia — manhã, tarde e noite (ver
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
import { todayISO } from "./date.js";

const CACHE_PREFIX = "meuritmo:aiInsights:";

// Os nomes que a função devolve, traduzidos pras chaves que o resto do app já
// usa (as mesmas de lib/insights.js). Se mudar aqui, mude o AREAS da função.
export const AREA_KEY = {
  habitos: "habits",
  forca: "gym",
  corrida: "running",
  diario: "journal",
  tarefas: "tasks",
};

// Pra onde cada destino leva. A aba Treino tem três sub-abas, então o destino
// carrega as duas informações — sem a sub-aba, um clique em "corrida" cairia
// em Força e pareceria botão quebrado.
export const DESTINO_ROTA = {
  habitos: { tab: "habits" },
  forca: { tab: "workout", sub: "gym" },
  corrida: { tab: "workout", sub: "running" },
  diario: { tab: "workout", sub: "journal" },
  tarefas: { tab: "tasks" },
  agenda: { tab: "home" },
};

export const DESTINO_LABEL = {
  habitos: "Hábitos",
  forca: "Força",
  corrida: "Corrida",
  diario: "Diário",
  tarefas: "Tarefas",
  agenda: "Agenda",
};

// Agrupa a lista plana que veio da função nas chaves por área que os painéis
// esperam. Área sem nada devolve lista vazia, que é o que o InsightsPanel já
// sabe tratar.
export function byArea(areas = []) {
  const out = { habits: [], gym: [], running: [], journal: [], tasks: [] };
  areas.forEach((item, i) => {
    const key = AREA_KEY[item.area];
    if (!key) return;
    out[key].push({ id: `ai-${item.area}-${i}`, tone: item.tom, text: item.texto, ai: true });
  });
  return out;
}

// O cache leva o id da pessoa junto: duas contas no mesmo navegador não podem
// ver a leitura uma da outra.
const cacheKey = (userId) => `${CACHE_PREFIX}${userId ?? "anon"}`;

// Guarda só a leitura do momento corrente: assim que a tarde chega, a da manhã
// não tem mais pra onde voltar na tela e só ocuparia espaço no localStorage.
function readCache(userId, momento) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached?.dia === todayISO() && cached?.momento === momento ? cached.analise : null;
  } catch {
    return null;
  }
}

function writeCache(userId, momento, analise) {
  try {
    localStorage.setItem(
      cacheKey(userId),
      JSON.stringify({ dia: todayISO(), momento, analise }),
    );
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
// A chamada em curso carrega o momento dela junto: se a virada das 12h pegar
// uma geração no meio, a leitura da tarde não pode receber de volta a promessa
// que estava buscando a da manhã.
let inFlight = null;

export function fetchAiInsights(summary, userId) {
  const momento = summary.momento;
  const cached = readCache(userId, momento);
  if (cached) return Promise.resolve({ ...cached, doCache: true });
  if (inFlight?.momento === momento) return inFlight.promise;

  const promise = requestAnalysis(summary, userId).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });

  inFlight = { momento, promise };
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

  writeCache(userId, summary.momento, data);
  return { ...data, doCache: false };
}

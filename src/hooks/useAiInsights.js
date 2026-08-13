import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildInsights } from "../lib/insights.js";
import { buildAiSummary, hasEnoughDataForAi } from "../lib/aiSummary.js";
import { byArea, fetchAiInsights } from "../lib/aiInsights.js";
import { momentoAtual, msAteProximoMomento } from "../lib/momento.js";
import { todayISO } from "../lib/date.js";

const VAZIO = { habits: [], gym: [], running: [], journal: [], tasks: [] };

// Em que momento do dia o app está agora — e quando ele virar, avisa.
//
// Sem isso a leitura da tarde só chegaria pra quem fechasse e abrisse o app
// depois das 12h. Ela deixa o app aberto no celular o dia inteiro, então a
// virada precisa acontecer sozinha.
//
// Dois gatilhos porque nenhum dos dois basta: o timer sozinho não sobrevive ao
// celular dormindo com o app em segundo plano, e o `visibilitychange` sozinho
// não pega o app que ficou a tarde toda aberto na frente dela.
function useMomento() {
  const [momento, setMomento] = useState(momentoAtual);

  useEffect(() => {
    let timer;

    const conferir = () => {
      // Devolver o objeto anterior quando a faixa não mudou é o que segura o
      // resto do hook parado: identidade nova aqui recalcularia o resumo e
      // reabriria a discussão de gerar de novo a cada conferida.
      setMomento((atual) => {
        const agora = momentoAtual();
        return agora.chave === atual.chave ? atual : agora;
      });
      clearTimeout(timer);
      timer = setTimeout(conferir, msAteProximoMomento());
    };

    timer = setTimeout(conferir, msAteProximoMomento());
    document.addEventListener("visibilitychange", conferir);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, []);

  return momento;
}

// Uma chamada só pro app inteiro, feita no App e distribuída daqui pras abas.
//
// O motor de regras roda sempre e é o piso: ele recalcula a cada marcação, não
// custa nada e funciona offline. A camada escrita entra por cima quando chega —
// e quando não chega (cota estourada, sem internet), as telas continuam com o
// que sempre tiveram, em vez de ficarem vazias esperando.
export function useAiInsights({ userId, ready, data }) {
  const momento = useMomento();
  const regras = useMemo(() => buildInsights(data), [data]);
  const summary = useMemo(
    () => buildAiSummary(data, regras, momento),
    [data, regras, momento],
  );

  // Começa em "loading", não em "idle": o efeito abaixo roda logo depois do
  // primeiro render, e sair de "sem IA" pra "carregando" faria as linhas da
  // tela pularem de lugar num quadro.
  const [state, setState] = useState({
    status: "loading",
    analise: null,
    erro: null,
    momento: null,
  });

  // Uma tentativa por momento do dia, não por sessão. Guarda dia e faixa
  // juntos: sem o dia, o app aberto a noite inteira atravessaria a meia-noite
  // achando que já tinha feito a leitura da manhã seguinte.
  //
  // Sem essa trava, cada hábito marcado mudaria `summary` e dispararia o efeito
  // de novo — e o cache do momento só existe depois que a primeira geração
  // termina.
  const pediuRef = useRef(null);

  const gerar = useCallback((summaryAtual) => {
    setState({ status: "loading", analise: null, erro: null, momento: null });
    return fetchAiInsights(summaryAtual, userId).then(
      (analise) =>
        setState({
          status: "ready",
          analise,
          erro: null,
          momento: summaryAtual.momentoNome,
        }),
      (err) =>
        setState({
          status: "error",
          analise: null,
          erro: { code: err.code, message: err.message },
          momento: null,
        }),
    );
  }, [userId]);

  useEffect(() => {
    if (!userId || !ready) return;

    const marca = `${todayISO()}:${momento.chave}`;
    if (pediuRef.current === marca) return;

    if (!hasEnoughDataForAi(summary)) {
      setState({ status: "insufficient", analise: null, erro: null, momento: null });
      return;
    }

    pediuRef.current = marca;
    gerar(summary);
  }, [userId, ready, summary, momento, gerar]);

  // A tela de erro tem botão de tentar de novo: só sucesso vai pro cache, então
  // uma nova tentativa sempre alcança a função de verdade.
  const retry = useCallback(() => gerar(summary), [gerar, summary]);

  const areas = useMemo(
    () => (state.analise ? byArea(state.analise.areas) : VAZIO),
    [state.analise],
  );

  return {
    regras,
    status: state.status,
    erro: state.erro,
    perfil: state.analise?.perfil ?? null,
    geradoEm: state.analise?.geradoEm ?? null,
    momento: state.momento,
    areas,
    retry,
  };
}

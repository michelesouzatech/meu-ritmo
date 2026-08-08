import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildInsights } from "../lib/insights.js";
import { buildAiSummary, hasEnoughDataForAi } from "../lib/aiSummary.js";
import { byArea, fetchAiInsights } from "../lib/aiInsights.js";

const VAZIO = { habits: [], gym: [], running: [], journal: [], tasks: [] };

// Uma chamada só pro app inteiro, feita no App e distribuída daqui pras abas.
//
// O motor de regras roda sempre e é o piso: ele recalcula a cada marcação, não
// custa nada e funciona offline. A camada escrita entra por cima quando chega —
// e quando não chega (cota estourada, sem internet), as telas continuam com o
// que sempre tiveram, em vez de ficarem vazias esperando.
export function useAiInsights({ userId, ready, data }) {
  const regras = useMemo(() => buildInsights(data), [data]);
  const summary = useMemo(() => buildAiSummary(data, regras), [data, regras]);

  // Começa em "loading", não em "idle": o efeito abaixo roda logo depois do
  // primeiro render, e sair de "sem IA" pra "carregando" faria as linhas da
  // tela pularem de lugar num quadro.
  const [state, setState] = useState({ status: "loading", analise: null, erro: null });

  // Uma tentativa por sessão. Sem isso, cada hábito marcado mudaria `summary`
  // e dispararia o efeito de novo — e o cache do dia só existe depois que a
  // primeira geração termina.
  const pediuRef = useRef(false);

  const gerar = useCallback(
    (summaryAtual) => {
      pediuRef.current = true;
      setState({ status: "loading", analise: null, erro: null });
      return fetchAiInsights(summaryAtual, userId).then(
        (analise) => setState({ status: "ready", analise, erro: null }),
        (err) =>
          setState({
            status: "error",
            analise: null,
            erro: { code: err.code, message: err.message },
          }),
      );
    },
    [userId],
  );

  useEffect(() => {
    if (!userId || !ready || pediuRef.current) return;
    if (!hasEnoughDataForAi(summary)) {
      setState({ status: "insufficient", analise: null, erro: null });
      return;
    }
    gerar(summary);
  }, [userId, ready, summary, gerar]);

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
    areas,
    retry,
  };
}

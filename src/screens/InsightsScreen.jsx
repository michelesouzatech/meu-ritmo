import { Sparkles } from "lucide-react";

// A leitura que cruza as cinco áreas, no Perfil. Vem do motor de regras
// (lib/insights.js) — determinístico, roda offline e não depende de cota de
// API nenhuma.
function InsightsScreen({ regras }) {
  const { taskSummary, paragraph, hasAnyData } = regras;

  if (!hasAnyData) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <div className="ritmo-glass-pill mb-4 flex h-16 w-16 items-center justify-center rounded-full text-ritmo-ink-soft">
          <Sparkles size={28} />
        </div>
        <h1 className="text-xl font-semibold text-ritmo-text">Ainda sem dados suficientes</h1>
        <p className="mt-2 max-w-xs text-sm text-ritmo-muted">
          Use as abas de Tarefas, Hábitos e Treino por alguns dias — assim que
          houver registro, cada aba mostra os próprios insights e aqui eles
          viram um resumo só.
        </p>
      </div>
    );
  }

  const taskRatePercent = taskSummary.rate !== null ? Math.round(taskSummary.rate * 100) : null;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">Insights</h1>
        <p className="mt-1 text-sm text-ritmo-muted">
          O que dá pra ver cruzando hábitos, força, corrida, diário e tarefas —
          coisas que nenhuma aba enxerga sozinha.
        </p>
      </header>

      <section className="ritmo-glass rounded-2xl p-5">
        <p className="text-[15px] leading-relaxed text-ritmo-text">{paragraph}</p>

        {taskRatePercent !== null && (
          <p className="mt-4 border-t border-ritmo-line pt-3 text-xs text-ritmo-muted">
            Na semana: <strong className="font-semibold text-ritmo-text">{taskRatePercent}%</strong>{" "}
            das tarefas com data concluídas ({taskSummary.done} de {taskSummary.total}).
          </p>
        )}
      </section>
    </div>
  );
}

export default InsightsScreen;

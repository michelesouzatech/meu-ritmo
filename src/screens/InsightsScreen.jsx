import { ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { DESTINO_LABEL, DESTINO_ROTA } from "../lib/aiInsights.js";

// No Perfil o formato é texto corrido, costurando as áreas. A lista separada
// em "evoluindo / melhorar / sugestões" mudou de lugar: cada aba mostra a
// própria, com detalhe. Aqui o que interessa é a leitura que cruza tudo.
//
// Quando a leitura do Gemini chega, é ela que ocupa o card. Quando não chega —
// cota do dia estourada, sem internet, pouco histórico — entra o parágrafo do
// motor de regras. Nunca os dois juntos: seriam duas versões do mesmo assunto
// em palavras diferentes, e a segunda faria a primeira parecer chute.
function stamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const hora = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = date.toDateString() === new Date().toDateString();
  if (hoje) return `hoje, ${hora}`;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}

function AiSkeleton() {
  return (
    <div className="mt-4 flex animate-pulse flex-col gap-2" aria-hidden="true">
      <div className="h-3 w-4/5 rounded-full bg-ritmo-ink-soft/15" />
      <div className="h-3 w-full rounded-full bg-ritmo-ink-soft/10" />
      <div className="h-3 w-2/3 rounded-full bg-ritmo-ink-soft/10" />
    </div>
  );
}

function AcaoRow({ acao, onNavigate }) {
  const rota = DESTINO_ROTA[acao.destino];
  if (!rota) return null;

  return (
    <button
      type="button"
      onClick={() => onNavigate(rota.tab, rota.sub)}
      className="ritmo-inset flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-transform active:scale-[0.99]"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {acao.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-ritmo-text">{acao.texto}</span>
        <span className="block text-[11px] text-ritmo-muted">
          {acao.impacto} · {DESTINO_LABEL[acao.destino]}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ritmo-ink-soft" />
    </button>
  );
}

function InsightsScreen({ regras, ai, onNavigate }) {
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
  const pronto = ai.status === "ready" && ai.perfil;

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
        {pronto ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="ritmo-glass-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ritmo-pink-deep">
                <Sparkles size={12} />
                Leitura do dia
              </span>
              <span className="ml-auto text-[11px] text-ritmo-muted">{stamp(ai.geradoEm)}</span>
            </div>

            <h2 className="text-[15px] font-semibold leading-snug text-ritmo-text">
              {ai.perfil.titulo}
            </h2>

            {ai.perfil.paragrafos.map((texto, i) => (
              <p key={i} className="mt-2.5 text-[15px] leading-relaxed text-ritmo-text">
                {texto}
              </p>
            ))}

            {ai.perfil.acoes.length > 0 && (
              <div className="mt-4 space-y-2">
                {ai.perfil.acoes.map((acao, i) => (
                  <AcaoRow key={i} acao={acao} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-ritmo-text">{paragraph}</p>

            {ai.status === "loading" && (
              <div aria-live="polite">
                <span className="sr-only">Gerando a leitura do dia…</span>
                <AiSkeleton />
              </div>
            )}

            {ai.status === "error" && (
              <div className="mt-4 border-t border-ritmo-line pt-3">
                <p className="text-xs text-ritmo-muted">{ai.erro.message}</p>
                {/* Cota estourada não tem o que tentar de novo: o botão só
                    gastaria o toque dela pra receber o mesmo 429. */}
                {ai.erro.code !== "quota" && (
                  <button
                    type="button"
                    onClick={ai.retry}
                    className="ritmo-ghost mt-2 flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ritmo-pink-deep"
                  >
                    <RefreshCw size={13} />
                    Tentar de novo
                  </button>
                )}
              </div>
            )}
          </>
        )}

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

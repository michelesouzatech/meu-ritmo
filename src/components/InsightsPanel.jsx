import { useState } from "react";
import { ChevronDown, Lightbulb, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

// O painel que cada aba mostra da própria área. Fica sempre com um insight à
// vista — um bloco que só abre depois de tocado passa despercebido no celular
// — e guarda o resto atrás do "ver mais".
//
// Duas origens convivem aqui. As linhas da lista vêm do motor de regras
// (lib/insights.js): contas exatas, instantâneas, que funcionam sem internet.
// O bloco de cima vem do Gemini, três vezes por dia. Eles ficam separados na tela
// de propósito — texto gerado e conta feita não têm a mesma natureza, e
// misturar os dois no mesmo formato esconderia isso de quem lê.
const TONE = {
  up: { icon: TrendingUp, color: "text-ritmo-ink-soft" },
  down: { icon: TrendingDown, color: "text-ritmo-pink-deep" },
  tip: { icon: Lightbulb, color: "text-ritmo-ink-soft" },
};

function InsightRow({ item }) {
  const { icon: Icon, color } = TONE[item.tone] ?? TONE.tip;
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={14} className={`mt-0.5 shrink-0 ${color}`} />
      <span className="text-xs leading-relaxed text-ritmo-text">{item.text}</span>
    </li>
  );
}

function AiSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-1.5" aria-hidden="true">
      <div className="h-2.5 w-full rounded-full bg-ritmo-ink-soft/15" />
      <div className="h-2.5 w-4/5 rounded-full bg-ritmo-ink-soft/10" />
    </div>
  );
}

function InsightsPanel({ items = [], ai = [], aiStatus = "idle", max = 5, className = "" }) {
  const [open, setOpen] = useState(false);

  const aiRows = ai.slice(0, 2);
  const ruleRows = items.slice(0, max);
  const carregando = aiStatus === "loading";

  if (aiRows.length === 0 && ruleRows.length === 0 && !carregando) return null;

  // Uma linha de regra fica SEMPRE à vista, com ou sem leitura da IA em cima.
  //
  // Antes, ter leitura da IA fechava todas as regras atrás do "Ver mais" — pra
  // não deixar o card alto demais no celular. O efeito colateral era o pior
  // possível: as regras são contas exatas e a leitura escrita é a única coisa
  // ali que pode errar, e era justamente a errável que abria o card sozinha.
  // Quem só passava o olho lia exclusivamente o texto gerado.
  //
  // Uma linha é o meio-termo: o card cresce um pouco e nunca fica só com texto
  // gerado à mostra.
  const abertas = open ? ruleRows.length : 1;
  const visiveis = ruleRows.slice(0, abertas);
  const escondidas = ruleRows.length - visiveis.length;

  return (
    <section className={`ritmo-card rounded-2xl p-3.5 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="ritmo-glass-pill flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ritmo-ink-soft">
          <Sparkles size={14} />
        </span>
        <h2 className="text-sm font-semibold text-ritmo-text">Insights</h2>
        {ruleRows.length + aiRows.length > 1 && (
          <span className="ritmo-glass-pill ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold text-ritmo-ink-soft">
            {ruleRows.length + aiRows.length}
          </span>
        )}
      </div>

      {/* Erro e cota estourada passam batido aqui: numa aba de uso diário, um
          aviso vermelho pra dizer que o texto extra não veio seria barulho.
          Quem quiser o motivo (e o botão de tentar de novo) encontra no
          Perfil, que é onde a leitura da IA é o assunto principal. */}
      {(aiRows.length > 0 || carregando) && (
        <div className="ritmo-inset mb-2.5 rounded-xl p-2.5">
          {carregando ? (
            <div aria-live="polite">
              <span className="sr-only">Gerando a leitura do dia…</span>
              <AiSkeleton />
            </div>
          ) : (
            <ul className="space-y-2">
              {aiRows.map((item) => (
                <InsightRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}

      {visiveis.length > 0 && (
        <ul className="space-y-2">
          {visiveis.map((item) => (
            <InsightRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      {escondidas > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1 flex min-h-9 w-full items-center justify-center gap-1 text-xs font-semibold text-ritmo-ink-soft"
        >
          {open ? "Ver menos" : `Ver mais ${escondidas}`}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

export default InsightsPanel;

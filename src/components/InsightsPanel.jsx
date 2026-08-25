import { Lightbulb, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

// O painel que cada aba mostra da própria área: no máximo 1 sucesso e 1
// melhoria, sempre à vista, sem "ver mais" pra abrir.
//
// Antes cabiam até 5 regras atrás de um "ver mais" e mais duas linhas escritas
// pela IA em cima. Isso empilhava insights demais na mesma tela — a leitura
// cruzada e mais completa da IA já tem lugar próprio no Perfil, que reúne
// todas as áreas de uma vez.
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

function InsightsPanel({ items = [], className = "" }) {
  const success = items.find((i) => i.tone === "up");
  // Sem melhoria (queda) pra mostrar, a melhor dica ocupa o lugar — o card
  // quase nunca fica só com o lado bom.
  const improvement = items.find((i) => i.tone === "down") ?? items.find((i) => i.tone === "tip");
  const rows = [success, improvement].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <section className={`ritmo-card rounded-2xl p-3.5 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="ritmo-glass-pill flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ritmo-ink-soft">
          <Sparkles size={14} />
        </span>
        <h2 className="text-sm font-semibold text-ritmo-text">Insights</h2>
      </div>

      <ul className="space-y-2">
        {rows.map((item) => (
          <InsightRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

export default InsightsPanel;

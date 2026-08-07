import { useState } from "react";
import { ChevronDown, Lightbulb, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

// O painel que cada aba mostra da própria área. Fica sempre com um insight à
// vista — um bloco que só abre depois de tocado passa despercebido no celular
// — e guarda o resto atrás do "ver mais".
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

function InsightsPanel({ items = [], max = 5, className = "" }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const list = items.slice(0, max);
  const visible = open ? list : list.slice(0, 1);
  const hidden = list.length - 1;

  return (
    <section className={`ritmo-card rounded-2xl p-3.5 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="ritmo-glass-pill flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ritmo-ink-soft">
          <Sparkles size={14} />
        </span>
        <h2 className="text-sm font-semibold text-ritmo-text">Insights</h2>
        {list.length > 1 && (
          <span className="ritmo-glass-pill ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold text-ritmo-ink-soft">
            {list.length}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {visible.map((item) => (
          <InsightRow key={item.id} item={item} />
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1 flex min-h-9 w-full items-center justify-center gap-1 text-xs font-semibold text-ritmo-ink-soft"
        >
          {open ? "Ver menos" : `Ver mais ${hidden}`}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

export default InsightsPanel;

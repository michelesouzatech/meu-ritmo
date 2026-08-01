import { Sparkles, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { buildInsights } from "../lib/insights.js";
import { formatDatePtBr } from "../lib/date.js";

function InsightCard({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-ritmo-text/5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ritmo-pink-light text-ritmo-pink-deep">
        <Icon size={16} />
      </div>
      <p className="text-sm text-ritmo-text">{text}</p>
    </div>
  );
}

function InsightSection({ title, icon, items, emptyText }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-base font-semibold text-ritmo-text">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-center text-sm text-ritmo-text/50 shadow-sm shadow-ritmo-text/5">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <InsightCard key={item.id} icon={icon} text={item.text} />
          ))}
        </div>
      )}
    </section>
  );
}

function InsightsScreen({ tasks, habits, workout, bodyFat, calendar }) {
  const { taskSummary, calendarSummary, evolutions, improvements, suggestions, hasAnyData } =
    buildInsights({
      tasks,
      habits,
      workout,
      bodyFat,
      events: calendar?.events ?? [],
      calendarConnected: calendar?.status === "ready",
    });

  if (!hasAnyData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ritmo-pink-light text-ritmo-pink-deep">
          <Sparkles size={28} />
        </div>
        <h1 className="text-xl font-semibold text-ritmo-text">Ainda sem dados suficientes</h1>
        <p className="mt-2 max-w-xs text-sm text-ritmo-text/50">
          Use as abas de Tarefas, Hábitos e Treino por alguns dias — assim que houver dados, essa
          tela cruza tudo pra você.
        </p>
      </div>
    );
  }

  const taskRatePercent = taskSummary.rate !== null ? Math.round(taskSummary.rate * 100) : null;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ritmo-text">Insights</h1>
        <p className="mt-1 text-sm text-ritmo-text/60">
          {formatDatePtBr(taskSummary.start)} – {formatDatePtBr(taskSummary.end)}
        </p>
      </header>

      <section className="mb-6 rounded-2xl bg-gradient-to-br from-ritmo-pink-deep to-ritmo-pink px-4 py-4 text-white shadow-md shadow-ritmo-pink/30">
        <p className="text-xs opacity-90">Resumo da semana</p>
        <p className="mt-1 text-sm font-medium leading-snug">
          {taskRatePercent !== null
            ? `Essa semana você completou ${taskRatePercent}% das tarefas (${taskSummary.done} de ${taskSummary.total}).`
            : "Você ainda não tem tarefas com data nessa semana."}
        </p>
        {calendarSummary && (
          <p className="mt-1 text-sm font-medium leading-snug">
            {calendarSummary.upcomingCount === 0
              ? "Sua agenda está vazia nos próximos 7 dias."
              : `Na agenda: ${calendarSummary.upcomingCount} compromisso${calendarSummary.upcomingCount === 1 ? "" : "s"} nos próximos 7 dias${calendarSummary.busyHours > 0 ? ` (cerca de ${calendarSummary.busyHours}h)` : ""}.`}
          </p>
        )}
      </section>

      <InsightSection
        title="O que está evoluindo"
        icon={TrendingUp}
        items={evolutions}
        emptyText="Nada de novo por aqui ainda — continue registrando pra ver evoluções."
      />

      <InsightSection
        title="Onde pode melhorar"
        icon={TrendingDown}
        items={improvements}
        emptyText="Nenhum ponto de atenção agora. Continue assim!"
      />

      <InsightSection
        title="Sugestões práticas"
        icon={Lightbulb}
        items={suggestions}
        emptyText="Sem sugestões por enquanto — está tudo em ritmo bom."
      />
    </div>
  );
}

export default InsightsScreen;

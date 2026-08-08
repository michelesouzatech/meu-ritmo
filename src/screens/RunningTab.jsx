import { useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  Flag,
  MapPin,
  Medal,
  Pencil,
  Target,
  Timer,
} from "lucide-react";
import AddButton from "../components/AddButton.jsx";
import SwipeToDelete from "../components/SwipeToDelete.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import { buildRunningInsights } from "../lib/insights.js";
import { todayISO, formatDatePtBr, toISODate } from "../lib/date.js";
import { formatDistance, formatDuration, formatPaceLabel, paceGap } from "../lib/pace.js";
import {
  daysUntil,
  monthConsistency,
  nextRace,
  pastRaces,
  racePace,
  sessionPace,
  upcomingRaces,
  weekProgress,
  weekStartISO,
} from "../lib/running.js";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function countdownText(days) {
  if (days === 0) return "é hoje!";
  if (days === 1) return "é amanhã";
  return `faltam ${days} dias`;
}

function rankText(race) {
  const parts = [];
  if (race.rankOverall) parts.push(`${race.rankOverall}º geral`);
  if (race.rankCategory) parts.push(`${race.rankCategory}º na categoria`);
  return parts.join(" · ");
}

/* ------------------------------ próxima prova ------------------------------ */

function NextRaceCard({ race, onEdit, onAddToCalendar, calendarReady }) {
  const days = daysUntil(race.date);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState(null);

  async function handleAddToCalendar() {
    setCalendarError(null);
    setAddingToCalendar(true);
    try {
      await onAddToCalendar(race);
    } catch {
      setCalendarError("Não deu pra criar o compromisso agora. Tenta de novo.");
    }
    setAddingToCalendar(false);
  }

  return (
    <section className="ritmo-glass mb-4 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ritmo-ink-soft">
            Próxima prova
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-ritmo-text">{race.name}</h2>
        </div>
        <button
          type="button"
          onClick={() => onEdit(race)}
          aria-label="Editar prova"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
        >
          <Pencil size={15} />
        </button>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight text-ritmo-pink-deep">
        {countdownText(days)}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-ritmo-muted">Quando</dt>
          <dd className="font-medium text-ritmo-text">
            {formatDatePtBr(race.date)}
            {race.time ? ` · ${race.time}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ritmo-muted">Distância</dt>
          <dd className="font-medium text-ritmo-text">
            {formatDistance(race.distanceKm)}
            {race.category ? ` · ${race.category}` : ""}
          </dd>
        </div>
        {race.location && (
          <div className="col-span-2">
            <dt className="text-ritmo-muted">Onde</dt>
            <dd className="flex items-center gap-1 font-medium text-ritmo-text">
              <MapPin size={12} className="shrink-0 text-ritmo-muted" />
              <span className="truncate">{race.location}</span>
            </dd>
          </div>
        )}
        {race.goalPace && (
          <div className="col-span-2">
            <dt className="text-ritmo-muted">Pace meta</dt>
            <dd className="flex items-center gap-1 font-medium text-ritmo-text">
              <Target size={12} className="shrink-0 text-ritmo-pink" />
              {formatPaceLabel(race.goalPace)}
            </dd>
          </div>
        )}
      </dl>

      {calendarReady && !race.calendarEventId && (
        <button
          type="button"
          onClick={handleAddToCalendar}
          disabled={addingToCalendar}
          className="ritmo-ghost mt-3 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-ritmo-ink-soft disabled:opacity-60"
        >
          <CalendarPlus size={14} />
          {addingToCalendar ? "Adicionando..." : "Adicionar à Google Agenda"}
        </button>
      )}
      {race.calendarEventId && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ritmo-muted">
          <CalendarPlus size={13} />
          Já está na sua Google Agenda
        </p>
      )}
      {calendarError && (
        <p className="mt-2 text-center text-xs text-ritmo-pink-deep">{calendarError}</p>
      )}
    </section>
  );
}

/* --------------------------------- plano --------------------------------- */

// A faixa da semana: um ponto por dia, cheio quando teve corrida.
function PlanWeekStrip({ sessions, planId, onPickDay }) {
  const today = todayISO();
  const start = weekStartISO(today);
  const byDate = new Set(
    sessions.filter((s) => s.planId === planId).map((s) => s.date),
  );

  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${start}T00:00:00`);
        d.setDate(d.getDate() + i);
        const iso = toISODate(d);
        const ran = byDate.has(iso);
        const isFuture = iso > today;
        const isToday = iso === today;

        return (
          <div key={iso} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium text-ritmo-muted">
              {WEEKDAY_LABELS[d.getDay()]}
            </span>
            <button
              type="button"
              disabled={isFuture}
              onClick={() => onPickDay(iso)}
              aria-label={
                ran ? `Corrida em ${formatDatePtBr(iso)}` : `Registrar corrida em ${formatDatePtBr(iso)}`
              }
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-transform disabled:opacity-30 enabled:hover:scale-105"
              style={{
                backgroundColor: ran ? "var(--color-ritmo-pink-deep)" : "transparent",
                color: ran ? "#fff" : "var(--color-ritmo-text)",
                border: isToday
                  ? "1.5px solid var(--color-ritmo-pink)"
                  : "1.5px solid var(--color-ritmo-line)",
              }}
            >
              {d.getDate()}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ConsistencyBar({ done, target }) {
  const ratio = target > 0 ? Math.min(1, done / target) : 0;
  const percent = target > 0 ? Math.round((done / target) * 100) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-ritmo-muted">Consistência do mês</p>
        <p className="text-xs font-semibold text-ritmo-text">
          {target > 0 ? `${done} de ${target}` : "começando"}
          {percent !== null && <span className="ml-1 text-ritmo-pink-deep">({percent}%)</span>}
        </p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ritmo-line">
        <div
          className="h-full rounded-full bg-ritmo-pink transition-[width] duration-500"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function PlanCard({ plan, race, sessions, onEdit, onArchive, onPickDay }) {
  const week = weekProgress(plan, sessions, todayISO());
  const month = monthConsistency(plan, sessions, race);
  const goalPace = plan.goalPace ?? race?.goalPace ?? null;
  const weekDone = week.done >= week.target;

  return (
    <section className="ritmo-card mb-4 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ritmo-text">{plan.name}</p>
          <p className="mt-0.5 text-xs text-ritmo-muted">
            {race ? `pra ${race.name}` : "sem prova vinculada"}
            {goalPace ? ` · meta ${formatPaceLabel(goalPace)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="ritmo-glass-pill rounded-full px-2.5 py-1 text-xs font-semibold text-ritmo-ink-soft">
            {plan.weeklyTarget}x/semana
          </span>
          <button
            type="button"
            onClick={() => onEdit(plan)}
            aria-label="Editar plano"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ritmo-text/30 transition-colors hover:bg-ritmo-hover hover:text-ritmo-ink-soft"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <PlanWeekStrip sessions={sessions} planId={plan.id} onPickDay={onPickDay} />
        <p className="mt-2 text-center text-xs font-medium text-ritmo-text">
          {week.done} de {week.target} essa semana
          {weekDone && <span className="ml-1 text-ritmo-pink-deep">— meta batida</span>}
        </p>
      </div>

      <div className="mt-4">
        <ConsistencyBar done={month.done} target={month.target} />
      </div>

      <button
        type="button"
        onClick={() => onArchive(plan.id)}
        className="mt-3 w-full text-xs text-ritmo-muted underline underline-offset-2"
      >
        Encerrar este plano
      </button>
    </section>
  );
}

/* ------------------------------- histórico ------------------------------- */

function SessionRow({ session, goalPace, onEdit, onDelete }) {
  const pace = sessionPace(session);
  const gap = pace && goalPace ? paceGap(pace, goalPace) : null;

  return (
    <SwipeToDelete onDelete={() => onDelete(session.id)} deleteLabel="Excluir corrida">
      <button
        type="button"
        onClick={() => onEdit(session)}
        className="ritmo-card flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ritmo-text">
            {formatDatePtBr(session.date)}
            {session.kind && (
              <span className="ml-2 text-xs font-normal text-ritmo-ink-soft">
                {session.kind}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ritmo-muted">
            {session.distanceKm ? formatDistance(session.distanceKm) : "sem distância"}
            {session.duration ? ` · ${formatDuration(session.duration)}` : ""}
          </p>
        </div>
        {pace && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-ritmo-text">{formatPaceLabel(pace)}</p>
            {gap && (
              <p
                className={`text-[11px] ${gap.diff <= 0 ? "text-ritmo-pink-deep" : "text-ritmo-muted"}`}
              >
                {gap.text}
              </p>
            )}
          </div>
        )}
      </button>
    </SwipeToDelete>
  );
}

function PastRaceRow({ race, onEdit, onDelete }) {
  const pace = racePace(race);
  const gap = pace && race.goalPace ? paceGap(pace, race.goalPace) : null;
  const ranks = rankText(race);
  const missingResult = !race.resultTime;

  return (
    <SwipeToDelete onDelete={() => onDelete(race.id)} deleteLabel="Excluir prova">
      <button
        type="button"
        onClick={() => onEdit(race)}
        className="ritmo-card w-full p-3 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ritmo-text">{race.name}</p>
            <p className="mt-0.5 text-xs text-ritmo-muted">
              {formatDatePtBr(race.date)} · {formatDistance(race.distanceKm)}
              {race.category ? ` · ${race.category}` : ""}
            </p>
          </div>
          {pace && (
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-ritmo-text">{formatPaceLabel(pace)}</p>
              <p className="text-[11px] text-ritmo-muted">{formatDuration(race.resultTime)}</p>
            </div>
          )}
        </div>

        {missingResult ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ritmo-pink-deep">
            <Timer size={13} />
            Como foi? Toque pra registrar seu tempo.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {gap && (
              <span className={gap.diff <= 0 ? "text-ritmo-pink-deep" : "text-ritmo-muted"}>
                {gap.diff <= 0 ? "bateu a meta" : gap.text}
              </span>
            )}
            {ranks && (
              <span className="flex items-center gap-1 text-ritmo-muted">
                <Medal size={12} />
                {ranks}
              </span>
            )}
          </div>
        )}
      </button>
    </SwipeToDelete>
  );
}

function Collapsible({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-base font-semibold text-ritmo-text">{title}</h2>
        <span className="flex shrink-0 items-center gap-2">
          <span className="ritmo-glass-pill rounded-full px-2.5 py-1 text-xs font-semibold text-ritmo-ink-soft">
            {count}
          </span>
          <ChevronDown
            size={16}
            className={`text-ritmo-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </section>
  );
}

/* ------------------------------- a aba toda ------------------------------- */

function RunningTab({
  races,
  plan,
  sessions,
  calendarReady,
  ai = [],
  aiStatus,
  onAddRace,
  onEditRace,
  onDeleteRace,
  onAddToCalendar,
  onAddPlan,
  onEditPlan,
  onArchivePlan,
  onAddSession,
  onEditSession,
  onDeleteSession,
}) {
  const today = todayISO();
  const upcoming = upcomingRaces(races, today);
  const next = nextRace(races, today);
  const past = pastRaces(races, today);
  const planRace = plan?.raceId ? races.find((r) => r.id === plan.raceId) : null;
  const goalPace = plan?.goalPace ?? planRace?.goalPace ?? null;

  const recentSessions = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const laterRaces = upcoming.filter((r) => r.id !== next?.id);

  const insights = useMemo(
    () => buildRunningInsights({ races, plan, sessions }),
    [races, plan, sessions],
  );

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ritmo-muted">
          {races.length === 0
            ? "Nenhuma prova cadastrada"
            : `${races.length} prova${races.length > 1 ? "s" : ""} · ${sessions.length} corrida${sessions.length === 1 ? "" : "s"}`}
        </p>
        <AddButton label="Corrida" onClick={() => onAddSession(today)} />
      </header>

      {next ? (
        <NextRaceCard
          race={next}
          onEdit={onEditRace}
          onAddToCalendar={onAddToCalendar}
          calendarReady={calendarReady}
        />
      ) : (
        <section className="ritmo-card mb-4 rounded-2xl p-4 text-center">
          <div className="ritmo-glass-pill mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full text-ritmo-ink-soft">
            <Flag size={20} />
          </div>
          <p className="text-sm text-ritmo-muted">
            Nenhuma prova marcada. Cadastre a próxima pra o app contar os dias e
            acompanhar seu pace rumo à meta.
          </p>
          <button
            type="button"
            onClick={onAddRace}
            className="ritmo-cta mx-auto mt-3 flex min-h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
          >
            <Flag size={14} />
            Cadastrar prova
          </button>
        </section>
      )}

      {plan ? (
        <PlanCard
          plan={plan}
          race={planRace}
          sessions={sessions}
          onEdit={onEditPlan}
          onArchive={onArchivePlan}
          onPickDay={onAddSession}
        />
      ) : (
        <section className="ritmo-card mb-4 rounded-2xl p-4 text-center">
          <p className="text-sm text-ritmo-muted">
            Sem plano de treino ativo. Defina quantas vezes por semana você quer
            correr e o app acompanha sua consistência.
          </p>
          <button
            type="button"
            onClick={onAddPlan}
            className="ritmo-ghost mx-auto mt-3 flex min-h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-ritmo-ink-soft"
          >
            <Target size={14} />
            Criar plano de treino
          </button>
        </section>
      )}

      {next && (
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={onAddRace}
            className="ritmo-ghost flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-ritmo-ink-soft"
          >
            <Flag size={14} />
            Nova prova
          </button>
          {!plan && (
            <button
              type="button"
              onClick={onAddPlan}
              className="ritmo-ghost flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-ritmo-ink-soft"
            >
              <Target size={14} />
              Novo plano
            </button>
          )}
        </div>
      )}

      <InsightsPanel items={insights} ai={ai} aiStatus={aiStatus} className="mb-4" />

      {recentSessions.length > 0 && (
        <Collapsible title="Últimas corridas" count={sessions.length} defaultOpen>
          {recentSessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              goalPace={goalPace}
              onEdit={onEditSession}
              onDelete={onDeleteSession}
            />
          ))}
        </Collapsible>
      )}

      {laterRaces.length > 0 && (
        <Collapsible title="Outras provas marcadas" count={laterRaces.length}>
          {laterRaces.map((race) => (
            <PastRaceRow
              key={race.id}
              race={race}
              onEdit={onEditRace}
              onDelete={onDeleteRace}
            />
          ))}
        </Collapsible>
      )}

      {past.length > 0 && (
        <Collapsible title="Provas realizadas" count={past.length}>
          {past.map((race) => (
            <PastRaceRow
              key={race.id}
              race={race}
              onEdit={onEditRace}
              onDelete={onDeleteRace}
            />
          ))}
        </Collapsible>
      )}
    </div>
  );
}

export default RunningTab;

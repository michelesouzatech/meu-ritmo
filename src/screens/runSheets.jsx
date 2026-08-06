import { useState } from "react";
import Sheet from "../components/Sheet.jsx";
import { todayISO, formatDatePtBr } from "../lib/date.js";
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatPaceLabel,
  paceFrom,
  parseDistance,
  parseDuration,
  parsePace,
} from "../lib/pace.js";
import { upcomingRaces } from "../lib/running.js";

// Valores redondos de propósito: a coluna guarda 3 casas, então 21,0975 voltaria
// do banco como 21,098 e o botão deixaria de aparecer marcado.
const COMMON_DISTANCES = [
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "21,1 km", value: 21.1 },
  { label: "42,2 km", value: 42.2 },
];

const RUN_KINDS = ["longão", "intervalado", "leve", "tiro", "regenerativo"];

const fieldClass = "ritmo-field min-h-11 w-full rounded-xl px-3 text-sm";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ritmo-text/70">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ritmo-muted">{hint}</p>}
    </div>
  );
}

// Botões de distância comum + campo livre pra prova de 7k, 8k e afins.
function DistancePicker({ value, onChange }) {
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {COMMON_DISTANCES.map((option) => {
          const active = parseDistance(value) === option.value;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(String(option.value).replace(".", ","))}
              className={`min-h-9 rounded-full px-3 text-xs font-semibold transition-colors ${
                active
                  ? "ritmo-cta"
                  : "ritmo-glass-pill text-ritmo-lilac-ink hover:brightness-95"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: 7,5"
        className={fieldClass}
      />
    </>
  );
}

/* --------------------------------- prova --------------------------------- */

export function RaceFormSheet({ race, onClose, onSave, onDelete }) {
  const isEditing = !!race;
  const isPast = isEditing && race.date < todayISO();

  const [name, setName] = useState(race?.name ?? "");
  const [date, setDate] = useState(race?.date ?? "");
  const [time, setTime] = useState(race?.time ?? "");
  const [location, setLocation] = useState(race?.location ?? "");
  const [distance, setDistance] = useState(
    race ? String(race.distanceKm).replace(".", ",") : "5",
  );
  const [category, setCategory] = useState(race?.category ?? "");
  const [goalPace, setGoalPace] = useState(race?.goalPace ? formatPace(race.goalPace) : "");
  const [resultTime, setResultTime] = useState(
    race?.resultTime ? formatDuration(race.resultTime) : "",
  );
  const [rankOverall, setRankOverall] = useState(race?.rankOverall ?? "");
  const [rankCategory, setRankCategory] = useState(race?.rankCategory ?? "");
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const distanceKm = parseDistance(distance);
  const resultSeconds = parseDuration(resultTime);
  // O pace oficial sai do tempo — a pessoa não digita os dois.
  const computedPace = paceFrom(distanceKm, resultSeconds);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome pra prova.");
    if (!date) return setError("Escolha a data da prova.");
    if (!distanceKm) return setError("Informe a distância em km (ex: 5 ou 7,5).");
    if (goalPace.trim() && parsePace(goalPace) === null) {
      return setError("Pace meta em minutos por km, no formato 6:00.");
    }
    if (resultTime.trim() && resultSeconds === null) {
      return setError("Tempo oficial no formato 30:00 (ou 1:45:20 pra provas longas).");
    }

    setError(null);
    onSave({
      name: name.trim(),
      date,
      time: time || "",
      location: location.trim(),
      distanceKm,
      category: category.trim(),
      goalPace: goalPace.trim() ? parsePace(goalPace) : null,
      resultTime: resultSeconds,
      rankOverall: rankOverall === "" ? null : Number(rankOverall),
      rankCategory: rankCategory === "" ? null : Number(rankCategory),
    });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar prova" : "Nova prova"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Nome da prova">
          <input
            autoFocus={!isEditing}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Corrida Unimed"
            className={fieldClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Horário">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>

        <Field label="Local">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ex: Parque Barigui, Curitiba"
            className={fieldClass}
          />
        </Field>

        <Field label="Distância">
          <DistancePicker value={distance} onChange={setDistance} />
        </Field>

        <Field label="Categoria inscrita" hint="Como aparece na sua inscrição.">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex: F30-34"
            className={fieldClass}
          />
        </Field>

        <Field label="Pace meta" hint="Minutos por km. Deixe em branco se ainda não definiu.">
          <input
            inputMode="numeric"
            value={goalPace}
            onChange={(e) => setGoalPace(e.target.value)}
            placeholder="Ex: 6:00"
            className={fieldClass}
          />
        </Field>

        {/* Só faz sentido preencher resultado de prova que já aconteceu. */}
        {(isPast || race?.resultTime) && (
          <div className="ritmo-inset space-y-4 rounded-xl p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ritmo-lilac-ink">
              Resultado
            </p>

            <Field
              label="Tempo oficial"
              hint={
                computedPace
                  ? `Seu pace foi ${formatPaceLabel(computedPace)} em ${formatDistance(distanceKm)}.`
                  : "Ex: 30:00 nos 5k. O app calcula seu pace."
              }
            >
              <input
                inputMode="numeric"
                value={resultTime}
                onChange={(e) => setResultTime(e.target.value)}
                placeholder="Ex: 30:00"
                className={fieldClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Colocação geral">
                <input
                  type="number"
                  min="1"
                  value={rankOverall}
                  onChange={(e) => setRankOverall(e.target.value)}
                  placeholder="Ex: 142"
                  className={fieldClass}
                />
              </Field>
              <Field label="Na categoria">
                <input
                  type="number"
                  min="1"
                  value={rankCategory}
                  onChange={(e) => setRankCategory(e.target.value)}
                  placeholder="Ex: 8"
                  className={fieldClass}
                />
              </Field>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-ritmo-pink-deep">{error}</p>}

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Cadastrar prova"}
        </button>
      </form>

      {isEditing &&
        (confirmingDelete ? (
          <div className="ritmo-inset mt-3 rounded-xl p-3 text-center">
            <p className="text-sm text-ritmo-text">Excluir "{race.name}"?</p>
            <p className="mt-1 text-xs text-ritmo-muted">
              Seu plano de treino e suas corridas continuam salvos — só perdem o
              vínculo com esta prova.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="ritmo-ghost min-h-11 flex-1 rounded-full text-sm font-semibold text-ritmo-text/70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(race.id);
                  onClose();
                }}
                className="min-h-11 flex-1 rounded-full bg-ritmo-pink-deep text-sm font-semibold text-white transition-transform active:scale-[0.98]"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light"
          >
            Excluir prova
          </button>
        ))}
    </Sheet>
  );
}

/* --------------------------------- plano --------------------------------- */

export function RunPlanFormSheet({ plan, races, onClose, onSave }) {
  const isEditing = !!plan;
  const options = upcomingRaces(races, todayISO());

  const [name, setName] = useState(plan?.name ?? "");
  const [raceId, setRaceId] = useState(plan?.raceId ?? "");
  const [weeklyTarget, setWeeklyTarget] = useState(plan?.weeklyTarget ?? 2);
  const [startDate, setStartDate] = useState(plan?.startDate ?? todayISO());
  const [goalPace, setGoalPace] = useState(plan?.goalPace ? formatPace(plan.goalPace) : "");
  const [error, setError] = useState(null);

  const linkedRace = races.find((r) => r.id === raceId) ?? null;
  // A meta do plano herda a da prova; a pessoa só digita se quiser outra.
  const inheritedPace = linkedRace?.goalPace ?? null;

  function pickRace(id) {
    setRaceId(id);
    const race = races.find((r) => r.id === id);
    if (race && !name.trim()) setName(`Preparação ${race.name}`);
    if (race?.goalPace && !goalPace.trim()) setGoalPace(formatPace(race.goalPace));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome pro plano.");
    if (goalPace.trim() && parsePace(goalPace) === null) {
      return setError("Pace meta no formato 6:00.");
    }

    setError(null);
    onSave({
      name: name.trim(),
      raceId: raceId || null,
      weeklyTarget: Number(weeklyTarget),
      startDate,
      endDate: linkedRace?.date ?? null,
      goalPace: goalPace.trim() ? parsePace(goalPace) : null,
    });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar plano" : "Novo plano de treino"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Pra qual prova?"
          hint="Opcional — dá pra treinar sem prova marcada."
        >
          <select
            value={raceId}
            onChange={(e) => pickRace(e.target.value)}
            className={fieldClass}
          >
            <option value="">Nenhuma prova específica</option>
            {options.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name} — {formatDatePtBr(race.date)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nome do plano">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Preparação Unimed"
            className={fieldClass}
          />
        </Field>

        <Field label="Quantas vezes por semana?">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setWeeklyTarget(n)}
                className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold transition-colors ${
                  Number(weeklyTarget) === n
                    ? "ritmo-cta"
                    : "ritmo-glass-pill text-ritmo-lilac-ink hover:brightness-95"
                }`}
              >
                {n}x
              </button>
            ))}
          </div>
        </Field>

        <Field label="Começa em">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={fieldClass}
          />
        </Field>

        <Field
          label="Pace meta do treino"
          hint={
            inheritedPace
              ? `Veio da prova (${formatPaceLabel(inheritedPace)}). Mude se quiser treinar num pace diferente.`
              : "Opcional. Serve pra comparar com o pace das suas corridas."
          }
        >
          <input
            inputMode="numeric"
            value={goalPace}
            onChange={(e) => setGoalPace(e.target.value)}
            placeholder="Ex: 6:00"
            className={fieldClass}
          />
        </Field>

        {!isEditing && (
          <p className="ritmo-inset rounded-xl px-3 py-2 text-xs text-ritmo-muted">
            Você mantém um plano de cada vez — se já tiver um rodando, ele vira
            histórico e este assume.
          </p>
        )}

        {error && <p className="text-xs text-ritmo-pink-deep">{error}</p>}

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Criar plano"}
        </button>
      </form>
    </Sheet>
  );
}

/* ------------------------------- uma corrida ------------------------------ */

export function RunSessionFormSheet({ session, dateISO, plan, onClose, onSave, onDelete }) {
  const isEditing = !!session;

  const [date, setDate] = useState(session?.date ?? dateISO ?? todayISO());
  const [distance, setDistance] = useState(
    session?.distanceKm ? String(session.distanceKm).replace(".", ",") : "",
  );
  const [duration, setDuration] = useState(
    session?.duration ? formatDuration(session.duration) : "",
  );
  const [kind, setKind] = useState(session?.kind ?? "");
  const [error, setError] = useState(null);

  const distanceKm = parseDistance(distance);
  const durationSeconds = parseDuration(duration);
  const pace = paceFrom(distanceKm, durationSeconds);
  const goalPace = plan?.goalPace ?? null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!date) return setError("Escolha o dia da corrida.");
    if (distance.trim() && distanceKm === null) {
      return setError("Distância em km (ex: 5 ou 5,2).");
    }
    if (duration.trim() && durationSeconds === null) {
      return setError("Tempo no formato 31:12 (ou 45 pra 45 minutos).");
    }

    setError(null);
    onSave({
      date,
      distanceKm,
      duration: durationSeconds,
      kind,
    });
    onClose();
  }

  return (
    <Sheet title={isEditing ? "Editar corrida" : "Registrar corrida"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Dia">
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Distância (km)">
            <input
              autoFocus={!isEditing}
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="Ex: 5,2"
              className={fieldClass}
            />
          </Field>
          <Field label="Tempo">
            <input
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ex: 31:12"
              className={fieldClass}
            />
          </Field>
        </div>

        {/* O pace aparece enquanto ela digita — é o retorno imediato do esforço. */}
        <div className="ritmo-inset rounded-xl px-3 py-2.5 text-center">
          {pace ? (
            <>
              <p className="text-lg font-semibold text-ritmo-pink-deep">
                {formatPaceLabel(pace)}
              </p>
              {goalPace && (
                <p className="mt-0.5 text-xs text-ritmo-muted">
                  {pace <= goalPace
                    ? `dentro da meta de ${formatPaceLabel(goalPace)}`
                    : `meta é ${formatPaceLabel(goalPace)}`}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-ritmo-muted">
              Preencha distância e tempo e o pace aparece aqui.
            </p>
          )}
        </div>

        <Field label="Tipo de treino" hint="Opcional.">
          <div className="flex flex-wrap gap-1.5">
            {RUN_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(kind === option ? "" : option)}
                className={`min-h-9 rounded-full px-3 text-xs font-semibold transition-colors ${
                  kind === option
                    ? "ritmo-cta"
                    : "ritmo-glass-pill text-ritmo-lilac-ink hover:brightness-95"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </Field>

        {!plan && !isEditing && (
          <p className="ritmo-inset rounded-xl px-3 py-2 text-xs text-ritmo-muted">
            Sem plano ativo, esta corrida fica salva no histórico — ela só não
            entra na conta de consistência.
          </p>
        )}

        {error && <p className="text-xs text-ritmo-pink-deep">{error}</p>}

        <button type="submit" className="ritmo-cta min-h-11 w-full rounded-full text-sm font-semibold">
          {isEditing ? "Salvar alterações" : "Registrar corrida"}
        </button>
      </form>

      {isEditing && (
        <button
          type="button"
          onClick={() => {
            onDelete(session.id);
            onClose();
          }}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-ritmo-pink-deep transition-colors hover:bg-ritmo-pink-light"
        >
          Excluir corrida
        </button>
      )}
    </Sheet>
  );
}

// Monta o resumo que é enviado pro Gemini analisar.
//
// Este arquivo é a fronteira de privacidade do app: só o que entra no objeto
// devolvido por `buildAiSummary` sai do aparelho. Hoje sai bastante coisa —
// nome de hábito, de exercício e de prova, as notas escritas no diário, o
// título das tarefas e os compromissos da agenda.
//
// Foi escolha consciente, não descuido: sem os nomes a análise não consegue
// dizer que "Supino" travou nem que "Beber água" puxa o resto do dia, e sem as
// notas ela não sabe que a semana pesada tinha explicação escrita ali. Pra
// cortar qualquer um desses campos depois, basta parar de preenchê-lo aqui —
// nenhuma outra parte do app precisa mudar junto.
//
// O que nunca entra: e-mail, id de usuário e os ids internos dos registros.
// Não servem pra análise nenhuma e só existiriam pra vazar.
import { todayISO, addDays, daysBetween } from "./date.js";
import { habitProgress } from "./habitProgress.js";
import { activityName, feelingLabel } from "./journal.js";
import {
  bestTrainingPace,
  monthConsistency,
  nextRace,
  racePace,
  sessionPace,
  weekProgress,
} from "./running.js";
import { formatDuration, formatPace } from "./pace.js";

// Dois meses de histórico. É a janela onde o app consegue comparar "agora"
// com "antes" sem mandar a vida inteira da pessoa numa requisição só.
const WINDOW_DAYS = 60;
const SEMANAS = 8;

// Cargas por exercício. Seis registros já mostram a trajetória; a lista
// inteira faria 24 exercícios virarem metade do payload.
const CARGAS_POR_EXERCICIO = 6;

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const weekdayOf = (iso) => WEEKDAY[new Date(`${iso}T00:00:00`).getDay()];

// Pace e tempo viajam como texto ("5:42") em vez de segundos. O trabalho do
// modelo aqui é redação, e 342 é um número que ele pode acabar somando errado.
const paceText = (seconds) => (seconds == null ? null : `${formatPace(seconds)}/km`);
const tempoText = (seconds) => (seconds == null ? null : formatDuration(seconds));

/* -------------------------------- hábitos -------------------------------- */

// Marcações semana a semana, da mais recente pra mais antiga. Só vão as
// semanas em que o hábito já existia: um hábito criado terça-feira teria sete
// semanas de zero atrás dele, e qualquer leitura em cima disso diria que ele
// "despencou" quando na verdade ele nem tinha nascido.
function marcacoesPorSemana(habit, today) {
  const idade = daysBetween(habit.startDate, today);
  if (idade < 0) return [];
  const semanas = Math.min(SEMANAS, Math.floor(idade / 7) + 1);
  const out = [];
  for (let i = 0; i < semanas; i++) {
    const fim = addDays(today, -7 * i);
    const inicio = addDays(fim, -6);
    out.push(habit.completions.filter((d) => d >= inicio && d <= fim).length);
  }
  return out;
}

function habitSummaries(habits, today) {
  return habits
    .map((habit) => {
      const p = habitProgress(habit);
      const marcas = [...habit.completions].sort();
      return {
        nome: habit.name,
        tipo: habit.periodDays ? `ciclo de ${habit.periodDays} dias` : "diário",
        estado: p.isFinished ? "ciclo concluído" : p.notStarted ? "ainda não começou" : "ativo",
        diasDesdeCriacao: daysBetween(habit.startDate, today),
        marcadoHoje: p.doneToday,
        totalDeMarcacoes: marcas.length,
        ultimaMarcacao: marcas[marcas.length - 1] ?? null,
        // Cada posição é uma semana; a primeira é a que está correndo agora.
        marcacoesPorSemana: marcacoesPorSemana(habit, today),
        ...(p.isDaily ? { sequenciaAtual: p.streak } : { diaDoCiclo: p.currentDay }),
      };
    })
    .filter((h) => h.estado !== "ainda não começou");
}

/* --------------------------------- força --------------------------------- */

function gymSummary(workout, bodyFat, today) {
  const desde = addDays(today, -WINDOW_DAYS);
  const exercicios = (workout?.exercises ?? []).map((e) => ({
    ficha: e.group,
    nome: e.name,
    seriesReps: e.setsReps || null,
    observacao: e.notes || null,
    // Ordenadas do mais antigo pro mais novo: a leitura é a trajetória, e
    // invertido o modelo lê a queda como subida.
    cargas: [...e.cargaLogs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-CARGAS_POR_EXERCICIO)
      .map((log) => ({ data: log.date, peso: log.weight })),
  }));

  return {
    fichaComecouEm: workout?.createdAt ?? null,
    exercicios,
    diasComTreinoRegistrado: [
      ...new Set(
        (workout?.exercises ?? []).flatMap((e) =>
          e.cargaLogs.filter((l) => l.date >= desde).map((l) => l.date),
        ),
      ),
    ].sort(),
    gordura: [...bodyFat]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({ data: b.date, percentual: b.percent })),
  };
}

/* -------------------------------- corrida -------------------------------- */

function runningSummary(running, today) {
  const races = running?.races ?? [];
  const sessions = running?.sessions ?? [];
  const plan = running?.plan ?? null;
  const desde = addDays(today, -WINDOW_DAYS);
  const planRace = plan?.raceId ? races.find((r) => r.id === plan.raceId) : null;

  const semana = plan ? weekProgress(plan, sessions, today) : null;
  const mes = plan ? monthConsistency(plan, sessions, planRace) : null;

  return {
    plano: plan
      ? {
          nome: plan.name,
          corridasPorSemana: plan.weeklyTarget,
          paceMeta: paceText(plan.goalPace),
          comecouEm: plan.startDate,
          terminaEm: plan.endDate ?? planRace?.date ?? null,
          feitasNestaSemana: semana ? `${semana.done} de ${semana.target}` : null,
          feitasNesteMes: mes ? `${mes.done} de ${mes.target} previstas até hoje` : null,
        }
      : null,
    provas: races.map((r) => ({
      nome: r.name,
      data: r.date,
      quandoE: r.date >= today ? `daqui a ${daysBetween(today, r.date)} dias` : "já passou",
      distanciaKm: r.distanceKm,
      local: r.location || null,
      categoria: r.category || null,
      paceMeta: paceText(r.goalPace),
      tempoFinal: tempoText(r.resultTime),
      paceFinal: paceText(racePace(r)),
      colocacaoGeral: r.rankOverall,
      colocacaoNaCategoria: r.rankCategory,
      observacao: r.notes || null,
    })),
    proximaProva: nextRace(races, today)?.name ?? null,
    melhorPaceDeTreino: paceText(bestTrainingPace(sessions)),
    corridas: sessions
      .filter((s) => s.date >= desde)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        data: s.date,
        diaDaSemana: weekdayOf(s.date),
        distanciaKm: s.distanceKm,
        tempo: tempoText(s.duration),
        pace: paceText(sessionPace(s)),
        tipo: s.kind || null,
        observacao: s.notes || null,
        doPlano: plan ? s.planId === plan.id : false,
      })),
  };
}

/* --------------------------------- diário -------------------------------- */

function journalSummary(entries, today) {
  const desde = addDays(today, -WINDOW_DAYS);
  return entries
    .filter((e) => e.date >= desde)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      data: e.date,
      diaDaSemana: weekdayOf(e.date),
      atividade: activityName(e),
      // O número e a palavra juntos: 1 a 5 é o que dá pra comparar, mas é o
      // "acabada" que o texto final vai querer citar.
      disposicao: e.activityType === "rest" ? null : e.feeling,
      comoFoi: e.activityType === "rest" ? null : feelingLabel(e.feeling),
      descanso: e.activityType === "rest",
      anotacao: e.notes || null,
    }));
}

/* -------------------------------- tarefas -------------------------------- */

function taskSummary(tasks, today) {
  const desde = addDays(today, -WINDOW_DAYS);
  const pendentes = tasks.filter((t) => !t.done);
  const concluidas = tasks.filter((t) => t.done && (!t.date || t.date >= desde));

  const linha = (t) => ({
    titulo: t.title,
    data: t.date || null,
    urgente: !!t.urgent,
    observacao: t.note || null,
    ...(t.date && t.date < today && !t.done
      ? { atrasadaHa: `${daysBetween(t.date, today)} dias` }
      : {}),
  });

  return {
    pendentes: pendentes.map(linha),
    concluidas: concluidas.map(linha),
    totalPendentes: pendentes.length,
    totalConcluidas: tasks.filter((t) => t.done).length,
  };
}

/* -------------------------------- agenda --------------------------------- */

// Duas semanas pra frente e duas pra trás. A agenda entra pra explicar o que
// aperta o dia, e um compromisso de outubro não explica a semana de agosto.
function agendaSummary(events, today) {
  const inicio = addDays(today, -14);
  const fim = addDays(today, 14);
  return events
    .filter((e) => e.dateISO >= inicio && e.dateISO <= fim)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map((e) => ({
      titulo: e.title,
      data: e.dateISO,
      diaDaSemana: weekdayOf(e.dateISO),
      diaTodo: e.allDay,
      hora: e.allDay ? null : new Date(e.start).toTimeString().slice(0, 5),
      local: e.location || null,
      agenda: e.calendarName || null,
    }));
}

/* --------------------------------- tudo ---------------------------------- */

// `regras` é a saída do motor determinístico (lib/insights.js). Ela vai junto
// de propósito: o Gemini entra como camada por cima, não no lugar. Sabendo o
// que as regras já afirmaram, ele evita repetir com outras palavras o que a
// tela mostra logo abaixo, e pode usar essas leituras como matéria-prima pra
// cruzar áreas que nenhuma regra cruza.
export function buildAiSummary(
  { tasks = [], habits = [], workout = null, bodyFat = [], running = null, journal = [], events = [], calendarConnected = false },
  regras = {},
) {
  const today = todayISO();

  return {
    hoje: today,
    diaDaSemana: weekdayOf(today),
    janelaDeDias: WINDOW_DAYS,
    habitos: habitSummaries(habits, today),
    forca: gymSummary(workout, bodyFat, today),
    corrida: runningSummary(running, today),
    diario: journalSummary(journal, today),
    tarefas: taskSummary(tasks, today),
    agenda: calendarConnected ? agendaSummary(events, today) : null,
    agendaConectada: calendarConnected,
    regras: Object.fromEntries(
      Object.entries(regras.areas ?? {}).map(([area, itens]) => [
        area,
        itens.map((i) => i.text),
      ]),
    ),
  };
}

// Sem histórico o modelo só conseguiria repetir os cards em outras palavras —
// o que gasta cota pra não dizer nada novo. A régua não é "tem algum dado", é
// "tem dado suficiente pra existir comparação": cinco registros no total,
// vindos de qualquer combinação de áreas.
export function hasEnoughDataForAi(summary) {
  const registros =
    summary.habitos.reduce((sum, h) => sum + h.totalDeMarcacoes, 0) +
    summary.forca.exercicios.reduce((sum, e) => sum + e.cargas.length, 0) +
    summary.corrida.corridas.length +
    summary.corrida.provas.length +
    summary.diario.length +
    summary.tarefas.totalConcluidas;

  return registros >= 5;
}

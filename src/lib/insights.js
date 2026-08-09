// O motor de insights.
//
// Duas regras que valem pra tudo aqui:
//
// 1. NÃO REPETIR A TELA. Se o card já diz "4 dias seguidos", um insight
//    dizendo "está com 4 dias seguidos" não é insight, é legenda. Só entra
//    aqui o que exige cruzar registros, olhar o tempo ou comparar coisas que
//    a interface mostra separadas.
//
// 2. FUNCIONAR COM POUCO HISTÓRICO. A primeira versão pedia 3 registros de
//    carga por exercício, 8 de diário, 6 corridas. Quem usa o app há cinco
//    dias não alcança nada disso — e aí só sobravam as regras de contagem,
//    que são justamente as óbvias. Agora o limiar mínimo é sempre o menor que
//    ainda sustenta a afirmação.
//
// Um insight é { id, area, tone, text, clause? }. O `clause` é a forma
// minúscula, pronta pra entrar depois de uma vírgula — é o que o parágrafo
// do Perfil usa. Só quem tem `clause` pode encabeçar a área lá.
import { todayISO, addDays, daysBetween, formatDatePtBr } from "./date.js";
import { joinNames, joinNamesCapped } from "./text.js";
import { formatDistance, formatPace, formatPaceLabel } from "./pace.js";
import {
  bestTrainingPace,
  daysSinceLastRun,
  monthConsistency,
  nextRace,
  pastRaces,
  racePace,
  sessionPace,
  sessionsInRange,
  weekProgress,
} from "./running.js";
import { activityName, entriesInRange, feelingLabel } from "./journal.js";
import { habitProgress } from "./habitProgress.js";

export const AREA_LABEL = {
  habits: "Hábitos",
  gym: "Força",
  running: "Corrida",
  journal: "Diário",
  tasks: "Tarefas",
  agenda: "Agenda",
  cross: "Visão geral",
};

const TONE_ORDER = { up: 0, down: 1, tip: 2 };

export function sortInsights(items) {
  return [...items].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export function groupInsights(items) {
  return {
    evolutions: items.filter((i) => i.tone === "up"),
    improvements: items.filter((i) => i.tone === "down"),
    suggestions: items.filter((i) => i.tone === "tip"),
  };
}

// `covers` marca quais áreas esse insight já explica. O parágrafo do Perfil
// usa isso pra não dizer duas vezes a mesma coisa: se o cruzamento já falou
// da carga caindo, a frase de Força é pulada.
function writer(area) {
  const make = (tone) => (id, text, clause, covers) => ({
    id: `${area}-${id}`,
    area,
    tone,
    text,
    ...(clause ? { clause } : {}),
    ...(covers ? { covers } : {}),
  });
  return { up: make("up"), down: make("down"), tip: make("tip") };
}

const plural = (n, one, many) => (n === 1 ? one : many);
const daysText = (n) => `${n} ${plural(n, "dia", "dias")}`;
const dec = (n) => n.toFixed(1).replace(".", ",");

function untilText(days) {
  if (days <= 0) return "é hoje";
  if (days === 1) return "é amanhã";
  return `é em ${days} dias`;
}

const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const weekdayOf = (iso) => new Date(`${iso}T00:00:00`).getDay();

// Todos os dias entre duas datas, inclusive.
function daysRange(startISO, endISO) {
  const out = [];
  const total = daysBetween(startISO, endISO);
  for (let i = 0; i <= total; i++) out.push(addDays(startISO, i));
  return out;
}

const avg = (list) => (list.length === 0 ? null : list.reduce((a, b) => a + b, 0) / list.length);

/* -------------------------------- hábitos -------------------------------- */

// A janela onde faz sentido medir. Começa no primeiro dia em que ela de fato
// marcou alguma coisa — não na data de criação do hábito.
//
// A diferença importa muito: quem cria seis hábitos no dia 1 e só começa a
// marcar no dia 3 tem dois dias zerados no começo. Comparar "dias com o
// hábito X" contra esses dias mortos faz qualquer hábito parecer milagroso,
// porque o outro lado da conta é zero por construção.
function habitWindow(habits, today) {
  const primeiraMarca = habits
    .flatMap((h) => h.completions)
    .sort()[0];
  if (!primeiraMarca) return null;
  const teto = addDays(today, -27);
  const inicio = primeiraMarca > teto ? primeiraMarca : teto;
  if (inicio > today) return null;
  return daysRange(inicio, today);
}

export function buildHabitInsights(habits, today = todayISO()) {
  const w = writer("habits");
  const items = [];
  const active = habits.filter((h) => {
    const p = habitProgress(h);
    return !p.isFinished && !p.notStarted;
  });
  if (active.length === 0) return items;

  const window = habitWindow(active, today);
  if (!window) return items;

  // Quantos hábitos ela cumpriu em cada dia da janela.
  const doneByDay = new Map(
    window.map((d) => [d, active.filter((h) => h.completions.includes(d)).length]),
  );

  /* Quanto ela aguenta de verdade — nenhuma tela mostra isso. A pessoa vê
     seis cards e não vê que a média real é três. */
  if (active.length >= 4 && window.length >= 4) {
    const media = avg([...doneByDay.values()]);
    // Arredonda pra cima: sugerir a média pura como meta é sugerir que ela
    // pare onde já está. O número tem que puxar um pouco.
    const honesta = Math.min(active.length - 1, Math.max(2, Math.ceil(media)));
    if (media < active.length * 0.7 && honesta >= 2) {
      items.push(
        w.tip(
          "carga-honesta",
          `Você mantém ${active.length} hábitos ativos, mas cumpre ${dec(media)} por dia em média. Uma meta de ${honesta} seria mais honesta — e bem mais fácil de bater todo dia.`,
          `você mantém ${active.length} hábitos ativos mas cumpre ${dec(media)} por dia em média, o que sugere que ${honesta} seria uma meta mais honesta`,
        ),
      );
    }
  }

  /* O hábito âncora: aquele que, nos dias em que acontece, puxa os outros
     junto. É invisível no app — cada hábito vive no próprio card. */
  if (active.length >= 3 && window.length >= 5) {
    let melhor = null;
    for (const habit of active) {
      const com = window.filter((d) => habit.completions.includes(d));
      const sem = window.filter((d) => !habit.completions.includes(d));
      if (com.length < 2 || sem.length < 2) continue;
      // Tira o próprio hábito da conta, senão ele se puxa sozinho.
      const mediaCom = avg(com.map((d) => doneByDay.get(d) - 1));
      const mediaSem = avg(sem.map((d) => doneByDay.get(d)));
      const ganho = mediaCom - mediaSem;
      if (ganho >= 1.2 && (!melhor || ganho > melhor.ganho)) {
        melhor = { habit, ganho, mediaCom, mediaSem };
      }
    }
    if (melhor) {
      items.push(
        w.up(
          "ancora",
          `Nos dias em que você marca "${melhor.habit.name}", cumpre em média ${dec(melhor.mediaCom)} dos outros hábitos; nos dias sem ele, ${dec(melhor.mediaSem)}. Ele parece puxar o resto junto.`,
          `"${melhor.habit.name}" parece puxar os outros hábitos junto — nos dias em que ele acontece você cumpre ${dec(melhor.mediaCom)} dos demais, contra ${dec(melhor.mediaSem)} nos outros dias`,
        ),
      );
    }
  }

  /* O dia da semana que sempre escapa. Precisa de duas passagens por cada
     dia da semana pra não chamar de padrão o que foi acaso. */
  if (window.length >= 14 && active.length >= 2) {
    const porDia = new Map();
    for (const d of window) {
      const wd = weekdayOf(d);
      if (!porDia.has(wd)) porDia.set(wd, []);
      porDia.get(wd).push(doneByDay.get(d) / active.length);
    }
    const completos = [...porDia.entries()].filter(([, v]) => v.length >= 2);
    if (completos.length >= 5) {
      const medias = completos.map(([wd, v]) => ({ wd, media: avg(v) }));
      medias.sort((a, b) => a.media - b.media);
      const pior = medias[0];
      const resto = avg(medias.slice(1).map((m) => m.media));
      if (resto - pior.media >= 0.3) {
        items.push(
          w.down(
            "dia-fraco",
            `${WEEKDAY[pior.wd].charAt(0).toUpperCase() + WEEKDAY[pior.wd].slice(1)} é o seu dia mais fraco: você cumpre ${Math.round(pior.media * 100)}% dos hábitos, contra ${Math.round(resto * 100)}% nos outros dias.`,
            `${WEEKDAY[pior.wd]} é o dia que mais escapa, com ${Math.round(pior.media * 100)}% dos hábitos cumpridos contra ${Math.round(resto * 100)}% no resto da semana`,
          ),
        );
      }
    }
  }

  /* Hábitos que nunca saíram do papel — juntos numa frase só, em vez de um
     insight repetido pra cada um. */
  const nunca = active.filter(
    (h) => h.completions.length === 0 && daysBetween(h.startDate, today) >= 3,
  );
  if (nunca.length > 0) {
    const nomes = joinNamesCapped(nunca.map((h) => `"${h.name}"`), 2);
    items.push(
      w.down(
        "nunca",
        nunca.length === 1
          ? `${nomes} está no app desde que você criou e nunca foi marcado. Ou não cabe na rotina, ou a meta ficou grande demais.`
          : `${nunca.length} hábitos nunca foram marcados: ${nomes}. Ou não cabem na rotina, ou as metas ficaram grandes demais.`,
        nunca.length === 1
          ? `${nomes} nunca foi marcado desde que você criou`
          : `${nunca.length} hábitos nunca saíram do papel (${nomes})`,
      ),
    );
  }

  /* Caiu de ritmo — mas comparando semana contra semana, não "faz 3 dias",
     que o próprio card já deixa claro. */
  for (const habit of active) {
    if (habit.completions.length === 0) continue;
    const idade = daysBetween(habit.startDate, today);
    if (idade < 11) continue;
    const recente = habit.completions.filter((d) => d >= addDays(today, -6) && d <= today).length;
    const anterior = habit.completions.filter(
      (d) => d >= addDays(today, -13) && d <= addDays(today, -7),
    ).length;
    if (anterior >= 3 && recente <= anterior - 3) {
      items.push(
        w.down(
          `queda-${habit.id}`,
          `"${habit.name}" caiu de ${anterior} pra ${recente} ${plural(recente, "dia", "dias")} de uma semana pra outra.`,
          `"${habit.name}" caiu de ${anterior} pra ${recente} dias de uma semana pra outra`,
        ),
      );
    } else if (anterior >= 1 && recente >= anterior + 3) {
      items.push(
        w.up(
          `subiu-${habit.id}`,
          `"${habit.name}" subiu de ${anterior} pra ${recente} dias de uma semana pra outra.`,
          `"${habit.name}" subiu de ${anterior} pra ${recente} dias na semana`,
        ),
      );
    }
  }

  return sortInsights(items);
}

/* --------------------------------- força --------------------------------- */

function parseWeight(raw) {
  const match = String(raw).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

const numericLogs = (exercise) =>
  exercise.cargaLogs
    .map((log) => ({ ...log, value: parseWeight(log.weight) }))
    .filter((log) => log.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

// Primeiro contra último registro de cada exercício que tem os dois.
// Usado na aba Força e também no cruzamento com o diário.
export function cargaTrend(exercises = []) {
  const subiram = [];
  const caiu = [];
  for (const e of exercises) {
    const logs = numericLogs(e);
    if (logs.length < 2) continue;
    const de = logs[0].value;
    const pra = logs[logs.length - 1].value;
    if (pra > de) subiram.push({ e, de, pra });
    else if (pra < de) caiu.push({ e, de, pra, date: logs[logs.length - 1].date });
  }
  return { subiram, caiu, comDois: subiram.length + caiu.length };
}

export function buildGymInsights(workout, bodyFat = [], today = todayISO()) {
  const w = writer("gym");
  const items = [];
  const exercises = workout?.exercises ?? [];
  if (exercises.length === 0) return items;

  const comCarga = exercises.filter((e) => e.cargaLogs.length > 0);
  const comDois = exercises.filter((e) => numericLogs(e).length >= 2);

  /* O gargalo silencioso: registrar carga uma vez não gera evolução nenhuma.
     Quem preencheu 22 de 24 exercícios acha que está tudo certo — e o app não
     tem o que comparar em nenhum deles. Nenhuma tela conta isso. */
  if (comCarga.length >= 4 && comDois.length <= Math.max(2, comCarga.length * 0.25)) {
    items.push(
      w.tip(
        "segundo-registro",
        `Você já lançou carga em ${comCarga.length} dos ${exercises.length} exercícios, mas só ${comDois.length} ${plural(comDois.length, "tem", "têm")} um segundo registro. É o segundo que vira evolução — com um só, não existe o que comparar.`,
        `você lançou carga em ${comCarga.length} dos ${exercises.length} exercícios mas só ${comDois.length} ${plural(comDois.length, "tem", "têm")} um segundo registro, e é o segundo que vira evolução`,
      ),
    );
  }

  /* Uma ficha ficando pra trás enquanto as outras andam. Basta um registro
     por ficha pra isso aparecer — é comparação entre elas, não histórico. */
  const porFicha = new Map();
  for (const e of exercises) {
    const logs = e.cargaLogs;
    if (logs.length === 0) continue;
    const ultima = logs.map((l) => l.date).sort().pop();
    const atual = porFicha.get(e.group);
    if (!atual || ultima > atual) porFicha.set(e.group, ultima);
  }
  if (porFicha.size >= 2) {
    const ordenadas = [...porFicha.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const [fichaAtrasada, dataAtrasada] = ordenadas[0];
    const [fichaEmDia, dataEmDia] = ordenadas[ordenadas.length - 1];
    const atraso = daysBetween(dataAtrasada, today);
    const diferenca = daysBetween(dataAtrasada, dataEmDia);
    if (atraso >= 7 && diferenca >= 5) {
      items.push(
        w.down(
          "ficha-atrasada",
          `Faz ${daysText(atraso)} que você não registra nada do "${fichaAtrasada}", enquanto o "${fichaEmDia}" você atualizou há ${daysText(daysBetween(dataEmDia, today))}.`,
          `o "${fichaAtrasada}" está parado há ${daysText(atraso)} enquanto o "${fichaEmDia}" seguiu andando`,
        ),
      );
    }
  }

  /* Evolução de carga — agora com dois registros bastam, e dizendo de quanto
     pra quanto, que é o que a lista de histórico não junta. */
  const { subiram, caiu } = cargaTrend(exercises);

  /* Carga caindo em bloco é outro assunto que carga caindo num exercício.
     Um exercício que caiu pode ser dia ruim; todos caindo ao mesmo tempo é o
     corpo falando. A tela mostra um histórico por exercício, então essa
     leitura de conjunto não existe em lugar nenhum. */
  if (caiu.length >= 3 && caiu.length >= comDois.length * 0.75) {
    const todos = caiu.length === comDois.length;
    const exemplo = caiu.reduce((a, b) => (b.de - b.pra > a.de - a.pra ? b : a));
    items.push(
      w.down(
        "carga-em-bloco",
        `${todos ? `Todos os ${caiu.length} exercícios` : `${caiu.length} dos ${comDois.length} exercícios`} em que você registrou carga duas vezes vieram pra baixo na segunda — "${exemplo.e.name}" saiu de ${exemplo.de} pra ${exemplo.pra}. Quando cai em bloco assim, o assunto raramente é o exercício.`,
        `${todos ? `todos os ${caiu.length} exercícios` : `${caiu.length} de ${comDois.length} exercícios`} com dois registros de carga vieram pra baixo na segunda vez`,
      ),
    );
  } else if (caiu.length >= 2) {
    items.push(
      w.down(
        "carga-caiu",
        `A carga caiu em ${caiu.length} exercícios desde o primeiro registro, entre eles "${caiu[0].e.name}". Vale conferir se foi cansaço ou se o registro saiu errado.`,
        `a carga caiu em ${caiu.length} exercícios desde o primeiro registro`,
      ),
    );
  }

  if (subiram.length > 0) {
    const maior = subiram.reduce((a, b) => (b.pra - b.de > a.pra - a.de ? b : a));
    const extras = subiram.length - 1;
    items.push(
      w.up(
        "carga-subiu",
        `Sua carga em "${maior.e.name}" saiu de ${maior.de} pra ${maior.pra}${extras > 0 ? ` — e ela subiu em mais ${extras} ${plural(extras, "exercício", "exercícios")}.` : "."}`,
        `a carga de "${maior.e.name}" saiu de ${maior.de} pra ${maior.pra}${extras > 0 ? ` e subiu em mais ${extras} ${plural(extras, "exercício", "exercícios")}` : ""}`,
      ),
    );
  }
  /* Gordura: com uma medição só não há tendência, mas dá pra dizer que falta
     a segunda — que é diferente de ficar calado. */
  const medicoes = [...bodyFat].sort((a, b) => a.date.localeCompare(b.date));
  if (medicoes.length === 1) {
    const idade = daysBetween(medicoes[0].date, today);
    if (idade >= 21) {
      items.push(
        w.tip(
          "gordura-segunda",
          `Sua única medição de gordura é de ${daysText(idade)} atrás. Uma segunda transforma um número solto numa tendência.`,
        ),
      );
    }
  } else if (medicoes.length >= 2) {
    const ultima = medicoes[medicoes.length - 1];
    const primeira = medicoes[0];
    const total = ultima.percent - primeira.percent;
    const janela = daysBetween(primeira.date, ultima.date);
    if (Math.abs(total) >= 0.5 && janela >= 14) {
      const verbo = total < 0 ? "caiu" : "subiu";
      items.push(
        (total < 0 ? w.up : w.down)(
          "gordura-tendencia",
          `Seu % de gordura ${verbo} ${dec(Math.abs(total))} ${plural(Math.abs(total), "ponto", "pontos")} em ${daysText(janela)}, de ${primeira.percent}% pra ${ultima.percent}%.`,
          `o % de gordura ${verbo} ${dec(Math.abs(total))} pontos em ${daysText(janela)}`,
        ),
      );
    }
  }

  return sortInsights(items);
}

/* -------------------------------- corrida -------------------------------- */

const averagePace = (sessions) => avg(sessions.map(sessionPace).filter((p) => p != null));
const totalDistance = (sessions) => sessions.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0);

export function buildRunningInsights(
  { races = [], plan = null, sessions = [] } = {},
  today = todayISO(),
) {
  const w = writer("running");
  const items = [];

  const next = nextRace(races, today);
  const past = pastRaces(races, today);
  const planRace = plan?.raceId ? races.find((r) => r.id === plan.raceId) : null;
  const goalPace = plan?.goalPace ?? planRace?.goalPace ?? next?.goalPace ?? null;

  const withPace = sessions
    .filter((s) => sessionPace(s) != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  /* Duas contra duas já dizem alguma coisa; seis era esperar demais. */
  if (withPace.length >= 4) {
    const metade = Math.floor(withPace.length / 2);
    const recente = averagePace(withPace.slice(-metade));
    const antes = averagePace(withPace.slice(0, metade));
    const diff = Math.round(antes - recente);
    if (diff >= 8) {
      items.push(
        w.up(
          "pace-melhorou",
          `Seu pace médio caiu de ${formatPace(antes)} pra ${formatPace(recente)} entre a primeira e a segunda metade das suas corridas.`,
          `seu pace médio caiu de ${formatPace(antes)} pra ${formatPace(recente)} ao longo das corridas`,
        ),
      );
    } else if (diff <= -20) {
      items.push(
        w.down(
          "pace-piorou",
          `Seu pace médio subiu de ${formatPace(antes)} pra ${formatPace(recente)} nas corridas mais recentes.`,
          `o pace médio subiu de ${formatPace(antes)} pra ${formatPace(recente)}`,
        ),
      );
    }
  }

  /* O dia da semana em que a corrida realmente acontece — útil pra encaixar
     o plano na vida real em vez de na intenção. */
  if (sessions.length >= 4) {
    const contagem = new Map();
    for (const s of sessions) {
      const wd = weekdayOf(s.date);
      contagem.set(wd, (contagem.get(wd) ?? 0) + 1);
    }
    const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
    if (ordenado[0][1] >= Math.max(2, sessions.length * 0.4)) {
      const dias = ordenado.filter(([, n]) => n === ordenado[0][1]).map(([wd]) => WEEKDAY[wd]);
      items.push(
        w.up(
          "dia-preferido",
          `Suas corridas se concentram ${plural(dias.length, "na", "em")} ${joinNames(dias)}: ${ordenado[0][1]} das ${sessions.length}. Vale montar o plano em cima disso.`,
          `suas corridas se concentram ${plural(dias.length, "na", "em")} ${joinNames(dias)}`,
        ),
      );
    }
  }

  /* O melhor treino contra a meta de pace.
     A meta pode vir do plano ou da prova — `goalPace` acima já procura nas
     duas. Mas isto aqui exigia `next`, uma prova futura cadastrada, e a
     consequência era severa: quem treina só com plano ficava sem NENHUMA
     leitura de pace, mesmo tendo meta definida e o número na mão. Prova é uma
     data no calendário, não a origem da meta.
     Cada linha da lista já mostra o gap da própria corrida. O que a tela não
     junta — e é o que justifica esta regra — é qual foi o melhor de todos. Daí
     o mínimo de duas: com uma só, "seu melhor treino" é só outro jeito de
     dizer "sua única corrida", e o gap dela já está na tela. */
  const best = bestTrainingPace(sessions);
  if (best != null && goalPace != null && withPace.length >= 2) {
    const atraso = Math.round(best - goalPace);
    const dias = next ? daysBetween(today, next.date) : null;

    if (best <= goalPace) {
      items.push(
        w.up(
          "pace-na-meta",
          next
            ? `Seu melhor treino já está no pace da meta: ${formatPaceLabel(best)} contra ${formatPaceLabel(goalPace)} de ${next.name}.`
            : `Seu melhor treino já está no pace da meta do plano: ${formatPaceLabel(best)} contra ${formatPaceLabel(goalPace)}.`,
          next
            ? `seu melhor treino já bate o pace da meta de ${next.name}`
            : `seu melhor treino já bate o pace da meta do plano, com ${formatPaceLabel(best)}`,
        ),
      );
    } else if (next && dias <= 60) {
      // Com prova à vista o assunto é o prazo, então a frase abre pela prova.
      items.push(
        w.down(
          "pace-longe",
          `${next.name} ${untilText(dias)} e seu melhor treino está ${atraso}s/km acima da meta de ${formatPaceLabel(goalPace)}.`,
          `${next.name} ${untilText(dias)} e seu melhor treino ainda está ${atraso}s/km acima da meta`,
        ),
      );
    } else {
      // Sem prova (ou com ela ainda longe) não existe prazo pra cobrar: fica a
      // distância até a meta, sem urgência inventada.
      items.push(
        w.down(
          "pace-longe-da-meta",
          `Seu melhor treino até agora foi ${formatPaceLabel(best)}, ${atraso}s/km acima da meta de ${formatPaceLabel(goalPace)}.`,
          `seu melhor treino ainda está ${atraso}s/km acima da meta de pace`,
        ),
      );
    }
  }

  const last30 = sessionsInRange(sessions, addDays(today, -29), today);
  const prev30 = sessionsInRange(sessions, addDays(today, -59), addDays(today, -30));
  const kmNow = totalDistance(last30);
  const kmBefore = totalDistance(prev30);
  if (last30.length >= 2 && kmBefore > 0) {
    const r = (n) => Math.round(n * 10) / 10;
    if (kmNow >= kmBefore * 1.15) {
      items.push(
        w.up(
          "volume-subiu",
          `Você correu ${formatDistance(r(kmNow))} nos últimos 30 dias, contra ${formatDistance(r(kmBefore))} nos 30 anteriores.`,
          `o volume subiu pra ${formatDistance(r(kmNow))} nos últimos 30 dias`,
        ),
      );
    } else if (kmNow <= kmBefore * 0.7) {
      items.push(
        w.down(
          "volume-caiu",
          `Seu volume caiu: ${formatDistance(r(kmNow))} nos últimos 30 dias, contra ${formatDistance(r(kmBefore))} nos 30 anteriores.`,
          `o volume caiu pra ${formatDistance(r(kmNow))} nos últimos 30 dias`,
        ),
      );
    }
  }

  /* Semana e consistência do mês saíram: o card do plano já mostra "2 de 2
     essa semana — meta batida" e a barra de % logo abaixo. Repetir ali é o
     que fazia o painel parecer bobo. Fica só o que a tela não diz: */
  if (plan) {
    const week = weekProgress(plan, sessions, today);
    const month = monthConsistency(plan, sessions, planRace);
    const restam = week.target - week.done;
    const diasNaSemana = daysBetween(today, week.end);
    if (restam > 0 && diasNaSemana <= 2) {
      // No último dia da semana, `diasNaSemana` é 0 — e a frase dizia "restam 0
      // dias", que é o tipo de texto que faz a pessoa desconfiar do app todo.
      const prazo =
        diasNaSemana === 0
          ? "e ela fecha hoje"
          : diasNaSemana === 1
            ? "e resta 1 dia"
            : `e restam ${diasNaSemana} dias`;
      const prazoClause =
        diasNaSemana === 0
          ? "e ela fecha hoje"
          : `com ${diasNaSemana === 1 ? "1 dia" : `${diasNaSemana} dias`} pela frente`;
      items.push(
        w.tip(
          "semana-apertada",
          `${restam === 1 ? "Falta 1 corrida" : `Faltam ${restam} corridas`} pra fechar a semana ${prazo}.`,
          `${restam === 1 ? "falta 1 corrida" : `faltam ${restam} corridas`} pra fechar a semana, ${prazoClause}`,
        ),
      );
    }
    // O ritmo projetado pro mês — a barra mostra onde você está, não onde vai chegar.
    if (month.target >= 3 && month.ratio != null && month.ratio < 0.7) {
      const faltam = month.target - month.done;
      items.push(
        w.down(
          "ritmo-mes",
          `No ritmo atual você fecha o mês com ${month.done} de ${month.target} corridas previstas — ${faltam} a menos que o plano pede.`,
          `no ritmo atual o mês fecha ${faltam} ${plural(faltam, "corrida", "corridas")} abaixo do que o plano pede`,
        ),
      );
    }
  }

  const semCorrer = daysSinceLastRun(sessions, today);
  if (semCorrer !== null && semCorrer >= 7) {
    items.push(
      w.down(
        "parada",
        `Faz ${daysText(semCorrer)} que você não registra uma corrida.`,
        `faz ${daysText(semCorrer)} sem registrar corrida`,
      ),
    );
  } else if (sessions.length === 0 && plan) {
    items.push(
      w.tip("primeira", "Registre sua primeira corrida do plano pra o app começar a acompanhar seu pace."),
    );
  }

  const semResultado = past.filter((r) => !r.resultTime && daysBetween(r.date, today) <= 60);
  if (semResultado.length > 0) {
    const nomes = joinNames(semResultado.slice(0, 2).map((r) => r.name));
    items.push(
      w.tip(
        "sem-resultado",
        `${semResultado.length === 1 ? "A prova" : "As provas"} ${nomes} já ${plural(semResultado.length, "aconteceu", "aconteceram")} e ${plural(semResultado.length, "está", "estão")} sem tempo lançado — sem ele não dá pra calcular seu pace oficial.`,
        `${nomes} ainda ${plural(semResultado.length, "está", "estão")} sem tempo lançado`,
      ),
    );
  }

  if (next && !next.goalPace) {
    items.push(
      w.tip(
        "sem-meta",
        `${next.name} ${untilText(daysBetween(today, next.date))} e ainda não tem pace meta. Com ele definido, cada treino passa a mostrar quanto falta.`,
        `${next.name} ainda não tem pace meta definido`,
      ),
    );
  }

  if (next && !plan) {
    const dias = daysBetween(today, next.date);
    if (dias <= 120) {
      items.push(
        w.tip(
          "sem-plano",
          `${next.name} ${untilText(dias)} e você não tem plano de treino ativo.`,
          `${next.name} ${untilText(dias)} e não há plano de treino ativo`,
        ),
      );
    }
  }

  const incompletas = last30.filter((s) => !s.distanceKm || !s.duration).length;
  if (incompletas >= 2) {
    items.push(
      w.tip(
        "incompletas",
        `${incompletas} corridas dos últimos 30 dias estão sem distância ou sem tempo — faltando um dos dois, o pace não é calculado.`,
      ),
    );
  }

  const comDistancia = sessions.filter((s) => s.distanceKm);
  if (comDistancia.length >= 3) {
    const maior = comDistancia.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
    if (daysBetween(maior.date, today) <= 14) {
      items.push(
        w.up(
          "recorde-distancia",
          `Sua corrida mais longa até agora foi ${formatDistance(maior.distanceKm)}, em ${formatDatePtBr(maior.date)}.`,
          `sua corrida mais longa até agora foi ${formatDistance(maior.distanceKm)}`,
        ),
      );
    }
  }

  const ultimaProva = past.find((r) => r.resultTime);
  if (ultimaProva) {
    const pace = racePace(ultimaProva);
    if (pace && ultimaProva.goalPace && pace <= ultimaProva.goalPace) {
      items.push(
        w.up(
          "prova-na-meta",
          `Na ${ultimaProva.name} você fez ${formatPaceLabel(pace)} e bateu a meta de ${formatPaceLabel(ultimaProva.goalPace)}.`,
          `na ${ultimaProva.name} você bateu a meta de pace`,
        ),
      );
    }
    if (ultimaProva.rankCategory && ultimaProva.rankCategory <= 10) {
      items.push(
        w.up("prova-podio", `Você ficou em ${ultimaProva.rankCategory}º na categoria da ${ultimaProva.name}.`),
      );
    }
  }

  return sortInsights(items);
}

/* --------------------------------- diário -------------------------------- */

// O diário recebe o treino e as corridas porque as três coisas moram na mesma
// tela: cruzar "o que eu fiz" com "o que eu registrei" continua sendo um
// insight da aba Treino, não do Perfil.
export function buildJournalInsights(
  entries = [],
  { workout = null, sessions = [] } = {},
  today = todayISO(),
) {
  const w = writer("journal");
  const items = [];
  const treinos = entries.filter((e) => e.activityType !== "rest");

  /* O buraco entre treinar e registrar. Funciona já no segundo dia de uso e
     nenhuma tela mostra: uma lista mostra o que existe, não o que falta. */
  const desde = addDays(today, -13);
  const diasTreinados = new Set();
  for (const e of workout?.exercises ?? []) {
    for (const log of e.cargaLogs) {
      if (log.date >= desde && log.date <= today) diasTreinados.add(log.date);
    }
  }
  for (const s of sessions) {
    if (s.date >= desde && s.date <= today) diasTreinados.add(s.date);
  }
  const diasRegistrados = new Set(entriesInRange(entries, desde, today).map((e) => e.date));
  const semRegistro = [...diasTreinados].filter((d) => !diasRegistrados.has(d));
  if (diasTreinados.size >= 3 && semRegistro.length >= 2) {
    items.push(
      w.tip(
        "buraco",
        `Nas últimas duas semanas você treinou em ${diasTreinados.size} dias, mas só ${diasRegistrados.size} ${plural(diasRegistrados.size, "virou registro", "viraram registro")} no diário. O diário só consegue comparar o que ele enxerga.`,
        `você treinou em ${diasTreinados.size} dias nas últimas duas semanas mas só ${diasRegistrados.size} ${plural(diasRegistrados.size, "virou registro", "viraram registro")} no diário`,
      ),
    );
  }

  if (entries.length === 0) return sortInsights(items);

  /* Qual atividade te devolve energia e qual te derruba — com dois registros
     de cada já dá pra apontar, desde que a diferença seja grande. */
  const porAtividade = new Map();
  for (const e of treinos) {
    const nome = activityName(e);
    if (!porAtividade.has(nome)) porAtividade.set(nome, []);
    porAtividade.get(nome).push(e.feeling);
  }
  const comparaveis = [...porAtividade.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([nome, list]) => ({ nome, media: avg(list), n: list.length }))
    .sort((a, b) => b.media - a.media);
  if (comparaveis.length >= 2) {
    const melhor = comparaveis[0];
    const pior = comparaveis[comparaveis.length - 1];
    if (melhor.media - pior.media >= 1.2) {
      items.push(
        w.up(
          "melhor-atividade",
          `"${melhor.nome}" é o treino que sai melhor pra você: média ${dec(melhor.media)} de 5, contra ${dec(pior.media)} de "${pior.nome}".`,
          `"${melhor.nome}" sai bem melhor que "${pior.nome}" — média ${dec(melhor.media)} contra ${dec(pior.media)}`,
        ),
      );
    }
  }

  /* Dois treinos no mesmo dia: dá pra dizer qual dos dois pesou. Funciona
     com exatamente dois registros — que é o caso de quem começou agora. */
  const porDia = new Map();
  for (const e of treinos) {
    if (!porDia.has(e.date)) porDia.set(e.date, []);
    porDia.get(e.date).push(e);
  }
  const diasDuplos = [...porDia.entries()].filter(([, list]) => list.length >= 2);
  if (diasDuplos.length >= 1) {
    const [data, lista] = diasDuplos.sort((a, b) => b[0].localeCompare(a[0]))[0];
    const ordenado = [...lista].sort((a, b) => a.feeling - b.feeling);
    const pesado = ordenado[0];
    const leve = ordenado[ordenado.length - 1];
    if (leve.feeling - pesado.feeling >= 2) {
      items.push(
        w.down(
          "dia-duplo",
          `Em ${formatDatePtBr(data)} você fez ${lista.length} treinos no mesmo dia: "${activityName(leve)}" saiu como ${feelingLabel(leve.feeling)} e "${activityName(pesado)}" como ${feelingLabel(pesado.feeling)}. Vale testar inverter a ordem dos dois.`,
          `quando você dobra o treino no mesmo dia, "${activityName(pesado)}" é o que sai pior`,
        ),
      );
    } else if (diasDuplos.length >= 3) {
      items.push(
        w.up(
          "dia-duplo-ok",
          `Você já dobrou treino em ${diasDuplos.length} dias e a disposição se manteve nos dois. Seu corpo está aguentando bem o dia duplo.`,
          `você já dobrou treino em ${diasDuplos.length} dias sem queda de disposição`,
        ),
      );
    }
  }

  /* Tendência da disposição — quatro de cada lado em vez de oito. */
  const ordenados = [...treinos].sort((a, b) => a.date.localeCompare(b.date));
  if (ordenados.length >= 6) {
    const metade = Math.floor(ordenados.length / 2);
    const antes = avg(ordenados.slice(0, metade).map((e) => e.feeling));
    const agora = avg(ordenados.slice(-metade).map((e) => e.feeling));
    if (agora - antes >= 0.6) {
      items.push(
        w.up(
          "disposicao-subiu",
          `Sua disposição vem subindo: média ${dec(agora)} nos treinos recentes, contra ${dec(antes)} no começo.`,
          `sua disposição nos treinos vem subindo, de ${dec(antes)} pra ${dec(agora)}`,
        ),
      );
    } else if (antes - agora >= 0.6) {
      items.push(
        w.down(
          "disposicao-caiu",
          `Sua disposição vem caindo: média ${dec(agora)} nos treinos recentes, contra ${dec(antes)} no começo.`,
          `sua disposição nos treinos vem caindo, de ${dec(antes)} pra ${dec(agora)}`,
        ),
      );
    }
  }

  const ultimos = [...treinos].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const pesados = ultimos.filter((e) => e.feeling <= 2).length;
  if (ultimos.length >= 3 && pesados >= 3) {
    items.push(
      w.down(
        "cansaco",
        `${pesados} dos seus últimos ${ultimos.length} treinos vieram como "cansada" ou pior. Uma semana mais leve costuma render mais que insistir.`,
        `${pesados} dos últimos ${ultimos.length} treinos vieram como "cansada" ou pior`,
      ),
    );
  }

  const tresSemanas = entriesInRange(entries, addDays(today, -20), today);
  const descansos = tresSemanas.filter((e) => e.activityType === "rest").length;
  if (tresSemanas.length >= 10 && descansos === 0) {
    items.push(
      w.tip(
        "sem-descanso",
        `${tresSemanas.length} treinos em três semanas e nenhum descanso registrado. Marcar o descanso também conta — é ele que explica os dias bons.`,
      ),
    );
  }

  return sortInsights(items);
}

/* -------------------------------- tarefas -------------------------------- */

function taskCompletionSummary(tasks, today) {
  const start = addDays(today, -6);
  const inRange = tasks.filter((t) => t.date >= start && t.date <= today);
  const total = inRange.length;
  const done = inRange.filter((t) => t.done).length;
  return { total, done, rate: total > 0 ? done / total : null, start, end: today };
}

export function buildTaskInsights(tasks = [], today = todayISO()) {
  const w = writer("tasks");
  const items = [];
  if (tasks.length === 0) return items;

  const pendentes = tasks.filter((t) => !t.done);

  /* Há quanto tempo a mais velha está parada — a lista mostra "atrasada",
     não mostra que uma delas está ali há três semanas. */
  const atrasadas = pendentes.filter((t) => t.date && t.date < today);
  if (atrasadas.length > 0) {
    const maisVelha = atrasadas.reduce((a, b) => (a.date < b.date ? a : b));
    const idade = daysBetween(maisVelha.date, today);
    if (idade >= 7) {
      items.push(
        w.down(
          "encalhada",
          `"${maisVelha.title}" está pendente há ${daysText(idade)}. Depois de uma semana parada, ou ela vira prioridade ou vira lixo — mas não fica.`,
          `"${maisVelha.title}" está pendente há ${daysText(idade)}`,
        ),
      );
    }
  }

  /* Quantas ela realmente fecha por semana, contra quantas cria. Nenhuma tela
     compara entrada com saída. */
  const janela = 14;
  const criadas = tasks.filter((t) => t.date && t.date >= addDays(today, -janela));
  const fechadas = criadas.filter((t) => t.done);
  if (criadas.length >= 5 && fechadas.length < criadas.length * 0.5) {
    items.push(
      w.down(
        "entra-mais-que-sai",
        `Nas últimas duas semanas você marcou ${criadas.length} tarefas com data e concluiu ${fechadas.length}. A lista está crescendo mais rápido do que esvazia.`,
        `sua lista está crescendo mais rápido do que esvazia: ${criadas.length} tarefas marcadas contra ${fechadas.length} concluídas em duas semanas`,
      ),
    );
  }

  const urgentes = pendentes.filter((t) => t.urgent).length;
  if (urgentes >= 3 && urgentes >= pendentes.length * 0.5) {
    items.push(
      w.tip(
        "tudo-urgente",
        `${urgentes} das ${pendentes.length} tarefas pendentes estão marcadas como urgentes. Quando mais da metade é urgente, a marca perde a função de destacar.`,
        `${urgentes} das ${pendentes.length} pendentes estão marcadas como urgentes`,
      ),
    );
  }

  const semData = pendentes.filter((t) => !t.date).length;
  if (semData >= 4 && semData >= pendentes.length * 0.5) {
    items.push(
      w.tip(
        "sem-data",
        `${semData} das ${pendentes.length} pendentes estão sem data. Sem data elas não entram em nenhuma conta de semana — e costumam ser as que ficam.`,
      ),
    );
  }

  if (pendentes.length === 0 && tasks.some((t) => t.done)) {
    items.push(w.up("zerada", "Sua lista está zerada: nenhuma tarefa pendente.", "sua lista de tarefas está zerada"));
  }

  return sortInsights(items);
}

/* ---------------------- cruzamentos (só no Perfil) ----------------------- */

function dayName(dateISO, today) {
  if (dateISO === today) return "hoje";
  if (dateISO === addDays(today, 1)) return "amanhã";
  return WEEKDAY[weekdayOf(dateISO)];
}

// O que só existe olhando duas áreas ao mesmo tempo. Nenhuma aba pode mostrar
// isso sem invadir a outra, então mora na visão geral.
export function buildCrossInsights(
  { habits = [], workout = null, journal = [], sessions = [], tasks = [], events = [], calendarConnected = false },
  today = todayISO(),
) {
  const w = writer("cross");
  const items = [];

  const active = habits.filter((h) => {
    const p = habitProgress(h);
    return !p.isFinished && !p.notStarted;
  });
  const window = habitWindow(active, today);

  /* Dia de treino x hábitos: o dia em que ela treina é o dia em que o resto
     também anda, ou é o dia em que o resto desaba? */
  if (window && active.length >= 3) {
    const diasTreino = new Set();
    for (const e of workout?.exercises ?? []) {
      for (const log of e.cargaLogs) diasTreino.add(log.date);
    }
    for (const s of sessions) diasTreino.add(s.date);

    const com = window.filter((d) => diasTreino.has(d));
    const sem = window.filter((d) => !diasTreino.has(d));
    if (com.length >= 2 && sem.length >= 2) {
      const conta = (d) => active.filter((h) => h.completions.includes(d)).length;
      const mediaCom = avg(com.map(conta));
      const mediaSem = avg(sem.map(conta));
      if (mediaCom - mediaSem >= 1) {
        items.push(
          w.up(
            "treino-puxa",
            `Nos dias em que você treina, cumpre ${dec(mediaCom)} hábitos em média; nos dias sem treino, ${dec(mediaSem)}. O treino parece ser o que organiza o resto do seu dia.`,
            `nos dias em que você treina cumpre ${dec(mediaCom)} hábitos, contra ${dec(mediaSem)} nos dias sem treino — o treino parece organizar o resto`,
          ),
        );
      } else if (mediaSem - mediaCom >= 1) {
        items.push(
          w.down(
            "treino-atropela",
            `Nos dias de treino você cumpre ${dec(mediaCom)} hábitos, contra ${dec(mediaSem)} nos outros. O treino parece estar comendo o espaço do resto.`,
            `nos dias de treino você cumpre menos hábitos (${dec(mediaCom)}) do que nos dias sem treino (${dec(mediaSem)})`,
          ),
        );
      }
    }
  }

  /* O sinal mais importante que o app consegue dar: a carga caindo em bloco
     AO MESMO TEMPO que o diário registra treino pesado. Separados, cada um é
     um número ruim. Juntos, são o corpo pedindo recuperação — e é a única
     leitura aqui que pode mudar o que a pessoa faz amanhã. */
  const tendencia = cargaTrend(workout?.exercises ?? []);
  const diarioRecente = journal
    .filter((e) => e.activityType !== "rest" && e.date >= addDays(today, -10))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pesadosRecentes = diarioRecente.filter((e) => e.feeling <= 2);

  if (
    tendencia.caiu.length >= 3 &&
    tendencia.caiu.length >= tendencia.comDois * 0.75 &&
    diarioRecente.length >= 2 &&
    pesadosRecentes.length >= Math.ceil(diarioRecente.length / 2)
  ) {
    items.push(
      w.down(
        "recuperacao",
        `A carga caiu em ${tendencia.caiu.length} ${plural(tendencia.caiu.length, "exercício", "exercícios")} e ${pesadosRecentes.length} ${plural(pesadosRecentes.length, "dos seus últimos treinos veio", "dos seus últimos treinos vieram")} como "cansada" ou pior. As duas coisas apontam pro mesmo lado: não é o treino que está errado, é recuperação que está faltando — sono, comida ou um dia de folga.`,
        `a carga caindo em ${tendencia.caiu.length} exercícios e o diário marcando treino pesado apontam pro mesmo lado: o que está faltando é recuperação, não esforço`,
        ["gym", "journal"],
      ),
    );
  }

  /* Disposição do diário x hábitos do mesmo dia. */
  const comSentimento = journal.filter((e) => e.activityType !== "rest");
  if (comSentimento.length >= 4 && active.length >= 3) {
    const bons = comSentimento.filter((e) => e.feeling >= 4).map((e) => e.date);
    const ruins = comSentimento.filter((e) => e.feeling <= 2).map((e) => e.date);
    if (bons.length >= 2 && ruins.length >= 2) {
      const conta = (d) => active.filter((h) => h.completions.includes(d)).length;
      const mediaBons = avg(bons.map(conta));
      const mediaRuins = avg(ruins.map(conta));
      if (mediaBons - mediaRuins >= 1.2) {
        items.push(
          w.up(
            "habitos-disposicao",
            `Nos dias em que o treino saiu bem, você tinha cumprido ${dec(mediaBons)} hábitos; nos dias em que pesou, ${dec(mediaRuins)}. Os dois andam juntos.`,
            `nos dias em que o treino sai bem você tinha cumprido ${dec(mediaBons)} hábitos, contra ${dec(mediaRuins)} nos dias que pesaram`,
          ),
        );
      }
    }
  }

  /* Agenda x tarefas: onde o dia aperta. */
  if (calendarConnected && events.length > 0) {
    const weekEnd = addDays(today, 6);
    const upcoming = events.filter((e) => e.dateISO >= today && e.dateISO <= weekEnd);
    const byDay = new Map();
    upcoming.forEach((e) => byDay.set(e.dateISO, (byDay.get(e.dateISO) ?? 0) + 1));
    const pendentes = tasks.filter((t) => !t.done);

    let cheio = null;
    byDay.forEach((count, dateISO) => {
      if (!cheio || count > cheio.count) cheio = { dateISO, count };
    });

    if (cheio && cheio.count >= 3) {
      const tarefasNoDia = pendentes.filter((t) => t.date === cheio.dateISO).length;
      if (tarefasNoDia >= 2) {
        items.push(
          w.down(
            "dia-lotado",
            `${dayName(cheio.dateISO, today).charAt(0).toUpperCase() + dayName(cheio.dateISO, today).slice(1)} tem ${cheio.count} compromissos na agenda e ${tarefasNoDia} tarefas marcadas. Alguma coisa vai ter que sair.`,
            `${dayName(cheio.dateISO, today)} acumula ${cheio.count} compromissos e ${tarefasNoDia} tarefas`,
          ),
        );
      }
    }

    const livres = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      if (!byDay.has(d)) livres.push(d);
    }
    if (upcoming.length >= 3 && livres.length >= 2) {
      items.push(
        w.tip(
          "dias-livres",
          `Sua agenda está vazia ${joinNames(livres.slice(0, 3).map((d) => dayName(d, today)))} — são os melhores encaixes pra treino ou pra adiantar tarefa.`,
          `sua agenda está livre ${joinNames(livres.slice(0, 3).map((d) => dayName(d, today)))}`,
        ),
      );
    }
  }

  return sortInsights(items);
}

/* ------------------------- o parágrafo do Perfil ------------------------- */

const AREA_LEAD = {
  cross: "",
  habits: "Nos hábitos, ",
  gym: "Na parte de força, ",
  running: "Na corrida, ",
  journal: "No diário, ",
  tasks: "Nas tarefas, ",
};

// Ordem em que as áreas entram no texto: o cruzamento abre porque é o que
// nenhuma aba conseguiu dizer, e as tarefas fecham porque são o assunto mais
// solto dos cinco.
const AREA_ORDER = ["cross", "habits", "gym", "running", "journal", "tasks"];

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Uma frase por área, escolhendo o insight mais forte que tenha forma de
// oração. Vira parágrafo corrido em vez de lista — que era o pedido.
export function buildProfileParagraph(areas, { taskSummary } = {}) {
  const frases = [];
  const cobertas = new Set();

  for (const area of AREA_ORDER) {
    // Se o cruzamento já explicou essa área, não repete com outras palavras.
    if (cobertas.has(area)) continue;
    const lista = (areas[area] ?? []).filter((i) => i.clause);
    if (lista.length === 0) continue;
    const escolhido = lista[0];
    for (const c of escolhido.covers ?? []) cobertas.add(c);
    const lead = AREA_LEAD[area] ?? "";
    frases.push(lead ? `${lead}${escolhido.clause}.` : `${capitalize(escolhido.clause)}.`);
    if (frases.length >= 4) break;
  }

  if (frases.length === 0) {
    if (taskSummary?.rate != null) {
      return `Essa semana você concluiu ${Math.round(taskSummary.rate * 100)}% das tarefas com data (${taskSummary.done} de ${taskSummary.total}). Ainda é pouco histórico pra cruzar as áreas — conforme você for registrando treino, corrida e diário, esse resumo passa a apontar padrões em vez de contagens.`;
    }
    return "Ainda não há registro suficiente pra cruzar as áreas. Conforme você for marcando hábitos, carga e treinos no diário, esse resumo passa a apontar padrões que as abas sozinhas não mostram.";
  }

  return frases.join(" ");
}

/* ------------------------------ visão geral ------------------------------ */

export function buildInsights({
  tasks = [],
  habits = [],
  workout = { exercises: [] },
  bodyFat = [],
  running = { races: [], plan: null, sessions: [] },
  journal = [],
  events = [],
  calendarConnected = false,
}) {
  const today = todayISO();
  const taskSummary = taskCompletionSummary(tasks, today);
  const sessions = running?.sessions ?? [];

  const areas = {
    cross: buildCrossInsights(
      { habits, workout, journal, sessions, tasks, events, calendarConnected },
      today,
    ),
    habits: buildHabitInsights(habits, today),
    gym: buildGymInsights(workout, bodyFat, today),
    running: buildRunningInsights(running, today),
    journal: buildJournalInsights(journal, { workout, sessions }, today),
    tasks: buildTaskInsights(tasks, today),
  };

  const all = AREA_ORDER.flatMap((a) => areas[a] ?? []);

  const hasAnyData =
    tasks.length > 0 ||
    habits.length > 0 ||
    (workout?.exercises?.length ?? 0) > 0 ||
    bodyFat.length > 0 ||
    (running?.races?.length ?? 0) > 0 ||
    sessions.length > 0 ||
    journal.length > 0 ||
    events.length > 0;

  return {
    today,
    taskSummary,
    areas,
    paragraph: buildProfileParagraph(areas, { taskSummary }),
    ...groupInsights(all),
    hasAnyData,
  };
}

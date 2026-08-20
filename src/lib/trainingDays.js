// A fonte única de "ela treinou nesse dia".
//
// Até aqui, quatro lugares diferentes respondiam essa pergunta com a mesma
// conta errada: cargaLogs + corridas. O erro tinha nome e aparecia na tela — o
// painel de Força dizia "faz 8 dias que você não registra nada do Treino B" no
// dia 20, com o Treino B registrado no diário no dia 18.
//
// O diário guarda `activityType: "gym"` e `activityLabel` com o nome exato da
// ficha desde sempre (ver screens/journalSheets.jsx), e nada lia de volta: a
// ficha escolhida virava só o título da linha na tela. Então treinar sem lançar
// carga era, pro app, não treinar — e todo insight que dependia disso saía
// errado no mesmo sentido.
//
// A regra que este arquivo firma: lançar carga é UMA das formas de registrar um
// treino, não a definição de treino.
//
// Descanso fica de fora porque descanso não é treino — mas fica de fora aqui e
// só aqui. Ele é registro, e quem conta registro (a regra "buraco" do diário)
// conta ele normalmente.

const maxDate = (dates) => {
  const validas = dates.filter(Boolean);
  return validas.length === 0 ? null : validas.reduce((a, b) => (b > a ? b : a));
};

// Os dias de força: carga lançada em qualquer exercício, ou ficha marcada no
// diário. Corrida fica fora de propósito — este número vive dentro do bloco de
// força, e juntar corrida ali faria "treino de academia" e "treino" virarem a
// mesma palavra de novo, que é o bug que este arquivo existe pra fechar.
export function strengthDays({ workout = null, journal = [] } = {}) {
  const days = new Set();
  for (const e of workout?.exercises ?? []) {
    for (const log of e.cargaLogs) days.add(log.date);
  }
  for (const entry of journal) {
    if (entry.activityType === "gym") days.add(entry.date);
  }
  return days;
}

// Todos os dias em que ela treinou alguma coisa: força, corrida do plano, ou
// qualquer atividade que ela tenha escrito no diário ("Bike ergométrica" é
// treino tanto quanto o Treino A).
export function trainingDays({ workout = null, sessions = [], journal = [] } = {}) {
  const days = strengthDays({ workout, journal });
  for (const s of sessions) days.add(s.date);
  for (const entry of journal) {
    if (entry.activityType !== "rest") days.add(entry.date);
  }
  return days;
}

export function trainingDaysInRange(sources, startISO, endISO) {
  return [...trainingDays(sources)]
    .filter((d) => d >= startISO && d <= endISO)
    .sort();
}

export function strengthDaysInRange(sources, startISO, endISO) {
  return [...strengthDays(sources)]
    .filter((d) => d >= startISO && d <= endISO)
    .sort();
}

// Qual exercício da ficha citar quando a carga dela está parada. Precisa ter
// número lançado — sem isso não existe "parado em quanto" pra dizer — e entre
// os que têm, o mais antigo é o que a frase quer. Empate vai pro mais
// acompanhado, que é onde a falta do número novo custa mais.
function exercicioMaisParado(exercicios) {
  const comCarga = exercicios.filter((e) => e.cargaLogs.length > 0);
  if (comCarga.length === 0) return null;
  return [...comCarga].sort((a, b) => {
    const ua = maxDate(a.cargaLogs.map((l) => l.date));
    const ub = maxDate(b.cargaLogs.map((l) => l.date));
    return ua.localeCompare(ub) || b.cargaLogs.length - a.cargaLogs.length;
  })[0];
}

// O estado de cada ficha pelas DUAS vias, lado a lado. É a separação que não
// existia: "quando eu fiz essa ficha" e "quando eu lancei carga nela" eram a
// mesma informação, e por isso a segunda respondia pela primeira.
//
// `semCarga` é o vão entre as duas — os dias em que ela fez a ficha e nenhum
// número saiu dali. É o insight que ela queria e que o app não tinha como dar.
export function fichaStatus(workout = null, journal = []) {
  const fichas = new Map();

  for (const e of workout?.exercises ?? []) {
    if (!fichas.has(e.group)) {
      fichas.set(e.group, { ficha: e.group, exercicios: [], diasFeitos: [], cargaEm: null });
    }
    const f = fichas.get(e.group);
    f.exercicios.push(e);
    const ultima = maxDate(e.cargaLogs.map((l) => l.date));
    if (ultima && (!f.cargaEm || ultima > f.cargaEm)) f.cargaEm = ultima;
  }

  for (const entry of journal) {
    if (entry.activityType !== "gym") continue;
    // Rótulo que não encosta em ficha nenhuma é ficha renomeada ou apagada
    // depois do registro. Ignorar é melhor que inventar uma ficha que não
    // existe mais na tela dela.
    const f = fichas.get(entry.activityLabel);
    if (!f || f.diasFeitos.includes(entry.date)) continue;
    f.diasFeitos.push(entry.date);
  }

  return [...fichas.values()].map((f) => {
    const diasFeitos = [...f.diasFeitos].sort();
    const feitoEm = diasFeitos[diasFeitos.length - 1] ?? null;
    return {
      ficha: f.ficha,
      cargaEm: f.cargaEm,
      feitoEm,
      diasFeitos,
      semCarga: f.cargaEm ? diasFeitos.filter((d) => d > f.cargaEm) : diasFeitos,
      // A última vez que essa ficha aconteceu, por qualquer uma das duas vias.
      // É este campo — e não a data da carga — que responde "há quanto tempo
      // você não treina isso".
      ultimoDia: maxDate([f.cargaEm, feitoEm]),
      exercicioParado: exercicioMaisParado(f.exercicios),
    };
  });
}
